# Phase 1: Hook & Review UI - Research

**Researched:** 2026-04-09
**Domain:** Rust CLI hook binary with embedded React+Vite UI, ExitPlanMode PermissionRequest protocol
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** React + TypeScript with Vite — user's stated preference. Resolves the contradiction between PROJECT.md (React+TS) and CLAUDE.md (Svelte recommendation). React wins.
- **D-02:** Markdown rendering is server-side via comrak (Rust). No client-side markdown library. The Rust server converts plan markdown to HTML before serving it. Keeps the React bundle lean.
- **D-03:** Phase 1 UI is a single-column plan review page — full-width rendered plan, approve/deny controls below.
- **D-04:** Diff view is a separate route, not a split pane. Phase 2 adds that route. Phase 1 has no placeholder column and no navigation to a diff route.
- **D-05:** Browser communicates the approve/deny decision via a fetch POST to a REST endpoint on the local Rust server. JS is required regardless (Enter key shortcut, UI-03), so a form POST is not used.
- **D-06:** Deny requires a non-empty message. The Deny submit button is disabled until the textarea contains at least one non-whitespace character. Claude receives a non-empty `message` field to act on.
- **D-07:** On auto-termination (HOOK-05), the binary sends `behavior: deny` with message `"Review timed out — plan was not approved"`. The process never silently approves an unreviewed plan.
- **D-08:** No countdown timer in the Phase 1 UI — that is v2 (UX-01 in REQUIREMENTS.md). The timeout fires silently.

### Claude's Discretion

- Exact timeout duration (how many seconds before the Claude Code default 10-minute timeout to self-terminate)
- Visual styling, color scheme, typography
- Exact URL path for the approve/deny endpoints (e.g., `/api/decide`)
- Confirmation page design and auto-close mechanism after decision
- How the Enter key shortcut is scoped (whole page focus, specific element, or modal)

### Deferred Ideas (OUT OF SCOPE)

- Diff view alongside plan — Phase 2 (separate route, not split pane)
- Countdown timer in review UI — v2, UX-01 in REQUIREMENTS.md
- Annotations on plan text — Phase 2 (ANN-01→ANN-05)
- Fast-approve mode / auto-approve after N seconds — v2, UX-03 in REQUIREMENTS.md
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOOK-01 | Binary reads Claude Code ExitPlanMode PermissionRequest JSON from stdin | Hook protocol confirmed: `tool_input.plan` field carries markdown; stdin structure documented |
| HOOK-02 | Binary writes valid PermissionRequest decision JSON exclusively to stdout on exit | Output format confirmed from official docs and plannotator source |
| HOOK-03 | All diagnostic output goes to stderr only — stdout contains only the final JSON response | stdout-only discipline is the single most critical correctness requirement; architecture enforces it |
| HOOK-04 | Binary exits cleanly within 3 seconds of decision submission | oneshot channel + graceful axum shutdown + 3s watchdog covers this |
| HOOK-05 | Binary self-terminates with a deny response before the Claude Code hook timeout | 600s default command timeout confirmed; recommend 540s (90s buffer) internal timer |
| UI-01 | Binary spawns a local HTTP server on OS-assigned port (port 0) and opens system browser | axum + TcpListener port 0 pattern documented; webbrowser 1.2.0 confirmed |
| UI-02 | Plan markdown rendered as formatted HTML (headings, lists, code blocks, tables) | comrak 0.52.0 with GFM support confirmed for server-side render |
| UI-03 | User can approve the plan with a single action (keyboard: Enter) | React `keydown` handler or `<button>` with `autofocus`; no library needed |
| UI-04 | User can deny the plan with a message | Deny form with non-empty validation (D-06); POST to `/api/decide` endpoint |
| UI-05 | Browser tab shows confirmation page and self-closes after decision | Meta refresh or `window.close()` after decision POST; server grace period |
| UI-06 | Binary prints the review URL to stderr in case browser fails to open | `eprintln!` after bind; always print URL regardless of browser result |
| CONF-01 | Hook configured via `~/.claude/settings.json` snippet with `"matcher": "ExitPlanMode"` | Settings format confirmed from official hooks docs |
| CONF-02 | Binary accepts `--no-browser` flag to skip browser open and print URL only | clap 4.6.0 derive API handles this flag |
</phase_requirements>

---

## Summary

Phase 1 builds the end-to-end approve/deny loop: Rust binary reads ExitPlanMode PermissionRequest JSON from stdin, renders the plan markdown to HTML via comrak, spawns an axum HTTP server on an OS-assigned port, opens a browser with a React+TypeScript+Vite UI, waits for the user's approve or deny decision via a REST POST, then writes the PermissionRequest decision JSON to stdout and exits cleanly.

The architecture is deliberately minimal: no persistence, no diff, no annotations. A single oneshot channel carries the decision from the HTTP handler to the main task, which then triggers graceful server shutdown and writes the stdout response. The entire flow must complete within the 10-minute Claude Code hook timeout (600 seconds for command hooks), so a configurable internal timer at ~540 seconds fires a deny response automatically if the user does not act.

The critical correctness constraint for this entire binary is stdout discipline: **only the final JSON object may be written to stdout**. Any other output breaks Claude Code's JSON parsing of the hook response. This constraint drives the decision to use `eprintln!` for everything except the terminal `serde_json::to_writer(stdout(), ...)` call.

**Primary recommendation:** Build the Rust skeleton first (stdin parse → HTTP server → stdout write), get the round-trip working with a minimal HTML page, then replace the HTML page with the Vite/React bundle. This de-risks the protocol integration before investing in the frontend build pipeline.

---

## Project Constraints (from CLAUDE.md)

Directives from `CLAUDE.md` that the planner must verify compliance with:

| Directive | Impact on Phase 1 |
|-----------|-------------------|
| Rust — for single-binary output and no runtime dependency | All server-side code must be Rust; no Node.js/Bun server |
| Must be compatible with Claude Code PermissionRequest hook stdin/stdout JSON format | Output JSON shape is locked; see Code Examples below |
| Local-only for v1 — no server-side infrastructure | HTTP server binds to `127.0.0.1` only; no external exposure |
| Frontend: React + TypeScript + Vite (D-01 overrides CLAUDE.md's Svelte recommendation) | Use `create-vite` with `react-ts` template |
| Markdown: server-side comrak (D-02) | No client-side markdown library in the React bundle |
| HTTP: axum 0.8.x | Do not use actix-web or any other HTTP framework |
| Asset embedding: rust-embed 8.x with axum feature | Enables debug/release duality for development |
| CLI: clap 4.x derive API | `--no-browser` flag uses derive macro |
| Browser: webbrowser 1.x | Cross-platform, suppresses browser stdout |
| JSON I/O: serde/serde_json 1.x | Protocol structs use `#[derive(Serialize, Deserialize)]` |

---

## Standard Stack

### Core Rust Dependencies

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tokio | 1.51.1 | Async runtime | De facto standard; `current_thread` flavor minimizes binary size and avoids Send+Sync complexity for a single-user tool |
| axum | 0.8.8 | Local HTTP server | Tokio team ships both; first-class rust-embed integration via `axum-embed`; graceful shutdown built-in |
| rust-embed | 8.11.0 | Compile-time asset embedding | Debug reads from disk (fast iteration); release bakes files in; `axum` feature flag generates handler glue |
| axum-embed | 0.1.0 | axum + rust-embed SPA handler | Handles SPA fallback (missing paths → `index.html`); `FallbackBehavior::Ok` for React router support |
| serde | 1.x | Serialization framework | Universal; derive macros for zero-boilerplate protocol struct mapping |
| serde_json | 1.0.149 | JSON stdin/stdout | `from_reader(stdin())` + `to_writer(stdout(), &response)` covers the full hook protocol |
| comrak | 0.52.0 | Markdown-to-HTML (server-side) | Full GFM (tables, task lists, strikethrough, autolinks); used by crates.io, docs.rs, lib.rs |
| clap | 4.6.0 | CLI argument parsing | Industry standard; derive API; auto-generates `--help`/`--version` from Cargo.toml |
| webbrowser | 1.2.0 | Open browser tab | Cross-platform (macOS, Linux, Windows); suppresses browser stdout/stderr |

### Frontend Dependencies (npm)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.5 | UI components | User's explicit preference (D-01); ecosystem familiarity |
| TypeScript | 6.0.2 | Type safety | Catches protocol mismatches at compile time |
| Vite | 8.0.8 | Frontend build | `--base ./` produces relative URLs compatible with rust-embed; outputs `dist/` directory |
| @vitejs/plugin-react | 6.0.1 | Vite React support | Official plugin for React + Vite integration |

> **Version note [VERIFIED: npm registry 2026-04-09]:** Vite is at **8.0.8** (latest stable), not 6.x as listed in `CLAUDE.md`. TypeScript is at **6.0.2**. These are production-stable; `create-vite@9.0.4` scaffolds new projects with Vite 8 by default. Update `CLAUDE.md` versions when writing `package.json`.

### Alternatives Considered (already in CLAUDE.md)

The CLAUDE.md already documents why alternatives were rejected. The research confirms these choices remain correct as of 2026-04-09.

### Installation

**Rust (`Cargo.toml`):**
```toml
[dependencies]
axum = { version = "0.8", features = ["macros"] }
tokio = { version = "1", features = ["full"] }
rust-embed = { version = "8", features = ["axum"] }
axum-embed = "0.1"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
comrak = { version = "0.52", default-features = false }
clap = { version = "4", features = ["derive"] }
webbrowser = "1"
```

> **Note on comrak version [VERIFIED: crates.io 2026-04-09]:** CLAUDE.md dependency block lists `comrak = "0.31"`. Current latest is **0.52.0**. Use `"0.52"` in `Cargo.toml`. The `syntect` feature adds syntax highlighting but significantly increases binary size — omit for Phase 1, evaluate for Phase 2.

**Frontend (scaffold):**
```bash
npm create vite@latest ui -- --template react-ts
cd ui && npm install
```

---

## Architecture Patterns

### Recommended Project Structure

```
claude-plan-reviewer/
├── src/
│   ├── main.rs              # Entry point: stdin read, runtime init, stdout write
│   ├── hook.rs              # HookInput / HookOutput serde structs (protocol types)
│   ├── server.rs            # Axum router, routes, AppState, shutdown logic
│   └── render.rs            # comrak markdown-to-HTML helper
├── ui/                      # React+TypeScript+Vite frontend
│   ├── src/
│   │   ├── App.tsx          # Root component: fetch /api/plan, render, approve/deny
│   │   └── main.tsx         # React entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts       # base: "./" required for rust-embed compatibility
├── build.rs                 # Invokes `npm run build` in ui/ before cargo compile
├── Cargo.toml
└── Cargo.lock
```

### Pattern 1: Synchronous Stdin Read Before Runtime

**What:** Read and parse all of stdin before starting the Tokio runtime.

**When to use:** Always — the hook receives the full JSON before the process starts. There is no streaming input.

**Example:**
```rust
// Source: ARCHITECTURE.md (project research)
fn main() {
    // 1. Read stdin BEFORE starting the async runtime
    let input_json = std::io::read_to_string(std::io::stdin())
        .expect("failed to read stdin");
    let hook_input: HookInput = serde_json::from_str(&input_json)
        .expect("failed to parse hook input JSON");

    // 2. Build the tokio runtime after all sync work is done
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(async_main(hook_input));
}
```

### Pattern 2: OS-Assigned Port with oneshot Shutdown

**What:** Bind to port 0 (OS assigns), communicate port to browser opener, use a oneshot channel to carry the decision and trigger shutdown.

**When to use:** Always — fixed ports cause collisions with concurrent sessions.

**Example:**
```rust
// Source: Tokio docs + ARCHITECTURE.md (project research)
use tokio::net::TcpListener;
use tokio::sync::oneshot;

let listener = TcpListener::bind("127.0.0.1:0").await?;
let port = listener.local_addr()?.port();
let url = format!("http://127.0.0.1:{}", port);

let (decision_tx, decision_rx) = oneshot::channel::<Decision>();

// Pass decision_tx to AppState via Arc
// Spawn server with graceful shutdown on decision_rx
// Spawn browser opener with url
// Await decision_rx in main task
```

### Pattern 3: AppState Shared Across Handlers

**What:** Wrap app state in `Arc` and inject via axum's `.with_state()`.

**Example:**
```rust
// Source: axum 0.8 docs
use std::sync::{Arc, Mutex};

struct AppState {
    plan_html: String,  // pre-rendered by comrak at startup
    decision_tx: Mutex<Option<oneshot::Sender<Decision>>>,
}

// Routes
async fn get_plan(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::json!({ "plan_html": state.plan_html }))
}

async fn post_decide(
    State(state): State<Arc<AppState>>,
    Json(body): Json<DecisionRequest>,
) -> impl IntoResponse {
    let tx = state.decision_tx.lock().unwrap().take();
    if let Some(tx) = tx {
        let _ = tx.send(body.into());
        StatusCode::OK
    } else {
        StatusCode::CONFLICT  // already decided
    }
}
```

### Pattern 4: Graceful Axum Shutdown via CancellationToken

**What:** Use `tokio_util::sync::CancellationToken` to signal shutdown from the decision handler to the axum serve loop.

**Example:**
```rust
// Source: axum discussions #2565
use tokio_util::sync::CancellationToken;

let token = CancellationToken::new();
let token_for_server = token.clone();

let serve_handle = tokio::spawn(
    axum::serve(listener, app)
        .with_graceful_shutdown(async move { token_for_server.cancelled().await })
);

// After decision received:
token.cancel();
serve_handle.await?;
```

> **Simplification:** The oneshot channel for the decision naturally acts as the shutdown signal. After `decision_rx` fires, cancel the token. No need for two separate channels.

### Pattern 5: Embedded SPA with Fallback

**What:** Use `axum-embed` with `FallbackBehavior::Ok` so any unknown path returns `index.html` (needed for React client-side routing if any route is added in Phase 2).

**Example:**
```rust
// Source: axum-embed 0.1.0 docs
use axum_embed::{FallbackBehavior, ServeEmbed};
use rust_embed::RustEmbed;

#[derive(RustEmbed, Clone)]
#[folder = "ui/dist/"]
struct Assets;

let spa = ServeEmbed::<Assets>::with_parameters(
    Some("index.html".to_owned()),
    FallbackBehavior::Ok,
    None,
);

let app = Router::new()
    .route("/api/plan", get(get_plan))
    .route("/api/decide", post(post_decide))
    .fallback_service(spa)
    .with_state(state);
```

### Pattern 6: stdout-Only Final Write (CRITICAL)

**What:** The binary writes exactly one thing to stdout — the final JSON. All other output uses `eprintln!`.

**Example:**
```rust
// This is the ONLY println!/write to stdout in the entire binary
fn write_decision_to_stdout(decision: &Decision) -> anyhow::Result<()> {
    serde_json::to_writer(std::io::stdout(), &decision)?;
    // Flush explicitly — do NOT print a trailing newline unless needed
    Ok(())
}

// All other output:
eprintln!("Review UI: http://127.0.0.1:{}", port);
eprintln!("Error: {}", e);
```

### Pattern 7: build.rs Frontend Build Gate

**What:** `build.rs` runs `npm run build` in `ui/` before cargo compiles the binary, gated by `SKIP_FRONTEND_BUILD` env var for CI cross-compilation.

**Example:**
```rust
// build.rs
fn main() {
    if std::env::var("SKIP_FRONTEND_BUILD").is_ok() {
        return;
    }
    let status = std::process::Command::new("npm")
        .args(["run", "build"])
        .current_dir(concat!(env!("CARGO_MANIFEST_DIR"), "/ui"))
        .status()
        .expect("failed to run npm run build");
    if !status.success() {
        panic!("npm run build failed");
    }
    // Tell cargo to re-run this script if frontend source changes
    println!("cargo:rerun-if-changed=ui/src");
    println!("cargo:rerun-if-changed=ui/package.json");
}
```

### Pattern 8: Self-Termination Timer (HOOK-05)

**What:** A background tokio task fires a deny response after `TIMEOUT_SECS` if no user decision arrives first. Race the timer against the decision channel.

**Example:**
```rust
// Source: CONTEXT.md D-07, HOOK-05 requirement
const TIMEOUT_SECS: u64 = 540; // 90s buffer under the 600s command hook default

let (decision_tx, decision_rx) = oneshot::channel::<Decision>();

tokio::select! {
    decision = decision_rx => {
        // User submitted a decision — handle it
        decision
    }
    _ = tokio::time::sleep(Duration::from_secs(TIMEOUT_SECS)) => {
        // Timeout fired — deny with a clear message (D-07)
        Decision {
            behavior: Behavior::Deny,
            message: Some("Review timed out — plan was not approved".to_string()),
        }
    }
}
```

### Pattern 9: Confirmation Page with Auto-Close (UI-05)

**What:** After the browser POSTs the decision, the React app transitions to a "Submitted" state that attempts `window.close()` and falls back to a meta-refresh redirect.

**Note:** Browsers only allow `window.close()` on tabs opened programmatically (via `window.open()`). Since `webbrowser::open()` uses the OS to open the tab, `window.close()` will typically be blocked. Use a meta refresh to `about:blank` or just show a "You can close this tab" message.

**Example (React):**
```tsx
// After successful POST to /api/decide:
function ConfirmationPage({ behavior }: { behavior: 'allow' | 'deny' }) {
  useEffect(() => {
    // Attempt close (may be blocked by browser)
    setTimeout(() => window.close(), 100);
  }, []);

  return (
    <div>
      <h1>{behavior === 'allow' ? 'Plan approved' : 'Plan denied'}</h1>
      <p>You can close this tab.</p>
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Fixed port number:** Use port 0 always. Fixed ports cause collisions with concurrent Claude Code sessions.
- **`println!` for diagnostics:** Use `eprintln!` for everything except the final JSON. One stray `println!` breaks Claude Code's JSON parsing.
- **`std::process::exit(0)` immediately after writing stdout:** Let the async runtime shut down cleanly via the graceful shutdown mechanism. `exit(0)` skips destructors and may truncate unflushed output.
- **Polling stdin from inside the async runtime:** Read stdin synchronously before `tokio::main`. Mixing async stdin with `serde_json`'s sync `Read` trait adds complexity for no benefit.
- **Template plan data into `index.html`:** Serve plan data from `/api/plan` as a JSON endpoint. Static assets must be truly static so rust-embed works correctly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown to HTML | Custom parser | `comrak 0.52` | GFM tables/task lists; HTML sanitization via AST; battle-tested at crates.io scale |
| Static file serving with SPA fallback | Custom axum handler | `axum-embed 0.1` | Handles `index.html` fallback, MIME types, optional pre-compressed assets |
| CLI flag parsing | Manual `std::env::args()` | `clap 4.6` derive API | `--help`, `--version`, error messages, type coercion all free |
| Cross-platform browser open | `std::process::Command::new("open")` | `webbrowser 1.2` | macOS/Linux/Windows detection, non-blocking, suppresses browser stdout |
| Asset embedding in binary | `include_bytes!` per file | `rust-embed 8.11` | Debug reads from disk, release embeds; MIME types, compression, axum integration |
| JSON protocol structs | Manual string construction | `serde_json 1.x` | Correct escaping, serialization, type safety |

**Key insight:** The "don't hand-roll" items in this domain are subtle. The browser-open implementation on macOS vs. Linux vs. headless SSH is surprisingly complex. The SPA fallback routing for `index.html` has edge cases. Reach for the crate.

---

## Hook Protocol (CRITICAL REFERENCE)

### stdin Input Schema

`[VERIFIED: code.claude.com/docs/en/hooks 2026-04-09]`

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../session.jsonl",
  "cwd": "/path/to/project",
  "permission_mode": "default",
  "hook_event_name": "PermissionRequest",
  "tool_name": "ExitPlanMode",
  "tool_input": {
    "plan": "## Plan\n\n..."
  },
  "permission_suggestions": [...]
}
```

> **`tool_input.plan` field [VERIFIED: plannotator AGENTS.md + bug report #9701]:** The `plan` field contains the full markdown plan text. This is confirmed from plannotator's implementation (`tool_input.plan`) and from the anthropics/claude-code bug report #9701 which shows `plan: "## Import/Export Feature Implementation Plan\n\n[content]"` as the parameter value. The official docs do not document ExitPlanMode's input schema explicitly, but empirical evidence from plannotator and the bug report confirms the field exists. Treat as HIGH confidence but verify empirically in Phase 1 by logging the raw stdin JSON.

> **Open question [ASSUMED]:** Are there additional fields in `tool_input` beyond `plan`? Mark for empirical verification in Phase 1 implementation.

### stdout Output Schema

`[VERIFIED: code.claude.com/docs/en/hooks-guide 2026-04-09]`

```json
// Approve:
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow"
    }
  }
}

// Deny with message:
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

### Rust Struct Definitions

```rust
// Source: official hook docs + plannotator pattern
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct HookInput {
    session_id: String,
    transcript_path: Option<String>,
    cwd: String,
    hook_event_name: String,
    tool_name: String,
    tool_input: ToolInput,
}

#[derive(Deserialize)]
struct ToolInput {
    plan: Option<String>,  // Option<> until empirically confirmed always-present
    #[serde(flatten)]
    extra: serde_json::Map<String, serde_json::Value>,  // capture unknown fields
}

#[derive(Serialize)]
struct HookOutput {
    #[serde(rename = "hookSpecificOutput")]
    hook_specific_output: HookSpecificOutput,
}

#[derive(Serialize)]
struct HookSpecificOutput {
    #[serde(rename = "hookEventName")]
    hook_event_name: String,
    decision: PermissionDecision,
}

#[derive(Serialize)]
struct PermissionDecision {
    behavior: String,  // "allow" or "deny"
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}
```

### settings.json Configuration (CONF-01)

`[VERIFIED: code.claude.com/docs/en/hooks-guide 2026-04-09]`

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "ExitPlanMode",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/plan-reviewer",
            "timeout": 600
          }
        ]
      }
    ]
  }
}
```

> **Matcher precision (from PITFALLS.md, Pitfall 14):** The matcher must be `"ExitPlanMode"` exactly. An empty matcher fires on every permission request — file writes, shell commands, all of them.

> **Timeout:** Default for `command` hooks is 600 seconds (10 minutes). The binary's internal self-termination timer should fire at 540 seconds (90-second buffer), per the Claude's Discretion allocation in CONTEXT.md.

---

## Common Pitfalls

### Pitfall 1: stdout Contamination Breaks JSON Parsing (CRITICAL)

**What goes wrong:** Any output to stdout other than the final JSON causes Claude Code to fail parsing the hook response with a `SyntaxError`.

**Why it happens:** Claude Code's hook protocol treats stdout as a raw JSON stream. Shell profile scripts that `echo` at startup also contaminate stdout (e.g., nvm/conda init output sourced from `~/.zshrc`).

**How to avoid:** Use `eprintln!` for all diagnostics. The only `println!`/`write!(stdout())` in the entire binary should be the final `serde_json::to_writer(stdout(), &output)` call. Never use log crates configured to write to stdout.

**Warning signs:** Hook appears to fire correctly but Claude Code shows a JSON parse error.

### Pitfall 2: Process Doesn't Exit Cleanly (HOOK-04 Blocker)

**What goes wrong:** The axum server's accept loop keeps the tokio runtime alive after the decision is submitted. The binary doesn't exit for minutes.

**How to avoid:** Design the graceful shutdown mechanism from day one. The oneshot channel + CancellationToken pattern ensures the server stops accepting new connections after the decision arrives. Add a 3-second watchdog:

```rust
// Safety valve: force exit if clean shutdown takes too long
tokio::spawn(async {
    tokio::time::sleep(Duration::from_secs(3)).await;
    std::process::exit(0);
});
```

**Warning signs:** `ps aux | grep plan-reviewer` shows the process running after the browser submitted the decision.

### Pitfall 3: rust-embed Debug/Release Path Mismatch

**What goes wrong:** In debug mode, rust-embed reads from the filesystem relative to `cwd` at runtime. Running `cargo run` from a directory other than the project root produces "asset not found" panics that don't reproduce in release builds.

**How to avoid:** Always run `cargo run` from the project root. Add `debug-embed` feature in development to get release-equivalent behavior. Add an explicit check at startup:

```rust
#[cfg(debug_assertions)]
if Assets::get("index.html").is_none() {
    eprintln!("ERROR: Assets not found. Run `cargo run` from the project root after building the frontend.");
    std::process::exit(1);
}
```

### Pitfall 4: Browser `window.close()` Blocked (UI-05)

**What goes wrong:** `window.close()` only works on tabs that were opened via `window.open()`. Tabs opened by `webbrowser::open()` (which calls the OS browser command) cannot be closed programmatically. Calling `window.close()` in the confirmation page has no effect.

**How to avoid:** Don't rely on `window.close()`. Show a "Decision submitted — you can close this tab" message. Optionally use `<meta http-equiv="refresh" content="2;url=about:blank">` as a soft redirect to a blank page.

### Pitfall 5: Vite `--base` Not Set to `./`

**What goes wrong:** Vite's default `base` is `/`, producing absolute URLs like `/assets/index-Bx7f.js`. When axum serves the SPA from a binary, the browser requests `/assets/index-Bx7f.js` which axum serves correctly — but only if the routes are set up correctly. More critically, the SPA fetches `/api/plan` from the correct origin only if served from the root. Missing `base: "./"` causes asset 404s in some configurations.

**How to avoid:** Set `base: "./"` in `vite.config.ts`:

```typescript
// ui/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',  // Required for rust-embed compatibility
})
```

### Pitfall 6: comrak Version Mismatch

**What goes wrong:** CLAUDE.md's dependency block lists `comrak = "0.31"` but the current version is **0.52.0**. Using `"0.31"` in Cargo.toml downloads an older version. The API surface is similar but some feature flags differ.

**How to avoid:** Use `comrak = "0.52"` in Cargo.toml. The `syntect` feature (syntax highlighting in code blocks) was in `"0.31"` but should be verified against `"0.52"` docs before enabling.

### Pitfall 7: Known Bug — `allow` Response Not Exiting Plan Mode (RESOLVED)

**What:** Bug #15755 reported that returning `behavior: allow` did not actually exit plan mode. Claude Code remained stuck in planning mode.

**Status [VERIFIED: github.com/anthropics/claude-code/issues/15755]:** CLOSED / COMPLETED. This was a regression in Claude Code 2.0.76, reported 2025-12-30, and is now fixed.

**Mitigation:** If users report plan mode not exiting after approval, advise updating Claude Code to the latest version.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Svelte (CLAUDE.md original recommendation) | React + TypeScript (D-01) | 2026-04-09 (user decision) | Use React; Svelte recommendation is superseded for this project |
| Vite 6.x (CLAUDE.md) | Vite 8.x (latest stable) | ~2026-04 | Update `package.json` to Vite 8; `@vitejs/plugin-react` at 6.0.1 |
| comrak 0.31 (CLAUDE.md dependency block) | comrak 0.52.0 (crates.io) | Recent | Use 0.52.0 in Cargo.toml |
| TypeScript 5.x | TypeScript 6.0.2 (latest) | 2026 | Use 6.0.2; check for breaking changes in tsconfig |
| webbrowser 1.0.4 (CLAUDE.md) | webbrowser 1.2.0 (crates.io) | Recent | Update to 1.2.0 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tool_input.plan` is always present in ExitPlanMode hook input (not `null`) | Hook Protocol | If absent/null, the binary has no plan to render; must handle `Option<String>` gracefully |
| A2 | No additional fields beyond `plan` exist in `tool_input` for ExitPlanMode | Hook Protocol | Unknown fields are captured by `#[serde(flatten)]` so this is low risk |
| A3 | The 540-second internal timer provides sufficient buffer under the 600-second command hook default | Architecture | If users configure shorter timeouts in their `settings.json`, the buffer may be insufficient; document that `timeout` in `settings.json` must exceed the binary's internal timeout |
| A4 | TypeScript 6.0.2 is backward-compatible with standard React+Vite tsconfig | Frontend stack | Breaking changes in TS 6 could require tsconfig updates; verify during scaffold |
| A5 | Vite 8.0.8 + `@vitejs/plugin-react` 6.0.1 work together without configuration issues | Frontend stack | New major versions may have changed defaults; verify during `npm create vite` scaffold |

---

## Open Questions

1. **Does `tool_input.plan` contain the full plan markdown or a summary?**
   - What we know: plannotator's AGENTS.md states `tool_input.plan`; bug report #9701 shows a full multi-section plan as the parameter value.
   - What's unclear: Whether very long plans are truncated. Whether the field is ever absent.
   - Recommendation: In Phase 1, log the raw stdin JSON to stderr (only when `--debug` flag is set) and verify empirically on first run.

2. **Does `updatedInput` work on `behavior: allow` for ExitPlanMode?**
   - What we know: Official docs say `updatedInput` modifies tool parameters on allow decisions. ExitPlanMode takes a `plan` parameter.
   - What's unclear: Whether Claude Code actually processes an `updatedInput.plan` value on ExitPlanMode allow decisions. The hooks guide says ExitPlanMode has "no input parameters (empty object)" which contradicts the confirmed `plan` field.
   - Recommendation: Defer to Phase 2 (annotations). Phase 1 does not need this.

3. **What is the exact behavior when the binary returns `behavior: deny` for timeout?**
   - What we know: Deny sends the message back to Claude. Claude can then re-plan.
   - What's unclear: Whether Claude Code will re-enter plan mode automatically or whether the user must prompt again.
   - Recommendation: Document expected behavior in the Phase 1 `--no-browser` acceptance test.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust / cargo | Binary compilation | Yes | rustc 1.94.1 (Homebrew) | — |
| Node.js | Frontend build (`npm run build`) | Yes | v25.8.1 | — |
| npm | Frontend scaffold + build | Yes | 11.11.0 | — |
| git | Git diff (Phase 2), version control | Yes | 2.53.0 | — |
| cargo-dist | Phase 3 release only | Not in PATH | — | Not needed for Phase 1 |

**Missing dependencies with no fallback:** None that block Phase 1.

**Notes:**
- `cargo-dist` is not installed but is not required until Phase 3 (Distribution).
- Rust 1.94.1 is current and supports all required crate features.

---

## Validation Architecture

> `nyquist_validation` is set to `false` in `.planning/config.json`. Skipping this section.

---

## Security Domain

Phase 1 is a local-only binary that processes data from Claude Code on the same machine. The attack surface is minimal: stdin comes from a trusted process (Claude Code), HTTP server binds to `127.0.0.1` only, and there is no persistent storage. Standard ASVS categories do not apply in their usual form.

| Concern | Mitigation |
|---------|------------|
| Stdout contamination (hook hijack) | Strict stdout discipline; only final JSON to stdout |
| Open server binding | `127.0.0.1` only; never `0.0.0.0` |
| XSS in rendered plan HTML | comrak's HTML sanitization via AST; do NOT use `unsafe_render=true` |
| Decision double-submit | `Mutex<Option<Sender>>` — first POST takes the sender; subsequent POSTs get 409 |
| Settings.json matcher scope creep | Use `"matcher": "ExitPlanMode"` exactly; document in install instructions |

> **comrak HTML safety:** By default, comrak sanitizes HTML embedded in markdown. Do NOT enable `unsafe_render` or `UNSAFE` render options — the plan content comes from Claude but could theoretically contain malicious HTML if the hook is misconfigured to receive non-plan inputs.

---

## Code Examples

### Verified Pattern: comrak Markdown to HTML

```rust
// Source: comrak 0.52.0 docs
use comrak::{markdown_to_html, Options};

fn render_plan(markdown: &str) -> String {
    let mut options = Options::default();
    options.extension.table = true;
    options.extension.tasklist = true;
    options.extension.strikethrough = true;
    options.extension.autolink = true;
    // Do NOT set options.render.unsafe_ = true
    markdown_to_html(markdown, &options)
}
```

### Verified Pattern: React fetch on mount

```tsx
// Standard React pattern — fetch plan HTML on component mount
import { useEffect, useState } from 'react'

type PlanData = { plan_html: string }

function App() {
  const [planHtml, setPlanHtml] = useState<string>('')
  const [submitted, setSubmitted] = useState(false)
  const [behavior, setBehavior] = useState<'allow' | 'deny' | null>(null)

  useEffect(() => {
    fetch('/api/plan')
      .then(r => r.json())
      .then((data: PlanData) => setPlanHtml(data.plan_html))
  }, [])

  async function approve() {
    await fetch('/api/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ behavior: 'allow' }),
    })
    setBehavior('allow')
    setSubmitted(true)
  }

  async function deny(message: string) {
    await fetch('/api/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ behavior: 'deny', message }),
    })
    setBehavior('deny')
    setSubmitted(true)
  }

  // ... UI rendering
}
```

### Verified Pattern: Enter Key Approve (UI-03)

```tsx
// Scope Enter key to the approve button via autoFocus
// or via a global keydown listener when the deny form is not active

useEffect(() => {
  function handleKey(e: KeyboardEvent) {
    // Only fire Enter when the deny textarea is not focused
    if (e.key === 'Enter' && document.activeElement?.tagName !== 'TEXTAREA') {
      approve()
    }
  }
  window.addEventListener('keydown', handleKey)
  return () => window.removeEventListener('keydown', handleKey)
}, [])
```

---

## Sources

### Primary (HIGH confidence)
- `[VERIFIED: code.claude.com/docs/en/hooks-guide 2026-04-09]` — PermissionRequest hook format, ExitPlanMode auto-approve example, timeout defaults, settings.json format
- `[VERIFIED: code.claude.com/docs/en/hooks 2026-04-09]` — Full hook input/output schemas, PermissionRequest decision control, command hook timeout = 600s
- `[VERIFIED: crates.io 2026-04-09]` — axum 0.8.8, rust-embed 8.11.0, axum-embed 0.1.0, comrak 0.52.0, webbrowser 1.2.0, clap 4.6.0, tokio 1.51.1, serde_json 1.0.149, tokio-util 0.7.18
- `[VERIFIED: npm registry 2026-04-09]` — react 19.2.5, vite 8.0.8, @vitejs/plugin-react 6.0.1, typescript 6.0.2, create-vite 9.0.4
- `[VERIFIED: plannotator AGENTS.md]` — `tool_input.plan` field confirmed as the plan markdown source

### Secondary (MEDIUM confidence)
- `[CITED: github.com/anthropics/claude-code/issues/9701]` — Confirms `plan` field presence in ExitPlanMode `tool_input`
- `[CITED: github.com/anthropics/claude-code/issues/15755]` — `allow` response bug confirmed CLOSED/COMPLETED
- `.planning/research/ARCHITECTURE.md` — Component architecture patterns (project-level research)
- `.planning/research/PITFALLS.md` — Domain pitfalls inventory (project-level research)
- `.planning/research/STACK.md` — Stack rationale (project-level research)

### Tertiary (LOW confidence — mark for validation)
- `[ASSUMED]` — TypeScript 6.0.2 backward-compatible with standard tsconfig — verify during scaffold
- `[ASSUMED]` — Vite 8 + @vitejs/plugin-react 6 work together without config issues — verify during scaffold

---

## Metadata

**Confidence breakdown:**
- Hook protocol: HIGH — official docs confirmed, plannotator verified
- Standard stack: HIGH — all versions verified against crates.io and npm registry
- Architecture patterns: HIGH — based on existing project research (ARCHITECTURE.md) plus official docs
- Pitfalls: HIGH — based on existing project research (PITFALLS.md) plus new findings
- Frontend version accuracy: MEDIUM — Vite 8 released ~2026-04; stable but newer than CLAUDE.md states

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (30 days for stable ecosystem; re-verify comrak/axum versions at implementation time)
