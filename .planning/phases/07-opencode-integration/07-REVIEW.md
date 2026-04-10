---
phase: 07-opencode-integration
reviewed: 2026-04-10T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/integrations/opencode_plugin.mjs
  - src/integrations/opencode.rs
  - src/integrations/mod.rs
  - src/main.rs
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-04-10
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four files implementing the OpenCode integration were reviewed: the JS plugin template, the Rust install/uninstall logic, the integrations module, and the main entry point.

The core logic is sound. Install/uninstall are idempotent, JSON config mutations are safe, and the stdout/behavior contract between the Rust binary and the JS plugin is internally consistent. Test coverage is thorough for the Rust side.

Three warnings were found: one potential runtime error if binary path substitution silently fails in the JS plugin, one missing frontend asset guard in the opencode flow, and one silent empty-string fallback for HOME in the TUI picker. Two info items cover minor code clarity opportunities.

## Warnings

### WR-01: No validation that binary path placeholder was actually replaced in plugin file

**File:** `src/integrations/opencode_plugin.mjs:9` / `src/integrations/opencode.rs:44`

**Issue:** `OPENCODE_PLUGIN_SOURCE.replace("__PLAN_REVIEWER_BIN__", binary_path)` silently produces a valid JS file even when `binary_path` is an empty string — for example if `ctx.binary_path` is `Some("")`. The resulting plugin would contain `const PLAN_REVIEWER_BIN = "";` and `execFileSync("")` would fail at OpenCode runtime with an opaque ENOENT error rather than a clear install-time message.

`binary_path` is already required to be `Some(...)` (line 29-31 guards `None`), but the value itself is never validated to be non-empty or to point to an executable.

**Fix:** Add a non-empty check in `install()` before performing the substitution:

```rust
let binary_path = ctx
    .binary_path
    .as_deref()
    .ok_or_else(|| "install requires a binary_path — none was provided".to_string())?;

if binary_path.is_empty() {
    return Err("install requires a non-empty binary_path".to_string());
}
```

Alternatively, assert post-replacement that the placeholder is gone:
```rust
let plugin_source = OPENCODE_PLUGIN_SOURCE.replace("__PLAN_REVIEWER_BIN__", binary_path);
debug_assert!(
    !plugin_source.contains("__PLAN_REVIEWER_BIN__"),
    "placeholder was not replaced — binary_path may be empty"
);
```

---

### WR-02: Debug-build frontend asset guard missing from opencode flow

**File:** `src/main.rs:410-443`

**Issue:** `run_hook_flow` (line 497-505) checks for `server::Assets::get("index.html")` in debug builds and exits early with a helpful message if frontend assets are missing. `run_opencode_flow` (line 410) starts the server without this guard. In a debug build without `ui/dist/`, the server will start and the browser will open, but every request will return a 404. The failure mode is silent and confusing.

**Fix:** Apply the same guard at the top of `run_opencode_flow`:

```rust
fn run_opencode_flow(no_browser: bool, port: u16, plan_file: &str) {
    #[cfg(debug_assertions)]
    {
        if server::Assets::get("index.html").is_none() {
            eprintln!("ERROR: Frontend assets not found at ui/dist/index.html");
            eprintln!(
                "Run 'cd ui && npm run build' first, or run 'cargo run' from the project root."
            );
            std::process::exit(1);
        }
    }

    // ... rest of function
}
```

---

### WR-03: HOME unset produces silent empty-string path in TUI picker

**File:** `src/integrations/mod.rs:170`

**Issue:** `std::env::var("HOME").unwrap_or_default()` returns `""` if `HOME` is unset. `InstallContext { home: "".to_string(), .. }` then passes empty home into `opencode_plugin_path("")` which returns `.config/opencode/plugins/plan-reviewer-opencode.mjs` (relative path). `is_installed` will then check for this relative path, which will always be `false` regardless of actual install state, silently mis-reporting installation status in the TUI picker.

**Fix:** Fail with a clear message if `HOME` is unset, consistent with how install paths depend on home:

```rust
let home = std::env::var("HOME").unwrap_or_else(|_| {
    eprintln!("plan-reviewer: HOME environment variable is not set");
    std::process::exit(1);
});
```

---

## Info

### IN-01: Unwrap on tokio runtime build is not descriptive

**File:** `src/main.rs:436`

**Issue:** `tokio::runtime::Builder::new_current_thread().build().unwrap()` panics with the generic "called `Result::unwrap()` on an `Err` value" if runtime construction fails (extremely rare but possible under resource exhaustion). The same pattern exists in `run_hook_flow` (line 518).

**Fix:** Use `expect` for a self-documenting panic message:

```rust
let rt = tokio::runtime::Builder::new_current_thread()
    .enable_all()
    .build()
    .expect("failed to build tokio runtime");
```

---

### IN-02: Backslash escaping in binary path not handled (Windows-only risk)

**File:** `src/integrations/opencode.rs:44`

**Issue:** `binary_path` is substituted verbatim into a JS string literal (`const PLAN_REVIEWER_BIN = "__PLAN_REVIEWER_BIN__";`). On Windows, a path like `C:\Users\alice\bin\plan-reviewer.exe` would produce invalid JS (`\U`, `\a`, `\b` are escape sequences). The project targets macOS and Linux exclusively (musl targets), so this is not a current issue, but worth noting if Windows support is ever added.

**Fix:** If Windows is added as a target, escape backslashes before substitution:

```rust
let escaped_path = binary_path.replace('\\', "\\\\");
let plugin_source = OPENCODE_PLUGIN_SOURCE.replace("__PLAN_REVIEWER_BIN__", &escaped_path);
```

---

_Reviewed: 2026-04-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
