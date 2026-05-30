---
phase: 31-fix-orphaned-legacy-hook-cleanup-on-upgrade
verified: 2026-05-30T00:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
---

# Phase 31: Fix Orphaned Legacy Hook Cleanup on Upgrade — Verification Report

**Phase Goal:** When plan-reviewer update runs and the plugin manifest already exists (Case 3), any lingering bare ExitPlanMode / BeforeTool entry from a pre-plugin install is silently left in settings.json, causing double-invocation of the review hook. This phase extracts the bare-entry removal into a shared helper and calls it during the Case 3 version-stale refresh path so the ghost entry is cleaned up regardless of upgrade path.
**Verified:** 2026-05-30
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `refresh_integrations_with_home` removes the bare `ExitPlanMode` entry from Claude `settings.json` whenever present, regardless of whether the plugin manifest existed before or was just created | VERIFIED | `remove_claude_legacy_hook(home)` called in Case 3 `_ =>` arm (line 387) and in `perform_claude_migration` (line 274). `test_claude_case3_removes_bare_entry_when_manifest_exists` (line 904) passes. |
| 2 | `refresh_integrations_with_home` removes the bare `BeforeTool` entry from Gemini `settings.json` under the same condition | VERIFIED | `remove_gemini_legacy_hook(home)` called in Case 3 `_ =>` arm (line 407) and in `perform_gemini_migration` (line 328). `test_gemini_case3_removes_bare_entry_when_manifest_exists` (line 1051) passes. |
| 3 | The removal is idempotent — running refresh when no bare entry exists leaves `settings.json` unchanged | VERIFIED | Both helpers compare array length before/after `retain()` and skip `fs::write` if nothing was removed (lines 206-208 for Claude, lines 304-306 for Gemini). `test_remove_claude_legacy_hook_noop_when_absent` (line 1106) and `test_remove_gemini_legacy_hook_noop_when_absent` (line 1137) assert mtime unchanged. Both pass. |
| 4 | The existing test `test_claude_case2_skips_when_manifest_exists` is updated to reflect the new behavior | VERIFIED | The old test name no longer exists in `src/update.rs`. The replacement `test_claude_case3_removes_bare_entry_when_manifest_exists` (line 904) asserts that the `ExitPlanMode` entry is absent after refresh, which is the inverted assertion required. |
| 5 | A new test passes: manifest present + stale version + bare entry → bare entry removed after refresh (Claude) | VERIFIED | `test_claude_case3_removes_bare_entry_when_manifest_exists` (line 904): sets up stale plugin.json at version 0.2.0, bare ExitPlanMode entry in settings.json, calls `refresh_integrations_with_home` with version 0.3.0, asserts ExitPlanMode entry absent. Passes in `cargo test`. |
| 6 | Equivalent Gemini tests pass | VERIFIED | `test_gemini_case3_removes_bare_entry_when_manifest_exists` (line 1051) mirrors the Claude test for Gemini BeforeTool entries. `test_remove_gemini_legacy_hook_noop_when_absent` and `test_remove_gemini_legacy_hook_missing_settings` also pass. |
| 7 | `cargo test` exits 0; `cargo clippy -- -D warnings` exits 0 | VERIFIED | `cargo test -- update` result: 22 passed, 0 failed. `cargo clippy -- -D warnings` result: `Finished dev profile` with exit 0 and no warnings. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/update.rs` — `remove_claude_legacy_hook` fn | Private fn that removes ExitPlanMode entries, idempotent, silent on missing file | VERIFIED | Lines 193-217. Reads settings.json, filters PermissionRequest array, skips write if length unchanged, prints confirmation if removed. |
| `src/update.rs` — `remove_gemini_legacy_hook` fn | Private fn that removes BeforeTool plan-reviewer entries, idempotent, silent on missing file | VERIFIED | Lines 282-315. Reads settings.json, retains only entries with no plan-reviewer hook, skips write if length unchanged, prints confirmation if removed. |
| `src/update.rs` — Case 3 Claude `_ =>` arm calls helper | `remove_claude_legacy_hook(home)` called after `write_claude_plugin_files` | VERIFIED | Lines 385-388: `write_claude_plugin_files(home, current_version)` then `remove_claude_legacy_hook(home)`. |
| `src/update.rs` — Case 3 Gemini `_ =>` arm calls helper | `remove_gemini_legacy_hook(home)` called after `write_gemini_extension_files` | VERIFIED | Lines 405-408: `write_gemini_extension_files(home, current_version)` then `remove_gemini_legacy_hook(home)`. |
| `src/update.rs` — 6 new/renamed tests | 2 renamed (assert removal), 4 new (noop + missing-settings) | VERIFIED | All 6 test functions present (lines 904, 1051, 1106, 1137, 1168, 1183) and pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `refresh_integrations_with_home` Case 3 Claude `_ =>` arm | `remove_claude_legacy_hook` | direct call (line 387) | WIRED | Confirmed in source. Helper is not called in the `Some(ref v) if v == current_version` arm (correct). |
| `refresh_integrations_with_home` Case 3 Gemini `_ =>` arm | `remove_gemini_legacy_hook` | direct call (line 407) | WIRED | Confirmed in source. Helper is not called in the already-current-version arm (correct). |
| `perform_claude_migration` | `remove_claude_legacy_hook` | direct call (line 274) | WIRED | Case 2 still calls helper after adding registration entries. |
| `perform_gemini_migration` | `remove_gemini_legacy_hook` | direct call (line 328) | WIRED | Case 2 still calls helper after writing extension files. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 22 update module tests pass | `cargo test -- update` | 22 passed, 0 failed | PASS |
| No compiler warnings | `cargo clippy -- -D warnings` | Finished dev profile, exit 0 | PASS |
| Renamed test names exist (2 matches required) | `grep -n "test_claude_case3_removes_bare_entry_when_manifest_exists\|test_gemini_case3_removes_bare_entry_when_manifest_exists" src/update.rs` | Lines 904, 1051 | PASS |
| Old test names absent | `grep "test_claude_case2_skips_when_manifest_exists\|test_gemini_case2_skips_when_manifest_exists" src/update.rs` | No output | PASS |

### Anti-Patterns Found

None. No TBD, FIXME, XXX, TODO, HACK, or PLACEHOLDER markers found in `src/update.rs`.

### Naming Discrepancy (Informational)

ROADMAP SC5 names the new test `test_claude_case3_cleans_bare_entry_when_manifest_exists` (using "cleans"). The PLAN and implementation use `test_claude_case3_removes_bare_entry_when_manifest_exists` (using "removes"). This is a cosmetic inconsistency between ROADMAP wording and PLAN wording — the behavior intent ("bare entry is absent after refresh") is identical and the test passes. Not a gap.

### Human Verification Required

None required. All phase behaviors are programmatically verifiable via unit tests.

### Gaps Summary

No gaps. All success criteria are met.

---

_Verified: 2026-05-30_
_Verifier: Claude (gsd-verifier)_
