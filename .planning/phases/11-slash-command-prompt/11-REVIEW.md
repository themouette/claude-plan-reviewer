---
phase: 11-slash-command-prompt
reviewed: 2026-04-11T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/integrations/claude.rs
  - tests/integration/install_uninstall.rs
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-04-11
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the Claude integration module and integration test suite introduced/modified in this phase. The integration module implements install/uninstall of the Claude Code plugin model with the new `commands/annotate.md` slash command prompt. The logic is correct and test coverage is thorough.

Three warnings were found: a dead-code annotation that is factually wrong (the function it marks is actively used), a misleading variable name that signals "unused" but the value is actually validated, and a partially-observable inconsistency when uninstall encounters corrupted settings. Two info items cover a stale HTML placeholder in the command prompt template and a duplicate idempotency signal.

## Warnings

### WR-01: `#[allow(dead_code)]` on `claude_legacy_hook_installed` is factually incorrect

**File:** `src/integrations/claude.rs:498`
**Issue:** `claude_legacy_hook_installed` is annotated with `#[allow(dead_code)]` but the function is actively used in `src/update.rs` (line 302). The attribute was apparently written when the function was first created but never removed after `update.rs` started calling it. With `cargo clippy -- -D warnings` (enforced by the pre-commit hook), Clippy will not flag this because the attribute suppresses a warning that no longer fires — so the build stays green. However the annotation is misleading: anyone reading the attribute will think the function is unused and may delete it, breaking the update path.

**Fix:** Remove the `#[allow(dead_code)]` attribute.

```rust
// Before
#[allow(dead_code)]
pub(crate) fn claude_legacy_hook_installed(settings: &serde_json::Value) -> bool {

// After
pub(crate) fn claude_legacy_hook_installed(settings: &serde_json::Value) -> bool {
```

---

### WR-02: `_binary_path` is validated but its value is never used — hook command is hardcoded

**File:** `src/integrations/claude.rs:40-43`
**Issue:** `install()` validates that `binary_path` is non-`None` and returns an error when it is absent. The variable is stored as `_binary_path` (the leading underscore suppresses the "unused variable" warning), but its value is never consulted again. The hook command written to `hooks.json` is hardcoded as `"plan-reviewer review-hook"` (line 120), relying on `plan-reviewer` being in `PATH` at hook invocation time — regardless of what path the caller passed in.

The `_binary_path` name signals to readers "this is intentionally unused", which contradicts the non-`None` check above it. The validation also gives callers a false guarantee: they think passing a path matters, but the installed hook will always use the bare `plan-reviewer` name.

If the intent is to always use the bare name (relying on PATH), the validation should be removed. If the intent is to use the actual binary path in the hook command, the value should be threaded through to the hook JSON.

**Fix (option A — current intent is bare-name PATH lookup, so drop the validation):**
```rust
// Remove lines 40-43 entirely. The binary_path field is accepted by
// InstallContext for other integrations; no validation needed here.
fn install(&self, ctx: &InstallContext) -> Result<(), String> {
    let plugin_dir = claude_plugin_dir(&ctx.home);
    let settings_path = claude_settings_path(&ctx.home);
    // ...
```

**Fix (option B — use the binary path in the hook command):**
```rust
let binary_path = ctx
    .binary_path
    .as_deref()
    .ok_or_else(|| "install requires a binary_path — none was provided".to_string())?;

// ... later in hooks_json:
let hooks_json = serde_json::json!({
    "hooks": {
        "PermissionRequest": [
            {
                "matcher": "ExitPlanMode",
                "hooks": [{"type": "command", "command": format!("{} review-hook", binary_path)}]
            }
        ]
    }
});
```

---

### WR-03: Partial uninstall when `settings.json` contains invalid JSON

**File:** `src/integrations/claude.rs:388-397`
**Issue:** In `uninstall()`, if `settings.json` exists but contains invalid JSON, the code prints a warning and returns `Ok(())`. By this point, Step 1 has already removed the plugin directory. The result is a partial uninstall: the plugin directory is gone but the stale registration entries remain in the (corrupt) `settings.json`. Claude Code will see entries pointing to a non-existent plugin directory.

This edge case is admittedly unusual — a user would have to have manually corrupted their `settings.json`. However, since the plugin directory is already removed, the most user-friendly behavior would be to report success (the binary artifacts are gone) and tell the user the settings file needs manual cleanup.

**Fix:** Add an explanatory message so the user knows they need to clean up `settings.json` manually:

```rust
Err(e) => {
    eprintln!(
        "plan-reviewer uninstall: warning: {} contains invalid JSON: {} \
         (no changes made to settings — remove stale entries manually if needed)",
        settings_path.display(),
        e
    );
    return Ok(());
}
```

---

## Info

### IN-01: `<resolved-file>` placeholder in bash code block may render as an HTML tag

**File:** `src/integrations/claude.rs:188`
**Issue:** The bash code block in `annotate.md` contains:
```
plan-reviewer review <resolved-file>
```
In most Markdown renderers (GitHub, comrak with HTML output), `<resolved-file>` is treated as an unknown HTML tag and stripped, leaving `plan-reviewer review` with nothing after it. While Claude reads the surrounding prose and understands the template intent, if this file is ever rendered to HTML (e.g., displayed in the plan-reviewer UI itself), the placeholder silently disappears. Conventional Markdown practice uses `{resolved-file}` or `PATH_TO_FILE` for code-block placeholders.

**Fix:**
```rust
"plan-reviewer review {resolved-file}\n",
```

---

### IN-02: Integration test `install_claude_creates_commands_annotate_md` does not verify `run_in_background` instruction

**File:** `tests/integration/install_uninstall.rs:136-174`
**Issue:** The unit test `install_creates_annotate_md_with_expected_content` (in the `#[cfg(test)]` block of `claude.rs`) checks for `run_in_background` at line 903-905. However, the integration test `install_claude_creates_commands_annotate_md` does not. This is a minor coverage gap — the integration test checks the five assertions listed in the CONTEXT.md design spec (heading, `$ARGUMENTS`, `allowed-tools`, `plan-reviewer review`, frontmatter) but skips the `run_in_background` instruction that is also required by design spec D-08.

This is not a bug (the unit test covers it), but the integration test's assertion set is incomplete relative to the design spec.

**Fix:** Add the assertion to the integration test for completeness:
```rust
assert!(
    content.contains("run_in_background"),
    "should instruct Bash tool to use run_in_background: true"
);
```

---

_Reviewed: 2026-04-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
