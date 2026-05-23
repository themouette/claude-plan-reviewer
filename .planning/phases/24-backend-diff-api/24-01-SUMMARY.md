---
phase: 24-backend-diff-api
plan: "01"
subsystem: backend
tags:
  - rust
  - axum
  - git2
  - refactor
  - api
dependency_graph:
  requires:
    - src/server.rs (existing — refactored in place)
    - src/main.rs (existing — module declarations added)
    - Cargo.toml (existing — chrono added)
  provides:
    - src/plan_review.rs (new — plan-review router factory)
    - src/diff_api.rs (new — diff/commit data layer endpoints)
    - src/server.rs (rewritten — thin assembler)
  affects:
    - GET /api/diff/branch (new endpoint)
    - GET /api/commits (new endpoint)
    - All existing plan-review endpoints preserved
tech_stack:
  added:
    - chrono 0.4 (ISO 8601 date formatting from git2::Time)
  patterns:
    - axum router factory pattern (sub-router returns Router<()> via .with_state)
    - git2 Patch::from_diff for per-file unified diff extraction
    - git2 revwalk with push_head + hide for branch commit listing
    - git2 diff_tree_to_tree for committed branch diffs
    - Option-chain early-return pattern for infallible handlers
key_files:
  created:
    - src/plan_review.rs
    - src/diff_api.rs
  modified:
    - src/server.rs
    - src/main.rs
    - Cargo.toml
    - Cargo.lock
decisions:
  - "Used diff.deltas().len() (ExactSizeIterator) instead of the non-existent num_deltas() method; git2 0.20.4 exposes Deltas as ExactSizeIterator, so .len() is safe and does not consume the iterator"
  - "Used let-chain syntax for collapsible_if in find_base_commit to satisfy clippy -D warnings"
  - "Used unwrap_or_default() for patch.line_stats() per clippy manual_unwrap_or_default lint"
  - "All error paths in get_diff_branch and get_commits return empty JSON arrays via Option chain + unwrap_or_default(), never leaking internal error strings (T-24-02)"
metrics:
  duration: "358s (~6 minutes)"
  completed: "2026-05-23"
  tasks_completed: 3
  files_changed: 6
---

# Phase 24 Plan 01: Backend Module Refactor + Branch Diff / Commit List Endpoints Summary

Refactored monolithic `server.rs` into focused modules (`plan_review.rs`, `diff_api.rs`, thin assembler `server.rs`) and shipped two new git2-backed API endpoints (`GET /api/diff/branch`, `GET /api/commits`) conforming to the GitHub-API-shaped JSON schema from D-01/D-02.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Move plan-review content into src/plan_review.rs as router factory | 0cc58e7 | src/plan_review.rs (new), src/main.rs |
| 2 | Create src/diff_api.rs with CodeReviewState + FileDiff/Commit types + handlers; add chrono | a7db3c1 | src/diff_api.rs (new), src/main.rs, Cargo.toml |
| 3 | Rewrite src/server.rs as thin assembler merging both routers | 9ba256c | src/server.rs, src/diff_api.rs (clippy fixes), Cargo.lock |

## Verification Results

- `cargo build` — PASS
- `cargo fmt --check` — PASS
- `cargo clippy -- -D warnings` — PASS
- `cargo test` — PASS (23 tests, 0 failures, 0 regressions)

## Module Architecture After This Plan

```
src/main.rs
    └─► server::start_server(plan_md, diff_content, ...)
            │
            ├─► plan_review::router(plan_state)   ─► Router<()>
            │       GET /api/plan
            │       GET /api/diff
            │       GET /api/config
            │       POST /api/decide
            │
            ├─► diff_api::router(code_review_state) ─► Router<()>
            │       GET /api/diff/branch
            │       GET /api/commits
            │
            ├─► GET /api/ping  (stateless)
            │
            └─► fallback_service(spa)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `git2::Diff::num_deltas()` method does not exist in git2 0.20.4**

- **Found during:** Task 3 (cargo build revealed the error)
- **Issue:** The plan specified `diff.num_deltas()` but git2 0.20.4 does not expose that method. The `Deltas` iterator implements `ExactSizeIterator`, making `diff.deltas().len()` the correct non-consuming way to get the count.
- **Fix:** Changed to `diff.deltas().len()` in `build_file_diffs()`. This satisfies Pitfall 1 (does not exhaust the iterator) while also correctly compiling.
- **Files modified:** `src/diff_api.rs`
- **Commit:** 9ba256c

**2. [Rule 1 - Bug] Clippy -D warnings in diff_api.rs (3 lint violations)**

- **Found during:** Task 3 (cargo clippy -- -D warnings)
- **Issue:** Three clippy warnings elevated to errors: (a) `doc_lazy_continuation` on multi-line doc comment, (b) two `collapsible_if` in `find_base_commit`, (c) `manual_unwrap_or_default` for `line_stats()`.
- **Fix:** Rewrote doc comment with blank lines between list items; used let-chain syntax for nested `if let` patterns; used `unwrap_or_default()` for `line_stats()`.
- **Files modified:** `src/diff_api.rs`
- **Commit:** 9ba256c

## Known Stubs

None — both endpoints return live git data from the working repository on every request.

## Threat Flags

No new threat surface introduced beyond what is documented in the plan's threat model (T-24-01 through T-24-SC). All error paths return empty arrays with no error strings in the response body (T-24-02 mitigated). `repo_path` is derived from `std::env::current_dir()` at server startup, not from any request input (T-24-03 accepted).

## Self-Check: PASSED

All created files exist on disk. All task commits are present in git log.

| Item | Status |
|------|--------|
| src/plan_review.rs | FOUND |
| src/diff_api.rs | FOUND |
| src/server.rs | FOUND (rewritten) |
| .planning/phases/24-backend-diff-api/24-01-SUMMARY.md | FOUND |
| Commit 0cc58e7 (Task 1) | FOUND |
| Commit a7db3c1 (Task 2) | FOUND |
| Commit 9ba256c (Task 3) | FOUND |
