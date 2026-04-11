---
phase: 10-slash-command-install-uninstall
plan: 01
subsystem: integrations
tags: [rust, install, uninstall, claude-code, plugin, slash-command, tdd]

# Dependency graph
requires:
  - phase: 07.2-insert-phase-a-from-planning-research-integration-plugin-rew
    provides: ClaudeIntegration plugin directory model (plugin.json, marketplace.json, hooks.json)
provides:
  - commands/annotate.md written by install() with D-03 exact content
  - idempotency refactor: file writes unconditional, settings.json mutations guarded
  - /plan-reviewer:annotate slash command file infrastructure for Phase 11
affects:
  - 11-slash-command-prompt (reads commands/annotate.md; Phase 11 replaces content with full prompt)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD for install filesystem operations: RED (failing tests) → GREEN (implementation) → format"
    - "Idempotency split: unconditional file writes + guarded settings.json mutations"

key-files:
  created: []
  modified:
    - src/integrations/claude.rs
    - tests/integration/install_uninstall.rs

key-decisions:
  - "D-01: File writes (plugin.json, marketplace.json, hooks.json, commands/annotate.md) run unconditionally; only settings.json mutations are guarded by plugin_is_registered()"
  - "D-03: commands/annotate.md content is exactly '# Annotate\\n\\nOpens the plan-reviewer browser UI to review a file.\\n\\n$ARGUMENTS\\n' — Phase 11 replaces the body"
  - "D-04: No change to uninstall() — remove_dir_all(plugin_dir) already removes commands/ implicitly"

patterns-established:
  - "Pattern: commands/annotate.md write follows same create_dir_all + write + println pattern as hooks/hooks.json"
  - "Pattern: idempotency guard moved to protect only settings mutations, not file refreshes"

requirements-completed: [PLGN-01, PLGN-02, PLGN-03]

# Metrics
duration: 15min
completed: 2026-04-11
---

# Phase 10 Plan 01: Slash Command Install/Uninstall Summary

**commands/annotate.md written by install() with idempotency refactor so existing users get the new slash command file on re-install without settings.json corruption**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-11T20:39:31Z
- **Completed:** 2026-04-11T20:44:39Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `plan-reviewer install claude` now writes `commands/annotate.md` at `~/.local/share/plan-reviewer/claude-plugin/commands/annotate.md` with exact D-03 content, registering `/plan-reviewer:annotate` in Claude Code's slash command menu
- Idempotency refactor: all four plugin files (plugin.json, marketplace.json, hooks.json, commands/annotate.md) are always rewritten on install; only settings.json mutations are skipped if already present
- 3 new unit tests + 3 new integration tests all pass (25 unit tests total, 12 integration tests total)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for commands/annotate.md** - `20592dc` (test)
2. **Task 1 chore: Restore accidentally reverted files** - `4d5963a` (chore)
3. **Task 1 GREEN: Refactor install() idempotency + add commands/annotate.md write** - `ec9cbd6` (feat)
4. **Task 2: Integration tests for install and uninstall** - `d1ecaf3` (feat)

## Files Created/Modified

- `src/integrations/claude.rs` — Added Step 1d (commands/annotate.md write), moved plugin_is_registered() guard to protect only Steps 4-6 (settings mutations), updated doc comment, added 3 new unit tests
- `tests/integration/install_uninstall.rs` — Added 3 new integration tests: install creates annotate.md, re-install recreates it (D-01), uninstall removes commands/ dir (D-04)

## Decisions Made

- D-01 idempotency refactor applied as planned: the four file writes always run unconditionally before the settings.json read + guard
- D-03 content written as a string literal constant directly in the write call (not a named constant) — simple enough to not need extraction; Phase 11 will replace content anyway
- D-04 confirmed: uninstall() unchanged, remove_dir_all covers commands/ implicitly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored files accidentally reverted by worktree soft-reset**
- **Found during:** Task 1 TDD RED commit
- **Issue:** The worktree was created from an older base commit (33402274) and was soft-reset to 156bdd2. The subsequent test commit accidentally included state-reverting diffs: .github/workflows/ci.yml (removed cargo test step), .planning/ROADMAP.md and .planning/STATE.md (phase 10 content reverted), and the entire .planning/phases/10-slash-command-install-uninstall/ directory was deleted
- **Fix:** Extracted the correct file contents from git object store (156bdd2 and 9e4b970), restored them to the working tree, and committed the restoration
- **Files modified:** .github/workflows/ci.yml, .planning/ROADMAP.md, .planning/STATE.md, .planning/phases/10-slash-command-install-uninstall/ (3 files recreated)
- **Verification:** git status clean after restoration; all planning files match 156bdd2 state
- **Committed in:** 4d5963a (chore: restore files accidentally reverted by worktree soft-reset)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking: worktree base mismatch caused accidental file deletions in TDD RED commit)
**Impact on plan:** Restoration commit added. No scope creep. All planned work delivered as specified.

## Issues Encountered

- Worktree was created from an older base (33402274 vs expected 156bdd2). The soft-reset to 156bdd2 left planning files as "deleted" in the working tree, which were inadvertently included in the TDD RED commit. Fixed by restoring from git object store before proceeding with implementation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 11 (slash-command-prompt) can now write the full prompt logic into `commands/annotate.md`
- The file path is `{home}/.local/share/plan-reviewer/claude-plugin/commands/annotate.md`
- The stub content `# Annotate\n\nOpens the plan-reviewer browser UI to review a file.\n\n$ARGUMENTS\n` is replaced by Phase 11
- No blockers: install/uninstall tested end-to-end, idempotency verified, commands/ lifecycle verified

---
*Phase: 10-slash-command-install-uninstall*
*Completed: 2026-04-11*
