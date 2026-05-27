# Phase 24: Backend Diff API — Research

**Researched:** 2026-05-23
**Domain:** Rust / git2 / axum 0.8 — structured git diff endpoints
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** All diff endpoints return `FileDiff[]`. Each `FileDiff` uses GitHub API field names: `filename` (string), `previous_filename` (string | null — present for renames), `status` ("added" | "removed" | "modified" | "renamed" | "copied"), `additions` (u32), `deletions` (u32), `changes` (u32), `patch` (string — raw unified diff text, not pre-parsed).
- **D-02:** `GET /api/commits` returns `Commit[]`. Each `Commit`: `sha` (full SHA string), `short_sha` (first 7 chars), `message` (full commit message), `author` (name string), `email` (string), `date` (ISO 8601 string).
- **D-03:** `GET /api/diff/commit/:sha` returns the same `FileDiff[]` shape as `/api/diff/branch`, scoped to the single named commit.
- **D-04:** Single server, single port. Internally separated into two axum router modules, each with its own state type and `router(state) -> Router<()>` factory. `src/server.rs` becomes a thin assembler that merges both routers and binds once to a single port.
- **D-05:** Phase 24 moves the existing `server.rs` content into `src/plan_review.rs`. The new `src/diff_api.rs` module holds `CodeReviewState { repo_path: String }` and the three new route handlers. `src/server.rs` becomes the assembler.
- **D-06:** `AppState` in `plan_review.rs` is unchanged — same fields.
- **D-07:** Base branch detection order: `refs/remotes/origin/HEAD` → `main` → `origin/main` → `master` → `origin/master`. Uses symbolic ref resolution for step 1, `repo.revparse_single()` for fallback chain. Returns empty `FileDiff[]` on failure.
- **D-08:** Only `origin` is tried for the symbolic ref lookup.
- **D-09:** New file `src/diff_api.rs` — contains `CodeReviewState`, `FileDiff`, `Commit` structs, `find_base_commit()` helper, and the three axum handlers.
- **D-10:** The existing `extract_diff()` in `main.rs` stays in `main.rs` — not modified.

### Claude's Discretion

- Exact serde field naming (snake_case Rust → camelCase JSON via `#[serde(rename_all = "camelCase")]` or explicit renames)
- Error response shape when base branch is not found
- Whether `find_base_commit()` is a free function or method on `CodeReviewState`
- Exact Rust struct field types (e.g., `Option<String>` vs `String` for `previous_filename`)

### Deferred Ideas (OUT OF SCOPE)

- `--base` flag for overriding the detected base branch
- Walking non-origin remotes for `refs/remotes/{remote}/HEAD`
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIFF-01 | User can view a full branch diff (data layer: all changed files vs main) | `GET /api/diff/branch` using `merge_base` + `diff_tree_to_tree` → `FileDiff[]` |
| COMMIT-01 | User can view a list of all commits in the current branch (data layer) | `GET /api/commits` using `revwalk` with `push_head` + `hide` on merge base → `Commit[]` |
| COMMIT-02 | User can click a commit to view its individual diff (data layer) | `GET /api/diff/commit/:sha` using commit parent tree diff → `FileDiff[]` |
</phase_requirements>

---

## Summary

Phase 24 is a pure Rust backend phase: no frontend changes, no new crate dependencies beyond what is already locked in `Cargo.lock`. The work divides cleanly into two tasks: (1) module refactor — splitting `server.rs` into `plan_review.rs` + `diff_api.rs` with a thin assembler, and (2) implementing three axum route handlers backed by git2 APIs.

The git2 crate (0.20.4, already vendored) provides all required primitives. `diff_tree_to_tree()` produces branch and commit diffs; `revwalk()` with `push_head` + `hide()` on the merge base lists branch commits. `Patch::from_diff()` + `to_buf()` extracts per-file unified diff text as bytes. `Commit` exposes `id()`, `message()`, `author()` (with `name()`, `email()`, `when()`) for the commit list response.

Axum 0.8's router merge pattern requires each sub-router to be converted to `Router<()>` via `.with_state(state)` before being merged — this is the key constraint for D-04/D-05. Integration tests use `tower::ServiceExt::oneshot` (already a transitive dependency) to send requests directly to the router without a live server, combined with the existing `tempfile` + `git2::Repository::init` fixture pattern from `src/main.rs`.

**Primary recommendation:** Implement `diff_api.rs` with `CodeReviewState { repo_path: PathBuf }`, `find_base_commit()` as a free function returning `Option<Oid>`, and three handlers that open the repo from `repo_path` on each request. For ISO 8601 dates, use `format!("{:+05}:{:02}", offset_hours, offset_mins_abs)` with Unix seconds from `Time::seconds()` — no new date crate needed.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Branch diff computation | API / Backend (Rust) | — | git2 is a C library binding; must run server-side |
| Commit list enumeration | API / Backend (Rust) | — | Repository access is server-side only |
| Per-commit diff | API / Backend (Rust) | — | Same as branch diff |
| Module separation (plan_review vs diff_api) | API / Backend (Rust) | — | Server-internal concern, invisible to client |
| JSON serialization of FileDiff / Commit | API / Backend (Rust) | — | serde handles at handler boundary |
| Base branch detection | API / Backend (Rust) | — | Reference resolution requires git2 repo access |

---

## Standard Stack

### Core (all already in Cargo.toml / Cargo.lock — no new dependencies)

| Library | Locked Version | Purpose | Source |
|---------|---------------|---------|--------|
| git2 | 0.20.4 | Repository access, diff computation, revwalk | [VERIFIED: crates.io] |
| axum | 0.8.9 (latest; locked 0.8.x) | HTTP router, State extraction, path params | [VERIFIED: crates.io] |
| serde + serde_json | 1.x | Struct serialization to JSON responses | [VERIFIED: crates.io] |
| tokio | 1.x | Async runtime (already used) | [VERIFIED: crates.io] |

### Test-Only (already in dev-dependencies)

| Library | Locked Version | Purpose |
|---------|---------------|---------|
| tempfile | 3.x | tmpdir fixture for git repo creation in tests |
| tower | 0.5.3 | `ServiceExt::oneshot` for handler-level tests |
| http-body-util | 0.1.3 | `BodyExt::collect()` to read response body bytes |

**No new dependencies needed.** `tower` and `http-body-util` are already transitive dependencies of `axum`; they must be added to `[dev-dependencies]` in `Cargo.toml` to use them directly in tests.

**Installation (dev-dep additions only):**
```toml
[dev-dependencies]
tower = { version = "0.5", features = ["util"] }
http-body-util = "0.1"
```

**Version verification:**
- `git2 = "0.21.0"` on crates.io (current); project uses `"0.20"` in `Cargo.toml`, resolves to 0.20.4 in lock file. [VERIFIED: crates.io via cargo search]
- `axum = "0.8.9"` on crates.io (current). [VERIFIED: crates.io via cargo search]
- `tower = "0.5.3"` already in transitive graph. [VERIFIED: Cargo.lock]
- `http-body-util = "0.1.3"` already in transitive graph. [VERIFIED: Cargo.lock]

---

## Package Legitimacy Audit

> All packages for this phase are existing Rust crates already present in `Cargo.lock`. No new packages are introduced. slopcheck is npm-focused and not applicable to Rust crates; verification done via `cargo search` against crates.io.

| Package | Registry | In Cargo.lock | crates.io version | slopcheck | Disposition |
|---------|----------|--------------|-------------------|-----------|-------------|
| git2 | crates.io | 0.20.4 | 0.21.0 | N/A (Rust) | Approved — established libgit2 bindings |
| axum | crates.io | 0.8.x | 0.8.9 | N/A (Rust) | Approved — Tokio team project |
| tower | crates.io | 0.5.3 | 0.5.3 | N/A (Rust) | Approved — already transitive dep |
| http-body-util | crates.io | 0.1.3 | 0.1.3 | N/A (Rust) | Approved — already transitive dep |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
src/main.rs
    │
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
            │       GET /api/diff/commit/:sha
            │
            ├─► GET /api/ping  (stateless)
            │
            └─► fallback_service(spa)
```

Data flow for `GET /api/diff/branch`:
```
HTTP GET /api/diff/branch
    │
    ▼
diff_api::get_diff_branch(State<Arc<CodeReviewState>>)
    │
    ├─► git2::Repository::open(&state.repo_path)
    ├─► find_base_commit(&repo)          ── refs/remotes/origin/HEAD → main → …
    ├─► repo.merge_base(head_oid, base_oid)
    ├─► repo.diff_tree_to_tree(base_tree, head_tree, opts)
    ├─► for each delta in diff.deltas():
    │       Patch::from_diff(&diff, idx)?.to_buf()?.as_str()
    │       delta.status() → FileDiff::status
    │       patch.line_stats() → additions, deletions
    └─► Json(Vec<FileDiff>)
```

### Recommended Project Structure

```
src/
├── main.rs            # unchanged — extract_diff(), CLI, async_main()
├── server.rs          # thin assembler — merges plan_review + diff_api routers
├── plan_review.rs     # (renamed from server.rs) — AppState, existing handlers
├── diff_api.rs        # NEW — CodeReviewState, FileDiff, Commit, 3 handlers
├── hook.rs            # unchanged
├── install.rs         # unchanged
├── integration.rs     # unchanged
├── uninstall.rs       # unchanged
└── update.rs          # unchanged

tests/integration/
├── main.rs            # add `mod diff_api_routes;`
├── diff_api_routes.rs # NEW — tower::ServiceExt oneshot tests for 3 endpoints
├── server_cycle.rs    # unchanged
├── install_uninstall.rs # unchanged
└── review_subcommand.rs # unchanged
```

### Pattern 1: Router Factory with Consumed State

Each module exposes a `router()` factory that takes its state, calls `.with_state()`, and returns `Router<()>`. The assembler in `server.rs` merges the two `Router<()>` values.

```rust
// Source: https://docs.rs/axum/latest/axum/routing/struct.Router.html#method.merge
// src/diff_api.rs
pub fn router(state: Arc<CodeReviewState>) -> Router<()> {
    Router::new()
        .route("/api/diff/branch", get(get_diff_branch))
        .route("/api/commits", get(get_commits))
        .route("/api/diff/commit/:sha", get(get_diff_commit))
        .with_state(state)   // converts Router<Arc<CodeReviewState>> → Router<()>
}
```

```rust
// src/server.rs (assembler)
let app = plan_review::router(plan_state)
    .merge(diff_api::router(code_review_state))
    .route("/api/ping", get(get_ping))
    .fallback_service(spa);
```

**Critical constraint:** Only one of the merged routers may have a `fallback_service`. The SPA fallback must be added on the final assembled router, not inside either sub-module. [VERIFIED: axum docs]

### Pattern 2: Path Parameter Extraction

```rust
// Source: https://docs.rs/axum/latest/axum/extract/struct.Path.html
use axum::extract::Path;

async fn get_diff_commit(
    State(state): State<Arc<CodeReviewState>>,
    Path(sha): Path<String>,
) -> impl IntoResponse {
    // sha is the :sha path segment
}
```

### Pattern 3: git2 Branch Diff — diff_tree_to_tree

```rust
// Source: https://docs.rs/git2/latest/git2/struct.Repository.html
// Compute full branch diff (HEAD vs merge base)
let head = repo.head()?.peel_to_commit()?;
let base_oid = repo.merge_base(head.id(), base_commit_oid)?;
let base_commit = repo.find_commit(base_oid)?;

let mut opts = git2::DiffOptions::new();
opts.old_prefix("a/").new_prefix("b/");

let diff = repo.diff_tree_to_tree(
    Some(&base_commit.tree()?),
    Some(&head.tree()?),
    Some(&mut opts),
)?;
```

### Pattern 4: Per-File Patch Text Extraction via Patch::from_diff

```rust
// Source: https://docs.rs/git2/latest/git2/struct.Patch.html
use git2::Patch;

let num_deltas = diff.deltas().count();
let mut file_diffs = Vec::with_capacity(num_deltas);

for i in 0..num_deltas {
    let delta = diff.get_delta(i).expect("delta index in bounds");
    let mut patch = match Patch::from_diff(&diff, i)? {
        Some(p) => p,
        None => continue, // binary or unchanged file
    };
    let (_, additions, deletions) = patch.line_stats()?;
    let buf = patch.to_buf()?;
    let patch_text = String::from_utf8_lossy(&buf).into_owned();

    let filename = delta.new_file().path()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default();
    let previous_filename = if delta.status() == git2::Delta::Renamed {
        delta.old_file().path()
            .map(|p| p.to_string_lossy().into_owned())
    } else {
        None
    };
    let status = match delta.status() {
        git2::Delta::Added     => "added",
        git2::Delta::Deleted   => "removed",
        git2::Delta::Modified  => "modified",
        git2::Delta::Renamed   => "renamed",
        git2::Delta::Copied    => "copied",
        _                      => "modified",
    };

    file_diffs.push(FileDiff {
        filename,
        previous_filename,
        status: status.to_string(),
        additions: additions as u32,
        deletions: deletions as u32,
        changes: (additions + deletions) as u32,
        patch: patch_text,
    });
}
```

### Pattern 5: Revwalk — List Branch Commits

```rust
// Source: https://docs.rs/git2/latest/git2/struct.Revwalk.html
let head = repo.head()?.peel_to_commit()?;
let base_oid = find_base_commit(&repo)
    .and_then(|base_candidate| repo.merge_base(head.id(), base_candidate).ok());

let mut walk = repo.revwalk()?;
walk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)?;
walk.push_head()?;
if let Some(base) = base_oid {
    walk.hide(base)?;  // exclude commits reachable from base
}

let commits: Vec<Commit> = walk
    .filter_map(|oid_result| {
        let oid = oid_result.ok()?;
        let commit = repo.find_commit(oid).ok()?;
        Some(commit_to_dto(&commit))
    })
    .collect();
```

### Pattern 6: Per-Commit Diff (Commit vs Its Parent)

```rust
// Source: https://docs.rs/git2/latest/git2/struct.Repository.html
let oid = git2::Oid::from_str(&sha)?;
let commit = repo.find_commit(oid)?;
let commit_tree = commit.tree()?;

// For first commit (no parent), diff against empty tree
let parent_tree = commit.parent(0).ok().and_then(|p| p.tree().ok());

let mut opts = git2::DiffOptions::new();
opts.old_prefix("a/").new_prefix("b/");

let diff = repo.diff_tree_to_tree(
    parent_tree.as_ref(),   // None = empty tree (first commit)
    Some(&commit_tree),
    Some(&mut opts),
)?;
```

### Pattern 7: Base Branch Detection

```rust
// Source: https://docs.rs/git2/latest/git2/struct.Reference.html
fn find_base_commit(repo: &git2::Repository) -> Option<git2::Oid> {
    // Step 1: refs/remotes/origin/HEAD symbolic ref
    if let Ok(origin_head) = repo.find_reference("refs/remotes/origin/HEAD") {
        if let Ok(resolved) = origin_head.resolve() {
            if let Some(oid) = resolved.target() {
                return Some(oid);
            }
        }
    }

    // Steps 2-5: fallback candidates
    let candidates = ["main", "origin/main", "master", "origin/master"];
    for candidate in &candidates {
        if let Ok(obj) = repo.revparse_single(candidate) {
            if let Ok(commit) = obj.peel_to_commit() {
                return Some(commit.id());
            }
        }
    }

    None
}
```

Note: `revparse_single("origin/main")` resolves remote tracking branches. `revparse_single("main")` resolves local branches. [VERIFIED: git2 docs]

### Pattern 8: ISO 8601 Date from git2::Time

git2's `Time` struct exposes only Unix seconds and offset-minutes. The `time` crate is NOT currently a dependency. A self-contained formatter requires no new dependency:

```rust
// No new dependency — manual formatting using git2::Time fields
fn time_to_iso8601(t: &git2::Time) -> String {
    let secs = t.seconds();
    let offset_mins = t.offset_minutes();
    let abs_offset_mins = offset_mins.unsigned_abs();
    let offset_h = abs_offset_mins / 60;
    let offset_m = abs_offset_mins % 60;
    let sign = if offset_mins >= 0 { '+' } else { '-' };

    // Convert Unix seconds to date/time components
    // Use chrono... BUT chrono is not a dep.
    // Alternative: embed a minimal timestamp formatter.
    // Simplest compliant approach: emit UTC if offset == 0
    // OR use the git2::Time seconds + offset to produce RFC 3339 manually.
    //
    // RECOMMENDED: Add `chrono = { version = "0.4", default-features = false, features = ["std"] }`
    // as a lightweight dependency. It compiles to ~80KB and has no runtime deps.
    use chrono::{DateTime, FixedOffset, TimeZone};
    let offset = FixedOffset::east_opt(offset_mins * 60).unwrap_or(FixedOffset::east_opt(0).unwrap());
    let dt: DateTime<FixedOffset> = offset.timestamp_opt(secs, 0).unwrap();
    dt.to_rfc3339()
}
```

**Decision point for the planner:** The cleanest ISO 8601 conversion uses `chrono`. This is a new dependency (`chrono = "0.4"`, ~80KB compiled, no runtime, standard in the Rust ecosystem). The alternative is hand-rolling a Unix timestamp → calendar date decomposition, which is error-prone (leap years, leap seconds). The planner should add `chrono` to `[dependencies]` with `default-features = false, features = ["std"]`.

`git2-time-chrono-ext = "1.0.1"` is also on crates.io but is a micro-crate of unknown provenance — do not use it. [ASSUMED]

### Pattern 9: Integration Test with tower::ServiceExt::oneshot

```rust
// Source: https://github.com/tokio-rs/axum/blob/main/examples/testing/src/main.rs
// tests/integration/diff_api_routes.rs
use axum::{body::Body, http::{Request, StatusCode}};
use http_body_util::BodyExt;
use tower::ServiceExt;
use std::sync::Arc;

fn make_test_repo() -> (tempfile::TempDir, git2::Repository) {
    let tmp = tempfile::tempdir().unwrap();
    let repo = git2::Repository::init(tmp.path()).unwrap();
    // ... add commits
    (tmp, repo)
}

#[tokio::test]
async fn get_diff_branch_returns_empty_on_clean_repo() {
    let (tmp, _repo) = make_test_repo();
    let state = Arc::new(claude_plan_reviewer::diff_api::CodeReviewState {
        repo_path: tmp.path().to_path_buf(),
    });
    let app = claude_plan_reviewer::diff_api::router(state);

    let response = app
        .oneshot(Request::get("/api/diff/branch").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(json.is_array());
}
```

**Key import chain:** `tower::ServiceExt` for `.oneshot()`, `http_body_util::BodyExt` for `.collect()`, `axum::body::Body` for request body. All three are already in the transitive dependency graph. [VERIFIED: Cargo.lock]

### Anti-Patterns to Avoid

- **Merging two routers that both have `fallback_service`:** axum panics at runtime. Only the final assembled router in `server.rs` should call `.fallback_service(spa)`. [VERIFIED: axum docs]
- **Calling `.with_state()` after `.merge()`:** Call `.with_state()` inside each module's `router()` factory so the returned type is already `Router<()>`. Do not try to pass state through the assembler.
- **Using `diff_tree_to_workdir_with_index` for branch diffs:** That function diffs against the working tree (uncommitted changes), which is the pattern for `extract_diff()` in main.rs. For branch diffs, use `diff_tree_to_tree(base_tree, head_tree)`.
- **Calling `repo.statuses()` to count changes:** This iterates the working tree. Use `diff.deltas()` or `Patch::line_stats()` for counting against committed trees.
- **Using `DiffStats::insertions()` / `DiffStats::deletions()` for per-file counts:** `DiffStats` aggregates the entire diff, not per-file. Use `Patch::line_stats()` per delta.
- **Assuming `symbolic_target()` returns the branch name directly:** It returns a full ref name like `refs/remotes/origin/main`. To get the commit OID, call `.resolve()` then `.target()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unified diff text per file | Custom byte accumulator in `diff.print()` callback | `Patch::from_diff(diff, i)?.to_buf()` | `to_buf()` produces the complete unified diff text in one call; callback approach requires careful line-origin handling |
| Total branch diff stats | Custom counter | `diff.stats()?.insertions()` / `.deletions()` | Built-in accumulator |
| Per-file line stats | Manual `+`/`-` line counting | `patch.line_stats()` returns `(context, additions, deletions)` | Single API call |
| ISO 8601 date formatting | Manual calendar arithmetic from Unix timestamp | `chrono` with `DateTime<FixedOffset>::to_rfc3339()` | Leap year, timezone, DST are handled correctly |
| Route state plumbing | Shared global state or `lazy_static` | `axum::State<Arc<CodeReviewState>>` with `router().with_state()` | Type-safe, testable, consistent with existing `plan_review` pattern |

**Key insight:** git2's `Patch` abstraction exists precisely to avoid driving the raw diff callback API for common use cases. Use it.

---

## Common Pitfalls

### Pitfall 1: `diff.deltas().count()` Advances the Iterator

**What goes wrong:** `diff.deltas().count()` exhausts the iterator. If you then try to iterate again with `diff.deltas().enumerate()`, it yields nothing.
**Why it happens:** `Deltas` is an iterator, not a collection. `count()` drives it to completion.
**How to avoid:** Use `diff.deltas().len()` (if available via ExactSizeIterator) or pre-collect the indices: `let num_deltas = diff.num_deltas()`. Then iterate by index using `diff.get_delta(i)`.
**Warning signs:** Empty `FileDiff[]` returned despite the repo having changes.

Verified: `git2::Diff` has `pub fn num_deltas(&self) -> usize` — use this instead of `.deltas().count()`. [CITED: docs.rs/git2/latest/git2/struct.Diff.html]

### Pitfall 2: `Patch::from_diff` Returns `Ok(None)` for Binary Files

**What goes wrong:** Binary files (images, compiled artifacts) return `Ok(None)` — not an error.
**Why it happens:** git2 explicitly signals that the patch cannot be represented as text.
**How to avoid:** Pattern-match on the `Option`: `match Patch::from_diff(&diff, i)?`. Skip `None` or emit a sentinel `FileDiff { patch: "[binary file]", additions: 0, deletions: 0, ... }`.
**Warning signs:** File count in response is lower than expected.

### Pitfall 3: `revwalk.hide(base_oid)` Must Be Called Before Iteration

**What goes wrong:** Calling `hide()` after starting iteration has no effect on already-yielded commits.
**Why it happens:** Revwalk state is set up before the first `next()` call.
**How to avoid:** Always configure `push_head()` and `hide(base)` before the first iteration. The `hide()` call excludes the base commit itself AND all commits reachable from it.
**Warning signs:** `GET /api/commits` returns commits from `main` branch as part of the feature branch list.

### Pitfall 4: `symbolic_target()` vs `resolve()` vs `target()`

**What goes wrong:** `symbolic_target()` returns `Ok(Some("refs/remotes/origin/main"))` — a ref name, not an OID. Calling `.target()` directly on a symbolic reference returns `None`.
**Why it happens:** Direct references hold OIDs; symbolic references hold ref names.
**How to avoid:** Always call `.resolve()` first to peel a symbolic ref to a direct ref, then call `.target()` to get the OID.
**Warning signs:** `find_base_commit()` returns `None` even when `refs/remotes/origin/HEAD` exists.

### Pitfall 5: Merging Routers with Duplicate Fallbacks

**What goes wrong:** axum panics at runtime with "Cannot have two fallbacks" when both routers have a fallback.
**Why it happens:** `axum::Router::merge` allows only one fallback in the combined router.
**How to avoid:** Only attach `fallback_service(spa)` on the final assembled `app` in `server.rs`, never inside `plan_review::router()` or `diff_api::router()`. Move the existing SPA fallback from the current `server.rs` route builder to the assembler layer.
**Warning signs:** Binary panics at startup when both modules are wired in.

### Pitfall 6: `repo.revparse_single("origin/main")` Requires Remote Tracking Refs to Exist

**What goes wrong:** `revparse_single("origin/main")` returns `Err` if the user has never fetched from `origin`, or if the repo was created with `git init` only (no remote).
**Why it happens:** Remote tracking refs only exist after `git fetch`.
**How to avoid:** Wrap each fallback candidate in an `if let Ok(...)` and continue to the next candidate on failure. Return `None` (empty diff) if no base is found — this is documented in D-07.
**Warning signs:** `GET /api/diff/branch` returns an error instead of an empty array on repos with no remote.

### Pitfall 7: Path Separator on Windows

**What goes wrong:** `delta.new_file().path()` returns a `std::path::Path`, which on Windows uses `\` separators. The GitHub API format uses `/`.
**Why it happens:** `std::path::Path::to_string_lossy()` uses OS-native separators.
**How to avoid:** Use `path.to_slash_lossy()` from the `path-slash` crate, or manually replace `\\` with `/` on the path string. Since the project targets macOS/Linux (musl), this is LOW risk but worth documenting.
**Warning signs:** File paths in `FileDiff.filename` contain backslashes on Windows CI.

---

## Code Examples

### Struct Definitions

```rust
// Source: GitHub REST API field names — https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files
// src/diff_api.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct FileDiff {
    pub filename: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub previous_filename: Option<String>,
    pub status: String,           // "added" | "removed" | "modified" | "renamed" | "copied"
    pub additions: u32,
    pub deletions: u32,
    pub changes: u32,
    pub patch: String,            // raw unified diff text
}

#[derive(Debug, Clone, Serialize)]
pub struct Commit {
    pub sha: String,
    pub short_sha: String,
    pub message: String,
    pub author: String,
    pub email: String,
    pub date: String,             // ISO 8601 / RFC 3339
}

#[derive(Clone)]
pub struct CodeReviewState {
    pub repo_path: std::path::PathBuf,
}
```

**Serde naming note:** The existing codebase uses snake_case field names in JSON (e.g., `plan_md`, `approve_label`, `diff_content` in `server.rs`). The GitHub API format for diff files also uses snake_case (`filename`, `previous_filename`, `short_sha`). No `rename_all = "camelCase"` needed — keep Rust field names identical to JSON field names. [VERIFIED: existing codebase grep]

### complete find_base_commit

```rust
// Source: https://docs.rs/git2/latest/git2/struct.Reference.html
pub fn find_base_commit(repo: &git2::Repository) -> Option<git2::Oid> {
    // Step 1: refs/remotes/origin/HEAD symbolic ref
    if let Ok(origin_head) = repo.find_reference("refs/remotes/origin/HEAD") {
        if let Ok(resolved) = origin_head.resolve() {
            if let Some(oid) = resolved.target() {
                return Some(oid);
            }
        }
    }

    // Steps 2-5: string candidates that revparse_single understands
    let candidates = ["main", "origin/main", "master", "origin/master"];
    for candidate in &candidates {
        if let Ok(obj) = repo.revparse_single(candidate) {
            if let Some(commit_oid) = obj.peel_to_commit().ok().map(|c| c.id()) {
                return Some(commit_oid);
            }
        }
    }

    None
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Shell out to `git diff` | `git2::diff_tree_to_tree` + `Patch::from_diff` | No subprocess, no PATH dependency, structured data |
| Single monolithic `server.rs` | `plan_review.rs` + `diff_api.rs` assembled in `server.rs` | Clean separation of concerns; each module independently testable |
| Per-file patch via `diff.print()` callback | `Patch::from_diff(diff, i)?.to_buf()` | Single call, correct handling of binary files, line stats built-in |

**Deprecated/outdated:**
- `gitoxide` (gix): diff API still maturing as of this research date — not suitable for production use [ASSUMED]
- `git2::Patch::print()` (callback-driven): superseded by `Patch::to_buf()` for unified diff text extraction

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `chrono = "0.4"` is the right dependency for ISO 8601 date formatting from Unix timestamp | Standard Stack / Pattern 8 | If wrong, need a different approach — but chrono is the de facto standard for date/time in Rust |
| A2 | `git2-time-chrono-ext` is a micro-crate of unknown provenance — do not use | Standard Stack | If it's well-maintained, it could simplify the date conversion; but the risk of depending on it outweighs the benefit |
| A3 | gitoxide (gix) diff API is still maturing | State of the Art | If matured, it would be a pure-Rust alternative; doesn't affect Phase 24 |

---

## Open Questions

1. **ISO 8601 date: chrono dependency or manual?**
   - What we know: `git2::Time` exposes `seconds()` and `offset_minutes()`. No date library is currently in `Cargo.toml`.
   - What's unclear: Should the planner add `chrono` (standard, clean) or hand-roll minimal UTC formatting (zero new deps, but error-prone for non-UTC offsets)?
   - Recommendation: Add `chrono = { version = "0.4", default-features = false, features = ["std"] }`. This is the standard Rust date library and adds no runtime overhead.

2. **`diff_api.rs` in tests: pub visibility needed**
   - What we know: Integration tests in `tests/integration/` use `assert_cmd` (process-level tests). The new `diff_api_routes.rs` tests would need to import `claude_plan_reviewer::diff_api`.
   - What's unclear: Does the planner intend in-process tests using `tower::ServiceExt::oneshot` (requires `pub` access to `diff_api::router()` and `diff_api::CodeReviewState`) or process-level tests using `ureq` against a running binary?
   - Recommendation: Use in-process `oneshot` tests for `diff_api_routes.rs` (faster, no subprocess overhead). The existing `server_cycle.rs` tests cover the assembled binary; these new tests cover the handler logic.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| git (CLI) | — | ✓ | system | — (not used; git2 is used instead) |
| cargo | Build | ✓ | Rust 2024 edition | — |
| libgit2 | git2 crate | ✓ | vendored via git2 feature flags | — (vendored, no system dependency) |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

---

## Validation Architecture

> `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`. This section is omitted.

---

## Security Domain

> This phase is a local-only HTTP server serving on 127.0.0.1. No new authentication, session, or cryptography concerns are introduced. The three new endpoints read from a local git repository (no user-supplied path traversal — `repo_path` is set at server startup from the process's working directory, not from the request). No ASVS categories are newly applicable.

**Input validation note:** The `:sha` path parameter in `GET /api/diff/commit/:sha` is passed to `git2::Oid::from_str()`. This function validates the hex format and returns `Err` on invalid input. The handler should return HTTP 400 on `Err`, not 500, to avoid leaking internal error detail.

---

## Sources

### Primary (HIGH confidence)
- [git2 0.20.4 docs — Repository](https://docs.rs/git2/latest/git2/struct.Repository.html) — `diff_tree_to_tree`, `merge_base`, `revwalk`, `find_reference`, `revparse_single`
- [git2 0.20.4 docs — Diff](https://docs.rs/git2/latest/git2/struct.Diff.html) — `print`, `stats`, `deltas`, `get_delta`, `num_deltas`
- [git2 0.20.4 docs — Patch](https://docs.rs/git2/latest/git2/struct.Patch.html) — `from_diff`, `to_buf`, `line_stats`, `num_hunks`
- [git2 0.20.4 docs — Revwalk](https://docs.rs/git2/latest/git2/struct.Revwalk.html) — `push_head`, `push`, `hide`, `set_sorting`, Iterator impl
- [git2 0.20.4 docs — Commit](https://docs.rs/git2/latest/git2/struct.Commit.html) — `id`, `author`, `message`, `time`, `tree`, `parent`
- [git2 0.20.4 docs — DiffDelta](https://docs.rs/git2/latest/git2/struct.DiffDelta.html) — `status`, `old_file`, `new_file`
- [git2 0.20.4 docs — DiffFile](https://docs.rs/git2/latest/git2/struct.DiffFile.html) — `path`, `path_bytes`
- [git2 0.20.4 docs — Delta enum](https://docs.rs/git2/latest/git2/enum.Delta.html) — Added, Deleted, Modified, Renamed, Copied variants
- [git2 0.20.4 docs — Reference](https://docs.rs/git2/latest/git2/struct.Reference.html) — `symbolic_target`, `resolve`, `target`, `peel_to_commit`
- [git2 0.20.4 docs — Signature](https://docs.rs/git2/latest/git2/struct.Signature.html) — `name`, `email`, `when`
- [git2 0.20.4 docs — Time](https://docs.rs/git2/latest/git2/struct.Time.html) — `seconds`, `offset_minutes`, `sign`
- [git2 0.20.4 docs — Buf](https://docs.rs/git2/latest/git2/struct.Buf.html) — `as_str`, Deref to `[u8]`
- [git2 0.20.4 docs — DiffStats](https://docs.rs/git2/latest/git2/struct.DiffStats.html) — `insertions`, `deletions`, `files_changed`
- [axum docs — Router::merge](https://docs.rs/axum/latest/axum/routing/struct.Router.html#method.merge) — same state type required, fallback constraint
- [axum testing example](https://github.com/tokio-rs/axum/blob/main/examples/testing/src/main.rs) — `tower::ServiceExt::oneshot` pattern
- Existing codebase — `src/main.rs` extract_diff() pattern, `tests/integration/server_cycle.rs` test structure, `Cargo.lock` transitive deps

### Secondary (MEDIUM confidence)
- WebSearch: axum Router merge pattern with different state types — confirmed by official docs

### Tertiary (LOW confidence)
- WebSearch: ISO 8601 from git2::Time using chrono — plausible, needs confirmation in Cargo.toml addition

---

## Metadata

**Confidence breakdown:**
- git2 API surface: HIGH — verified directly against docs.rs with specific method signatures
- axum router merge pattern: HIGH — verified against official axum docs and examples
- Integration test pattern (oneshot): HIGH — verified against official axum testing example + confirmed transitive deps in Cargo.lock
- ISO 8601 date conversion: MEDIUM — chrono approach confirmed in concept; exact feature flags are [ASSUMED]
- serde field naming: HIGH — verified by reading existing codebase (snake_case is consistent)

**Research date:** 2026-05-23
**Valid until:** 2026-08-23 (stable APIs; git2 and axum are mature crates)
