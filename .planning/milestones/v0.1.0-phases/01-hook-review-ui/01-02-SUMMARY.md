---
phase: 01-hook-review-ui
plan: 02
subsystem: server
tags: [rust, axum, tokio, oneshot, cancellation-token, webbrowser, graceful-shutdown]

# Dependency graph
requires:
  - 01-01 (Cargo.toml with all deps, HookInput/HookOutput types, render_plan_html)
provides:
  - axum HTTP server on OS-assigned port (127.0.0.1:0)
  - GET /api/plan returning rendered plan HTML as JSON
  - POST /api/decide accepting allow/deny; 409 on double-submit
  - GET / placeholder HTML page with Approve/Deny buttons
  - start_server(plan_html) -> (port, decision_rx) API
  - Full end-to-end loop: stdin -> server -> browser -> decision -> stdout -> exit
affects:
  - 01-03: React UI scaffold replaces GET / placeholder page
  - 01-04: integration tests use the same server loop

# Tech tracking
tech-stack:
  added:
    - tokio_util::sync::CancellationToken (via tokio-util rt feature, already in Cargo.toml)
  patterns:
    - "OS-assigned port: TcpListener::bind(\"127.0.0.1:0\") — no port collision across concurrent sessions"
    - "Single-decision guard: Mutex<Option<oneshot::Sender<Decision>>> — take() ensures POST /api/decide is idempotent; second call returns 409"
    - "Decision pipeline: oneshot channel from POST handler -> select! race in async_main -> HookOutput to stdout"
    - "3-second watchdog: tokio::spawn + sleep(3s) + process::exit(0) ensures HOOK-04 compliance"
    - "540s timeout: tokio::select! races decision_rx against sleep(540s) with em-dash deny message per D-07"
    - "current_thread runtime: Builder::new_current_thread() — single-user local tool, no multi-thread needed"

key-files:
  created:
    - src/server.rs
  modified:
    - src/main.rs

key-decisions:
  - "CancellationToken dropped after spawn: server runs until process::exit(0) fires; no graceful drain needed for this single-user tool"
  - "current_thread runtime chosen over #[tokio::main] multi-thread: reduces overhead for local single-user binary"
  - "Placeholder GET / handler inline in server.rs: avoids embedding a file; React UI in Plan 03 replaces it via rust-embed"

# Metrics
duration: 5min
completed: 2026-04-09T11:44:38Z
---

# Phase 01 Plan 02: Axum HTTP Server with Decision Pipeline Summary

**Axum server on OS-assigned port with oneshot decision channel, 540s timeout, 3-second watchdog, and placeholder HTML — full stdin-to-stdout hook loop operational before React UI exists**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-09T11:39:54Z
- **Completed:** 2026-04-09T11:44:38Z
- **Tasks:** 2
- **Files modified:** 2 (src/server.rs created, src/main.rs rewritten)

## Accomplishments

- Created `src/server.rs` with axum router, `AppState` (plan_html + Mutex<Option<Sender>>), route handlers for GET /api/plan, POST /api/decide (409 on double-submit), GET / (placeholder HTML)
- Replaced hardcoded `HookOutput::allow()` in main.rs with full async event loop: server spawn, URL stderr print, browser open, `tokio::select!` decision race, 3-second watchdog, stdout write
- Binary tested end-to-end: starts server, prints URL to stderr, POST /api/decide triggers allow JSON on stdout and process exit
- Verified: no `println!` anywhere, URL always on stderr, `new_current_thread()` runtime

## Task Commits

Each task was committed atomically:

1. **Task 1: Create axum server with decision pipeline and shutdown** - `a3ecf42` (feat)
2. **Task 2: Wire server into main.rs with browser launch, timeout, and clean exit** - `2ceff77` (feat)

## Files Created/Modified

- `src/server.rs` - axum Router with AppState, GET /api/plan, POST /api/decide with 409 guard, GET / placeholder HTML, start_server() returning (u16, Receiver<Decision>)
- `src/main.rs` - Full async_main: server spawn, stderr URL, browser open, tokio::select! with 540s timeout, 3s watchdog, HookOutput conversion

## Decisions Made

- `CancellationToken` created but immediately dropped after `tokio::spawn` — the axum server runs until `process::exit(0)` fires from the watchdog; no graceful drain is needed for a local single-user tool
- `new_current_thread()` runtime instead of `#[tokio::main]` — matches Plan 01's pattern of explicit runtime construction, and single-thread is sufficient for a local server
- Placeholder GET / handler is inline Rust string in `server.rs` — avoids a separate file; the React UI in Plan 03 will replace it via `rust-embed`/`axum-embed`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tokio-util `sync` feature does not exist**
- **Found during:** Task 1
- **Issue:** Plan specified `CancellationToken` from `tokio_util::sync`; attempt to add `sync` feature to `tokio-util` in Cargo.toml failed because that feature does not exist
- **Fix:** Reverted Cargo.toml to `features = ["rt"]` — `CancellationToken` is included in the `rt` feature by default
- **Files modified:** Cargo.toml (reverted to original)
- **Commit:** Reverted before Task 1 commit; no separate commit needed

## Known Stubs

- `GET /` placeholder HTML page in `server.rs` — intentional stub; Plan 03 replaces it with the React/Svelte UI via `rust-embed`/`axum-embed`. Plan currently renders the server-side `plan_html` directly so the loop is fully testable.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model. Server binds to `127.0.0.1` only; all routes are localhost-only.

## Self-Check: PASSED

- `src/server.rs` exists and contains all required symbols
- `src/main.rs` updated with async_main, server::start_server, webbrowser::open
- Commits `a3ecf42` and `2ceff77` present in git log
- `cargo build` succeeds with zero errors
- No `println!` in any source file
