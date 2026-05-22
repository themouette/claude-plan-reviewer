# Roadmap: claude-plan-reviewer

## Milestones

- ✅ **v0.1.0 MVP** — Phases 1-4 (shipped 2026-04-10)
- 🚧 **v0.3.0 Integrations, Annotations & Polish** — Phases 5-9 (in progress)
- ✅ **v0.4.0 Agent-Native Review** — Phases 10-11.1 (shipped 2026-04-11)
- ✅ **v0.5.0 Offline Resilience** — Phases 12-16 (shipped 2026-05-07)
- 🚧 **v0.6.0 Markdown Annotator v2** — Phases 17-23 (in progress)

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

### 🚧 v0.4.0 Agent-Native Review (Planned)

**Milestone Goal:** A `/annotate` slash command in the Claude Code plugin lets users review any markdown document from within a Claude conversation, with the result returned to Claude via stdout so it can act on the feedback.

- [x] **Phase 10: Slash Command Install/Uninstall** - `plan-reviewer install claude` creates `commands/annotate.md` in the plugin directory; `plan-reviewer uninstall claude` removes it; `/annotate` appears in Claude Code's slash command menu (completed 2026-04-11)
- [x] **Phase 11: Slash Command Prompt** - The `annotate.md` prompt implements input resolution (explicit path → last `.md` → temp file), background execution via `plan-reviewer review`, and feedback-framed result handling (prompt-only, zero binary changes) (completed 2026-04-11)
- [x] **Phase 11.1: Configurable Review Actions** - Add `--approve-label`/`--deny-label` CLI flags to `plan-reviewer review`; pass labels to frontend for dynamic rendering; update `annotate.md` to use "No issues"/"Leave feedback" labels (completed 2026-04-11)

<details>
<summary>✅ v0.5.0 Offline Resilience (Phases 12-16) — SHIPPED 2026-05-07</summary>

- [x] Phase 12: Backend Heartbeat Endpoint (1/1 plans) — completed 2026-05-07
- [x] Phase 13: Connectivity State & Heartbeat Hook (2/2 plans) — completed 2026-05-07
- [x] Phase 14: Offline Banner & Button Relabeling (2/2 plans) — completed 2026-05-07
- [x] Phase 15: Clipboard Submit Path (2/2 plans) — completed 2026-05-07
- [x] Phase 16: Slash Command Fallback (1/1 plans) — completed 2026-05-07

Full archive: `.planning/milestones/v0.5.0-ROADMAP.md`

</details>

### 🚧 v0.6.0 Markdown Annotator v2 (In Progress)

**Milestone Goal:** Build a standalone 3-column annotation reviewer alongside the existing UI, architecturally isolated under `ui/src/reviewer-v2/`, with heading outline, formatted markdown, anchored comment sidebar, and full submit/clipboard-fallback support.

- [x] **Phase 17: Foundation & Isolation** - Test infrastructure (jsdom mocks, ESLint coupling rule), routing switch in `main.tsx`, v2 types, annotation store, heartbeat, and `/v2` layout shell (completed 2026-05-20)
- [x] **Phase 18: Content Pane** - GFM markdown rendering, paragraph hover highlight + gutter icon, text-selection comment toolbar (completed 2026-05-20)
- [x] **Phase 19: Outline Pane** - Heading tree with click-to-scroll, active section tracking, per-section comment count badges (completed 2026-05-20)
- [x] **Phase 20: Comment Pane** - Anchored comment bubbles that follow scroll, bidirectional hover linking, overlap/collapse handling (completed 2026-05-21)
- [x] **Phase 21: Comment Actions** - Three quick actions (comment/delete/replace), expandable predefined-action menu, edit/delete per bubble (completed 2026-05-22)
- [ ] **Phase 22: Submit & Clipboard** - Approve/ask-for-changes validation gates, clipboard fallback in degraded mode
- [ ] **Phase 23: Replace v1 with v2** - Delete App.tsx and all v1-only files; make ReviewerV2 the sole renderer; open browser at `/` instead of `/v2`

## Phase Details

### Phase 5: Integration Architecture

**Goal**: Integration implementations live in a clean `src/integrations/` folder-per-integration structure; all install/uninstall paths share a common `Integration` trait; idempotency is enforced at the trait boundary so no integration can corrupt config on repeated runs
**Depends on**: Phase 4
**Requirements**: INTEG-05
**Success Criteria** (what must be TRUE):

  1. Running `plan-reviewer install <any-integration>` a second time does not duplicate hook entries or corrupt config
  2. Running `plan-reviewer uninstall <any-integration>` on a clean system exits 0 without error
  3. Adding a new integration requires only implementing the `Integration` trait and registering it — no changes to the install/uninstall command dispatch logic

**Plans:** 1 plan
Plans:

- [x] 10-01-PLAN.md — Idempotency refactor + commands/annotate.md write + unit and integration tests

### Phase 6: Gemini CLI Integration

**Goal**: Users can install and uninstall plan-reviewer as a Gemini CLI `BeforeTool exit_plan_mode` hook via `plan-reviewer install gemini` and `plan-reviewer uninstall gemini`; the hook reads the plan from `tool_input.plan_path` and runs the full browser review flow
**Depends on**: Phase 5
**Requirements**: INTEG-01, INTEG-02
**Success Criteria** (what must be TRUE):

  1. `plan-reviewer install gemini` writes the correct `BeforeTool` hook entry to `~/.gemini/settings.json` without corrupting existing config
  2. Triggering Gemini CLI plan mode opens the plan-reviewer browser UI with the plan content rendered
  3. Approving or denying in the browser returns the correct JSON decision to Gemini CLI
  4. `plan-reviewer uninstall gemini` removes the hook entry from `~/.gemini/settings.json` and leaves all other settings intact

**Plans:** 1 plan
Plans:

- [ ] 10-01-PLAN.md — Idempotency refactor + commands/annotate.md write + unit and integration tests

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

### Phase 07.4: Add review <file> subcommand ✓

**Goal**: Users can run `plan-reviewer review <file.md>` to open any markdown file in the browser review UI and receive a neutral `{"behavior":"allow"|"deny"}` JSON decision on stdout — no hook JSON construction needed, enabling scripts and agent workflows to use plan-reviewer as a standalone review tool
**Depends on:** Phase 07.3
**Requirements**: REVIEW-01, REVIEW-02, REVIEW-03
**Success Criteria** (what must be TRUE):

  1. `plan-reviewer review <file.md>` opens the browser UI with the file content rendered as HTML
  2. Approving or denying in the browser outputs neutral `{"behavior":"allow"|"deny"}` JSON to stdout
  3. Running `plan-reviewer review <nonexistent>` exits with code 1 and a descriptive error on stderr
  4. The review subcommand never reads stdin — safe to invoke without piped input

**Plans:** 1/1 plans complete
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

**Plans:** 2 plans
Plans:

- [x] 08-01-PLAN.md — Quick-action chips + onAddAnnotation callback extension
- [x] 08-02-PLAN.md — Theme toggle, light CSS vars, flash-free init script

**UI hint**: yes

### Phase 9: Documentation

**Goal**: Users can find everything needed to install, configure, and wire plan-reviewer in the README; separate integration guides cover Claude Code, Gemini CLI, and opencode
**Depends on**: Phase 6, Phase 7
**Requirements**: DOCS-01, DOCS-02, DOCS-03
**Success Criteria** (what must be TRUE):

  1. A user who has never seen this project can install plan-reviewer using only the README `curl | sh` instructions
  2. The README explains how to approve, deny, and annotate a plan in the browser UI
  3. The README or linked integration guides show the exact `install` command and expected config change for each supported integration (Claude Code, Gemini CLI, opencode)

**Plans:** 1 plan
Plans:

- [x] 09-01-PLAN.md — Rewrite README.md with install, usage, integration guides, and subcommands reference

---

## v0.4.0: Agent-Native Review

### Phase 10: Slash Command Install/Uninstall

**Goal**: `plan-reviewer install claude` creates `commands/annotate.md` in the plugin directory alongside the existing hook files; `plan-reviewer uninstall claude` removes the `commands/` directory; after install, `/annotate` is discoverable in Claude Code's slash command menu
**Depends on**: Phase 07.2
**Requirements**: PLGN-01, PLGN-02, PLGN-03
**Success Criteria** (what must be TRUE):

  1. After `plan-reviewer install claude`, a `commands/annotate.md` file exists at `~/.local/share/plan-reviewer/claude-plugin/commands/annotate.md`
  2. `/annotate` appears in Claude Code's slash command autocomplete menu after install
  3. After `plan-reviewer uninstall claude`, the `commands/` directory is removed; re-running uninstall exits 0 without error
  4. Integration tests verify the file is created and removed in a tmpdir-isolated HOME

**Plans:** 1/1 plans complete
Plans:

- [ ] 10-01-PLAN.md — Idempotency refactor + commands/annotate.md write + unit and integration tests

### Phase 11: Slash Command Prompt

**Goal**: The `annotate.md` prompt file implements the full `/plan-reviewer:annotate` workflow: resolves the target file via explicit argument, last `.md` session file (from conversation history), or temp file fallback; invokes `plan-reviewer review <file>` via Bash with `run_in_background: true`; and surfaces the result to Claude as feedback (framed as feedback collection, not an approval gate). Zero binary changes — all logic lives in the prompt content.
**Depends on**: Phase 10, Phase 07.4
**Requirements**: SLSH-01, SLSH-02, SLSH-03, SLSH-04, SLSH-05, SLSH-06, SLSH-07
**Success Criteria** (what must be TRUE):

  1. Running `/plan-reviewer:annotate path/to/file.md` opens the browser review UI for that specific file
  2. Running `/plan-reviewer:annotate` with no argument finds the last `.md` file from conversation history and opens it
  3. Running `/plan-reviewer:annotate` when no `.md` was written in the session creates a temp file from the last Claude response via `mktemp` and reviews that
  4. On Approve, Claude proceeds with a "Review complete, no comments" acknowledgment
  5. On Deny (with message), Claude treats the message as feedback and proposes revisions

**Plans:** 1/1 plans complete
Plans:

- [x] 11-01-PLAN.md — Replace annotate_content stub with full /plan-reviewer:annotate prompt + update unit test

### Phase 11.1: Configurable Review Actions

**Goal**: Add `--approve-label` and `--deny-label` CLI flags to `plan-reviewer review`; pass labels through the server to the frontend for dynamic button rendering; update `annotate.md` to use "No issues" / "Leave feedback" labels so the UI itself frames review as feedback collection rather than gating
**Depends on**: Phase 11
**Requirements**: ACT-01, ACT-02, ACT-03, ACT-04
**Success Criteria** (what must be TRUE):

  1. `plan-reviewer review --approve-label "No issues" --deny-label "Leave feedback" file.md` renders those labels in the browser UI
  2. Omitting the flags falls back to current default "Approve" / "Deny" labels
  3. The `annotate.md` slash command invokes `plan-reviewer review` with the custom labels
  4. Existing tests remain green; new tests cover flag parsing and label rendering

**Plans:** 2/2 plans complete
Plans:

- [x] 11.1-01-PLAN.md — CLI flags + server /api/config endpoint + integration tests
- [x] 11.1-02-PLAN.md — Frontend dynamic labels + annotate.md custom label flags

---

## v0.5.0: Offline Resilience

### Phase 12: Backend Heartbeat Endpoint

**Goal**: The server exposes `GET /api/ping` returning 200 OK — the minimal Rust change that unblocks all frontend heartbeat development and lets every subsequent phase be tested against a real server
**Depends on**: Phase 11.1
**Requirements**: HB-01
**Success Criteria** (what must be TRUE):

  1. `curl http://127.0.0.1:{port}/api/ping` returns HTTP 200 with an empty or minimal body
  2. `cargo test` passes with no regressions
  3. The new route appears alongside existing routes in `src/server.rs` with no changes to existing handlers
  4. The endpoint is stateless — no server-side data is read or written

**Plans:** 1 plan
Plans:

- [x] 12-01-PLAN.md — Stateless GET /api/ping route in src/server.rs + integration test in tests/integration/server_cycle.rs (completed 2026-05-07)

### Phase 13: Connectivity State & Heartbeat Hook

**Goal**: A `ConnectivityStatus` type and a `useHeartbeat` hook give the frontend a reliable, tested signal for server reachability — requiring 3 consecutive failures to declare offline, aborting each fetch after 3 seconds, and pausing polling when the browser tab is hidden
**Depends on**: Phase 12
**Requirements**: HB-02, HB-03, HB-04
**Success Criteria** (what must be TRUE):

  1. A single failed ping does not change connectivity status — three consecutive failures are required to transition to `offline`
  2. Each ping request is cancelled after 3 seconds via `AbortSignal.timeout(3000)` so a hung server cannot block the next interval tick
  3. Polling pauses immediately when `document.visibilityState === 'hidden'` and resumes on the next `visibilitychange` event
  4. When the server recovers after being offline, connectivity status returns to `online` after a single successful ping
  5. Vitest tests cover the online→degraded→offline→online transition sequence in isolation

**Plans:** 2/2 plans complete
Plans:
**Wave 1**

- [x] 13-01-PLAN.md — Connectivity reducer + Vitest tests covering online → degraded → offline → online sequence

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 13-02-PLAN.md — useHeartbeat React hook with 5s polling, AbortSignal.timeout(3000), and visibility-aware pause/resume

**UI hint**: yes

### Phase 14: Offline Banner & Button Relabeling

**Goal**: When connectivity is offline, users see a persistent amber banner and submit buttons are relabeled to "Copy to clipboard" — these are pure rendering changes with no submit-path logic; the banner clears automatically when the server recovers
**Depends on**: Phase 13
**Requirements**: OFX-01, OFX-02
**Success Criteria** (what must be TRUE):

  1. An amber non-dismissable banner reading "Server connection lost — working offline" (or equivalent) appears between the page header and the review columns when connectivity is offline
  2. The banner is not shown and cannot be triggered while the server is reachable
  3. Submit buttons are relabeled to "Copy to clipboard" when offline and return to their normal labels when the server recovers
  4. The banner disappears when a successful ping restores connectivity
  5. The offline state is never represented as a blocking error — the annotation UI remains fully interactive

**Plans**: 2 plans
Plans:
**Wave 1**

- [ ] 14-01-PLAN.md — Pure helper module (offlineLabels.ts), Vitest tests, CSS token additions

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 14-02-PLAN.md — App.tsx wiring: OfflineBanner sub-component, useHeartbeat() call, banner mount, three label ternaries

**UI hint**: yes

### Phase 15: Clipboard Submit Path

**Goal**: When offline, clicking "Copy to clipboard" serializes the current annotation state as `{"behavior":"allow"}` or `{"behavior":"deny","message":"..."}` — the identical format the server returns — writes it to the clipboard synchronously, and shows a distinct confirmation screen with "Copied to clipboard — paste into Claude"
**Depends on**: Phase 14
**Requirements**: CLB-01, CLB-02
**Success Criteria** (what must be TRUE):

  1. Clicking "Copy to clipboard" in offline mode places `{"behavior":"allow"}` or `{"behavior":"deny","message":"<text>"}` on the clipboard — format byte-for-byte identical to the server POST response
  2. After a successful clipboard write, a confirmation screen distinct from the normal approve/deny confirmation appears with the instruction "Copied to clipboard — paste into Claude"
  3. The clipboard write is called synchronously inside the click handler with no `await` before it — no transient activation errors in Safari or Firefox
  4. Vitest tests assert the clipboard payload matches the expected JSON shape for both approve and deny cases

**Plans**: 2 plans
Plans:
**Wave 1**

- [x] 15-01-PLAN.md — buildClipboardPayload pure function in offlineLabels.ts + Vitest tests (TDD)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 15-02-PLAN.md — App.tsx wiring: offline branch in approve/deny handlers, ClipboardConfirmationView sub-component

**UI hint**: yes

### Phase 16: Slash Command Fallback

**Goal**: `annotate.md` Step 4 is updated so that when no stdout result arrives (because the server was killed before the user submitted), Claude asks the user to paste the clipboard JSON into the conversation — completing the offline workflow end-to-end
**Depends on**: Phase 15
**Requirements**: SLC-01
**Success Criteria** (what must be TRUE):

  1. The updated `annotate.md` Step 4 instructs Claude to ask for a pasted clipboard JSON if stdout is empty when the background process exits
  2. When a user pastes `{"behavior":"allow"}`, Claude proceeds as it would for a normal approve result
  3. When a user pastes `{"behavior":"deny","message":"..."}`, Claude treats the message as feedback and proposes revisions
  4. The existing stdout path (server alive, result arrives normally) is unchanged — the fallback triggers only on empty stdout
  5. The `install_creates_annotate_md_with_expected_content` unit test is updated to assert the new Step 4 text

**Plans**: 1 plan
Plans:

- [x] 16-01-PLAN.md — Update annotate_content Step 4 with clipboard paste fallback + update test assertion (completed 2026-05-07)

---

## v0.6.0: Markdown Annotator v2

### Phase 17: Foundation & Isolation

**Goal**: The v2 reviewer scaffold is in place — test infrastructure (jsdom mocks, ESLint coupling rule) prevents regressions and enforces isolation before any feature code is written; `main.tsx` routes `/v2` to the new entry; shared types and annotation store exist; the new reviewer renders at `/v2` with a 3-column layout shell; heartbeat runs independently of the existing component tree
**Depends on**: Phase 16
**Requirements**: TEST-02, TEST-03, ARCH-01, ARCH-02, LAYOUT-01, LAYOUT-02
**Success Criteria** (what must be TRUE):

  1. Navigating to `/v2` renders a 3-column shell (left/center/right) with no content yet — the layout boundary is visible
  2. `npm run lint` fails with an error if any file outside `reviewer-v2/` imports from inside it — the ESLint rule is active and catches violations
  3. `npm test` passes and jsdom mocks for `IntersectionObserver`, `ResizeObserver`, and `CSS.highlights` are registered before any test runs — v2 component tests can be written immediately
  4. The `/v2` reviewer polls `/api/ping` independently — opening `/v2` without the existing reviewer mounted still maintains heartbeat/connectivity state
  5. All v2 code lives exclusively under `ui/src/reviewer-v2/` — no v2 files appear outside that directory

**Plans:** 3/3 plans complete
Plans:
**Wave 1**

- [x] 17-01-PLAN.md — Test infrastructure: jsdom install + vitest.setup.ts + ESLint reviewer-v2 coupling block

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 17-02-PLAN.md — v2 subtree foundation: types, copied connectivity/serializeAnnotations/offlineLabels, useHeartbeat copy, useAnnotations reducer hook + tests

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 17-03-PLAN.md — ReviewerV2 + 3-column shell + /v2 routing branch in main.tsx + human verification of layout boundary

**UI hint**: yes

### Phase 18: Content Pane

**Goal**: The center pane renders the plan markdown as formatted HTML with GFM support; hovering a paragraph reveals a gutter icon and subtle background; selecting text shows an anchored comment toolbar — the interaction affordances for commenting are complete (annotation storage and the real onAction/onAdd dispatch are scoped to Phase 21)
**Depends on**: Phase 17
**Requirements**: LAYOUT-02, CONTENT-01, CONTENT-02, CONTENT-03
**Success Criteria** (what must be TRUE):

  1. The markdown plan renders with GFM formatting: tables render as grids, task list items show checkboxes, strikethrough renders with strikethrough styling, code blocks are syntax-highlighted
  2. Hovering over any paragraph shows a subtle background color change and a `+` icon at the right edge of the paragraph
  3. Selecting text in the content pane shows a toolbar anchored to the selection end — the hover highlight disappears and a selection highlight appears while text is selected
  4. Text selections serialize to character offsets (not DOM paths) — confirmed by inspecting the toolbar's data payload in browser devtools

**Plans:** 3/3 plans complete
Plans:
**Wave 1**

- [x] 18-01-PLAN.md — Foundation utilities: useTextSelection copy + markdownRenderer + unit tests (complete 2026-05-20)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 18-02-PLAN.md — Affordance components: GutterIcon + SelectionToolbar (pills + more expander) + tests (complete 2026-05-20)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 18-03-PLAN.md — PlanContent + ContentPane wiring + Shell integration + index.css + human verify

**UI hint**: yes

### Phase 19: Outline Pane

**Goal**: The left pane shows the document's heading hierarchy as an indented tree; clicking an item scrolls the corresponding heading into view; the active section tracks scroll position and is highlighted; each item shows its comment count
**Depends on**: Phase 18
**Requirements**: OUTLINE-01, OUTLINE-02, OUTLINE-03
**Success Criteria** (what must be TRUE):

  1. All headings in the document appear in the outline panel, indented proportionally to their depth (H2 deeper than H1, H3 deeper than H2, etc.)
  2. Clicking any outline item scrolls that heading to the top of the content viewport — the browser URL does not change (no hash navigation)
  3. As the user scrolls the content pane, the outline item for the heading closest to the top of the viewport is highlighted and scrolled into the outline panel's view automatically

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 19-01-PLAN.md — Heading id injection: slugify + extractRawText exports + heading renderer in markdownRenderer.ts (TDD)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 19-02-PLAN.md — Section type + ContentPane onSectionsFound callback + heading walk useEffect (TDD)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 19-03-PLAN.md — OutlinePane component + ReviewerV2Shell wiring + human verify

**UI hint**: yes

### Phase 20: Comment Pane

**Goal**: Comments appear in the right sidebar floating at the vertical level of their anchor text; as content scrolls, comment positions update to stay aligned with their anchors; hovering creates a bidirectional highlight between comment and anchor text; overlapping comments collapse to compact previews with one focused card expanded
**Depends on**: Phase 18
**Requirements**: COMMENT-01, COMMENT-02, COMMENT-03
**Success Criteria** (what must be TRUE):

  1. Each comment bubble appears in the right column at the same vertical position as its anchor text in the center pane; when the content pane scrolls, comment bubbles reposition to remain aligned with their anchors
  2. Hovering a comment bubble highlights the corresponding anchor text in the center pane; hovering the anchor text highlights the corresponding comment bubble — both directions work
  3. When two or more comments would overlap vertically, non-focused comments collapse to a 2-line preview; the focused (last-clicked) comment expands to full height and snaps to its anchor Y position
  4. All comments remain reachable by scrolling the comment column — no comment is permanently hidden behind another

**Plans:** 3/3 plans complete
Plans:
**Wave 1**

- [x] 20-01-PLAN.md — Annotation type extension, computeCommentLayout pure function (TDD), comment-hover CSS highlight rule

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 20-02-PLAN.md — CommentBubble (compact/expanded states) + CommentPane (scroll/ResizeObserver subscription, computeCommentLayout integration)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 20-03-PLAN.md — Shell state lift (annotations + hover/focus + planRef), ContentPane handleAction dispatch + CSS Highlights effect, human verification

**UI hint**: yes

### Phase 21: Comment Actions

**Goal**: Users can create, edit, and delete comments via quick-action triggers on paragraph hover and text selection; three primary actions pre-fill the comment textarea; an expandable menu offers six predefined actions; existing bubbles have edit and delete controls
**Depends on**: Phase 20
**Requirements**: COMMENT-04, COMMENT-05, OUTLINE-04
**Success Criteria** (what must be TRUE):

  1. After hovering a paragraph or selecting text, three quick-action buttons appear: "Comment" (opens textarea), "Delete" (directly creates a delete bubble — no textarea), "Replace" (opens textarea with orange/amber accent border)
  2. An expandable menu button reveals six predefined actions — "Clarify this", "Needs test", "Give me an example", "Out of scope", "Search the web", "Search codebase" — each directly creates a comment bubble with that label (no textarea)
  3. Every submitted comment bubble shows a pencil icon (edit) and an × icon (delete); clicking the pencil reopens the textarea with the existing text for inline editing; clicking × removes the bubble immediately with no confirmation dialog
  4. Each outline item shows a badge with the count of comments anchored within that section; a section with no comments shows no badge; adding a comment in the content pane updates its section's count immediately

**Plans:** 7/7 plans complete
Plans:
**Wave 1**

- [x] 21-01-PLAN.md — AnnotationForm component + getElementCharOffset utility + useSectionAnnotationCounts hook (foundation/pure)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 21-02-PLAN.md — ContentPane formState + AnnotationForm render branch + gutter-icon programmatic paragraph selection (D-06)
- [x] 21-03-PLAN.md — CommentBubble edit/delete icons + inline edit textarea + CommentPane sticky pinning for editing bubble

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 21-04-PLAN.md — ReviewerV2Shell integration (editingId, useSectionAnnotationCounts) + OutlinePane count badges + human verification

**UI hint**: yes

### Phase 22: Submit & Clipboard

**Goal**: The submit bar enforces annotation discipline — Approve is blocked when comments exist, Ask for changes is blocked when no comments exist; when the server is unreachable, submission falls back to clipboard using the existing `buildClipboardPayload` and `shouldUseClipboard` utilities without reimplementing them
**Depends on**: Phase 21, Phase 17
**Requirements**: SUBMIT-01, SUBMIT-02
**Success Criteria** (what must be TRUE):

  1. Clicking "Approve" is impossible (button disabled) when one or more comments exist in the annotation store
  2. Clicking "Ask for changes" is impossible (button disabled) when no comments exist
  3. "Ask for changes" accepts an optional free-text overall message before submission; submitting without a message is permitted
  4. The JSON returned by the v2 submit path is identical in format to the existing reviewer's server response — both approve and ask-for-changes cases
  5. When offline, the submit action writes to the clipboard using the same `buildClipboardPayload` utility as the existing reviewer — no separate clipboard implementation exists in v2 code

**Plans:** 3/4 plans executed
Plans:
**Wave 1**

- [x] 22-01-PLAN.md — OFFLINE_BANNER_LINE_1 / LINE_2 constants added to reviewer-v2/offlineLabels.ts (foundation for v2 OfflineBanner)
- [x] 22-02-PLAN.md — SubmitPopover component (controlled open/dismiss, autoFocus textarea, Cmd+Enter submit, source-contract test)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 22-03-PLAN.md — SubmitControls component (Approve + Send Feedback dropdown, gate logic, online + offline submission paths, inline confirmations, source-contract test)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 22-04-PLAN.md — ReviewerV2Shell wiring (lift useHeartbeat, inline OfflineBanner, mount SubmitControls in header) + ReviewerV2.tsx cleanup + index.css transition rule + human verification

**UI hint**: yes

### Phase 23: Replace v1 with v2

**Goal**: Delete App.tsx and all v1-only source files; make ReviewerV2 the sole renderer at `/`; open the browser at `/` instead of `/v2`; clean up v1 tests
**Depends on**: Phase 22
**Requirements**: TEST-01 (repurposed — no v1 code left to regress)
**Success Criteria** (what must be TRUE):

  1. `main.tsx` renders `<ReviewerV2 />` unconditionally — no `isV2` branch, no `import App`
  2. `src/main.rs` opens the browser at `http://127.0.0.1:{port}/` (not `/v2`)
  3. `ui/src/App.tsx` is deleted along with all v1-only files (`ui/src/components/`, `ui/src/hooks/`, `ui/src/utils/`)
  4. `npm test` and `cargo test` pass with zero failures after deletion
  5. No remaining source file imports from the deleted v1 paths

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
| 8. Annotation Quick-Actions & Theme | v0.3.0 | 0/2 | Planned | - |
| 9. Documentation | v0.3.0 | 0/? | Not started | - |
| 10. Slash Command Install/Uninstall | v0.4.0 | 1/1 | Complete   | 2026-04-11 |
| 11. Slash Command Prompt | v0.4.0 | 1/1 | Complete   | 2026-04-11 |
| 11.1. Configurable Review Actions | v0.4.0 | 2/2 | Complete   | 2026-04-11 |
| 12. Backend Heartbeat Endpoint | v0.5.0 | 1/1 | Complete    | 2026-05-07 |
| 13. Connectivity State & Heartbeat Hook | v0.5.0 | 2/2 | Complete    | 2026-05-07 |
| 14. Offline Banner & Button Relabeling | v0.5.0 | 2/2 | Complete    | 2026-05-07 |
| 15. Clipboard Submit Path | v0.5.0 | 2/2 | Complete    | 2026-05-07 |
| 16. Slash Command Fallback | v0.5.0 | 1/1 | Complete    | 2026-05-07 |
| 17. Foundation & Isolation | v0.6.0 | 3/3 | Complete    | 2026-05-20 |
| 18. Content Pane | v0.6.0 | 3/3 | Complete    | 2026-05-20 |
| 19. Outline Pane | v0.6.0 | 3/3 | Complete    | 2026-05-20 |
| 20. Comment Pane | v0.6.0 | 3/3 | Complete   | 2026-05-21 |
| 21. Comment Actions | v0.6.0 | 7/7 | Complete   | 2026-05-22 |
| 22. Submit & Clipboard | v0.6.0 | 3/4 | In Progress|  |
| 23. Regression Tests | v0.6.0 | 0/? | Not started | - |
