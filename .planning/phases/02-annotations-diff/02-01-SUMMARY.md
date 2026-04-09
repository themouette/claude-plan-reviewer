---
phase: 02-annotations-diff
plan: "01"
subsystem: backend
tags: [git2, diff, api, rust]
dependency_graph:
  requires: []
  provides: [GET /api/diff, extract_diff, AppState.diff_content]
  affects: [src/main.rs, src/server.rs, Cargo.toml]
tech_stack:
  added: [git2 0.20 (vendored-libgit2), tempfile 3 (dev)]
  patterns: [TDD red-green, extract then pass pattern]
key_files:
  created: []
  modified:
    - Cargo.toml
    - src/main.rs
    - src/server.rs
decisions:
  - "git2 feature is vendored-libgit2 not vendored in 0.20.x — auto-corrected during RED phase"
  - "diff_content flows from extract_diff in main() through async_main parameter to start_server; no global state"
metrics:
  duration: "4min 26s"
  completed: "2026-04-09"
  tasks_completed: 2
  files_modified: 3
---

# Phase 02 Plan 01: Git Diff Extraction and /api/diff Route Summary

**One-liner:** Server-side git diff extraction via git2 vendored-libgit2, flowing through AppState to a new GET /api/diff JSON endpoint.

## What Was Built

- `extract_diff(cwd: &str) -> String` in `src/main.rs`: opens a git repository at the given path using `git2::Repository::open`, computes the full working-tree diff vs HEAD (staged + unstaged) via `diff_tree_to_workdir_with_index`, falls back to `diff_index_to_workdir` for repos without a HEAD commit, and serializes the patch as a unified diff string.
- `diff_content` flows from `main()` → `async_main(args, plan_html, diff_content)` → `server::start_server(plan_html, diff_content)` → `AppState.diff_content`.
- `GET /api/diff` route handler in `src/server.rs` returns `{ "diff": "..." }` JSON from `AppState.diff_content`.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Add git2 dependency and implement extract_diff function (TDD) | d770e2f | Cargo.toml, src/main.rs, src/server.rs |
| 2 | Extend AppState with diff_content and add GET /api/diff route | b1b4394 | src/server.rs |

## Verification

- `cargo test extract_diff` — 4 TDD tests pass (nonexistent path, non-git dir, dirty repo, clean repo)
- `cargo test` — all 9 tests pass (including pre-existing render tests)
- `cargo check` — 0 errors, 2 pre-existing warnings (dead code in ToolInput and diff_content — diff_content warning resolves in Plan 02 when frontend consumes it)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] git2 feature flag name corrected from `vendored` to `vendored-libgit2`**
- **Found during:** Task 1, RED phase (cargo test compile error)
- **Issue:** Plan specified `features = ["vendored"]` but the actual feature in git2 0.20.x is named `vendored-libgit2`
- **Fix:** Updated Cargo.toml to `git2 = { version = "0.20", features = ["vendored-libgit2"] }`
- **Files modified:** Cargo.toml
- **Commit:** d770e2f

**2. [Rule 3 - Blocking] AppState and start_server updated in Task 1 to unblock compilation**
- **Found during:** Task 1, GREEN phase (server::start_server called with 2 args, only accepted 1)
- **Issue:** Task 1's main.rs changes called `start_server(plan_html, diff_content)` but server.rs still had the old 1-argument signature. This blocked compilation of the test binary.
- **Fix:** Applied the AppState and start_server signature changes (planned for Task 2) in Task 1's commit to unblock. Task 2 then only needed to add the route handler and register the route.
- **Files modified:** src/server.rs
- **Commit:** d770e2f

**3. [Rule 3 - Blocking] tempfile dev-dependency added**
- **Found during:** Task 1, RED phase (tests use tempfile::tempdir() which requires the crate)
- **Issue:** Tests require `tempfile` for creating temporary directories, but it was not in Cargo.toml
- **Fix:** Added `tempfile = "3"` to `[dev-dependencies]`
- **Files modified:** Cargo.toml
- **Commit:** d770e2f

## Known Stubs

None. `extract_diff` returns real git diff output. The `/api/diff` endpoint serves live data from AppState. No placeholder values.

## Threat Flags

None. The trust boundaries in the plan's threat model were reviewed:
- T-02-01 (Tampering via cwd path): `git2::Repository::open` is read-only; no code execution from repo. Accepted.
- T-02-02 (Info disclosure via GET /api/diff): Server binds to 127.0.0.1 only (established Phase 1). Accepted.
No new unplanned trust boundaries introduced.

## Self-Check: PASSED
