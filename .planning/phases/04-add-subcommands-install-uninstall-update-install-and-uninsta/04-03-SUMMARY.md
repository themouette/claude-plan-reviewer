---
phase: 04-add-subcommands-install-uninstall-update-install-and-uninsta
plan: 03
subsystem: update-subcommand
tags: [self_update, github-releases, cli, update, binary-replacement]
requires: [self_update-dependency, install-subcommand-refactored]
provides: [update-subcommand]
affects: [src/update.rs, src/main.rs]
tech_stack:
  added: []
  patterns:
    - self_update::backends::github::Update::configure() builder for in-place binary replacement
    - cargo_crate_version! macro for compile-time version embedding
    - Full Rust target triples in current_platform() matching cargo-dist asset names
    - sanitize_version() guard filtering network version strings before terminal output
key_files:
  created:
    - src/update.rs
  modified:
    - src/main.rs
decisions:
  - "update.rs uses process::exit(1) on error instead of Result propagation: simpler for a CLI command with no caller to handle errors"
  - "sanitize_version applied to network-sourced version strings before any println: mitigates T-04-07 terminal injection"
  - "current_platform() returns full Rust triples not short names: matches cargo-dist asset filename convention (aarch64-apple-darwin not macos-aarch64)"
  - "clear_update_cache is defensive no-op if file absent: cache file may not exist yet (background check deferred)"
metrics:
  duration: "2m 57s"
  completed: "2026-04-10"
  tasks: 2
  files: 2
---

# Phase 04 Plan 03: Update Subcommand Summary

**One-liner:** Added `plan-reviewer update` subcommand using self_update crate with GitHub releases backend, progress bar, confirmation prompt, --check/--version/-y flags, permission error handling, and version string sanitization.

## What Was Built

### Task 1: Create update.rs with self-update logic

**src/update.rs** provides:
- `pub fn run_update(check_only: bool, target_version: Option<String>, skip_confirm: bool)` — main entry point dispatching to check_and_display or perform_update
- `check_and_display()` — prints current version, fetches latest from GitHub, prints changelog URL as `https://github.com/themouette/claude-plan-reviewer/releases/tag/v{version}`, or prints "already latest" (D-10)
- `perform_update(target_version, skip_confirm)` — normalizes version (strips 'v' prefix, treats "latest" as None), checks if already current, downloads with `self_update::backends::github::Update::configure()` builder, shows progress bar, handles confirmation prompt via `.no_confirm(skip_confirm)` (D-09, D-11)
- `current_platform()` — returns Rust target triples: `aarch64-apple-darwin`, `x86_64-apple-darwin`, `aarch64-unknown-linux-musl`, `x86_64-unknown-linux-musl` matching cargo-dist asset names (Pitfall 2 mitigation)
- `get_latest_version()` — fetches latest release from GitHub API via ReleaseList; returns None on network failure (graceful degradation)
- `clear_update_cache()` — removes `~/.plan-reviewer/update-check.json` after successful update (D-12); no-op if file absent
- `sanitize_version()` — filters version strings from network to alphanumeric + `.` + `-` + `+` only before any terminal output (T-04-07 mitigation)
- Permission denied / EACCES errors print "sudo plan-reviewer update" message and exit(1) (T-04-08, Pitfall 5)

**Constants:**
- `REPO_OWNER = "themouette"`
- `REPO_NAME = "claude-plan-reviewer"`
- `BIN_NAME = "plan-reviewer"`

### Task 2: Wire Update subcommand into main.rs CLI

**src/main.rs changes:**
- Added `mod update;` declaration (after existing mod declarations)
- Added `Commands::Update { check: bool, version: Option<String>, yes: bool }` variant with `--check`, `--version <VERSION>`, `-y`/`--yes` flags and appropriate doc comments
- Added match arm dispatching `update::run_update(*check, version.clone(), *yes)`
- `cargo build` compiles cleanly
- `plan-reviewer --help` lists install, uninstall, and update
- `plan-reviewer update --help` shows all three flags

## Verification Results

```
$ cargo run -- --help | grep -E 'install|uninstall|update'
  install    Wire the ExitPlanMode hook into one or more integrations (default: interactive picker)
  uninstall  Remove the ExitPlanMode hook from one or more integrations
  update     Update plan-reviewer to the latest version from GitHub releases

$ cargo run -- update --help
Update plan-reviewer to the latest version from GitHub releases

Usage: plan-reviewer update [OPTIONS]

Options:
      --check              Only check for updates, don't download
      --version <VERSION>  Pin to a specific version tag (e.g., v0.2.0)
  -y, --yes                Skip confirmation prompt
  -h, --help               Print help
```

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Create update.rs with self-update logic | c8b107a | src/update.rs |
| Task 2: Wire Update subcommand into main.rs CLI | c4b07de | src/main.rs |

## Deviations from Plan

None — plan executed exactly as written.

The plan specified `get_latest_version()` as returning `Option<String>` with no `Result` wrapper, which was implemented as specified. The `perform_update` function uses `std::process::exit(1)` directly on errors (matching claude-vm's simplified pattern for a CLI command) rather than propagating a `Result` to a caller that doesn't exist.

## Known Stubs

None. The update subcommand is fully implemented. The version check cache file (`~/.plan-reviewer/update-check.json`) may not exist yet (background update check was deferred per CONTEXT.md), but `clear_update_cache()` handles this gracefully with a no-op `fs::remove_file` that ignores the error.

## Self-Check: PASSED

- [x] `src/update.rs` exists: FOUND
- [x] Contains `pub fn run_update`: FOUND
- [x] REPO_OWNER is "themouette": FOUND
- [x] REPO_NAME is "claude-plan-reviewer": FOUND
- [x] BIN_NAME is "plan-reviewer": FOUND
- [x] Rust target triples (aarch64-apple-darwin, x86_64-unknown-linux-musl): FOUND
- [x] `sanitize_version` applied to network version strings: FOUND
- [x] `clear_update_cache` removes ~/.plan-reviewer/update-check.json: FOUND
- [x] Permission denied message includes "sudo plan-reviewer update": FOUND
- [x] `src/main.rs` contains `mod update;`: FOUND
- [x] `src/main.rs` contains `Commands::Update`: FOUND
- [x] `src/main.rs` contains `update::run_update`: FOUND
- [x] Commit c8b107a exists: FOUND
- [x] Commit c4b07de exists: FOUND
- [x] `cargo build` passes: VERIFIED
- [x] `cargo run -- --help` lists update: VERIFIED
- [x] `cargo run -- update --help` shows --check, --version, -y/--yes: VERIFIED
