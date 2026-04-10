---
phase: 04-add-subcommands-install-uninstall-update
reviewed: 2026-04-10T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - Cargo.toml
  - install.sh
  - src/install.rs
  - src/integration.rs
  - src/main.rs
  - src/uninstall.rs
  - src/update.rs
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-04-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase adds `install`, `uninstall`, and `update` subcommands plus an `integration` module that centralises Claude Code settings-file logic. The overall design is solid: idempotency semantics are clear, the TTY check before showing the TUI picker is correct, and security-sensitive paths (version tag sanitisation, no user-supplied path fragments) are explicitly called out.

Four warnings need attention before shipping:

- A panic path in `install_claude` when `settings.json` already contains a `"hooks"` key whose value is not a JSON object, or a `"PermissionRequest"` key whose value is not a JSON array.
- A silent bad-path scenario in the TUI picker when `$HOME` is unset.
- Inconsistent error-exit behaviour between `install` and `uninstall` on file-read failure.
- A fragile tar-path assumption in `install.sh` that would silently produce a misleading error if the cargo-dist archive layout changes.

---

## Warnings

### WR-01: Panic on unexpected JSON structure in `install_claude`

**File:** `src/install.rs:102-121`

**Issue:** Two `.unwrap()` calls assume that `root["hooks"]` is a JSON object and `root["hooks"]["PermissionRequest"]` is a JSON array. The first assumption holds only when the existing `settings.json` contains `"hooks"` as an object. If the file already has `"hooks": null`, `"hooks": "string"`, or any non-object value, line 104 (`.as_object_mut().unwrap()`) panics. Similarly, if `"PermissionRequest"` already exists with a non-array value (e.g. `"PermissionRequest": null`), line 120 (`.as_array_mut().unwrap()`) panics. The `or_insert_with` guard (lines 98-99 and 105-106) only inserts the key when it is absent; it does not normalise an existing wrong-typed value.

**Fix:**
```rust
// Replace the two .unwrap() calls with explicit error handling

// Ensure root.hooks is an object
let hooks = root.as_object_mut().unwrap(); // safe — root is always an object here
let hooks_val = hooks.entry("hooks").or_insert_with(|| serde_json::json!({}));
if !hooks_val.is_object() {
    eprintln!(
        "plan-reviewer install: {}: \"hooks\" key is not a JSON object; cannot modify safely",
        settings_path.display()
    );
    std::process::exit(1);
}

// Ensure root.hooks.PermissionRequest is an array
let perm_req = hooks_val.as_object_mut().unwrap()
    .entry("PermissionRequest")
    .or_insert_with(|| serde_json::json!([]));
if !perm_req.is_array() {
    eprintln!(
        "plan-reviewer install: {}: \"hooks.PermissionRequest\" is not a JSON array; cannot modify safely",
        settings_path.display()
    );
    std::process::exit(1);
}

// Push the new hook entry (safe — we just verified it is an array)
perm_req.as_array_mut().unwrap()
    .push(integration::claude_hook_entry(binary_path));
```

---

### WR-02: Silent empty-string HOME path in TUI picker (`show_integration_picker`)

**File:** `src/integration.rs:190`

**Issue:** `std::env::var("HOME").unwrap_or_default()` silently falls back to `""` when `$HOME` is unset. All subsequent filesystem calls using `claude_settings_path("")` resolve to `"/.claude/settings.json"` — a root-owned file. On most systems this means reads will silently return `Err` (permission denied), causing the picker to incorrectly display all integrations as not-yet-installed and the defaults to be all-false. The user sees no warning, and a follow-up install attempt will then fail at a different point with a confusing error.

The callers `run_install` and `run_uninstall` correctly check for `$HOME` with `std::env::var("HOME")` and exit(1) on error. The picker must do the same.

**Fix:**
```rust
pub fn show_integration_picker(prompt: &str) -> Vec<IntegrationSlug> {
    use dialoguer::{MultiSelect, theme::ColorfulTheme};
    use dialoguer::console::Term;

    let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => {
            eprintln!("plan-reviewer: HOME environment variable not set");
            std::process::exit(1);
        }
    };

    // ... rest of function unchanged ...
}
```

---

### WR-03: `uninstall_claude` silently returns (no exit code) on file-read error

**File:** `src/uninstall.rs:61-70`

**Issue:** When `std::fs::read_to_string` fails (e.g. permission denied), `uninstall_claude` prints an error and returns normally. The calling loop in `run_uninstall` then moves on to the next slug without any indication that this one failed. The process ultimately exits with code 0 even though the uninstall did not happen.

`install_claude` handles the equivalent error with `std::process::exit(1)` (`src/install.rs:78`). The uninstall path should be consistent.

**Fix:**
```rust
let content = match std::fs::read_to_string(&settings_path) {
    Ok(c) => c,
    Err(e) => {
        eprintln!(
            "plan-reviewer uninstall: cannot read {}: {}",
            settings_path.display(),
            e
        );
        std::process::exit(1); // was: return
    }
};
```

---

### WR-04: Hard-coded tar extraction path in `install.sh` is fragile

**File:** `install.sh:62-66`

**Issue:** The script extracts the tarball and then copies the binary from the assumed path `${TMPDIR}/${BINARY}-${LATEST_TAG}-${TARGET}/${BINARY}`. This path is derived from the cargo-dist naming convention. If the convention changes (e.g. no version in directory name, or a flat archive), the `cp` command fails with "No such file or directory" — but the error message will name a path that never existed, making diagnosis difficult. Additionally, `set -eu` means the script aborts with an exit code of 1 and no explanation targeted at the user.

**Fix:** Verify the extracted path exists before copying, and emit a clear diagnostic if the layout differs:
```sh
EXTRACTED_DIR="${TMPDIR}/${BINARY}-${LATEST_TAG}-${TARGET}"
EXTRACTED_BIN="${EXTRACTED_DIR}/${BINARY}"

if [ ! -f "${EXTRACTED_BIN}" ]; then
  echo "ERROR: Expected binary not found at ${EXTRACTED_BIN}" >&2
  echo "Archive contents:" >&2
  ls "${TMPDIR}" >&2
  exit 1
fi

cp "${EXTRACTED_BIN}" "${INSTALL_DIR}/${BINARY}"
```

---

## Info

### IN-01: Variable shadowing in `perform_update` reduces readability

**File:** `src/update.rs:51-75`

**Issue:** `resolved_target` is declared twice with `let`, the second declaration shadowing the first. While valid Rust, this pattern makes it harder to follow data flow, especially since the two bindings have different types — the first is `Option<String>` built from raw CLI input, the second is `Option<String>` after the "already up to date" check. Renaming would clarify intent.

**Fix:** Use a single binding with a distinct name for the second assignment:
```rust
let pinned_version = match target_version { ... };  // raw user input, v-stripped
let target = if pinned_version.is_none() { ... } else { pinned_version };
```

---

### IN-02: GitHub API JSON parsing in `install.sh` is brittle

**File:** `install.sh:40-42`

**Issue:** The release tag is extracted from the GitHub API response using `grep '"tag_name"' | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/'`. This assumes the `tag_name` key appears on a single line and with a specific whitespace pattern. It will fail if the API response is minified or formatted differently. It also does not handle rate-limiting responses (HTTP 403/429) which may return a JSON error body without a `tag_name` field — the empty-string check at line 44 catches the symptom but not the cause.

**Fix:** If `jq` cannot be assumed, prefer a more defensive `sed` pattern and add an HTTP error check:
```sh
API_RESPONSE="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")"
LATEST_TAG="$(printf '%s' "${API_RESPONSE}" | grep -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')"
```
Or document the `jq` dependency and use `jq -r '.tag_name'` directly.

---

### IN-03: `install.sh` invokes the binary immediately after copy without verifying executability

**File:** `install.sh:90`

**Issue:** `"${INSTALL_DIR}/${BINARY}" install claude` is called right after `chmod +x`. On some Linux configurations (e.g. filesystems mounted `noexec`, or musl binary on a glibc-only system), this call will fail with an OS error that is not caught by the script's `set -eu` in a user-friendly way. The error may be confusing ("Exec format error") with no guidance.

**Fix:** Add a brief test-run before wiring the hook:
```sh
if ! "${INSTALL_DIR}/${BINARY}" --version > /dev/null 2>&1; then
  echo "WARNING: ${BINARY} does not appear to be executable on this system." >&2
  echo "Hook wiring skipped. Run '${INSTALL_DIR}/${BINARY} install claude' manually once verified." >&2
  exit 0
fi
"${INSTALL_DIR}/${BINARY}" install claude
```

---

_Reviewed: 2026-04-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
