---
phase: 03-distribution
plan: "02"
subsystem: distribution
tags: [clap, subcommands, install, settings-json, hook-wiring]
dependency_graph:
  requires:
    - 03-01 (binary rename in Cargo.toml, install.sh structure)
  provides:
    - plan-reviewer install subcommand
    - src/install.rs — idempotent ExitPlanMode hook wiring
  affects:
    - src/main.rs (clap subcommand dispatch)
    - src/install.rs (new file)
tech_stack:
  added: []
  patterns:
    - Option<Commands> dispatch: None -> hook flow, Some(Install) -> install logic
    - stdin read deferred inside run_hook_flow() — Pitfall 5 prevention
    - entry().or_insert_with() for safe serde_json nested key creation
    - std::process::exit(1) for fatal errors — no panics visible to user
key_files:
  created:
    - src/install.rs
  modified:
    - src/main.rs
decisions:
  - "No new Cargo.toml dependencies for install subcommand — std::fs, std::env, and serde_json (already present) are sufficient"
  - "Idempotency check on matcher == ExitPlanMode only (not binary path) — avoids overwriting custom user setups"
  - "run_hook_flow() extracts all hook logic; stdin read only happens inside this path — Pitfall 5 fully mitigated"
  - "install output to println! (stdout) — correct for CLI subcommand; hook stdout discipline applies only to hook flow"
metrics:
  duration: "~3 minutes"
  completed_date: "2026-04-10"
  tasks_completed: 2
  files_changed: 2
---

# Phase 3 Plan 2: Clap Subcommands and Install Hook Wiring Summary

**One-liner:** Refactored main.rs to dispatch via `Option<Commands>` (stdin read deferred to hook path), added `src/install.rs` implementing idempotent ExitPlanMode hook wiring into `~/.claude/settings.json` using `entry().or_insert_with()` for safe nested JSON key creation.

## What Was Built

### Task 1: Refactor src/main.rs — clap subcommand dispatch

**src/main.rs changes:**
- Replaced `use clap::Parser` with `use clap::{Parser, Subcommand}`
- Replaced `struct Args` with `struct Cli` + `enum Commands { Install }`
- Added `command: Option<Commands>` field to `Cli`
- Added `mod install;` at top of file
- Extracted all hook logic into `fn run_hook_flow(no_browser: bool)` — stdin read only happens here
- `fn main()` now parses CLI args first, then branches: `Some(Commands::Install)` calls `install::run_install()`, `None` calls `run_hook_flow()`
- `async_main` signature changed from `(args: Args, ...)` to `(no_browser: bool, ...)` — uses `no_browser` directly

**Pitfall 5 mitigation:** `Cli::parse()` runs before any stdin read. `plan-reviewer install` never reaches `run_hook_flow()` and therefore never blocks on stdin.

Commit: `50c28e2`

### Task 2: Create src/install.rs — idempotent ExitPlanMode hook wiring

**`src/install.rs` — `pub fn run_install()`:**
- Resolves binary path via `std::env::current_exe()` (written into settings.json as the hook command)
- Resolves HOME via `std::env::var("HOME")` with clear error and `exit(1)` if unset
- Reads `~/.claude/settings.json` if it exists; falls back to `json!({})` with warning if file is malformed
- Uses `entry("hooks").or_insert_with(|| json!({}))` to safely create the hooks key if absent
- Uses `entry("PermissionRequest").or_insert_with(|| json!([]))` to safely create the array if absent
- Idempotency check: scans `PermissionRequest` array for any entry with `matcher == "ExitPlanMode"` — prints "already configured" and returns early if found
- Inserts the full hook entry if not found, then writes back with `serde_json::to_string_pretty`
- Creates `~/.claude/` directory if it doesn't exist via `fs::create_dir_all`
- All user-facing output via `println!` (stdout); error paths via `eprintln!` then `exit(1)` — no panics

Commit: `0efd2c7`

## Deviations from Plan

None — plan executed exactly as written. Both tasks implemented precisely per the plan's `<action>` specifications. The `entry().or_insert_with()` pattern was used as specified (avoiding the index operator pitfall documented in RESEARCH.md Open Question 2).

## Known Stubs

None — all logic is fully wired. The `run_install()` function writes the actual binary path (`current_exe()`) into settings.json; there are no hardcoded placeholders.

## Threat Flags

No new threat surface beyond what the plan's threat model covers. T-03-08 through T-03-12 are fully addressed:
- T-03-08 (Tampering — settings.json): serde_json round-trip preserves semantics; formatting change is documented
- T-03-09 (DoS — stdin hang): fully mitigated by Cli::parse() before any stdin read
- T-03-10 (EoP — writes settings.json): scoped to user home directory only
- T-03-11 (Tampering — malformed JSON): fallback to empty object with visible warning
- T-03-12 (Info Disclosure — binary path in settings.json): local config only, no network

## Self-Check: PASSED

Checked files exist:
- `src/main.rs` — modified, contains `Option<Commands>`, `Some(Commands::Install)`, `run_hook_flow`, `mod install`
- `src/install.rs` — created, contains `pub fn run_install`, `ExitPlanMode`, `already_present`, `entry().or_insert_with()`

Checked commits exist:
- `50c28e2` — feat(03-02): refactor main.rs (src/main.rs only, 1 file changed)
- `0efd2c7` — feat(03-02): implement install.rs (src/install.rs only, 1 file created)

Build verification: `cargo build --bin plan-reviewer` — Finished with 2 dead-code warnings (pre-existing, not introduced by this plan)
Test verification: `cargo test` — 4 passed, 0 failed
