---
phase: 01-hook-review-ui
plan: 04
subsystem: infra
tags: [rust, rust-embed, axum-embed, svelte, react, spa, integration]

# Dependency graph
requires:
  - 01-02 (server.rs with GET /api/plan, POST /api/decide, AppState)
  - 01-03 (React+TS+Vite frontend built to ui/dist/ with base: './')
provides:
  - Embedded React SPA served from binary via rust-embed + axum-embed
  - SPA fallback (FallbackBehavior::Ok) returns index.html for any unknown path
  - Debug-mode asset availability check: exits with helpful error if ui/dist/ missing
  - Placeholder HTML page removed — React UI is the only frontend
  - Complete Phase 1 binary: stdin -> server -> browser -> React UI -> approve/deny -> stdout
affects:
  - Phase 2+: rust-embed pattern established for future asset additions

# Tech tracking
tech-stack:
  added:
    - axum-embed 0.1 ServeEmbed with FallbackBehavior::Ok (SPA fallback pattern)
  patterns:
    - "SPA fallback: .fallback_service(spa) — API routes take priority, anything else returns index.html"
    - "pub struct Assets with RustEmbed: accessible from main.rs for debug-mode existence check"
    - "#[cfg(debug_assertions)] asset check: catches missing ui/dist/ before server starts in dev"

key-files:
  created: []
  modified:
    - src/server.rs
    - src/main.rs

key-decisions:
  - "FallbackBehavior::Ok for SPA routing: any unknown path returns index.html with HTTP 200 — correct behavior for client-side routed React app"
  - "pub struct Assets: exposing Assets to main.rs enables the #[cfg(debug_assertions)] check without coupling logic to server module"

patterns-established:
  - "Pattern: fallback_service(spa) after named API routes — API always wins, SPA catches everything else"

requirements-completed: [CONF-01]

# Metrics
duration: ~3min
completed: 2026-04-09
---

# Phase 01 Plan 04: Frontend Integration Summary

**React SPA embedded in binary via rust-embed + axum-embed: placeholder HTML removed, debug asset check added, full Phase 1 end-to-end flow verified by automation**

## Performance

- **Duration:** ~15 min (including human end-to-end verification)
- **Started:** 2026-04-09T11:54:44Z
- **Completed:** 2026-04-09T12:07:06Z
- **Tasks:** 2 of 2 completed
- **Files modified:** 2

## Accomplishments

- Replaced placeholder GET / handler in server.rs with `ServeEmbed::<Assets>` fallback service — React app now served from binary
- Added `#[derive(RustEmbed, Clone)] #[folder = "ui/dist/"] pub struct Assets` to server.rs
- Added `#[cfg(debug_assertions)]` block in main.rs: if `server::Assets::get("index.html").is_none()` exits with an actionable error message pointing the developer to `npm run build`
- Verified end-to-end: `cargo build` succeeds, GET / returns HTTP 200 (React index.html), GET /api/plan returns JSON with comrak-rendered HTML, POST /api/decide triggers allow JSON on stdout and process exit
- Human verified all 5 end-to-end tests: approve flow (Enter key), deny flow (required message validation), stderr discipline (URL + diagnostics only), `--no-browser` flag, double-submit guard (409 on second POST to /api/decide)

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrate rust-embed + axum-embed SPA serving, remove placeholder HTML** - `16ad359` (feat)
2. **Task 2: Human verification — complete end-to-end Phase 1 flow in browser** - Human-approved (no code commit)

## Files Created/Modified

- `src/server.rs` — Replaced get_index placeholder with ServeEmbed::<Assets> fallback; added RustEmbed struct; removed old HTML handler function entirely
- `src/main.rs` — Added #[cfg(debug_assertions)] asset check before server start; renumbered steps

## Decisions Made

- `pub struct Assets` (not private): allows main.rs to call `server::Assets::get()` for the debug check without duplicating the embedded struct
- `FallbackBehavior::Ok`: returns index.html with HTTP 200 for unknown paths — standard SPA routing behavior; no 404 on deep-link navigation

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

### settings.json Configuration (CONF-01)

To use claude-plan-reviewer as a Claude Code hook, add the following to `~/.claude/settings.json` (user-level) or `.claude/settings.json` (project-level):

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "ExitPlanMode",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/claude-plan-reviewer",
            "timeout": 600
          }
        ]
      }
    ]
  }
}
```

Replace `/path/to/claude-plan-reviewer` with the actual binary path (e.g. `target/debug/claude-plan-reviewer` for development).

**WARNING:** The matcher MUST be exactly `"ExitPlanMode"`. An empty matcher (`""`) fires on every permission request and would break normal Claude Code workflow.

## Next Phase Readiness

Phase 1 is fully complete and human-verified. The binary handles the complete approve/deny loop:
- Reads ExitPlanMode JSON from stdin
- Renders plan markdown to HTML via comrak
- Starts axum server on a random port
- Opens browser (or prints URL with `--no-browser`)
- Serves the React review UI from embedded assets
- Receives approve/deny decision via POST /api/decide
- Writes JSON response to stdout and exits cleanly

Phase 2 (Annotations & Diff) can begin. The `/api/plan` response shape may need to be extended to include structured annotation data, and the React UI will need annotation selection and serialization components. No blockers from Phase 1.

## Self-Check: PASSED

- `src/server.rs` exists with `#[derive(RustEmbed, Clone)]`, `#[folder = "ui/dist/"]`, `pub struct Assets`, `ServeEmbed::<Assets>::with_parameters`, `FallbackBehavior::Ok`, `.fallback_service(spa)`, no placeholder HTML
- `src/main.rs` contains `server::Assets::get("index.html")` inside `#[cfg(debug_assertions)]` block
- Commit `16ad359` present in git log
- `cargo build` succeeds (2 pre-existing dead_code warnings, 0 errors)
- GET / returns HTTP 200 (verified via curl)
- GET /api/plan returns JSON with plan_html containing HTML tags (verified via curl)
- POST /api/decide with allow triggers stdout JSON and process exit (verified via curl)

---
*Phase: 01-hook-review-ui*
*Completed: 2026-04-09*
