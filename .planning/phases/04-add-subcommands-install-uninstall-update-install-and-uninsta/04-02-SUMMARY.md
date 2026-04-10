---
phase: 04-add-subcommands-install-uninstall-update-install-and-uninsta
plan: 02
subsystem: install-uninstall-subcommands
tags: [install, uninstall, integration, dialoguer, tui, cli]
requires: [integration-abstraction]
provides: [install-subcommand-refactored, uninstall-subcommand, tui-picker]
affects: [src/install.rs, src/integration.rs, src/uninstall.rs, src/main.rs]
tech_stack:
  added: []
  patterns:
    - resolve_integrations shared helper for TTY check + picker dispatch (D-08)
    - dialoguer MultiSelect rendered on stderr to keep stdout clean
    - uninstall matches on "matcher" key not binary path (Pitfall 4 mitigation)
key_files:
  created:
    - src/uninstall.rs
  modified:
    - src/install.rs
    - src/integration.rs
    - src/main.rs
decisions:
  - resolve_integrations and show_integration_picker placed in integration.rs so both install.rs and uninstall.rs share them without a new module
  - interact_on_opt(&Term::stderr()) used so picker renders on stderr, keeping stdout clean for hook protocol
  - Unsupported integrations (opencode, codestral) print message and continue — no exit(1), consistent with iterating multiple slugs
metrics:
  duration: "10 minutes"
  completed: "2026-04-10"
  tasks: 2
  files: 4
---

# Phase 04 Plan 02: Install/Uninstall Subcommands Summary

**One-liner:** Refactored install to use the integration abstraction, added shared TUI picker + TTY check in integration.rs, and created uninstall subcommand — both wired into main.rs CLI.

## What Was Built

### Task 1: Refactor install.rs, extend integration.rs, create uninstall.rs

**src/integration.rs additions:**
- `resolve_integrations(given: &[String], prompt: &str) -> Vec<IntegrationSlug>` — shared helper used by both install and uninstall. Validates slugs against allowlist (T-04-03), checks `std::io::stdin().is_terminal()` before launching picker (T-04-05, D-08), exits(1) with D-08 message in non-TTY with no args.
- `show_integration_picker(prompt: &str) -> Vec<IntegrationSlug>` — `dialoguer::MultiSelect` on `Term::stderr()`. Pre-checks Claude installation status to set defaults. Exits(0) if user cancels/selects nothing.
- Added `use std::io::IsTerminal;`

**src/install.rs refactor:**
- `run_install(integrations: Vec<String>)` replaces zero-arg `run_install()`
- Calls `integration::resolve_integrations()` for slug resolution
- Iterates slugs: unsupported ones print message + continue, Claude calls `install_claude()`
- `install_claude()` extracted from prior implementation, now uses `integration::claude_settings_path()`, `integration::claude_is_installed()`, `integration::claude_hook_entry()` helpers

**src/uninstall.rs (new):**
- `run_uninstall(integrations: Vec<String>)` — mirrors install structure exactly
- `uninstall_claude()` — reads settings JSON, checks idempotency via `claude_is_installed()`, removes all entries where `"matcher": "ExitPlanMode"` (T-04-04 mitigation, Pitfall 4), writes back with `to_string_pretty`
- No-op when settings file absent or hook not present (D-05 idempotency)

### Task 2: Wire into main.rs CLI

**src/main.rs changes:**
- Added `mod integration;` and `mod uninstall;` declarations
- `Commands::Install` now `Install { integrations: Vec<String> }` — clap treats as zero-or-more positional args
- `Commands::Uninstall { integrations: Vec<String> }` new variant
- match arms dispatch `install::run_install(integrations.clone())` and `uninstall::run_uninstall(integrations.clone())`
- `cargo build` succeeds cleanly

## Verification Results

```
$ echo "" | cargo run -- install
No integrations specified. Run interactively or pass integration names: plan-reviewer install claude opencode codestral
Exit code: 1

$ cargo run -- install --help
Wire the ExitPlanMode hook into one or more integrations (default: interactive picker)
Usage: plan-reviewer install [INTEGRATIONS]...

$ cargo run -- uninstall --help
Remove the ExitPlanMode hook from one or more integrations
Usage: plan-reviewer uninstall [INTEGRATIONS]...
```

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Refactor install.rs + integration.rs + create uninstall.rs | 5d4d9c4 | src/install.rs, src/integration.rs, src/uninstall.rs |
| Task 2: Wire CLI in main.rs | e1d7706 | src/main.rs |

## Deviations from Plan

None - plan executed exactly as written.

The `resolve_integrations` and `show_integration_picker` functions were placed in `integration.rs` exactly as specified by the plan's action section. The `if let Some(parent)` pattern in `install_claude` was written as a two-statement `if` block instead of the `&&`-chained let guard used in the original code — this is a stylistic equivalent required because the old syntax was Rust nightly feature at the time; both compile on stable.

## Known Stubs

- `opencode` integration: `supported: false` — unsupported message printed, no file modified. Deferred per RESEARCH.md finding (no JSON config hook for plan approval).
- `codestral` integration: `supported: false` — same treatment. Deferred per RESEARCH.md finding (Codestral is a model, not a coding agent).

These stubs do NOT prevent Plan 02's goal from being achieved. The Claude integration path is fully functional.

## Self-Check: PASSED

- [x] `src/install.rs` exists and contains `pub fn run_install` with `Vec<String>`: FOUND
- [x] `src/uninstall.rs` exists and contains `pub fn run_uninstall`: FOUND
- [x] `src/integration.rs` contains `resolve_integrations` and `MultiSelect`: FOUND
- [x] `src/main.rs` contains `mod integration`, `mod uninstall`, `Commands::Uninstall`: FOUND
- [x] Commit 5d4d9c4 exists: FOUND
- [x] Commit e1d7706 exists: FOUND
- [x] `cargo build` passes: VERIFIED
- [x] Non-TTY with no args exits 1 with D-08 message: VERIFIED
