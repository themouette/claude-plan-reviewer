---
phase: 05-integration-architecture
slug: integration-architecture
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-10
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| filesystem → settings.json | Install/uninstall reads and writes Claude Code settings file from user's home directory | JSON config (non-sensitive, no credentials) |
| CLI args → IntegrationSlug | User-provided integration names are parsed into enum variants | String → enum (bounded, no secrets) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-05-01 | T (Tampering) | ClaudeIntegration::install | accept | Settings path derived from HOME env var; same trust boundary as v0.1.0; no new attack surface introduced by this refactor | closed |
| T-05-02 | I (Info Disclosure) | Integration trait error messages | mitigate | Trait methods return `Err(String)` with file paths and OS errors only; no secrets, credentials, or internal state exposed. Verified in code: `cannot read/write/create {path}: {os_error}` pattern throughout claude.rs | closed |
| T-05-03 | D (Denial of Service) | Stub install() returning Err | accept | Stubs returning `Err("not yet implemented")` is correct behavior; user receives clean message via `eprintln!` in caller (`install.rs`, `uninstall.rs`) | closed |
| T-05-04 | S (Spoofing) | IntegrationSlug::from_str | accept | Case-insensitive parse with explicit match arms; unknown slugs return `None` and caller exits with error; same trust model as v0.1.0 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-01 | Settings.json is a user-owned config file; HOME-based path derivation is the only reasonable approach for a local CLI tool. No new attack surface vs. prior implementation. | plan (05-01-PLAN.md) | 2026-04-10 |
| AR-05-03 | T-05-03 | Stub integrations are intentional placeholders for Phases 6/7. Returning Err is the safe default — no partial state written. | plan (05-01-PLAN.md) | 2026-04-10 |
| AR-05-04 | T-05-04 | CLI arg parsing is bounded by an explicit match against known slugs; unknown inputs rejected at parse time. Same model as v0.1.0. | plan (05-01-PLAN.md) | 2026-04-10 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-10 | 4 | 4 | 0 | gsd-security-auditor (orchestrated) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-10
