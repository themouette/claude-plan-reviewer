# Phase 24: Backend Diff API - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 24-backend-diff-api
**Areas discussed:** JSON response schema, Server architecture, Base branch detection

---

## JSON Response Schema

| Option | Description | Selected |
|--------|-------------|----------|
| path + hunks (structured) | Pre-parse into FileDiff → Hunk[] → Line[] on Rust side | |
| GitHub-style raw patch string | Match GitHub REST API format: `{filename, status, additions, deletions, changes, patch}` | ✓ |
| GitHub field names + parsed hunks | GitHub field names but with server-side hunk parsing | |

**User's choice:** GitHub API format — "WDYT about adopting whatever the github API does"

**Notes:** User initiated the GitHub API suggestion. Claude confirmed the tradeoff: GitHub uses raw `patch` string (not pre-parsed), which means the frontend uses a diff rendering library (diff2html, react-diff-view) rather than custom rendering. User confirmed the raw patch approach. `previous_filename` included for renames (GitHub-style). Commit shape: `{sha, short_sha, message, author, email, date}`.

---

## Server Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| New CodeReviewState + separate server | Clean separation, new entry point, existing server untouched | |
| Extend existing AppState | Add repo_path to AppState, one server struct for both flows | |
| Single port, module separation (hybrid) | Single port, each concern in its own module with own state type | ✓ |

**User's choice:** "A single server with a single port is good, but behind this, everything should be separated"

**Notes:** User described the hybrid: single port (good UX, no confusion), but internal module separation (clean architecture). Claude proposed the axum Router composition pattern — each module exposes `router(state) -> Router<()>`, server.rs merges both. User confirmed. Phase 24 also refactors existing `server.rs` into `src/plan_review.rs` to establish the clean structure before Phase 25 adds the UI.

---

## Base Branch Detection

| Option | Description | Selected |
|--------|-------------|----------|
| refs/remotes/origin/HEAD first | Symbolic ref resolution — detects remote's actual default branch | ✓ (part of) |
| Hardcoded fallback chain | main → origin/main → master → origin/master | ✓ (part of) |
| --base flag | Explicit CLI override | |
| Walk all remotes | Check each remote's HEAD symbolic ref | |

**User's choice:** `refs/remotes/origin/HEAD` first, then hardcoded fallback chain. Origin only (no multi-remote walking).

**Notes:** User suggested the symbolic ref approach ("can we try stuff like `git symbolic-ref refs/remotes/${remote:-origin}/HEAD`?"). Claude confirmed this can be done with git2's `find_reference()` + `symbolic_target()` — no shell out needed. Final detection order: `refs/remotes/origin/HEAD` → `main` → `origin/main` → `master` → `origin/master`. `--base` flag deferred.

---

## Claude's Discretion

- Exact serde field naming convention (snake_case → camelCase via attribute or explicit renames)
- Error response shape when base branch is not found
- Whether `find_base_commit()` is a free function or method on `CodeReviewState`
- Exact Rust struct field types for optional fields

## Deferred Ideas

- `--base` flag for overriding the detected base branch (mentioned, deferred to future milestone)
- Walking non-origin remotes (considered, explicitly deferred for v0.7.0)
