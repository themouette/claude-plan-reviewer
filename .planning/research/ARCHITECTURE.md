# Architecture Patterns

**Domain:** Rust CLI tool — stdin JSON in, browser UI review, stdout JSON out
**Researched:** 2026-04-09
**Confidence:** HIGH (Tokio/Axum docs, Plannotator source, Claude Code hooks reference)

---

## Recommended Architecture

```
stdin (Claude Code)
     |
     v
[1. stdin reader]  ← blocking read on dedicated thread
     |
     v
[2. AppState]      ← Arc<RwLock<ReviewPayload>> — shared between HTTP handlers
     |
     +---> [3. Axum HTTP server]  ← spawned on Tokio runtime, port 0
     |           |
     |           +-- GET  /api/plan        → serves plan JSON to browser
     |           +-- GET  /api/diff        → serves git diff JSON to browser
     |           +-- POST /api/decision    → receives approve/deny + annotations
     |           +-- GET  /*              → rust-embed SPA fallback (index.html)
     |
     +---> [4. browser opener]  ← webbrowser::open() in spawned task, after server ready
     |
     v
[5. shutdown channel]  ← tokio::sync::oneshot — /api/decision handler sends here
     |
     v
[6. result extractor]  ← main task awaits oneshot receiver
     |
     v
stdout (Claude Code)   ← serde_json::to_string of hookSpecificOutput
```

---

## Component Breakdown

### Component 1: stdin Reader

**Responsibility:** Read the full Claude Code PermissionRequest JSON from stdin, parse it, and make it available for the rest of the program.

**Implementation:** Synchronous `std::io::Read` on the main thread before the Tokio runtime starts. Claude Code pipes the full JSON before the hook starts, so stdin is not interactive — read it all at once with `std::io::read_to_string(stdin)` then `serde_json::from_str`.

**Why not async stdin:** Tokio's `tokio::io::stdin` implements `AsyncRead` but its underlying implementation blocks on a separate OS thread anyway, and `serde_json` only supports sync `Read`. Mixing is more complex with no benefit. Read stdin synchronously first, then start the runtime.

**Key fields from `tool_input`:**

```json
{
  "session_id": "...",
  "cwd": "/path/to/project",
  "hook_event_name": "PermissionRequest",
  "tool_name": "ExitPlanMode",
  "tool_input": {
    "plan": "## Plan\n..."
  }
}
```

The `tool_input.plan` field contains the markdown plan text. Confirmed from Plannotator source: this is the primary input field. The `cwd` field is used to locate the git repository for diff generation.

**Why not stream:** The payload is small (a plan is text, not a video). A single blocking read works and keeps the startup path simple.

---

### Component 2: AppState

**Responsibility:** Hold all read-only review data and the decision channel sender, shared across HTTP handler tasks.

**Structure:**

```rust
struct ReviewPayload {
    plan: String,              // raw markdown from tool_input.plan
    diff: Option<String>,      // unified diff text, None if no git repo or clean worktree
}

struct AppState {
    payload: ReviewPayload,
    decision_tx: Mutex<Option<oneshot::Sender<Decision>>>,
}
```

**Sharing:** Wrap in `Arc<AppState>` and pass to Axum via `.with_state(Arc::clone(&state))`. The `decision_tx` is `Option<Sender>` so the first POST to `/api/decision` takes it and subsequent calls get a 409 (already decided).

**Why `Arc` not `RwLock` on the whole state:** `ReviewPayload` is written once before the server starts and then read-only. Only `decision_tx` needs interior mutability, and `Mutex<Option<Sender>>` handles that precisely. No `RwLock` contention needed.

---

### Component 3: Axum HTTP Server

**Responsibility:** Serve embedded SPA assets and provide JSON API endpoints.

**Port selection:** Bind `TcpListener` to `127.0.0.1:0`. The OS assigns an available port. Retrieve with `listener.local_addr()?.port()`. Pass the port to the browser opener before calling `axum::serve`. This is the standard Rust pattern for ephemeral ports — zero collision risk.

**Routes:**

| Route | Method | Handler |
|-------|--------|---------|
| `/api/plan` | GET | Serialize `state.payload.plan` as JSON |
| `/api/diff` | GET | Serialize `state.payload.diff` as JSON (null if absent) |
| `/api/decision` | POST | Take `decision_tx` from state, send Decision, return 200 |
| `/*` | GET | `axum_embed::ServeEmbed<Assets>` — rust-embed SPA fallback |

**SPA embedding:** Use `rust-embed` with `axum-embed`. `axum-embed` handles the SPA routing fallback (missing paths → `index.html`) and optional pre-compressed Brotli/gzip asset serving.

```rust
#[derive(RustEmbed)]
#[folder = "ui/dist/"]
struct Assets;

// axum-embed handles SPA fallback automatically
let spa = ServeEmbed::<Assets>::with_parameters(
    Some("index.html".to_owned()),
    FallbackBehavior::Ok,
    None,
);
```

**Shutdown:** Use `axum::serve(...).with_graceful_shutdown(shutdown_signal)` where `shutdown_signal` is an async function awaiting the oneshot receiver. After the user submits a decision, the handler fires the oneshot sender; the server drains in-flight requests and exits. The main task then reads the decision and writes stdout.

```rust
let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();

axum::serve(listener, app)
    .with_graceful_shutdown(async { shutdown_rx.await.ok(); })
    .await?;
```

The decision payload itself travels on a separate `oneshot::channel::<Decision>()` — two oneshots in total: one for the decision data, one for the server shutdown trigger (can be unified by using the decision channel as the shutdown signal, since the server has nothing to do after receiving a decision).

**Simplification:** A single `oneshot::channel::<Decision>()` works as both decision carrier and shutdown trigger. The `/api/decision` handler sends the decision on this channel. The main task races `axum::serve` against `decision_rx.await` using `tokio::select!`, then cancels the server via a `CancellationToken`.

---

### Component 4: Git Diff Collection

**Responsibility:** Before starting the server, collect the git diff of the working tree relative to HEAD and store it in `ReviewPayload`.

**Implementation:** Use `git2` to open the repository rooted at `cwd` (from stdin JSON), then call `repo.diff_index_to_workdir(None, None)` for unstaged changes plus `repo.diff_tree_to_index(...)` for staged changes. Convert to unified diff text with `diff.print(DiffFormat::Patch, ...)`.

**Fallback:** If `cwd` is not a git repository, or if the diff is empty, store `None`. The browser UI renders a "no diff available" state.

**Why not shell out to `git`:** `git2` is a libgit2 binding — no subprocess, no PATH dependency. Consistent behavior across environments.

**Diff data flow:** The diff is a static string captured at startup. It does not update while the review UI is open. This is appropriate: the user is reviewing the plan that Claude just produced; the working tree state at that moment is the relevant snapshot.

**Note:** `git2` adds a compile dependency on libgit2. For a fully static binary on Linux, use the `vendored` feature: `git2 = { version = "0.19", features = ["vendored"] }`. This links libgit2 statically.

---

### Component 5: Browser Opener

**Responsibility:** Open the local URL in the system browser after the HTTP server is listening.

**Implementation:** After binding the listener and knowing the port, spawn a `tokio::task::spawn_blocking` (or a plain `std::thread`) that calls `webbrowser::open("http://127.0.0.1:{port}")`. Do not block the server startup on this.

**webbrowser crate** (v1.x, maintained): Cross-platform, suppresses browser stdout/stderr, non-blocking for GUI browsers. Use `webbrowser::open_browser_with_options` for explicit control.

**Headless / SSH detection:** `webbrowser::open` returns a `Result`. When it fails (no `$DISPLAY`, no browser, SSH without X forwarding), do not panic. Instead:

1. Check `std::env::var("DISPLAY")` on Linux/Unix — absent means likely headless.
2. Check `std::env::var("SSH_TTY")` or `SSH_CONNECTION` — present means SSH session.
3. If either condition is true, skip browser open and print the URL to stderr: `eprintln!("Open in browser: http://127.0.0.1:{}", port)`.
4. The server continues running; the user opens the URL manually.

**Timeout consideration:** The binary blocks until the user responds. In headless environments where no browser opens and nobody is watching stderr, the process will hang. This is acceptable for v1 — the hook timeout in Claude Code's settings (default 10 minutes) will kill it. Add a `--timeout` flag in a later phase.

---

### Component 6: Main Task Orchestration

**Responsibility:** Sequence all components and translate the final decision into stdout JSON.

**Flow:**

```
1. Read stdin synchronously → parse HookInput
2. Collect git diff from cwd (git2)
3. Build AppState: Arc::new(AppState { payload, decision_tx: Mutex::new(Some(tx)) })
4. Bind TcpListener on 127.0.0.1:0 → get port
5. Build Axum Router with state and routes
6. Start tokio runtime (tokio::main or Builder::new_current_thread)
7. Spawn: axum::serve(...).with_graceful_shutdown(...)
8. Spawn: browser opener (non-blocking)
9. Await decision_rx (blocks main task until user submits)
10. Trigger server shutdown
11. Serialize decision to stdout JSON
12. Exit 0
```

**Tokio runtime choice:** `#[tokio::main]` with `current_thread` flavor is sufficient. There is no CPU-bound work in handlers. Single-threaded runtime avoids Send bounds on AppState fields and reduces binary size.

If `git2` work or diff parsing is heavy enough to block, use `spawn_blocking` for that section only.

---

## Data Flow Directions

```
Claude Code → stdin → HookInput (plan text, cwd)
cwd         → git2  → diff string
plan + diff → AppState (Arc, read-only after init)

Browser → GET /api/plan    → plan JSON
Browser → GET /api/diff    → diff JSON (optional)
Browser → POST /api/decision → Decision { behavior, message }

Decision → oneshot channel → main task
main task → serde_json → stdout → Claude Code
```

---

## Draft Annotations Storage

**Decision:** In-memory only, in the `Decision` struct.

**Rationale:** The annotations are submitted once, atomically, when the user clicks "Approve" or "Deny". There is no partial-save, no resume, no multi-session persistence needed. Temp files introduce cleanup obligations and failure modes (crash leaves stale files). The review session is short-lived (seconds to minutes).

```rust
struct Decision {
    behavior: Behavior,  // Allow | Deny
    message: Option<String>,  // annotations text for deny, or optional approval notes
}
```

The browser SPA accumulates annotation state in React component state (or a simple in-memory JS store). On submit, it POSTs the final state. Nothing is persisted to disk.

**If the process is killed mid-review:** The hook times out, Claude Code treats it as a non-response (behavior depends on Claude Code version — typically proceeds or treats as deny). This is acceptable for v1.

---

## Stdout Response Format

Confirmed from Plannotator source and Claude Code hooks reference:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow"
    }
  }
}
```

For deny with annotations:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "deny",
      "message": "Please revise step 3: avoid touching the database schema directly."
    }
  }
}
```

The `message` field is fed back to Claude as the reason for denial. It is the primary channel for user annotations. Keep it as a single markdown string — Claude handles markdown.

---

## Architecture Anti-Patterns to Avoid

### Anti-Pattern 1: Polling stdin from inside the async runtime
**What:** Spawning a tokio task to async-read stdin while the server is running.
**Why bad:** Tokio's async stdin blocks a thread internally anyway. More complexity, no gain. Also, stdin is fully available before any async work is needed.
**Instead:** Read stdin synchronously before `#[tokio::main]` or before the runtime builder call.

### Anti-Pattern 2: Writing result to a temp file and reading it from main
**What:** Having the `/api/decision` handler write to a temp file, then having main poll or watch that file.
**Why bad:** Race conditions, cleanup obligations, failure modes. The whole point of channels is to avoid this.
**Instead:** `tokio::sync::oneshot` channel — zero overhead, zero persistence, zero cleanup.

### Anti-Pattern 3: Fixed port (e.g., 19432)
**What:** Hardcoding a port number.
**Why bad:** Collision with other instances or services. Breaks if user runs two Claude Code sessions simultaneously.
**Instead:** Bind to port 0 — OS assigns a free port. Retrieve with `local_addr().port()`.

### Anti-Pattern 4: Serving plan data by embedding it in index.html at startup
**What:** Template the plan markdown into the `<script>` tag of index.html when it is served.
**Why bad:** Requires dynamic HTML generation, breaks rust-embed's static asset model, makes the SPA harder to develop independently.
**Instead:** Serve plan data via `/api/plan` as a JSON endpoint. The SPA fetches it on load. Keeps the API clean and the assets truly static.

### Anti-Pattern 5: Using a multi-threaded Tokio runtime
**What:** `#[tokio::main]` default (multi-thread).
**Why bad:** Requires all AppState fields to be `Send + Sync`. `oneshot::Sender` is `Send` but its placement inside `Mutex` is fine. Adds overhead for a tool that runs briefly and has no parallelism benefit.
**Instead:** `#[tokio::main(flavor = "current_thread")]`. AppState is simpler, binary is smaller. Only revisit if profiling shows thread starvation.

---

## Scalability Considerations

This tool is not a server. It handles one session at a time, runs for seconds to minutes, and exits. Scalability is irrelevant. The relevant "scale" question is binary size and startup latency:

| Concern | Target | Approach |
|---------|--------|----------|
| Binary size | < 10 MB | release + strip + LTO, evaluate `lld` linker |
| Startup to browser open | < 500 ms | Synchronous stdin read is instant; port 0 bind is instant; git2 diff is the only variable |
| Diff size | Up to ~10k lines | In-memory string, no streaming needed |
| UI asset size | < 2 MB embedded | Keep SPA lean; no heavy frameworks unless necessary |

---

## Key Crates

| Crate | Version | Purpose | Confidence |
|-------|---------|---------|------------|
| `tokio` | 1.x | Async runtime (current_thread) | HIGH |
| `axum` | 0.8.x | HTTP router + graceful shutdown | HIGH |
| `rust-embed` | 8.x | Compile-time asset embedding | HIGH |
| `axum-embed` | 0.1.x | axum + rust-embed SPA handler | MEDIUM |
| `serde` / `serde_json` | 1.x | JSON I/O | HIGH |
| `webbrowser` | 1.x | Cross-platform browser open | HIGH |
| `git2` | 0.19.x | Git diff (no subprocess) | HIGH |
| `tokio-util` | 0.7.x | CancellationToken for shutdown | HIGH |

---

## Sources

- [Tokio oneshot channel docs](https://docs.rs/tokio/latest/tokio/sync/oneshot/index.html)
- [Axum graceful shutdown after one request — discussion #2410](https://github.com/tokio-rs/axum/discussions/2410)
- [Axum shutdown with CancellationToken — discussion #2565](https://github.com/tokio-rs/axum/discussions/2565)
- [axum-embed crate](https://crates.io/crates/axum-embed)
- [rust-embed](https://github.com/pyros2097/rust-embed)
- [webbrowser crate](https://crates.io/crates/webbrowser)
- [TcpListener port 0 (OS-assigned port)](https://docs.rs/tokio/latest/tokio/net/struct.TcpListener.html)
- [Claude Code hooks reference — PermissionRequest decision control](https://code.claude.com/docs/en/hooks-guide)
- [Plannotator source — ExitPlanMode hook flow](https://github.com/backnotprop/plannotator/blob/main/AGENTS.md)
- [Tokio async stdin caveats](https://docs.rs/tokio/latest/tokio/io/struct.Stdin.html)
- [git2 crate — Diff API](https://docs.rs/git2/latest/git2/struct.Diff.html)
