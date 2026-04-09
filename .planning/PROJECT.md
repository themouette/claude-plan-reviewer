# claude-plan-reviewer

## What This Is

A Rust binary that intercepts Claude Code's plan approval flow, renders plans and code diffs in a local browser UI, and lets you annotate before approving or denying execution. It integrates via Claude Code's `ExitPlanMode` PermissionRequest hook and returns structured JSON feedback via stdout. Distributed as a single pre-built binary — no runtime, no monorepo, no complex install.

## Core Value

One `curl | sh` installs a working plan reviewer — no Node.js, no Bun, no workspace setup required.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Plan review: binary intercepts ExitPlanMode hook, renders plan in browser, returns approve/deny + annotations via stdout JSON
- [ ] Code diff review: visual diff display alongside plan review
- [ ] Embedded browser UI: binary spawns local HTTP server and opens browser tab, all assets embedded in binary
- [ ] Single binary distribution: curl | sh installer downloads pre-built binary from GitHub releases
- [ ] Claude Code hook integration: minimal settings.json config, compatible with ExitPlanMode PermissionRequest hook protocol

### Out of Scope

- URL sharing / team collaboration — not needed now, possibly later
- TUI (terminal UI) — browser UI chosen for rich rendering
- Multi-agent platform support (Copilot CLI, Gemini CLI, etc.) — Claude Code only for v1
- Real-time collaboration / websocket sync — deferred

## Context

- Plannotator is the reference implementation: same hook protocol (ExitPlanMode → stdin JSON → stdout JSON), same browser-based UI approach
- Plannotator's install complexity comes from its Bun runtime dependency, monorepo architecture, and multi-platform SDK support — none of which we need
- Rust chosen for: single static binary output, no runtime dependency, `rust-embed` for bundling UI assets, strong ecosystem for HTTP servers and git diff parsing
- Distribution: pre-built binaries for darwin-arm64, darwin-x64, linux-arm64, linux-x64 published to GitHub releases; install script at a stable URL

## Constraints

- **Tech stack**: Rust — for single-binary output and no runtime dependency
- **Protocol**: Must be compatible with Claude Code PermissionRequest hook stdin/stdout JSON format
- **Distribution**: Must install with a single `curl | sh` command, no package manager required
- **Scope**: Local-only for v1 — no server-side infrastructure

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rust over Go | Smaller binaries, no runtime, user's preference | — Pending |
| Browser UI over TUI | Richer markdown/diff rendering, familiar feel | — Pending |
| ExitPlanMode hook only | Same trigger as plannotator, well-understood protocol | — Pending |
| curl \| sh distribution | Same approach as plannotator, works for non-Rust users | — Pending |
| Local-only v1 | Sharing deferred — validate core loop first | — Pending |
| React + TypeScript over Svelte | User preference; familiar ecosystem, strong typing | — Pending |

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
*Last updated: 2026-04-09 after initialization*
