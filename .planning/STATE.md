---
gsd_state_version: 1.0
milestone: v0.5.0
milestone_name: Offline Resilience
status: executing
stopped_at: v0.5.0 roadmap created
last_updated: "2026-05-07T04:45:54.611Z"
last_activity: 2026-05-07 -- Phase 12 planning complete
progress:
  total_phases: 9
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-06)

**Core value:** One `curl | sh` installs a working plan reviewer — no Node.js, no Bun, no workspace setup required.
**Current focus:** v0.5.0 — Offline Resilience

## Current Position

Phase: 12 (not started)
Plan: —
Status: Ready to execute
Last activity: 2026-05-07 -- Phase 12 planning complete

Progress: [░░░░░░░░░░] 0% (v0.5.0)

## Performance Metrics

**Velocity (v0.1.0 reference):**

- Total plans completed (v0.1.0): 14 across 4 phases

**By Phase (v0.1.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 hook-review-ui | 4 | - | - |
| 02 annotations-diff | 4 | - | - |
| 03 distribution | 3 | - | - |
| 04 subcommands | 3 | - | - |
| 7 | 2 | - | - |
| 08 | 2 | - | - |

*v0.5.0 metrics will populate as plans complete*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Research: Codex CLI deferred — no ExitPlanMode equivalent; PreToolUse is per-command, not plan-level
- Research: GitHub Copilot deferred — no plan-level hook; per-project config contradicts curl | sh UX
- Research: Gemini CLI uses `plan_path` file read instead of inline plan JSON — adapter must read from disk
- Architecture: Integration trait refactor (Phase 5) is prerequisite for Phases 6 and 7
- [Phase 07.4]: Reuse build_opencode_output for neutral {behavior} JSON in review subcommand — same format as opencode, no new function needed
- [Phase 07.4]: Debug asset guard added to run_review_flow (run_opencode_flow gap closed — RESEARCH.md Pitfall 4)
- [v0.4.0]: Slash command implementation lives entirely in the `annotate.md` prompt file — no binary changes needed for SLSH-03/04 input resolution logic
- [v0.4.0]: `plan-reviewer review <file>` (Phase 07.4) is the execution primitive the slash command invokes via Claude Code's Bash tool with `run_in_background: true`
- [v0.4.0]: PLGN-01/02/03 require changes to `src/integrations/claude.rs` install/uninstall methods only
- [v0.5.0]: ConnectivityStatus is a parallel type to AppState — do NOT add offline as an AppState variant; merging these concerns is the primary anti-pattern to avoid
- [v0.5.0]: navigator.clipboard.writeText() must be called synchronously in the click handler — no await before it; async gap voids transient activation in Safari and Firefox
- [v0.5.0]: 3 consecutive failures required before declaring offline (not 1) to prevent false alarms from transient loopback hiccups
- [v0.5.0]: Clipboard JSON format is {"behavior":"allow"} or {"behavior":"deny","message":"..."} — identical to build_opencode_output; must not drift

### Roadmap Evolution

- Phase 4 added: add subcommands install uninstall update, install and uninstall can either accept a list of integration (claude, opencode...) or offer to chose integrations in an interactive UI. those should be idempotent. update should be modeled after ~/Projects/themouette/claude-vm update subcommand. the current behavior should be moved as a review subcommand that will be invoked if no subcommand is provided.
- Phase 07.4 inserted after Phase 7: Add review <file> subcommand so any markdown file can be reviewed without constructing hook JSON — outputs neutral {behavior} decision for use in scripts and agent workflows (URGENT)
- Phase 07.2 inserted after Phase 7: insert phase A from .planning/research/INTEGRATION-PLUGIN-REWORK.md (URGENT)
- Phase 07.3 inserted after Phase 7: insert phase B from .planning/research/INTEGRATION-PLUGIN-REWORK.md (URGENT)
- v0.4.0 milestone started: Phase 10 (Slash Command Install/Uninstall) and Phase 11 (Slash Command Prompt) added
- v0.5.0 milestone started: Phases 12-16 added (Offline Resilience — heartbeat, connectivity state, offline banner, clipboard submit, slash command fallback)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260409-kev | Add ammonia crate to sanitize javascript URIs in render.rs closing T-01-04 and T-03-01 | 2026-04-09 | c1e1032 | [260409-kev-add-ammonia-crate-to-sanitize-javascript](.planning/quick/260409-kev-add-ammonia-crate-to-sanitize-javascript/) |

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 6] Gemini CLI denial retry behavior unconfirmed — agent may loop on repeated `exit_plan_mode` denial; needs integration test
- [Phase 6] Full `tool_input` schema for Gemini `exit_plan_mode` partially documented — `plan_path` confirmed, other fields unknown
- [Phase 7] opencode JS plugin bundling strategy not yet designed — needs a plan
- [Phase 15] Manual smoke test required after Phase 15: paste clipboard JSON into Claude and confirm Claude parses it correctly — no automated proxy for prompt quality

## Session Continuity

Last session: 2026-05-06T00:00:00.000Z
Stopped at: v0.5.0 roadmap created
Resume file: .planning/ROADMAP.md (Phase 12 is next)
