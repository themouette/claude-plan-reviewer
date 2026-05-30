---
phase: 31-fix-orphaned-legacy-hook-cleanup-on-upgrade
reviewed: 2026-05-30T21:31:43Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - src/update.rs
findings:
  critical: 3
  warning: 2
  info: 0
  total: 5
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-05-30T21:31:43Z
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

`src/update.rs` implements the update flow and integration refresh logic, including the new Case 2 legacy-hook migration path (the focus of this phase). The migration detection logic is sound and the new `remove_claude_legacy_hook` / `remove_gemini_legacy_hook` helpers are well-structured. However, three correctness bugs were found: a panic path in `perform_claude_migration`, silent settings-file corruption via `unwrap_or_default()`, and a regression in `write_claude_plugin_files` that drops the `PreToolUse` hook on every update.

## Critical Issues

### CR-01: `perform_claude_migration` panics if `settings.json` root is not a JSON object

**File:** `src/update.rs:240-264`

**Issue:** Inside the `if let Ok(mut root) = ...` block, the code calls `.unwrap()` twice on `root.as_object_mut()` (lines 240 and 258). The guard only verifies that the file can be read and parses as valid JSON — it does not verify that the JSON value is an object. If `settings.json` contains a valid JSON non-object (e.g., `null`, `[]`, or `"a string"`), `as_object_mut()` returns `None` and the `.unwrap()` panics, crashing the binary mid-migration and leaving the plugin directory files written (step 1 succeeded) but settings.json unpatched.

`ClaudeIntegration::install()` handles this correctly with an explicit object check and reset to `{}`. The migration path must apply the same guard.

**Fix:**
```rust
if let Ok(content) = std::fs::read_to_string(&settings_path)
    && let Ok(mut root) = serde_json::from_str::<serde_json::Value>(&content)
{
    // Guard: if root is not an object (e.g. null, array), start fresh
    if !root.is_object() {
        root = serde_json::json!({});
    }
    let plugin_dir = claude_plugin_dir(home);

    root.as_object_mut()
        .expect("root is always an object at this point")
        .entry("extraKnownMarketplaces")
        // ...
```

---

### CR-02: `unwrap_or_default()` silently destroys `settings.json` on serialization failure

**File:** `src/update.rs:212-215`, `270-271`, `312-313`

**Issue:** Three call sites use `serde_json::to_string_pretty(&root).unwrap_or_default()` and pass the result directly to `std::fs::write`. If `to_string_pretty` ever fails (theoretically possible with extremely unusual serde_json `Value` content), `unwrap_or_default()` produces an empty `String`, and `std::fs::write` replaces the user's `settings.json` with an empty file. This would silently destroy all of the user's Claude or Gemini settings.

While the probability of `to_string_pretty` failing on a `serde_json::Value` is very low, the consequence is data loss and the fix is trivial.

**Fix:** Bail out instead of writing an empty string:
```rust
// replace:
let _ = std::fs::write(
    &settings_path,
    serde_json::to_string_pretty(&root).unwrap_or_default(),
);

// with:
match serde_json::to_string_pretty(&root) {
    Ok(output) => { let _ = std::fs::write(&settings_path, output); }
    Err(e) => {
        eprintln!("plan-reviewer: failed to serialize settings.json: {}", e);
        return; // or return early from the calling function
    }
}
```

Affected lines: `remove_claude_legacy_hook` (line 212–215), `perform_claude_migration` (line 270), `remove_gemini_legacy_hook` (line 312).

---

### CR-03: `write_claude_plugin_files` drops `PreToolUse` hook on every update — regression

**File:** `src/update.rs:454-461`

**Issue:** `write_claude_plugin_files` writes a `hooks.json` that contains only the `PermissionRequest / ExitPlanMode` entry:

```rust
let hooks = serde_json::json!({
    "hooks": {
        "PermissionRequest": [{
            "matcher": "ExitPlanMode",
            "hooks": [{"type": "command", "command": "plan-reviewer review-hook"}]
        }]
    }
});
```

But `ClaudeIntegration::install()` (`src/integrations/claude.rs:116-135`) writes a `hooks.json` that also includes a `PreToolUse / Bash` entry for `plan-reviewer pre-pr-hook`. Every time `refresh_integrations_with_home` runs (i.e. on every `plan-reviewer update`), Case 3 calls `write_claude_plugin_files`, which overwrites `hooks.json` with a version that lacks `PreToolUse`. The pre-PR hook silently stops working after the first upgrade.

The test `test_write_claude_plugin_files_uses_hook_subcommand` does not assert the presence of `PreToolUse`, so this regression goes undetected.

**Fix:** Add the `PreToolUse` entry to the `hooks` JSON literal in `write_claude_plugin_files`:
```rust
let hooks = serde_json::json!({
    "hooks": {
        "PermissionRequest": [{
            "matcher": "ExitPlanMode",
            "hooks": [{"type": "command", "command": "plan-reviewer review-hook"}]
        }],
        "PreToolUse": [{
            "matcher": "Bash",
            "hooks": [{
                "type": "command",
                "command": "plan-reviewer pre-pr-hook",
                "timeout": 600_000
            }]
        }]
    }
});
```

Also update `test_write_claude_plugin_files_uses_hook_subcommand` to assert the `PreToolUse` entry is present.

---

## Warnings

### WR-01: `write_claude_plugin_files` does not refresh `marketplace.json` or command files on update

**File:** `src/update.rs:445-479`

**Issue:** `write_claude_plugin_files` only rewrites `plugin.json` and `hooks/hooks.json`. The `install()` path also writes `.claude-plugin/marketplace.json`, `commands/annotate.md`, and `commands/code-review.md`. After an upgrade, these files are never refreshed. If a new version changes the marketplace manifest or updates the command instruction files, users running `plan-reviewer update` will retain the old versions of those files indefinitely until they `uninstall` and reinstall.

**Fix:** Either call the full `ClaudeIntegration::install()` logic from the update path (minus the idempotency short-circuit check and minus settings.json registration mutation), or expand `write_claude_plugin_files` to include the missing files. At minimum, `marketplace.json` should be kept up to date because Claude Code may use it to validate the plugin.

---

### WR-02: Case 2 migration silently succeeds even if `write_claude_plugin_files` fails

**File:** `src/update.rs:226-276`

**Issue:** `write_claude_plugin_files` and `write_gemini_extension_files` ignore all I/O errors via `let _ = ...` on `create_dir_all` and `write`. The callers `perform_claude_migration` and `perform_gemini_migration` unconditionally proceed to patch `settings.json` (step 2) and print a success message, even if the plugin/extension directory files were never actually created. This leaves the user with `settings.json` registering a plugin that does not exist on disk.

The same pattern exists in Case 3 (`refresh_integrations_with_home` lines 386-388 and 406-408) but is worse in Case 2 migration because Case 2 also modifies `settings.json`.

**Fix:** Propagate errors from the write helpers so callers can bail out before touching `settings.json`. Change `write_claude_plugin_files` and `write_gemini_extension_files` to return `Result<(), String>` and have `perform_claude_migration` / `perform_gemini_migration` return early on failure:
```rust
fn write_claude_plugin_files(home: &str, current_version: &str) -> Result<(), String> {
    // ...
    std::fs::create_dir_all(&manifest_dir)
        .map_err(|e| format!("cannot create {}: {}", manifest_dir.display(), e))?;
    // etc.
    Ok(())
}
```

---

_Reviewed: 2026-05-30T21:31:43Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
