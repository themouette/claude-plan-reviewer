# Phase 9: Documentation - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Rewrite the README and document all user-facing features so any user can install, wire, and use plan-reviewer using only the README. Covers the curl | sh install path, usage (approve/deny/annotate), and per-integration wiring for Claude Code, Gemini CLI, and opencode. Also covers the `review <file>` and `update` subcommands. No new code — documentation only.

</domain>

<decisions>
## Implementation Decisions

### README Structure
- **D-01:** Single README — all content inline. No `docs/` folder. Install, usage, all three integration guides, and all subcommands live in one README.md.
- **D-02:** Section order: hero tagline → Install → Quick Start / Usage → Integrations (Claude Code, Gemini CLI, opencode) → Subcommands reference → (optional) Contributing

### Audience & Tone
- **D-03:** Developer shorthand. Assume the reader knows what Claude Code is and what plan mode does. Show commands directly — no hand-holding, no step-by-step "what is a hook" explanations.
- **D-04:** Lead with the curl | sh command as the primary install path. Binary download and build-from-source are secondary/footnotes only.

### Feature Coverage
- **D-05:** Required scope (DOCS-01/02/03): curl | sh install, `plan-reviewer install <integration>`, usage walkthrough (approve/deny/annotate), per-integration guide for Claude Code, Gemini CLI, opencode.
- **D-06:** Also document `plan-reviewer review <file>` — useful for scripts and the upcoming /annotate slash command; warrants its own short section.
- **D-07:** Also document `plan-reviewer update [--check] [--version X] [-y]` — self-update from GitHub releases.
- **D-08:** Known limitations (WR-01–04) — do NOT document. These are internal tech debt, not user-facing behavior.

### Integration Guide Depth
- **D-09:** Claude's discretion — standard depth: show the install command, note what config it writes (plugin directory + settings.json entries), and include a one-liner to verify it's wired (e.g., `plan-reviewer install claude --dry-run` if available, or "run Claude Code in plan mode").
- **D-10:** Each integration section follows the same format: 1-line description of what it does, install command, what gets written to disk, verify step, uninstall command.

### What to Replace
- **D-11:** The current README is entirely stale. Replace it wholesale — do not attempt to patch it. The manual `settings.json` editing section and build-from-source instructions go away completely.

### Claude's Discretion
- Exact wording and prose style within the developer-shorthand constraint
- Whether to add a badges row (GitHub release, license, platform support)
- Exact formatting of the Subcommands reference section (table vs bullet list)
- Whether to include a short "How it works" paragraph before the Install section

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Documentation — DOCS-01, DOCS-02, DOCS-03 acceptance criteria

### Current README (to replace)
- `README.md` — Stale content; agent must read to understand what currently exists before rewriting

### Install script (for install URL)
- `install.sh` — Contains the actual GitHub repo URL (`themouette/claude-plan-reviewer`) and `curl -fsSL` invocation pattern

### Integration implementations (for accurate config docs)
- `src/integrations/claude.rs` — What `install claude` writes to disk (plugin dir + settings.json entries)
- `src/integrations/gemini.rs` — What `install gemini` writes (extension directory structure)
- `src/integrations/opencode.rs` — What `install opencode` writes (JS plugin + opencode.json entry)

### Subcommand implementations (for accurate flag docs)
- `src/update.rs` — Flags for `update` subcommand (`--check`, `--version`, `-y`)
- `src/main.rs` — Subcommand definitions and help strings

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `install.sh` — Contains the exact curl | sh invocation; README install section should copy this verbatim
- `src/integrations/claude.rs` — Writes plugin directory at `~/.local/share/plan-reviewer/claude-plugin/` with hooks.json and registers two entries in `~/.claude/settings.json`
- `src/integrations/gemini.rs` — Writes extension directory at `~/.gemini/extensions/plan-reviewer/`
- `src/integrations/opencode.rs` — Writes JS plugin + updates `opencode.json`

### Established Patterns
- Integrations follow a consistent install/uninstall pattern — the documentation can use a repeating section template per integration
- `plan-reviewer review <file>` outputs `{"behavior":"allow"|"deny"}` to stdout — worth noting in docs for script use

### Integration Points
- The README is the only documentation surface. No separate docs site, no wiki.
- The install.sh URL (`https://raw.githubusercontent.com/themouette/claude-plan-reviewer/main/install.sh`) is the canonical install path

</code_context>

<specifics>
## Specific Ideas

- Install section hero: two commands, nothing else — `curl -fsSL https://... | sh` then `plan-reviewer install claude`
- The integration sections should all follow the same template shape for consistency

</specifics>

<deferred>
## Deferred Ideas

- Known limitations / tech debt (WR-01–04) — user explicitly excluded from scope
- Separate docs/ folder per integration — user chose single README

</deferred>

---

*Phase: 09-documentation*
*Context gathered: 2026-04-11*
