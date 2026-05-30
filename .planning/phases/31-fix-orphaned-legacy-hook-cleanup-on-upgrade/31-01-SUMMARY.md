---
phase: 31
plan: "01"
subsystem: update
tags: [rust, update, hook-migration, settings-cleanup]
dependency_graph:
  requires: []
  provides: [remove_claude_legacy_hook, remove_gemini_legacy_hook]
  affects: [src/update.rs]
tech_stack:
  added: []
  patterns: [extract-helper, idempotent-cleanup]
key_files:
  created: []
  modified:
    - src/update.rs
decisions:
  - "Extracted remove_claude_legacy_hook and remove_gemini_legacy_hook as private helpers; called from both Case 2 (perform_*_migration) and Case 3 (refresh_integrations_with_home) to ensure orphaned entries are always cleaned up on version-stale upgrade"
  - "Helpers are idempotent: compare array length before/after retain; skip file rewrite when nothing removed"
metrics:
  duration: "161s"
  completed: "2026-05-30"
  tasks_completed: 4
  files_modified: 1
---

# Phase 31 Plan 01: Fix Orphaned Legacy Hook Cleanup on Upgrade Summary

## One-liner

Extracted `remove_claude_legacy_hook` / `remove_gemini_legacy_hook` helpers and wired them into Case 3 (version-stale rewrite) so bare `ExitPlanMode` / `BeforeTool` entries left from pre-plugin installs are removed during upgrade, not just during migration.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Extract `remove_claude_legacy_hook` from `perform_claude_migration` | 33e6b63 |
| 2 | Extract `remove_gemini_legacy_hook` from `perform_gemini_migration` | 33e6b63 |
| 3 | Call helpers from Case 3 `_ =>` arms in `refresh_integrations_with_home` | 33e6b63 |
| 4 | Update+rename 2 existing tests, add 4 new noop/missing-settings tests | 33e6b63 |

## What Was Built

### `remove_claude_legacy_hook(home: &str)`

Private helper in `src/update.rs`. Reads `{home}/.claude/settings.json`, filters `root["hooks"]["PermissionRequest"]` to remove entries with `matcher == "ExitPlanMode"`, rewrites the file only if a removal occurred (length comparison), prints a confirmation line. Returns silently on missing or unparseable file.

### `remove_gemini_legacy_hook(home: &str)`

Private helper in `src/update.rs`. Reads `{home}/.gemini/settings.json`, retains in `root["hooks"]["BeforeTool"]` only entries whose `hooks[]` array contains no object with `name == "plan-reviewer"`, rewrites the file only if a removal occurred. Returns silently on missing or unparseable file.

### Case 3 wiring

In `refresh_integrations_with_home`, the `_ =>` match arms (version-stale) now call:
- `write_claude_plugin_files(home, current_version)` then `remove_claude_legacy_hook(home)`
- `write_gemini_extension_files(home, current_version)` then `remove_gemini_legacy_hook(home)`

The already-current-version arms (`Some(ref v) if v == current_version =>`) are unchanged — no settings.json writes on every run.

### Tests Updated / Added

- `test_claude_case3_removes_bare_entry_when_manifest_exists` — manifest present + stale version + bare ExitPlanMode entry → entry absent after `refresh_integrations_with_home` (was: asserted entry survives)
- `test_gemini_case3_removes_bare_entry_when_manifest_exists` — same for Gemini (was: asserted entry survives)
- `test_remove_claude_legacy_hook_noop_when_absent` — no ExitPlanMode entry → mtime unchanged
- `test_remove_gemini_legacy_hook_noop_when_absent` — no plan-reviewer BeforeTool entry → mtime unchanged
- `test_remove_claude_legacy_hook_missing_settings` — no settings.json → no panic, no file created
- `test_remove_gemini_legacy_hook_missing_settings` — no settings.json → no panic, no file created

## Verification

```
cargo test 2>&1 | tail -5
# result: test result: ok. 22 passed; 0 failed; 0 ignored
cargo clippy -- -D warnings 2>&1
# result: Finished `dev` profile [unoptimized + debuginfo] target(s) in 7.84s
```

Both exit 0. All 22 update module tests pass.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `src/update.rs` — modified (confirmed via git show)
- Commit `33e6b63` — confirmed: `git log --oneline -1` shows `fix(31-01): remove orphaned legacy hook entries during Case 3 upgrade`
- 2 renamed test functions present at lines 904 and 1051
- All 22 update module tests pass
- No files deleted unexpectedly
