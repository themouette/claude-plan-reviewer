# Requirements: claude-plan-reviewer

**Defined:** 2026-04-10
**Core Value:** One `curl | sh` installs a working plan reviewer — no Node.js, no Bun, no workspace setup required.

## v0.3.0 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Integrations

- [ ] **INTEG-01**: User can run `plan-reviewer install gemini` to wire plan review into Gemini CLI
- [ ] **INTEG-02**: User can run `plan-reviewer uninstall gemini` to remove Gemini CLI hook wiring
- [ ] **INTEG-03**: User can run `plan-reviewer install opencode` to wire plan review into opencode (writes bundled JS plugin to disk, updates opencode.json)
- [ ] **INTEG-04**: User can run `plan-reviewer uninstall opencode` to remove opencode integration (removes plugin file and config entry)
- [ ] **INTEG-05**: All install/uninstall commands are idempotent — safe to run multiple times without corrupting config

### Annotation Actions

- [ ] **ANNOT-01**: User can apply a predefined quick-action (clarify this, needs test, give me an example, out of scope, search internet, search codebase) with one click
- [ ] **ANNOT-02**: Selecting a quick-action pre-fills the annotation comment field with the action label
- [ ] **ANNOT-03**: User can edit the pre-filled comment before submitting

### Theme

- [ ] **THEME-01**: User can toggle between light and dark mode in the browser UI
- [ ] **THEME-02**: Theme preference persists across sessions
- [ ] **THEME-03**: Browser UI defaults to OS dark/light preference on first load (no flash)

### Documentation

- [ ] **DOCS-01**: User can find installation instructions in README (curl | sh, binary download)
- [ ] **DOCS-02**: User can find usage and configuration instructions in README
- [ ] **DOCS-03**: User can find an integration guide for Claude Code, Gemini CLI, and opencode

## Future Requirements

### v0.4.0 candidates

- **ASK-01**: User can select text in the plan/diff, type a question, and receive an AI response inline (integration-aware; each integration declares its ask command)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Codex CLI integration | Per-command hook only (PreToolUse) — no plan-level hook; would deliver a command approver, not a plan reviewer |
| GitHub Copilot integration | No plan-level hook; per-project config contradicts curl \| sh UX |
| Codestral / Mistral integration | Codestral is a model, not an agent runtime; no hook infrastructure |
| Ask-from-UI | Deferred to v0.4.0 |
| Three-state theme picker (System/Light/Dark) | Defer to v0.4.0; OS preference honored as default |
| Annotation tip/tooltip field | Defer to v0.4.0; plain chip pre-fill ships first |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INTEG-01 | Phase 6 | Pending |
| INTEG-02 | Phase 6 | Pending |
| INTEG-03 | Phase 7 | Pending |
| INTEG-04 | Phase 7 | Pending |
| INTEG-05 | Phase 5 | Pending |
| ANNOT-01 | Phase 8 | Pending |
| ANNOT-02 | Phase 8 | Pending |
| ANNOT-03 | Phase 8 | Pending |
| THEME-01 | Phase 8 | Pending |
| THEME-02 | Phase 8 | Pending |
| THEME-03 | Phase 8 | Pending |
| DOCS-01 | Phase 9 | Pending |
| DOCS-02 | Phase 9 | Pending |
| DOCS-03 | Phase 9 | Pending |

**Coverage:**
- v0.3.0 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-10 — traceability populated after roadmap creation*
