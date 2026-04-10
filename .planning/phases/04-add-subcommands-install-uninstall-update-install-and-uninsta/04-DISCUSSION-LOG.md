# Phase 4: Subcommands (install, uninstall, update) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-10
**Phase:** 04-add-subcommands-install-uninstall-update
**Mode:** discuss
**Areas discussed:** CLI structure, Integration targets, Interactive selector, Update command

## Gray Areas Presented

| Area | Description |
|------|-------------|
| CLI structure & backward compat | review subcommand vs D-05 conflict |
| Integration targets | Which integrations beyond Claude Code |
| Interactive selector UX | TUI picker vs text list, non-TTY behavior |
| Update command design | self_update approach, flags, confirmation |

## Decisions Made

### CLI structure
- **User answer:** "no review subcommand, this works as is"
- **Decision:** D-05 from Phase 3 stands. No `review` subcommand. Default (no subcommand) = hook flow.
- **Supersedes:** STATE.md roadmap evolution note suggesting moving hook behavior to a `review` subcommand.

### Integration targets
- **User answer:** "opencode, claude code, codestral"
- **Decision:** Three integrations in Phase 4 — `claude`, `opencode`, `codestral`. Researcher determines settings file paths and hook formats for opencode and codestral.

### Interactive selector
- **User answer:** "TUI picker"
- **Decision:** dialoguer or crossterm-based multi-select when no integration names given on CLI. Non-TTY mode errors out with clear message.

### Update command
- **User answer:** "everything like claude-vm"
- **Decision:** Direct implementation reference is `~/Projects/themouette/claude-vm/src/commands/update.rs`. self_update crate, GitHub releases, --check flag, --version flag, progress bar, confirmation prompt, in-place replacement, cache clear after update.

## Corrections Made

None — all answers were decisive first pass.

## Scope Creep Redirected

None raised during discussion.
