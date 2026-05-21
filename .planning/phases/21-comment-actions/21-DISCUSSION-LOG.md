# Phase 21: Comment Actions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 21-comment-actions
**Areas discussed:** Annotation form placement, Gutter icon action, Edit form in CommentBubble, Section offset mapping (OUTLINE-04)

---

## Annotation Form Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inline near selection | ContentPane manages formState; fixed-position textarea at the same position as SelectionToolbar | ✓ |
| Pending bubble in right sidebar | Shell manages pendingAnnotation; a pending bubble appears in CommentPane at anchor Y with a textarea | |

**User's choice:** Inline near selection

---

### Submission behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Submit button + Escape to cancel | Button + keyboard shortcut; click outside also cancels | ✓ (with additions) |
| Enter to submit, Shift+Enter for newline, Escape to cancel | Keyboard-only flow | |
| You decide | Leave to Claude | |

**User's choice:** Submit button + Escape to cancel
**Notes:** User specified Cmd+Enter as additional submit shortcut. Any unsubmitted comment is auto-submitted when a new comment creation is triggered. Comment currently under edit should stay in view when scrolling (pinned behavior — overrides normal positioning).

---

### Selection highlight visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — keep the selection highlight | Reuse 'selection-lock' CSS Highlight while form is open | ✓ |
| No — the form title is enough context | Clear highlight once form opens | |

**User's choice:** Yes — keep the selection highlight

---

## Gutter Icon Action

| Option | Description | Selected |
|--------|-------------|----------|
| Show the full 3-pill SelectionToolbar, select paragraph text | Programmatically select all paragraph text to trigger SelectionToolbar flow | ✓ |
| Directly open a 'Comment' form on the paragraph | Skip pill selection; directly open textarea for 'comment' type | |

**User's choice:** Show the full 3-pill SelectionToolbar anchored to the paragraph
**Notes:** User said "select the whole paragraph text, this should solve the complexity issue (at least for v1)". Selecting the paragraph programmatically triggers the existing useTextSelection selectionchange flow naturally.

---

### Gutter icon implementation detail

| Option | Description | Selected |
|--------|-------------|----------|
| ContentPane handles it | GutterIcon calls onAdd(paragraph); ContentPane creates Range | |
| GutterIcon handles it | GutterIcon calls window.getSelection().addRange() directly | |
| You decide | Leave to Claude | ✓ |

**User's choice:** You decide

---

## Edit Form in CommentBubble

| Option | Description | Selected |
|--------|-------------|----------|
| Inline inside the bubble | Bubble's display text replaced by textarea; stays at anchor Y | ✓ |
| Same inline popover as creation form | Fixed-position textarea at creation form position, pre-filled | |

**User's choice:** Inline inside the bubble

---

### Edit form submission

| Option | Description | Selected |
|--------|-------------|----------|
| Same as creation form — submit button + Cmd+Enter + Escape | Consistent with creation form behavior | ✓ |
| Enter to submit, Escape to cancel (no button) | Keyboard-only | |

**User's choice:** Same as creation form — submit button + Cmd+Enter + Escape

---

### Edit bubble pinning

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — pin the editing bubble | Switch from position:absolute to sticky/fixed while editing | ✓ |
| No — let it scroll naturally | Editing bubble scrolls with sidebar | |

**User's choice:** Yes — pin the editing bubble

---

## Section Offset Mapping (OUTLINE-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Compute in Shell, pass down as annotationCounts prop | useSectionAnnotationCounts hook in Shell; Map<sectionId, number> passed to OutlinePane | ✓ |
| Compute inside OutlinePane | OutlinePane receives planRef + annotations and computes internally | |

**User's choice:** Compute in Shell, pass down as annotationCounts prop

---

### Utility placement for getElementCharOffset

| Option | Description | Selected |
|--------|-------------|----------|
| New function in useTextSelection.ts | Inverse of rangeFromOffsets; same file, unit-testable | |
| Standalone utility file | Separate from useTextSelection; cleaner separation | |
| You decide | Leave to Claude | ✓ |

**User's choice:** You decide

---

## Claude's Discretion

- Programmatic selection approach for gutter icon (GutterIcon vs. PlanContent vs. ContentPane)
- Placement of the `getElementCharOffset` utility (alongside `rangeFromOffsets` vs. separate file)
- Exact styling of pencil/× icons in CommentBubble
- Exact sticky/fixed pinning mechanism for the editing bubble in CommentPane

## Deferred Ideas

None.
