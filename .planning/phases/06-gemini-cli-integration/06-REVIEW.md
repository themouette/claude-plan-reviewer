---
phase: 06-gemini-cli-integration
reviewed: 2026-04-10T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/hook.rs
  - src/integrations/gemini.rs
  - src/integrations/mod.rs
  - src/main.rs
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-04-10
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

This review covers the Gemini CLI integration phase: the new `GeminiIntegration` struct, updates to `hook.rs` for dual-protocol handling, the `mod.rs` integration registry, and the revised `main.rs` hook flow.

The code is well-structured and the install/uninstall logic for Gemini is solid — idempotency is correctly implemented, existing settings keys are preserved, and the test suite is thorough. Three issues require attention before shipping: fragile Gemini detection based on `hook_event_name` alone, a broken watchdog task, and a hard `process::exit` inside `extract_plan_content` that bypasses the hook's JSON output contract.

---

## Warnings

### WR-01: Gemini detection via `hook_event_name == "BeforeTool"` is ambiguous

**File:** `src/hook.rs:20-22` (also exercised at `src/main.rs:392`)

**Issue:** `is_gemini()` returns `true` whenever `hook_event_name == "BeforeTool"`, treating that field as an exclusive Gemini signal. If Claude Code or another integration ever emits a `BeforeTool` event for a different tool, the binary will serialize the wrong output format (flat Gemini JSON instead of nested `hookSpecificOutput`), silently breaking the Claude Code hook contract and producing no useful error.

The detection should be narrowed — Gemini CLI also sends a recognizable `tool_name` (the matched tool) or a distinct payload structure that can disambiguate.

**Fix:** Add a secondary discriminator. The simplest safe option is to check `tool_input.plan_path.is_some()` as a Gemini-specific signal (Claude Code always uses `plan`, Gemini always uses `plan_path`), or expose the agent identity as a separate field if the protocol allows it:

```rust
pub fn is_gemini(&self) -> bool {
    // Gemini CLI sets hook_event_name = "BeforeTool" AND delivers
    // the plan via plan_path (not inline).  Claude Code uses "ExitPlanMode"
    // and always sends plan inline.
    self.hook_event_name == "BeforeTool"
        && self.tool_input.plan_path.is_some()
        && self.tool_input.plan.is_none()
}
```

---

### WR-02: `extract_plan_content` calls `process::exit(1)` on file-read failure, emitting no JSON to stdout

**File:** `src/main.rs:296-300`

**Issue:** When `plan_path` points to a file that cannot be read, the function calls `std::process::exit(1)` directly. At this point in `run_hook_flow`, no JSON has been written to stdout yet. Both Claude Code and Gemini CLI expect a valid JSON response on stdout — an empty stdout causes the hook host to fail with a protocol error rather than receiving a structured deny with a useful message.

```rust
Err(e) => {
    eprintln!("Failed to read plan file at {}: {}", plan_path, e);
    std::process::exit(1);  // <-- no JSON written; hook host gets nothing
}
```

**Fix:** Return a `Result<String, String>` from `extract_plan_content` and let `run_hook_flow` emit a proper deny response:

```rust
fn extract_plan_content(tool_input: &hook::ToolInput) -> Result<String, String> {
    if let Some(ref plan) = tool_input.plan {
        return Ok(plan.clone());
    }
    if let Some(ref plan_path) = tool_input.plan_path {
        return std::fs::read_to_string(plan_path)
            .map_err(|e| format!("Failed to read plan file at {}: {}", plan_path, e));
    }
    Ok(String::new())
}
```

Then in `run_hook_flow`:

```rust
let plan_md = extract_plan_content(&hook_input.tool_input).unwrap_or_else(|e| {
    eprintln!("{}", e);
    // Write deny JSON to stdout before exiting
    let deny = if hook_input.is_gemini() {
        serde_json::json!({"decision": "deny", "reason": e, "systemMessage": "Internal error"})
    } else {
        serde_json::to_value(HookOutput::deny(e)).unwrap()
    };
    serde_json::to_writer(std::io::stdout(), &deny).ok();
    std::process::exit(1);
});
```

---

### WR-03: Watchdog task spawned in `async_main` is silently dropped before it can fire

**File:** `src/main.rs:463-467`

**Issue:** The 3-second watchdog task is spawned inside `async_main` and is intended to call `process::exit(0)` after stdout has been written. However, the runtime `rt` is in scope in `run_hook_flow` and owns the spawned task. When `rt.block_on(async_main(...))` returns, `rt` continues to exist while the stdout write happens, but is dropped at the end of `run_hook_flow` — which cancels all pending tasks including the watchdog. In a `current_thread` runtime, `tokio::spawn`-ed tasks only run when the runtime is being polled. After `block_on` returns, the runtime is idle and the spawned task never gets a chance to sleep-and-exit.

In practice the process exits correctly (naturally when `main()` returns), so this is not a visible bug today. However the watchdog comment claims it guards HOOK-04 (clean exit after stdout write), a guarantee it cannot currently fulfill if the server's TCP connections are somehow keeping the process alive in a future scenario.

**Fix:** Either move the watchdog outside the async context (using a regular thread) or restructure so the runtime stays alive until after stdout write:

```rust
// In run_hook_flow, after writing stdout:
serde_json::to_writer(std::io::stdout(), &output_json).expect("failed to write hook output");

// Force clean exit; this kills any lingering server connections.
std::process::exit(0);
```

Alternatively, spawn the watchdog on a dedicated OS thread before writing stdout so it is not subject to runtime lifetime:

```rust
// After block_on returns, before writing stdout:
std::thread::spawn(|| {
    std::thread::sleep(std::time::Duration::from_secs(3));
    std::process::exit(0);
});
```

---

## Info

### IN-01: `HOME` env var falls back to empty string in interactive TUI picker

**File:** `src/integrations/mod.rs:170`

**Issue:** `std::env::var("HOME").unwrap_or_default()` silently uses an empty string if `HOME` is unset. This produces paths like `/.gemini/settings.json`, which could accidentally access system-level paths. While rare in practice (HOME is nearly always set on Unix), the silent fallback masks a misconfigured environment.

**Fix:** Either warn the user or use a more explicit fallback:

```rust
let home = std::env::var("HOME").unwrap_or_else(|_| {
    eprintln!("plan-reviewer: warning: HOME environment variable not set; \
               installed-status check will be inaccurate");
    String::new()
});
```

---

### IN-02: `build_gemini_output` silently treats any non-"allow" behavior as "deny"

**File:** `src/main.rs:306-314`

**Issue:** The wildcard arm `_ =>` maps any unrecognized behavior value (e.g., a future "skip" or "block" behavior) to a deny response without logging. This makes the function non-exhaustive by design but could silently misbehave if new `Decision` behaviors are introduced.

**Fix:** Add explicit arms and log unexpected values:

```rust
fn build_gemini_output(decision: &Decision) -> serde_json::Value {
    match decision.behavior.as_str() {
        "allow" => serde_json::json!({ "decision": "allow" }),
        "deny" => serde_json::json!({
            "decision": "deny",
            "reason": decision.message.as_deref().unwrap_or("Denied without message"),
            "systemMessage": "Plan denied by plan-reviewer. Please revise the plan."
        }),
        other => {
            eprintln!("plan-reviewer: unexpected decision behavior '{}'; defaulting to deny", other);
            serde_json::json!({
                "decision": "deny",
                "reason": format!("Unexpected behavior: {}", other),
                "systemMessage": "Plan denied by plan-reviewer. Please revise the plan."
            })
        }
    }
}
```

---

_Reviewed: 2026-04-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
