# Phase 19: Outline Pane - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the left-column outline pane: heading hierarchy tree (OUTLINE-01), click-to-scroll (OUTLINE-02), and active section tracking as the user scrolls (OUTLINE-03). Comment count badges (OUTLINE-04) are deferred to Phase 21.

The OutlinePane replaces the placeholder `<aside>` in `ReviewerV2Shell`. ContentPane is extended to extract headings from its rendered DOM and report them up to Shell. The center `<main>` element's scroll events drive the active section state via IntersectionObserver.

</domain>

<decisions>
## Implementation Decisions

### Data Flow (ContentPane → OutlinePane)

- **D-01:** ContentPane callback — after `planHtml` loads, ContentPane walks its rendered DOM (`querySelectorAll('h1,h2,h3,h4,h5,h6')`), builds a `Section[]`, and calls `onSectionsFound(sections)`. `ReviewerV2Shell` stores `sections` in state and passes them to OutlinePane as a prop. ContentPane keeps its own `/api/plan` fetch — Shell is not refactored into a data owner.
- **D-02:** Heading IDs for scroll targeting — `renderMarkdown` is extended with a custom `marked` heading renderer that adds a slugified `id` attribute to each heading (e.g., `"My Heading"` → `"my-heading"`; duplicates get numeric suffixes: `"my-heading-2"`). `Section = { id: string, text: string, depth: number }`. No DOM nodes stored in state. OutlinePane calls `document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })` on click. This satisfies OUTLINE-02: no URL change, no hash navigation.

### Scope Adjustment (OUTLINE-04 deferred)

- **D-03:** OUTLINE-04 (comment count badges) is fully deferred to Phase 21. Phase 19 implements OUTLINE-01, OUTLINE-02, and OUTLINE-03 only. No badge UI, no `sectionId` field on `Annotation`. Phase 21 will add `sectionId` to `Annotation` and render badges alongside the comment creation flow.

### Active Section Tracking (OUTLINE-03)

- **D-04:** IntersectionObserver with `root: mainRef.current` (the center `<main>` scroll container) and a narrow top-band `rootMargin` (e.g., `-10px 0px -85% 0px`). When a heading enters the narrow top band, it becomes the active section. Zero polling, browser-native.
- **D-05:** Outline panel auto-scroll — when `activeId` changes, call `activeItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` on the corresponding outline item's ref. `block: 'nearest'` prevents jarring scroll when the item is already visible.

### Claude's Discretion

- Exact `rootMargin` values for the IntersectionObserver top band — calibrate during implementation.
- Slug collision strategy for duplicate heading text (numeric suffix is the direction; exact implementation up to planner).
- Directory structure for new files within `reviewer-v2/` (e.g., `OutlinePane.tsx`, `hooks/useOutline.ts`).
- Whether the `useOutline` scroll tracking logic lives as a standalone hook or inline within `OutlinePane`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Phase 19 covers: OUTLINE-01, OUTLINE-02, OUTLINE-03 (OUTLINE-04 deferred to Phase 21)
- `.planning/ROADMAP.md` Phase 19 — Success criteria (items 1–3 only; item 4 is deferred)

### Architecture Constraints
- `.planning/PROJECT.md` — Key Decisions table; isolation rule (reviewer-v2 may not import from outside its subtree); React 19 decision
- `.planning/STATE.md` — v0.6.0 accumulated decisions

### Phase 17 Decisions (still in force)
- `.planning/phases/17-foundation-isolation/17-CONTEXT.md` — isolation rule (D-03–D-06), test infrastructure (D-12–D-13), no `@testing-library/react`

### Phase 18 Constraints (blocking anti-patterns)
- `.planning/phases/18-content-pane/.continue-here.md` — BLOCKING: no DOM mutation inside `dangerouslySetInnerHTML` children; no React state updates mid-drag

### Existing Code to Extend
- `ui/src/reviewer-v2/ReviewerV2Shell.tsx` — add `sections` state + `mainRef`; pass to OutlinePane and ContentPane
- `ui/src/reviewer-v2/ContentPane.tsx` — add `onSectionsFound` prop; extract headings after planHtml loads
- `ui/src/reviewer-v2/utils/markdownRenderer.ts` — add custom heading renderer that emits `id` attributes
- `ui/src/reviewer-v2/utils/markdownRenderer.test.ts` — extend tests to assert headings have id attributes
- `ui/src/reviewer-v2/types.ts` — add `Section` type: `{ id: string, text: string, depth: number }`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ui/src/reviewer-v2/ReviewerV2Shell.tsx` — the left `<aside>` has a placeholder "Outline" span; Phase 19 replaces it with `<OutlinePane sections={sections} activeId={activeId} />`
- `ui/src/reviewer-v2/ContentPane.tsx` — already has `planRef` pointing to the rendered markdown div; heading walk uses this ref
- `ui/src/reviewer-v2/utils/markdownRenderer.ts` — module-level `configured` flag pattern; heading renderer extension follows the same `marked.use({renderer: {...}})` pattern
- `ui/src/reviewer-v2/useAnnotations.ts` — established `useReducer` + exported pure reducer pattern; any `useOutline` hook should follow the same testability approach

### Established Patterns
- **No `@testing-library/react`**: All tests drive logic through exported pure functions or DI. The heading slug function and IntersectionObserver callback logic must be exported as pure functions for direct unit testing.
- **jsdom mocks required**: `vitest.setup.ts` mocks `IntersectionObserver` and `ResizeObserver` — any new hook using `IntersectionObserver` must work within this mock environment.
- **State machine style**: Shared state (connectivity, annotations) uses `useReducer` with typed actions. Active section state follows the same pattern if it grows complex; a simple `useState<string | null>` is fine if it stays simple.
- **Isolation rule (ARCH-01)**: `OutlinePane.tsx` and any hooks/utils it uses must live inside `reviewer-v2/` with no `../` imports.
- **No DOM mutation inside `dangerouslySetInnerHTML` children**: Visual overlays must be sibling elements. The outline pane is a separate component — it does NOT touch the `planRef` DOM tree for visual purposes.

### Integration Points
- `ReviewerV2Shell.tsx` — add `mainRef` (ref to `<main>` element), `sections` state, `activeId` state; pass `mainRef` + `onSectionsFound` to ContentPane; pass `sections` + `activeId` to OutlinePane
- `ContentPane.tsx` — new `onSectionsFound?: (sections: Section[]) => void` prop; DOM walk in `useEffect` on `planHtml` change
- `markdownRenderer.ts` — heading renderer adds `id`; slug function exported for testing

</code_context>

<specifics>
## Specific Ideas

- User explicitly rejected storing DOM element refs in the `Section` type — concern: re-renders may invalidate refs. Use heading ID strings instead; `getElementById` is the lookup mechanism.
- "ContentPane produces Section[] used by OutlinePane" — confirmed from v0.6.0 research (STATE.md); implemented here as a callback prop rather than lifting the fetch to Shell.

</specifics>

<deferred>
## Deferred Ideas

- **OUTLINE-04 (comment count badges)** — moved to Phase 21. Requires `sectionId?: string` on `Annotation` type (Phase 21 populates at comment creation time) and badge UI on outline items. Fully testable end-to-end in Phase 21 when annotations can actually be created.

</deferred>

---

*Phase: 19-Outline Pane*
*Context gathered: 2026-05-20*
