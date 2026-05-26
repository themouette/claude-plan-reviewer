---
phase: 29-code-review-integration
plan: "01"
subsystem: cli
tags:
  - rust
  - cli
  - subcommand
  - claude-code-hooks
dependency_graph:
  requires: []
  provides:
    - Commands::CodeReview (plan-reviewer code-review)
    - Commands::PrePrHook (plan-reviewer pre-pr-hook)
    - run_code_review_flow()
    - run_pre_pr_hook_flow()
    - should_trigger_code_review()
    - build_review_url()
    - extract_command_from_tool_input()
    - is_pr_command()
  affects:
    - src/main.rs (async_main signature changed)
tech_stack:
  added: []
  patterns:
    - TDD (RED commit → GREEN commit per task)
    - pure helper functions for unit-testable logic
    - early-exit with std::process::exit(0) before tokio runtime for performance-sensitive hook
key_files:
  created:
    - tests/integration/code_review_subcommand.rs
  modified:
    - src/main.rs
    - tests/integration/main.rs
    - tests/integration/review_subcommand.rs
decisions:
  - "PrePrHook variant: clap auto-converts camelCase PrePrHook to kebab pre-pr-hook — no #[command(name)] override needed (verified by test_cli_pre_pr_hook_subcommand_parses)"
  - "ToolInput.command: relied on existing extra map via #[serde(flatten)] — no new typed field added to ToolInput (Tests 4-5 pass with extra.get('command'))"
  - "is_pr_command uses starts_with not regex — explicit, grep-friendly, no new dependency"
  - "run_pre_pr_hook_flow calls std::process::exit(0) BEFORE binding any port — satisfies T-29-02 (agent performance)"
  - "async_main gains path: &str parameter; all 3 existing callers pass '/'"
metrics:
  duration: "709s (~11m)"
  completed: "2026-05-26"
  tasks_completed: 3
  files_changed: 4
  tests_added: 11
---

# Phase 29 Plan 01: CLI Subcommands — code-review + pre-pr-hook Summary

Two new CLI subcommands added to the `plan-reviewer` binary: `code-review` and `pre-pr-hook`, plus four supporting helpers and a refactored `async_main` signature.

## What Was Built

### New Commands

- **`plan-reviewer code-review`** — Starts the local server and opens the browser at `/code-review`. Passes `String::new()` as plan content (the /code-review SPA route does not call `/api/plan`). Writes `{"behavior":"allow"|"deny"}` JSON to stdout when the user submits a review.

- **`plan-reviewer pre-pr-hook`** — Claude Code `PreToolUse` hook handler. Reads stdin JSON, extracts `tool_input.command`, checks against `gh pr create` / `git push` prefix. Exits 0 silently (zero stdout bytes) for non-matching commands. Delegates to `run_code_review_flow` when the command matches.

### New Helpers (all unit-tested)

| Function | Location | Purpose |
|---|---|---|
| `build_review_url(port, path)` | `src/main.rs` | Pure URL builder; replaces hardcoded `format!("http://127.0.0.1:{}/", port)` in `async_main` |
| `should_trigger_code_review(hook_input)` | `src/main.rs` | Delegates to `extract_command_from_tool_input` + `is_pr_command`; unit-tested with JSON payloads |
| `extract_command_from_tool_input(tool_input)` | `src/main.rs` | Reads `tool_input.extra["command"]` via `#[serde(flatten)]` map |
| `is_pr_command(cmd)` | `src/main.rs` | `starts_with("gh pr create")` or `starts_with("git push")` after trimming leading whitespace |

### Refactor: `async_main` Path Parameter

Changed signature from:
```
async fn async_main(no_browser, port, plan_md, approve_label, deny_label) -> Decision
```
to:
```
async fn async_main(no_browser, port, plan_md, approve_label, deny_label, path: &str) -> Decision
```

Three existing callers (`run_opencode_flow`, `run_review_flow`, `run_hook_flow`) all pass `"/"`. The new `run_code_review_flow` passes `"/code-review"`.

## Clap Naming Decision

`PrePrHook` (PascalCase) automatically converts to `pre-pr-hook` (kebab-case) by clap's derive macro — **no `#[command(name = "...")]` override needed**. Verified by `test_cli_pre_pr_hook_subcommand_parses`.

## ToolInput Command Field Decision

Used existing `ToolInput.extra` map via `#[serde(flatten)]` — `extra.get("command")`. **No new typed field added to `ToolInput`**. Tests 4-5 (`test_extract_command_from_tool_input_*`) pass with this approach.

## Test Summary

| Category | Count | Files |
|---|---|---|
| Unit tests (Tasks 1+2) | 11 new | `src/main.rs` |
| Integration tests (Task 3) | 3 new | `tests/integration/code_review_subcommand.rs` |
| **Total new** | **14** | — |
| Full suite after changes | 128 unit + 26 integration = 154 | — |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Pre-existing blocking lint] Fix clippy::lines_filter_map_ok in review_subcommand.rs**
- **Found during:** Task 3 (`cargo clippy --tests -- -D warnings`)
- **Issue:** `reader.lines().flatten()` triggers `clippy::lines_filter_map_ok` — `flatten()` on `Lines` will run forever if the iterator repeatedly produces `Err`
- **Fix:** Changed to `reader.lines().map_while(Result::ok)` in `tests/integration/review_subcommand.rs`
- **Files modified:** `tests/integration/review_subcommand.rs`
- **Commit:** b9b763b

## Known Stubs

None. `String::new()` passed to `async_main` as `plan_md` in `run_code_review_flow` is **intentional** (the /code-review SPA route never calls /api/plan — verified in RESEARCH.md Pitfall 4, noted in plan context). Not a stub.

## Threat Flags

No new threat surface beyond what the plan's threat model documents:
- `run_pre_pr_hook_flow` parses PreToolUse stdin JSON — covered by T-29-01 (malformed JSON: exit 1)
- `should_trigger_code_review` early-returns false — satisfies T-29-02 (agent performance: no server bind before filter check)
- `tool_input.command` inspected prefix-only, never logged — satisfies T-29-03 (no secret exfiltration)

## Self-Check: PASSED

| Check | Result |
|---|---|
| `tests/integration/code_review_subcommand.rs` exists | FOUND |
| `29-01-SUMMARY.md` exists | FOUND |
| commit b9eb089 (RED Task 1) | FOUND |
| commit 6ba3ea8 (GREEN Task 1) | FOUND |
| commit 053f528 (RED Task 2) | FOUND |
| commit 350513d (GREEN Task 2) | FOUND |
| commit b9b763b (Task 3 integration tests) | FOUND |
| `cargo test` 128+26=154 all pass | PASSED |
| `cargo clippy --all-targets -- -D warnings` | PASSED |
| `cargo fmt --check` | PASSED |
| `plan-reviewer --help` lists code-review and pre-pr-hook | PASSED |
| `pre-pr-hook` with npm install exits 0, no stdout | PASSED |
