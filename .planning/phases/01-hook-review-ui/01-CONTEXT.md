# Phase 1: Hook & Review UI - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the complete approve/deny loop end-to-end via the ExitPlanMode hook. A developer runs the binary, Claude Code triggers the hook, the binary opens a browser tab with the rendered plan, the user approves or denies, and valid PermissionRequest JSON exits stdout. Nothing persisted, no diff, no annotations — those are Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Frontend Stack
- **D-01:** React + TypeScript with Vite — user's stated preference. Resolves the contradiction between PROJECT.md (React+TS) and CLAUDE.md (Svelte recommendation). React wins.
- **D-02:** Markdown rendering is server-side via comrak (Rust). No client-side markdown library. The Rust server converts plan markdown to HTML before serving it. Keeps the React bundle lean.

### UI Structure
- **D-03:** Phase 1 UI is a single-column plan review page — full-width rendered plan, approve/deny controls below.
- **D-04:** Diff view is a separate route, not a split pane. Phase 2 adds that route. Phase 1 has no placeholder column and no navigation to a diff route.
- **D-05:** Browser communicates the approve/deny decision via a fetch POST to a REST endpoint on the local Rust server. JS is required regardless (Enter key shortcut, UI-03), so a form POST is not used.

### Deny Flow
- **D-06:** Deny requires a non-empty message. The Deny submit button is disabled until the textarea contains at least one non-whitespace character. Claude receives a non-empty `message` field to act on.

### Timeout / Self-Termination
- **D-07:** On auto-termination (HOOK-05 — before Claude Code hook timeout), the binary sends `behavior: deny` with message `"Review timed out — plan was not approved"`. The process never silently approves an unreviewed plan.
- **D-08:** No countdown timer in the Phase 1 UI — that is v2 (UX-01 in REQUIREMENTS.md). The timeout fires silently.

### Claude's Discretion
- Exact timeout duration (how many seconds before the Claude Code default 10-minute timeout to self-terminate)
- Visual styling, color scheme, typography
- Exact URL path for the approve/deny endpoints (e.g., `/api/decide`)
- Confirmation page design and auto-close mechanism after decision
- How the Enter key shortcut is scoped (whole page focus, specific element, or modal)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Hook protocol & requirements
- `.planning/REQUIREMENTS.md` §Hook Integration — HOOK-01→HOOK-05: stdin format, stdout format, stderr-only diagnostics, exit timing, self-termination
- `.planning/REQUIREMENTS.md` §Plan Review UI — UI-01→UI-06: HTTP server, markdown rendering, approve/deny UX, confirmation page, URL fallback
- `.planning/REQUIREMENTS.md` §Configuration — CONF-01→CONF-02: settings.json snippet, --no-browser flag

### Technology stack
- `CLAUDE.md` §Recommended Stack — full dependency rationale for axum, rust-embed, Vite, comrak, webbrowser, serde_json, clap

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — project has no source files yet. This is a greenfield implementation.

### Established Patterns
- None established yet. Phase 1 sets the patterns for all subsequent phases.

### Integration Points
- `cwd` field in hook stdin JSON → used in Phase 2 to locate the git repo for diff extraction (DIFF-01). Phase 1 parses but does not use it.
- The local HTTP server started in Phase 1 is the same server Phase 2 will extend with the diff route.

### Open Questions (from STATE.md)
- Does `tool_input.plan` contain full plan markdown, or a summary? Must verify by inspecting a live ExitPlanMode hook stdin payload during Phase 1 implementation.
- Is `transcript_path` in hook stdin useful? Likely not for Phase 1 but worth noting.

</code_context>

<specifics>
## Specific Ideas

- "Enter to approve" is a hard requirement (UI-03) — not optional, must be wired
- React + TypeScript is a user preference override to the CLAUDE.md Svelte recommendation
- Diff view and plan review are separate routes (not a split pane) — user's explicit architectural choice
- Deny message is required, not optional — empty deny is not valid

</specifics>

<deferred>
## Deferred Ideas

- Diff view alongside plan — Phase 2 (separate route, not split pane)
- Countdown timer in review UI — v2, UX-01 in REQUIREMENTS.md
- Annotations on plan text — Phase 2 (ANN-01→ANN-05)
- Fast-approve mode / auto-approve after N seconds — v2, UX-03 in REQUIREMENTS.md

</deferred>

---

*Phase: 01-hook-review-ui*
*Context gathered: 2026-04-09*
