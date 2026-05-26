---
phase: 29-code-review-integration
plan: "02"
subsystem: cli
tags:
  - rust
  - claude-code
  - plugin
  - install
  - hooks
dependency_graph:
  requires:
    - 29-01 (plan-reviewer pre-pr-hook subcommand)
  provides:
    - ClaudeIntegration::install() writes commands/code-review.md
    - ClaudeIntegration::install() writes PreToolUse array to hooks.json
  affects:
    - src/integrations/claude.rs (install() and unit tests)
    - tests/integration/install_uninstall.rs (three new integration tests)
tech_stack:
  added: []
  patterns:
    - TDD (RED commit -> GREEN commit per task)
    - concat!() literal for embedded markdown content
    - serde_json::json! literal for structured hook config
key_files:
  created: []
  modified:
    - src/integrations/claude.rs
    - tests/integration/install_uninstall.rs
decisions:
  - "hooks.json literal extended with both PermissionRequest and PreToolUse in single write — avoids Pitfall 5 (overwrite-then-lose existing array)"
  - "code-review.md heading is '# /plan-reviewer:code-review' (plugin-namespaced, per Pitfall 3)"
  - "PreToolUse matcher is 'Bash' (broad); filtering happens in plan-reviewer pre-pr-hook itself"
  - "timeout: 600000 (10 minutes) matches 540s server watchdog plus 60s headroom"
  - "uninstall coverage automatic — remove_dir_all(&plugin_dir) already covers new files; no code change needed"
metrics:
  duration: "446s (~7m)"
  completed: "2026-05-26"
  tasks_completed: 3
  files_changed: 2
  tests_added: 7
---

# Phase 29 Plan 02: Install Wiring — code-review.md + PreToolUse Hook Summary

Extended `ClaudeIntegration::install()` to write `commands/code-review.md` and add a `PreToolUse` array to `hooks/hooks.json`, completing the final wiring layer that exposes Plan 29-01's new subcommands to Claude Code users.

## What Was Built

### Extended install() — two new artifacts

**`commands/code-review.md`** — Slash command file read by Claude Code when users invoke `/plan-reviewer:code-review`. Contains:
- Frontmatter with `description` and `allowed-tools: Bash`
- Plugin-namespaced heading `# /plan-reviewer:code-review`
- `run_in_background: true` instruction for the Bash tool
- `plan-reviewer code-review` invocation command
- Decision handling: `{"behavior":"allow"}` / `{"behavior":"deny","message":"<feedback>"}` / empty stdout

**`PreToolUse` array in hooks/hooks.json** — Registers `plan-reviewer pre-pr-hook` as a Claude Code PreToolUse hook for all Bash tool calls.

### Final hooks.json shape

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "hooks": [
          {
            "command": "plan-reviewer review-hook",
            "type": "command"
          }
        ],
        "matcher": "ExitPlanMode"
      }
    ],
    "PreToolUse": [
      {
        "hooks": [
          {
            "command": "plan-reviewer pre-pr-hook",
            "timeout": 600000,
            "type": "command"
          }
        ],
        "matcher": "Bash"
      }
    ]
  }
}
```

### Final code-review.md frontmatter + heading (first 6 lines)

```
---
description: Open the code review UI for the current git branch
allowed-tools: Bash
---

# /plan-reviewer:code-review
```

## Test Summary

| Category | Count | What was tested |
|---|---|---|
| Unit tests (Task 1) | 4 new | content, PreToolUse structure, ExitPlanMode preservation, idempotent re-install |
| Integration tests (Task 2) | 3 new | install creates file, hooks.json round-trip, uninstall removes file |
| **Total new** | **7** | — |
| Full suite after changes | 132 unit + 29 integration = 161 | — |

## ROADMAP Phase 29 Success Criteria Mapping

| Criterion | Covered by |
|---|---|
| 1. `install claude` creates `commands/code-review.md` + registers pre-PR hook entry; `/code-review` in slash command menu | Task 1 `install_creates_code_review_md_with_expected_content` + `install_creates_hooks_json_with_pre_tool_use`; Task 2 `install_claude_creates_commands_code_review_md` + `install_claude_writes_pre_tool_use_hook_in_hooks_json` |
| 2. Running `/code-review` or agent triggering pre-PR hook opens browser UI at `/code-review` | Plan 29-01 Task 3 smoke test (`test_code_review_subcommand_help_includes_route`) + Task 1 hooks.json wiring |
| 3. `uninstall claude` removes slash command file and hook entry; re-running exits 0 | Task 2 `uninstall_claude_removes_code_review_md` + existing `uninstall_claude_idempotent` test |
| 4. `plan-reviewer code-review` can be invoked directly to open review UI | Plan 29-01 Task 3 dispatch tests + `./target/release/plan-reviewer --help` shows `code-review` |
| 5. Existing install behavior for annotate/review-hook is unchanged | `install_creates_annotate_md_with_expected_content` + `install_creates_hooks_json_with_exit_plan_mode` + `install_claude_is_idempotent` all pass in full suite |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All paths in `install()` write real content; no placeholder data.

## Threat Model Coverage

| Threat ID | Status |
|---|---|
| T-29-06: hooks.json write overwrites PermissionRequest | Mitigated — single JSON literal includes both arrays; `install_hooks_json_preserves_exit_plan_mode_after_pre_tool_use_added` asserts both arrays present |
| T-29-07: Malformed JSON in hooks.json | Mitigated — `serde_json::to_string_pretty` on a well-formed literal cannot fail |
| T-29-08: code-review.md information disclosure | Accepted — no secrets, user-owned path |
| T-29-09: Broad Bash matcher slows every Bash call | Mitigated — `pre-pr-hook` exits 0 silently for non-PR commands (Plan 29-01 Task 3 smoke test) |
| T-29-10: Install writes outside HOME | Mitigated — all paths via `PathBuf::join` with hardcoded segments |
| T-29-11: Orphan files after uninstall | Accepted — `remove_dir_all` is unconditional; `uninstall_claude_removes_code_review_md` asserts |

## Self-Check: PASSED

| Check | Result |
|---|---|
| `src/integrations/claude.rs` modified | FOUND |
| `tests/integration/install_uninstall.rs` modified | FOUND |
| commit 4021629 (RED — failing unit tests) | FOUND |
| commit 6aad526 (GREEN — implementation) | FOUND |
| commit 2f0d19a (integration tests) | FOUND |
| `cargo test` 132+29=161 all pass | PASSED |
| `cargo clippy --all-targets -- -D warnings` | PASSED |
| `cargo fmt --check` | PASSED |
| `plan-reviewer --help` lists code-review and pre-pr-hook | PASSED (count: 2) |
| hooks.json contains both PermissionRequest and PreToolUse | PASSED |
| code-review.md heading is `# /plan-reviewer:code-review` | PASSED |
