# Integration Plugin Architecture Rework

**Created:** 2026-04-11
**Status:** Decision document — use as input when planning new phases
**Replaces:** Direct `settings.json` editing in `claude.rs` and `gemini.rs`

---

## Problem

plan-reviewer's Claude and Gemini integrations currently edit the host
tool's main config file directly:

- Claude Code: inserts hook entry into `~/.claude/settings.json`
- Gemini CLI: inserts hook entry into Gemini's config

This creates two problems:

1. **No migration path** — when the CLI invocation changes (e.g. bare
   `plan-reviewer` → `plan-reviewer hook`), every existing installed
   config silently breaks. There is no mechanism to detect or repair stale entries.

2. **Config pollution** — plan-reviewer's hook entry is mixed inline into
   the user's main settings with no isolation or ownership boundary.

---

## Solution: Native Plugin/Extension Model for All Integrations

Each integration has its own plugin/extension system. plan-reviewer should
use it. This makes the hook config a file plan-reviewer owns — not a field
it borrows inside someone else's config.

### Claude Code — Plugin System

Reference: https://code.claude.com/docs/en/plugins

plan-reviewer becomes a local Claude Code plugin.

**Files written by `plan-reviewer install claude`:**

```
~/.local/share/plan-reviewer/claude-plugin/
├── .claude-plugin/
│   └── plugin.json          ← name, version, description
└── hooks/
    └── hooks.json           ← ExitPlanMode hook (isolated from settings.json)
```

`plugin.json`:
```json
{
  "name": "plan-reviewer",
  "version": "0.4.0",
  "description": "Plan review hook for Claude Code"
}
```

`hooks/hooks.json`:
```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "ExitPlanMode",
        "hooks": [{ "type": "command", "command": "plan-reviewer hook" }]
      }
    ]
  }
}
```

**Registration:** one minimal entry added once to `~/.claude/settings.json`
pointing to the plugin directory. This entry is stable — it never needs
to change again, regardless of future CLI restructuring.

**Version tracking:** `plugin.json` `version` field. `update` reads this
to decide whether to rewrite the plugin files.

---

### Gemini CLI — Extension System

Reference: https://geminicli.com/docs/extensions/writing-extensions/

plan-reviewer becomes a Gemini CLI extension, written directly to the
extensions directory (same destination as `gemini extensions install`).

**Files written by `plan-reviewer install gemini`:**

```
~/.gemini/extensions/plan-reviewer/
├── gemini-extension.json    ← name, version
└── hooks/
    └── hooks.json           ← hook config (same format as Claude's)
```

`gemini-extension.json`:
```json
{
  "name": "plan-reviewer",
  "version": "0.4.0",
  "description": "Plan review hook for Gemini CLI"
}
```

`hooks/hooks.json`: same structure as Claude's hooks.json above, adapted
for Gemini's hook event name.

**Registration:** Gemini CLI auto-discovers extensions in
`~/.gemini/extensions/`. No separate config entry needed.

**Version tracking:** `gemini-extension.json` `version` field.

---

### OpenCode — No Change

OpenCode already owns its own plugin file
(`~/.config/opencode/plugins/plan-reviewer-opencode.mjs`). The only
addition: embed a version comment in the `.mjs` file so `update` can
apply the same version-aware rewrite logic.

---

## Migration Strategy (handled by `update`)

When `plan-reviewer update` runs after the plugin model ships:

**Case 1 — fresh install (no prior config):**
Normal install path. Write plugin/extension directories, write registration.

**Case 2 — pre-plugin install (old bare entry in settings.json):**
1. No plugin manifest found at known path → assume pre-plugin era
2. Write plugin/extension directory with current template
3. Write registration entry in settings.json
4. Remove the old bare hook entry from settings.json

**Case 3 — plugin installed, version stale:**
1. Read version from plugin manifest
2. Compare to current binary version
3. Rewrite plugin/extension files with current template, bump version
4. settings.json registration is untouched

No separate state/sidecar file needed. The version in each integration's
own manifest IS the migration indicator.

---

## Proposed Phase Breakdown

The current Phase 07.1 (review subcommand) must be deferred. Three new
phases must land first. The recommended insertion point is between the
existing Phase 7 (complete) and Phase 07.1.

### Phase A: Integration Plugin/Extension Infrastructure

**Goal:** Claude and Gemini integrations use the plugin/extension model.
Hook config lives in files plan-reviewer owns. `update` can rewrite them
without touching user settings.

**Key changes:**
- `src/integrations/claude.rs` — write plugin directory; register once in
  settings.json; uninstall removes plugin dir + registration
- `src/integrations/gemini.rs` — write extension directory to
  `~/.gemini/extensions/plan-reviewer/`; uninstall removes it
- `src/update.rs` — after binary replacement, detect installed integrations
  via manifest presence, compare version, rewrite stale plugin/extension
  files
- `src/integrations/opencode.rs` — add version comment to `.mjs` template;
  update rewrite logic to check it

**User-visible change:** none for existing behaviour. `install` and
`uninstall` work as before but leave a cleaner footprint.

**Why this must come before B:** Phase B's migration is trivial when the
plugin files exist — just rewrite with new template. Without Phase A,
Phase B requires complex surgery on settings.json for every existing user.

---

### Phase B: Hook Subcommand

**Goal:** The nameless default behaviour (`plan-reviewer` reads stdin JSON)
becomes an explicit `plan-reviewer hook` subcommand. Existing installs
migrate automatically on next `update`.

**Key changes:**
- `src/main.rs` — add `Commands::Hook`; keep `None` arm as backward-compat
  fallback emitting a deprecation warning to stderr
- Plugin templates in `claude.rs` / `gemini.rs` — hook command changes from
  `plan-reviewer` to `plan-reviewer hook`
- `src/update.rs` — Case 2 migration path (pre-plugin bare entry → plugin
  model + new subcommand in one shot)

**User-visible change:** `plan-reviewer hook` works. Bare `plan-reviewer`
still works with a stderr deprecation warning.

**Why this must come before C:** Phase C adds `Commands::Review`. Having
`Commands::Hook` in place first means the CLI enum is complete and the
dispatch logic is clean when `review` is added.

---

### Phase C: Review Subcommand (existing Phase 07.1)

**Goal:** `plan-reviewer review <file.md>` opens any markdown file in the
browser review UI and outputs neutral `{"behavior":"allow"|"deny"}` JSON.

This is the existing Phase 07.1 plan. No changes needed to that plan
— it just moves to after Phase A and B.

**Depends on:** Phase B (subcommand structure in place).

---

## Challenge on the Phase Structure

The user proposed A → B → C as three separate phases. This is defensible.
One alternative worth considering:

**Combine A + B into a single phase.**

Rationale: Phase A alone ships a plugin that still calls `plan-reviewer`
(bare) in `hooks.json`. That works, but it's the old invocation — Phase B
immediately changes it. Users who update during the A → B window get two
rewrites of their plugin files. The actual correct end state (plugin model
+ `hook` subcommand) only exists after both phases land.

Counter-argument for keeping them separate: Phase A is pure infrastructure
(no user-visible CLI change, easier to review and test in isolation). Phase
B is a user-visible change. Separating them gives a cleaner PR boundary.

**Recommendation:** keep them separate. The intermediate state (plugin
model, bare invocation) is fully functional and not harmful. The cleaner
PR boundary is worth it.

---

## Files to Read When Planning These Phases

| File | Why |
|------|-----|
| `src/integrations/claude.rs` | Current Claude integration to be replaced |
| `src/integrations/gemini.rs` | Current Gemini integration to be replaced |
| `src/integrations/opencode.rs` | Working plugin model — reference for the pattern |
| `src/integrations/opencode_plugin.mjs` | Plugin file template — shows version comment placement |
| `src/update.rs` | Current update logic — needs version-aware rewrite added |
| `src/main.rs` | CLI structure — Commands enum and main dispatch |
| `src/integration.rs` | Integration trait contract |
| `Cargo.toml` | Dependencies (no new ones expected) |
| `.planning/REQUIREMENTS.md` | INTEG-01, INTEG-02, INTEG-05 are affected |
| `.planning/ROADMAP.md` | Phase insertion point: after Phase 7, before Phase 07.1 |

---

## Constraints

- **No new runtime dependencies.** The plugin/extension directories are
  plain files. No new crates needed.
- **`plan-reviewer hook` must not read stdin when invoked without input.**
  Use `Stdio::null()` or `isatty` detection to avoid hanging.
- **`plan-reviewer` bare invocation must keep working** for at least one
  major version after Phase B ships (deprecation grace period).
- **`install` should verify PATH.** The hook command `plan-reviewer hook`
  assumes the binary is in PATH. If it is not, `install` should warn.
- **All filesystem writes are idempotent.** Running `install` twice must
  not corrupt or duplicate plugin/extension files.
