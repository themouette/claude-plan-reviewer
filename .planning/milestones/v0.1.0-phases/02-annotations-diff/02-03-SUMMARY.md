---
phase: 02-annotations-diff
plan: 03
subsystem: frontend-ui
tags: [integration, layout, annotations, diff, react, typescript]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [full-phase-2-ui, two-column-layout, annotation-flow, diff-view-integration]
  affects: [ui/src/App.tsx, ui/src/components/AnnotationSidebar.tsx, ui/src/index.css]
tech_stack:
  added: []
  patterns:
    - TreeWalker character offset for positional annotation ordering (D-03)
    - Range + surroundContents for anchor highlight via mark element
    - serializeAnnotations integration in deny flow (D-08/D-09)
    - Two-column flex layout with sticky action bar
key_files:
  created: []
  modified:
    - ui/src/index.css
    - ui/src/App.tsx
    - ui/src/components/AnnotationSidebar.tsx
decisions:
  - "Two-column layout uses display:flex row with overflow:hidden on outer container and overflowY:auto on each column -- this allows independent scroll without viewport overflow"
  - "Tab panels use display:none/block toggle rather than conditional rendering to preserve planRef scroll position and annotation highlights across tab switches"
  - "deny() reads state directly (no message parameter) -- consistent with React pattern; serializeAnnotations called at click time not in render"
metrics:
  duration: "2m 54s"
  completed_date: "2026-04-09"
  tasks_completed: 2
  files_modified: 3
---

# Phase 02 Plan 03: App.tsx Integration and CSS Tokens Summary

Two-column annotated plan reviewer with tab-based diff view, positional annotations, anchor highlights, and serialized deny flow wired into App.tsx via all Plan 02 components.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Update index.css with Phase 2 CSS tokens and annotation highlight class | 39ca3eb | ui/src/index.css |
| 2 | Rewrite App.tsx with two-column layout, tabs, annotations, updated deny flow | 2dad393 | ui/src/App.tsx, ui/src/components/AnnotationSidebar.tsx |

## What Was Built

### Task 1: index.css Phase 2 tokens

Added 6 new CSS custom properties to `:root` after `--color-focus`:
- `--color-annotation-highlight`, `--color-annotation-comment`, `--color-annotation-delete`, `--color-annotation-replace`
- `--color-tab-active`, `--color-tab-inactive`

Added `.annotation-highlighted` class using `--color-annotation-highlight` with `border-radius: 3px`.

All existing variables and `.plan-prose` rules preserved unchanged.

### Task 2: App.tsx full Phase 2 rewrite

**Layout (D-01):** Removed `maxWidth: 900px` outer constraint. Added two-column flex row with `overflow: hidden` for independent column scroll.

**TabBar (D-05):** `PageHeader` now accepts `activeTab`/`onTabChange` props and renders `TabBar` on the right via `justifyContent: space-between`. Tab panels use `display: none/block` toggle to preserve DOM state across tab switches.

**Annotations (D-02/D-03):**
- `handleAddAnnotation` uses `getAnchorOffset()` (TreeWalker character offset scan) to insert annotations in positional order — top-to-bottom as anchor text appears in the plan.
- `handleRemoveAnnotation` and `handleUpdateAnnotation` handle lifecycle mutations.
- `crypto.randomUUID()` generates annotation IDs.

**Anchor highlight (D-03):** `highlightAnchor()` uses TreeWalker + `document.createRange()` + `range.surroundContents(mark)` to wrap matched text with a `<mark class="annotation-highlighted">` element. `clearHighlights()` unwraps all marks before each new highlight. Called from `onAnnotationHover`/`onAnnotationLeave` props passed to `AnnotationSidebar`.

**Diff view (D-06/D-07):** `/api/diff` fetched on mount; result passed to `DiffView` component in the diff tab panel.

**Deny flow (D-08/D-09):**
- `serializeAnnotations(denyMessage, overallComment, annotations)` called inside `deny()`.
- `denyMessageValid = denyMessage.trim().length > 0 || hasAnnotations` — textarea is optional when annotations or overallComment exist.

**Enter key suppression (Pitfall 7):** Global `keydown` handler checks `sidebarRef.current?.contains(document.activeElement)` before calling `approve()`.

**ARIA:** Tab panels have `role="tabpanel"`, `id="tabpanel-{tab}"`, `aria-labelledby="tab-{tab}"` matching `TabBar`'s `id="tab-{tab}"` and `aria-controls`.

**AnnotationSidebar.tsx:** Added `onAnnotationHover?: (anchorText: string) => void` and `onAnnotationLeave?: () => void` to props interface. Wired `onMouseEnter`/`onMouseLeave` on each annotation card wrapper `div` in the list. No other logic changed.

## Verification

- `npm run build` in `ui/`: TypeScript compiled + Vite bundle produced successfully
- `cargo check`: finished with 0 errors (2 pre-existing dead_code warnings unrelated to this plan)
- All acceptance criteria verified via grep checks

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data sources are wired: plan HTML from `/api/plan`, diff from `/api/diff`, annotations managed in state and serialized via `serializeAnnotations` on deny.

## Threat Flags

No new threat surface introduced. The `<mark>` element wrapping uses a hardcoded class name with no user input in element construction. Plan HTML is server-side sanitized (ammonia, Phase 1). Annotation text flows through `serializeAnnotations` → JSON string field → `serde_json` serialization on Rust side (per T-02-06, T-02-07 — both accepted).

## Self-Check: PASSED
