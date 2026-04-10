# Phase 2: Annotations & Diff - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a structured feedback surface and diff view to the existing plan reviewer. A developer can select text in the rendered plan, attach Comment / Delete / Replace annotations in a sidebar panel, add a global comment, view the working-tree git diff alongside the plan, and when they deny — all annotations are serialized as structured markdown in the deny message that Claude receives. Approve-with-comments is v2 (UX-02) and out of scope here.

</domain>

<decisions>
## Implementation Decisions

### Annotation UX — Sidebar Panel
- **D-01:** Two-column layout: plan content on the left, annotations sidebar on the right. No split pane for plan+diff (those use tabs — see D-05).
- **D-02:** To annotate: user selects text in the plan → a "+" button / "Add annotation" affordance appears in the sidebar for that selection → a type picker appears (Comment / Delete / Replace) → then the relevant form (textarea for Comment, replacement textarea for Replace, auto-save for Delete).
- **D-03:** Annotations listed in positional order (top-to-bottom as their anchor text appears in the plan). Hovering an annotation highlights the anchored text in the plan.
- **D-04:** Global comment (ANN-04 — not anchored to specific text) is a dedicated "Overall Comment" field pinned at the **top** of the sidebar, always visible, no text selection required.

### Plan + Diff Navigation
- **D-05:** Tab bar in the header: **Plan** (default, active on load) | **Diff**. Tab switching is pure React state — no router, no URL change. Keeps the existing single-page structure and avoids adding react-router as a dependency.
- **D-06:** If no working-tree diff is available (clean working directory, not a git repo, or git2 error), the Diff tab shows a clear empty-state message: e.g. "No changes in working tree" or "Not a git repository". No crash, no hidden tab.

### Diff Highlighting
- **D-07:** Use `@pierre/diffs` (https://diffs.com/) for diff display. This library provides both unified diff rendering and language-aware syntax highlighting in a single package. Add it to the React bundle. The Rust server provides the raw unified diff text; the React component renders it using this library.

### Annotation Message Format
- **D-08:** Structured sections format. The deny message Claude receives is:

  ```
  [optional textarea text, if user typed one]

  ## Overall Comment
  [global comment if present]

  ## Annotations

  ### Comment on: "[quoted anchor text]"
  [comment text]

  ### Delete: "[quoted anchor text]"

  ### Replace: "[quoted anchor text]"
  With: [replacement text]
  ```

  Sections omitted when empty. If only a textarea message and no annotations, the original plain deny message format is preserved (no extra sections).

- **D-09:** The deny textarea is **optional** when annotations exist (not required as it is today). The final message = textarea text (if any) prepended before the `## Overall Comment` / `## Annotations` sections. If no annotations at all, the textarea remains required (existing behavior D-06 from Phase 1).

### Claude's Discretion
- Exact sidebar width and visual split ratio
- Annotation card styling (highlight color for anchored text, card border, etc.)
- How "Add annotation" affordance appears (e.g., sidebar button activates when text is selected vs persistent "+ Add" always visible)
- Error handling for git2 failures beyond "no diff available"
- Exact wording of empty-state messages in Diff tab

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Annotations — ANN-01→ANN-05: comment, delete, replace, global comment, serialization into deny message
- `.planning/REQUIREMENTS.md` §Code Diff View — DIFF-01→DIFF-03: git diff from cwd, display alongside plan, unified format with highlighting

### Technology stack
- `CLAUDE.md` §Recommended Stack — git2 (diff parsing), full dependency rationale; axum/rust-embed patterns already in use
- `https://diffs.com/` — `@pierre/diffs` npm library chosen for diff display + syntax highlighting (user decision D-07)

### Existing source files to extend
- `src/server.rs` — AppState (add diff field), API routes (add GET /api/diff), start_server signature
- `src/hook.rs` — HookInput with `cwd: String` field (DIFF-01 source) and `ToolInput`
- `src/main.rs` — async_main wiring (pass cwd to server start, render diff)
- `ui/src/App.tsx` — existing React component to extend with tab bar, sidebar panel, annotation state

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/render.rs` — `render_plan_html()` with comrak + ammonia: established pattern for server-side rendering. Diff rendering should follow the same module pattern (a `render_diff()` function in the same or a new module).
- `AppState` in `src/server.rs`: currently `{ plan_html: String, decision_tx: Mutex<Option<oneshot::Sender<Decision>>> }`. Needs a `diff_html: String` (or `diff_content: String`) field added for the diff route.
- `ui/src/App.tsx`: single `useState` machine (`AppState` type). Extend to add tab state (`activeTab: 'plan' | 'diff'`) and annotation state (`annotations: Annotation[]`).

### Established Patterns
- **Server-side HTML rendering**: `render.rs` renders markdown → HTML server-side. Same approach should be used for diff (or pass raw unified diff text to the client for `@pierre/diffs` to render client-side — the library likely expects raw diff text).
- **API data flow**: `GET /api/plan` returns `{ plan_html }`. New `GET /api/diff` should return `{ diff }` (raw unified diff string, or empty string if none).
- **AppState extension**: `Arc<AppState>` pattern with `Mutex`-wrapped channels is established. Adding `diff_content: String` is straightforward.
- **Inline styles**: The React app uses inline CSS custom properties for theming (`var(--color-surface)` etc.) — annotations sidebar should follow the same pattern.
- **No router**: App is SPA with state machine, no react-router. Tab switching via `useState<'plan' | 'diff'>` fits existing pattern.

### Integration Points
- `HookInput.cwd` → pass to `start_server()` → extract git diff via `git2::Repository::open(cwd)?.diff_index_to_workdir()` → store as `diff_content` in `AppState`
- `GET /api/diff` → return `{ diff: diff_content }` (empty string if no diff)
- `POST /api/decide` body: stays `{ behavior, message }` — annotations are serialized client-side before the POST, no server-side change needed to the decision flow
- `Cargo.toml`: add `git2 = { version = "0.20", features = ["vendored"] }` (vendored avoids libgit2 system dependency; consistent with CLAUDE.md recommendation)

</code_context>

<specifics>
## Specific Ideas

- `@pierre/diffs` at https://diffs.com/ — user's specific library choice for diff rendering. Research the exact npm package name and API before planning.
- Sidebar layout: plan content | annotations — not a fixed percentage split, sidebar should feel like a panel (maybe 300–350px fixed or resizable at Claude's discretion).
- Annotations serialize as structured markdown sections (## Overall Comment, ## Annotations with ### per annotation) — this is the exact output format Claude reads.
- Textarea + annotations combined in final message: textarea text prepended, annotation sections appended. Textarea optional when annotations exist.

</specifics>

<deferred>
## Deferred Ideas

- Approve-with-comments (attach notes to an approval) — v2, UX-02 in REQUIREMENTS.md
- Line-level diff annotations (annotate specific diff lines) — explicitly Out of Scope in REQUIREMENTS.md
- Annotation persistence across sessions — Out of Scope (in-memory per session only)
- Countdown timer in review UI — v2, UX-01 in REQUIREMENTS.md

</deferred>

---

*Phase: 02-annotations-diff*
*Context gathered: 2026-04-09*
