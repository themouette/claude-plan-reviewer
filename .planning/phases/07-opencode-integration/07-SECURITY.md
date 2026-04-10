---
phase: 07-opencode-integration
auditor: gsd-security-auditor
asvs_level: 1
block_on: critical
threats_total: 8
threats_closed: 8
threats_open: 0
status: SECURED
---

# Security Audit — Phase 07: OpenCode Integration

**Threats Closed:** 8/8
**ASVS Level:** 1
**Block-on:** critical

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-07-01 | Tampering | mitigate | CLOSED | `src/integrations/opencode.rs` lines 59–64: parse failure returns `Err` containing "refusing to overwrite. Fix or remove the file first." — never silently replaces corrupted config |
| T-07-02 | Tampering | accept | CLOSED | `src/integrations/opencode.rs` line 44–47: plugin file always overwritten via `std::fs::write`; idempotency check applies only to the config entry, not the plugin file. Intentional behavior documented in 07-01-SUMMARY.md decisions |
| T-07-03 | Information Disclosure | accept | CLOSED | `src/integrations/opencode.rs` line 44: `__PLAN_REVIEWER_BIN__` replaced with user's own binary path — not sensitive data. Path is written to user's own config directory |
| T-07-04 | Denial of Service | mitigate | CLOSED | `src/integrations/opencode_plugin.mjs` line 40: `timeout: 600000` in `execFileSync` options — prevents infinite hang |
| T-07-05 | Elevation of Privilege | mitigate | CLOSED | `src/integrations/opencode.rs` lines 243–245: `opencode_plugin_path` constructs path as `PathBuf::from(home).join(".config/opencode/plugins/plan-reviewer-opencode.mjs")` — relative portion is a hardcoded string literal; no user-supplied path fragments accepted |
| T-07-06 | Information Disclosure | accept | CLOSED | `src/main.rs` lines 411–418: `std::fs::read_to_string(plan_file)` — read-only operation; path never executed, never shell-passed, never written to stdout. Diagnostics via `eprintln!` only. Local-only tool |
| T-07-07 | Tampering | mitigate | CLOSED | `src/main.rs` line 442: `run_opencode_flow` contains exactly one `serde_json::to_writer(std::io::stdout(), &output)` call; all diagnostics use `eprintln!` (lines 419–430). Validated by 3 unit tests: `test_opencode_allow_output_format`, `test_opencode_deny_output_format`, `test_opencode_deny_without_message` |
| T-07-08 | Denial of Service | accept | CLOSED | `src/main.rs` line 412: `std::fs::read_to_string` loads full file into memory — accepted for local-only tool operating on user's own files |

---

## Accepted Risks Log

| Threat ID | Risk | Rationale |
|-----------|------|-----------|
| T-07-02 | Tampering: plugin file overwritten on reinstall | Intentional idempotent design — ensures binary path stays current; documented in install output messages |
| T-07-03 | Information Disclosure: binary path in plugin file | User's own binary path in user's own home directory; not sensitive data |
| T-07-06 | Information Disclosure: arbitrary file read via --plan-file | Read-only, local-only tool, attacker needs local shell access; path not logged to stdout; risk LOW |
| T-07-08 | Denial of Service: large file OOM via --plan-file | User-invoked on user's own files on user's own machine; local-only tool; no mitigation warranted |

---

## Unregistered Threat Flags

None. Both 07-01-SUMMARY.md and 07-02-SUMMARY.md explicitly state no new threat surface beyond the plan's threat model.

---

## Audit Notes

- ASVS Level 1 requirements satisfied: no authentication bypass, no unvalidated input reaching execution, no stdout pollution in the opencode flow.
- The `--plan-file` path traversal surface (T-07-06) is accepted at ASVS Level 1 given the local-only, single-user deployment model. An attacker with local shell access to the user's session already has equivalent file read capability.
- The `execFileSync` approach in the JS plugin correctly avoids GitHub issue #21293 (stdin unreliability with `spawn`); plan content is delivered via temp file, not piped stdin.
- All 8 threats verified. No implementation gaps found.
