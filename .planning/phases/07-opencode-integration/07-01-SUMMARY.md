---
phase: 07-opencode-integration
plan: "01"
subsystem: integrations
tags: [opencode, install, uninstall, is_installed, plugin, js-plugin, embed]
dependency_graph:
  requires: [05-integration-architecture, 06-gemini-cli-integration]
  provides: [opencode-install, opencode-uninstall, opencode-is-available]
  affects: [src/integrations/opencode.rs, src/integrations/opencode_plugin.mjs, src/integrations/mod.rs]
tech_stack:
  added: []
  patterns: [include_str-embed, placeholder-substitution, idempotent-install, tempdir-unit-tests]
key_files:
  created:
    - src/integrations/opencode_plugin.mjs
  modified:
    - src/integrations/opencode.rs
    - src/integrations/mod.rs
decisions:
  - "Idempotency key is absolute plugin file path string in opencode.json plugin array — same path written at install is the key checked on reinstall"
  - "Plugin file always overwritten on install (idempotency check only on config entry) — ensures binary path stays current on reinstall"
  - "execFileSync + temp file approach used (not HTTP fetch) — avoids issue #21293 (spawn with piped stdin unreliable in opencode plugins); temp file approach is simpler and reliable for single-review invocations"
  - "__PLAN_REVIEWER_BIN__ placeholder replaced at install time — binary path injected into plugin file on disk, not hardcoded at compile time"
metrics:
  duration: ~10 minutes
  completed: "2026-04-10T21:26:00Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 07 Plan 01: OpenCode Integration Install/Uninstall Summary

**One-liner:** Full OpenCodeIntegration with idempotent install/uninstall writing JS plugin file to ~/.config/opencode/plugins/ and registering path in opencode.json plugin array.

## What Was Built

Replaced the `OpenCodeIntegration` stub in `src/integrations/opencode.rs` with a complete implementation. Created `src/integrations/opencode_plugin.mjs` as the embedded JS plugin source. Marked opencode as available in `src/integrations/mod.rs`.

### Task 1: OpenCodeIntegration install/uninstall/is_installed + JS plugin (commit 48b2825)

**JS plugin (`opencode_plugin.mjs`):**
- Registers `submit_plan` tool with `plan` string parameter
- Uses `execFileSync` (not `spawn` with piped stdin — avoids issue #21293) with `--plan-file` temp file argument
- `__PLAN_REVIEWER_BIN__` placeholder replaced with actual binary path at install time
- 600000ms timeout prevents infinite hang if binary never responds
- Graceful error handling: returns error message to opencode instead of crashing
- Cleans up temp file in `finally` block

**Rust implementation:**

Three private helpers:
- `opencode_config_path(home)` — returns `{home}/.config/opencode/opencode.json`
- `opencode_plugin_path(home)` — returns `{home}/.config/opencode/plugins/plan-reviewer-opencode.mjs`
- `opencode_is_installed(config, plugin_path_str)` — checks if path string is in `config["plugin"]` array

**install:** Creates `~/.config/opencode/plugins/` dir, writes plugin file with binary path injected (always overwrites), reads/creates opencode.json, idempotency-checks before writing config entry, creates `~/.config/opencode/` if absent, pretty-prints and writes. Refuses to overwrite corrupted JSON config ("refusing to overwrite" message).

**uninstall:** Removes plugin file if present (prints skip message if absent — does NOT return early), cleans plugin path from opencode.json plugin array, returns Ok on missing config file.

**is_installed:** Checks BOTH conditions — plugin file exists on disk AND path in config array.

18 unit tests covering all acceptance criteria (helper functions, install, idempotency, key preservation, binary_path=None error, placeholder replacement, uninstall removal + preservation of other entries, uninstall idempotency, is_installed edge cases).

### Task 2: Mark opencode available + update stub test (commit 3e13756)

- `IntegrationSlug::is_available()`: `Self::Opencode => true` (was `false`)
- Removed `opencode_stub_returns_err` test, replaced with `opencode_integration_requires_binary_path` that validates the real implementation behavior

## Verification Results

| Check | Result |
|-------|--------|
| `cargo test integrations::opencode` | 18/18 passed |
| `cargo test integrations::tests` | 6/6 passed |
| `cargo test --bin plan-reviewer` (full unit suite) | 56/56 passed |
| `cargo clippy -- -D warnings` | 0 warnings |
| `cargo fmt --check` | clean |
| `grep 'include_str!'` | found — `include_str!("opencode_plugin.mjs")` |
| `grep 'Self::Opencode => true'` | found |
| `grep '__PLAN_REVIEWER_BIN__'` | found — exactly one occurrence (const declaration) |
| `grep 'submit_plan'` | found in plugin file |
| `grep 'execFileSync'` | found (NOT spawn with piped stdin) |
| `grep '\-\-plan-file'` | found in plugin file |
| `grep 'refusing to overwrite'` | found in opencode.rs |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Note on Worktree State

The worktree was initialized from commit `91f44cb` (before Phase 05-06 work). It was reset to the correct base commit `0ab0513` at execution start, which included all Phase 05-06 changes (Integration trait refactor, Gemini implementation, integration test harness). No logic changes were needed.

## Known Stubs

None. OpenCodeIntegration is fully implemented. The only remaining item for Phase 07 is Plan 02 (opencode hook flow — `run_opencode_flow()` invoked via `--plan-file` argument).

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| T-07-01 mitigated | src/integrations/opencode.rs | Refuses to overwrite corrupted opencode.json (returns Err with "refusing to overwrite") |
| T-07-04 mitigated | src/integrations/opencode_plugin.mjs | execFileSync timeout set to 600000ms |
| T-07-05 mitigated | src/integrations/opencode.rs | Plugin path computed from HOME + hardcoded relative path; no user-supplied path fragments |

No new threat surface beyond the plan's threat model.

## Self-Check: PASSED

### Files Created/Modified

- [x] `src/integrations/opencode_plugin.mjs` — FOUND (JS plugin with submit_plan tool)
- [x] `src/integrations/opencode.rs` — FOUND (full implementation replacing stub)
- [x] `src/integrations/mod.rs` — FOUND (opencode marked available, test updated)

### Commits

- [x] `48b2825` — FOUND (Task 1: OpenCodeIntegration + JS plugin)
- [x] `3e13756` — FOUND (Task 2: mark opencode available, update stub test)
