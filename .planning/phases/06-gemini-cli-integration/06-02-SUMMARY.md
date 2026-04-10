---
phase: 06-gemini-cli-integration
plan: "02"
subsystem: hook-flow
tags: [gemini, hook, rust, integration]
dependency_graph:
  requires: [06-01]
  provides: [gemini-hook-runtime]
  affects: [src/hook.rs, src/main.rs]
tech_stack:
  added: []
  patterns: [integration-aware-output-routing, plan-path-file-read, helper-extraction]
key_files:
  created: []
  modified:
    - src/hook.rs
    - src/main.rs
decisions:
  - "Return Decision from async_main instead of HookOutput — keeps output format selection at run_hook_flow level where hook_event_name is available"
  - "build_gemini_output() as named helper — enables unit testing without async runtime"
  - "Prefer inline plan over plan_path when both present — Claude Code takes priority, mirrors documented intent"
metrics:
  duration_minutes: 12
  completed_date: "2026-04-10T20:04:37Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 06 Plan 02: Gemini CLI Hook Flow Extension Summary

Gemini CLI BeforeTool hook support wired into `run_hook_flow`: reads plan Markdown from `tool_input.plan_path` (file on disk) for Gemini, uses inline `tool_input.plan` for Claude Code, and emits the correct flat `{decision, reason, systemMessage}` JSON for Gemini vs. the nested `hookSpecificOutput` envelope for Claude Code.

## What Was Built

### src/hook.rs

- Added `pub plan_path: Option<String>` field to `ToolInput` — Gemini CLI path to plan Markdown file
- Added `impl HookInput { pub fn is_gemini(&self) -> bool }` — detects Gemini by `hook_event_name == "BeforeTool"`
- Removed `#[allow(dead_code)]` from `hook_event_name` field (now actively used)

### src/main.rs

- Added `extract_plan_content(tool_input: &hook::ToolInput) -> String` — prefers inline plan (Claude), falls back to file read (Gemini), returns empty string if neither
- Added `build_gemini_output(decision: &Decision) -> serde_json::Value` — constructs flat Gemini response JSON
- Refactored `async_main` return type: `HookOutput` -> `Decision` (output format selection moved to caller)
- Updated `run_hook_flow`: uses `extract_plan_content`, calls `hook_input.is_gemini()` to route output format
- Added 8 unit tests covering both integration paths and all plan extraction edge cases

## Verification Results

- `cargo test`: 21/21 passed (8 new + 13 existing)
- `cargo clippy -- -D warnings`: 0 warnings
- `cargo fmt --check`: exit 0
- `cargo build`: exit 0

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes

The Task 1 commit (`bf54f70`) includes additional file changes from the worktree `git reset --soft` alignment step (planning artifacts from phase 05 and the `src/integrations/` -> `src/integration.rs` refactor from phase 05). These were already in the base commit `0d5d2a8` and were correctly staged as part of catching the worktree up to the right base. The actual source change in that commit is only `src/hook.rs`.

## Known Stubs

None — all Gemini hook flow paths are fully implemented and tested.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes beyond what the threat model already covers (T-06-05, T-06-06, T-06-07).

## Threat Model Coverage

| Threat | Mitigation Applied |
|--------|--------------------|
| T-06-05: Path traversal via plan_path | `fs::read_to_string` read-only, never executed, never shell-passed |
| T-06-06: Stdout pollution | All debug uses `eprintln!`; only `serde_json::to_writer(stdout(), ...)` writes to stdout |
| T-06-07: Wrong JSON envelope | `hook_input.is_gemini()` routes to correct format; both paths tested |

## Self-Check

- [x] `src/hook.rs` modified and committed in bf54f70
- [x] `src/main.rs` modified and committed in 5fd72d2
- [x] All acceptance criteria verified via grep and cargo test
