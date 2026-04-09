---
phase: 01-hook-review-ui
reviewed: 2026-04-09T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - Cargo.toml
  - build.rs
  - src/hook.rs
  - src/main.rs
  - src/render.rs
  - src/server.rs
  - ui/index.html
  - ui/package.json
  - ui/src/App.tsx
  - ui/src/index.css
  - ui/src/main.tsx
  - ui/tsconfig.app.json
  - ui/tsconfig.json
  - ui/tsconfig.node.json
  - ui/vite.config.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-09
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

This is the initial implementation of the Claude Code plan-reviewer hook binary (Rust + React/Vite). The core architecture is sound: stdin parsing, async HTTP server on a random port, oneshot channel for decision delivery, and a React SPA embedded via rust-embed. The hook protocol types in `src/hook.rs` are correct and complete.

Two security issues were found: a misleading sanitization comment that understates the XSS exposure from `javascript:` links in comrak output, compounded by `dangerouslySetInnerHTML` in the frontend. Three warnings cover correctness issues in shutdown sequencing and Mutex panic propagation. Three info items cover dead code, a missing build dependency trigger, and a tech-stack divergence from the project spec.

---

## Critical Issues

### CR-01: XSS via `javascript:` Links — Comrak + `dangerouslySetInnerHTML`

**File:** `src/render.rs:9` and `ui/src/App.tsx:281`

**Issue:** `render.rs` sets `unsafe_ = false` (the default) and the comment reads "plan content is sanitized." This is incorrect. Comrak's `unsafe_` flag only suppresses raw HTML blocks (`<script>`, inline HTML) embedded in the markdown source. It does NOT strip `javascript:` URI schemes from standard markdown links or images. A plan containing `[click me](javascript:alert(document.cookie))` will pass through comrak unmodified and be rendered by the browser when `dangerouslySetInnerHTML` injects the HTML in `App.tsx:281`.

For a local-only single-user tool the direct exploitability is low (an attacker would need to control the plan text fed to the hook), but Claude Code could theoretically be tricked into generating a plan containing such a link, and the misleading comment is a maintenance hazard.

**Fix — Option A (recommended): Enable comrak's link sanitizer**

```rust
// src/render.rs
use comrak::{markdown_to_html, Options};

pub fn render_plan_html(markdown: &str) -> String {
    let mut options = Options::default();
    options.extension.table = true;
    options.extension.tasklist = true;
    options.extension.strikethrough = true;
    options.extension.autolink = true;
    // Sanitize: strip javascript: and data: URI schemes from links/images.
    // unsafe_ remains false (raw HTML blocks are already suppressed by default).
    options.render.sanitize = true;  // requires comrak "sanitization" feature or built-in
    markdown_to_html(markdown, &options)
}
```

Check the comrak version in use (0.52) for the exact API. If `render.sanitize` is not available, use `comrak`'s `Plugins` with a custom link rewriter, or post-process with the `ammonia` crate:

```rust
// Cargo.toml
ammonia = "4"

// render.rs
pub fn render_plan_html(markdown: &str) -> String {
    let raw = markdown_to_html(markdown, &options);
    ammonia::clean(&raw)   // removes javascript: links, strips dangerous attributes
}
```

Also remove the misleading comment; replace it with an accurate one explaining what IS and IS NOT sanitized.

---

### CR-02: Watchdog `process::exit(0)` Can Fire Before Stdout Is Flushed

**File:** `src/main.rs:114-117`

**Issue:** After the tokio select resolves, `async_main` spawns a detached task that calls `std::process::exit(0)` after 3 seconds, then returns the `HookOutput` value. Control returns to synchronous `main()`, which writes the hook response to stdout via `serde_json::to_writer` (line 62). If the OS is slow flushing the stdout buffer (buffered I/O, pipe with a slow reader) and the watchdog fires within those 3 seconds, `process::exit(0)` terminates the process before the final `\n` (or the full JSON) reaches the Claude Code parent process. The hook protocol then receives a truncated or empty response, and Claude Code treats it as a hook failure — potentially a silent hang or unexpected behavior.

Additionally, the watchdog is spawned on the current-thread runtime, meaning it races with `async_main`'s return. There is no synchronization between the watchdog and the stdout write.

**Fix:** Move the watchdog spawn to after the stdout write, or use a flag/channel to confirm the write has occurred:

```rust
// src/main.rs — restructured ordering
fn main() {
    // ... parse, read stdin, start runtime ...
    let output = rt.block_on(async_main(args, plan_html));

    // Write FIRST — while runtime is still live, no watchdog yet
    serde_json::to_writer(std::io::stdout(), &output)
        .expect("failed to write hook output");

    // Now it is safe to let the process exit; spawn the watchdog after the write.
    // Or simply exit directly — the runtime was current_thread and we are done.
    std::process::exit(0);
}

// Remove the tokio::spawn watchdog from async_main entirely.
```

Alternatively, if you want to keep a watchdog for server cleanup purposes, flush stdout explicitly before spawning:

```rust
use std::io::Write;
serde_json::to_writer(std::io::stdout(), &output).expect("write failed");
std::io::stdout().flush().ok();
// now spawn watchdog
```

---

## Warnings

### WR-01: `CancellationToken` Is Dropped Immediately — Graceful Shutdown Is Dead Code

**File:** `src/server.rs:69-108`

**Issue:** The `CancellationToken` is created (`token`), cloned (`token_clone`), the clone is moved into the graceful-shutdown future, and then on line 108 the original `token` is `drop`ped. Dropping the last owner of a `CancellationToken` does NOT cancel it — cancellation requires calling `.cancel()`. So the graceful shutdown path (`token_clone.cancelled().await`) will never complete because nothing ever calls `token.cancel()`.

The comment on line 106 acknowledges this: "The CancellationToken is not exposed — process::exit handles termination." This means the entire graceful-shutdown setup (lines 69-73, 100-102) is dead code. It adds complexity and maintenance surface with no benefit.

**Fix — Option A (simplest): Remove the graceful shutdown plumbing and use plain `axum::serve`**

```rust
tokio::spawn(async move {
    axum::serve(listener, app).await.ok();
});
```

**Fix — Option B: Keep graceful shutdown and actually wire the token**

Return the token from `start_server` and call `token.cancel()` after the decision is written, before the process exits. This gives the server a chance to drain in-flight requests.

---

### WR-02: `Mutex::unwrap()` Propagates Panic on Mutex Poisoning

**File:** `src/server.rs:47`

**Issue:** `state.decision_tx.lock().unwrap()` panics if the Mutex is poisoned. A Mutex becomes poisoned when a thread panics while holding the lock. On a `current_thread` tokio runtime all tasks share the same OS thread; if any task panics inside the lock guard's scope (e.g., in a future version of `post_decide`), the Mutex is poisoned and subsequent calls to `lock()` will panic, crashing the server and leaving Claude Code without a response.

**Fix:** Use `.lock().unwrap_or_else(|e| e.into_inner())` to recover from a poisoned Mutex, since the data inside (an `Option<oneshot::Sender<Decision>>`) is safe to use even after a poison:

```rust
async fn post_decide(
    State(state): State<Arc<AppState>>,
    Json(body): Json<Decision>,
) -> impl IntoResponse {
    let mut guard = state.decision_tx.lock().unwrap_or_else(|e| e.into_inner());
    let tx = guard.take();
    match tx {
        Some(tx) => {
            let _ = tx.send(body);
            StatusCode::OK
        }
        None => StatusCode::CONFLICT,
    }
}
```

---

### WR-03: Missing Plan Input Validation — Silent Empty-Plan Rendering

**File:** `src/main.rs:49`

**Issue:** `hook_input.tool_input.plan.unwrap_or_default()` converts a missing or null `plan` field to an empty string. The hook then renders an empty markdown string to empty HTML and presents the user with a blank review UI — no indication that the plan was missing. The user may approve an empty plan thinking the UI failed to load, rather than that no plan was provided.

**Fix:** Distinguish between a missing plan and a present-but-empty plan, and surface the condition clearly:

```rust
let plan_md = match hook_input.tool_input.plan {
    Some(p) if !p.trim().is_empty() => p,
    Some(_) => {
        eprintln!("Warning: plan field is present but empty");
        "(No plan content provided)".to_string()
    }
    None => {
        eprintln!("Warning: plan field missing from tool_input — this hook expects ExitPlanMode");
        "(Plan unavailable — the hook received a tool invocation without a plan field)".to_string()
    }
};
```

---

### WR-04: `approve` Missing from `useEffect` Dependency Array

**File:** `ui/src/App.tsx:188`

**Issue:** The Enter-key `useEffect` (lines 176-188) references `approve` in its callback but does not include `approve` in its dependency array `[appState, denyOpen]`. `approve` is a non-stable function reference (recreated on every render). The `react-hooks/exhaustive-deps` ESLint rule will flag this. While the current behavior is functionally correct because `approve` checks `appState` internally and the effect is re-registered when `appState` changes, the pattern is fragile: a future change to `approve` that closes over additional state would introduce a stale-closure bug silently.

**Fix:** Either stabilize `approve` with `useCallback` and add it to the deps array, or inline the approve logic in the handler:

```tsx
// Option A: useCallback
const approve = useCallback(async () => {
  if (appState !== 'reviewing') return
  // ... rest of approve body
}, [appState])

useEffect(() => {
  if (appState !== 'reviewing') return
  const handler = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return
    if ((document.activeElement as HTMLElement)?.tagName === 'TEXTAREA') return
    if (denyOpen) return
    approve()
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [appState, denyOpen, approve])
```

---

## Info

### IN-01: Tech Stack Divergence — React Used Instead of Svelte

**File:** `ui/package.json`

**Issue:** `CLAUDE.md` specifies Svelte 5 + Vite as the recommended frontend framework for this project, with an explicit rationale (smaller bundle, no runtime, first-class Vite support). The implementation uses React 19 + Vite. React introduces a runtime bundle (~50 KB gzipped) that Svelte compiles away. For a single-binary tool distributed via `curl | sh`, bundle size and dependency count matter. This diverges from the documented tech stack without a recorded rationale.

**Fix:** Either migrate the UI to Svelte 5 (the recommended stack), or update `CLAUDE.md` to document the decision to use React and the reasoning (e.g., developer familiarity, richer ecosystem for this specific UI).

---

### IN-02: `build.rs` Missing `rerun-if-changed` for TypeScript Config Files

**File:** `build.rs:31-34`

**Issue:** The `cargo:rerun-if-changed` directives cover `ui/src`, `ui/index.html`, `ui/package.json`, and `ui/vite.config.ts`. They do not cover `ui/tsconfig.json`, `ui/tsconfig.app.json`, or `ui/tsconfig.node.json`. A change to TypeScript compiler options (e.g., enabling `strict`, adding path aliases) will not trigger a Cargo rebuild, so the embedded assets may be stale.

**Fix:** Add the missing directives:

```rust
println!("cargo:rerun-if-changed=ui/tsconfig.json");
println!("cargo:rerun-if-changed=ui/tsconfig.app.json");
println!("cargo:rerun-if-changed=ui/tsconfig.node.json");
```

---

### IN-03: Non-null Assertion on `getElementById` Without Fallback

**File:** `ui/src/main.tsx:6`

**Issue:** `document.getElementById('root')!` uses a non-null assertion. If the `root` element is absent (e.g., if the HTML template is changed, or a browser extension removes it), this throws an unhandled `TypeError: Cannot read properties of null` that surfaces as a blank page with a console error — no user-facing feedback.

**Fix:** Add an explicit guard:

```tsx
const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.textContent = 'Plan reviewer failed to initialize: #root element missing.'
  throw new Error('#root element not found')
}
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

---

_Reviewed: 2026-04-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
