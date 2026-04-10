# Phase 4: Subcommands (install, uninstall, update) - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend `plan-reviewer` with `install`, `uninstall`, and `update` subcommands. Default behavior (no subcommand) remains the hook review flow — existing hook configs keep working without changes. `install` and `uninstall` accept an explicit list of integration names or launch an interactive TUI picker when no names are given; both are idempotent. `update` self-updates the binary in-place from GitHub releases.

</domain>

<decisions>
## Implementation Decisions

### CLI Structure
- **D-01:** No `review` subcommand is added. Default (no subcommand) = hook review flow, reading stdin JSON and writing decision to stdout. This is unchanged from Phase 3. The STATE.md roadmap evolution note suggesting a `review` subcommand was exploratory — D-05 from Phase 3 context stands.
- **D-02:** `install` and `uninstall` each accept zero or more integration names as positional arguments: `plan-reviewer install claude opencode`. When zero names are given, a TUI picker launches.

### Integration Targets (Phase 4)
- **D-03:** Three integrations are supported: `claude` (Claude Code), `opencode`, `codestral`. Each integration maps to: a slug (CLI argument name), a display name, a settings file path, and the hook entry JSON format for that tool.
- **D-04:** The researcher must determine the settings file paths and hook entry formats for `opencode` and `codestral`. `claude` is already implemented in `src/install.rs` (`~/.claude/settings.json`, ExitPlanMode hook under `hooks.PermissionRequest`).
- **D-05:** `install` and `uninstall` are idempotent per integration: re-running install when the hook already exists is a no-op (prints status), re-running uninstall when the hook is absent is a no-op.

### Interactive Selector
- **D-06:** When no integration names are given, show a TUI multi-select picker (dialoguer or crossterm-based). The user can select any combination of the three integrations. Confirmed selections proceed to install/uninstall.
- **D-07:** Non-interactive / non-TTY invocations (e.g., `install.sh` calling `plan-reviewer install claude`) always pass explicit integration names — the TUI picker is never triggered from scripts.
- **D-08:** If stdin is not a TTY and no integration names are given, the binary should error out with a clear message: "No integrations specified. Run interactively or pass integration names: plan-reviewer install claude opencode codestral"

### Update Command
- **D-09:** `plan-reviewer update` mirrors claude-vm's update command exactly: `self_update` crate with GitHub releases backend, progress bar during download, confirmation prompt before replacing binary (skippable with `--yes` / `-y`), in-place binary replacement.
- **D-10:** `plan-reviewer update --check` performs a version-check-only pass: prints current version, fetches latest from GitHub releases, reports whether an update is available with a changelog link. No download.
- **D-11:** `plan-reviewer update --version v0.2.0` pins to a specific release tag. Same as claude-vm's `target_version` path.
- **D-12:** After a successful update, clear the version check cache (same as claude-vm's `update_check::clear_cache()`).
- **D-13:** The binary path in installed hook configs does NOT need updating after `plan-reviewer update` — self_update replaces the binary in-place at the same path, so existing hook configs remain valid.

### Claude's Discretion
- Exact crate version for dialoguer / crossterm (use latest stable)
- How to display already-installed status in the TUI picker (e.g., checkmark prefix)
- Output formatting for `install` / `uninstall` success/error messages
- Whether `update` shows a version notification on other commands (background check cadence)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase context and prior decisions
- `.planning/ROADMAP.md` §Phase 4 — Goal, scope, and "Depends on: Phase 3"
- `.planning/phases/03-distribution/03-CONTEXT.md` — D-05 (no review subcommand), D-07 (Phase 3 ships install for Claude Code, Phase 4 extends), D-08 (idempotent install logic), D-09 (install.sh calls plan-reviewer install)

### Existing implementation to extend
- `src/install.rs` — Current `run_install()` function (Claude Code only, hardcoded to `~/.claude/settings.json`); Phase 4 refactors this into an integration-aware abstraction
- `src/main.rs` — Current `Commands` enum with `Install` variant; Phase 4 adds `Uninstall` and `Update` variants

### Update pattern reference
- `~/Projects/themouette/claude-vm/src/commands/update.rs` — Reference implementation: `self_update` crate usage, `--check`, `--version`, progress bar, skip_confirm flag, cache clear
- `~/Projects/themouette/claude-vm/src/update_check.rs` — Background version check and notification pattern (optional: add to plan-reviewer for startup notifications)

### Requirements
- `.planning/REQUIREMENTS.md` — No new v1 requirements defined for Phase 4 yet (TBD in roadmap); researcher should note any requirements that emerge from integration support

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/install.rs` `run_install()` — idempotency check pattern (`already_present` scan), JSON read-modify-write, `settings_path` construction from HOME; refactor into `Integration` trait or struct with `install()` / `uninstall()` methods
- `src/main.rs` `Commands` enum — already uses clap `Subcommand` derive; add `Uninstall` and `Update` variants here

### Established Patterns
- No tokio async needed for `install`/`uninstall`/`update` — these are synchronous operations (same as current `run_install()`)
- stderr for diagnostics, stdout for user-facing install success messages (already established in `run_install()`)
- `std::env::var("HOME")` for home dir (no additional crates needed)
- GPG key signing is in play for git commits; no bearing on binary self-update (self_update handles that independently)

### Integration Points
- `src/main.rs` `main()` match arm: add `Some(Commands::Uninstall { integrations })` and `Some(Commands::Update { ... })` alongside existing `Some(Commands::Install)`
- `install.sh` (cargo-dist generated): already calls `plan-reviewer install` post-download; Phase 4's multi-integration install remains backward compatible (calling `plan-reviewer install` with no args triggers TUI or defaults to claude-only in non-TTY)

</code_context>

<specifics>
## Specific Ideas

- "everything like claude-vm" for update — use `~/Projects/themouette/claude-vm/src/commands/update.rs` as the direct implementation reference, not just inspiration
- Integration names are lowercase slugs matching what the user types: `claude`, `opencode`, `codestral`
- `install.sh` already calls `plan-reviewer install` without arguments (Phase 3 D-09); Phase 4 must handle this gracefully in non-TTY mode — either default to `claude` only or error with clear message (D-08 above)

</specifics>

<deferred>
## Deferred Ideas

- Background update check / startup notification (optional — include only if it doesn't add binary size or async complexity)
- Additional integrations beyond claude/opencode/codestral — future phase
- `plan-reviewer list-integrations` to show installed status — future phase
- Full Apple notarization (DIST-06) — v2
- `cargo install` / crates.io distribution (DIST-05) — v2

</deferred>

---

*Phase: 04-add-subcommands-install-uninstall-update*
*Context gathered: 2026-04-10*
