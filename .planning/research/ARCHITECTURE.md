# Architecture Patterns

**Domain:** Rust CLI tool — stdin JSON in, browser UI review, stdout JSON out
**Researched:** 2026-04-10 (updated for v0.3.0, extended for v0.5.0 Offline Resilience 2026-05-05)
**Confidence:** HIGH for existing code; LOW for opencode/codestral hook protocols (see caveats)

---

## Standard Architecture (v0.1.0 Baseline — Confirmed)

```
stdin (Claude Code)
     |
     v
[1. stdin reader]  ← blocking read on main thread before async runtime starts
     |
     v
[2. AppState]      ← Arc<AppState> — shared between HTTP handler tasks
     |
     +---> [3. Axum HTTP server]  ← spawned on Tokio current_thread runtime, port 0
     |           |
     |           +-- GET  /api/plan        → serves plan JSON to browser
     |           +-- GET  /api/diff        → serves git diff JSON to browser
     |           +-- POST /api/decide      → receives approve/deny + annotations
     |           +-- GET  /*              → rust-embed SPA fallback (index.html)
     |
     +---> [4. browser opener]  ← webbrowser::open() after server ready
     |
     v
[5. decision channel]  ← tokio::sync::oneshot — /api/decide handler sends here
     |
     v
[6. main task]  ← tokio::select! races decision_rx vs 540s timeout
     |
     v
stdout (Claude Code)   ← serde_json::to_string of hookSpecificOutput
```

---

## Actual File Structure (v0.1.0)

```
src/
├── main.rs          # CLI parse (clap), dispatch, extract_diff (git2), run_hook_flow
├── hook.rs          # HookInput / HookOutput serde structs (stdin/stdout protocol)
├── server.rs        # axum HTTP server, rust-embed Assets, oneshot channel, AppState
├── integration.rs   # IntegrationSlug enum, per-integration definitions, Claude helpers, TUI picker
├── install.rs       # run_install + install_claude (Claude only; others stubbed)
├── uninstall.rs     # run_uninstall + uninstall_claude (Claude only; others stubbed)
└── update.rs        # self_update from GitHub releases

ui/
├── src/
│   ├── App.tsx                         # Main SPA: plan/diff/help tabs, approve/deny, annotation state
│   ├── types.ts                        # Annotation, AnnotationType, Tab, ViewMode
│   ├── index.css                       # CSS custom properties (dark theme only), prose styles
│   ├── main.tsx                        # React entry point
│   ├── components/
│   │   ├── AnnotationSidebar.tsx       # Annotation cards, per-card actions
│   │   ├── DiffView.tsx                # Diff rendering
│   │   ├── PlanOutline.tsx             # Heading outline sidebar
│   │   └── TabBar.tsx                  # Plan/Diff/Help tab bar
│   ├── hooks/
│   │   └── useTextSelection.ts         # Text selection hook + rangeFromOffsets
│   └── utils/
│       ├── serializeAnnotations.ts     # Serialize annotations → deny message text
│       └── serializeAnnotations.test.ts
├── index.html
├── package.json
└── vite.config.ts

build.rs             # npm install + npm run build → ui/dist/; rerun-if-changed
```

Note: The milestone context referenced `src/render.rs` and `src/picker.rs` but these do not exist as
separate files. The picker is implemented inside `integration.rs`; markdown rendering is done client-side
in App.tsx via `marked` + `marked-highlight` + `highlight.js` (NOT server-side via comrak as originally
planned; comrak is not in the actual dependency tree).

---

## Component Responsibilities

| Component | Responsibility | Key Interface |
|-----------|---------------|---------------|
| `main.rs` | CLI parse, subcommand dispatch, `extract_diff`, `run_hook_flow`, `async_main` | `Cli`, `Commands`, `extract_diff(cwd)` |
| `hook.rs` | stdin/stdout JSON structs for Claude Code protocol | `HookInput`, `HookOutput`, `PermissionDecision` |
| `server.rs` | axum HTTP, rust-embed assets, oneshot decision channel | `start_server(plan_md, diff_content) -> (port, decision_rx)` |
| `integration.rs` | Integration enum, definitions, Claude helpers, TUI picker | `IntegrationSlug`, `get_integration`, `claude_*` fns, `resolve_integrations` |
| `install.rs` | Write hook entry into target config file | `run_install(Vec<String>)`, `install_claude(home, bin_path)` |
| `uninstall.rs` | Remove hook entry from config file | `run_uninstall(Vec<String>)`, `uninstall_claude(home)` |
| `update.rs` | Self-update from GitHub releases | `run_update(check, version, yes)` |
| `App.tsx` | SPA root: fetch plan/diff, annotation state, approve/deny POST | `App()`, `AppState`, `addAnnotation`, `handleDecide` |
| `AnnotationSidebar.tsx` | Annotation cards driven by App state | `AnnotationSidebar`, `AnnotationCard` |
| `serializeAnnotations.ts` | Serialize annotations → deny message markdown | `serializeAnnotations(denyText, overallComment, annotations)` |

---

## v0.3.0: New Feature Integration Map

### Feature 1: opencode Integration

**Research finding (LOW confidence — no official stdio hook protocol found):**

opencode does NOT have a Claude Code-style ExitPlanMode PermissionRequest hook that receives JSON on
stdin and expects JSON on stdout. opencode's extensibility system is a TypeScript/JavaScript plugin API:

- Plugin directory: `.opencode/plugin/` (project) or `~/.config/opencode/plugin/` (global)
- Config file: `opencode.json` with `"plugin": ["..."]` array for npm-distributed plugins
- Hook API: `tool.execute.before`, `permission.ask`, `tool.execute.after`, etc. — TypeScript functions
- There is no documented shell-command hook that spawns an external binary with JSON on stdin

The community project `open-plan-annotator` (https://github.com/ndom91/open-plan-annotator) achieves
plan review in opencode by registering a `submit_plan` tool that the agent calls. This is a plugin
registered in `opencode.json`, not a shell command wired to a settings file.

**Implication for plan-reviewer:** The current binary cannot be wired into opencode the same way it
works for Claude Code (stdin/stdout JSON shell command). Two paths:

- **Option A (recommended for v0.3.0):** Keep `supported: false`. Update the reason string in
  `integration.rs` to accurately describe the plugin architecture difference. This is honest and
  avoids shipping a broken install flow.
- **Option B (deferred):** Generate a thin TypeScript plugin wrapper that the binary installs into
  `~/.config/opencode/plugin/`. This is scope-expanding and requires confirming the opencode plugin
  protocol version stability.

**Files to modify for Option A:** `src/integration.rs` only — update `unsupported_reason` string.

### Feature 2: codestral Integration

**Research finding (LOW confidence):**

"Codestral" is a Mistral AI language model, not a coding agent with hook infrastructure. The closest
Mistral coding agent is `mistral-vibe`, which uses `~/.vibe/config.toml` (TOML format). mistral-vibe
has agent profiles with approval modes (interactive Shift+Tab, `--auto-approve` flag) but no shell-
command hook that spawns an external binary with JSON on stdin.

**Implication for plan-reviewer:** The stub reason in `integration.rs` ("Codestral is a model, not a
coding agent with hook infrastructure") is accurate. No config file wiring is possible with the current
binary protocol.

**Files to modify:** `src/integration.rs` only — update `unsupported_reason` string if desired.

### Integration Expansion Pattern (for when a real hook format IS confirmed)

The codebase has a clean seam for adding a real integration. Every new backend follows this pattern:

**`src/integration.rs` additions:**
```rust
// 1. Flip supported: true in get_integration match arm
// 2. Add path helper
pub fn opencode_settings_path(home: &str) -> PathBuf {
    PathBuf::from(home).join(".config/opencode/opencode.json")
}
// 3. Add hook entry builder (format depends on confirmed protocol)
pub fn opencode_hook_entry(binary_path: &str) -> serde_json::Value { ... }
// 4. Add idempotency checker
pub fn opencode_is_installed(settings: &serde_json::Value) -> bool { ... }
// 5. Update show_integration_picker to show installed state for this slug
```

**`src/install.rs` additions:**
```rust
// 1. New function following install_claude pattern
fn install_opencode(home: &str, binary_path: &str) { ... }
// 2. Add match arm in run_install
IntegrationSlug::Opencode => install_opencode(&home, &binary_path),
```

**`src/uninstall.rs` additions:** mirror the install pattern.

No changes needed to `main.rs`, `hook.rs`, `server.rs`, or any frontend code for install/uninstall
expansion.

---

### Feature 3: Annotation Predefined Action Types

**What it is:** Quick-action buttons that pre-fill the `comment` field of a new annotation with a
structured prompt. Six requested: "clarify this", "needs test", "give me an example", "out of scope",
"search internet", "search codebase".

**Key design decision:** These are NOT new AnnotationType values. They are shortcuts that populate
`annotation.comment` with a preset string on a `'comment'`-type annotation. This leaves
`serializeAnnotations.ts` and `types.ts` untouched.

**Current state of `FloatingAnnotationAffordance` in `App.tsx`:**
```tsx
const pills: { type: AnnotationType; label: string; ... }[] = [
  { type: 'comment', label: 'Comment', ... },
  { type: 'delete',  label: 'Delete',  ... },
  { type: 'replace', label: 'Replace', ... },
]
// onClick → onAddAnnotation(pill.type, selectedText)
```

**Required change:** `onAddAnnotation` needs an optional third argument `preset?: string` so that
preset pills can pass a pre-filled comment string. The `addAnnotation` function in `App.tsx` creates
the `Annotation` object — it needs to accept this initial comment value.

**Files to modify:**
- `ui/src/App.tsx`: extend `addAnnotation(type, anchorText, preset?)`, add preset pill row to
  `FloatingAnnotationAffordance`
- `ui/src/components/AnnotationSidebar.tsx`: no changes needed (textarea renders `annotation.comment`
  which is pre-filled; user can edit before submitting)
- `ui/src/utils/serializeAnnotations.ts`: no changes (preset text is indistinguishable from typed text)
- `ui/src/types.ts`: no changes (`AnnotationType` union is unchanged)

**New file to add:**
- `ui/src/data/annotationPresets.ts`: array of `{ label: string; preset: string }` for the six
  action types, keeping `App.tsx` clean

---

### Feature 4: Theme Switcher (Light/Dark)

**Current state:** `ui/src/index.css` defines CSS custom properties on `:root` — dark-only values.
All components reference `var(--color-*)` inline styles. No light theme variables exist. No theme
toggle exists.

**Strategy:** CSS `data-theme` attribute override pattern. Add a `[data-theme="light"]` selector block
to `index.css` that overrides the same `--color-*` variable names. Apply the attribute to
`document.documentElement` from React. Persist in `localStorage`.

**Light palette (to define in index.css):**
```css
[data-theme="light"] {
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-border: #e2e8f0;
  --color-code-bg: #f1f5f9;
  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;
  --color-accent-approve: #16a34a;
  --color-accent-approve-hover: #15803d;
  --color-accent-deny: #dc2626;
  --color-focus: #2563eb;
  --color-annotation-highlight: rgba(37, 99, 235, 0.12);
  --color-tab-active: #0f172a;
  --color-tab-inactive: #475569;
}
```

**React state flow:**
```
App mount:
  1. read localStorage.getItem('plan-reviewer-theme') → 'light' | 'dark' | null
  2. if null → detect OS: window.matchMedia('(prefers-color-scheme: dark)').matches
  3. document.documentElement.dataset.theme = resolvedTheme
  4. setTheme(resolvedTheme)

Toggle click:
  1. setTheme(opposite)
  2. document.documentElement.dataset.theme = opposite
  3. localStorage.setItem('plan-reviewer-theme', opposite)
```

**Files to modify:**
- `ui/src/index.css`: add `[data-theme="light"]` block; annotation highlight CSS custom highlight
  colors may also need light-theme variants
- `ui/src/App.tsx`: add `theme` state, `useEffect` for init+persist, toggle button in `PageHeader`

**No new files required.** The toggle button can be a small inline component in `App.tsx` (a sun/moon
icon with click handler), or extracted to `ui/src/components/ThemeToggle.tsx` for clarity.

**No Rust changes required.** Theme is browser state persisted in localStorage; the server serves
static assets that are theme-agnostic.

---

## Recommended Build Order

```
Step 1 — Integration stubs update (Rust, isolated)
    src/integration.rs: update unsupported_reason strings for opencode and codestral
    No other files touched. No frontend changes.

Step 2 — Annotation predefined types (Frontend)
    New:      ui/src/data/annotationPresets.ts
    Modified: ui/src/App.tsx (addAnnotation signature + FloatingAnnotationAffordance)
    Not touched: types.ts, AnnotationSidebar.tsx, serializeAnnotations.ts

Step 3 — Theme switcher (Frontend)
    Modified: ui/src/index.css (add light theme block)
    Modified: ui/src/App.tsx (theme state + toggle in PageHeader)
    Optional new: ui/src/components/ThemeToggle.tsx

Step 4 — User docs / README
    Depends on Steps 1-3 being stable (CLI output, UI appearance)
```

**Step 1 and Steps 2+3 are fully independent** — Rust changes and frontend changes do not touch each
other. Steps 2 and 3 both touch `App.tsx`; sequence them to avoid merge conflicts (complete Step 2
before starting Step 3, or plan the `App.tsx` edits carefully if working simultaneously).

---

## Data Flow

### Hook Review Flow (unchanged for v0.3.0)

```
Claude Code → ExitPlanMode JSON → stdin
    |
main.rs: run_hook_flow
    | parse HookInput (hook.rs)
    | extract_diff(cwd) via git2
    v
server::start_server(plan_md, diff_content)
    | axum binds :0 → (port, decision_rx)
    v
webbrowser::open(url) + eprintln URL
    |
    v (browser)
React SPA
    | GET /api/plan  → { plan_md }
    | GET /api/diff  → { diff }
    | POST /api/decide → { behavior, message }
    v
oneshot channel → decision_rx
    |
main.rs: match decision.behavior → HookOutput → stdout
```

### Install Flow (current + v0.3.0 expansion point)

```
plan-reviewer install [claude|opencode|codestral]
    |
install::run_install(slugs)
    |
integration::resolve_integrations → Vec<IntegrationSlug>
    |
for slug in slugs:
    | get_integration(slug) → defn
    | if !defn.supported → eprintln reason, continue        ← opencode/codestral exit here (v0.3.0)
    | match slug:
    |   Claude    → install_claude(home, bin_path)
    |   Opencode  → install_opencode(...)   ← future
    |   Codestral → install_codestral(...)  ← future
    v
write config file (format depends on integration)
```

### Annotation Predefined Types Flow (v0.3.0)

```
User selects text in plan
    |
FloatingAnnotationAffordance renders:
    | [Comment] [Delete] [Replace]           ← existing type pills (row 1)
    | [Clarify] [Needs Test] [Example] ...   ← new preset pills (row 2)
    |
User clicks preset pill
    |
onAddAnnotation('comment', anchorText, presetText)
    |
addAnnotation creates Annotation{ type:'comment', comment: presetText, anchorText, ... }
    |
AnnotationSidebar: card shows pre-filled textarea (user can edit)
    |
serializeAnnotations: [COMMENT] Feedback on: "..." \n> Clarify this — ...
    |
POST /api/decide: { behavior:'deny', message: serialized }
```

### Theme Switcher Flow (v0.3.0)

```
App mount
    | localStorage.getItem('plan-reviewer-theme') → 'light' | 'dark' | null
    | if null → window.matchMedia('prefers-color-scheme: dark').matches
    | document.documentElement.dataset.theme = resolvedTheme
    v
CSS: [data-theme="light"] overrides --color-* variables
     All var(--color-*) references in components re-resolve from cascade

User clicks toggle
    | setTheme(opposite)
    | document.documentElement.dataset.theme = opposite
    | localStorage.setItem('plan-reviewer-theme', opposite)
    v
CSS cascade re-evaluates — no React re-render needed for color changes
```

---

## Component Boundaries

### Rust — Stable Interfaces (no changes for v0.3.0 theme/presets)

| Boundary | Interface |
|----------|-----------|
| `main.rs` → `integration.rs` | `resolve_integrations(given, prompt)`, `get_integration(slug)`, `claude_*` fns |
| `main.rs` → `install.rs` | `run_install(Vec<String>)` |
| `main.rs` → `uninstall.rs` | `run_uninstall(Vec<String>)` |
| `install.rs` → `integration.rs` | helper fns: `claude_settings_path`, `claude_hook_entry`, `claude_is_installed` |
| `main.rs` → `server.rs` | `start_server(plan_md, diff_content) -> Result<(u16, Receiver<Decision>)>` |
| `main.rs` ↔ `hook.rs` | `HookInput`, `HookOutput` types |

### Frontend — Stable Interfaces (no changes for v0.3.0 theme/presets unless noted)

| Boundary | Interface |
|----------|-----------|
| `App.tsx` → `AnnotationSidebar.tsx` | props: `annotations`, callbacks — unchanged |
| `App.tsx` → `serializeAnnotations.ts` | `serializeAnnotations(denyText, overallComment, annotations)` — unchanged |
| `App.tsx` → `annotationPresets.ts` (new) | `ANNOTATION_PRESETS: { label: string; preset: string }[]` |
| `App.tsx` → `types.ts` | `Annotation`, `AnnotationType`, `Tab`, `ViewMode` — unchanged |

---

## Explicit File Change Table (v0.3.0)

| File | Action | Feature | Notes |
|------|--------|---------|-------|
| `src/integration.rs` | Modify | opencode + codestral | Update `unsupported_reason` strings; add helper fns when protocol confirmed |
| `src/install.rs` | Modify (future) | opencode/codestral | Add `install_opencode`/`install_codestral` + match arms when supported |
| `src/uninstall.rs` | Modify (future) | opencode/codestral | Add `uninstall_opencode`/`uninstall_codestral` + match arms when supported |
| `ui/src/App.tsx` | Modify | presets + theme | Extend `addAnnotation` signature; add preset pills; add theme state + toggle |
| `ui/src/index.css` | Modify | theme | Add `[data-theme="light"]` CSS block |
| `ui/src/data/annotationPresets.ts` | New | presets | Preset label/text pairs |
| `ui/src/components/ThemeToggle.tsx` | New (optional) | theme | Extract toggle button from App.tsx |
| `ui/src/types.ts` | No change | — | `AnnotationType` union unchanged |
| `ui/src/components/AnnotationSidebar.tsx` | No change | — | Presets only affect initial comment value |
| `ui/src/utils/serializeAnnotations.ts` | No change | — | Preset text = typed text in output |
| `src/main.rs` | No change | — | |
| `src/hook.rs` | No change | — | |
| `src/server.rs` | No change | — | |
| `build.rs` | No change | — | |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: New AnnotationType union members for predefined actions

**What people do:** Add `'clarify' | 'needs-test' | 'example' | ...` to the `AnnotationType` union in
`types.ts`, adding branches everywhere.

**Why it's wrong:** All predefined actions serialize identically to a `'comment'` with pre-filled text.
Adding union members forces type-guard changes in `AnnotationSidebar.tsx`, `serializeAnnotations.ts`,
`getTypeColor`, `getBadgeLabel`, and `App.tsx` for zero behavioral difference.

**Do this instead:** Treat presets as a UI shortcut that pre-fills `annotation.comment`. Type stays
`'comment'`.

### Anti-Pattern 2: Server-side theme state

**What people do:** Add `/api/theme` endpoint, store theme in Rust `AppState`.

**Why it's wrong:** Each hook invocation spawns a fresh server process — there is no persistent server.
Server-side storage resets on every review session.

**Do this instead:** `localStorage` in the browser. It survives process restarts and is scoped to
`127.0.0.1`.

### Anti-Pattern 3: Assuming opencode/codestral use stdin/stdout JSON like Claude Code

**What people do:** Write `install_opencode` to add a shell command entry to `~/.config/opencode/
opencode.json` assuming the binary will receive JSON on stdin from opencode.

**Why it's wrong:** opencode's hook system is a TypeScript/JavaScript plugin API, not a stdin/stdout
shell command protocol. The binary would be spawned without the expected JSON on stdin.

**Do this instead:** Research and confirm the exact protocol before implementing. Keep `supported: false`
for v0.3.0 with an accurate reason.

### Anti-Pattern 4: OS theme detection in Rust

**What people do:** Add a Rust crate (e.g., `dark-light`) to detect OS theme and set it as default.

**Why it's wrong:** The UI runs in a browser. CSS `prefers-color-scheme` and `window.matchMedia` handle
OS theme detection natively. No Rust involvement needed.

**Do this instead:** `window.matchMedia('(prefers-color-scheme: dark)').matches` on first mount in
`App.tsx`.

### Anti-Pattern 5: Blocking `install_claude` pattern for TOML-based configs

**What people do:** Reuse the `install_claude` function's `serde_json::Value` manipulation for
mistral-vibe's TOML config.

**Why it's wrong:** mistral-vibe uses `~/.vibe/config.toml` in TOML format. `serde_json` cannot parse
or write TOML. Would require adding `toml` crate + new serialization path.

**Do this instead:** Add a separate `install_vibe` function that uses `toml` (or string manipulation for
simple key insertion) rather than forcing the JSON path.

---

## Integration Points: External Hook Protocols

### Claude Code (confirmed, HIGH confidence)

- **Config file:** `~/.claude/settings.json` (global) or `.claude/settings.json` (project)
- **Hook format:** `hooks.PermissionRequest[].matcher = "ExitPlanMode"` with `hooks[].command`
- **Protocol:** Binary receives full session JSON on stdin; writes decision JSON to stdout
- **Current support:** Fully implemented

### opencode (unconfirmed, LOW confidence)

- **Config file:** `~/.config/opencode/opencode.json` or `./opencode.json`
- **Plugin directory:** `~/.config/opencode/plugin/` (global) or `.opencode/plugin/` (project)
- **Hook format:** TypeScript/JavaScript plugin API; `permission.ask`, `tool.execute.before`
- **Protocol:** Plugin API (JavaScript functions), NOT stdin/stdout shell command
- **Current support:** Stub (`supported: false`)
- **Needed before enabling:** Confirm whether a shell-command stdin/stdout contract exists or document
  the plugin wrapper approach

### codestral / mistral-vibe (unconfirmed, LOW confidence)

- **Config file:** `~/.vibe/config.toml` (TOML format)
- **Hook format:** Agent profiles with approval modes; no external-binary hook protocol found
- **Protocol:** Interactive terminal approval; no hook spawning external binaries
- **Current support:** Stub (`supported: false`)
- **Needed before enabling:** Confirm any shell-command hook protocol exists

---

## Scalability Considerations

This tool handles one session at a time, runs for seconds to minutes, exits. Scalability is irrelevant.
The relevant concerns are binary size and startup latency — unchanged from v0.1.0.

| Concern | Target | Approach |
|---------|--------|----------|
| Binary size | < 10 MB | release + strip + LTO |
| Startup to browser open | < 500 ms | git2 diff is the main variable |
| Light theme flash | none | Read localStorage before first paint (in useEffect with priority, or inline script) |

---

## Sources

- Existing codebase (read directly, HIGH confidence): all `src/*.rs`, `ui/src/**`
- Claude Code hooks reference — PermissionRequest hook protocol (HIGH confidence)
- opencode plugin docs: https://opencode.ai/docs/plugins/ (MEDIUM confidence)
- opencode hooks issue: https://github.com/sst/opencode/issues/1473 (MEDIUM confidence — confirms no
  traditional hook system)
- open-plan-annotator (community opencode plugin): https://github.com/ndom91/open-plan-annotator (LOW
  confidence — community project, uses submit_plan tool not stdin/stdout)
- OpenCode vs Claude Code hooks comparison: https://gist.github.com/zeke/1e0ba44eaddb16afa6edc91fec778935
  (LOW confidence — community gist)
- mistral-vibe README: https://github.com/mistralai/mistral-vibe/blob/main/README.md (MEDIUM confidence)
- [Tokio oneshot channel docs](https://docs.rs/tokio/latest/tokio/sync/oneshot/index.html)
- [axum-embed crate](https://crates.io/crates/axum-embed)
- [rust-embed](https://github.com/pyros2097/rust-embed)

---

---

# v0.5.0 Offline Resilience — Integration Architecture

**Added:** 2026-05-05
**Confidence:** HIGH — based on direct codebase inspection

---

## Existing System (Confirmed from Code)

### API Surface (src/server.rs — as-built)

| Route | Method | Handler | Purpose |
|-------|--------|---------|---------|
| `/api/plan` | GET | `get_plan` | Returns `{plan_md: string}` |
| `/api/diff` | GET | `get_diff` | Returns `{diff: string}` |
| `/api/config` | GET | `get_config` | Returns `{approve_label, deny_label}` |
| `/api/decide` | POST | `post_decide` | Accepts `{behavior, message?}`; fires `oneshot::Sender<Decision>`; 409 if already decided |
| `/*` (fallback) | GET | `ServeEmbed<Assets>` | SPA static files via rust-embed |

### Critical property of `post_decide`

The `decision_tx` `oneshot::Sender` is `.take()`n from a `Mutex<Option<Sender>>`. It fires exactly once. After firing, `/api/decide` returns 409 on all subsequent calls. This is important for the offline path: if the user submits offline (clipboard) and then the server somehow comes back, a subsequent POST to `/api/decide` would 409 — which is fine because the oneshot already fired.

### Decision timeline

```
binary spawns → server starts → browser opens → user reviews
                                                      |
                                  (server exits 3s after decision)
                                                      |
                              binary exits → browser tab orphaned
```

The 3-second watchdog (`tokio::spawn` sleeping 3s then `process::exit(0)`) means the browser tab is alive but the server is dead within seconds of the user's decision. In the `/annotate` flow (background execution), the binary can be killed even before the decision fires — that is the core failure mode this milestone addresses.

---

## New Components for v0.5.0

### 1. Rust: `GET /api/ping` endpoint (src/server.rs)

**What changes:** One new handler function + one new route line.

```rust
// New handler — no AppState needed
async fn get_ping() -> impl IntoResponse {
    StatusCode::OK
}

// In start_server, add to router:
.route("/api/ping", get(get_ping))
```

No changes to `AppState`, `Decision`, `start_server` signature, or any other Rust file. This is the entire backend change.

### 2. Frontend: `ConnectivityStatus` type (ui/src/types.ts)

Add one export:

```typescript
export type ConnectivityStatus = 'online' | 'degraded' | 'offline'
```

### 3. Frontend: `useHeartbeat` hook (ui/src/hooks/useHeartbeat.ts — new file)

**Responsibility:** Poll `/api/ping` at a fixed interval. Return connectivity status.

**State machine:**

```
              ping success          ping success
  online ──────────────► online ◄──────────────── degraded
     │                                                  │
     │ 1st failure                                      │ N consecutive failures
     ▼                                                  ▼
  degraded ──────────────────────────────────────► offline
                    N consecutive failures
```

- `intervalMs` default: 5000 (5 seconds)
- Degraded → offline threshold: 3 consecutive failures (15 seconds total)
- Each fetch: `AbortController` with 2000ms timeout
- Cleanup: `clearInterval` on unmount
- Does not start polling until called (caller gates it to `appState === 'reviewing'`)

**Interface:**

```typescript
function useHeartbeat(
  intervalMs?: number,           // default 5000
  offlineThreshold?: number      // default 3 consecutive failures
): ConnectivityStatus
```

### 4. Frontend: Connectivity banner (inline in App.tsx)

Rendered between `PageHeader` and the two-column layout when `connectivity !== 'online'`.

- Amber/yellow background, informational (not blocking)
- Text: "Server connection lost. Your annotations are safe — submit will copy to clipboard."
- No separate component file needed (10-15 lines of JSX inline in App)

### 5. Frontend: Clipboard submit path (App.tsx — modify existing handlers)

`approve()` and `deny()` branch on `connectivity`:

**Online path (unchanged):**
```
fetch POST /api/decide → transition to 'confirmed'
```

**Offline path (new):**
```
build payload JSON
navigator.clipboard.writeText(JSON.stringify(payload))
setClipboardMode(true)
transition to 'confirmed'
```

The payload mirrors exactly what the server returns on stdout:

- Approve offline: `{behavior: "allow"}`
- Deny offline: `{behavior: "deny", message: serializeAnnotations(denyMessage, overallComment, annotations)}`

**Critical constraint:** `navigator.clipboard.writeText` must be called inside the click event handler synchronously (before any `await`). Do not await any fetch before calling it — that removes the user gesture context and Chrome will reject the clipboard write silently.

**Button label mutation (when `connectivity !== 'online'`):**
- Approve button: relabel to "Copy to clipboard" (or keep label, add note "→ clipboard")
- Submit Denial button: relabel to "Copy feedback"

### 6. Frontend: `ConfirmationView` update (App.tsx)

Add `clipboardMode?: boolean` prop. When true:

> "Copied to clipboard. Paste it into the conversation to submit your review."

instead of the normal "You can close this tab." / "Your feedback has been sent."

### 7. Rust: `annotate.md` Step 4 update (src/integrations/claude.rs)

The `annotate_content` `concat!` string constant — Step 4 section only.

**Current Step 4** instructs Claude to parse stdout JSON only.

**New Step 4** adds a fallback path:

```markdown
## Step 4 — Handle the result

**Primary path — stdout JSON:** If the command produced output on stdout, parse it:

**On `{"behavior":"allow"}`:**
Say: "Review complete, no comments." Then proceed with your next step.

**On `{"behavior":"deny","message":"<feedback>"}`:**
Say: "Feedback received: <feedback>" Then treat the message as revision
instructions for the reviewed content and propose how you will address it.

**Fallback path — clipboard paste:** If stdout is empty or the background process
was killed before it could write output, ask the user:

> "The review server was interrupted. If you copied feedback to the clipboard,
> please paste it here — or let me know if you closed the tab without submitting."

If the user pastes JSON matching `{"behavior":"..."}`, parse it the same way as
the stdout result above. If the user indicates no feedback or pastes nothing,
treat it as: "Review complete, no comments."
```

The test in `claude.rs` (`install_creates_annotate_md_with_expected_content`) asserts specific content strings. Those assertions must be updated to match the new Step 4 text. The test for "Review complete" and "Feedback received" phrasing remains valid — those strings survive in the new text.

---

## Integration Points Summary

| Point | File | Change Type | Notes |
|-------|------|-------------|-------|
| Backend ping route | `src/server.rs` | ADD — 5 lines | One handler + one route entry |
| ConnectivityStatus type | `ui/src/types.ts` | ADD — 1 line | Export new type |
| useHeartbeat hook | `ui/src/hooks/useHeartbeat.ts` | NEW FILE | ~50 lines |
| Connectivity state in App | `ui/src/App.tsx` | MODIFY — call hook | Add `const connectivity = useHeartbeat(5000)` |
| Connectivity banner | `ui/src/App.tsx` | MODIFY — add JSX | 10-15 lines between header and columns |
| approve() handler | `ui/src/App.tsx` | MODIFY — branch | Online: POST; offline: clipboard |
| deny() handler | `ui/src/App.tsx` | MODIFY — branch | Online: POST; offline: clipboard |
| Button labels | `ui/src/App.tsx` | MODIFY — conditional render | Relabel when offline |
| ConfirmationView | `ui/src/App.tsx` | MODIFY — add prop | `clipboardMode?: boolean` |
| annotate.md Step 4 | `src/integrations/claude.rs` | MODIFY — string content | New fallback path instructions |
| annotate.md test | `src/integrations/claude.rs` | MODIFY — update assertions | Match new Step 4 text |
| AnnotationSidebar | `ui/src/components/AnnotationSidebar.tsx` | NO CHANGE | |
| DiffView, TabBar, PlanOutline | `ui/src/components/*.tsx` | NO CHANGE | |
| serializeAnnotations | `ui/src/utils/serializeAnnotations.ts` | NO CHANGE | Already produces the right message string |
| hook.rs, main.rs, install.rs, uninstall.rs, update.rs | `src/*.rs` | NO CHANGE | |

---

## Data Flow Changes

### Online path (no behavioral change)

```
User clicks Submit
  App.tsx approve() or deny()
  → connectivity === 'online'
  → fetch POST /api/decide {behavior, message}
  → server post_decide fires oneshot::Sender<Decision>
  → main.rs: decision_rx fires, stdout JSON written, 3s watchdog starts
  → App.tsx: ConfirmationView (normal mode)
  → browser tab remains open; binary exits in 3s
```

### Offline path (new)

```
useHeartbeat detects consecutive ping failures
  → connectivity: 'online' → 'degraded' → 'offline'
  → App.tsx re-renders: banner shown, button labels change

User clicks Submit (offline)
  App.tsx approve() or deny()
  → connectivity !== 'online'
  → skip fetch entirely
  → build payload: {behavior: "allow"} or {behavior: "deny", message: <serialized>}
  → navigator.clipboard.writeText(JSON.stringify(payload))   ← must be synchronous, inside click handler
  → setClipboardMode(true)
  → setDecision(...); setAppState('confirmed')
  → App.tsx: ConfirmationView (clipboardMode=true)
  → user pastes clipboard content into Claude Code conversation

annotate.md Step 4 (fallback)
  → Claude detects empty stdout or killed process
  → asks user to paste clipboard content
  → user pastes JSON
  → Claude parses {behavior, message} same as stdout
```

### Heartbeat loop

```
useHeartbeat (every 5s after 'reviewing' state)
  → fetch GET /api/ping (AbortController, 2s timeout)
  → success:
      consecutiveFailures = 0
      connectivity = 'online'
  → failure or timeout:
      consecutiveFailures++
      if consecutiveFailures === 1: connectivity = 'degraded'
      if consecutiveFailures >= 3:  connectivity = 'offline'
```

---

## Suggested Build Order

Dependencies drive the ordering. Each step is independently testable before moving to the next.

### Step 1: `GET /api/ping` (Rust — server.rs)

The frontend heartbeat has nothing to poll without this. Smallest possible change (one handler + one route line). Makes the backend complete for this milestone.

Files: `src/server.rs` only.
Test: `cargo test` passes; `curl http://127.0.0.1:{port}/api/ping` returns 200.

### Step 2: `ConnectivityStatus` + `useHeartbeat` hook (Frontend)

Can be developed and manually tested in isolation against the real `/api/ping`. Does not require any UI changes. Build and verify the state machine before touching App.tsx.

Files: `ui/src/types.ts` (one line), `ui/src/hooks/useHeartbeat.ts` (new file).
Test: Unit-test with mocked `fetch`; verify online→degraded→offline transitions and recovery.

### Step 3: Connectivity banner (App.tsx)

Pure rendering — reads `connectivity`, shows/hides. No logic. Visually verifiable before changing submit behavior.

Files: `ui/src/App.tsx` (call hook + add banner JSX).
Test: Temporarily hardcode `connectivity = 'offline'`; verify banner renders correctly.

### Step 4: Clipboard submit path (App.tsx)

Depends on Steps 2 and 3 (connectivity state must exist). Modifies the existing `approve()` and `deny()` functions — the most impactful frontend change. Do this after the banner is verified so the full offline experience can be tested end-to-end.

Files: `ui/src/App.tsx` (branch in approve/deny, button label mutation, ConfirmationView clipboardMode prop).
Test: Mock `navigator.clipboard.writeText`; assert called with correct JSON payload when `connectivity === 'offline'`. Verify online path unchanged.

### Step 5: `annotate.md` Step 4 update (Rust — claude.rs)

No code dependencies on the frontend steps. Pure string constant edit. Last because it is a slash command instruction with no runtime effect — tested only via content-assertion unit tests.

Files: `src/integrations/claude.rs` (update `annotate_content` string + update test assertions).
Test: `cargo test` — the existing `install_creates_annotate_md_with_expected_content` test catches regressions.

---

## Anti-Patterns to Avoid (v0.5.0 specific)

### Making connectivity a blocking UI error

Showing an error dialog or blocking annotation when the server first goes offline interrupts the user's flow mid-review. Connectivity is informational. The user annotates normally; the only behavioral change is at submit time.

### WebSocket instead of polling

A WebSocket connection stays alive only while the server is running. The server's 3-second exit watchdog makes it unreliable as a liveness signal. A missed ping from `setInterval` polling is simpler, more obvious, and requires no persistent connection.

### Adding 'offline' to AppState

`AppState = 'loading' | 'error' | 'reviewing' | 'confirmed'` encodes navigation state. Offline is connectivity state — orthogonal. Mixing them forces every existing `if (appState === 'reviewing')` check to account for offline, creating widespread logic changes.

### Async before clipboard write

`navigator.clipboard.writeText` requires a user gesture context. Any `await` before the call (including `await fetch(...)`) can cause Chrome to reject the write silently. The clipboard write must be the first action in the click handler when offline, before any async work.

### Allowing annotate.md to silently skip empty stdout

If the background process is killed before stdout is written, empty stdout looks identical to "no result." Without an explicit fallback instruction, Claude would infer "no feedback" and proceed. The new Step 4 must explicitly ask the user to paste.

---

## Sources (v0.5.0 section)

- `src/server.rs` — existing route handlers, AppState, oneshot channel (direct inspection, HIGH confidence)
- `src/main.rs` — 3-second exit watchdog, `async_main` flow (direct inspection, HIGH confidence)
- `src/integrations/claude.rs` — `annotate_content` string, test assertions (direct inspection, HIGH confidence)
- `ui/src/App.tsx` — `approve()`, `deny()`, `AppState` type, component layout (direct inspection, HIGH confidence)
- `ui/src/types.ts` — existing type exports (direct inspection, HIGH confidence)
- `ui/src/utils/serializeAnnotations.ts` — serialization output format (direct inspection, HIGH confidence)
- MDN Clipboard API: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText
- MDN AbortController: https://developer.mozilla.org/en-US/docs/Web/API/AbortController
