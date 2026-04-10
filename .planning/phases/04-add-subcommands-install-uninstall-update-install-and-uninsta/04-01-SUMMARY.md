---
phase: 04-add-subcommands-install-uninstall-update-install-and-uninsta
plan: 01
subsystem: dependencies-and-integration-abstraction
tags: [cargo, self_update, dialoguer, integration, install]
requires: []
provides: [integration-abstraction, tar-gz-archive-format, self_update-dependency]
affects: [src/install.rs, src/main.rs]
tech_stack:
  added:
    - self_update 0.44 (with archive-tar, compression-flate2, reqwest, rustls features)
    - dialoguer 0.12
  patterns:
    - IntegrationSlug enum for compile-time integration name safety
    - helper functions for Claude-specific settings path, hook entry, idempotency check
key_files:
  created:
    - src/integration.rs
  modified:
    - Cargo.toml
    - install.sh
    - Cargo.lock
decisions:
  - Added reqwest feature to self_update dep (required HTTP backend missing from plan spec)
  - Kept integration.rs unwired from main.rs (Plan 02 wires it per plan instructions)
metrics:
  duration: "5 minutes"
  completed: "2026-04-10"
  tasks: 2
  files: 4
---

# Phase 04 Plan 01: Foundation Dependencies and Integration Abstraction Summary

**One-liner:** Added self_update + dialoguer crates, fixed archive format from .tar.xz to .tar.gz, and created the Integration type system with full Claude support and documented unsupported stubs for opencode/codestral.

## What Was Built

### Task 1: Add dependencies and fix archive format

**Cargo.toml changes:**
- Added `self_update = { version = "0.44", default-features = false, features = ["archive-tar", "compression-flate2", "reqwest", "rustls"] }` — the HTTP update client used by Plan 03
- Added `dialoguer = "0.12"` — the TUI multi-select picker used by Plan 02
- Added `unix-archive = ".tar.gz"` to `[workspace.metadata.dist]` — changes cargo-dist's default from `.tar.xz` to `.tar.gz`, required because self_update only supports gzip compression

**install.sh changes:**
- `ARCHIVE_NAME` now uses `.tar.gz` extension (line 52)
- Extraction uses `tar -xzf` (gzip) instead of `tar -xJf` (xz) (line 62)
- Hook wiring line passes explicit `claude` argument: `"${INSTALL_DIR}/${BINARY}" install claude` (line 90) — required because install.sh runs in a non-TTY piped context per D-07/D-08

### Task 2: Create integration abstraction module

**src/integration.rs** provides:
- `IntegrationSlug` enum: `Claude`, `Opencode`, `Codestral` with `as_str()`, `from_str()` (case-insensitive), `all()`, and `Display`
- `Integration` struct: `slug`, `display_name`, `supported: bool`, `unsupported_reason: Option<&'static str>`
- `get_integration(slug)` and `all_integrations()` for getting definitions
- `claude_settings_path(home)` — returns `{home}/.claude/settings.json`
- `claude_hook_entry(binary_path)` — returns the ExitPlanMode JSON hook entry
- `claude_is_installed(settings)` — idempotency check scanning for `"matcher": "ExitPlanMode"`
- Unit tests covering slug round-trip, display, path construction, hook entry JSON, idempotency detection

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Add deps + fix archive format | 35dbc95 | Cargo.toml, install.sh |
| Task 2: Create integration.rs + reqwest fix | efb3d4f | src/integration.rs, Cargo.toml, Cargo.lock |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing `reqwest` feature to self_update dependency**
- **Found during:** Task 2 (cargo check after adding self_update)
- **Issue:** `self_update 0.44` with `default-features = false` requires an explicit HTTP backend feature (`reqwest` or `ureq`). The plan spec listed `features = ["archive-tar", "compression-flate2", "rustls"]` but omitted `reqwest`. Without it, `self_update`'s `http_client` module exports nothing and 25 compilation errors occur (`cannot find function 'get' in module 'http_client'`, `type annotations needed`).
- **Fix:** Added `"reqwest"` to the feature list: `features = ["archive-tar", "compression-flate2", "reqwest", "rustls"]`
- **Files modified:** Cargo.toml
- **Commit:** efb3d4f

## Known Stubs

- `opencode` integration: `supported: false` stub with reason "OpenCode does not have a plan approval hook in its config format." Per RESEARCH.md finding D-04, opencode's hook mechanism is TypeScript plugin-based with no JSON config hook for plan approval. The slug is defined per D-03; full implementation deferred to a future phase or release.
- `codestral` integration: `supported: false` stub with reason "Codestral is a model, not a coding agent with hook infrastructure." Per RESEARCH.md finding A1, no standalone coding agent named "codestral" with a settings.json hook system was identified. The slug is defined per D-03.

These stubs do NOT prevent Plan 01's goal (foundation dependencies + integration type system) from being achieved. Plans 02 and 03 consume the Claude integration path only.

## Self-Check: PASSED

- [x] `src/integration.rs` exists: FOUND
- [x] `Cargo.toml` contains `self_update`, `dialoguer`, `unix-archive = ".tar.gz"`: FOUND
- [x] `install.sh` contains `.tar.gz`, `tar -xzf`, `install claude`: FOUND
- [x] Commit 35dbc95 exists: FOUND
- [x] Commit efb3d4f exists: FOUND
- [x] `cargo check` passes with no errors: VERIFIED
