# Roadmap: claude-plan-reviewer

## Milestones

- ✅ **v0.1.0 MVP** — Phases 1-4 (shipped 2026-04-10)
- 🚧 **v0.3.0 Integrations, Annotations & Polish** — Phases 5-9 (in progress)

## Phases

<details>
<summary>✅ v0.1.0 MVP (Phases 1-4) — SHIPPED 2026-04-10</summary>

- [x] Phase 1: Hook & Review UI (4/4 plans) — completed 2026-04-09
- [x] Phase 2: Annotations & Diff (4/4 plans) — completed 2026-04-09
- [x] Phase 3: Distribution (3/3 plans) — completed 2026-04-10
- [x] Phase 4: Subcommands (install, uninstall, update) (3/3 plans) — completed 2026-04-10

Full archive: `.planning/milestones/v0.1.0-ROADMAP.md`

</details>

### 🚧 v0.3.0 Integrations, Annotations & Polish (In Progress)

**Milestone Goal:** Expand plan-reviewer with full Gemini CLI and opencode integration, richer annotation quick-actions, theme switching, and user documentation.

- [ ] **Phase 5: Integration Architecture** - Refactor to `src/integrations/` with an `Integration` trait; establish idempotency contract all integrations must satisfy
- [ ] **Phase 6: Gemini CLI Integration** - Wire Gemini CLI `BeforeTool exit_plan_mode` hook with install/uninstall subcommands
- [ ] **Phase 6.1: Integration Test Harness** - Add `--no-browser`/`--port` flags and `assert_cmd`-based integration tests covering hook flow, install/uninstall, and server approve/deny cycle without touching real system config
- [x] **Phase 7: opencode Integration** - Wire opencode hook with bundled JS plugin install/uninstall (completed 2026-04-10)
- [ ] **Phase 7.2: Integration Plugin/Extension Infrastructure** - Move Claude and Gemini integrations to plugin/extension model; add version-aware update refresh
- [ ] **Phase 7.3: Hook Subcommand** - Add explicit `plan-reviewer review-hook` subcommand with backward-compat fallback
- [x] **Phase 7.4: Review File Subcommand** - Add `review <file>` subcommand for standalone markdown review with neutral JSON output (completed 2026-04-11)
- [ ] **Phase 8: Annotation Quick-Actions & Theme** - Add predefined annotation actions and persistent light/dark theme switcher
- [ ] **Phase 9: Documentation** - Write README install/usage guide and per-integration wiring docs

## Phase Details

### Phase 5: Integration Architecture
**Goal**: Integration implementations live in a clean `src/integrations/` folder-per-integration structure; all install/uninstall paths share a common `Integration` trait; idempotency is enforced at the trait boundary so no integration can corrupt config on repeated runs
**Depends on**: Phase 4
**Requirements**: INTEG-05
**Success Criteria** (what must be TRUE):
  1. Running `plan-reviewer install <any-integration>` a second time does not duplicate hook entries or corrupt config
  2. Running `plan-reviewer uninstall <any-integration>` on a clean system exits 0 without error
  3. Adding a new integration requires only implementing the `Integration` trait and registering it — no changes to the install/uninstall command dispatch logic
**Plans**: TBD

### Phase 6: Gemini CLI Integration
**Goal**: Users can install and uninstall plan-reviewer as a Gemini CLI `BeforeTool exit_plan_mode` hook via `plan-reviewer install gemini` and `plan-reviewer uninstall gemini`; the hook reads the plan from `tool_input.plan_path` and runs the full browser review flow
**Depends on**: Phase 5
**Requirements**: INTEG-01, INTEG-02
**Success Criteria** (what must be TRUE):
  1. `plan-reviewer install gemini` writes the correct `BeforeTool` hook entry to `~/.gemini/settings.json` without corrupting existing config
  2. Triggering Gemini CLI plan mode opens the plan-reviewer browser UI with the plan content rendered
  3. Approving or denying in the browser returns the correct JSON decision to Gemini CLI
  4. `plan-reviewer uninstall gemini` removes the hook entry from `~/.gemini/settings.json` and leaves all other settings intact
**Plans**: TBD

### Phase 6.1: Integration Test Harness
**Goal**: The binary exposes `--no-browser` and `--port` flags enabling fully automated integration tests; `assert_cmd`-based tests cover the hook stdin→stdout flow, install/uninstall with HOME isolation, and the full server approve/deny cycle — all running without touching real system configuration
**Depends on**: Phase 6
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. `cargo test --test integration` passes with 0 failures, touching no real system files (validated by running tests with a read-only real HOME)
  2. Install/uninstall tests verify config file mutations in a tmpdir-isolated HOME
  3. Hook flow tests verify correct JSON stdout for both approve and deny decisions by POSTing to the local server
  4. `--no-browser` and `--port` flags are present in `plan-reviewer --help` output
**Plans:** 3 plans
Plans:
- [x] 06.1-01-PLAN.md — Add --port CLI flag and thread through to server bind
- [x] 06.1-02-PLAN.md — Test infrastructure: fixtures + install/uninstall integration tests
- [x] 06.1-03-PLAN.md — Full server approve/deny cycle integration tests

### Phase 7: opencode Integration
**Goal**: Users can install and uninstall plan-reviewer as an opencode hook via `plan-reviewer install opencode` and `plan-reviewer uninstall opencode`; the binary bundles the required JS plugin, writes it to disk on install, and wires `opencode.json`
**Depends on**: Phase 5
**Requirements**: INTEG-03, INTEG-04
**Success Criteria** (what must be TRUE):
  1. `plan-reviewer install opencode` writes the bundled JS plugin to the correct disk location and adds the plugin entry to `opencode.json`
  2. Triggering opencode plan review opens the plan-reviewer browser UI with plan content rendered
  3. Approving or denying in the browser returns the correct decision to opencode via HTTP handoff
  4. `plan-reviewer uninstall opencode` removes the plugin file and config entry, leaving `opencode.json` otherwise intact
**Plans:** 2/2 plans complete
Plans:
- [x] 07-01-PLAN.md — OpenCode JS plugin + install/uninstall Rust implementation
- [x] 07-02-PLAN.md — Hook flow extension for --plan-file opencode invocation
**UI hint**: yes

### Phase 07.2: Integration Plugin/Extension Infrastructure (INSERTED)

**Goal:** Claude and Gemini integrations use the plugin/extension model. Hook config lives in files plan-reviewer owns. `update` can rewrite them without touching user settings.
**Requirements**: INTEG-05
**Depends on:** Phase 7
**Success Criteria** (what must be TRUE):
  1. `plan-reviewer install claude` writes a plugin directory at `~/.local/share/plan-reviewer/claude-plugin/` with manifest and hooks config, plus two registration entries in `~/.claude/settings.json`
  2. `plan-reviewer install gemini` writes an extension directory at `~/.gemini/extensions/plan-reviewer/` with manifest and hooks config (no settings.json needed)
  3. `plan-reviewer update` detects installed integrations via manifest presence and rewrites stale plugin/extension files
  4. OpenCode plugin file includes a version comment enabling version-aware update
  5. All install/uninstall operations are idempotent
**Plans:** 4/4 plans complete

Plans:
- [x] 07.2-01-PLAN.md — Claude Code plugin directory + settings.json registration
- [x] 07.2-02-PLAN.md — Gemini CLI extension directory with auto-discovery
- [x] 07.2-03-PLAN.md — OpenCode version comment + post-update integration refresh

### Phase 07.3: Hook Subcommand (INSERTED)

**Goal:** The nameless default behaviour (`plan-reviewer` reads stdin JSON) becomes an explicit `plan-reviewer review-hook` subcommand. Existing installs migrate automatically on next `update`.
**Requirements**: INTEG-05
**Depends on:** Phase 07.2
**Success Criteria** (what must be TRUE):
  1. `plan-reviewer review-hook` reads stdin JSON and opens the browser review UI identically to the old bare invocation
  2. Bare `plan-reviewer` (no subcommand, no --plan-file) still works but emits a deprecation warning on stderr
  3. `plan-reviewer --plan-file /path` (opencode) does NOT emit a deprecation warning
  4. All hooks.json write locations (claude.rs install, gemini.rs install, update.rs write functions) use `"plan-reviewer review-hook"` as the command string
  5. `plan-reviewer update` detects pre-plugin installs (old bare settings.json entry, no plugin manifest) and migrates to the plugin model with the new `review-hook` subcommand
**Plans:** 2/2 plans complete

Plans:
- [x] 07.3-01-PLAN.md — Add Commands::ReviewHook subcommand + update all hook command strings
- [x] 07.3-02-PLAN.md — Case 2 pre-plugin migration in update.rs

### Phase 07.4: Add review <file> subcommand
**Goal**: Users can run `plan-reviewer review <file.md>` to open any markdown file in the browser review UI and receive a neutral `{"behavior":"allow"|"deny"}` JSON decision on stdout — no hook JSON construction needed, enabling scripts and agent workflows to use plan-reviewer as a standalone review tool
**Depends on:** Phase 07.3
**Requirements**: REVIEW-01, REVIEW-02, REVIEW-03
**Success Criteria** (what must be TRUE):
  1. `plan-reviewer review <file.md>` opens the browser UI with the file content rendered as HTML
  2. Approving or denying in the browser outputs neutral `{"behavior":"allow"|"deny"}` JSON to stdout
  3. Running `plan-reviewer review <nonexistent>` exits with code 1 and a descriptive error on stderr
  4. The review subcommand never reads stdin — safe to invoke without piped input
**Plans:** 1 plan
Plans:
- [x] 07.4-01-PLAN.md — Add Review subcommand + integration tests

### Phase 8: Annotation Quick-Actions & Theme
**Goal**: Users have six predefined annotation quick-actions that pre-fill the comment field with one click; the browser UI supports toggling between light and dark mode, the preference persists across sessions, and the UI defaults to OS preference on first load
**Depends on**: Phase 4
**Requirements**: ANNOT-01, ANNOT-02, ANNOT-03, THEME-01, THEME-02, THEME-03
**Success Criteria** (what must be TRUE):
  1. Clicking a quick-action chip (clarify this, needs test, give me an example, out of scope, search internet, search codebase) pre-fills the annotation comment field with the action label
  2. User can edit the pre-filled comment text before submitting the annotation
  3. User can toggle between light and dark mode using a control in the browser UI
  4. The chosen theme persists after closing and reopening the browser tab
  5. On first load with no saved preference, the UI matches the OS dark/light setting with no flash
**Plans**: TBD
**UI hint**: yes

### Phase 9: Documentation
**Goal**: Users can find everything needed to install, configure, and wire plan-reviewer in the README; separate integration guides cover Claude Code, Gemini CLI, and opencode
**Depends on**: Phase 6, Phase 7
**Requirements**: DOCS-01, DOCS-02, DOCS-03
**Success Criteria** (what must be TRUE):
  1. A user who has never seen this project can install plan-reviewer using only the README `curl | sh` instructions
  2. The README explains how to approve, deny, and annotate a plan in the browser UI
  3. The README or linked integration guides show the exact `install` command and expected config change for each supported integration (Claude Code, Gemini CLI, opencode)
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Hook & Review UI | v0.1.0 | 4/4 | Complete | 2026-04-09 |
| 2. Annotations & Diff | v0.1.0 | 4/4 | Complete | 2026-04-09 |
| 3. Distribution | v0.1.0 | 3/3 | Complete | 2026-04-10 |
| 4. Subcommands | v0.1.0 | 3/3 | Complete | 2026-04-10 |
| 5. Integration Architecture | v0.3.0 | 0/? | Not started | - |
| 6. Gemini CLI Integration | v0.3.0 | 0/? | Not started | - |
| 6.1. Integration Test Harness | v0.3.0 | 0/3 | Planned | - |
| 7. opencode Integration | v0.3.0 | 2/2 | Complete    | 2026-04-10 |
| 7.2. Integration Plugin Infrastructure | v0.3.0 | 0/3 | Planned | - |
| 7.3. Hook Subcommand | v0.3.0 | 2/2 | Complete | 2026-04-11 |
| 7.4. Review File Subcommand | v0.3.0 | 1/1 | Complete   | 2026-04-11 |
| 8. Annotation Quick-Actions & Theme | v0.3.0 | 0/? | Not started | - |
| 9. Documentation | v0.3.0 | 0/? | Not started | - |
