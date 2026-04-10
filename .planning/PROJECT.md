# claude-plan-reviewer

## What This Is

A Rust binary that intercepts Claude Code's plan approval flow, renders plans and code diffs in a local browser UI, and lets you annotate before approving or denying execution. It integrates via Claude Code's `ExitPlanMode` PermissionRequest hook and returns structured JSON feedback via stdout. Distributed as a single pre-built binary with `install`, `uninstall`, and `update` subcommands for zero-friction setup — no runtime, no monorepo, no complex install.

## Core Value

One `curl | sh` installs a working plan reviewer — no Node.js, no Bun, no workspace setup required.

## Current Milestone: v0.3.0 Integrations, Annotations & Polish

**Goal:** Expand plan-reviewer with full opencode/codestral integration, richer annotation actions, theme switching, and user documentation.

**Target features:**
- opencode integration — full hook wiring (real config path + format, working install/uninstall)
- codestral integration — full hook wiring (real config path + format, working install/uninstall)
- Richer annotation actions — predefined types: clarify this, needs test, give me an example, out of scope, search internet, search codebase
- Theme switcher — light/dark mode in browser UI, persisted
- User docs / README + integration guide — install, configure, use; how to wire each tool

## Current State

v0.1.0 shipped 2026-04-10.

- **Binary**: `plan-reviewer` — single static Rust binary, ~1,350 Rust LOC + ~3,060 frontend LOC (React+TS)
- **Subcommands**: `install [integration]`, `uninstall [integration]`, `update [--check] [--version X] [-y]`
- **Default behavior**: hook review flow (unchanged from initial design)
- **Supported integrations**: Claude Code (full), opencode + codestral (stubs — hooks not yet spec'd)
- **Distribution**: cargo-dist releases for darwin-arm64, darwin-x64, linux-musl-arm64, linux-musl-x64
- **Human UAT pending**: TUI picker (TTY required), live `update` download, `--check` mode, `--version` pinning

## Requirements

### Validated (v0.1.0)

- ✓ Plan review: binary intercepts ExitPlanMode hook, renders plan in browser, returns approve/deny + annotations via stdout JSON — v0.1.0
- ✓ Code diff review: visual diff display alongside plan review — v0.1.0
- ✓ Embedded browser UI: binary spawns local HTTP server and opens browser tab, all assets embedded in binary — v0.1.0
- ✓ Single binary distribution: curl | sh installer downloads pre-built binary from GitHub releases — v0.1.0
- ✓ Claude Code hook integration: minimal settings.json config, compatible with ExitPlanMode PermissionRequest hook protocol — v0.1.0
- ✓ install/uninstall subcommands: binary manages its own Claude Code hook wiring/unwiring — v0.1.0
- ✓ update subcommand: binary self-updates from GitHub releases — v0.1.0

### Active (v0.3.0)

- [ ] opencode integration: full hook wiring (real config path + format, working install/uninstall)
- [ ] codestral integration: full hook wiring (real config path + format, working install/uninstall)
- [ ] Richer annotation actions: predefined types — clarify this, needs test, give me an example, out of scope, search internet, search codebase
- [ ] Theme switcher: light/dark mode in browser UI, persisted across sessions
- [ ] User docs / README: install, configure, and use guide
- [ ] Integration guide: how to wire plan-reviewer with Claude Code, opencode, codestral

### Future (v0.4.0 candidates)

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
*Last updated: 2026-04-10 after v0.3.0 milestone started*
