---
phase: 29
slug: code-review-integration
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-26
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for Phase 29: code-review-integration.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cargo test (Rust unit + integration) |
| **Config file** | Cargo.toml — no separate config required |
| **Quick run command** | `cargo test` |
| **Full suite command** | `cargo test && cargo clippy --all-targets -- -D warnings && cargo fmt --check` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cargo test`
- **After every plan wave:** Run `cargo test && cargo clippy --all-targets -- -D warnings`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 29-01-01 | 01 | 1 | INTEG-01, INTEG-02 | T-29-02, T-29-05 | `pre-pr-hook` clap name is exactly `pre-pr-hook`, not `pre-p-r-hook` | unit | `cargo test test_cli_code_review_subcommand_parses test_cli_code_review_with_no_browser_and_port test_cli_pre_pr_hook_subcommand_parses test_extract_command_from_tool_input_present test_extract_command_from_tool_input_missing test_is_pr_command_matches` | ✅ green |
| 29-01-02 | 01 | 1 | INTEG-02 | T-29-01, T-29-02 | Non-PR commands exit 0 silently with zero stdout; PR commands trigger code-review flow | unit | `cargo test test_async_main_builds_url_with_path test_run_pre_pr_hook_flow_exits_silently_on_non_pr_command test_run_pre_pr_hook_flow_triggers_on_gh_pr_create test_run_pre_pr_hook_flow_triggers_on_git_push test_run_pre_pr_hook_flow_handles_missing_command_field` | ✅ green |
| 29-01-03 | 01 | 1 | INTEG-01, INTEG-02 | T-29-02 | `--help` lists both subcommands; `pre-pr-hook` exits 0 < 2s on non-PR stdin | integration | `cargo test --test integration help_includes_code_review_subcommand code_review_subcommand_help_describes_purpose pre_pr_hook_exits_silently_on_non_pr_command` | ✅ green |
| 29-02-01 | 02 | 2 | INTEG-01, INTEG-02, INTEG-03 | T-29-06, T-29-07 | hooks.json retains both PermissionRequest and PreToolUse after install; code-review.md has plugin-namespaced heading | unit | `cargo test install_creates_code_review_md_with_expected_content install_creates_hooks_json_with_pre_tool_use install_hooks_json_preserves_exit_plan_mode_after_pre_tool_use_added install_creates_code_review_md_even_when_already_installed` | ✅ green |
| 29-02-02 | 02 | 2 | INTEG-01, INTEG-02, INTEG-03 | T-29-09, T-29-10, T-29-11 | install round-trip creates correct files; uninstall removes them; PreToolUse timeout is 600000 | integration | `cargo test --test integration install_claude_creates_commands_code_review_md install_claude_writes_pre_tool_use_hook_in_hooks_json uninstall_claude_removes_code_review_md` | ✅ green |
| 29-02-03 | 02 | 2 | INTEG-01, INTEG-02, INTEG-03 | — | Full suite green; no regressions in existing install/uninstall/idempotency tests | suite | `cargo test && cargo clippy --all-targets -- -D warnings && cargo fmt --check` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Test counts at phase close:** 135 unit + 29 integration = 164 total (was 132+29=161 before phase; +3 from Plan 29-01 integration tests added in final commit).

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* Rust test infrastructure was in place before this phase. No new framework install or stub files needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/plan-reviewer:code-review` appears in Claude Code slash command menu after install | INTEG-01 | Requires a live Claude Code session to inspect the slash command registry | Run `plan-reviewer install claude`, open Claude Code, type `/plan-reviewer:` and confirm `code-review` appears |
| `plan-reviewer code-review` opens the browser at `/code-review` | INTEG-01 | Involves `webbrowser::open` and a real browser — not testable in headless CI | Run `plan-reviewer code-review`, observe browser opens at `http://127.0.0.1:{port}/code-review` |
| Agent-triggered pre-PR hook fires when Claude runs `gh pr create` | INTEG-02 | Requires a live Claude Code session executing a real PR creation flow | Trigger `gh pr create` inside a Claude session with install in place; observe review UI opens |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify blocks
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No Wave 0 gaps — existing infrastructure covers all requirements
- [x] No watch-mode flags in any automated command
- [x] Feedback latency < 5s (`cargo test` completes in ~2s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-26

---

## Validation Audit 2026-05-26

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated to manual-only | 3 |
| Requirements COVERED | 3 (INTEG-01, INTEG-02, INTEG-03) |
| Requirements PARTIAL | 0 |
| Requirements MISSING | 0 |
