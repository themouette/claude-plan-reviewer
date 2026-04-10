---
phase: 07-opencode-integration
plan: "02"
subsystem: main
tags: [opencode, cli, plan-file, hook-flow, json-output]
dependency_graph:
  requires: [07-01]
  provides: [opencode-runtime-flow, plan-file-cli-arg]
  affects: [src/main.rs]
tech_stack:
  added: []
  patterns: [file-read-not-stdin, flat-json-output, shared-async-main]
key_files:
  created: []
  modified:
    - src/main.rs
decisions:
  - "run_opencode_flow() shares async_main() with hook flow but outputs flat JSON instead of hookSpecificOutput"
  - "port argument threaded through run_opencode_flow for consistency with run_hook_flow signature"
  - "No stdin read in opencode path — plan content delivered via --plan-file temp file"
metrics:
  duration: ~8 minutes
  completed: "2026-04-10T22:00:00Z"
  tasks_completed: 1
  files_modified: 1
---

# Phase 07 Plan 02: OpenCode --plan-file CLI Argument Summary

**One-liner:** Added `--plan-file <path>` CLI argument to `plan-reviewer` so the opencode JS plugin can invoke the binary without stdin, with flat JSON output (`{"behavior":"allow"}` or `{"behavior":"deny","message":"..."}`).

## What Was Built

Added the runtime side of the opencode integration to `src/main.rs`. The JS plugin (from Plan 07-01) can now invoke `plan-reviewer --plan-file /tmp/plan.md` as a subprocess — the binary reads the plan from the file, runs the standard browser review flow, and outputs flat JSON.

### Task 1: Add --plan-file CLI argument and opencode review flow (commit 46485c3)

**Changes to `Cli` struct:**
- Added `plan_file: Option<String>` field with `#[arg(long)]` (clap exposes as `--plan-file`)

**New function `run_opencode_flow(no_browser: bool, port: u16, plan_file: &str)`:**
- Reads plan content from file with `fs::read_to_string` — does NOT read stdin
- Extracts diff from `std::env::current_dir()` (no HookInput cwd available)
- Starts tokio runtime and calls `async_main()` (shared with hook flow)
- Writes flat JSON to stdout via `build_opencode_output`

**New function `build_opencode_output(decision: &Decision) -> serde_json::Value`:**
- `"allow"` → `{"behavior":"allow"}` (no extra fields)
- `"deny"` → `{"behavior":"deny"}` with optional `"message"` field if present
- No `hookSpecificOutput`, no `decision` key — clean flat format matching JS plugin expectations

**Updated `main()` dispatch:**
- When `command` is `None` and `plan_file` is `Some(path)`: calls `run_opencode_flow`
- When `command` is `None` and `plan_file` is `None`: calls `run_hook_flow` (existing Claude Code + Gemini behavior, unchanged)

**3 new unit tests:**
- `test_opencode_allow_output_format` — verifies `{"behavior":"allow"}` with no extra fields
- `test_opencode_deny_output_format` — verifies `{"behavior":"deny","message":"..."}` with no hookSpecificOutput
- `test_opencode_deny_without_message` — verifies deny with no message has no message field

## Verification Results

| Check | Result |
|-------|--------|
| `cargo test test_opencode` | 3/3 passed |
| `cargo test --bin plan-reviewer` (full unit suite) | 59/59 passed |
| `cargo test` (including integration tests) | 72/72 passed (59 unit + 13 integration) |
| `cargo clippy -- -D warnings` | 0 warnings |
| `cargo fmt --check` | clean |
| `grep 'plan_file' src/main.rs` | found — CLI arg declaration and usage |
| `grep 'run_opencode_flow' src/main.rs` | found — function definition and call site |
| `grep 'build_opencode_output' src/main.rs` | found — definition + 3 test references + 1 call site |
| `grep 'read_to_string(plan_file)' src/main.rs` | found — file read (NOT stdin) |
| `grep 'current_dir' src/main.rs` | found — cwd extraction |
| `grep '"behavior"' src/main.rs` | found — opencode output format key |
| `grep 'run_hook_flow' src/main.rs` | found — unchanged |
| `grep 'is_gemini' src/main.rs` | found — Gemini routing unchanged |
| `cargo run -- --help \| grep plan-file` | `--plan-file <PLAN_FILE>  Read plan content from a file...` |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Note on Actual Signatures

The plan's interface documentation showed `async_main` returning `HookOutput`, but the actual implementation (added in Phase 05-06) returns `Decision`. The implementation correctly uses the actual signature (`async fn async_main(no_browser: bool, port: u16, plan_md: String, diff_content: String) -> Decision`). The `port` parameter was also threaded through `run_opencode_flow` for consistency with the existing `run_hook_flow` signature.

## Known Stubs

None. The opencode integration is now fully wired end-to-end:
- Plan 07-01: JS plugin (`opencode_plugin.mjs`) with install/uninstall
- Plan 07-02: binary `--plan-file` argument with flat JSON output

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| T-07-06 mitigated | src/main.rs | `--plan-file` path read with `fs::read_to_string` — read-only, never executed, never shell-passed. Diagnostics use `eprintln!`, not stdout. |
| T-07-07 mitigated | src/main.rs | `run_opencode_flow` has exactly one `serde_json::to_writer(stdout(), ...)` call. All diagnostics use `eprintln!`. Validated by 3 unit tests checking output format has no extra fields. |

No new threat surface beyond the plan's threat model.

## Self-Check: PASSED

### Files Created/Modified

- [x] `src/main.rs` — FOUND (--plan-file arg, run_opencode_flow, build_opencode_output, 3 tests)

### Commits

- [x] `46485c3` — FOUND (feat(07-02): add --plan-file CLI argument and opencode review flow)
