---
gsd_state_version: 1.0
milestone: v0.6.0
milestone_name: Markdown Annotator v2
status: "v0.6.0 shipped — PR #1"
stopped_at: Phase 22 complete — Phase 23 (regression tests) is next
last_updated: "2026-05-22T23:10:46.309Z"
last_activity: 2026-05-23
progress:
  total_phases: 9
  completed_phases: 8
  total_plans: 18
  completed_plans: 55
  percent: 89
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-19)

**Core value:** One `curl | sh` installs a working plan reviewer — no Node.js, no Bun, no workspace setup required.
**Current focus:** Milestone complete

## Current Position

Phase: 23
Plan: Not started
Phase: 23 (replace-v1-with-v2) — READY TO PLAN
Status: v0.6.0 shipped — PR #1
Last activity: 2026-05-23

Progress: [██████████] 97% (v0.6.0 milestone — Phases 17-22 complete)

## Performance Metrics

**Velocity (v0.5.0 reference):**

- Plans completed (v0.5.0): 8 across 5 phases

*v0.6.0 metrics will populate as plans complete*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.5.0]: ConnectivityStatus is a parallel type — do NOT merge offline into AppState
- [v0.5.0]: Clipboard JSON byte-identical to build_opencode_output; must not drift
- [v0.6.0 research]: TEST-02/TEST-03 must land before any v2 component code (PITFALL V6-09, V6-07)
- [v0.6.0 research]: ContentPane produces Section[] used by OutlinePane — content before outline
- [v0.6.0 research]: ARCH-01 enforced by ESLint no-restricted-imports, not just convention
- [v0.6.0 research]: SUBMIT-02 reuses buildClipboardPayload + shouldUseClipboard — no reimplementation
- [v0.6.0]: Frontend is React 19 (not Svelte 5) — CLAUDE.md "Recommended Stack" is aspirational only
- [Phase 22]: Send Feedback always enabled; popover-level gate (message required when 0 comments) instead of button-level disabled

### Roadmap Evolution

- v0.6.0 milestone started: Phases 17-23 added (Markdown Annotator v2)
- Phase 23 (Regression Tests) can run in parallel with Phase 22 (Submit) — both depend only on Phase 17

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 20]: Evaluate `sidenotes@2.0.1` before rolling custom `useCommentLayout` hook (COMMENT-03 research flag)
- [Phase 15]: Manual smoke test still pending — paste clipboard JSON into Claude to verify parsing
- Pre-existing: `install_returns_err_when_binary_path_is_none` unit test fails on main before any v0.6.0 changes

## Session Continuity

Last session: 2026-05-23T00:30:00.000Z
Stopped at: Phase 22 complete — Phase 23 (regression tests) is next
Resume file: none
