# Phase 9: Documentation - Research

**Researched:** 2026-04-11
**Domain:** Technical documentation — README rewrite, integration guides, subcommand reference
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Single README — all content inline. No `docs/` folder. Install, usage, all three integration guides, and all subcommands live in one README.md.
- **D-02:** Section order: hero tagline → Install → Quick Start / Usage → Integrations (Claude Code, Gemini CLI, opencode) → Subcommands reference → (optional) Contributing
- **D-03:** Developer shorthand. Assume the reader knows what Claude Code is and what plan mode does. Show commands directly — no hand-holding, no step-by-step "what is a hook" explanations.
- **D-04:** Lead with the curl | sh command as the primary install path. Binary download and build-from-source are secondary/footnotes only.
- **D-05:** Required scope (DOCS-01/02/03): curl | sh install, `plan-reviewer install <integration>`, usage walkthrough (approve/deny/annotate), per-integration guide for Claude Code, Gemini CLI, opencode.
- **D-06:** Also document `plan-reviewer review <file>` — useful for scripts and the upcoming /annotate slash command; warrants its own short section.
- **D-07:** Also document `plan-reviewer update [--check] [--version X] [-y]` — self-update from GitHub releases.
- **D-08:** Known limitations (WR-01–04) — do NOT document. These are internal tech debt, not user-facing behavior.
- **D-09:** Claude's discretion — standard depth: show the install command, note what config it writes (plugin directory + settings.json entries), and include a one-liner to verify it's wired.
- **D-10:** Each integration section follows the same format: 1-line description of what it does, install command, what gets written to disk, verify step, uninstall command.
- **D-11:** The current README is entirely stale. Replace it wholesale — do not attempt to patch it. The manual `settings.json` editing section and build-from-source instructions go away completely.

### Claude's Discretion

- Exact wording and prose style within the developer-shorthand constraint
- Whether to add a badges row (GitHub release, license, platform support)
- Exact formatting of the Subcommands reference section (table vs bullet list)
- Whether to include a short "How it works" paragraph before the Install section

### Deferred Ideas (OUT OF SCOPE)

- Known limitations / tech debt (WR-01–04) — user explicitly excluded from scope
- Separate docs/ folder per integration — user chose single README
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOCS-01 | User can find installation instructions in README (curl \| sh, binary download) | install.sh canonical URL confirmed; install flow documented below |
| DOCS-02 | User can find usage and configuration instructions in README | CLI subcommand structures extracted from main.rs; usage flow documented below |
| DOCS-03 | User can find an integration guide for Claude Code, Gemini CLI, and opencode | All three integration file layouts extracted from source; per-integration data tables below |
</phase_requirements>

---

## Summary

Phase 9 is a documentation-only rewrite. The current README.md is a 42-line stub covering only the old manual-hook installation and a single-paragraph usage description. It does not reflect any of the subcommands, integrations, or the curl | sh install flow that exists in the codebase. The task is to replace it wholesale with a single authoritative README.

All source-of-truth content is verified directly from the implementation files. No guessing is needed: the exact file paths written to disk, the exact flag names, and the exact curl command are all available in the codebase. This research documents each piece of content the README must contain and its authoritative source.

The phase is pure Markdown authoring — no Rust code, no test changes, no build changes. The only output is a rewritten README.md.

**Primary recommendation:** Read each source file listed in this document, copy the exact paths/commands/flags verbatim into the README, then write the sections in the order specified by D-02.

---

## Project Constraints (from CLAUDE.md)

- Binary is `plan-reviewer` (not `claude-plan-reviewer`) — verify command examples use `plan-reviewer`
- Distribution: single `curl | sh` — README must lead with this
- No separate docs site; README is the only documentation surface
- No `docs/` folder (user locked in D-01)
- Pre-commit hook enforces `cargo fmt` and `cargo clippy -- -D warnings` — does not apply to this phase (Markdown only)
- Test coverage rules apply to Rust/TS modules with business logic — does not apply to this phase (no code)

---

## Content Inventory: What the README Must Contain

This section documents every piece of factual content required, with its authoritative source.

### Install Section (DOCS-01)

**Canonical install command** [VERIFIED: install.sh line 4]:
```sh
curl -fsSL https://raw.githubusercontent.com/themouette/claude-plan-reviewer/main/install.sh | sh
```

**What install.sh does** [VERIFIED: install.sh]:
1. Detects OS + architecture (macOS arm64/x86_64, Linux x86_64/aarch64)
2. Resolves latest release tag from GitHub API
3. Downloads `plan-reviewer-{tag}-{target}.tar.gz` from GitHub Releases
4. Extracts and copies binary to `~/.local/bin/plan-reviewer`
5. Warns if `~/.local/bin` is not on PATH (with per-shell instructions)
6. Automatically runs `plan-reviewer install claude` after binary install

**Supported platforms** [VERIFIED: install.sh lines 17-36]:
- `aarch64-apple-darwin` (macOS Apple Silicon)
- `x86_64-apple-darwin` (macOS Intel)
- `x86_64-unknown-linux-musl` (Linux x86_64)
- `aarch64-unknown-linux-musl` (Linux ARM64)

**PATH note** [VERIFIED: install.sh lines 71-86]:
If `~/.local/bin` is not already on PATH, the installer prints shell-specific instructions. The README should mention this briefly and echo the fix commands.

### Quick Start / Usage Section (DOCS-02)

**How it works** (from D-09 discretion + code):
plan-reviewer integrates into an AI agent's plan-approval hook. When the agent enters plan mode, the hook invokes `plan-reviewer review-hook` which reads hook JSON from stdin, starts a local HTTP server, opens a browser tab, and waits for the user to approve, deny, or annotate the plan. The decision is written as JSON to stdout.

**Usage flow** [VERIFIED: src/main.rs async_main function]:
1. Hook fires → browser tab opens at `http://127.0.0.1:{random-port}`
2. URL is also printed to stderr for manual access (`--no-browser` flag)
3. User reads plan, optionally leaves a comment, clicks Approve or Deny
4. Decision (+ optional annotation) is returned to the agent via stdout
5. 540-second timeout — if no decision, defaults to deny

**Global flags** [VERIFIED: src/main.rs Cli struct]:

| Flag | Default | Purpose |
|------|---------|---------|
| `--no-browser` | false | Skip opening the browser; print URL to stderr only |
| `--port N` | 0 (OS-assigned) | Bind review server to a specific port |

### Subcommands Reference (DOCS-02, D-06, D-07)

All subcommands extracted [VERIFIED: src/main.rs Commands enum]:

| Subcommand | Synopsis | Description |
|------------|----------|-------------|
| `review-hook` | `plan-reviewer review-hook` | Receive hook event from stdin, open browser review UI. Explicit form of the default hook behavior. |
| `review` | `plan-reviewer review <file>` | Review any markdown file; outputs neutral `{"behavior":"allow"\|"deny"}` JSON |
| `install` | `plan-reviewer install [claude\|gemini\|opencode]` | Wire ExitPlanMode hook (interactive picker if no arg) |
| `uninstall` | `plan-reviewer uninstall [claude\|gemini\|opencode]` | Remove hook wiring (interactive picker if no arg) |
| `update` | `plan-reviewer update [--check] [--version X] [-y]` | Self-update from GitHub releases |

**`review` subcommand detail** [VERIFIED: src/main.rs run_review_flow]:
- Reads `<file>` from the filesystem (does NOT read stdin)
- Opens browser review UI
- Outputs `{"behavior":"allow"}` or `{"behavior":"deny","message":"..."}` to stdout
- Exit code 1 + stderr error if file does not exist [VERIFIED: REQUIREMENTS.md REVIEW-03]
- Useful for scripts and agent workflows that don't construct hook JSON

**`update` subcommand flags** [VERIFIED: src/update.rs]:

| Flag | Purpose |
|------|---------|
| `--check` | Print current and latest version + changelog URL, no download |
| `--version X` | Pin to a specific version tag (e.g., `v0.2.0`) |
| `-y` / `--yes` | Skip confirmation prompt |

**Update behavior** [VERIFIED: src/update.rs run_update, refresh_integrations]:
- Downloads binary replacement from GitHub Releases
- After binary replacement, automatically refreshes all installed integration files to match the new version (hooks.json, plugin.json, gemini-extension.json, opencode plugin .mjs)
- Migrates legacy pre-plugin installs to the current plugin model during refresh
- Clears update check cache after successful update

### Integration Guides (DOCS-03)

All three integrations share a uniform section template (D-10): description, install command, what gets written to disk, verify step, uninstall command.

---

#### Claude Code Integration

**Description:** Wires plan-reviewer as a Claude Code plugin that fires on `ExitPlanMode`. The plugin model (vs. the old direct hook) enables version-aware updates via `plan-reviewer update`.

**Install command:**
```sh
plan-reviewer install claude
```

**What gets written to disk** [VERIFIED: src/integrations/claude.rs install method]:

| Path | Content |
|------|---------|
| `~/.local/share/plan-reviewer/claude-plugin/.claude-plugin/plugin.json` | Plugin manifest with name, version, description |
| `~/.local/share/plan-reviewer/claude-plugin/.claude-plugin/marketplace.json` | Marketplace manifest (source type: directory) |
| `~/.local/share/plan-reviewer/claude-plugin/hooks/hooks.json` | PermissionRequest/ExitPlanMode hook → `plan-reviewer review-hook` |
| `~/.claude/settings.json` (modified) | Adds `extraKnownMarketplaces["plan-reviewer-local"]` and `enabledPlugins["plan-reviewer@plan-reviewer-local"]` |

**Exact settings.json additions** [VERIFIED: src/integrations/claude.rs]:
```json
{
  "extraKnownMarketplaces": {
    "plan-reviewer-local": {
      "source": {
        "source": "directory",
        "path": "/home/user/.local/share/plan-reviewer/claude-plugin"
      }
    }
  },
  "enabledPlugins": {
    "plan-reviewer@plan-reviewer-local": true
  }
}
```

**Verify step:** Run Claude Code in plan mode — the browser tab should open when you reach the plan approval step. Or check that `enabledPlugins["plan-reviewer@plan-reviewer-local"]` exists in `~/.claude/settings.json`.

**Uninstall command:**
```sh
plan-reviewer uninstall claude
```

**Uninstall removes** [VERIFIED: src/integrations/claude.rs uninstall method]:
- Entire directory `~/.local/share/plan-reviewer/claude-plugin/`
- `extraKnownMarketplaces["plan-reviewer-local"]` from `~/.claude/settings.json`
- `enabledPlugins["plan-reviewer@plan-reviewer-local"]` from `~/.claude/settings.json`

**Idempotency** [VERIFIED: src/integrations/claude.rs]: Safe to run `install` or `uninstall` multiple times. Idempotency key: presence of `enabledPlugins["plan-reviewer@plan-reviewer-local"]`.

---

#### Gemini CLI Integration

**Description:** Wires plan-reviewer as a Gemini CLI extension that fires on `exit_plan_mode`. Extension is auto-discovered by Gemini CLI — no settings.json modification required.

**Install command:**
```sh
plan-reviewer install gemini
```

**What gets written to disk** [VERIFIED: src/integrations/gemini.rs install method]:

| Path | Content |
|------|---------|
| `~/.gemini/extensions/plan-reviewer/gemini-extension.json` | Extension manifest with name, version, description |
| `~/.gemini/extensions/plan-reviewer/hooks/hooks.json` | BeforeTool/exit_plan_mode hook → `plan-reviewer review-hook` with 300000ms timeout |

**Exact hooks.json written** [VERIFIED: src/integrations/gemini.rs line 54]:
```json
{
  "hooks": {
    "BeforeTool": [{
      "matcher": "exit_plan_mode",
      "hooks": [{
        "name": "plan-reviewer",
        "type": "command",
        "command": "plan-reviewer review-hook",
        "timeout": 300000
      }]
    }]
  }
}
```

**Note:** Gemini CLI uses a `BeforeTool` hook (not `PermissionRequest`) and passes the plan as a file path (`plan_path`) rather than inline JSON. The 300000ms (5-minute) timeout is required because Gemini CLI's default timeout (60s) is too short for an interactive review session [VERIFIED: src/integrations/gemini.rs comment].

**Verify step:** Check that `~/.gemini/extensions/plan-reviewer/gemini-extension.json` exists. Gemini CLI auto-discovers extensions in `~/.gemini/extensions/`.

**Uninstall command:**
```sh
plan-reviewer uninstall gemini
```

**Uninstall removes** [VERIFIED: src/integrations/gemini.rs uninstall]: Entire directory `~/.gemini/extensions/plan-reviewer/`. Does not touch `~/.gemini/settings.json`.

**Idempotency** [VERIFIED: src/integrations/gemini.rs]: Idempotency key: presence of `~/.gemini/extensions/plan-reviewer/gemini-extension.json`. Install always rewrites files with current version.

---

#### opencode Integration

**Description:** Wires plan-reviewer as an opencode JS plugin (`submit_plan` hook). Writes a bundled `.mjs` plugin file to disk and registers its path in `opencode.json`.

**Install command:**
```sh
plan-reviewer install opencode
```

**What gets written to disk** [VERIFIED: src/integrations/opencode.rs install method]:

| Path | Content |
|------|---------|
| `~/.config/opencode/plugins/plan-reviewer-opencode.mjs` | Bundled JS plugin (binary path embedded at install time) |
| `~/.config/opencode/opencode.json` (modified) | Adds the plugin path to the `plugin` array |

**Exact opencode.json modification** [VERIFIED: src/integrations/opencode.rs]:
```json
{
  "plugin": [
    "/home/user/.config/opencode/plugins/plan-reviewer-opencode.mjs"
  ]
}
```

**Note on opencode invocation:** The opencode JS plugin passes the plan as a file and invokes the binary with `--plan-file <path>` (no `review-hook` subcommand) [VERIFIED: src/main.rs None branch with plan_file]. This is an implementation detail and does not affect the documentation content.

**Verify step:** Check that `~/.config/opencode/plugins/plan-reviewer-opencode.mjs` exists and `~/.config/opencode/opencode.json` contains its path in the `plugin` array.

**Uninstall command:**
```sh
plan-reviewer uninstall opencode
```

**Uninstall removes** [VERIFIED: src/integrations/opencode.rs uninstall]:
- File `~/.config/opencode/plugins/plan-reviewer-opencode.mjs`
- The plugin path entry from `~/.config/opencode/opencode.json`'s `plugin` array (other entries preserved)

**Idempotency** [VERIFIED: src/integrations/opencode.rs]: Idempotency key: plugin path present in `opencode.json`'s `plugin` array AND plugin file exists on disk. Install always rewrites the plugin file with current binary path and version.

---

## Architecture Patterns

### README Section Order (from D-02)

```
README.md
├── Hero tagline (1–2 sentences + optional badges)
├── [Optional: "How it works" paragraph]
├── Install
│   ├── curl | sh (primary)
│   └── PATH note (inline with install)
├── Quick Start / Usage
│   ├── Approve / deny / annotate walkthrough
│   └── review subcommand (for scripts)
├── Integrations
│   ├── Claude Code
│   ├── Gemini CLI
│   └── opencode
│       (each: description, install, what gets written, verify, uninstall)
├── Subcommands reference
│   ├── install / uninstall
│   ├── update
│   ├── review
│   └── review-hook
└── Contributing (optional)
```

### Integration Section Template (from D-10)

Each integration section follows this repeating shape:
1. One-line description of what the integration does
2. Install command (code block)
3. What gets written to disk (file list or small table)
4. Verify step (command or file check)
5. Uninstall command (code block)

### Content That Does NOT Belong in the README (from D-11, D-08)

- Manual editing of `settings.json` (old approach — replaced by `plan-reviewer install`)
- Build-from-source instructions with `cargo build --release`
- Node.js prerequisites mention (already handled in the curl | sh installer)
- Known limitations WR-01 through WR-04 (internal tech debt, not user-facing)

---

## Don't Hand-Roll

| Problem | What to Avoid | Why |
|---------|--------------|-----|
| Integration file paths | Do not guess or paraphrase paths | Paths are verified from source; exact strings matter for user troubleshooting |
| Install command URL | Do not shorten or alter the GitHub raw URL | Must match install.sh line 4 exactly |
| Flag names | Do not invent flag aliases | Verified from main.rs Cli struct |
| JSON examples in docs | Do not simplify the JSON shape | Readers will copy-paste; must match actual output |

---

## Common Pitfalls

### Pitfall 1: Using the old hook-path install method
**What goes wrong:** README shows manual `settings.json` editing with a hardcoded binary path — the pre-v0.2.0 approach.
**Why it happens:** The existing README.md uses this approach.
**How to avoid:** D-11 says to replace wholesale. Do not incorporate any content from the old README.

### Pitfall 2: Wrong binary invocation in integration docs
**What goes wrong:** Documenting the bare `plan-reviewer` invocation (deprecated) instead of `plan-reviewer review-hook`.
**Why it happens:** Old docs and any generated text may default to the bare form.
**How to avoid:** [VERIFIED: src/integrations/claude.rs line 118, src/integrations/gemini.rs line 54] Both integrations write `plan-reviewer review-hook` as the hook command. The README must use this form in any hook command examples.

### Pitfall 3: Wrong hook type for Gemini
**What goes wrong:** Documenting a `PermissionRequest` hook for Gemini CLI (Claude Code's hook type).
**Why it happens:** Claude Code and Gemini CLI use different hook systems.
**How to avoid:** [VERIFIED: src/integrations/gemini.rs] Gemini uses `BeforeTool` + `exit_plan_mode`, not `PermissionRequest` + `ExitPlanMode`.

### Pitfall 4: Omitting the timeout from Gemini docs
**What goes wrong:** Showing hooks.json without the `"timeout": 300000` field.
**Why it happens:** It looks optional but it's not — Gemini CLI's default 60-second timeout will fire before the user finishes reviewing.
**How to avoid:** [VERIFIED: src/integrations/gemini.rs line 54] Always include `timeout: 300000` in any Gemini hooks.json example.

### Pitfall 5: Documenting install.sh as wiring only Claude
**What goes wrong:** README implies `curl | sh` only sets up Claude Code.
**Why it happens:** install.sh line 90 does auto-run `plan-reviewer install claude`, but other integrations require a separate `install` invocation.
**How to avoid:** Be explicit: curl | sh installs the binary and auto-wires Claude Code. For Gemini CLI or opencode, run `plan-reviewer install gemini` or `plan-reviewer install opencode` separately.

### Pitfall 6: Missing `review` subcommand output format
**What goes wrong:** Documenting `review` as behaving identically to `review-hook` (it does not wrap in `hookSpecificOutput`).
**Why it happens:** Both open the browser, but their stdout JSON formats differ.
**How to avoid:** [VERIFIED: src/main.rs run_review_flow] The `review` subcommand uses `build_opencode_output` — neutral `{"behavior":"allow"|"deny"}` with no `hookSpecificOutput` wrapper. Document this format explicitly for script users.

---

## Code Examples

### Install command (canonical) [VERIFIED: install.sh line 4]
```sh
curl -fsSL https://raw.githubusercontent.com/themouette/claude-plan-reviewer/main/install.sh | sh
```

### Wire additional integrations [VERIFIED: src/main.rs Commands::Install]
```sh
plan-reviewer install gemini
plan-reviewer install opencode
```

### Remove integration wiring [VERIFIED: src/main.rs Commands::Uninstall]
```sh
plan-reviewer uninstall claude
plan-reviewer uninstall gemini
plan-reviewer uninstall opencode
```

### Review a markdown file from a script [VERIFIED: src/main.rs Commands::Review]
```sh
plan-reviewer review path/to/plan.md
# stdout: {"behavior":"allow"} or {"behavior":"deny","message":"..."}
```

### Check for updates [VERIFIED: src/update.rs check_and_display]
```sh
plan-reviewer update --check
```

### Update to latest [VERIFIED: src/update.rs perform_update]
```sh
plan-reviewer update
plan-reviewer update -y          # skip confirmation
plan-reviewer update --version v0.2.0   # pin to specific version
```

### Verify Claude Code integration manually [VERIFIED: src/integrations/claude.rs constants]
```sh
cat ~/.claude/settings.json | python3 -m json.tool | grep -A2 "enabledPlugins"
# Should show: "plan-reviewer@plan-reviewer-local": true
```

---

## Open Questions

1. **`plan-reviewer install claude --dry-run` availability**
   - What we know: D-09 mentioned "if available" for a dry-run verify step
   - What's unclear: `--dry-run` is not present in src/main.rs Commands::Install [VERIFIED: src/main.rs]
   - Recommendation: Skip the dry-run option; use the file-presence check as the verify step instead

2. **Badges row**
   - What we know: Claude's discretion (CONTEXT.md)
   - What's unclear: Whether a GitHub release badge URL exists for this repo
   - Recommendation: Include a simple GitHub release badge (`https://img.shields.io/github/v/release/themouette/claude-plan-reviewer`) and a license badge if LICENSE file exists. Low-cost, adds credibility for open-source tool.

3. **"How it works" paragraph**
   - What we know: Claude's discretion (CONTEXT.md)
   - Recommendation: Include a 2-sentence paragraph before the Install section — "plan-reviewer hooks into your AI agent's plan approval flow. When the agent presents a plan, it opens a local browser tab where you can read, annotate, approve, or deny before execution proceeds." This costs two lines and answers the "what is this" question for visitors landing from search.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The opencode integration is fully implemented in phases 6/7 and will be live at the time this README is read | Integration Guides | opencode section would document a non-functional integration |
| A2 | `plan-reviewer install <integration>` supports an interactive picker when no argument is given (mentioned in subcommands table) | Subcommands Reference | Could confuse users if interactive mode is not yet implemented |

Note on A2: [VERIFIED: src/main.rs Commands::Install] The field is `integrations: Vec<String>` with no `#[required]` — an empty vec is valid. The interactive-picker behavior is documented in the command docstring. Whether the picker is fully implemented is a Phase 6 concern; the README can say "omit for interactive picker" as the help text does.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is documentation-only (Markdown authoring). No external tools, runtimes, or services are required beyond a text editor.

---

## Validation Architecture

Step 4: SKIPPED — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`.

---

## Security Domain

No security domain applicable — this phase produces only Markdown documentation. No code is written, no data is processed, no inputs are validated.

---

## Sources

### Primary (HIGH confidence — verified from codebase)
- `install.sh` — canonical install URL, supported platforms, auto-wire behavior
- `src/main.rs` — all subcommand names, flags, help strings, invocation patterns
- `src/integrations/claude.rs` — exact file paths, JSON keys, idempotency behavior
- `src/integrations/gemini.rs` — exact file paths, hooks.json format, timeout value
- `src/integrations/opencode.rs` — exact file paths, opencode.json modification
- `src/update.rs` — flag names (--check, --version, -y/--yes), update behavior, integration refresh logic
- `.planning/phases/09-documentation/09-CONTEXT.md` — all user decisions (D-01 through D-11)
- `.planning/REQUIREMENTS.md` — DOCS-01, DOCS-02, DOCS-03 acceptance criteria
- `README.md` — existing stale content (to replace wholesale, per D-11)

### Tertiary (LOW confidence — not verified this session)
- [ASSUMED] GitHub shields.io badge URLs for this repo are valid (standard pattern)

---

## Metadata

**Confidence breakdown:**
- Install content: HIGH — verified from install.sh
- Subcommand flags: HIGH — verified from src/main.rs
- Integration file paths: HIGH — verified from integration source files
- Section structure: HIGH — locked by user decisions D-01/D-02
- Prose wording: ASSUMED (Claude's discretion per CONTEXT.md)

**Research date:** 2026-04-11
**Valid until:** Stable until next implementation phase changes integration file paths or subcommand flags. Re-verify before planning if Phase 10 or 11 merges first.
