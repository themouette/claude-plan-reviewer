---
phase: 01-hook-review-ui
plan: 01
subsystem: infra
tags: [rust, cargo, clap, serde, serde_json, comrak, axum, tokio, rust-embed, axum-embed, webbrowser]

# Dependency graph
requires: []
provides:
  - Cargo.toml with all Phase 1 Rust dependencies declared upfront
  - HookInput/HookOutput serde structs for ExitPlanMode PermissionRequest protocol
  - render_plan_html() via comrak with GFM extensions
  - CLI entry point with --no-browser flag via clap derive
  - Sync stdin read -> stdout write pipeline with stdout discipline enforced
affects:
  - 01-02: server.rs uses HookOutput, HookInput, render_plan_html; Cargo.toml complete
  - 01-03: React UI served by server that uses these types
  - 01-04: integration/e2e tests use the same stdin/stdout pipeline

# Tech tracking
tech-stack:
  added:
    - axum 0.8 (HTTP server, added to Cargo.toml)
    - tokio 1 with rt/macros/net/time/sync/signal features
    - tokio-util 0.7 rt feature
    - rust-embed 8 with axum feature
    - axum-embed 0.1
    - serde/serde_json 1
    - comrak 0.52 with default-features=false (no syntect)
    - clap 4 with derive feature
    - webbrowser 1
  patterns:
    - "Stdout discipline: serde_json::to_writer(stdout()) is the sole stdout write; all diagnostics use eprintln!"
    - "Sync stdin read before async runtime: std::io::read_to_string(stdin()) in main() before tokio block_on"
    - "Hook protocol: HookInput deserialized from stdin; HookOutput serialized to stdout with camelCase renames via serde"
    - "comrak GFM rendering: Options with table/tasklist/strikethrough/autolink; unsafe_ NOT enabled"

key-files:
  created:
    - Cargo.toml
    - src/main.rs
    - src/hook.rs
    - src/render.rs
  modified: []

key-decisions:
  - "comrak 0.52 with default-features=false: avoids syntect syntax-highlighting binary bloat (evaluate for Phase 2)"
  - "tokio features subset (not 'full'): rt/macros/net/time/sync/signal — reduces binary size"
  - "All Phase 1 Cargo.toml deps declared upfront: Plans 02/03 (parallel Wave 2) need no Cargo.toml edits"
  - "Hook output hook_event_name hardcoded to 'PermissionRequest': matches ExitPlanMode protocol"

patterns-established:
  - "Pattern: stdout discipline — serde_json::to_writer(stdout()) is the ONLY write to stdout"
  - "Pattern: sync stdin read in main() before any async runtime initialization"
  - "Pattern: eprintln! for all diagnostics including port URL (UI-06)"

requirements-completed: [HOOK-01, HOOK-02, HOOK-03, CONF-02]

# Metrics
duration: 4min
completed: 2026-04-09
---

# Phase 01 Plan 01: Rust Project Scaffold Summary

**Compilable Rust binary with ExitPlanMode stdin parse, comrak GFM rendering, clap --no-browser flag, and serde_json stdout-only write — proves stdout discipline before any server code exists**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-09T11:35:24Z
- **Completed:** 2026-04-09T11:39:05Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Declared all Phase 1 Rust dependencies in Cargo.toml upfront so parallel Wave 2 plans (02, 03) need no Cargo.toml edits
- Implemented ExitPlanMode PermissionRequest hook protocol: typed HookInput/HookOutput serde structs with camelCase renames and `#[serde(flatten)]` for unknown fields
- Established stdout discipline: `serde_json::to_writer(stdout(), &HookOutput::allow())` is the sole stdout write; all diagnostics use `eprintln!`
- Integrated comrak 0.52 with GFM extensions (table, tasklist, strikethrough, autolink); `unsafe_` NOT enabled per security constraint

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Cargo.toml with all Phase 1 dependencies** - `472b3ba` (chore)
2. **Task 2: Create hook protocol types, CLI, main entry point, and comrak render helper** - `b7877e9` (feat)

## Files Created/Modified

- `Cargo.toml` - Full dependency manifest for all Phase 1 crates; tokio with subset features; comrak with default-features=false
- `src/main.rs` - Entry point: clap Args with --no-browser flag; sync stdin read; HookInput parse; render_plan_html call; serde_json::to_writer(stdout()) sole stdout write
- `src/hook.rs` - HookInput/ToolInput/HookOutput/HookSpecificOutput/PermissionDecision serde structs; allow()/deny() constructors
- `src/render.rs` - render_plan_html() with comrak GFM options (table, tasklist, strikethrough, autolink)

## Decisions Made

- Used comrak 0.52 with `default-features = false` to exclude syntect (syntax highlighting adds significant binary size; evaluate for Phase 2)
- Used tokio feature subset (`rt`, `macros`, `net`, `time`, `sync`, `signal`) instead of `"full"` to reduce binary size
- Declared all Cargo.toml dependencies upfront across all Phase 1 plans to prevent Cargo.toml edit conflicts in parallel Wave 2 execution (Plans 02 and 03)
- Hook output `hook_event_name` hardcoded to `"PermissionRequest"` in constructors (matches verified protocol)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The plan's verification command used `echo '...\n...'` which produces literal `\n` bytes in the string (invalid JSON). Resolved by using `python3 -c "import json; print(json.dumps(...))"` to generate well-formed JSON with proper escape sequences. This is a test harness issue only — the binary itself parses all valid JSON correctly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Cargo.toml complete — Plans 02 and 03 (parallel Wave 2) can start immediately without Cargo.toml conflicts
- `HookInput`, `HookOutput`, `render_plan_html` ready for Plan 02 to import and wire into the axum server
- Plan 02 (server.rs) needs to replace the hardcoded `HookOutput::allow()` with the real decision from the oneshot channel
- No blockers
