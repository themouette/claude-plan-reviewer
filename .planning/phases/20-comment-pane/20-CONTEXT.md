# Phase 20: Comment Pane - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the comment sidebar: anchored comment bubbles that float at the vertical level of their anchor text, reposition as the content pane scrolls, support bidirectional hover highlighting between bubbles and anchor text, and collapse overlapping bubbles to compact 2-line previews with one focused card expanded.

Requirements in scope: COMMENT-01, COMMENT-02, COMMENT-03.
Not in scope: annotation creation UX (textarea form) — Phase 21; edit/delete per bubble — Phase 21; section comment-count badges — Phase 21.

Phase 20 does wire minimal annotation creation (pill click → immediate annotation with anchorText as comment content) so the sidebar can be tested with live data. Phase 21 replaces this stub with a textarea form.

</domain>

<decisions>
## Implementation Decisions

### Anchor Positioning

- **D-01:** Add `anchorStart: number` and `anchorEnd: number` character offsets to the `Annotation` type. These offsets are captured at creation time from `getOffsets()` in `useTextSelection`. CommentPane re-resolves the DOM Range via `rangeFromOffsets()` and calls `getBoundingClientRect()` to get the current Y position. This approach survives React reconciliation and layout shifts.
- **D-02:** ContentPane captures offsets synchronously in `handleAction` (at the moment of pill click, before selection clears) and passes them to Shell via a callback prop: `onAddAnnotation(type, anchorText, anchorStart, anchorEnd)`. Shell generates the annotation id and dispatches to `useAnnotations.addAnnotation`.
- **D-03:** CommentPane subscribes to the `mainRef` scroll container's scroll event and a `ResizeObserver` on the content area. On each event, it walks all annotations, calls `rangeFromOffsets()` + `getBoundingClientRect()`, and updates a `Map<id, y>` of anchor Y positions. This keeps comment positions accurate after layout shifts.
- **D-04:** The right comment column uses `overflow: 'auto'` with a tall relatively-positioned wrapper. Comment bubbles are positioned with `position: 'absolute'` and `top: anchorY`. The sidebar's own scrollbar lets the user reach comments that are off-screen vertically.

### Overlap / Collapse (sidenotes evaluation)

- **D-05:** The research agent (gsd-phase-researcher) MUST evaluate `sidenotes@2.0.1` against COMMENT-03's requirements (compact 2-line preview, focused card snaps to anchor Y, all comments reachable by scroll) before any planning begins. If `sidenotes` fits, adopt it. If it doesn't fit, the fallback approach is deferred to implementation time — the decision depends on the specific failure mode discovered.
- **D-06:** If a custom layout hook becomes necessary: implement `useCommentLayout(annotations: Array<{ id, anchorY }>, focusedId: string | null) → Array<{ id, top, isCompact }>` as an exported pure function. A greedy algorithm pushes overlapping comments down from their anchor Y. Must be unit-testable without a browser.

### Annotation Creation Wiring

- **D-07:** Phase 20 wires annotation creation minimally: `handleAction` in ContentPane dispatches to `useAnnotations.addAnnotation` using `anchorText` as the comment content (no textarea). Phase 21 replaces this stub with a textarea form UX. The callback signature `onAddAnnotation(type, anchorText, anchorStart, anchorEnd)` is established in Phase 20 and preserved by Phase 21.
- **D-08:** `useAnnotations` is lifted from ContentPane to `ReviewerV2Shell`. Shell passes `addAnnotation` down to ContentPane (via `onAddAnnotation` prop) and passes `annotations` down to CommentPane. Consistent with how `sections` and `activeId` are lifted for the outline.

### Hover / Focus State

- **D-09:** `hoveredCommentId: string | null` and `setHoveredCommentId` live in `ReviewerV2Shell` as `useState`. Passed down to both ContentPane (for anchor text highlight) and CommentPane (for comment bubble highlight). Consistent with `activeId` for the outline.
- **D-10:** `focusedCommentId: string | null` and `setFocusedCommentId` also live in `ReviewerV2Shell`. Clicking a comment bubble calls `setFocusedCommentId(id)`. Passed to CommentPane for the expand/collapse layout decision.
- **D-11:** When `hoveredCommentId` changes, ContentPane highlights the corresponding anchor text using the **CSS Highlights API** (`CSS.highlights.set('comment-hover', new Highlight(range))`). The range is reconstructed via `rangeFromOffsets(planRef.current, anchorStart, anchorEnd)`. This satisfies the Phase 18 blocking constraint (no DOM mutation on `dangerouslySetInnerHTML` children) and is consistent with the `selection-lock` highlight in `useTextSelection`.

### Claude's Discretion

- Exact scroll listener approach (passive event listener vs. `onScroll` prop on the `<main>` element).
- Whether the `Map<id, y>` position state lives in CommentPane local state or in a dedicated `useCommentPositions` hook.
- CSS details for the compact (2-line) vs expanded comment card states.
- Whether `sidenotes` is installed as a `devDependency` during research evaluation only, or as a runtime dependency if adopted.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Phase 20 covers: COMMENT-01, COMMENT-02, COMMENT-03
- `.planning/ROADMAP.md` Phase 20 — Success criteria (4 items)

### Architecture Constraints
- `.planning/PROJECT.md` — Key Decisions table; React 19 decision; isolation rule
- `.planning/STATE.md` — v0.6.0 accumulated decisions

### Phase 17 Decisions (still in force)
- `.planning/phases/17-foundation-isolation/17-CONTEXT.md` — isolation rule (D-03–D-06), no `@testing-library/react`, useReducer pattern

### Phase 18 Constraints (BLOCKING anti-patterns)
- `.planning/phases/18-content-pane/.continue-here.md` — BLOCKING: no DOM mutation inside `dangerouslySetInnerHTML` children; no React state updates mid-drag

### Phase 19 Decisions (still in force)
- `.planning/phases/19-outline-pane/19-CONTEXT.md` — `rangeFromOffsets()` / `getRangeOffsets()` API (reused for anchor Y resolution), Section type, scroll container is `mainRef`

### Existing Code to Extend
- `ui/src/reviewer-v2/ReviewerV2Shell.tsx` — lift `useAnnotations` here; add `hoveredCommentId`, `focusedCommentId` state; pass down to ContentPane and CommentPane
- `ui/src/reviewer-v2/ContentPane.tsx` — wire `handleAction` to `onAddAnnotation` prop; add `hoveredCommentId` prop for anchor text highlight via CSS Highlights API
- `ui/src/reviewer-v2/useAnnotations.ts` — extend `Annotation` type with `anchorStart: number`, `anchorEnd: number`; annotationReducer is already exported (no change needed)
- `ui/src/reviewer-v2/types.ts` — add `anchorStart` and `anchorEnd` to `Annotation`
- `ui/src/reviewer-v2/hooks/useTextSelection.ts` — `rangeFromOffsets()` is exported; reuse for anchor highlight reconstruction

### Library to Evaluate
- `sidenotes@2.0.1` — research agent must check npm/GitHub for API compatibility with COMMENT-03 (compact preview, focused card snaps to anchor Y, all comments reachable by scroll)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ui/src/reviewer-v2/hooks/useTextSelection.ts` — `rangeFromOffsets(container, start, end): Range | null` is exported; reuse in CommentPane to reconstruct anchor ranges for Y position and CSS highlight
- `ui/src/reviewer-v2/useAnnotations.ts` — `annotationReducer` is exported as a pure function; unit-testable without React renderer; extend `Annotation` type here
- `ui/src/reviewer-v2/ReviewerV2Shell.tsx` — `mainRef` already points to the center `<main>` scroll container; CommentPane should subscribe to `mainRef.current`'s scroll event for anchor Y recomputation
- `ui/src/reviewer-v2/SelectionToolbar.tsx` — already has the 3 pill buttons (Comment/Delete/Replace) calling `onAction`; their `onClick` handlers are wired and just need `handleAction` in ContentPane to dispatch instead of no-op

### Established Patterns
- **CSS Highlights API**: `useTextSelection.ts` already sets `CSS.highlights.set('selection-lock', new Highlight(range))`. The `vitest.setup.ts` mocks `CSS.highlights`. Follow the same pattern for `'comment-hover'`.
- **No `@testing-library/react`**: All tests drive logic through exported pure functions or DI. `useCommentLayout` (if custom) must be exported as a pure function for direct unit testing. Anchor Y resolution logic should be exported too.
- **useReducer + exported reducer**: `annotationReducer` is already exported. Extend the `Annotation` type and reducer actions in `useAnnotations.ts` following the same pattern.
- **Absolutely-positioned siblings for overlays**: Phase 18's `PlanContent.tsx` uses a sibling `<div>` overlay. The CSS Highlights approach for anchor hover is preferred over another sibling div, but both respect the Phase 18 blocking constraint.

### Integration Points
- `ReviewerV2Shell.tsx` — new state: `annotations`, `hoveredCommentId`, `focusedCommentId`; new prop callbacks passing down to ContentPane and CommentPane
- `ContentPane.tsx` — new props: `onAddAnnotation`, `hoveredCommentId`; `handleAction` stub replaced with real dispatch
- New component: `ui/src/reviewer-v2/CommentPane.tsx` — receives `annotations`, `hoveredCommentId`, `focusedCommentId`, `mainRef`, `planRef`; renders comment bubbles with anchor-Y positioning

</code_context>

<specifics>
## Specific Ideas

- The `sidenotes@2.0.1` evaluation is a REQUIREMENTS.md-level directive, not a suggestion. Research agent should check the library's API for: does it accept external Y positions? Does it expose compact/expanded state? Does it require a specific DOM structure incompatible with the existing 3-column layout?
- Phase 20's minimal annotation creation (anchorText as comment content, no textarea) is explicitly a stub. Phase 21 replaces the UX layer — the callback signature `onAddAnnotation(type, anchorText, anchorStart, anchorEnd)` is the stable contract.
- `focusedCommentId` is the last-clicked comment. It determines which card expands in the overlap/collapse layout. `hoveredCommentId` is transient (mouse position) — two separate state values.

</specifics>

<deferred>
## Deferred Ideas

- **sidenotes fallback approach** — if sidenotes@2.0.1 doesn't fit, the custom `useCommentLayout` approach is the fallback, but the specific algorithm is deferred until the research phase identifies the failure mode.
- **Paragraph-hover → CommentPane interaction** — CONTENT-02 says hovering a paragraph shows a gutter icon. Whether hovering a paragraph also highlights its corresponding comments (if any) is not in COMMENT-02's scope. Deferred to Phase 21 or later.

</deferred>

---

*Phase: 20-Comment Pane*
*Context gathered: 2026-05-20*
