---
phase: 05-integration-architecture
fixed_at: 2026-04-10T18:57:27Z
review_path: .planning/phases/05-integration-architecture/05-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 3
skipped: 2
status: partial
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-04-10T18:57:27Z
**Source review:** .planning/phases/05-integration-architecture/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, CR-02, WR-01, WR-02, WR-03)
- Fixed: 3 (WR-01, WR-02, WR-03)
- Skipped: 2 (CR-01, CR-02 — already fixed prior to this run)

## Fixed Issues

### WR-01: Watchdog spawned before hook output written to stdout

**Files modified:** `src/main.rs`
**Commit:** 126672a
**Applied fix:** Removed the `tokio::spawn` watchdog from inside `async_main`. After `serde_json::to_writer` completes in `run_hook_flow`, a synchronous `rt.block_on` sleep of 3 seconds runs followed by `process::exit(0)`. This guarantees the stdout write always completes before the process exits.

---

### WR-02: Uninstall silently swallows read errors

**Files modified:** `src/integrations/claude.rs`
**Commit:** e47d37b
**Applied fix:** Changed the `Err(e)` arm of `std::fs::read_to_string` in `ClaudeIntegration::uninstall` from `eprintln!(...); return Ok(())` to `return Err(format!("cannot read {}: {}", ...))`. The caller in `uninstall.rs` already propagates `Err` to `process::exit(1)`, so the exit code now correctly reflects the failure.

---

### WR-03: Empty `binary_path` in TUI picker and uninstall creates a footgun

**Files modified:** `src/integrations/mod.rs`, `src/integrations/claude.rs`, `src/install.rs`, `src/uninstall.rs`
**Commit:** e00b721
**Applied fix:** Changed `binary_path: String` to `binary_path: Option<String>` in `InstallContext`. Updated all construction sites: `install.rs` passes `Some(binary_path)`, while the TUI picker (`mod.rs`) and `uninstall.rs` pass `None`. `ClaudeIntegration::install` now extracts the path with `ok_or_else` and returns `Err` immediately if `None` is passed, preventing silent empty-string writes. Test fixtures in `mod.rs` also updated to `None`.

---

## Skipped Issues

### CR-01: Silent destructive overwrite of `settings.json` on invalid JSON

**File:** `src/integrations/claude.rs:22-29`
**Reason:** Already fixed prior to this review run. Current code at lines 24-31 already returns `Err(format!("cannot parse {}: {} — refusing to overwrite...", ...))` matching the reviewer's suggested fix exactly. No change needed.
**Original issue:** When `settings.json` existed but could not be parsed, the code replaced the file with `{}` — all pre-existing content would be permanently lost.

---

### CR-02: Latent panic on `unwrap()` when `hooks` key exists as a non-object

**File:** `src/integrations/claude.rs:49-74`
**Reason:** Already fixed prior to this review run. Current code at lines 64-87 already uses `ok_or_else` with explicit error messages for both the `hooks` object and the `PermissionRequest` array, matching the reviewer's suggested fix. No change needed.
**Original issue:** If `settings.json` contained `"hooks": null` or another non-object, the subsequent `as_object_mut().unwrap()` would panic.

---

_Fixed: 2026-04-10T18:57:27Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
