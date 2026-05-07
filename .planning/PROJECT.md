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

## Current State

v0.5.0 shipped 2026-05-07.

- **Binary**: `plan-reviewer` — single static Rust binary, ~5,307 Rust LOC + ~3,220 TypeScript/TSX LOC (React+TS)
- **Subcommands**: `install [integration]`, `uninstall [integration]`, `update [--check] [--version X] [-y]`, `review <file>`, `review-hook`
- **Supported integrations**: Claude Code (full plugin model — hook + slash command), opencode (JS plugin), Gemini CLI (extension directory)
- **Distribution**: cargo-dist releases for darwin-arm64, darwin-x64, linux-musl-arm64, linux-musl-x64
- **Offline resilience**: heartbeat polling, offline banner, clipboard submit path, slash command paste fallback — all complete
- **Known tech debt**: `install_returns_err_when_binary_path_is_none` pre-existing test failure; 4 code review warnings (WR-01–WR-04 across prior milestones)

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

### Active (next milestone)

- [ ] Gemini CLI integration: full hook install/uninstall via `plan-reviewer install gemini` (INTEG-01, INTEG-02)
- [ ] Integration test harness: `--no-browser`/`--port` flags + `assert_cmd`-based hook/install/server tests (TEST-01–03)
- [ ] Annotation quick-actions + theme: predefined chips, light/dark toggle, OS preference default (ANNOT-01–03, THEME-01–03)
- [ ] Documentation: README install/usage guide + per-integration wiring docs (DOCS-01–03)

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
*Last updated: 2026-05-07 after v0.5.0 milestone complete (Offline Resilience — Phases 12–16)*
