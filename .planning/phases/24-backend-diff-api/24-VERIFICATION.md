---
phase: 24-backend-diff-api
verified: 2026-05-23T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: null
human_verification:
  - test: "Confirm that GET /api/diff/branch returns the patch field with genuine unified-diff content (@@-hunk headers, +/- line markers, context lines) for a real repository with changed files"
    expected: "Each FileDiff entry's 'patch' field contains a non-empty unified diff string with @@ hunk markers and +/- prefixed lines, not just an empty string"
    why_human: "The implementation calls git2::Patch::to_buf() which produces unified-diff output, but the automated tests only assert additions/deletions counts and filename/status fields. No test asserts the patch text format or non-emptiness for non-binary files. ROADMAP SC#1 explicitly requires 'hunks and line-level added/removed/context markers'."
  - test: "Confirm GET /api/commits returns an empty array (not the full history) when the current branch IS main or has no detectable base — i.e., when find_base_commit returns None"
    expected: "Response body is '[]' — an empty JSON array — not the entire commit history of the repository"
    why_human: "The REVIEW.md WR-02 finding identifies that try_list_commits walks ALL commits when base_oid is None (no base branch resolved). This is inconsistent with get_diff_branch which returns empty array via try_branch_diff's early return chain. The unbounded walk is a correctness gap but the fix (early return on None) is trivial. A human must validate which behavior is desired and whether the current behavior is acceptable or must be fixed before Phase 25."
---

# Phase 24: Backend Diff API Verification Report

**Phase Goal:** Deliver the backend data layer for code review — three git-backed endpoints (/api/diff/branch, /api/commits, /api/diff/commit/:sha) that expose GitHub-API-shaped JSON consumed by the Phase 25 React diff viewer. Refactor server.rs into focused modules.
**Verified:** 2026-05-23
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Binary builds with `cargo build` after the module refactor; existing plan-review behavior is unchanged | ✓ VERIFIED | `cargo build` exits 0; `cargo test` passes all 23 integration tests including `server_cycle` tests that exercise existing plan-review routes |
| 2 | GET /api/diff/branch on a git repo returns a JSON array (FileDiff[]) with snake_case fields filename, status, additions, deletions, changes, patch (and previous_filename only on renames) | ✓ VERIFIED | `src/diff_api.rs` lines 15–24 define FileDiff with all 7 fields; `#[serde(skip_serializing_if = "Option::is_none")]` on previous_filename (line 17); test #2 (`get_diff_branch_returns_added_file_against_main_base`) asserts filename, status, additions, deletions, and absence of previous_filename against a live tmpdir repo |
| 3 | GET /api/commits on a git repo returns a JSON array (Commit[]) with snake_case fields sha, short_sha, message, author, email, date | ✓ VERIFIED | `src/diff_api.rs` lines 26–34 define Commit with all 6 fields; test #3 (`get_commits_returns_only_branch_commits`) asserts sha (40 chars), short_sha (7 chars), non-empty date, and message content against a live tmpdir repo |
| 4 | GET /api/diff/commit/:sha on a known commit returns FileDiff[]; 400 on invalid SHA; 404 on unknown SHA; first-commit diffs against empty tree | ✓ VERIFIED | Handler at lines 252–326 implements Oid::from_str→400, find_commit→404, parent(0).ok()→empty-tree fallback; tests #4–7 assert all four behaviors via tower::ServiceExt::oneshot |
| 5 | All four existing plan-review routes and SPA fallback continue to serve correctly; cargo fmt and clippy are clean | ✓ VERIFIED | `plan_review.rs` router registers /api/plan, /api/diff, /api/config, /api/decide; `server.rs` merges both sub-routers then attaches /api/ping and fallback_service(spa); `cargo fmt --check` and `cargo clippy -- -D warnings` both exit 0 |

**Score:** 5/5 truths verified

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/plan_review.rs` | AppState, Decision, plan-review handlers, `pub fn router(state) -> Router<()>` | ✓ VERIFIED | File exists (73 lines); contains `pub struct AppState`, `pub struct Decision`, handlers `get_plan`, `get_diff`, `get_config`, `post_decide`, and `pub fn router(...) -> Router<()>` with `.with_state(state)`; no `fallback_service`, `RustEmbed`, or `start_server` |
| `src/diff_api.rs` | CodeReviewState, FileDiff, Commit, find_base_commit, get_diff_branch, get_commits, get_diff_commit, `pub fn router(state) -> Router<()>` | ✓ VERIFIED | File exists (663 lines); all required types and functions present; 7 `#[tokio::test]` functions in `#[cfg(test)] mod tests` block |
| `src/server.rs` | Thin assembler: Assets RustEmbed, get_ping, start_server merging both routers with SPA fallback | ✓ VERIFIED | File exists (95 lines); contains `pub use crate::plan_review::{AppState, Decision}`, `pub struct Assets` with `#[folder = "ui/dist/"]`, `/api/ping` route, and assembly via `.merge()` + `.fallback_service(spa)` |
| `Cargo.toml` | chrono dependency added under [dependencies] | ✓ VERIFIED | Line 26: `chrono = { version = "0.4", default-features = false, features = ["std"] }` |
| `Cargo.toml` | tower and http-body-util added under [dev-dependencies] | ✓ VERIFIED | Lines 33–34: `tower = { version = "0.5", features = ["util"] }` and `http-body-util = "0.1"` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/main.rs` | `src/server.rs` | `use server::Decision` and `server::start_server` | ✓ WIRED | `main.rs` line 299 imports `use server::Decision`; line 710 calls `server::start_server(...)`. Re-export at `server.rs:14` bridges to `plan_review::Decision` |
| `src/server.rs` | `src/plan_review.rs` + `src/diff_api.rs` | `plan_review::router(...).merge(diff_api::router(...))` | ✓ WIRED | `server.rs` lines 73–76: `plan_review::router(plan_state).merge(diff_api::router(code_review_state)).route("/api/ping", ...)..fallback_service(spa)` |
| `src/diff_api.rs` router | GET /api/diff/branch + GET /api/commits + GET /api/diff/commit/{sha} | axum Router::route with State<Arc<CodeReviewState>> | ✓ WIRED | Lines 334–337: `.route("/api/diff/branch", get(get_diff_branch))`, `.route("/api/commits", get(get_commits))`, `.route("/api/diff/commit/{sha}", get(get_diff_commit))` |
| `src/diff_api.rs` test block | diff_api::router via tower::ServiceExt::oneshot | tower + http-body-util dev-deps | ✓ WIRED | Lines 343–347 import `tower::ServiceExt` and `http_body_util::BodyExt`; `do_get` helper at lines 453–463 calls `app.oneshot(...)` |

**Note on route syntax:** The PLAN and ROADMAP specify `/api/diff/commit/:sha` using URL-pattern notation. The actual axum 0.8 route string is `/api/diff/commit/{sha}` (axum 0.8 requires `{name}` syntax; `:name` causes a runtime panic). The external URL path is functionally equivalent. This is a documented deviation in 24-02-SUMMARY.md and does not constitute a failure.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `get_diff_branch` handler | `file_diffs: Vec<FileDiff>` | `try_branch_diff` → `git2::Repository::open` → `repo.diff_tree_to_tree` → `build_file_diffs` | Yes — libgit2 reads actual repository tree objects | ✓ FLOWING |
| `get_commits` handler | `commits: Vec<Commit>` | `try_list_commits` → `git2::Repository::open` → `repo.revwalk()` + `commit_to_dto` | Yes — libgit2 walks real commit graph | ✓ FLOWING (with caveat: unbounded walk when no base resolves — see WR-02 in REVIEW.md) |
| `get_diff_commit` handler | `file_diffs: Vec<FileDiff>` | `git2::Oid::from_str` + `repo.find_commit` + `repo.diff_tree_to_tree` → `build_file_diffs` | Yes — libgit2 reads actual commit and parent tree | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| cargo build | `cargo build` | `Finished dev profile` (exit 0) | ✓ PASS |
| cargo fmt --check | `cargo fmt --check` | exit 0, no output | ✓ PASS |
| cargo clippy -D warnings | `cargo clippy -- -D warnings` | `Finished dev profile` (exit 0) | ✓ PASS |
| cargo test — all 7 diff_api tests + 23 integration tests | `cargo test` | `test result: ok. 116 passed; 0 failed` (unit) + `test result: ok. 23 passed; 0 failed` (integration) | ✓ PASS |
| diff_api test count | `grep -c '#\[tokio::test\]' src/diff_api.rs` | 7 | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no probe files found under `scripts/*/tests/probe-*.sh` and neither PLAN nor SUMMARY declares probe paths.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DIFF-01 (data layer) | 24-01, 24-02 | User can view a full branch diff (all changed files combined, vs main) — data layer portion | ✓ SATISFIED (partial — data layer only) | `GET /api/diff/branch` returns `FileDiff[]` with filename, status, additions, deletions, changes, patch via `try_branch_diff` + libgit2; display layer deferred to Phase 25 |
| COMMIT-01 (data) | 24-01, 24-02 | User can view a list of all commits in the current branch — data layer portion | ✓ SATISFIED (partial — data layer only) | `GET /api/commits` returns `Commit[]` with sha, short_sha, message, author, email, date via `try_list_commits` + libgit2; display layer deferred to Phase 26 |
| COMMIT-02 (data) | 24-02 | User can click a commit to view its individual diff — data layer portion | ✓ SATISFIED (partial — data layer only) | `GET /api/diff/commit/{sha}` returns `FileDiff[]` for valid SHAs; 400 for invalid; 404 for unknown; first-commit diffs against empty tree; display layer deferred to Phase 26 |

**Orphaned requirements check:** REQUIREMENTS.md maps DIFF-01 to Phase 24+25, COMMIT-01 to Phase 24+26, COMMIT-02 to Phase 24+26. All three are claimed by at least one plan in this phase. No orphaned requirements.

**Scope note:** DIFF-01, COMMIT-01, and COMMIT-02 are split across phases per the traceability table. Phase 24 is responsible for the data layer only; display/interaction layers land in Phases 25 and 26. This partial coverage is by design and is not a gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/diff_api.rs` | 60 | Doc comment says "Steps 2-5" but only 4 candidates exist; doc header says 2 steps | ℹ️ Info | Documentation mismatch only; no functional impact (confirmed by REVIEW.md IN-02) |
| `src/diff_api.rs` | 216–243 | `try_list_commits` walks ALL commits when `base_oid` is None — unbounded | ⚠️ Warning | When no base branch resolves, the full repository history is loaded into memory. `get_diff_branch` returns empty array in the same condition. Inconsistency; may be acceptable for the local single-user model but requires human decision |
| `src/diff_api.rs` | 121–128 | `previous_filename` not set for `Copied` deltas — only `Renamed` | ⚠️ Warning | `status: "copied"` entries have no `previous_filename`; frontend cannot show "copied from X". REVIEW.md WR-03. |
| `src/diff_api.rs` | 77 | `t.offset_minutes() * 60` uses plain i32 arithmetic | ⚠️ Warning | Overflow possible on malformed git data in release builds (wraps silently). REVIEW.md WR-04. Low practical risk for local tool. |
| `src/server.rs` | 92 | `CancellationToken` dropped immediately; graceful shutdown never triggers | ℹ️ Info | Dead infrastructure; `process::exit` is the actual termination path. Pre-existing pattern, not introduced by Phase 24. REVIEW.md IN-01. |
| `src/plan_review.rs` | 47–58 | `post_decide` business logic (409 idempotency, channel send) has no tests | ⚠️ Warning | CLAUDE.md requires at least one test task for every Rust module with business logic. REVIEW.md WR-05. |

**Debt marker gate:** No `TBD`, `FIXME`, or `XXX` markers found in any of the phase-modified files (`src/diff_api.rs`, `src/plan_review.rs`, `src/server.rs`, `src/main.rs`). Gate passes.

### Human Verification Required

#### 1. Patch Field Contains Genuine Unified Diff Content (ROADMAP SC#1)

**Test:** Run the binary against a real git repository (`cargo run -- review README.md`), capture the port, then `curl -s http://127.0.0.1:{port}/api/diff/branch | jq '.[0].patch'`.
**Expected:** The `patch` field contains a non-empty string with `@@` hunk markers and `+`/`-` prefixed lines, confirming the ROADMAP SC#1 claim of "hunks and line-level added/removed/context markers".
**Why human:** The automated tests only assert `additions` and `deletions` counts plus `filename`/`status`. No test asserts the `patch` field is non-empty or contains hunk-format text. The implementation (`git2::Patch::to_buf()`) is known to produce unified-diff output, but this must be confirmed end-to-end in a real repo context.

#### 2. GET /api/commits Behavior When No Base Branch Resolves

**Test:** On a branch with no `main`/`master`/`origin/main` reference, `curl -s http://127.0.0.1:{port}/api/commits` and check whether it returns `[]` or the full history.
**Expected:** Returns `[]` (empty array), consistent with GET /api/diff/branch behavior in the same situation.
**Why human:** REVIEW.md WR-02 identifies that `try_list_commits` walks all commits when `base_oid` is None, while `try_branch_diff` returns None early (empty array). The current behavior may expose full history for the Phase 25 UI in edge cases. A human must decide: (a) accept this inconsistency for now, (b) fix before Phase 25 proceeds, or (c) add an override if the behavior is intentional.

### Gaps Summary

No automated-check blockers found. All 5 observable truths are verified. All required artifacts exist and are substantively implemented and wired. All three endpoints serve live git data. The test suite (7 tokio tests + 23 integration tests) passes with zero failures.

Two items require human decision before the phase can be marked fully passed:
1. Patch content quality — the ROADMAP SC#1 claim of "hunks and line-level markers" needs manual confirmation via the live binary.
2. `/api/commits` behavior on unresolvable base — the unbounded-walk inconsistency (REVIEW.md WR-02) needs a human accept/fix decision.

Three warnings flagged by the code review (WR-03 `previous_filename` for Copied, WR-04 i32 overflow, WR-05 `post_decide` missing tests) do not block the phase goal but should be tracked for follow-up.

---

_Verified: 2026-05-23T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
