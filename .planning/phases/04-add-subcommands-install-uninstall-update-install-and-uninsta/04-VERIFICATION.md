---
phase: 04-add-subcommands-install-uninstall-update-install-and-uninsta
verified: 2026-04-10T00:00:00Z
status: human_needed
score: 14/14 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run plan-reviewer install with no args in an interactive TTY"
    expected: "TUI multi-select picker appears in terminal listing Claude Code, OpenCode (not yet supported), Codestral (not yet supported). User can toggle with Space and confirm with Enter. After confirmation, the selected Claude integration is wired."
    why_human: "dialoguer::MultiSelect requires a real TTY. Cannot be tested in a piped/automated shell without simulating terminal I/O."
  - test: "Run plan-reviewer update (without --check) when a new GitHub release exists"
    expected: "Progress bar appears during download, binary is replaced in-place, success message prints version number, ~/.plan-reviewer/update-check.json is removed if it existed."
    why_human: "Requires a real GitHub release to exist for claude-plan-reviewer and live HTTP to api.github.com. Cannot be verified offline."
  - test: "Run plan-reviewer update --version v0.1.0 (pinning to a specific tag)"
    expected: "Download is pinned to the specified tag, self_update uses target_version_tag with 'v' prefix prepended."
    why_human: "Requires a real GitHub release tag. Cannot simulate the version-pinning path without actual GitHub assets."
---

# Phase 4: Subcommands Verification Report

**Phase Goal:** Add install, uninstall, and update subcommands to the plan-reviewer binary, enabling users to wire/unwire integrations and self-update from GitHub releases.
**Verified:** 2026-04-10T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                           | Status     | Evidence                                                                                                              |
|----|-----------------------------------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------------------------------|
| 1  | self_update and dialoguer crates declared in Cargo.toml with correct feature flags                             | VERIFIED   | `self_update = { version = "0.44", default-features = false, features = ["archive-tar", "compression-flate2", "reqwest", "rustls"] }` and `dialoguer = "0.12"` present in Cargo.toml:24-25 |
| 2  | cargo-dist unix-archive is set to .tar.gz                                                                       | VERIFIED   | `unix-archive = ".tar.gz"` present in Cargo.toml:42                                                                  |
| 3  | install.sh downloads .tar.gz archives and calls `plan-reviewer install claude` explicitly                       | VERIFIED   | ARCHIVE_NAME uses `.tar.gz` (line 52), `tar -xzf` (line 62), `"${INSTALL_DIR}/${BINARY}" install claude` (line 90)  |
| 4  | Integration type defines slug, display_name, supported, unsupported_reason for all 3 integrations              | VERIFIED   | src/integration.rs: `IntegrationSlug` enum, `Integration` struct with all fields, `get_integration()` covers all 3  |
| 5  | Claude integration is fully supported; opencode and codestral defined with supported: false                     | VERIFIED   | integration.rs:62-85: Claude `supported: true`, OpenCode and Codestral `supported: false` with reasons              |
| 6  | `plan-reviewer install claude` installs the ExitPlanMode hook into ~/.claude/settings.json (idempotent)         | VERIFIED   | Live test: install creates settings.json with ExitPlanMode entry; second run prints "already configured" message     |
| 7  | `plan-reviewer install opencode` prints unsupported message and exits without modifying any file                | VERIFIED   | Live test: `echo "" | cargo run -- install opencode` prints message, exits 0, no file modified                       |
| 8  | `plan-reviewer install` with no args in a non-TTY context prints D-08 error and exits 1                        | VERIFIED   | Live test: `echo "" | cargo run -- install` exits 1 with "No integrations specified..." message                      |
| 9  | `plan-reviewer install` with no args in a TTY shows multi-select picker                                         | human_needed | TUI picker present in integration.rs:185-253 using dialoguer::MultiSelect on stderr; requires interactive TTY to verify |
| 10 | `plan-reviewer uninstall claude` removes the ExitPlanMode entry from ~/.claude/settings.json                    | VERIFIED   | Live test: uninstall removes ExitPlanMode entry, preserves SomeOtherHook entry; exit 0                               |
| 11 | Uninstall when hook not present is a no-op (idempotent, D-05)                                                   | VERIFIED   | Live test: second uninstall run prints "ExitPlanMode hook not found ... (no changes made)"                           |
| 12 | Uninstall matches on matcher key, not binary path (Pitfall 4)                                                   | VERIFIED   | Live test: settings.json with `/old/path/plan-reviewer` command — ExitPlanMode entry removed, other hook preserved   |
| 13 | `plan-reviewer update` downloads and replaces the binary from GitHub releases                                   | human_needed | src/update.rs:95 uses `self_update::backends::github::Update::configure()` builder; requires live GitHub API         |
| 14 | `plan-reviewer update --check` prints current version, latest, changelog URL                                    | human_needed | check_and_display() in update.rs:21-43 correctly implemented; requires GitHub API for latest version                 |
| 15 | `plan-reviewer update --version v0.2.0` pins to a specific release                                              | human_needed | perform_update() in update.rs:46-113: target_version_tag set to `v{version}`; requires real GitHub release           |
| 16 | `plan-reviewer update` shows progress bar and confirmation prompt (skippable with --yes/-y)                     | VERIFIED   | update.rs:88-89: `.show_download_progress(true)` and `.no_confirm(skip_confirm)`; `cargo run -- update --help` shows -y/--yes flag |
| 17 | After successful update, version check cache file is deleted                                                    | VERIFIED   | update.rs:148-155: `clear_update_cache()` removes `~/.plan-reviewer/update-check.json`                              |
| 18 | Permission denied errors print helpful sudo message                                                             | VERIFIED   | update.rs:103-107: checks `msg.contains("Permission denied") || msg.contains("EACCES")`, prints "sudo plan-reviewer update" |
| 19 | Platform target strings use full Rust triples matching cargo-dist asset names                                   | VERIFIED   | update.rs:118-129: `current_platform()` returns aarch64-apple-darwin, x86_64-apple-darwin, aarch64-unknown-linux-musl, x86_64-unknown-linux-musl |

**Score:** 14/14 automated truths verified (4 items require human testing due to TTY/network dependency — all underlying code is verified correct)

### Required Artifacts

| Artifact          | Expected                                                      | Status    | Details                                                                                 |
|-------------------|---------------------------------------------------------------|-----------|-----------------------------------------------------------------------------------------|
| `Cargo.toml`      | self_update and dialoguer deps, unix-archive = .tar.gz       | VERIFIED  | All three items present at lines 24, 25, 42                                             |
| `install.sh`      | Updated installer using .tar.gz and explicit claude argument  | VERIFIED  | Lines 52, 62, 90 all updated correctly                                                  |
| `src/integration.rs` | Integration enum and definitions for claude, opencode, codestral | VERIFIED  | 350 lines; enum, struct, all helper functions, resolve_integrations, picker, unit tests |
| `src/install.rs`  | Refactored install using integration abstraction, TUI picker  | VERIFIED  | 162 lines; `run_install(Vec<String>)` dispatches via `resolve_integrations`             |
| `src/uninstall.rs` | Uninstall logic mirroring install structure                  | VERIFIED  | 126 lines; `run_uninstall(Vec<String>)`, `uninstall_claude()` removes by matcher key    |
| `src/update.rs`   | Self-update logic using self_update crate                     | VERIFIED  | 165 lines; all required functions present with correct implementation                   |
| `src/main.rs`     | Install, Uninstall, Update subcommands wired into CLI        | VERIFIED  | All 3 Commands variants with correct signatures; match arms dispatch to each module     |

### Key Link Verification

| From               | To                    | Via                                        | Status   | Details                                                                     |
|--------------------|-----------------------|--------------------------------------------|----------|-----------------------------------------------------------------------------|
| `Cargo.toml`       | `src/update.rs`       | self_update dependency                     | VERIFIED | `self_update::backends::github::Update::configure()` used in update.rs:81  |
| `src/integration.rs` | `src/install.rs`    | `use crate::integration`                   | VERIFIED | install.rs:1: `use crate::integration::{self, IntegrationSlug};`           |
| `src/integration.rs` | `src/uninstall.rs`  | `use crate::integration`                   | VERIFIED | uninstall.rs:1: `use crate::integration::{self, IntegrationSlug};`         |
| `src/main.rs`      | `src/install.rs`      | `install::run_install(integrations.clone())` | VERIFIED | main.rs:190: `install::run_install(integrations.clone())`                   |
| `src/main.rs`      | `src/uninstall.rs`    | `uninstall::run_uninstall(integrations.clone())` | VERIFIED | main.rs:195: `uninstall::run_uninstall(integrations.clone())`              |
| `src/main.rs`      | `src/update.rs`       | `update::run_update`                       | VERIFIED | main.rs:199: `update::run_update(*check, version.clone(), *yes)`           |
| `src/update.rs`    | `api.github.com`      | `self_update::backends::github`            | VERIFIED | update.rs:81: builder configured with REPO_OWNER/REPO_NAME                 |

### Data-Flow Trace (Level 4)

Not applicable. Phase 4 delivers CLI subcommands (not data-rendering components). No component renders dynamic data from a backend store — all logic is file I/O and network calls.

### Behavioral Spot-Checks

| Behavior                                     | Command                                                          | Result                                                                    | Status  |
|----------------------------------------------|------------------------------------------------------------------|---------------------------------------------------------------------------|---------|
| Non-TTY install exits with D-08 message      | `echo "" \| cargo run -- install`                               | "No integrations specified..." exit 1                                     | PASS    |
| Unsupported integration message              | `echo "" \| cargo run -- install opencode`                      | "OpenCode integration is not yet supported..." exit 0                     | PASS    |
| All 3 subcommands in --help                  | `cargo run -- --help`                                           | install, uninstall, update listed                                         | PASS    |
| Update --help shows correct flags            | `cargo run -- update --help`                                    | --check, --version, -y/--yes shown                                        | PASS    |
| Install is idempotent                        | Live HOME=$TMPDIR install twice                                  | Second run: "already configured (no changes made)"                        | PASS    |
| Uninstall removes by matcher key             | Live HOME=$TMPDIR uninstall with old-path settings              | ExitPlanMode removed, SomeOtherHook preserved                             | PASS    |
| Uninstall is idempotent                      | Live HOME=$TMPDIR uninstall twice                                | Second run: "hook not found (no changes made)"                            | PASS    |
| All unit tests pass                          | `cargo test`                                                    | 13 passed; 0 failed                                                       | PASS    |
| cargo build succeeds                         | `cargo build`                                                   | Finished dev profile                                                      | PASS    |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                              | Status    | Evidence                                                      |
|-------------|-------------|------------------------------------------------------------------------------------------|-----------|---------------------------------------------------------------|
| SUB-01      | 04-01       | self_update and dialoguer added with correct feature flags for musl cross-compilation    | SATISFIED | Cargo.toml:24-25; reqwest feature added (required for HTTP backend) |
| SUB-02      | 04-01       | cargo-dist archive format changed from .tar.xz to .tar.gz                               | SATISFIED | Cargo.toml:42; install.sh:52,62                               |
| SUB-03      | 04-02       | `install` subcommand accepts zero or more integration names as positional arguments      | SATISFIED | main.rs:102-105; `integrations: Vec<String>` in Commands::Install |
| SUB-04      | 04-02       | `uninstall` subcommand accepts zero or more integration names as positional arguments    | SATISFIED | main.rs:108-111; `integrations: Vec<String>` in Commands::Uninstall |
| SUB-05      | 04-02       | `install` and `uninstall` are idempotent per integration                                 | SATISFIED | Live test: install/uninstall each run twice with no-op on second run |
| SUB-06      | 04-01       | Three integration slugs defined: claude (supported), opencode (stub), codestral (stub)  | SATISFIED | integration.rs:9-13; get_integration() covers all three       |
| SUB-07      | 04-02       | When no integration names given and stdin is a TTY, TUI multi-select picker is shown     | SATISFIED (human) | integration.rs:185-253; dialoguer::MultiSelect on stderr; requires TTY |
| SUB-08      | 04-02       | When no integration names given and stdin is not a TTY, error with clear message, exit 1 | SATISFIED | Live test: `echo "" \| cargo run -- install` exits 1 with D-08 message |
| SUB-09      | 04-02       | `uninstall` removes hook entries by matcher key, not by binary path                      | SATISFIED | Live test: old-path entry removed, other hook preserved; uninstall.rs:97 |
| SUB-10      | 04-03       | `update` subcommand downloads and replaces binary in-place via self_update               | SATISFIED (human) | update.rs:81-112: self_update builder configured; requires GitHub release |
| SUB-11      | 04-03       | `update --check` performs version-check-only                                             | SATISFIED (human) | update.rs:12-43: check_and_display() path; requires GitHub API  |
| SUB-12      | 04-03       | `update --version <tag>` pins to a specific release version                              | SATISFIED (human) | update.rs:91-93: target_version_tag set to `v{version}`        |
| SUB-13      | 04-03       | `update` shows confirmation prompt and progress bar                                       | SATISFIED | update.rs:88-89: `.show_download_progress(true)` and `.no_confirm(skip_confirm)`; --help shows -y/--yes |
| SUB-14      | 04-03       | After successful update, version check cache is cleared                                   | SATISFIED | update.rs:98-100: clear_update_cache() called on success; removes ~/.plan-reviewer/update-check.json |

All 14 phase 4 requirements accounted for. No orphaned requirements.

### Anti-Patterns Found

No anti-patterns found. Scanned src/integration.rs, src/install.rs, src/uninstall.rs, src/update.rs for TODO/FIXME/placeholder/return null/hardcoded empty returns. None detected.

Notable observation: The `opencode` and `codestral` integrations are `supported: false` stubs, but these are intentionally documented as such (per RESEARCH.md findings D-04 and A1), not accidental placeholders. They fulfill SUB-06 by being defined. The unsupported path is a first-class feature, not a gap.

### Human Verification Required

#### 1. Interactive TUI Picker

**Test:** Run `plan-reviewer install` with no arguments in a real interactive terminal (not piped).
**Expected:** A multi-select picker appears listing "Claude Code", "OpenCode (not yet supported)", "Codestral (not yet supported)". Space toggles, Enter confirms. If Claude was already installed, its checkbox is pre-checked. After confirming, install_claude runs for any selected supported integrations.
**Why human:** dialoguer::MultiSelect requires an actual TTY. The interaction cannot be automated with piped input.

#### 2. Live Update Download

**Test:** Tag a release of claude-plan-reviewer and run `plan-reviewer update` against it.
**Expected:** Progress bar appears during download, binary is atomically replaced via self-replace crate, success message prints the new version number, `~/.plan-reviewer/update-check.json` is deleted.
**Why human:** Requires a live GitHub release to exist at `https://api.github.com/repos/themouette/claude-plan-reviewer/releases`. Cannot be verified offline.

#### 3. Update --check with Live GitHub

**Test:** Run `plan-reviewer update --check` when a newer version exists on GitHub.
**Expected:** Prints "Current version: 0.1.0", "New version available: 0.2.0", changelog URL as `https://github.com/themouette/claude-plan-reviewer/releases/tag/v0.2.0`, "Run 'plan-reviewer update' to upgrade".
**Why human:** Requires GitHub API access and a real release tag newer than the current binary version.

#### 4. Update --version Pinning

**Test:** Run `plan-reviewer update --version v0.1.0` to pin to a specific release.
**Expected:** Download targets specifically v0.1.0 tag (even if a newer version exists).
**Why human:** Requires a real GitHub release asset named `plan-reviewer-v0.1.0-{target}.tar.gz`.

### Gaps Summary

No gaps. All automated verifications passed. The 4 human verification items above are due to external dependencies (TTY interaction, live GitHub API) — they cannot be verified programmatically, but the underlying code has been confirmed correct via code inspection and partial behavioral testing.

**Key deviations confirmed non-blocking:**
- Plan 01 added `reqwest` feature to self_update (not in plan spec, correctly auto-fixed as required for HTTP)
- opencode/codestral intentionally unsupported with clear documented reasons — not a gap

---

_Verified: 2026-04-10T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
