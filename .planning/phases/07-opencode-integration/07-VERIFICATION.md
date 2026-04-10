---
phase: 07-opencode-integration
verified: 2026-04-10T23:00:00Z
status: human_needed
score: 9/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run plan-reviewer install opencode then trigger an opencode session that produces a plan"
    expected: "Browser tab opens showing the plan content with approve/deny controls"
    why_human: "Requires a live opencode installation and a model that triggers plan review; cannot simulate end-to-end plugin invocation in CI"
  - test: "In the live opencode session after the browser UI opens, click Approve"
    expected: "opencode receives the decision, the JS plugin returns 'Plan APPROVED by reviewer.' to opencode, and the session continues"
    why_human: "Full round-trip through execFileSync stdout parsing requires live opencode process; unit tests cover output format but not the full pipe"
  - test: "In the live opencode session after the browser UI opens, click Deny with a message"
    expected: "opencode receives the denial, the JS plugin returns 'Plan DENIED by reviewer. Feedback: <message>' to opencode"
    why_human: "Same as approve test — requires live opencode"
---

# Phase 7: opencode Integration Verification Report

**Phase Goal:** Users can install and uninstall plan-reviewer as an opencode hook via `plan-reviewer install opencode` and `plan-reviewer uninstall opencode`; the binary bundles the required JS plugin, writes it to disk on install, and wires `opencode.json`
**Verified:** 2026-04-10T23:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Plan 07-01 must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | plan-reviewer install opencode writes the JS plugin file to ~/.config/opencode/plugins/plan-reviewer-opencode.mjs | VERIFIED | Unit test `install_creates_config_and_plugin_when_no_files_exist` confirms file created; install() calls `fs::write(&plugin_path, &plugin_source)` |
| 2 | plan-reviewer install opencode adds the absolute plugin path to the plugin array in ~/.config/opencode/opencode.json | VERIFIED | Unit test verifies opencode_is_installed returns true after install; install() pushes plugin_path_str into root["plugin"] array |
| 3 | Running plan-reviewer install opencode twice does not duplicate the plugin entry (idempotent) | VERIFIED | Unit test `install_is_idempotent` confirms count==1 after two installs; idempotency check at line 91 returns early if already configured |
| 4 | plan-reviewer uninstall opencode removes the plugin file from disk | VERIFIED | Unit test `uninstall_removes_plugin_file_and_config_entry` confirms file removed; `fs::remove_file` called in uninstall() |
| 5 | plan-reviewer uninstall opencode removes the plugin path from opencode.json plugin array | VERIFIED | Same unit test confirms config entry cleaned; `retain()` removes matching path string |
| 6 | plan-reviewer uninstall opencode on a clean system exits 0 without error | VERIFIED | Unit test `uninstall_on_nonexistent_files_returns_ok` confirms Ok(()) returned |
| 7 | plan-reviewer install opencode on a system with no prior opencode config creates both the directory structure and files | VERIFIED | Unit test confirms both plugin file and opencode.json created; `create_dir_all` called before writes |

**Score (Plan 07-01):** 7/7 truths verified

### Observable Truths (Plan 07-02 must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 8 | Running plan-reviewer --plan-file /path/to/plan.md reads the plan from file, starts the browser review UI, and outputs a flat JSON decision to stdout | VERIFIED (partial) | File read confirmed (`fs::read_to_string(plan_file)`), `run_opencode_flow()` calls `async_main()` which starts browser; output format verified by 3 unit tests; end-to-end browser launch requires human |
| 9 | The --plan-file code path does NOT read stdin | VERIFIED | `run_opencode_flow()` never reads stdin; no `stdin()` call in function; `run_hook_flow()` is the separate path that reads stdin |
| 10 | The stdout output for the opencode path is a flat JSON object with behavior and optional message fields | VERIFIED | `build_opencode_output()` returns `{"behavior":"allow"}` or `{"behavior":"deny","message":"..."}` — confirmed by 3 unit tests (test_opencode_allow_output_format, test_opencode_deny_output_format, test_opencode_deny_without_message) |
| 11 | The existing Claude Code stdin flow continues to work exactly as before | VERIFIED | `run_hook_flow()` unchanged; all existing Claude/Gemini unit tests pass (59/59); 13 integration tests pass |
| 12 | The existing Gemini CLI hook flow continues to work exactly as before | VERIFIED | Same as above — `is_gemini()` routing in `run_hook_flow()` unchanged; Gemini integration tests pass |

**Score (Plan 07-02):** 5/5 truths verified (partial: browser launch for opencode path requires human)

### ROADMAP Success Criteria

| # | Success Criterion | Status | Evidence |
|---|------------------|--------|----------|
| SC-1 | plan-reviewer install opencode writes bundled JS plugin to correct disk location and adds plugin entry to opencode.json | VERIFIED | Truths 1 and 2 above; 18 unit tests in opencode.rs confirm |
| SC-2 | Triggering opencode plan review opens the plan-reviewer browser UI with plan content rendered | NEEDS HUMAN | Cannot automate without live opencode; --plan-file arg exists and wired to async_main which starts server, but full end-to-end requires human |
| SC-3 | Approving or denying in the browser returns the correct decision to opencode via JSON stdout (implementation uses execFileSync+stdout, not HTTP) | NEEDS HUMAN | Output format verified by unit tests; full round-trip through JS plugin requires live opencode |
| SC-4 | plan-reviewer uninstall opencode removes the plugin file and config entry, leaving opencode.json otherwise intact | VERIFIED | Truths 4 and 5; `uninstall_preserves_other_plugins_in_array` test confirms other entries preserved |

**Overall Score:** 9/12 must-haves verified (2 blocked by human-only testing, 1 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/integrations/opencode.rs` | Full OpenCodeIntegration implementation (install, uninstall, is_installed) | VERIFIED | 677 lines; `impl Integration for OpenCodeIntegration` present; all three trait methods implemented; 18 unit tests |
| `src/integrations/opencode_plugin.mjs` | JS plugin source file embedded at compile time | VERIFIED | 63 lines; submit_plan tool registered; execFileSync used; --plan-file argument; __PLAN_REVIEWER_BIN__ placeholder present exactly once |
| `src/integrations/mod.rs` | Opencode marked as available | VERIFIED | `Self::Opencode => true` at line 79; `opencode_stub_returns_err` removed; `opencode_integration_requires_binary_path` test added |
| `src/main.rs` | New --plan-file CLI argument and opencode output routing | VERIFIED | `plan_file: Option<String>` field; `run_opencode_flow()` function; `build_opencode_output()` function; 3 unit tests added |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| src/integrations/opencode.rs | src/integrations/opencode_plugin.mjs | include_str! macro embeds JS plugin at compile time | VERIFIED | `const OPENCODE_PLUGIN_SOURCE: &str = include_str!("opencode_plugin.mjs");` found at line 12 |
| src/integrations/opencode.rs | ~/.config/opencode/opencode.json | serde_json read/write of plugin array | VERIFIED | `opencode_config_path()` helper returns correct path; read and write confirmed in install/uninstall |
| src/integrations/opencode.rs | ~/.config/opencode/plugins/plan-reviewer-opencode.mjs | fs::write of embedded plugin source | VERIFIED | `opencode_plugin_path()` returns correct path; `fs::write(&plugin_path, &plugin_source)` at line 45 |
| src/main.rs --plan-file handling | server::start_server | Same browser review flow as hook path, plan loaded from file | VERIFIED | `run_opencode_flow()` calls `async_main()` which calls `server::start_server()`; `plan_file` pattern found |
| src/integrations/opencode_plugin.mjs | src/main.rs --plan-file | JS plugin invokes binary with --plan-file <tmpfile> | VERIFIED | Plugin uses `execFileSync(PLAN_REVIEWER_BIN, ["--plan-file", tmpFile], ...)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| opencode.rs install() | plugin_source | OPENCODE_PLUGIN_SOURCE (include_str!) with binary_path injected | Yes — embedded at compile time, placeholder replaced at install | FLOWING |
| main.rs run_opencode_flow() | plan_md | fs::read_to_string(plan_file) from file path | Yes — reads from provided file path | FLOWING |
| main.rs build_opencode_output() | decision | async_main() -> server::Decision from browser | Yes — real browser decision; format verified by unit tests | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| --plan-file argument shown in help | `cargo run -- --help 2>&1 \| grep plan-file` | `--plan-file <PLAN_FILE>  Read plan content from a file...` | PASS |
| All opencode unit tests pass | `cargo test integrations::opencode` | 18/18 passed | PASS |
| All mod-level integration tests pass | `cargo test integrations::tests` | 6/6 passed | PASS |
| Full test suite passes | `cargo test` | 72/72 passed (59 unit + 13 integration) | PASS |
| Opencode output format tests pass | `cargo test test_opencode` | 3/3 passed | PASS |
| clippy clean | `cargo clippy -- -D warnings` | 0 warnings | PASS |
| cargo fmt clean | `cargo fmt --check` | exit 0 | PASS |
| Live opencode trigger | requires live opencode agent | N/A | SKIP (human needed) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| INTEG-03 | 07-01, 07-02 | User can run plan-reviewer install opencode to wire plan review into opencode (writes bundled JS plugin to disk, updates opencode.json) | SATISFIED | install() writes plugin file + updates opencode.json; --plan-file routes opencode invocations; 18 unit tests + run_opencode_flow |
| INTEG-04 | 07-01 | User can run plan-reviewer uninstall opencode to remove opencode integration (removes plugin file and config entry) | SATISFIED | uninstall() removes plugin file + cleans config entry; 4 unit tests cover removal, clean-system idempotency, other-plugin preservation |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No stubs, placeholders, or empty implementations found in phase deliverables |

The only "placeholder" string found (`__PLAN_REVIEWER_BIN__`) is correctly used as a compile-time template constant in the embedded plugin source — it is replaced at install time before writing to disk. This is not an anti-pattern; it is the intended design.

### Human Verification Required

#### 1. Opencode Browser Launch

**Test:** Run `plan-reviewer install opencode` in a shell, then start an opencode AI session and let it produce a plan that triggers the `submit_plan` tool.
**Expected:** A browser tab opens at `http://127.0.0.1:<port>` with the plan rendered in the review UI. The URL is printed to stderr.
**Why human:** Requires a live opencode agent installation with a model that produces plans. The binary's `run_opencode_flow()` wiring and `async_main()` call exist and are verified structurally, but the full launch path cannot be automated without a running opencode process.

#### 2. Approve Decision Round-trip

**Test:** With the browser UI open from test #1, click Approve (or Add Feedback + Approve).
**Expected:** The `execFileSync` call in the JS plugin completes; `plan-reviewer` writes `{"behavior":"allow"}` to stdout; the JS plugin receives it, parses it, and returns `"Plan APPROVED by reviewer."` to opencode.
**Why human:** The JSON output format is verified by unit tests but the full subprocess stdout capture through execFileSync requires a live end-to-end run.

#### 3. Deny Decision Round-trip

**Test:** With the browser UI open, click Deny with a message such as "Needs more tests".
**Expected:** The JS plugin receives `{"behavior":"deny","message":"Needs more tests"}` on stdout, parses it, and returns `"Plan DENIED by reviewer. Feedback:\nNeeds more tests"` to opencode.
**Why human:** Same reason as test #2.

### Gaps Summary

No automated gaps found. All 12 must-have truths are either VERIFIED or blocked only by live-environment requirements (cannot test browser launch / opencode round-trip without a running opencode agent). The phase goal is structurally complete — the implementation correctly wires all components. Human verification items confirm end-to-end live behavior.

---

_Verified: 2026-04-10T23:00:00Z_
_Verifier: Claude (gsd-verifier)_
