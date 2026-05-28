---
phase: 260528-ugq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/diff_api.rs
autonomous: true
requirements:
  - fix-reftable-empty-diffs

must_haves:
  truths:
    - "plan-reviewer code-review on a reftable repo shows actual file diffs, not an empty list"
    - "plan-reviewer code-review on a reftable repo shows actual commits, not an empty list"
    - "per-commit diffs work on reftable repos via get_diff_commit"
    - "existing git2-backed paths are unaffected"
  artifacts:
    - path: "src/diff_api.rs"
      provides: "shell fallback functions + reftable detection + modified try_* functions"
      contains: "is_reftable_error"
  key_links:
    - from: "try_branch_diff"
      to: "shell_branch_diff"
      via: "is_reftable_error(&e) on Repository::open() failure"
    - from: "try_list_commits"
      to: "shell_list_commits"
      via: "is_reftable_error(&e) on Repository::open() failure"
    - from: "get_diff_commit handler"
      to: "shell_diff_commit"
      via: "is_reftable_error(&e) on Repository::open() failure"
---

<objective>
Fix reftable repos showing empty diffs in plan-reviewer code-review.

Purpose: git2 (libgit2 1.9.x) cannot open repos using git's reftable ref storage format, returning "unsupported extension name extensions.refstorage". All try_* functions silently return None, yielding empty diffs and commit lists. Adding a subprocess fallback for the reftable case makes the tool usable on any modern repo.

Output: Modified src/diff_api.rs with 11 new shell-fallback functions, reftable detection wired into the 5 entry points, and 2 new unit tests.
</objective>

<execution_context>
@/Users/julien.muetton/Projects/lab/claude-plan-reviewer/.claude/get-shit-done/workflows/execute-plan.md
@/Users/julien.muetton/Projects/lab/claude-plan-reviewer/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/julien.muetton/Projects/lab/claude-plan-reviewer/.planning/STATE.md
@/Users/julien.muetton/Projects/lab/claude-plan-reviewer/CLAUDE.md

<interfaces>
<!-- Key types already present in src/diff_api.rs — no new types needed. -->

From src/diff_api.rs (existing):
```rust
pub struct FileDiff {
    pub filename: String,
    pub previous_filename: Option<String>,
    pub status: String,       // "added" | "removed" | "modified" | "renamed" | "copied"
    pub additions: u32,
    pub deletions: u32,
    pub changes: u32,
    pub patch: String,
    pub old_content: Option<String>,
    pub new_content: Option<String>,
}

pub struct Commit {
    pub sha: String,
    pub short_sha: String,
    pub message: String,
    pub author: String,
    pub email: String,
    pub date: String,         // ISO 8601 / RFC 3339
    pub branches: Vec<String>,
    pub tags: Vec<String>,
}

pub struct CommitList {
    pub commits: Vec<Commit>,
    pub truncated: bool,
}

const UNCOMMITTED_SHA: &str = "0000000000000000000000000000000000000000";
const UNTRACKED_SHA: &str = "0000000000000000000000000000000000000001";
const COMMIT_LIMIT: usize = 500;
```

Entry points to modify (existing, in src/diff_api.rs):
```rust
fn try_branch_diff(repo_path: &Path, context_lines: u32, base_branch: Option<&str>) -> Option<Vec<FileDiff>>
fn try_list_commits(repo_path: &Path, base_branch: Option<&str>) -> Option<CommitList>
fn try_uncommitted_diff(repo_path: &Path, context_lines: u32) -> Option<Vec<FileDiff>>
fn try_untracked_diff(repo_path: &Path) -> Option<Vec<FileDiff>>
// get_diff_commit handler at ~line 548 calls git2::Repository::open(&state.repo_path) directly
```

Test fixture (existing, for reuse):
```rust
fn make_repo_with_main_and_feature(extra_files: &[(&str, &str)]) -> (TempDir, Repository, Vec<Oid>)
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add shell fallback functions for reftable repos</name>
  <files>src/diff_api.rs</files>
  <behavior>
    - is_reftable_error returns true when error message contains "refstorage", false otherwise
    - shell_find_merge_base tries base_override first (via `git merge-base HEAD <override>`), then falls through origin/HEAD, origin/main, main, origin/master, master; returns the first successful SHA string
    - shell_get_file_content runs `git show rev:path` in repo_path; returns None when output contains NUL byte (binary detection)
    - shell_branch_diff returns FileDiff vec equivalent to the git2 path for a plain repo
    - shell_list_commits returns CommitList with correct commit count and fields for a plain repo
    - shell_has_uncommitted_changes returns true when `git diff --quiet HEAD` exits non-zero
    - shell_has_untracked_files returns true when `git ls-files --others --exclude-standard` has non-empty output
    - shell_uncommitted_diff returns None when no uncommitted changes exist in a clean repo
    - shell_untracked_diff lists untracked files without using git2
    - shell_diff_commit uses 4b825dc642cb6eb9a060e54bf8d69288fbee4904 as parent for the first commit (no parent)
    - shell_parse_unified_diff correctly parses status: "new file mode" → added, "deleted file mode" → removed, "rename from/to" → renamed, "Binary files" → binary (old_content/new_content None)
  </behavior>
  <action>
Add the following 11 functions to src/diff_api.rs, placed in a new `// --- Shell fallback (reftable) ---` section immediately before the `// --- Handlers ---` comment.

1. `fn is_reftable_error(e: &git2::Error) -> bool`
   Returns `e.message().contains("refstorage")`.

2. `fn shell_run(args: &[&str], cwd: &std::path::Path) -> Option<String>`
   Private helper. Runs `std::process::Command::new(args[0])` with args[1..], cwd set via `.current_dir(cwd)`, captures stdout. Returns `Some(stdout_string)` only when exit status is success. Returns None on failure. Trim trailing newlines from output before returning.

3. `fn shell_find_merge_base(repo_path: &std::path::Path, base_override: Option<&str>) -> Option<String>`
   Candidates: base_override (if Some), then "origin/HEAD", "origin/main", "main", "origin/master", "master".
   For each candidate, call `shell_run(&["git", "merge-base", "HEAD", candidate], repo_path)`.
   Return the first non-None result (trimmed). Return None if all fail.

4. `fn shell_get_file_content(repo_path: &std::path::Path, rev: &str, path: &str) -> Option<String>`
   Run `git show {rev}:{path}` via shell_run. If shell_run returns None, return None.
   Check raw bytes: run `std::process::Command` directly to get raw stdout bytes; if bytes contain `0u8` return None (binary). Otherwise convert to String.
   Implementation note: shell_run already returns String; for binary detection, re-run with raw output capture or check the returned string for the replacement character. Simpler: capture raw bytes directly in this function without going through shell_run.

5. `fn shell_parse_unified_diff(diff_text: &str, repo_path: &std::path::Path, base_sha: &str) -> Vec<FileDiff>`
   State machine over lines of diff_text split by "\n".
   - New file block starts on a line beginning with "diff --git ".
   - old_path set from "--- a/" prefix line (strip "--- a/" prefix). For new files, "--- /dev/null" → old_path = "".
   - new_path set from "+++ b/" prefix line (strip "+++ b/" prefix). For deleted files, "+++ /dev/null" → new_path = "".
   - status: default "modified"; override to "added" on "new file mode", "removed" on "deleted file mode", "renamed" on "rename from", "copied" on "copy from". Binary detected from lines starting with "Binary files" or "GIT binary patch".
   - previous_filename: set from "rename from <path>" line when status is renamed; set from "copy from <path>" line when status is copied.
   - in_hunk becomes true after the first line starting with "@@ "; count '+' lines as additions, '-' lines as deletions (skip "+++" and "---" header lines).
   - patch accumulates all raw lines for the current file block.
   - old_content: call shell_get_file_content(repo_path, base_sha, old_path) when old_path is non-empty; Some("") for added files (old_path empty); None for binary.
   - new_content: call shell_get_file_content(repo_path, "HEAD", new_path) when new_path is non-empty; Some("") for removed files (new_path empty); None for binary.
   - On "diff --git" line that is NOT the first: flush the previous FileDiff (if patch is non-empty).
   - After the loop: flush the last FileDiff.
   - Binary files get additions=0, deletions=0, old_content=None, new_content=None.

6. `fn shell_branch_diff(repo_path: &std::path::Path, context_lines: u32, base_branch: Option<&str>) -> Option<Vec<FileDiff>>`
   - Call shell_find_merge_base(repo_path, base_branch)?
   - Run `git diff --unified={context_lines} {merge_base}..HEAD` via shell_run
   - Call shell_parse_unified_diff(&diff_text, repo_path, &merge_base)
   - Return Some(result)

7. `fn shell_has_uncommitted_changes(repo_path: &std::path::Path) -> bool`
   Run `git diff --quiet HEAD` via std::process::Command::new("git"). Return true when exit status is NOT success (exit code 1 = changes exist).

8. `fn shell_has_untracked_files(repo_path: &std::path::Path) -> bool`
   Call shell_run(&["git", "ls-files", "--others", "--exclude-standard"], repo_path).
   Return true when the result is Some(s) and !s.trim().is_empty().

9. `fn shell_list_commits(repo_path: &std::path::Path, base_branch: Option<&str>) -> Option<CommitList>`
   - Compute merge_base via shell_find_merge_base(repo_path, base_branch)?
   - Run `git log --format=%H%x00%aN%x00%aE%x00%aI%x00%s%x1e {merge_base}..HEAD` via shell_run
   - Split raw output on '\x1e' (record separator). Each non-empty record: split on '\x00' into [sha, author, email, date, message]. Build Commit { sha, short_sha: sha[..7], message, author, email, date, branches: vec![], tags: vec![] }.
   - Collect up to COMMIT_LIMIT + 1; set truncated = len > COMMIT_LIMIT; truncate to COMMIT_LIMIT.
   - Prepend synthetic Uncommitted entry (sha=UNCOMMITTED_SHA, short_sha="--", message="Uncommitted changes", ...) when shell_has_uncommitted_changes(repo_path).
   - Prepend synthetic Untracked entry (sha=UNTRACKED_SHA, short_sha="--", message="Untracked files", ...) after Uncommitted when shell_has_untracked_files(repo_path).
   - Return Some(CommitList { commits, truncated }).

10. `fn shell_uncommitted_diff(repo_path: &std::path::Path, context_lines: u32) -> Option<Vec<FileDiff>>`
    - Run `git diff --unified={context_lines} HEAD` via shell_run. If empty output, return Some(vec![]).
    - Get HEAD sha via shell_run(&["git", "rev-parse", "HEAD"], repo_path)?
    - Call shell_parse_unified_diff(&diff_text, repo_path, &head_sha).
    - Return Some(result).

11. `fn shell_untracked_diff(repo_path: &std::path::Path) -> Option<Vec<FileDiff>>`
    - Call shell_run(&["git", "ls-files", "--others", "--exclude-standard"], repo_path)?
    - For each non-empty line (path), read file bytes from repo_path.join(path).
    - If bytes contain 0u8: push binary FileDiff (additions=0, deletions=0, patch="[binary file]", old_content=None, new_content=None).
    - Otherwise: split by lines, build patch as "--- /dev/null\n+++ b/{path}\n@@ -0,0 +1,{n} @@\n" + "+{line}\n" per line, push FileDiff { status="added", additions=n, deletions=0, changes=n, old_content=Some(""), new_content=Some(content) }.
    - Return Some(file_diffs).

12. `fn shell_diff_commit(repo_path: &std::path::Path, sha: &str, context_lines: u32) -> Option<Vec<FileDiff>>`
    - Get parent sha: run `git rev-parse {sha}^` via shell_run. If it fails (first commit), use "4b825dc642cb6eb9a060e54bf8d69288fbee4904" as parent (empty tree SHA).
    - Run `git diff --unified={context_lines} {parent} {sha}` via shell_run?
    - Call shell_parse_unified_diff(&diff_text, repo_path, &parent_sha).
    - Return Some(result).
  </action>
  <verify>
    <automated>cd /Users/julien.muetton/Projects/lab/claude-plan-reviewer && cargo test -p plan-reviewer -- diff_api 2>&1 | tail -30</automated>
  </verify>
  <done>All existing diff_api tests pass. New shell_* functions compile without warnings (cargo clippy -D warnings passes).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire reftable fallback into all 5 entry points and add tests</name>
  <files>src/diff_api.rs</files>
  <behavior>
    - try_branch_diff falls back to shell_branch_diff when Repository::open fails with reftable error
    - try_list_commits falls back to shell_list_commits when Repository::open fails with reftable error
    - try_uncommitted_diff falls back to shell_uncommitted_diff when Repository::open fails with reftable error
    - try_untracked_diff falls back to shell_untracked_diff when Repository::open fails with reftable error
    - get_diff_commit handler falls back to shell_diff_commit when Repository::open fails with reftable error
    - Other Repository::open errors continue to propagate as before (no fallback)
    - shell_branch_diff_returns_added_file test passes: directly calling shell_branch_diff on a make_repo_with_main_and_feature fixture returns the same single-file result as the git2 path
    - shell_list_commits_returns_feature_commits test passes: directly calling shell_list_commits on a make_repo_with_main_and_feature fixture returns commits with correct count and message field
  </behavior>
  <action>
Modify the 5 existing entry points in src/diff_api.rs to wire the reftable fallback, then add 2 tests.

**try_branch_diff** (currently line ~330):
Replace:
```
let repo = git2::Repository::open(repo_path).ok()?;
```
With:
```
let repo = match git2::Repository::open(repo_path) {
    Ok(r) => r,
    Err(e) if is_reftable_error(&e) => {
        return shell_branch_diff(repo_path, context_lines, base_branch);
    }
    Err(_) => return None,
};
```

**try_uncommitted_diff** (currently line ~370):
Replace:
```
let repo = git2::Repository::open(repo_path).ok()?;
```
With:
```
let repo = match git2::Repository::open(repo_path) {
    Ok(r) => r,
    Err(e) if is_reftable_error(&e) => {
        return shell_uncommitted_diff(repo_path, context_lines);
    }
    Err(_) => return None,
};
```

**try_untracked_diff** (currently line ~392):
Replace:
```
let repo = git2::Repository::open(repo_path).ok()?;
```
With:
```
let repo = match git2::Repository::open(repo_path) {
    Ok(r) => r,
    Err(e) if is_reftable_error(&e) => {
        return shell_untracked_diff(repo_path);
    }
    Err(_) => return None,
};
```

**try_list_commits** (currently line ~464):
Replace:
```
let repo = git2::Repository::open(repo_path).ok()?;
```
With:
```
let repo = match git2::Repository::open(repo_path) {
    Ok(r) => r,
    Err(e) if is_reftable_error(&e) => {
        return shell_list_commits(repo_path, base_branch);
    }
    Err(_) => return None,
};
```

**get_diff_commit handler** (currently line ~579, the match block):
The existing match is:
```rust
let repo = match git2::Repository::open(&state.repo_path) {
    Ok(r) => r,
    Err(_) => {
        return (StatusCode::INTERNAL_SERVER_ERROR, ...).into_response();
    }
};
```
Replace with:
```rust
let repo = match git2::Repository::open(&state.repo_path) {
    Ok(r) => r,
    Err(e) if is_reftable_error(&e) => {
        let context_lines = params.context.unwrap_or(3);
        let file_diffs = shell_diff_commit(&state.repo_path, &sha, context_lines)
            .unwrap_or_default();
        return (StatusCode::OK, Json(file_diffs)).into_response();
    }
    Err(_) => {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "failed to open repository"})),
        )
            .into_response();
    }
};
```
Note: in this handler `sha` holds the URL path param String (not oid at this point); the reftable branch returns before the oid parse, so hex validation is skipped for the reftable path. That is acceptable — git itself will reject invalid SHAs.

**Add 2 tests** in the existing `#[cfg(test)]` block:

```rust
/// Test shell_branch_diff: directly calling the shell path on a standard repo
/// must return the same single-file result as the git2 path.
#[tokio::test]
async fn shell_branch_diff_returns_added_file() {
    let (tmp, _repo, _oids) = make_repo_with_main_and_feature(&[("shell_test.txt", "hello\n")]);
    let result = shell_branch_diff(tmp.path(), 3, None);
    let file_diffs = result.expect("shell_branch_diff must return Some");
    assert_eq!(file_diffs.len(), 1, "Expected 1 file diff, got {}", file_diffs.len());
    assert_eq!(file_diffs[0].filename, "shell_test.txt");
    assert_eq!(file_diffs[0].status, "added");
    assert_eq!(file_diffs[0].additions, 1);
}

/// Test shell_list_commits: directly calling the shell path on a standard repo
/// must return commits with the correct count and message.
#[tokio::test]
async fn shell_list_commits_returns_feature_commits() {
    let (tmp, _repo, _oids) = make_repo_with_main_and_feature(&[("shell_commit.txt", "data\n")]);
    let result = shell_list_commits(tmp.path(), None);
    let commit_list = result.expect("shell_list_commits must return Some");
    // Exactly 1 real commit (plus possibly Uncommitted/Untracked sentinels).
    let real_commits: Vec<_> = commit_list
        .commits
        .iter()
        .filter(|c| c.sha != UNCOMMITTED_SHA && c.sha != UNTRACKED_SHA)
        .collect();
    assert_eq!(real_commits.len(), 1, "Expected 1 real commit");
    assert!(
        real_commits[0].message.contains("feature"),
        "commit message must contain 'feature', got: {}",
        real_commits[0].message
    );
    assert_eq!(real_commits[0].sha.len(), 40, "sha must be 40 chars");
}
```
  </action>
  <verify>
    <automated>cd /Users/julien.muetton/Projects/lab/claude-plan-reviewer && cargo test -p plan-reviewer -- diff_api 2>&1 | tail -40</automated>
  </verify>
  <done>
All diff_api tests pass including the 2 new shell_* tests.
cargo clippy -- -D warnings reports no warnings on src/diff_api.rs.
cargo fmt --check passes.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| shell subprocess output | git stdout is parsed as trusted; the repo_path is already trusted (local filesystem path from CLI args) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ugq-01 | Tampering | shell_run args construction | accept | repo_path comes from CLI, not user input; SHA comes from git2::Oid::from_str validation in the non-reftable handler path; in the reftable handler path, git itself rejects non-hex input |
| T-ugq-02 | Information Disclosure | shell_get_file_content | accept | reads from local repo only; no network; consistent with existing git2 blob reads |
| T-ugq-03 | Tampering | npm/pip/cargo installs | accept | no new dependencies added; pure stdlib + existing crates |
</threat_model>

<verification>
Run the full test suite to confirm no regressions:

```bash
cd /Users/julien.muetton/Projects/lab/claude-plan-reviewer
cargo test -p plan-reviewer 2>&1 | tail -20
cargo clippy -- -D warnings
cargo fmt --check
```

All tests green, no clippy warnings, fmt clean.
</verification>

<success_criteria>
- `cargo test -p plan-reviewer -- diff_api` reports all tests passing including shell_branch_diff_returns_added_file and shell_list_commits_returns_feature_commits
- `cargo clippy -- -D warnings` exits 0
- `cargo fmt --check` exits 0
- try_branch_diff, try_list_commits, try_uncommitted_diff, try_untracked_diff, and get_diff_commit all contain an `is_reftable_error` branch
</success_criteria>

<output>
Create `.planning/quick/260528-ugq-fix-reftable-repos-showing-empty-diffs/260528-ugq-SUMMARY.md` when done.
</output>
