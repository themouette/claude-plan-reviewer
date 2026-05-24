# claude-plan-reviewer

## What This Is

A Rust binary that intercepts Claude Code's plan approval flow, renders plans and code diffs in a local browser UI, and lets you annotate before approving or denying execution. It integrates via Claude Code's `ExitPlanMode` PermissionRequest hook and returns structured JSON feedback via stdout. Distributed as a single pre-built binary with `install`, `uninstall`, and `update` subcommands for zero-friction setup — no runtime, no monorepo, no complex install.

The browser UI survives backend timeouts: when Claude Code kills the server process mid-review, the UI detects the loss via heartbeat polling, keeps the user working offline, and exports annotations via clipboard. The `/plan-reviewer:annotate` slash command closes the loop by handling pasted clipboard JSON as a fallback for the empty-stdout case.

## Core Value

One `curl | sh` installs a working plan reviewer — no Node.js, no Bun, no workspace setup required.

## Shipped: v0.5.0 Offline Resilience (2026-05-07)

The offline resilience milestone is complete. All 5 phases (Phases 12–16) shipped on 2026-05-07.
The full offline annotation loop is now in place: heartbeat endpoint → connectivity state →
offline banner → clipboard submit → slash command fallback.

## Shipped: v0.6.0 Markdown Annotator v2 (2026-05-22)

Full 3-column annotation reviewer shipped. v1 codepath removed. ReviewerV2 at root URL (`/`).
3-column layout (outline / formatted markdown / comment sidebar), text selection → toolbar,
comment anchoring with overlap/collapse, approve vs. ask-for-changes with validation gates,
clipboard degraded mode preserved, no v1 code coupling.

## Current Milestone: v0.7.0 Code Review

**Goal:** Add a code review mode — let you inspect, navigate, and annotate agent-generated diffs before a PR, then return structured feedback to the agent.

**Target features:**
- Diff viewer: full branch diff (vs main), side-by-side / unified toggle, expand collapsed lines, file list navigation
- Commit navigation: list commits in branch, click to view per-commit diff, full-branch vs per-commit mode toggle, keyboard prev/next
- Inline comments: comment on any diff hunk or whole file, edit/delete, comment count badge per file
- Review submission: approve (no comments) with optional global instruction; submit with comments returns structured feedback JSON to agent
- Integration: slash command + pre-PR hook trigger; `install`/`uninstall` wires/unwires both
- Architecture: replaces the existing unused diff tab — prior diff code removed

## Current State

v0.6.0 shipped 2026-05-22. v0.7.0 milestone (Code Review) in progress — Phase 26 complete (commit navigation: CommitDrawer overlay, per-commit diff, keyboard nav, DIFF-05 multi-commit union).

- **Binary**: `plan-reviewer` — single static Rust binary
- **Subcommands**: `install [integration]`, `uninstall [integration]`, `update [--check] [--version X] [-y]`, `review <file>`, `review-hook`
- **Supported integrations**: Claude Code (full plugin model — hook + slash command), opencode (JS plugin), Gemini CLI (extension directory)
- **Distribution**: cargo-dist releases for darwin-arm64, darwin-x64, linux-musl-arm64, linux-musl-x64
- **UI**: ReviewerV2 (React+TS) — 3-column markdown annotation UI at root URL; v1 removed
- **Offline resilience**: heartbeat polling, offline banner, clipboard submit path, slash command paste fallback — all complete
- **Known tech debt**: 4 code review warnings (WR-01–WR-04 across prior milestones)

## Requirements

### Validated (v0.1.0)

- ✓ Plan review: binary intercepts ExitPlanMode hook, renders plan in browser, returns approve/deny + annotations via stdout JSON — v0.1.0
- ✓ Code diff review: visual diff display alongside plan review — v0.1.0
- ✓ Embedded browser UI: binary spawns local HTTP server and opens browser tab, all assets embedded in binary — v0.1.0
- ✓ Single binary distribution: curl | sh installer downloads pre-built binary from GitHub releases — v0.1.0
- ✓ Claude Code hook integration: minimal settings.json config, compatible with ExitPlanMode PermissionRequest hook protocol — v0.1.0
- ✓ install/uninstall subcommands: binary manages its own Claude Code hook wiring/unwiring — v0.1.0
- ✓ update subcommand: binary self-updates from GitHub releases — v0.1.0

### Validated (v0.4.0)

- ✓ `/annotate` slash command: invoke from Claude Code conversation to open browser review UI on any markdown file — v0.4.0
- ✓ Input resolution: file path arg → last `.md` written by Claude → last Claude message as temp file — v0.4.0
- ✓ Background execution + stdout return: result flows back to Claude when user completes review — v0.4.0
- ✓ `plan-reviewer install claude` creates `commands/annotate.md`; uninstall removes it — v0.4.0

### Validated (v0.5.0)

- ✓ Heartbeat polling: browser UI polls `/api/ping` every 5s with 3-failure hysteresis to detect server death — v0.5.0 (HB-01–04)
- ✓ Offline banner + button relabeling: amber persistent banner and "Copy to clipboard" button when offline — v0.5.0 (OFX-01–02)
- ✓ Clipboard fallback: synchronous clipboard write with identical JSON format to server; distinct confirmation screen — v0.5.0 (CLB-01–02)
- ✓ Slash command resilience: `annotate.md` Step 4 handles pasted clipboard JSON when no stdout result — v0.5.0 (SLC-01)

### Validated (v0.6.0)

- ✓ LAYOUT-01: 3-column layout shell (outline / content / comments) — v0.6.0
- ✓ OUTLINE-01: Heading tree with click-to-scroll and active section tracking — v0.6.0
- ✓ OUTLINE-02: Per-section comment count badges in the outline tree — v0.6.0
- ✓ CONTENT-01: Markdown rendered as formatted HTML in the center pane — v0.6.0
- ✓ CONTENT-02: Paragraph hover highlight + comment toolbar trigger — v0.6.0
- ✓ CONTENT-03: Text selection → comment toolbar (anchored to selection) — v0.6.0
- ✓ COMMENT-01: Comment sidebar scrolls with content; comments float at anchor text level — v0.6.0
- ✓ COMMENT-02: Hover a comment → highlight corresponding text; hover text → highlight comment — v0.6.0
- ✓ COMMENT-03: Overlap handling — non-focused comments collapse; focused comment rises; all reachable by scroll — v0.6.0
- ✓ COMMENT-04: Quick actions: comment / delete / replace; expandable menu with predefined actions — v0.6.0
- ✓ COMMENT-05: Comment edit/delete via pencil and X icons on each bubble — v0.6.0
- ✓ SUBMIT-01: Approve vs. ask-for-changes with validation gates — v0.6.0
- ✓ SUBMIT-02: Clipboard fallback (degraded mode) preserved on the new reviewer — v0.6.0
- ✓ TEST-01: Regression test suite covering existing annotation flow — v0.6.0
- ✓ ARCH-01: New reviewer architecturally isolated; existing view may import from new component, never the reverse — v0.6.0

### Active (v0.7.0)

- [ ] DIFF-01: User can view a full branch diff (all changed files combined, vs main)
- [ ] DIFF-02: User can expand collapsed context lines within a diff hunk
- [ ] DIFF-03: User can toggle between unified and side-by-side layout
- [ ] DIFF-04: User can navigate directly to any changed file via a file list
- [ ] DIFF-05: User can select which commits to include in the current diff view
- [ ] COMMIT-01: User can view a list of all commits in the current branch
- [ ] COMMIT-02: User can click a commit to view its individual diff
- [ ] COMMIT-03: User can switch between per-commit view and full branch diff mode
- [ ] COMMIT-04: User can navigate between commits with keyboard (prev/next)
- [ ] COMMENT-01: User can add a comment anchored to any diff hunk
- [ ] COMMENT-02: User can add a comment at the whole-file level
- [ ] COMMENT-03: User can edit or delete their own comments
- [ ] COMMENT-04: File list shows a comment count badge per file
- [ ] SUBMIT-01: User can approve the review when no comments exist
- [ ] SUBMIT-02: User can include an optional global instruction when approving
- [ ] SUBMIT-03: User can submit with comments; structured feedback JSON returned to agent
- [ ] SUBMIT-04: Submitting "request changes" requires at least one comment
- [ ] INTEG-01: User can invoke code review via a slash command
- [ ] INTEG-02: Agent can trigger code review automatically via a pre-PR hook
- [ ] INTEG-03: `plan-reviewer install` wires up slash command + hook; `uninstall` removes them
- [ ] ARCH-01: Code review viewer replaces the existing (unused) diff tab — prior diff code removed

### Future

- [ ] Ask-from-UI: select text, type a question, stream AI response inline (integration-aware; each tool declares its ask command)

### Out of Scope

- URL sharing / team collaboration — not needed now, possibly later
- TUI (terminal UI) — browser UI chosen for rich rendering
- Multi-agent platform support beyond Claude/opencode/codestral — deferred
- Real-time collaboration / websocket sync — deferred
- Mobile / native app — web-first, browser tab is correct UX

## Context

- **Reference implementation**: Plannotator — same hook protocol (ExitPlanMode → stdin JSON → stdout JSON), same browser-based UI approach. Plannotator's complexity comes from its Bun runtime, monorepo, and multi-platform SDK support — none of which we needed.
- **Tech stack**: Rust (axum 0.8, rust-embed 8, git2 0.20, comrak, clap 4, self_update 0.44, dialoguer 0.12) + React+TS+Vite frontend via build.rs
- **Distribution**: cargo-dist 0.31 generates multi-target binaries and shell installer; `.tar.gz` archives (required by self_update)
- **Known tech debt**: 4 code review warnings (WR-01–WR-04): `.unwrap()` panics on malformed settings.json types, `$HOME` silent empty string in picker, `uninstall` exit-0 on file-read failure, brittle tar extraction path in install.sh

## Constraints

- **Tech stack**: Rust — for single-binary output and no runtime dependency
- **Protocol**: Must be compatible with Claude Code PermissionRequest hook stdin/stdout JSON format
- **Distribution**: Must install with a single `curl | sh` command, no package manager required
- **Scope**: Local-only — no server-side infrastructure

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rust over Go | Smaller binaries, no runtime, user's preference | ✓ Correct — single binary with no install friction |
| Browser UI over TUI | Richer markdown/diff rendering, familiar feel | ✓ Correct — annotation UI works well in browser |
| ExitPlanMode hook only | Same trigger as plannotator, well-understood protocol | ✓ Correct — hook protocol simple and stable |
| curl \| sh distribution | Same approach as plannotator, works for non-Rust users | ✓ Correct — cargo-dist handles it cleanly |
| Local-only v1 | Sharing deferred — validate core loop first | ✓ Correct — no demand for server infra yet |
| React + TypeScript over Svelte | User preference; familiar ecosystem, strong typing | ✓ Correct — familiar, fast to build |
| self_update for update subcommand | Handles download, verify, replace atomically | ✓ Correct — clean API, no subprocess needed |
| dialoguer for TUI picker | Cross-platform, simple MultiSelect API | ✓ Correct — renders to stderr, doesn't pollute stdout |
| .tar.gz over .tar.xz | Required by self_update's archive-tar feature | ✓ Correct — aligns cargo-dist and self_update |
| ConnectivityStatus as parallel type (not AppState variant) | Merging offline into AppState would couple render state to network state | ✓ Correct — avoids implicit state coupling and keeps each concern testable in isolation |
| Synchronous clipboard.writeText (no await before call) | Safari/Firefox void transient activation across async gap | ✓ Correct — all browsers accepted the call; async gap would have broken mobile |
| 3-failure hysteresis before declaring offline | 1-failure threshold caused false alarms from transient loopback hiccups | ✓ Correct — no false offline triggers observed in testing |
| Clipboard JSON byte-identical to build_opencode_output | Drift between clipboard and server format would silently produce wrong results | ✓ Correct — single source of truth, verified by Vitest tests |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-23 — Phase 24 complete (backend diff API)*
