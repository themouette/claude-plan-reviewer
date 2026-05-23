---
phase: 24-backend-diff-api
plan: "02"
subsystem: backend
tags:
  - rust
  - axum
  - git2
  - tdd
  - api
  - testing
dependency_graph:
  requires:
    - src/diff_api.rs (Plan 24-01 output — CodeReviewState, FileDiff, Commit, build_file_diffs)
    - Cargo.toml (existing — dev-deps block)
  provides:
    - src/diff_api.rs (extended — get_diff_commit handler + 7 axum oneshot tests)
    - Cargo.toml (extended — tower + http-body-util dev-deps)
  affects:
    - GET /api/diff/commit/{sha} (new endpoint)
    - All three diff-api endpoints now covered by automated tests
tech_stack:
  added:
    - tower 0.5 [dev-dep] (ServiceExt::oneshot for in-process handler tests)
    - http-body-util 0.1 [dev-dep] (BodyExt::collect for response body reading)
  patterns:
    - axum Path extractor for /:sha capture group (axum 0.8 uses {sha} syntax, not :sha)
    - git2::Oid::from_str for SHA input validation → HTTP 400 on invalid input (T-24-PT)
    - commit.parent(0).ok().and_then(|p| p.tree().ok()) for empty-tree diff on first commit
    - tower::ServiceExt::oneshot against router factory for in-process axum tests
    - tempfile + git2::Repository::init fixture pattern extended with branch setup helpers
key_files:
  created: []
  modified:
    - src/diff_api.rs
    - Cargo.toml
    - Cargo.lock
decisions:
  - "Used axum 0.8 {sha} capture syntax in route registration (not :sha which panics with 'Path segments must not start with :')"
  - "Used conditional branch creation in make_repo_with_main(): if git init already created main as HEAD, skip repo.branch() call to avoid 'cannot force update branch main as it is the current HEAD' error"
  - "Scoped git2 Tree and Commit objects in test fixtures to explicit blocks so they drop before move/return of Repository"
metrics:
  duration: "443s (~7 minutes)"
  completed: "2026-05-23"
  tasks_completed: 2
  files_changed: 3
---

# Phase 24 Plan 02: Per-Commit Diff Endpoint + Full Test Suite Summary

Added `GET /api/diff/commit/{sha}` with 400/404 error handling and 7 axum oneshot tests covering all three diff-api endpoints against in-process tmpdir git2 fixtures.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement get_diff_commit handler and register the /api/diff/commit/:sha route | d93bd35 | src/diff_api.rs |
| 2 | Add tower + http-body-util dev-deps; write #[cfg(test)] tests covering all three endpoints via oneshot | 70183f9 | src/diff_api.rs, Cargo.toml, Cargo.lock |

## Verification Results

- `cargo build` — PASS
- `cargo fmt --check` — PASS
- `cargo clippy -- -D warnings` — PASS
- `cargo test` — PASS (116 unit tests + 23 integration tests, 0 failures, 0 regressions)
- `grep -c '#[tokio::test]' src/diff_api.rs` — 7 (meets >= 7 requirement)

## Module Architecture After This Plan

```
src/diff_api.rs
    ├── FileDiff { filename, previous_filename, status, additions, deletions, changes, patch }
    ├── Commit   { sha, short_sha, message, author, email, date }
    ├── CodeReviewState { repo_path: PathBuf }
    ├── find_base_commit(repo) -> Option<Oid>
    ├── build_file_diffs(diff) -> Vec<FileDiff>
    │
    ├── GET /api/diff/branch    → get_diff_branch (Plan 24-01)
    ├── GET /api/commits        → get_commits (Plan 24-01)
    ├── GET /api/diff/commit/{sha} → get_diff_commit (Plan 24-02)
    │       ├── 400 on invalid hex SHA (T-24-PT)
    │       ├── 404 on unknown valid SHA (T-24-NF)
    │       └── 200 + FileDiff[] for valid commits (first commit diffs vs empty tree)
    │
    └── #[cfg(test)] mod tests (7 tokio::test functions)
            ├── get_diff_branch_returns_empty_array_when_no_base_resolves
            ├── get_diff_branch_returns_added_file_against_main_base
            ├── get_commits_returns_only_branch_commits
            ├── get_diff_commit_with_invalid_sha_returns_400
            ├── get_diff_commit_with_unknown_sha_returns_404
            ├── get_diff_commit_for_first_commit_diffs_against_empty_tree
            └── get_diff_commit_for_named_commit_returns_only_that_commits_changes
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] axum 0.8 requires `{sha}` capture syntax, not `:sha`**

- **Found during:** Task 2 test execution (runtime panic: "Path segments must not start with `:`")
- **Issue:** The plan specified `.route("/api/diff/commit/:sha", ...)` but axum 0.8 requires `{sha}` syntax for named capture groups. Using `:sha` causes a runtime panic at router construction.
- **Fix:** Changed route registration to `.route("/api/diff/commit/{sha}", get(get_diff_commit))`. The external-facing URL pattern (`:sha` notation used in docs and comments) remains unchanged — only the axum route string was corrected.
- **Files modified:** `src/diff_api.rs`
- **Commit:** 70183f9 (included in Task 2 commit)

**2. [Rule 1 - Bug] git2 borrow checker — Tree and Commit objects must be explicitly dropped before returning Repository**

- **Found during:** Task 2 (cargo build error E0505: "cannot move out of `repo` because it is borrowed")
- **Issue:** In test fixture helpers, `git2::Tree` and `git2::Commit` objects borrow the `Repository` they came from. When the fixture function tries to return `(TempDir, Repository)`, the compiler rejects the move because the borrows haven't ended.
- **Fix:** Wrapped tree/commit creation in explicit `{ }` blocks or called `drop()` on them before the return statement.
- **Files modified:** `src/diff_api.rs`
- **Commit:** 70183f9

**3. [Rule 1 - Bug] Branch creation fails when `main` is already the current HEAD**

- **Found during:** Task 2 test execution (panic: "cannot force update branch 'main' as it is the current HEAD")
- **Issue:** Modern `git init` creates the repository with `main` as the default branch. After `repo.commit(Some("HEAD"), ...)`, `refs/heads/main` already exists and IS HEAD. Calling `repo.branch("main", &commit, true)` then fails because git refuses to force-update the current HEAD branch via this API.
- **Fix:** Added a conditional check: if `repo.head()` already resolves to `main`, skip the `repo.branch(...)` call entirely. Only create the branch explicitly when git defaulted to a different name (e.g., `master`).
- **Files modified:** `src/diff_api.rs`
- **Commit:** 70183f9

## Known Stubs

None — all three endpoints return live git data from the configured `repo_path` on every request.

## Threat Flags

No new threat surface introduced beyond what is documented in the plan's threat model. T-24-PT (invalid SHA path traversal) is mitigated by `git2::Oid::from_str` → HTTP 400 (verified by test 4). T-24-NF (unknown SHA info disclosure) is mitigated by static 404 with no error string forwarding (verified by test 5).

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/diff_api.rs | FOUND |
| Cargo.toml | FOUND |
| .planning/phases/24-backend-diff-api/24-02-SUMMARY.md | FOUND |
| Commit d93bd35 (Task 1) | FOUND |
| Commit 70183f9 (Task 2) | FOUND |
