---
phase: 24-backend-diff-api
reviewed: 2026-05-23T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/diff_api.rs
  - src/main.rs
  - src/plan_review.rs
  - src/server.rs
findings:
  critical: 0
  warning: 5
  info: 2
  total: 7
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-05-23
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

The diff API implementation (`src/diff_api.rs`) is well-structured, correctly validates SHA inputs via `git2::Oid::from_str`, and handles the empty-tree case for root commits. `src/plan_review.rs` is a clean router with no obvious logic errors. The main issues cluster around three areas: a dead watchdog that could become a race condition, missing test coverage for `plan_review.rs` business logic (required by CLAUDE.md), a `previous_filename` omission for `Copied` file diffs, an unbounded commit walk when no base branch resolves, and a potential i32 overflow in timezone offset arithmetic on malformed git data.

The `CancellationToken` in `server.rs` is created, cloned into the spawn, then immediately dropped on the original handle — the graceful shutdown path is never reachable, making it dead infrastructure. This is benign in the current `process::exit` flow but is a trap for future maintainers.

## Warnings

### WR-01: Watchdog `process::exit` spawned before stdout write — latent race condition

**File:** `src/main.rs:757-762`
**Issue:** `async_main` spawns a 3-second watchdog that calls `process::exit(0)` and then returns the `Decision`. The caller (`run_hook_flow`, `run_opencode_flow`, `run_review_flow`) writes the hook output to stdout only _after_ `rt.block_on()` returns. In the current `current_thread` runtime the watchdog task never executes (tasks spawned inside `block_on` are abandoned when `block_on` returns and the runtime is later dropped, not awaited). However, the comment on line 757 reads _"after stdout write completes"_, which is actively misleading: the watchdog fires 3 seconds after the **decision** is made, before the stdout write. If the runtime is ever changed to `multi_thread`, the watchdog could race with the stdout write and kill the process before the hook output is flushed.

The correct pattern is to write stdout first and then spawn the watchdog, or to write stdout inside the async context before returning.

**Fix:** Move the stdout write into `async_main` (before the watchdog spawn), or remove the watchdog entirely and rely on natural process exit after `main()` returns:
```rust
// Option A: remove the watchdog and rely on natural exit
// main() returns after run_hook_flow() which writes stdout synchronously -- safe.

// Option B: if the watchdog is needed for server-task cleanup, write stdout first:
async fn async_main(...) -> () {           // returns () instead of Decision
    // ... obtain `decision` as before ...
    let output_json = build_output(&decision);
    serde_json::to_writer(std::io::stdout(), &output_json)
        .expect("failed to write hook output");
    tokio::spawn(async {
        tokio::time::sleep(Duration::from_secs(3)).await;
        std::process::exit(0);
    });
    // yield to let the watchdog task schedule
    tokio::time::sleep(Duration::from_secs(4)).await;
}
```

---

### WR-02: Unbounded commit walk when no base branch resolves

**File:** `src/diff_api.rs:231-243`
**Issue:** In `try_list_commits`, when `base_oid` is `None` (the branch has no detectable base — e.g., on `main` itself with no remote), `walk.hide()` is never called and the revwalk traverses the entire commit history of the repository from HEAD to the initial commit. The entire history is collected into a `Vec<Commit>` and serialized into a single JSON response. For repositories with thousands of commits this allocates unbounded memory and blocks the async handler until completion. The companion `GET /api/diff/branch` endpoint already returns an empty array when no base resolves (`D-07`), so the commit endpoint should be consistent.

**Fix:**
```rust
// When base_oid is None, return an empty Vec instead of walking all history.
let base_oid = find_base_commit(&repo)
    .and_then(|base_candidate| repo.merge_base(head_oid, base_candidate).ok());

// Early return: no base branch detected — consistent with D-07 for /api/diff/branch.
let base_oid = match base_oid {
    Some(oid) => oid,
    None => return Some(Vec::new()),
};

let mut walk = repo.revwalk().ok()?;
walk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME).ok()?;
walk.push_head().ok()?;
walk.hide(base_oid).ok()?;
// ... collect ...
```

---

### WR-03: `previous_filename` not populated for `Copied` file diffs

**File:** `src/diff_api.rs:121-128`
**Issue:** `previous_filename` is only set when `delta.status() == git2::Delta::Renamed`. For `Copied` files the source path is silently dropped (`previous_filename: None`). A `Copied` entry in the API response will have `status: "copied"` but no `previous_filename`, making it impossible for the frontend to show "copied from X". This is inconsistent with the `Renamed` handling immediately above it.

**Fix:**
```rust
let previous_filename = if matches!(
    delta.status(),
    git2::Delta::Renamed | git2::Delta::Copied
) {
    delta
        .old_file()
        .path()
        .map(|p| p.to_string_lossy().into_owned())
} else {
    None
};
```

---

### WR-04: Integer overflow in timezone offset conversion on malformed git data

**File:** `src/diff_api.rs:77`
**Issue:** `time_to_iso8601` computes `t.offset_minutes() * 60` using plain i32 arithmetic. `git2::Time::offset_minutes()` returns an `i32` with no documented bounds guarantee beyond what libgit2 stores. Forged or corrupt git objects can contain large offset values. In Rust debug builds, integer overflow panics; in release builds it wraps silently, producing an incorrect timezone offset. `FixedOffset::east_opt` has its own range check (returns `None` for out-of-range seconds), so the downstream `unwrap_or_else` provides a fallback — but only for valid (non-overflowing) arithmetic. The overflow happens before `east_opt` sees the value.

**Fix:** Use saturating or checked multiplication:
```rust
let offset_secs = t.offset_minutes().saturating_mul(60);
let offset = FixedOffset::east_opt(offset_secs)
    .unwrap_or_else(|| FixedOffset::east_opt(0).unwrap());
```

---

### WR-05: `plan_review.rs` `post_decide` handler has no tests — violates CLAUDE.md coverage requirement

**File:** `src/plan_review.rs:47-58`
**Issue:** `post_decide` is a route handler with non-trivial behavior: it atomically takes the oneshot sender from a `Mutex<Option<...>>`, returns `409 CONFLICT` on duplicate calls, and sends the decision that unblocks the entire process. Per CLAUDE.md, every Rust module containing business logic in `src/*.rs` MUST have at least one test task. There are no tests in `plan_review.rs` and none in `main.rs` or elsewhere in the test suite that exercise the `POST /api/decide` endpoint, the 409 idempotency behavior, or the interaction between `post_decide` and the decision channel.

**Fix:** Add an `#[cfg(test)]` block to `plan_review.rs` using the same `tower::ServiceExt::oneshot` pattern used in `diff_api.rs` tests:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Method, Request, StatusCode};
    use http_body_util::BodyExt;
    use std::sync::Arc;
    use tokio::sync::oneshot;
    use tower::ServiceExt;

    fn make_state() -> (Arc<AppState>, oneshot::Receiver<Decision>) {
        let (tx, rx) = oneshot::channel();
        let state = Arc::new(AppState {
            plan_md: "# Plan".to_string(),
            diff_content: String::new(),
            approve_label: "Approve".to_string(),
            deny_label: "Deny".to_string(),
            decision_tx: Mutex::new(Some(tx)),
        });
        (state, rx)
    }

    #[tokio::test]
    async fn post_decide_allow_returns_200_and_sends_decision() { ... }

    #[tokio::test]
    async fn post_decide_second_call_returns_409_conflict() { ... }
}
```

---

## Info

### IN-01: `CancellationToken` is dead infrastructure — graceful shutdown is never triggered

**File:** `src/server.rs:46-92`
**Issue:** A `CancellationToken` is created, cloned into the spawned server task for graceful shutdown, and then the original handle is immediately `drop`-ped on line 92. Dropping a `CancellationToken` does _not_ trigger cancellation (cancellation requires `.cancel()`). No code path ever calls `.cancel()` on any token handle. The graceful shutdown future (`token_clone.cancelled().await`) inside `axum::serve().with_graceful_shutdown(...)` will never resolve. The process relies solely on `process::exit(0)` in the watchdog (which is itself dead code in the current flow, see WR-01). The graceful shutdown chain is never exercised.

**Fix:** Either wire the token correctly (expose it from `start_server` and call `.cancel()` after the stdout write), or remove the `CancellationToken` entirely and document that `process::exit` is the intended termination mechanism:
```rust
// Option: expose the token so the caller can cancel after stdout write
pub async fn start_server(...) -> Result<(u16, oneshot::Receiver<Decision>, CancellationToken), ...> {
    // ...
    Ok((port, decision_rx, token))
}
// Caller: after writing stdout, calls token.cancel() for clean shutdown.
```

---

### IN-02: Documentation mismatch — `find_base_commit` comment says "Steps 2-5" for 4 candidates

**File:** `src/diff_api.rs:61-70`
**Issue:** The inline comment on line 60 reads `// Steps 2-5: fallback candidates` but the doc comment (lines 44-50) numbers the resolution order as only two steps (step 1: `refs/remotes/origin/HEAD`; step 2: `main, origin/main, master, origin/master`). The "2-5" numbering suggests the candidates were intended to be individual numbered steps at some point, creating a confusing mismatch between the function doc and its implementation comment.

**Fix:** Align the comment with the docstring numbering:
```rust
// Step 2: fallback candidates (D-07 order)
```

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
