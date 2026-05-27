---
phase: 29-code-review-integration
reviewed: 2026-05-26T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/main.rs
  - src/integrations/claude.rs
  - tests/integration/code_review_subcommand.rs
  - tests/integration/install_uninstall.rs
  - tests/integration/main.rs
  - tests/integration/review_subcommand.rs
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-05-26T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 29 adds two new subcommands (`code-review`, `pre-pr-hook`), the
`/plan-reviewer:code-review` slash command, and a `PreToolUse` hook entry in
hooks.json. The logic is generally sound, but there are meaningful correctness
gaps.

The most serious defect is a protocol violation in `run_pre_pr_hook_flow`: when
a PR/push command is detected the function delegates to `run_code_review_flow`,
which writes `{"behavior":"allow"|"deny"}` (opencode/neutral format) to stdout
and then returns. Claude Code's PreToolUse hook must receive a Claude-protocol
response — `{"hookSpecificOutput":{...}}` — or no response at all (exit 0
non-blocking). Emitting a foreign JSON envelope will be parsed by Claude Code in
an unspecified way and may silently swallow the review result.

There are also several logic/quality defects worth fixing before shipping:
the server's `CancellationToken` is dropped immediately after the server starts
(preventing graceful shutdown), `git push` without a remote is matched but
`git push` to `--force` variants may deserve special treatment, the code-review
flow unconditionally starts the server even on non-Bash PreToolUse events, and
`_binary_path` is validated but never used.

---

## Critical Issues

### CR-01: `run_pre_pr_hook_flow` emits wrong JSON protocol to Claude Code

**File:** `src/main.rs:878`
**Issue:** When `should_trigger_code_review` returns `true`, the function calls
`run_code_review_flow`, which writes `{"behavior":"allow"}` or
`{"behavior":"deny","message":"..."}` (opencode/neutral format) to stdout and
exits. Claude Code's PreToolUse hook protocol requires either:
- Exit 0 with **no stdout** to allow the tool call to proceed, or
- Exit 0 with `{"hookSpecificOutput":{"hookEventName":"PreToolUse",
  "decision":{"behavior":"block","message":"..."}}}` to block.

Emitting the opencode flat format to a Claude Code PreToolUse hook will be
ignored or misinterpreted. A "deny" result that should block the `git push`
will be silently discarded — the push proceeds anyway, defeating the purpose of
the hook.

**Fix:** The PR/push flow must output the Claude-format response when
terminating from a PreToolUse context. Either:

1. Pass context through to the output formatter:
```rust
fn run_pre_pr_hook_flow(no_browser: bool, port: u16) {
    // ... parse stdin and filter ...
    if !should_trigger_code_review(&hook_input) {
        std::process::exit(0);
    }

    // Reuse async_main but format output for Claude Code PreToolUse protocol
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    let decision = rt.block_on(async_main(
        no_browser, port, String::new(),
        "Approve".to_string(), "Deny".to_string(), "/code-review",
    ));
    let output_json = serde_json::to_value(
        match decision.behavior.as_str() {
            "allow" => HookOutput::allow(),
            _ => HookOutput::deny(
                decision.message.unwrap_or_else(|| "Denied without message".to_string())
            ),
        }
    ).expect("serialization cannot fail");
    serde_json::to_writer(std::io::stdout(), &output_json)
        .expect("failed to write hook output");
}
```

2. Alternatively, document clearly that the hook should use exit code only
   (exit 0 = allow, exit non-zero = block) and remove the stdout write entirely
   when the behavior is "allow". But "deny" still requires the structured
   output or the user message is lost.

---

## Warnings

### WR-01: `CancellationToken` is dropped immediately — graceful shutdown never fires

**File:** `src/server.rs:90`
**Issue:** The `token` (owner of the `CancellationToken`) is dropped on
line 90, immediately after the server is spawned. `token_clone.cancelled()`
in the graceful-shutdown future waits for the owner token to be dropped, so
the shutdown fires **at server start** rather than when the process intends to
stop. The server stays up only because `std::process::exit(0)` in the 3-second
watchdog kills the process before axum's shutdown completes, bypassing
graceful shutdown entirely.

This is not a regression introduced by phase 29 (the watchdog predates this
phase), but the `code-review` flow is new and also relies on the same watchdog
path. If the watchdog ever changes to allow clean shutdown via the token, the
drop on line 90 will cause the server to shut down immediately.

**Fix:** Retain `token` alive for the duration of the server lifetime:
```rust
// Do NOT drop token here; return it or store it with the port
// so the caller can trigger shutdown when ready.
Ok((port, decision_rx))
// -- or return (port, decision_rx, token) and drop token after stdout write
```

### WR-02: `git push --set-upstream` / `git push -u` will not trigger — but `gitpush` does not exist either; the broader issue is `git push` with tag-only or no-remote form

**File:** `src/main.rs:511-513`
**Issue:** `is_pr_command` matches any string starting with `git push` after
trim. This means `git push` with **no remote** (bare `git push`) is matched —
fine, that's intentional. However the same prefix `git push` would also match
hypothetical typos like `git pushmore` (trivial issue). The larger concern is
that `git push --tags` (tag-only push, no branch, no PR) is treated as a PR
command and fires the code-review UI, which is surprising and potentially
disruptive since tag pushes do not create PRs.

Also, `git push --delete origin <tag>` (deletion) and `git push origin
:branch` (remote branch deletion) are matched and will open the review UI for
a branch deletion, which is never a PR candidate.

**Fix:** Make the predicate more precise:
```rust
fn is_pr_command(cmd: &str) -> bool {
    let t = cmd.trim_start();
    if t.starts_with("gh pr create") {
        return true;
    }
    if t.starts_with("git push") {
        // Exclude branch/tag deletions and tag-only pushes
        let rest = &t["git push".len()..];
        if rest.contains("--delete") || rest.contains("--tags") {
            return false;
        }
        return true;
    }
    false
}
```
Also add test cases for `git push --tags` and `git push --delete origin foo`.

### WR-03: `_binary_path` validated but silently unused — `hooks.json` hard-codes bare binary name

**File:** `src/integrations/claude.rs:41-44`
**Issue:** `binary_path` is extracted from `ctx`, validated to be `Some`, bound
to `_binary_path` with the leading underscore that suppresses the unused-variable
warning, and then **never referenced again**. The generated `hooks.json` hard-
codes `"command": "plan-reviewer review-hook"` (bare name). This is intentional
per the comment (`// hooks.json uses bare "plan-reviewer"`), but the guard check
that `binary_path` must be `Some` then provides no safety — it will always pass
because `install::run_install` always fills `binary_path`. The validation is
misleading: it implies the path is needed but it is not.

Either remove the guard (make it optional) or use the path to produce the
full-path command string so the hook works even when `plan-reviewer` is not on
`$PATH`.

**Fix:** Either remove the dead guard:
```rust
// binary_path is not used; hooks.json uses bare "plan-reviewer" on PATH
let _ = ctx.binary_path.as_deref(); // no validation needed
```
Or use the path in hooks.json (more robust):
```rust
let binary = ctx.binary_path.as_deref()
    .ok_or_else(|| "install requires a binary_path".to_string())?;
// Then use binary in hook commands instead of bare "plan-reviewer"
```

### WR-04: `install_creates_annotate_md_even_when_already_installed` test does not re-check `code-review.md`

**File:** `src/integrations/claude.rs:1038-1068`
**Issue:** The test at line 1038 (`install_creates_annotate_md_even_when_already_installed`)
deletes the commands directory, re-installs, and checks that `annotate.md` was
recreated. It does **not** assert that `code-review.md` was also recreated.
Given that phase 29 adds `code-review.md` as a co-equal file, this test
only half-validates the contract. A regression that skips writing
`code-review.md` on re-install would pass this test.

A dedicated test (`install_creates_code_review_md_even_when_already_installed`)
exists at line 1438, so the gap is in `install_creates_annotate_md_even_when_already_installed`
not covering both files jointly.

**Fix:** Add the `code-review.md` assertion to the existing test or merge the
two idempotent-reinstall tests into one:
```rust
assert!(
    commands_dir.join("code-review.md").exists(),
    "commands/code-review.md should also be recreated on re-install"
);
```

---

## Info

### IN-01: `run_code_review_flow` outputs to stdout even for `pre-pr-hook` path

**File:** `src/main.rs:845-847`
**Issue:** `run_code_review_flow` always writes JSON to stdout at the end. When
called from `run_pre_pr_hook_flow` (line 878), this stdout write is the hook
protocol output. When called from `main()` for the `Commands::CodeReview`
branch (line 650), the user invoked `plan-reviewer code-review` directly from
a terminal, where writing `{"behavior":"allow"}` to stdout pollutes the
terminal. This is a minor UX issue — the decision JSON appearing on stdout for
a direct invocation is unexpected — but it does not break anything if the user
is running it interactively.

**Fix:** Consider skipping the stdout write (or writing to stderr) when
`Commands::CodeReview` is invoked directly without a hook context. Could be
as simple as a `--hook-mode` flag or a separate code path.

### IN-02: `review_subcommand.rs` — `child` is consumed by `wait_with_output` in `review_approve` but `_home` TempDir drops after it

**File:** `tests/integration/review_subcommand.rs:109`
**Issue:** In `review_approve`, the variable `_home` is kept alive (intentional
TempDir drop prevention) alongside the `child` process. After the POST to
`/api/decide`, `child.wait_with_output()` is called, which consumes `child`.
Then `_home` drops at the end of the function. The ordering is correct here,
but the same pattern in `review_serves_plan_content` (lines 200-203) uses
`child.wait_with_output()` via `let _ = ...` — the return value is discarded
but any panic in the child won't be reported. This is a test reliability
concern, not a correctness issue.

**Fix:** In the cleanup block, prefer:
```rust
let output = child.wait_with_output().expect("child panicked");
// optional: assert!(output.status.success(), "child exited non-zero");
```

---

_Reviewed: 2026-05-26T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
