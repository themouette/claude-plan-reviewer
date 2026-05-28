---
phase: 260528-ugq
plan: "01"
subsystem: diff_api
tags: [reftable, shell-fallback, git2, libgit2, diff]
dependency_graph:
  requires: []
  provides: [reftable-compatible-diff-api]
  affects: [src/diff_api.rs]
tech_stack:
  added: []
  patterns: [shell-subprocess-fallback, reftable-detection]
key_files:
  created: []
  modified:
    - src/diff_api.rs
decisions:
  - "Shell fallback is gated on is_reftable_error so non-reftable failures still return None (same as before)"
  - "Empty-tree SHA 4b825dc642cb6eb9a060e54bf8d69288fbee4904 used as parent for first-commit fallback"
  - "shell_parse_unified_diff uses line-by-line state machine to avoid subprocess per file"
metrics:
  duration: "9 minutes"
  completed: "2026-05-28T20:17:00Z"
  tasks_completed: 2
  files_modified: 1
---

# Phase 260528-ugq Plan 01: Fix reftable repos showing empty diffs Summary

Shell-subprocess fallback for all five diff/commit entry points when libgit2 returns the "refstorage" error that indicates a reftable-format repository.

## What Was Built

Added 12 functions to `src/diff_api.rs` in a new `// --- Shell fallback (reftable) ---` section:

| Function | Purpose |
|---|---|
| `is_reftable_error` | Detects the libgit2 "refstorage" error |
| `shell_run` | Generic subprocess helper — runs git with cwd, captures stdout |
| `shell_find_merge_base` | Resolves merge base via `git merge-base`, same candidate order as git2 path |
| `shell_get_file_content` | Reads blob via `git show rev:path`, NUL-byte binary detection |
| `shell_parse_unified_diff` | State-machine unified diff parser → Vec<FileDiff> |
| `shell_branch_diff` | Fallback for `try_branch_diff` |
| `shell_has_uncommitted_changes` | `git diff --quiet HEAD` exit-code check |
| `shell_has_untracked_files` | `git ls-files --others --exclude-standard` check |
| `shell_list_commits` | Fallback for `try_list_commits`, preserves Uncommitted/Untracked sentinels |
| `shell_uncommitted_diff` | Fallback for `try_uncommitted_diff` |
| `shell_untracked_diff` | Fallback for `try_untracked_diff` |
| `shell_diff_commit` | Fallback for `get_diff_commit` handler |

Wired reftable detection into all 5 entry points:
- `try_branch_diff`
- `try_uncommitted_diff`
- `try_untracked_diff`
- `try_list_commits`
- `get_diff_commit` handler

## Tasks Completed

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 (RED) | Add failing tests for shell_branch_diff and shell_list_commits | ca4d00e | src/diff_api.rs |
| 2 (GREEN) | Add shell fallback functions and wire reftable detection | 3c282af | src/diff_api.rs |

## Verification Results

```
running 19 tests
test diff_api::tests::shell_branch_diff_returns_added_file ... ok
test diff_api::tests::shell_list_commits_returns_feature_commits ... ok
[all 17 existing tests] ... ok
test result: ok. 19 passed; 0 failed
```

- `cargo clippy -- -D warnings` exits 0
- `cargo fmt --check` exits 0
- Full integration suite: 30 passed; 0 failed

## Deviations from Plan

**1. [Rule 1 - Bug] Collapsible if and manual_strip clippy violations in shell_parse_unified_diff**
- **Found during:** Task 2 (clippy run)
- **Issue:** 5 clippy errors: one collapsible `if let / if` block in `shell_find_merge_base` and four `manual_strip` patterns in `shell_parse_unified_diff`
- **Fix:** Used `&&` to collapse the nested if, and replaced `line["prefix".len()..]` with `line.strip_prefix("prefix")?` pattern
- **Files modified:** src/diff_api.rs
- **Commit:** 3c282af (included in same GREEN commit)

## Known Stubs

None.

## Threat Flags

None. The new shell functions use `repo_path` which comes from CLI args (local trusted path), and all git subprocess output is treated as trusted local data — consistent with the existing git2 path and the threat register's accept dispositions (T-ugq-01, T-ugq-02, T-ugq-03).

## Self-Check: PASSED

- src/diff_api.rs: FOUND
- Commit ca4d00e (RED test): FOUND
- Commit 3c282af (GREEN implementation): FOUND
- is_reftable_error wired into 5 entry points: VERIFIED (6 occurrences = 1 def + 5 usages)
- All 19 diff_api tests pass
- cargo clippy -- -D warnings: PASSED
- cargo fmt --check: PASSED
