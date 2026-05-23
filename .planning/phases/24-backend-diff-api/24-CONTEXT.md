# Phase 24: Backend Diff API - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 24 delivers the Rust data layer for code review: three axum endpoints that expose structured git diff data, plus a module restructure that cleanly separates plan-review and code-review concerns.

- `GET /api/diff/branch` — full branch diff vs merge base (GitHub-style FileDiff[])
- `GET /api/commits` — list of commits in current branch vs base (Commit[])
- `GET /api/diff/commit/:sha` — per-commit diff, same FileDiff[] shape

Phase 24 also refactors `src/server.rs` into two modules (`src/plan_review.rs` + `src/diff_api.rs`) with a thin assembler in `src/server.rs`. This sets up the architecture Phase 25 builds its UI against.

Not in scope: CLI command wiring (Phase 29), UI rendering (Phase 25), commit navigation UI (Phase 26), inline comments (Phase 27), review submission (Phase 28).

</domain>

<decisions>
## Implementation Decisions

### JSON Response Schema (GitHub API Format)

- **D-01:** All diff endpoints return `FileDiff[]`. Each `FileDiff` uses GitHub API field names: `filename` (string), `previous_filename` (string | null — present for renames), `status` ("added" | "removed" | "modified" | "renamed" | "copied"), `additions` (u32), `deletions` (u32), `changes` (u32), `patch` (string — raw unified diff text, not pre-parsed). This is a raw patch string, not structured hunks/lines — the React frontend will use a diff rendering library (diff2html or react-diff-view) to parse and render it.
- **D-02:** `GET /api/commits` returns `Commit[]`. Each `Commit`: `sha` (full SHA string), `short_sha` (first 7 chars), `message` (full commit message), `author` (name string), `email` (string), `date` (ISO 8601 string).
- **D-03:** `GET /api/diff/commit/:sha` returns the same `FileDiff[]` shape as `/api/diff/branch`, scoped to the single named commit.

### Server Architecture — Module Separation

- **D-04:** Single server, single port. Internally separated into two axum router modules, each with its own state type and `router(state) -> Router<()>` factory. `src/server.rs` becomes a thin assembler that merges both routers and binds once to a single port.
- **D-05:** Phase 24 moves the existing `server.rs` content into `src/plan_review.rs`. The new `src/diff_api.rs` module holds `CodeReviewState { repo_path: String }` and the three new route handlers. `src/server.rs` becomes the assembler:
  ```rust
  let app = plan_review::router(plan_state)
      .merge(diff_api::router(code_review_state))
      .route("/api/ping", get(get_ping))
      .fallback_service(spa);
  ```
- **D-06:** `AppState` in `plan_review.rs` is unchanged — same fields (`plan_md`, `diff_content`, `approve_label`, `deny_label`, `decision_tx`). No coupling between `PlanReviewState` and `CodeReviewState`.

### Base Branch Detection

- **D-07:** Branch diff is computed as `merge_base(HEAD, base)..HEAD` — "what this branch added relative to where it diverged." Detection order for the base:
  1. `refs/remotes/origin/HEAD` symbolic ref (set on clone — resolves to the remote's actual default branch, handles non-main/non-master defaults)
  2. `main` (local branch)
  3. `origin/main` (remote tracking)
  4. `master` (local branch)
  5. `origin/master` (remote tracking)
  
  Uses `git2::Repository::find_reference("refs/remotes/origin/HEAD")` + `symbolic_target()` for step 1, then `repo.revparse_single(candidate)` for the fallback chain. If nothing resolves, return an empty `FileDiff[]` with an appropriate error indicator.
- **D-08:** Only `origin` is tried for the symbolic ref lookup — non-origin remotes are out of scope for v0.7.0.

### Module Organization

- **D-09:** New file `src/diff_api.rs` — contains `CodeReviewState`, `FileDiff`, `Commit` structs (serde `Deserialize`/`Serialize`), `find_base_commit()` helper, and the three axum handlers. All git2 diff logic for code review lives here.
- **D-10:** The existing `extract_diff()` in `main.rs` (working-tree vs HEAD, returns raw string) stays in `main.rs` — it serves the existing plan-review flow and is not modified.

### Claude's Discretion

- Exact serde field naming (snake_case Rust → camelCase JSON via `#[serde(rename_all = "camelCase")]` or explicit renames — pick whatever is most consistent with the existing codebase)
- Error response shape when base branch is not found (JSON `{"error": "..."}` vs HTTP 4xx with empty body)
- Whether `find_base_commit()` is a free function in `diff_api.rs` or a method on `CodeReviewState`
- Exact Rust struct field types (e.g., `Option<String>` vs `String` for `previous_filename`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and Roadmap
- `.planning/REQUIREMENTS.md` — Phase 24 covers: DIFF-01 (data layer), COMMIT-01 (data), COMMIT-02 (data)
- `.planning/ROADMAP.md` Phase 24 — Success criteria (5 items), plan breakdown (24-01, 24-02)

### Architecture Constraints
- `.planning/PROJECT.md` — Key Decisions table; Rust + axum 0.8 + git2 tech stack; single-binary constraint
- `.planning/STATE.md` — Accumulated decisions from prior milestones

### Existing Code to Understand Before Planning
- `src/server.rs` — current `AppState`, route handlers, `start_server()` — this is what Phase 24 refactors into `src/plan_review.rs`
- `src/main.rs` — `extract_diff()` (existing git2 usage, stays untouched); test fixtures using `tempfile` + `git2::Repository::init` (reuse this pattern for integration tests)
- `Cargo.toml` — `git2 = { version = "0.20", features = ["vendored-libgit2", "vendored-openssl"] }` already present; `tempfile` already in dev-dependencies

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main.rs` `extract_diff()` — shows the git2 patterns already established: `repo.head()?.peel_to_commit()?.tree()`, `repo.diff_tree_to_workdir_with_index()`, `diff.print(DiffFormat::Patch, ...)`. Phase 24's `diff_api.rs` needs `diff_tree_to_tree()` (commit-to-commit) instead, but the surrounding repo/options setup is the same.
- `src/main.rs` test fixtures — `tempfile::tempdir()` + `git2::Repository::init()` + manual commits pattern is already battle-tested. Reuse for all integration tests in Phase 24-02.
- `Cargo.toml` dev-dependencies — `tempfile`, `assert_cmd`, `predicates`, `ureq` already present; no new test deps needed.

### Established Patterns
- **git2 DiffOptions**: existing code sets `opts.old_prefix("a/").new_prefix("b/")` to force standard prefixes. Reuse for consistency.
- **axum State extraction**: `State(state): State<Arc<AppState>>` pattern in `server.rs`. New handlers in `diff_api.rs` follow the same pattern with `State<Arc<CodeReviewState>>`.
- **Tokio + axum router composition**: `Router::new().route(...).with_state(state)` then `.merge()` in assembler is the standard axum 0.8 pattern. No new dependencies needed.

### Integration Points
- `src/server.rs` (assembler) — Phase 24 replaces its current content with a merger of `plan_review::router()` + `diff_api::router()`. `main.rs` calls `server::start_server()` which remains the public entry point (signature unchanged from main.rs's perspective).
- `src/main.rs` `async_main()` — calls `server::start_server(plan_md, diff_content, ...)`. This call site must continue to compile after the refactor; `start_server()` signature is preserved.

</code_context>

<specifics>
## Specific Ideas

- The JSON schema follows the GitHub REST API format for pull request files (`GET /repos/{owner}/{repo}/pulls/{pull_number}/files`). Field names match exactly: `filename`, `previous_filename`, `status`, `additions`, `deletions`, `changes`, `patch`. This makes it easy to find compatible JS diff rendering libraries (diff2html, react-diff-view) since they document GitHub API compatibility.
- Base branch detection starts with `refs/remotes/origin/HEAD` symbolic ref resolution — this is the same mechanism as `git remote set-head origin --auto` and handles repos where the default branch is not `main` or `master`.

</specifics>

<deferred>
## Deferred Ideas

- `--base` flag for overriding the detected base branch — out of scope for v0.7.0; auto-detection is sufficient
- Walking non-origin remotes for `refs/remotes/{remote}/HEAD` — out of scope for v0.7.0

</deferred>

---

*Phase: 24-Backend Diff API*
*Context gathered: 2026-05-23*
