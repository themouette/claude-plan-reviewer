---
phase: 06-gemini-cli-integration
plan: "01"
subsystem: integrations
tags: [gemini, install, uninstall, is_installed, hook, settings]
dependency_graph:
  requires: [05-integration-architecture]
  provides: [gemini-install, gemini-uninstall, gemini-is-available]
  affects: [src/integrations/gemini.rs, src/integrations/mod.rs]
tech_stack:
  added: []
  patterns: [serde_json-value-manipulation, idempotent-install, tempdir-unit-tests]
key_files:
  created: []
  modified:
    - src/integrations/gemini.rs
    - src/integrations/mod.rs
decisions:
  - "Idempotency key is name=plan-reviewer in hooks[] sub-array, not binary path — robust against binary relocation (mirrors claude.rs convention)"
  - "timeout: 300000 hardcoded in gemini_hook_entry — Gemini CLI default of 60s is too short for interactive review"
  - "cargo fmt reformatted claude.rs (whitespace only, no logic change) as part of codebase-wide formatting pass"
metrics:
  duration: ~15 minutes
  completed: "2026-04-10T20:05:00Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 06 Plan 01: Gemini CLI Install/Uninstall Summary

**One-liner:** Full GeminiIntegration with idempotent install/uninstall writing BeforeTool hook entry with 300000ms timeout to ~/.gemini/settings.json.

## What Was Built

Replaced the `GeminiIntegration` stub in `src/integrations/gemini.rs` with a complete implementation mirroring the `claude.rs` pattern. Marked Gemini as available in `src/integrations/mod.rs` so it appears in the interactive picker.

### Task 1: GeminiIntegration install/uninstall/is_installed (commit 53f3161)

Full implementation with three private helpers and three trait methods:

- `gemini_settings_path(home)` — returns `{home}/.gemini/settings.json` as `PathBuf`
- `gemini_hook_entry(binary_path)` — produces BeforeTool JSON entry with `matcher: "exit_plan_mode"`, name `"plan-reviewer"`, and `timeout: 300000`
- `gemini_is_installed(settings)` — scans `settings["hooks"]["BeforeTool"][].hooks[]` for `name == "plan-reviewer"`

**install:** Reads existing JSON or starts from `{}`, ensures `hooks.BeforeTool` array exists, idempotency-checks before writing, creates `~/.gemini/` dir if absent, pretty-prints and writes.

**uninstall:** Returns Ok on missing file, Ok on missing hook, retains non-plan-reviewer BeforeTool entries, writes back.

**is_installed:** Reads disk, returns false on missing/invalid file.

15 unit tests covering all acceptance criteria (helper functions, install, idempotency, key preservation, binary_path=None error, uninstall removal + preservation of other entries, uninstall idempotency, is_installed with/without file).

### Task 2: Mark Gemini available + update stub test (commit b84b37d)

- `IntegrationSlug::is_available()`: `Self::Gemini => true` (was `false`)
- Removed `gemini_stub_returns_err` test, replaced with `gemini_integration_requires_binary_path` that validates the real implementation behavior

## Verification Results

| Check | Result |
|-------|--------|
| `cargo test integrations::gemini` | 15/15 passed |
| `cargo test integrations::tests` | 6/6 passed |
| `cargo test` (full suite) | 28/28 passed |
| `cargo clippy -- -D warnings` | 0 warnings |
| `cargo fmt --check` | clean |
| `cargo build` | success |
| grep: `impl Integration for GeminiIntegration` | found |
| grep: `"timeout": 300000` | found |
| grep: `Self::Gemini => true` | found |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Formatting Note

`cargo fmt` also reformatted `src/integrations/claude.rs` (whitespace/line-length adjustments, no logic changes). This is not a deviation — it's the standard fmt pass required by CLAUDE.md before each commit.

## Known Stubs

None. GeminiIntegration is fully implemented. The only remaining stubs are `OpenCodeIntegration` (tracked for Phase 7).

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns beyond what the plan's threat model covered. `gemini.rs` writes only to `~/.gemini/settings.json` (user-scoped, mirrors claude.rs trust model). No new threat flags.

## Self-Check: PASSED

### Files Created/Modified

- [x] `src/integrations/gemini.rs` — FOUND (full implementation replacing stub)
- [x] `src/integrations/mod.rs` — FOUND (Gemini marked available, test updated)

### Commits

- [x] `53f3161` — FOUND (Task 1: GeminiIntegration implementation)
- [x] `b84b37d` — FOUND (Task 2: mark Gemini available, update stub test)
