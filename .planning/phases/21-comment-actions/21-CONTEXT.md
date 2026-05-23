# Phase 21: Comment Actions - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the Phase 20 annotation creation stub with a real textarea-based comment creation form; add edit and delete controls to existing comment bubbles; add per-section comment count badges to the outline tree.

Requirements in scope: COMMENT-04, COMMENT-05, OUTLINE-04.
Not in scope: review submission (Phase 22), regression tests (Phase 23).

Phase 20 established the stable callback signature `onAddAnnotation(annotation: Annotation)` and wired the `SelectionToolbar` pills with `prefillComment` support. Phase 21 replaces the stub in `handleAction` with a real form.

</domain>

<decisions>
## Implementation Decisions

### Annotation Form Placement (COMMENT-04)

- **D-01:** The annotation creation form appears **inline near the selection**, as a fixed-position popover — same visual location where `SelectionToolbar` was. `ContentPane` manages `formState: { type, anchorText, anchorStart, anchorEnd, prefill } | null`. When a quick action fires, the toolbar disappears and the form appears in its place. When submitted, `onAddAnnotation` is called with the complete `Annotation` object.
- **D-02:** Form submission: **Submit button** (primary), **Cmd+Enter** keyboard shortcut, and **Escape** or **click outside** to cancel. Cancelled forms do not save.
- **D-03:** If a form is already open (pending) when the user triggers a new annotation creation (new pill click or gutter icon click), **auto-submit the pending form first** before opening the new form.
- **D-04:** While the form is open, keep the **selection highlight visible**. Reuse the `'selection-lock'` CSS Highlight (already set by `useTextSelection.ts`) — do not clear it while the form is active. The native selection may be cleared for textarea cursor, but the visual highlight stays via the Highlights API.
- **D-05:** The creation form is **pinned** — it stays visible at its fixed-position coordinates while the user scrolls the content pane (position:fixed achieves this automatically).

### Gutter Icon Action (COMMENT-04)

- **D-06:** Clicking the `+` gutter icon **programmatically selects the entire paragraph text** (via `window.getSelection()` + Range API), which triggers `useTextSelection`'s `selectionchange` listener. This causes `selectedText` to be set and the `SelectionToolbar` to appear anchored to the paragraph's bounding rect, exposing all 3 pills + predefined actions. Same flow as manual text selection.
- **D-07:** Implementation of the programmatic selection (whether in `GutterIcon`, `PlanContent`, or `ContentPane`) is **Claude's discretion** — pick the approach that best fits the existing component boundaries.

### Edit/Delete on CommentBubble (COMMENT-05)

- **D-08:** Each `CommentBubble` shows a **pencil icon** (edit) and **× icon** (delete) when in focused state (`isFocused === true`). These are rendered inside the bubble card.
- **D-09:** Clicking **×** removes the annotation immediately with no confirmation dialog. Calls `onRemove(annotation.id)` — this is a new prop on `CommentBubble`.
- **D-10:** Clicking the **pencil** switches the bubble to **inline edit mode**: the display text is replaced by a textarea pre-filled with the current `annotation.comment`. Same submission rules as the creation form: Submit button, Cmd+Enter, Escape/outside to cancel. Cancelling reverts to the original comment text.
- **D-11:** An `editingId: string | null` state lives in `ReviewerV2Shell` (parallel to `focusedCommentId`), passed to `CommentPane` (and down to `CommentBubble`). This keeps edit state consistent with how `hoveredCommentId` and `focusedCommentId` are managed.
- **D-12:** While a bubble is in edit mode, it is **pinned**: `CommentPane` switches the editing bubble from `position:absolute` to `position:sticky` (or equivalent pinning mechanism) so it remains visible as the user scrolls. When editing ends, it reverts to `position:absolute` at its anchor Y.

### Section Offset Mapping (OUTLINE-04)

- **D-13:** Section-to-annotation mapping is computed in `ReviewerV2Shell` via a new hook: `useSectionAnnotationCounts(sections, annotations, planRef) → Map<sectionId, number>`. The result is passed to `OutlinePane` as a new `annotationCounts` prop.
- **D-14:** The hook computes **section character-offset boundaries** by finding each heading element in `planRef.current` and determining its character offset range. A comment at `anchorStart` offset X belongs to the section whose `[headingStart, nextHeadingStart)` range contains X; a comment before the first heading belongs to no section (no badge). A comment spanning multiple sections counts only under the first section (matches REQUIREMENTS.md OUTLINE-04).
- **D-15:** The utility function for computing a heading element's character offset within a container (`getElementCharOffset` or equivalent) is **Claude's discretion** for file placement — could be added to `useTextSelection.ts` as the inverse of `rangeFromOffsets`, or as a standalone utility. Must be exported and unit-testable without a browser.

### Claude's Discretion

- Programmatic selection approach for gutter icon (GutterIcon vs. PlanContent vs. ContentPane)
- Placement of the `getElementCharOffset` utility (alongside `rangeFromOffsets` vs. separate file)
- Exact styling of pencil/× icons in CommentBubble (icon size, spacing, show-on-focus vs. show-on-hover)
- Exact sticky/fixed pinning mechanism for the editing bubble in CommentPane

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Phase 21 covers: COMMENT-04, COMMENT-05, OUTLINE-04
- `.planning/ROADMAP.md` Phase 21 — Success criteria (4 items)

### Architecture Constraints
- `.planning/PROJECT.md` — Key Decisions table; React 19 decision; ARCH-01 isolation rule
- `.planning/STATE.md` — v0.6.0 accumulated decisions

### Phase 17 Decisions (still in force)
- `.planning/phases/17-foundation-isolation/17-CONTEXT.md` — isolation rule (D-03–D-06), no `@testing-library/react`, useReducer pattern

### Phase 18 Constraints (BLOCKING anti-patterns)
- `.planning/phases/18-content-pane/.continue-here.md` — BLOCKING: no DOM mutation inside `dangerouslySetInnerHTML` children; no React state updates mid-drag

### Phase 20 Decisions (still in force)
- `.planning/phases/20-comment-pane/20-CONTEXT.md` — `onAddAnnotation(annotation: Annotation)` callback signature (stable); `hoveredCommentId`/`focusedCommentId` live in Shell; CSS Highlights API pattern for anchor hover

### Existing Code to Extend
- `ui/src/reviewer-v2/ContentPane.tsx` — replace `handleAction` stub (line ~88: `comment: anchorText`) with form state logic; replace `handleAdd` stub with programmatic paragraph selection
- `ui/src/reviewer-v2/SelectionToolbar.tsx` — already passes `prefillComment` as 3rd arg to `onAction`; `QUICK_ACTIONS` constant already defined; no changes needed
- `ui/src/reviewer-v2/CommentBubble.tsx` — add pencil + × icons in focused state; add `onEdit` and `onRemove` props; add `isEditing` prop for inline edit mode
- `ui/src/reviewer-v2/CommentPane.tsx` — add `editingId` prop; pin editing bubble; wire `onEdit`/`onRemove` callbacks
- `ui/src/reviewer-v2/ReviewerV2Shell.tsx` — add `editingId` state; wire `editAnnotation`/`removeAnnotation` from `useAnnotations`; add `useSectionAnnotationCounts` hook call; pass `annotationCounts` to `OutlinePane`
- `ui/src/reviewer-v2/OutlinePane.tsx` — add `annotationCounts?: Map<string, number>` prop; render count badge per section item
- `ui/src/reviewer-v2/hooks/useTextSelection.ts` — consider adding `getElementCharOffset` utility as inverse of `rangeFromOffsets`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ui/src/reviewer-v2/hooks/useTextSelection.ts` — `rangeFromOffsets(container, start, end): Range | null` exported; `CSS.highlights` pattern established; reuse for pinning selection highlight during form open
- `ui/src/reviewer-v2/SelectionToolbar.tsx` — already fully built with 3 pills + more dropdown; `QUICK_ACTIONS` constant exported; `prefillComment` optional 3rd arg already passed; no changes needed for the toolbar itself
- `ui/src/reviewer-v2/useAnnotations.ts` — `editAnnotation(id, comment)` and `removeAnnotation(id)` already exist; `annotationReducer` is exported and unit-testable
- `ui/src/reviewer-v2/GutterIcon.tsx` — has `containerRef={planRef}` already (unused); `onMouseDown: e.preventDefault()` already prevents selection-clear

### Established Patterns
- **CSS Highlights API**: `useTextSelection.ts` uses `CSS.highlights.set('selection-lock', ...)`. The `vitest.setup.ts` mocks `CSS.highlights`. Follow for pinning selection highlight during form open.
- **No `@testing-library/react`**: All tests drive logic through exported pure functions or DI. `useSectionAnnotationCounts` and `getElementCharOffset` must be exported pure functions for direct unit testing.
- **useReducer + exported reducer**: `annotationReducer` is already exported. Phase 21 adds no new action types (add/edit/remove already exist).
- **Shell-level shared state**: `hoveredCommentId`, `focusedCommentId` live in Shell. `editingId` follows the same pattern.
- **Fixed-position overlays**: `SelectionToolbar` uses `position: fixed` with viewport coordinates. The creation form should use the same approach.

### Integration Points
- `ReviewerV2Shell.tsx` — new state: `editingId`; new hook: `useSectionAnnotationCounts`; new prop to OutlinePane: `annotationCounts`; new callbacks to CommentPane: `onEdit`, `onRemove`
- `ContentPane.tsx` — new state: `formState` (pending annotation creation); replaces `handleAction` stub; replaces `handleAdd` stub
- `CommentBubble.tsx` — new props: `isEditing`, `onEdit`, `onRemove`; new inline edit UI
- `OutlinePane.tsx` — new prop: `annotationCounts?: Map<string, number>`

</code_context>

<specifics>
## Specific Ideas

- The `SelectionToolbar`'s `onAction` signature already accepts `prefillComment?: string` as 3rd arg. `handleAction` in `ContentPane` does NOT yet accept or use it — Phase 21 must update `handleAction(type, anchorText, prefillComment?)` to pass the prefill into the form's initial textarea value.
- "Delete" pill opens textarea pre-filled with `"Delete"`. "Replace" pill opens textarea pre-filled with `"Replace"`. Each predefined action (from `QUICK_ACTIONS`) opens textarea pre-filled with the action label. "Comment" pill opens empty textarea.
- Auto-submit behavior: if `formState !== null` when a new pill click fires, submit the current form's content first (call `onAddAnnotation` with whatever is in the textarea), then immediately open the new form. This ensures no annotation is silently discarded.
- The gutter icon programmatic selection approach (D-06) means `GutterIcon.onAdd` may need a signature change to pass the paragraph element back to the caller, or `PlanContent` can intercept at the GutterIcon's onClick level. This is implementation discretion (D-07).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 21-Comment Actions*
*Context gathered: 2026-05-21*
