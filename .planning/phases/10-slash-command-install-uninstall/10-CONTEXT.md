# Phase 10: Slash Command Install/Uninstall - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend `plan-reviewer install claude` to create `commands/annotate.md` in the plugin directory it already owns, making `/annotate` discoverable in Claude Code's slash command menu. Extend `plan-reviewer uninstall claude` to remove the `commands/` directory (already covered by the existing `remove_dir_all` on the plugin dir). The prompt logic inside `annotate.md` is Phase 11's scope — Phase 10 creates a minimal stub.

</domain>

<decisions>
## Implementation Decisions

### Idempotency Refactor
- **D-01:** Split the early-return check from the file-write logic. Always write plugin files (`plugin.json`, `marketplace.json`, `hooks.json`, `commands/annotate.md`) regardless of current install state. Only skip `settings.json` mutations (`extraKnownMarketplaces` and `enabledPlugins` entries) if they are already present.
- **D-02:** This ensures existing users who already have plan-reviewer installed get `commands/annotate.md` when they re-run `plan-reviewer install claude` — without creating duplicate settings.json entries.

### commands/annotate.md Content
- **D-03:** Write this exact content to `commands/annotate.md`:
  ```
  # Annotate

  Opens the plan-reviewer browser UI to review a file.

  $ARGUMENTS
  ```
  Minimal — enough for Claude Code to register the command. Phase 11 replaces the body with full prompt logic.

### Uninstall Scope
- **D-04:** No change to `uninstall()`. The existing `remove_dir_all(plugin_dir)` already removes `commands/` as part of the whole plugin directory. Adding a new subdirectory costs nothing on the uninstall side.

### Test Coverage
- **D-05:** Both unit tests AND integration tests:
  - Unit tests in `src/integrations/claude.rs` — verify `install()` creates `commands/annotate.md` with the expected content; verify re-install (idempotency) still creates the file even when already installed; verify `uninstall()` removes it.
  - Integration tests in `tests/integration/install_uninstall.rs` — end-to-end via `assert_cmd` with tmpdir HOME isolation, as required by PLGN-01–03 success criteria.

### Claude's Discretion
- Exact placement of the `commands/` write step within `install()` (before or after `hooks/hooks.json`)
- Whether `commands/annotate.md` is overwritten on every install or only created if missing
- Internal helper function naming

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §PLGN-01, PLGN-02, PLGN-03 — success criteria for install/uninstall/discoverability

### Existing implementation to extend
- `src/integrations/claude.rs` — Full `ClaudeIntegration` implementation; `install()` idempotency check at line ~175 is the primary change target; `claude_plugin_dir()` helper at line ~393 returns the plugin directory path
- `tests/integration/install_uninstall.rs` — Integration test file where new tests are added

### Phase 11 dependency
- `.planning/ROADMAP.md` §Phase 11 — The `annotate.md` prompt logic is Phase 11's scope; Phase 10 only creates the file infrastructure

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `claude_plugin_dir(home: &str) -> PathBuf` — Returns `{home}/.local/share/plan-reviewer/claude-plugin`; use to construct `commands/` path
- `plugin_is_registered(settings: &Value) -> bool` — Current idempotency check; after D-01, this moves to only guard the settings.json mutation step
- `std::fs::create_dir_all` + `std::fs::write` pattern — Used for every existing plugin file; follow same pattern for `commands/annotate.md`

### Established Patterns
- File write error: `return Err(format!("cannot write {}: {}", path.display(), e))`
- Success print: `println!("plan-reviewer: {}", message)` — follows existing output style
- Unit tests use `tempfile::TempDir` directly; integration tests use `tempfile::TempDir` via `env("HOME", home.path())`
- Tests assert file existence with `assert!(path.exists(), "...should be created")`
- Tests assert file content by reading + parsing

### Integration Points
- `ClaudeIntegration::install()` in `src/integrations/claude.rs` — primary change point; split idempotency, add commands/ write
- `tests/integration/install_uninstall.rs` — add new integration tests alongside existing ones

</code_context>

<specifics>
## Specific Ideas

- The `annotate.md` stub with `$ARGUMENTS` is the exact content decided; Phase 11 replaces only the body
- The idempotency refactor is scoped to `ClaudeIntegration` only — no changes to the `Integration` trait or dispatch logic

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-slash-command-install-uninstall*
*Context gathered: 2026-04-11*
