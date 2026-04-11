# Phase 10: Slash Command Install/Uninstall - Research

**Researched:** 2026-04-11
**Domain:** Claude Code plugin slash command registration (Rust filesystem, Claude Code plugin spec)
**Confidence:** HIGH

## Summary

Phase 10 extends the existing `ClaudeIntegration::install()` in `src/integrations/claude.rs` to write a `commands/annotate.md` stub file, and refactors the idempotency check so plugin files are always (re)written on install while settings.json mutations are guarded. The `uninstall()` function needs no changes — `remove_dir_all(plugin_dir)` already removes `commands/` along with the whole plugin directory.

Claude Code supports the `commands/` directory at the plugin root as a legacy-but-still-supported mechanism. Files placed there as `<name>.md` create slash commands namespaced as `/<plugin-name>:<name>`. Because the `plan-reviewer` plugin is named `"plan-reviewer"` in `plugin.json`, a file `commands/annotate.md` creates `/plan-reviewer:annotate`, NOT `/annotate`. This is confirmed by both official docs and the plannotator reference plugin installed locally.

The idempotency refactor (D-01) is the primary structural change. The current `install()` returns early at line 175 when `plugin_is_registered()` is true, skipping all file writes. After the refactor, file writes happen unconditionally in Step 1, and only the settings.json mutations (Steps 3-6) are guarded by `plugin_is_registered()`.

**Primary recommendation:** Write `commands/annotate.md` as the fourth file in Step 1 of `install()`, after `hooks/hooks.json`. Move the `plugin_is_registered()` early-return to guard only Steps 4-6 (settings mutation). Use `create_dir_all` + `write` exactly as all other plugin files are written.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Split the early-return check from the file-write logic. Always write plugin files (`plugin.json`, `marketplace.json`, `hooks.json`, `commands/annotate.md`) regardless of current install state. Only skip `settings.json` mutations (`extraKnownMarketplaces` and `enabledPlugins` entries) if they are already present.
- **D-02:** This ensures existing users who already have plan-reviewer installed get `commands/annotate.md` when they re-run `plan-reviewer install claude` — without creating duplicate settings.json entries.
- **D-03:** Write this exact content to `commands/annotate.md`:
  ```
  # Annotate

  Opens the plan-reviewer browser UI to review a file.

  $ARGUMENTS
  ```
  Minimal — enough for Claude Code to register the command. Phase 11 replaces the body with full prompt logic.
- **D-04:** No change to `uninstall()`. The existing `remove_dir_all(plugin_dir)` already removes `commands/` as part of the whole plugin directory. Adding a new subdirectory costs nothing on the uninstall side.
- **D-05:** Both unit tests AND integration tests:
  - Unit tests in `src/integrations/claude.rs` — verify `install()` creates `commands/annotate.md` with the expected content; verify re-install (idempotency) still creates the file even when already installed; verify `uninstall()` removes it.
  - Integration tests in `tests/integration/install_uninstall.rs` — end-to-end via `assert_cmd` with tmpdir HOME isolation, as required by PLGN-01–03 success criteria.

### Claude's Discretion
- Exact placement of the `commands/` write step within `install()` (before or after `hooks/hooks.json`)
- Whether `commands/annotate.md` is overwritten on every install or only created if missing
- Internal helper function naming

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLGN-01 | `plan-reviewer install claude` creates a `commands/annotate.md` file in the plugin directory alongside the existing hook | D-01/D-03: write `commands/annotate.md` in Step 1 of `install()`; verified against plugin directory spec |
| PLGN-02 | `plan-reviewer uninstall claude` removes the `commands/` directory | D-04: `remove_dir_all(plugin_dir)` already covers this; no code change needed |
| PLGN-03 | `/annotate` is discoverable in Claude Code's slash command menu after install | VERIFIED: `commands/<name>.md` at plugin root registers `/<plugin-name>:<name>` — actual command is `/plan-reviewer:annotate`, not `/annotate`; the REQUIREMENTS.md and CONTEXT.md both say "annotate" is the target |
</phase_requirements>

## Standard Stack

### Core (no new dependencies)
| What | Where | Why |
|------|-------|-----|
| `std::fs::create_dir_all` | Phase 10 implementation | Already used for `hooks/` creation — same pattern for `commands/` |
| `std::fs::write` | Phase 10 implementation | Already used for every plugin file — same pattern for `annotate.md` |
| `tempfile::TempDir` | Unit tests (already in `[dev-dependencies]`) | Used by all existing unit tests |
| `assert_cmd` | Integration tests (already in `[dev-dependencies]`) | Used by all existing integration tests |
| `predicates` | Integration tests (already in `[dev-dependencies]`) | Used alongside assert_cmd |

No new crate dependencies are required.

## Architecture Patterns

### Plugin Directory Layout (VERIFIED)

The plan-reviewer claude-plugin directory lives at:
```
{home}/.local/share/plan-reviewer/claude-plugin/
├── .claude-plugin/
│   ├── plugin.json           (written by install: Step 1a)
│   └── marketplace.json      (written by install: Step 1b)
├── hooks/
│   └── hooks.json            (written by install: Step 1c)
└── commands/                 (NEW in Phase 10)
    └── annotate.md           (written by install: Step 1d)
```

[VERIFIED: live inspection of `~/.local/share/plan-reviewer/claude-plugin/` and comparison with plannotator plugin structure at `~/.claude/plugins/cache/plannotator/plannotator/0.17.7/`]

### Critical Discovery: Command Namespace

[VERIFIED: code.claude.com/docs/en/plugins-reference and live plannotator plugin inspection]

The `commands/<name>.md` file in a plugin named `"plan-reviewer"` creates the slash command `/plan-reviewer:annotate`, NOT `/annotate`. This is the standard plugin namespacing behavior. The REQUIREMENTS.md says "User can invoke `/annotate`" (SLSH-01) — this is Phase 11's concern. Phase 10 only creates the file infrastructure (PLGN-01/02/03 say "discoverable in Claude Code's slash command menu"). The file at `commands/annotate.md` will create `/plan-reviewer:annotate` and that will be discoverable in the menu.

The CONTEXT.md decision D-03 specifies file path `commands/annotate.md` which is the correct path. The resulting slash command name is `/plan-reviewer:annotate`.

### Pattern 1: Idempotency Refactor (D-01)

**Current behavior (before D-01):**
```rust
// Step 3 (current): EARLY RETURN — skips ALL file writes when already registered
if plugin_is_registered(&root) {
    println!("plan-reviewer: plugin already configured ... (no changes made)");
    return Ok(());
}
```

**After D-01 refactor:**
```rust
// Step 1: Write plugin directory files — ALWAYS (unconditional)
// ... writes plugin.json, marketplace.json, hooks.json, commands/annotate.md ...

// Step 2: Read or create settings.json — always needed for check

// Step 3: Idempotency check — now guards ONLY settings mutation (Steps 4-6)
if plugin_is_registered(&root) {
    println!("plan-reviewer: plugin already configured in {} (no changes made)",
        settings_path.display());
    return Ok(());
}

// Steps 4-6: settings.json mutations (only reached if not yet registered)
```

### Pattern 2: Writing commands/annotate.md

**What:** Create `commands/` subdirectory and write `annotate.md` as the fourth file in Step 1.

**Example (following established file-write pattern):**
```rust
// Write commands/annotate.md
let commands_dir = plugin_dir.join("commands");
if let Err(e) = std::fs::create_dir_all(&commands_dir) {
    return Err(format!("cannot create {}: {}", commands_dir.display(), e));
}
let annotate_content = "# Annotate\n\nOpens the plan-reviewer browser UI to review a file.\n\n$ARGUMENTS\n";
let annotate_path = commands_dir.join("annotate.md");
if let Err(e) = std::fs::write(&annotate_path, annotate_content) {
    return Err(format!("cannot write {}: {}", annotate_path.display(), e));
}
println!(
    "plan-reviewer: annotate command written to {}",
    annotate_path.display()
);
```

[VERIFIED: pattern matches existing `hooks/` creation at lines 109-134 of `src/integrations/claude.rs`]

### Pattern 3: Unit Test Structure

**What:** Unit tests in `#[cfg(test)] mod tests` at the bottom of `src/integrations/claude.rs`, using `tempfile::TempDir`.

**Example (following install_creates_hooks_json_with_exit_plan_mode pattern):**
```rust
#[test]
fn install_creates_annotate_md_with_expected_content() {
    let dir = tempdir().unwrap();
    let home = dir.path().to_str().unwrap().to_string();
    let integration = ClaudeIntegration;
    let ctx = InstallContext {
        home: home.clone(),
        binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
    };

    integration.install(&ctx).unwrap();

    let annotate_path = dir
        .path()
        .join(".local/share/plan-reviewer/claude-plugin/commands/annotate.md");
    assert!(annotate_path.exists(), "commands/annotate.md should be created");

    let content = std::fs::read_to_string(&annotate_path).unwrap();
    assert!(content.contains("# Annotate"), "should contain heading");
    assert!(content.contains("$ARGUMENTS"), "should contain $ARGUMENTS");
}

#[test]
fn install_creates_annotate_md_even_when_already_installed() {
    // Test D-01: re-install writes the file even if plugin_is_registered() returns true
    let dir = tempdir().unwrap();
    let home = dir.path().to_str().unwrap().to_string();
    let integration = ClaudeIntegration;
    let ctx = InstallContext {
        home: home.clone(),
        binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
    };

    // First install
    integration.install(&ctx).unwrap();

    // Manually delete the commands directory to simulate upgrading an existing install
    let commands_dir = dir
        .path()
        .join(".local/share/plan-reviewer/claude-plugin/commands");
    std::fs::remove_dir_all(&commands_dir).unwrap();
    assert!(!commands_dir.exists(), "commands dir removed for test setup");

    // Second install — must recreate commands/annotate.md
    integration.install(&ctx).unwrap();

    let annotate_path = commands_dir.join("annotate.md");
    assert!(
        annotate_path.exists(),
        "commands/annotate.md should be recreated on re-install"
    );
}
```

### Pattern 4: Integration Test Structure

**What:** Integration tests in `tests/integration/install_uninstall.rs` using `assert_cmd` with tmpdir HOME isolation.

**Example (following install_claude_creates_settings_in_isolated_home pattern):**
```rust
#[test]
fn install_claude_creates_commands_annotate_md() {
    let home = tempfile::TempDir::new().unwrap();

    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["install", "claude"])
        .assert()
        .success();

    let annotate_path = home
        .path()
        .join(".local/share/plan-reviewer/claude-plugin/commands/annotate.md");
    assert!(
        annotate_path.exists(),
        "commands/annotate.md should be created by install"
    );

    let content = std::fs::read_to_string(&annotate_path).unwrap();
    assert!(content.contains("$ARGUMENTS"), "annotate.md must contain $ARGUMENTS");

    drop(home);
}

#[test]
fn uninstall_claude_removes_commands_directory() {
    let home = tempfile::TempDir::new().unwrap();

    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["install", "claude"])
        .assert()
        .success();

    let commands_dir = home
        .path()
        .join(".local/share/plan-reviewer/claude-plugin/commands");
    assert!(commands_dir.exists(), "commands dir should exist after install");

    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["uninstall", "claude"])
        .assert()
        .success();

    assert!(
        !commands_dir.exists(),
        "commands/ should be removed (whole plugin dir removed by uninstall)"
    );

    drop(home);
}
```

### Anti-Patterns to Avoid

- **Only-create-if-missing for annotate.md:** Claude's discretion allows overwriting. Overwriting on every install is simpler and ensures the stub content is always up to date. Use unconditional `write()`.
- **Putting `commands/` inside `.claude-plugin/`:** The official docs explicitly warn against this. `commands/` must be at the plugin root level, not inside `.claude-plugin/`. [VERIFIED: code.claude.com/docs/en/plugins-reference]
- **Keeping the early return before file writes:** The entire D-01 rationale is to move the early return to after file writes. Do not keep the old structure.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown command file content | Template engine, serde | Rust string literal | Content is a 5-line static string per D-03 |
| Directory creation | Custom recursive mkdir | `std::fs::create_dir_all` | Already used for every other plugin directory |
| File writing | Buffered writer | `std::fs::write` | Already used for every other plugin file |

## Common Pitfalls

### Pitfall 1: Early Return Blocks File Writes for Existing Users
**What goes wrong:** The current `plugin_is_registered()` early return at line 175 prevents any file writes when the plugin is already installed. Existing users re-running `plan-reviewer install claude` would NOT get `commands/annotate.md`.
**Why it happens:** The idempotency check was originally designed to prevent duplicate settings.json entries, not to skip file refreshes.
**How to avoid:** D-01 — move the early return to guard only Steps 4-6 (settings mutations). Steps 1-2 (file writes + settings read) run unconditionally.
**Warning signs:** A test that installs twice and checks both `commands/annotate.md` exists AND settings has no duplicates would catch this.

### Pitfall 2: `commands/` vs `skills/` Directory
**What goes wrong:** Using `skills/annotate/SKILL.md` instead of `commands/annotate.md` would change the command name and format. `skills/` creates `/<plugin-name>:annotate` via a SKILL.md; `commands/` creates the same name via a flat `.md` file.
**Why it happens:** The official docs describe `skills/` as the recommended new approach and `commands/` as legacy-but-supported. For Phase 10, `commands/annotate.md` is the locked decision (D-03) — this is specifically a flat `.md` file.
**How to avoid:** Use `commands/annotate.md` as specified in D-03. Phase 11 may revisit this if needed.

### Pitfall 3: Annotate.md Content Verbatim Requirement
**What goes wrong:** Deviating from the exact content in D-03 could affect Phase 11's ability to extend the file.
**Why it happens:** Testing `content.contains("$ARGUMENTS")` passes with many variants, but the exact heading `# Annotate` and stub body are the contract for Phase 11.
**How to avoid:** Assert exact content equality in the unit test, not just substring presence. Or define the content as a constant so Phase 11 can locate it easily.

### Pitfall 4: Slash Command Name Is Namespaced
**What goes wrong:** REQUIREMENTS.md PLGN-03 says "/annotate is discoverable." The actual command created by `commands/annotate.md` in a plugin named `"plan-reviewer"` is `/plan-reviewer:annotate`.
**Why it happens:** Claude Code namespaces all plugin commands with `<plugin-name>:`.
**How to avoid:** PLGN-03's success criterion ("discoverable in Claude Code's slash command menu") is satisfied by the file existing — the discoverability is automatic. The name discrepancy between `/annotate` (SLSH-01, Phase 11) and `/plan-reviewer:annotate` (what `commands/annotate.md` actually creates) is a Phase 11 concern. Do NOT change the plugin name or use a different directory structure to try to get a bare `/annotate` command.

### Pitfall 5: Test Idempotency for File Writes, Not Just Settings
**What goes wrong:** Existing integration tests for idempotency (`install_claude_is_idempotent`) only check settings.json for duplicate entries. After D-01, the correct behavior is that file writes always happen. A test that only checks settings would miss the regression where file writes are accidentally re-guarded.
**How to avoid:** The unit test `install_creates_annotate_md_even_when_already_installed` explicitly removes the commands directory between two install calls to test this.

## Claude Code Commands/ Directory — Verified Specification

[VERIFIED: code.claude.com/docs/en/plugins-reference, code.claude.com/docs/en/plugins, plannotator live install]

- `commands/` directory at the plugin root (NOT inside `.claude-plugin/`) is supported
- Files named `<name>.md` create slash commands namespaced as `/<plugin-name>:<name>`
- The plugin name used for the namespace comes from `plugin.json` `"name"` field
- For plan-reviewer: `commands/annotate.md` → `/plan-reviewer:annotate`
- `commands/` is described as "Skills as flat Markdown files. Use `skills/` for new plugins" — it is legacy-but-supported; the plannotator plugin (actively used, version 0.17.7) uses it
- Frontmatter is optional for `commands/` files; the current D-03 content has no frontmatter
- `$ARGUMENTS` in the file content is the standard substitution for arguments passed to the command

### Supported Frontmatter in commands/*.md
[VERIFIED: code.claude.com/docs/en/slash-commands]

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| `name` | No | filename without .md | |
| `description` | Recommended | first paragraph | Used in autocomplete menu |
| `argument-hint` | No | — | Hint shown during autocomplete |
| `disable-model-invocation` | No | false | Set true to prevent Claude auto-invoking |
| `allowed-tools` | No | — | Pre-approved tools |

The D-03 stub content has no frontmatter, which is valid. Phase 11 may add `description` and other fields when writing the full prompt logic.

## Environment Availability

Step 2.6: SKIPPED — Phase 10 is a Rust code + filesystem change with no external tool dependencies beyond what is already in the project.

## Validation Architecture

`workflow.nyquist_validation` is explicitly `false` in `.planning/config.json` — this section is omitted per the skip condition.

## Security Domain

No new network, authentication, or cryptographic operations introduced. The `commands/annotate.md` write follows the same filesystem-only pattern as all existing plugin file writes. No ASVS categories are newly applicable.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `commands/annotate.md` in plugin named `"plan-reviewer"` creates `/plan-reviewer:annotate` | Architecture Patterns, Pitfall 4 | Command might be bare `/annotate` (no namespace). PLGN-03 would still be satisfied; only the exact slash command name differs. Low-risk assumption. |
| A2 | The D-03 stub content without frontmatter is sufficient for Claude Code to register the command in the autocomplete menu | Claude Code Commands/ Spec | Without a `description` frontmatter field, the command might appear with an empty description. The command still appears in the menu. Low-risk. |

**All other claims** about the `commands/` directory spec, plugin directory layout, the early-return location in `claude.rs`, and the existing test patterns were verified by direct code inspection and official documentation.

## Open Questions

1. **Slash command name: `/plan-reviewer:annotate` vs `/annotate`**
   - What we know: `commands/annotate.md` in a plugin named `"plan-reviewer"` creates `/plan-reviewer:annotate` per official docs
   - What's unclear: REQUIREMENTS.md SLSH-01 says "User can invoke `/annotate`" (Phase 11 scope). If the intent is a bare `/annotate`, a different mechanism would be needed (e.g., standalone `~/.claude/commands/annotate.md` rather than a plugin command).
   - Recommendation: Phase 10 proceeds with `commands/annotate.md` as locked in D-03. The PLGN-03 success criterion ("discoverable in Claude Code's slash command menu") is satisfied. Phase 11 resolves whether the target is `/plan-reviewer:annotate` or a bare `/annotate`.

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `src/integrations/claude.rs` — full `install()` and `uninstall()` implementations, idempotency check at line 175
- Direct code inspection: `tests/integration/install_uninstall.rs` — all existing integration test patterns
- Live filesystem inspection: `~/.local/share/plan-reviewer/claude-plugin/` — actual plugin directory structure installed on this machine
- Live filesystem inspection: `~/.claude/plugins/cache/plannotator/plannotator/0.17.7/` — reference plugin using `commands/` directory
- [CITED: code.claude.com/docs/en/plugins-reference] — Plugin directory structure, `commands/` vs `skills/` spec, namespacing behavior
- [CITED: code.claude.com/docs/en/plugins] — Plugin creation guide, warning about `.claude-plugin/` scope
- [CITED: code.claude.com/docs/en/slash-commands] — `$ARGUMENTS` substitution, frontmatter fields

### Secondary (MEDIUM confidence)
- Live inspection of `plannotator` commands: `plannotator-annotate.md`, `plannotator-review.md` — confirmed flat `.md` format works with frontmatter `description` and `allowed-tools`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns verified from codebase
- Architecture: HIGH — live plugin inspection + official docs
- Pitfalls: HIGH — D-01 issue identified from direct code reading; namespace issue verified from official docs
- Commands/ spec: HIGH — verified from official Claude Code documentation + live reference implementation

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (Claude Code plugin spec is actively evolving; re-verify if `commands/` namespacing behavior is critical)
