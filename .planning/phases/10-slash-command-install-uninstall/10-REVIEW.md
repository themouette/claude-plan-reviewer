---
phase: 10-slash-command-install-uninstall
reviewed: 2026-04-11T20:48:18Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/integrations/claude.rs
  - tests/integration/install_uninstall.rs
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-04-11T20:48:18Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the Claude integration install/uninstall implementation (`src/integrations/claude.rs`, 1121 lines including unit tests) and the integration test suite (`tests/integration/install_uninstall.rs`, 511 lines).

The implementation is well-structured: plugin file writes are unconditional (correct for D-01 upgrade semantics), settings.json mutations are guarded by an idempotency check, and uninstall is safe on a clean system. Test coverage is thorough across the happy path, idempotency, and edge cases.

Two warnings require attention: one is a data-loss risk where a valid-but-non-object `settings.json` is silently overwritten, and the other is a hook command that uses a bare binary name relying on `PATH` rather than the absolute path that the caller already validated.

---

## Warnings

### WR-01: Silent data loss when settings.json root is a non-object JSON value

**File:** `src/integrations/claude.rs:180-187`

**Issue:** When `~/.claude/settings.json` contains syntactically valid JSON that is not a JSON object (e.g., `[]`, `42`, or `"string"`), the code emits a warning to `stderr` and silently replaces the file's root with an empty object `{}`. The function then continues and writes this back to disk (Step 6), destroying all existing content without returning an error. This is inconsistent with lines 162-169, which correctly return `Err` and refuse to overwrite when the file cannot be parsed.

The risk is low in practice (Claude Code always writes an object), but the behavior is a correctness issue: the function should either return `Err` or at minimum not proceed to write the clobbered content. A warning-only path that then silently overwrites is a dangerous pattern.

**Fix:**
```rust
// Replace the silent recovery at lines 180-187 with a hard error:
if !root.is_object() {
    return Err(format!(
        "{} contains valid JSON but root is not an object (got {}); \
         refusing to overwrite. Fix or remove the file first.",
        settings_path.display(),
        root.type_id_name() // or a match on the variant
    ));
}
```

If silent recovery is intentional (user had a corrupted root), at minimum the write should be skipped or the function should return early rather than continuing to write an empty object back:

```rust
if !root.is_object() {
    eprintln!(
        "plan-reviewer install: {} root is not a JSON object; \
         refusing to overwrite. Fix or remove the file first.",
        settings_path.display()
    );
    return Err(format!(
        "{} contains valid JSON but root is not a JSON object",
        settings_path.display()
    ));
}
```

---

### WR-02: Hook command uses bare binary name instead of absolute path

**File:** `src/integrations/claude.rs:120-121`

**Issue:** The hook command written to `hooks/hooks.json` is the bare string `"plan-reviewer review-hook"`. This relies on `plan-reviewer` being discoverable via the shell's `PATH` at hook execution time. The `binary_path` field from `InstallContext` is extracted and validated at line 40-43 (the function returns `Err` if it is `None`), but the extracted value is immediately discarded (`_binary_path`) and never used.

By contrast, `src/integrations/opencode.rs:46` correctly substitutes the absolute binary path into the hook configuration using `.replace("__PLAN_REVIEWER_BIN__", binary_path)`.

If a user installs the binary to a non-standard path (e.g., `~/.local/bin/`) that is not on Claude Code's hook execution `PATH`, the hook will silently fail at runtime. The `binary_path` validation gives a false sense of safety: it ensures the caller provides a path, but the path is never used.

**Fix:**
```rust
// Line 40: rename _binary_path to binary_path
let binary_path = ctx
    .binary_path
    .as_deref()
    .ok_or_else(|| "install requires a binary_path — none was provided".to_string())?;

// Line 120-121: use the absolute path
let hook_command = format!("{} review-hook", binary_path);
let hooks_json = serde_json::json!({
    "hooks": {
        "PermissionRequest": [
            {
                "matcher": "ExitPlanMode",
                "hooks": [{"type": "command", "command": hook_command}]
            }
        ]
    }
});
```

Note: the `_binary_path` pattern (validation-only guard) is documented in `src/integrations/gemini.rs:21` as an intentional design choice ("hooks.json uses bare 'plan-reviewer'"). If this is truly intentional for Claude and Gemini, the guard validation should be removed (since it misleads readers into thinking the path is used) and the `InstallContext` contract documented to reflect that these integrations do not embed the path. The current state — validate but discard — is the most confusing option.

---

## Info

### IN-01: Redundant `drop(home)` calls throughout integration tests

**File:** `tests/integration/install_uninstall.rs:75, 128, 162, 222, 275, 315, 343, 406, 445, 473, 509`

**Issue:** Every test function ends with an explicit `drop(home);` call on the `TempDir` handle. Since `home` goes out of scope at the end of the function anyway, these calls are no-ops — Rust drops the value automatically. Explicit `drop()` at end-of-scope adds noise and suggests the author thought it was necessary (perhaps to ensure cleanup before some assertion above, but in each case no assertion follows the `drop`).

**Fix:** Remove the trailing `drop(home);` from all test functions. If the intent is to ensure cleanup happens before the function returns (e.g., before OS-level file descriptors close), a comment would be more appropriate; but since the last assertion in each test uses data read before the `drop`, there is no functional reason for them.

---

### IN-02: Missing test for non-object settings.json (the WR-01 code path)

**File:** `src/integrations/claude.rs:180-187`

**Issue:** The code path where `settings.json` contains valid-but-non-object JSON (e.g., a JSON array) is not exercised by any test in `src/integrations/claude.rs` or `tests/integration/install_uninstall.rs`. The error-on-parse-failure path (lines 162-169) is also untested. These are the two most important defensive paths in the settings.json handling logic.

**Fix:** Add unit tests in the `#[cfg(test)]` block:
```rust
#[test]
fn install_returns_err_when_settings_json_is_valid_but_not_object() {
    let dir = tempdir().unwrap();
    let home = dir.path().to_str().unwrap().to_string();
    let claude_dir = dir.path().join(".claude");
    std::fs::create_dir_all(&claude_dir).unwrap();
    std::fs::write(claude_dir.join("settings.json"), "[]").unwrap();

    let integration = ClaudeIntegration;
    let ctx = InstallContext {
        home,
        binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
    };
    // Adjust to match whatever behavior is chosen for WR-01
    let result = integration.install(&ctx);
    assert!(result.is_err(), "install must error on non-object settings.json");
}

#[test]
fn install_returns_err_when_settings_json_is_invalid() {
    let dir = tempdir().unwrap();
    let home = dir.path().to_str().unwrap().to_string();
    let claude_dir = dir.path().join(".claude");
    std::fs::create_dir_all(&claude_dir).unwrap();
    std::fs::write(claude_dir.join("settings.json"), "{ invalid json").unwrap();

    let integration = ClaudeIntegration;
    let ctx = InstallContext {
        home,
        binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
    };
    let result = integration.install(&ctx);
    assert!(result.is_err(), "install must error on malformed settings.json");
}
```

---

### IN-03: `_binary_path` guard in `install()` is misleading without a comment

**File:** `src/integrations/claude.rs:40-43`

**Issue:** The pattern of extracting `binary_path` into `_binary_path` (validate but discard) is documented in `gemini.rs` (line 21: "validated as guard, but hooks.json uses bare 'plan-reviewer'") but not in `claude.rs`. A reader of `claude.rs` in isolation will not understand why the value is extracted then prefixed with `_`. Without the comment, it looks like dead code rather than an intentional guard.

**Fix:** Add the same comment found in `gemini.rs`:
```rust
// binary_path must be Some (validated as guard, but hooks.json uses bare "plan-reviewer")
let _binary_path = ctx
    .binary_path
    .as_deref()
    .ok_or_else(|| "install requires a binary_path — none was provided".to_string())?;
```

---

_Reviewed: 2026-04-11T20:48:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
