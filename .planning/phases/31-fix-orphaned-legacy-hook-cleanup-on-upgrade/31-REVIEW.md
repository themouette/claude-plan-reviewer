---
phase: 31-fix-orphaned-legacy-hook-cleanup-on-upgrade
reviewed: 2026-05-30T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - src/update.rs
findings:
  critical: 3
  warning: 3
  info: 2
  total: 8
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-05-30
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Phase 31 introduced `remove_claude_legacy_hook` and `remove_gemini_legacy_hook` helpers, refactored `perform_claude_migration` and `perform_gemini_migration` to call them, and wired both helpers into the Case 3 (version-stale) path of `refresh_integrations_with_home`. New tests were added and two test names were updated per spec.

The core objective — preventing the hook from firing twice after an upgrade — is correctly implemented. However, three blocker-grade bugs were found: a panic path in `perform_claude_migration` when `settings.json` contains non-object JSON, silent settings-file destruction via `unwrap_or_default()`, and a regression in `write_claude_plugin_files` that clobbers the `PreToolUse` hook on every update. Two further warnings address silent I/O error suppression and missing file refreshes on upgrade.

---

## Critical Issues

### CR-01: `perform_claude_migration` panics when `settings.json` root is not a JSON object

**File:** `src/update.rs:240-264`

**Issue:** Inside the `if let Ok(mut root) = serde_json::from_str::<serde_json::Value>(&content)` block, the code calls `.unwrap()` twice on `root.as_object_mut()` (lines 241 and 259). The outer guard only verifies that the file parses as valid JSON — it does not verify that the parsed value is a JSON object. If `settings.json` contains valid but non-object JSON (e.g., `null`, `[]`, or `"a string"`), `as_object_mut()` returns `None` and the `.unwrap()` panics, crashing the binary. At that point, plugin directory files have already been written (step 1 completed) but `settings.json` is left unpatched, and the legacy hook entry is still present because the function panics before reaching `remove_claude_legacy_hook`.

The full install path in `integrations/claude.rs:326-333` handles this correctly with an explicit `if !root.is_object()` guard that resets to `{}`. The migration path omits this guard.

**Fix:**
```rust
if let Ok(content) = std::fs::read_to_string(&settings_path)
    && let Ok(mut root) = serde_json::from_str::<serde_json::Value>(&content)
{
    // Guard added: reset to object if root is not one
    if !root.is_object() {
        root = serde_json::json!({});
    }
    let plugin_dir = claude_plugin_dir(home);

    root.as_object_mut()
        .expect("root is always an object after guard")
        .entry("extraKnownMarketplaces")
        // ...
```

---

### CR-02: `unwrap_or_default()` silently destroys `settings.json` on serialization failure

**File:** `src/update.rs:212-215`, `270-271`, `312-313`

**Issue:** Three call sites use `serde_json::to_string_pretty(&root).unwrap_or_default()` and pass the result directly to `std::fs::write`. If `to_string_pretty` returns an error, `unwrap_or_default()` substitutes an empty `String`, and `std::fs::write` then replaces the user's `settings.json` with a zero-byte file. This destroys all of the user's existing Claude or Gemini settings (theme, other hooks, other plugins, etc.).

While `to_string_pretty` failing on a `serde_json::Value` in memory is unlikely in practice, the consequence is catastrophic data loss and the correct fix is trivial.

**Fix:** Check the serialization result before writing:
```rust
// Replace:
let _ = std::fs::write(
    &settings_path,
    serde_json::to_string_pretty(&root).unwrap_or_default(),
);

// With:
match serde_json::to_string_pretty(&root) {
    Ok(output) => { let _ = std::fs::write(&settings_path, output); }
    Err(e) => eprintln!("plan-reviewer: failed to serialize settings.json: {}", e),
}
```

Affected locations:
- `remove_claude_legacy_hook` (lines 212-215)
- `perform_claude_migration` (line 270-271)
- `remove_gemini_legacy_hook` (lines 312-313)

---

### CR-03: `write_claude_plugin_files` drops the `PreToolUse` hook on every update

**File:** `src/update.rs:454-461`

**Issue:** `write_claude_plugin_files` writes a `hooks.json` containing only the `PermissionRequest / ExitPlanMode` entry:

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

But `ClaudeIntegration::install()` in `src/integrations/claude.rs:116-135` writes a `hooks.json` that also includes a `PreToolUse / Bash` entry for `plan-reviewer pre-pr-hook` (added in Plan 29-02). Every time Case 3 (version-stale) or Case 2 (migration) invokes `write_claude_plugin_files`, the existing `hooks.json` is overwritten with a version that lacks `PreToolUse`. As a result, the pre-PR code-review gate silently stops firing after the first `plan-reviewer update`.

The test `test_write_claude_plugin_files_uses_hook_subcommand` (line 744) only checks for `"plan-reviewer review-hook"` and does not assert the presence of `PreToolUse`, so the regression is undetected by the test suite.

**Fix:** Add the `PreToolUse` section to `write_claude_plugin_files`:
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

### WR-01: `perform_claude_migration` can remove the legacy hook entry even when plugin file writes silently failed

**File:** `src/update.rs:226-276`

**Issue:** `write_claude_plugin_files` (called at line 230) discards all I/O errors with `let _ = ...`. If disk is full or permissions are wrong, the plugin directory files are never created, but `perform_claude_migration` continues unconditionally to patch `settings.json` (lines 234-272) and then calls `remove_claude_legacy_hook` (line 274). The result is a state where the legacy hook is gone but the new plugin files do not exist on disk: neither hook fires, and `ExitPlanMode` processing is silently lost.

**Fix:** Change `write_claude_plugin_files` to return `Result<(), String>` (mirroring the install path) and have `perform_claude_migration` return early on failure:
```rust
fn perform_claude_migration(home: &str, current_version: &str) {
    if let Err(e) = write_claude_plugin_files(home, current_version) {
        eprintln!("plan-reviewer: migration failed writing plugin files: {}", e);
        return; // do not remove legacy entry if new files were not written
    }
    // ... patch settings.json ...
    remove_claude_legacy_hook(home);
}
```

The same pattern applies to `perform_gemini_migration` / `write_gemini_extension_files`.

---

### WR-02: `write_claude_plugin_files` does not refresh `marketplace.json` or command files on update

**File:** `src/update.rs:445-479`

**Issue:** `write_claude_plugin_files` only rewrites `plugin.json` and `hooks/hooks.json`. The `install()` path also writes `.claude-plugin/marketplace.json`, `commands/annotate.md`, and `commands/code-review.md`. After an upgrade, these files are never refreshed. If a new version changes the command instruction files or the marketplace manifest, users running `plan-reviewer update` retain the old content of those files indefinitely — until they manually uninstall and reinstall.

`marketplace.json` is particularly likely to break Claude Code's plugin loading if its format evolves across releases.

**Fix:** Include the missing files in `write_claude_plugin_files`, or extract a shared helper used by both install and update that writes all plugin directory contents.

---

### WR-03: `test_claude_case2_migration_creates_plugin_and_cleans_settings` does not verify that the updated `hooks.json` contains `PreToolUse`

**File:** `src/update.rs:841-847`

**Issue:** The test verifies `hooks_content.contains("plan-reviewer review-hook")` but does not assert the presence of the `PreToolUse` section. Because `write_claude_plugin_files` is missing `PreToolUse` (CR-03), this omission means the test passes even after the regression is introduced. The test suite should catch the divergence between the update-path and install-path hook files but does not.

**Fix:**
```rust
let hooks_json: serde_json::Value = serde_json::from_str(&hooks_content).unwrap();
assert!(
    hooks_json["hooks"]["PreToolUse"].as_array().is_some(),
    "hooks.json written during Case 2 migration must include PreToolUse section"
);
```

---

## Info

### IN-01: `write_claude_plugin_files` / `write_gemini_extension_files` silently suppress all I/O errors

**File:** `src/update.rs:465-474`, `508-518`

**Issue:** Every `create_dir_all` and `fs::write` call in the two write helpers uses `let _ = ...`, silently discarding any error. The function prints a success message regardless. This makes debugging upgrade failures impossible and compounds WR-01 above. The full install path in `integrations/claude.rs` propagates errors as `Result<(), String>`.

**Fix:** Return `Result<(), String>` from both write helpers and propagate errors.

### IN-02: `sanitize_version` does not cap the length of the network-sourced version string

**File:** `src/update.rs:161-166`

**Issue:** `sanitize_version` strips non-alphanumeric characters but imposes no length limit. A malicious GitHub release tag composed entirely of allowed characters (e.g., 10,000 `a`s) would pass through unsanitized and be used in `format!` output strings and as a `target_version_tag` argument. The terminal display impact is limited, but adding a length cap is a one-liner defensive improvement.

**Fix:**
```rust
fn sanitize_version(version: &str) -> String {
    version
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == '+')
        .take(64)
        .collect()
}
```

---

_Reviewed: 2026-05-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
