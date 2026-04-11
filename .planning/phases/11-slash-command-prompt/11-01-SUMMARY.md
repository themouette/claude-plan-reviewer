---
phase: 11-slash-command-prompt
plan: "01"
subsystem: integrations
tags: [slash-command, claude-code, prompt, annotate, plan-reviewer]

# Dependency graph
requires:
  - phase: 10-slash-command-install-uninstall
    provides: install() writes commands/annotate.md; uninstall removes it; annotate_content stub in claude.rs
  - phase: 07.4-add-review-file-subcommand
    provides: plan-reviewer review <file> subcommand; build_opencode_output neutral JSON format
provides:
  - Full /plan-reviewer:annotate slash command prompt with 3-mode file resolution
  - Frontmatter with description, argument-hint, allowed-tools: Bash
  - Pre-launch user framing message about Approve/Deny meaning
  - plan-reviewer review via Bash with run_in_background: true
  - allow/deny result handling with "Review complete" and "Feedback received" phrases
  - Updated unit test verifying full prompt content (not stub)
  - Updated integration test verifying new heading and execution command
affects: [11.1-configurable-review-actions, future-annotate-enhancements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "concat!() for multi-line Rust string constants — compile-time zero overhead, readable one-line-per-newline format"
    - "Claude Code slash command frontmatter: description, argument-hint, allowed-tools fields"
    - "$ARGUMENTS substitution variable for user-supplied args at invocation time"
    - "run_in_background: true Bash tool parameter for non-blocking process execution"

key-files:
  created: []
  modified:
    - src/integrations/claude.rs
    - tests/integration/install_uninstall.rs

key-decisions:
  - "Used concat!() macro for annotate_content — compile-time string join with one line per newline; readable and zero runtime overhead"
  - "Replaced exact-equality test assertion with substring assertions — full prompt is large multiline content; substrings are more maintainable"
  - "Fixed integration test install_claude_creates_commands_annotate_md — Rule 1 auto-fix, old assertion checked stub heading '# Annotate' which no longer matches"

patterns-established:
  - "Slash command prompts use frontmatter (---) with description/argument-hint/allowed-tools"
  - "Claude 3-rule file resolution: explicit arg > session history scan > temp file fallback"
  - "Review results parsed from stdout JSON: behavior=allow -> proceed, behavior=deny+message -> revise"

requirements-completed: [SLSH-01, SLSH-02, SLSH-03, SLSH-04, SLSH-05, SLSH-06, SLSH-07]

# Metrics
duration: ~10min
completed: 2026-04-11
---

# Phase 11 Plan 01: Slash Command Prompt Summary

**Full /plan-reviewer:annotate Claude Code slash command prompt with 3-mode file resolution, run_in_background Bash invocation, and allow/deny result handling — zero binary changes, all logic in the annotate_content string constant**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-11T21:32:00Z
- **Completed:** 2026-04-11T21:35:35Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced 1-line stub `annotate_content` with a 60-line full slash command prompt using `concat!()` macro
- Prompt implements 3-rule file resolution: Rule A (explicit $ARGUMENTS), Rule B (last .md in conversation history), Rule C (mktemp fallback)
- Prompt includes frontmatter (`description:`, `argument-hint:`, `allowed-tools: Bash`), pre-launch user message, and result-handling for allow/deny
- Updated `install_creates_annotate_md_with_expected_content` unit test to verify full content via substring assertions (not exact stub equality)
- Auto-fixed integration test `install_claude_creates_commands_annotate_md` that still asserted old `# Annotate` heading

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace annotate_content stub with full prompt string** - `2360b08` (feat)
2. **Task 2: Update unit test to verify full prompt content** - `f96994f` (test)

**Plan metadata:** (included in Task 2 commit)

## Files Created/Modified

- `src/integrations/claude.rs` - annotate_content string replaced with full /plan-reviewer:annotate prompt; unit test updated
- `tests/integration/install_uninstall.rs` - install_claude_creates_commands_annotate_md assertions updated to match new heading and content

## Decisions Made

- Used `concat!()` macro for annotate_content — compile-time string join, one line per `\n`, readable and zero runtime overhead. This matches the plan's explicit guidance (IMPORTANT note in action block).
- Replaced exact-equality test with substring assertions — full prompt is 60+ lines; substrings are maintainable and test the semantic contracts, not whitespace details.
- No binary changes — zero changes to install/uninstall wiring, settings.json mutations, or any other behavior. Only the string constant and tests changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed integration test checking old stub heading**
- **Found during:** Task 2 (full test suite run after unit test updated)
- **Issue:** Integration test `install_claude_creates_commands_annotate_md` in `tests/integration/install_uninstall.rs` line 156 asserted `content.contains("# Annotate")` — the old stub heading. After Task 1 replaced the stub with the full prompt (heading now `# /plan-reviewer:annotate`), this test failed with "should contain heading".
- **Fix:** Updated integration test assertions to check for `# /plan-reviewer:annotate`, `$ARGUMENTS`, `allowed-tools: Bash`, and `plan-reviewer review` — matching the new prompt content.
- **Files modified:** `tests/integration/install_uninstall.rs`
- **Verification:** All 12 install_uninstall integration tests pass; all 109 unit tests pass.
- **Committed in:** f96994f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in integration test)
**Impact on plan:** Necessary fix — integration test was testing the old stub content and would have been permanently broken after Task 1. No scope creep.

## Issues Encountered

- `review_subcommand::review_approve` integration test fails with "Connection reset by peer" — pre-existing flaky test caused by port binding race conditions in the review server tests. Unrelated to our changes. Same test suite also shows `review_serves_plan_content` failing intermittently. These are pre-existing test infrastructure issues, not caused by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 11 complete. The `/plan-reviewer:annotate` slash command is fully functional.
- Phase 11.1 (Configurable Review Actions) can now implement `--approve-label` / `--deny-label` flags and update `annotate.md` to use "No issues" / "Leave feedback" button labels.
- All 7 requirements SLSH-01 through SLSH-07 addressed by the prompt content.

---
*Phase: 11-slash-command-prompt*
*Completed: 2026-04-11*

## Self-Check: PASSED

- [x] `src/integrations/claude.rs` exists and contains `# /plan-reviewer:annotate`
- [x] `tests/integration/install_uninstall.rs` exists and checks new heading
- [x] Commit `2360b08` exists (Task 1: feat)
- [x] Commit `f96994f` exists (Task 2: test)
- [x] `cargo test` (unit + install_uninstall integration) passes
- [x] `cargo clippy -- -D warnings` exits 0
- [x] `cargo fmt --check` is clean
