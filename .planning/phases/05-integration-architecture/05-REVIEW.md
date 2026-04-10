---
phase: 05-integration-architecture
reviewed: 2026-04-10T15:27:06Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/install.rs
  - src/integrations/claude.rs
  - src/integrations/gemini.rs
  - src/integrations/mod.rs
  - src/integrations/opencode.rs
  - src/main.rs
  - src/uninstall.rs
findings:
  critical: 2
  warning: 3
  info: 4
  total: 9
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-04-10T15:27:06Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase introduces the integration architecture: a trait-based `Integration` abstraction with a registry, a full `ClaudeIntegration` implementation, two stubs (`GeminiIntegration`, `OpenCodeIntegration`), and install/uninstall entry points wired into the CLI. The overall structure is clean and well-designed. The trait, registry, and slug enum are solid foundations.

Two critical issues were found: one causes silent destructive data loss when `settings.json` contains invalid JSON, and one is a latent panic path where chained `unwrap()` calls succeed only because `entry()` does not overwrite pre-existing non-object values. Three warnings round out correctness concerns around the watchdog/stdout write ordering, a swallowed uninstall error, and the empty-`binary_path` context used in the TUI picker.

## Critical Issues

### CR-01: Silent destructive overwrite of `settings.json` on invalid JSON

**File:** `src/integrations/claude.rs:22-29`

**Issue:** When `settings.json` exists but cannot be parsed as JSON, the code replaces the entire file content with `{}` after printing a warning to stderr. All pre-existing content — user hooks, IDE config, other tool configuration — is permanently lost. The user has no opportunity to abort, no backup is created, and no error is returned. The warning message itself says "existing content will be overwritten," but then proceeds to do so immediately and unconditionally.

**Fix:** Return an `Err` instead of silently continuing. Let the user decide:
```rust
Err(e) => {
    return Err(format!(
        "cannot parse {}: {} — refusing to overwrite. \
         Fix or remove the file first.",
        settings_path.display(), e
    ));
}
```
If silent recovery is intentional, at minimum write the original content to a `.bak` file before overwriting.

---

### CR-02: Latent panic on `unwrap()` when `hooks` key exists as a non-object

**File:** `src/integrations/claude.rs:49-74`

**Issue:** `entry("hooks").or_insert_with(...)` only inserts when the key is **absent**. If `settings.json` already contains `"hooks": null`, `"hooks": []`, or `"hooks": "string"`, the `entry()` call is a no-op and the existing non-object value is left in place. The subsequent `root["hooks"].as_object_mut().unwrap()` on line 57 then panics with an unhelpful thread-panic message. The same pattern repeats for `PermissionRequest` on line 74.

**Fix:** Replace both bare `unwrap()` calls with explicit error returns:
```rust
let hooks_obj = root["hooks"]
    .as_object_mut()
    .ok_or_else(|| {
        format!(
            "settings.json: expected 'hooks' to be an object, found: {}",
            root["hooks"]
        )
    })?;

hooks_obj
    .entry("PermissionRequest")
    .or_insert_with(|| serde_json::json!([]));

let pr_arr = hooks_obj["PermissionRequest"]
    .as_array_mut()
    .ok_or_else(|| {
        format!(
            "settings.json: expected 'hooks.PermissionRequest' to be an array"
        )
    })?;
```
Also apply the same fix to the `or_insert_with` for `hooks`: after calling `entry().or_insert_with()`, the value should be explicitly coerced rather than blindly unwrapped.

---

## Warnings

### WR-01: Watchdog spawned before hook output is written to stdout

**File:** `src/main.rs:309-312` and `src/main.rs:259`

**Issue:** `async_main` spawns a 3-second watchdog task (line 309) and then returns a `HookOutput`. Back in `run_hook_flow`, `serde_json::to_writer(stdout(), &output)` is called on line 259 only *after* `block_on(async_main(...))` returns. The watchdog timer is already running at that point. If the stdout write blocks or takes longer than 3 seconds (network-mounted home directory, slow pipe), `process::exit(0)` fires before the hook response is written, silently discarding the user's approve/deny decision and leaving Claude Code in an undefined state.

**Fix:** Move the watchdog spawn to after `serde_json::to_writer` completes in `run_hook_flow`, or flush and complete the write before `async_main` returns:
```rust
// In run_hook_flow, after the block_on:
serde_json::to_writer(std::io::stdout(), &output).expect("failed to write hook output");
// Now it is safe to exit
std::process::exit(0);
```
Remove the watchdog spawn inside `async_main` entirely, or replace it with a post-write explicit exit.

---

### WR-02: Uninstall silently swallows read errors

**File:** `src/integrations/claude.rs:120-130`

**Issue:** When `settings.json` cannot be read (permission denied, I/O error), `uninstall` prints to stderr and returns `Ok(())`. The caller in `uninstall.rs:30-33` only exits with an error on `Err`. The result is that a genuine failure during uninstall exits with code 0, giving the user and any scripted callers the false impression that uninstall succeeded.

**Fix:** Return `Err` for read failures so the exit code reflects reality:
```rust
Err(e) => {
    return Err(format!(
        "cannot read {}: {}",
        settings_path.display(), e
    ));
}
```

---

### WR-03: Empty `binary_path` in TUI picker `InstallContext` creates a footgun

**File:** `src/integrations/mod.rs:166-171`

**Issue:** `show_integration_picker` creates an `InstallContext` with `binary_path: String::new()` in order to call `is_installed`. The same struct type is used for actual installation. If any future code path passes this picker-constructed context to `install()` (an easy refactor mistake), the hook command will be written as an empty string into `settings.json` without any error — the write succeeds silently.

**Fix:** Encode the distinction in the type system. Either add a separate "check context" type, or use `Option<String>` for `binary_path`:
```rust
pub struct InstallContext {
    pub home: String,
    pub binary_path: Option<String>,  // None = check-only
}
```
Integrations' `install()` implementations should then fail fast if `binary_path` is `None`.

---

## Info

### IN-01: Non-object root JSON silently replaced

**File:** `src/integrations/claude.rs:38-46`

**Issue:** If `settings.json` contains valid JSON but the root value is not an object (e.g., `[1, 2, 3]` or `"hello"`), the code silently replaces the entire content with `{}` after printing a one-line warning. This is data loss, albeit for an unusual file shape. Same concern as CR-01, though lower priority because the file is structurally invalid for the tool's purpose.

**Fix:** Return `Err` and ask the user to fix the file manually, consistent with the fix for CR-01.

---

### IN-02: `resolve_integrations` does not deduplicate input

**File:** `src/integrations/mod.rs:128-143`

**Issue:** `plan-reviewer install claude claude` pushes two `Claude` slugs and the install loop runs twice. The second call is a no-op because `install` is idempotent, but the user sees the "already configured" message twice, which is confusing.

**Fix:** Add `slugs.dedup()` after the loop (requires sorting first for dedup to be reliable, or use a `HashSet`):
```rust
use std::collections::HashSet;
let mut seen = HashSet::new();
slugs.retain(|s| seen.insert(s.clone()));
```
Note: `IntegrationSlug` would need to derive `Hash` and `Eq` (it already derives `PartialEq`).

---

### IN-03: `run_uninstall` passes empty `binary_path` — symmetric with TUI picker issue

**File:** `src/uninstall.rs:23-26`

**Issue:** `binary_path` is set to `String::new()` because uninstall does not need it. This is technically harmless today since `ClaudeIntegration::uninstall` ignores it, but future integrations that do need the binary path for uninstall would silently receive an empty string. See WR-03 for the recommended fix via `Option<String>`.

---

### IN-04: `tokio::runtime::Builder::build()` result unwrapped without user-friendly message

**File:** `src/main.rs:250-253`

**Issue:** If the tokio runtime fails to build, the process panics with a raw thread-panic message rather than a clean `eprintln!` + `process::exit(1)`. While extremely rare, the experience for the user is poor.

**Fix:**
```rust
let rt = tokio::runtime::Builder::new_current_thread()
    .enable_all()
    .build()
    .unwrap_or_else(|e| {
        eprintln!("plan-reviewer: failed to start async runtime: {}", e);
        std::process::exit(1);
    });
```

---

_Reviewed: 2026-04-10T15:27:06Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
