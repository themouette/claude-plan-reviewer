# Phase 8: Annotation Quick-Actions & Theme - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Add six predefined annotation quick-actions to the floating text-selection affordance, and implement a persistent light/dark theme switcher. Quick-actions pre-fill a comment annotation's text field. Theme toggles via a header control, persists to localStorage, and defaults to OS preference on first load with no flash.

</domain>

<decisions>
## Implementation Decisions

### Quick-action placement
- **D-01:** Quick-action chips appear in the existing `FloatingAnnotationAffordance` (App.tsx), *not* in the AnnotationCard sidebar
- **D-02:** Order: existing pills first ([Comment] [Delete] [Replace]), then quick-action chips appended after — keep existing order, add new options after
- **D-03:** Show the first 2 quick-action chips inline; the remaining 4 go into a "▾ more" dropdown overflow menu
- **D-04:** Quick-action chip labels (in order): "clarify this", "needs test", "give me an example", "out of scope", "search internet", "search codebase" — first 2 shown inline, last 4 in dropdown
- **D-05:** Clicking a quick-action chip creates a `comment`-type annotation with the `comment` field pre-filled with the chip label as text; the anchor text is the selected text (same as clicking Comment)
- **D-06:** The pre-filled comment is editable in the sidebar — no immediate submit

### Theme toggle
- **D-07:** Toggle control is a sun/moon icon button placed at the far right of `PageHeader` (App.tsx), after the `TabBar`
- **D-08:** Theme is stored in `localStorage` under key `plan-reviewer-theme` with values `"dark"` or `"light"`
- **D-09:** Theme is applied via `data-theme` attribute on `<html>`: `data-theme="dark"` (default) or `data-theme="light"`
- **D-10:** Flash-free first load: add an inline `<script>` block in `ui/index.html` (before the React bundle) that reads `localStorage["plan-reviewer-theme"]`; if set, applies it immediately; if not set, reads `window.matchMedia("(prefers-color-scheme: dark)")` and applies accordingly
- **D-11:** Light theme CSS vars live in `index.css` under `[data-theme="light"]` selector block; dark theme vars stay in `:root` (current default)

### Light theme palette
- **D-12:** Claude's discretion — standard light palette using off-white background (`#f8fafc`), light gray surface (`#f1f5f9`), dark text (`#0f172a`), and matching secondary/border/code-bg values
- **D-13:** Highlight.js code block styling in light mode: Claude's discretion (may keep dark code blocks or switch to `github.css` dynamically)

### Claude's Discretion
- Exact dropdown implementation for the "▾ more" overflow menu (CSS-only, a `<details>` element, or React state)
- Keyboard accessibility and dismissal behavior for the overflow dropdown
- Exact hex values for light theme variables
- Whether to dynamically swap hljs stylesheet in light mode

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` §ANNOT-01–ANNOT-03, THEME-01–THEME-03 — Full requirement text for all 6 requirements this phase covers
- `.planning/ROADMAP.md` §Phase 8 — Goal, success criteria, dependency on Phase 4

### UI source files (primary targets)
- `ui/src/App.tsx` — `FloatingAnnotationAffordance` (where chips are added, lines ~127–178), `PageHeader` (where theme toggle goes, lines ~32–55); also contains `onAddAnnotation` callback — signature may need extension for pre-filled comment
- `ui/src/components/AnnotationSidebar.tsx` — `AnnotationCard` component; comment textarea target for pre-fill (lines ~139–180)
- `ui/src/index.css` — All CSS custom properties; currently dark-only in `:root`; light theme vars added here under `[data-theme="light"]`
- `ui/index.html` — Entry HTML; inline `<script>` for flash-free theme must be injected here before the module script

### Types and contracts
- `ui/src/types.ts` — `Annotation`, `AnnotationType` types; check if `Annotation.comment` field exists to confirm pre-fill target

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FloatingAnnotationAffordance` (App.tsx ~127–178): Renders pill buttons for Comment/Delete/Replace. Already has `onAddAnnotation(type, selectedText)` callback. Quick-action chips reuse this same pattern and call `onAddAnnotation('comment', selectedText)` with an additional pre-fill string.
- CSS custom properties (`--color-*` vars in `index.css`): All components already reference these; adding a `[data-theme="light"]` override block requires no component changes beyond the `data-theme` attribute on `<html>`.

### Established Patterns
- Inline styles throughout all components (no Tailwind utility classes in component files — Tailwind only imported in `index.css`)
- `var(--color-*)` references in every component — theme switching via CSS vars is the correct approach, no component-level style changes needed
- Buttons follow: `background: none`, `border: none`, hover via `onMouseOver`/`onMouseOut` inline handlers, focus via `onFocus`/`onBlur` + `var(--color-focus)` outline

### Integration Points
- `FloatingAnnotationAffordance` receives `onAddAnnotation: (type: AnnotationType, anchorText: string) => void` — to support pre-fill, either extend this signature to `(type, anchorText, comment?: string)` or add a separate `onAddQuickAction(label, anchorText)` handler in App.tsx state
- `Annotation` type in `types.ts` already has a `comment` field — pre-fill sets this at creation time rather than leaving it empty
- `ui/index.html` has no existing `<script>` tag in `<head>` — flash-free theme script goes directly in `<head>` before `</head>`

</code_context>

<specifics>
## Specific Ideas

- Floating affordance layout after changes: `[Comment] [Delete] [Replace] [clarify this] [needs test] [▾ more]`
- "▾ more" dropdown contains: "give me an example", "out of scope", "search internet", "search codebase"
- The `data-theme` approach on `<html>` is the standard FOUC-prevention pattern — the inline script must run synchronously (not `async`/`defer`) to set the attribute before paint

</specifics>

<deferred>
## Deferred Ideas

- Order of quick-action chips discussed but deferred — keep the requirement-specified order for now; reordering is a future UX iteration
- Three-state theme picker (System/Light/Dark) — already in REQUIREMENTS.md Out of Scope for this version

</deferred>

---

*Phase: 08-annotation-quick-actions-theme*
*Context gathered: 2026-04-11*
