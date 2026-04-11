---
plan: 09-01
phase: 09-documentation
status: completed
self_check: PASSED
key-files:
  created:
    - README.md
  modified:
    - install.sh
---

# Summary: 09-01 README Rewrite

## What was produced

README.md rewritten wholesale from a 42-line stale stub to a complete reference document covering:

- **Install** — `curl | sh` command with PATH instructions, supported platforms, and post-install prompt to run `plan-reviewer install`
- **Usage** — approve/deny/annotate flow, 9-minute timeout, `review <file>` subcommand for scripts
- **Integrations** — interactive picker (`plan-reviewer install`) and per-integration commands for Claude Code, Gemini CLI, and opencode; uninstall commands
- **Subcommands reference** — table covering all five subcommands (review-hook, review, install, uninstall, update) with update flags

## Key decisions honored

- **D-01:** Single README, all content inline — no docs/ folder
- **D-02:** Section order: hero → Install → Usage → Integrations → Subcommands
- **D-03:** Developer shorthand — commands shown directly, no hand-holding
- **D-04:** curl | sh as primary install path
- **D-05/06/07:** All required scope covered (install, integrations, review, update)
- **D-08:** Known limitations not documented
- **D-10:** Integrations simplified to install/uninstall commands only (per user feedback)
- **D-11:** Old README replaced wholesale — no stale content survives

## Deviations from plan

- **Global flags table removed** — user feedback: unneeded in Usage section
- **Integration depth reduced** — user feedback: no "What gets written" / verify / hooks.json blocks; just commands
- **install.sh auto-wire removed** — user identified inconsistency: auto-wiring Claude Code silently was wrong for Gemini CLI/opencode users; installer now tells user to run `plan-reviewer install` for interactive picker
- **Checkpoint: APPROVED** — user reviewed and approved the final README

## Verification results

```
Canonical install URL:                  1 match ✓
review-hook subcommand:                 2 matches ✓
plan-reviewer install claude:           2 matches ✓
plan-reviewer install gemini:           1 match ✓
plan-reviewer install opencode:         1 match ✓
No stale /path/to/ content:             PASS ✓
No cargo build --release:               PASS ✓
```
