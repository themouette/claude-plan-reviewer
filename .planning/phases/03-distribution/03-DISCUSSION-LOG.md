# Phase 3: Distribution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 03-distribution
**Areas discussed:** Release automation, Binary name, Install path, Hook wiring, CLI structure

---

## Release Automation

| Option | Description | Selected |
|--------|-------------|----------|
| cargo-dist | Auto-generates GitHub Actions CI + curl\|sh installer. Uses built-in GITHUB_TOKEN, handles musl targets and codesigning. CLAUDE.md recommends this. | ✓ |
| Manual GitHub Actions matrix | Hand-write CI workflows using cross/cargo-zigbuild. Full control, more maintenance. Would also require hand-writing install.sh. | |

**User's choice:** cargo-dist
**Notes:** User asked whether cargo-dist requires new authentication (no — uses built-in GITHUB_TOKEN) and whether it's GitHub-only (yes, default; other providers available but not needed here).

---

## Binary Install Name

| Option | Description | Selected |
|--------|-------------|----------|
| claude-plan-reviewer | Matches Cargo package name, self-documenting but verbose | |
| cpr | Short, risk of conflict with existing `cpr` (copy with progress) utility | |
| plan-reviewer | Middle ground — shorter, descriptive, no known conflicts | ✓ |

**User's choice:** plan-reviewer
**Notes:** Affects hook config snippets in settings.json and README. With Phase 4 subcommands: `plan-reviewer install`, `plan-reviewer uninstall`, etc.

---

## Install Path

| Option | Description | Selected |
|--------|-------------|----------|
| ~/.local/bin | No sudo, standard XDG user bin dir, cargo-dist default. Warns if not on PATH. | ✓ |
| /usr/local/bin | Always on PATH but requires sudo on most setups | |
| User-configured ($PLAN_REVIEWER_INSTALL) | Flexible, rustup-style pattern, more install.sh complexity | |

**User's choice:** ~/.local/bin

---

## Hook Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Leave to Phase 4's install subcommand | install.sh drops binary only; Phase 4 adds `plan-reviewer install` | |
| Auto-wire in Phase 3 install script | install.sh edits ~/.claude/settings.json directly | |
| Print instructions only | install.sh prints a settings.json snippet to copy-paste | |
| Implement Phase 4 install + call from install.sh | Phase 3 ships `plan-reviewer install` (Claude Code only); install.sh calls it | ✓ |

**User's choice:** Implement Phase 4's install subcommand (Claude Code only) in Phase 3, call it from install.sh
**Notes:** User specified "implement phase 4 install and call it in the install.sh script". Scoped to Claude Code only for Phase 3; Phase 4 extends to multi-integration.

---

## CLI Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 4 owns refactor (default = hook, add subcommands) | Phase 3 keeps current behavior; Phase 4 restructures | |
| Add `review` subcommand in Phase 3 | Explicit `plan-reviewer review` for hook, others for management | |
| No `review` subcommand — default behavior stays at top-level | Default (no subcommand) = hook flow; add `install` subcommand; Phase 4 adds the rest | ✓ |

**User's choice:** No `review` subcommand needed; default behavior stays at top-level through Phase 4
**Notes:** User clarified they mentioned `review` subcommand thinking it was required. Confirmed it isn't — clap supports subcommand-required=false so default behavior coexists with named subcommands. `-h` always intercepts before default behavior. ROADMAP.md Phase 4 goal updated to reflect this.

---

## Claude's Discretion

- Exact install.sh messaging and formatting
- cargo-dist configuration details
- Error handling in `plan-reviewer install` for malformed settings.json

## Deferred Ideas

- Multi-integration selector (opencode, etc.) — Phase 4
- `plan-reviewer uninstall` / `update` — Phase 4
- Full Apple notarization — v2
