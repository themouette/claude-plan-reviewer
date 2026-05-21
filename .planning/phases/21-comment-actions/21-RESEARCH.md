# Phase 21: Comment Actions - Research

**Researched:** 2026-05-21
**Domain:** React 19 / TypeScript — annotation creation form, inline edit/delete, section-count badge
**Confidence:** HIGH (all findings verified directly from codebase; no external library changes required)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Annotation creation form is `position: fixed` popover at same coordinates as SelectionToolbar. `ContentPane` manages `formState: { type, anchorText, anchorStart, anchorEnd, prefill } | null`.

**D-02:** Form submission: Submit button (primary), Cmd+Enter keyboard shortcut, Escape or click outside to cancel. Cancelled forms do not save.

**D-03:** If a form is already open when a new annotation creation is triggered, auto-submit the pending form first, then open the new form.

**D-04:** While the form is open, keep the `selection-lock` CSS Highlight visible. Reuse the existing `'selection-lock'` CSS Highlight — do not clear it while the form is active. Call `resetTextSelection()` only on form submit or cancel.

**D-05:** The creation form is pinned via `position: fixed` — stays visible as user scrolls.

**D-06:** Clicking the `+` gutter icon programmatically selects the entire paragraph text via `window.getSelection()` + Range API, which triggers `useTextSelection`'s `selectionchange` listener. Causes `selectedText` to be set and `SelectionToolbar` to appear with all pills.

**D-07:** Programmatic selection approach (whether in `GutterIcon`, `PlanContent`, or `ContentPane`) is Claude's discretion.

**D-08:** Each `CommentBubble` shows pencil icon (edit) and × icon (delete) when `isFocused === true`.

**D-09:** Clicking × removes annotation immediately with no confirmation. Calls `onRemove(annotation.id)`.

**D-10:** Clicking pencil switches bubble to inline edit mode: display text replaced by textarea pre-filled with `annotation.comment`. Same submission rules as creation form.

**D-11:** `editingId: string | null` lives in `ReviewerV2Shell` (parallel to `focusedCommentId`), passed to `CommentPane`.

**D-12:** While a bubble is in edit mode, `CommentPane` switches it from `position: absolute` to `position: sticky` (top: 16px) so it remains visible as user scrolls.

**D-13:** Section-to-annotation mapping computed in `ReviewerV2Shell` via new hook `useSectionAnnotationCounts(sections, annotations, planRef) → Map<sectionId, number>`. Result passed to `OutlinePane` as new `annotationCounts` prop.

**D-14:** Hook computes section character-offset boundaries by finding each heading element in `planRef.current` and determining its character offset range. Comment at `anchorStart` X belongs to section whose `[headingStart, nextHeadingStart)` contains X; comment before first heading belongs to no section. Comment spanning multiple sections counts under the first section only.

**D-15:** Utility function `getElementCharOffset` (or equivalent) for heading-element-to-character-offset is Claude's discretion for file placement — could live alongside `rangeFromOffsets` in `useTextSelection.ts` or as a standalone utility. Must be exported and unit-testable without a browser.

### Claude's Discretion

- Programmatic selection approach for gutter icon (GutterIcon vs. PlanContent vs. ContentPane)
- Placement of the `getElementCharOffset` utility (alongside `rangeFromOffsets` vs. separate file)
- Exact styling of pencil/× icons in CommentBubble (icon size, spacing, show-on-focus vs. show-on-hover)
- Exact sticky/fixed pinning mechanism for the editing bubble in CommentPane

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMMENT-04 | Three quick actions on text selection or paragraph hover (Comment, Delete, Replace); expandable menu with 6 predefined actions; each opens textarea with appropriate prefill | Annotation creation form in ContentPane; formState pattern; SelectionToolbar already wired; handleAction stub ready to replace |
| COMMENT-05 | Each submitted comment bubble has edit (pencil) and delete (×) buttons; edit reopens textarea; delete removes with no confirmation | CommentBubble new props isEditing/onEdit/onRemove; editingId in Shell; useAnnotations already has editAnnotation/removeAnnotation |
| OUTLINE-04 | Each outline item displays count of comments whose anchor falls within that section; spanning comments count under first section | useSectionAnnotationCounts hook; getElementCharOffset utility; annotationCounts prop on OutlinePane |
</phase_requirements>

---

## Summary

Phase 21 is an extension phase, not a greenfield phase. Every external dependency is already installed. The three requirements (COMMENT-04, COMMENT-05, OUTLINE-04) map to five distinct code changes: (1) replace the `handleAction` stub in `ContentPane` with a new `AnnotationForm` component rendered as a fixed popover, (2) extend `GutterIcon`/`PlanContent` to programmatically select paragraph text on `+` click, (3) add edit/delete controls plus inline edit mode to `CommentBubble`, (4) add `editingId` state and edit/remove wiring to `ReviewerV2Shell` and `CommentPane`, and (5) implement `useSectionAnnotationCounts` and render count badges in `OutlinePane`.

The codebase patterns are uniform and well-established. Tests use the source-as-text pattern (read source with `readFileSync`, assert structural patterns with `toContain`/`toMatch`) exclusively — no `@testing-library/react`. All new exported pure functions (`useSectionAnnotationCounts`, `getElementCharOffset`) must follow this pattern.

No new npm packages are needed in this phase. The UI-SPEC is approved and fully specifies visual details. The primary planning risk is sequencing: `AnnotationForm` in `ContentPane` is the most complex new component and should be planned before `CommentBubble` edit mode (which shares the textarea/keyboard patterns but is simpler because it is inline in an existing component).

**Primary recommendation:** Plan the phase as three waves: (1) `AnnotationForm` component + `ContentPane` formState wiring + gutter icon programmatic selection, (2) `CommentBubble` + `CommentPane` + `ReviewerV2Shell` edit/delete wiring, (3) `useSectionAnnotationCounts` + `getElementCharOffset` + `OutlinePane` badge rendering. Each wave has clear inputs from the previous.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Annotation creation form | Frontend/ContentPane | ReviewerV2Shell (receives callback) | ContentPane owns `formState`; form appears where SelectionToolbar was; Shell is notified via `onAddAnnotation` |
| Gutter icon → paragraph selection | Frontend/ContentPane or PlanContent | GutterIcon (triggers it) | Programmatic `window.getSelection()` + Range API is a ContentPane/PlanContent concern; GutterIcon just fires the event |
| Edit/delete per bubble | Frontend/CommentBubble | CommentPane (pins editing bubble) + Shell (holds editingId) | CommentBubble renders the UI; Shell holds state at the right level for cross-component consistency |
| Section-to-annotation count | Frontend/ReviewerV2Shell | useSectionAnnotationCounts hook | Shell has access to both `sections` and `annotations`; pure hook keeps logic testable |
| Count badge rendering | Frontend/OutlinePane | — | OutlinePane already owns section rendering; badge is a prop-driven extension |

---

## Standard Stack

### Core (no new packages — all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.x (installed) | Component model, useState/useReducer/useRef | [VERIFIED: ui/package.json] Existing runtime — all hooks used in this phase are already in use |
| TypeScript | Installed | Type safety | [VERIFIED: ui/tsconfig.json exists] All source files are .tsx/.ts |
| Vitest | Installed | Test runner | [VERIFIED: ui/vitest.config.ts] Already configured; `setupFiles: ['./vitest.setup.ts']` |

### APIs (browser-native — no install)

| API | Purpose | Already Used In |
|-----|---------|-----------------|
| CSS Highlights API (`CSS.highlights`) | Pin `selection-lock` highlight while form is open | `useTextSelection.ts` + `ContentPane.tsx` |
| `window.getSelection()` / Range API | Programmatic paragraph selection for gutter icon | `useTextSelection.ts` |
| `crypto.randomUUID()` | Annotation ID generation | `ContentPane.tsx` handleAction |
| `ResizeObserver` | Anchor Y recomputation | `CommentPane.tsx` |

**Installation:** No new packages required. [VERIFIED: 21-UI-SPEC.md "No new npm packages in this phase"]

---

## Package Legitimacy Audit

No new npm packages in this phase. Section not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
User Action (pill click / quick-action / gutter + icon)
         |
         v
ContentPane.handleAction(type, anchorText, prefillComment?)
         |
   [formState !== null?]──YES──> auto-submit current form ──> onAddAnnotation()
         |
         NO
         v
   setFormState({ type, anchorText, anchorStart, anchorEnd, prefill })
         |
   SelectionToolbar unmounts; AnnotationForm mounts (position: fixed, same coords)
         |
   CSS.highlights['selection-lock'] stays active (D-04)
         |
   User types + submits (button / Cmd+Enter) or cancels (Escape / click-outside)
         |
   [submit]──────────────────────────────[cancel]
         |                                    |
   onAddAnnotation(Annotation)         setFormState(null)
   setFormState(null)                  resetTextSelection()
   resetTextSelection()

ReviewerV2Shell holds:
  annotations         ──► ContentPane (read: highlight anchors)
                      ──► CommentPane (render bubbles)
  focusedCommentId    ──► CommentPane
  editingId           ──► CommentPane (pin editing bubble to sticky)
  annotationCounts    ──► OutlinePane (render badges)

useSectionAnnotationCounts(sections, annotations, planRef)
         |
   Walk headings in planRef.current
   getElementCharOffset(container, headingElement) → charOffset
   For each annotation: find section whose [headingStart, nextHeadingStart) contains anchorStart
         |
         v
   Map<sectionId, number>  ──► OutlinePane.annotationCounts
```

### Recommended Project Structure

No new directories. Files modified/added:

```
ui/src/reviewer-v2/
├── AnnotationForm.tsx              (new — annotation creation popover)
├── ContentPane.tsx                 (modify — replace handleAction stub + handleAdd stub)
├── PlanContent.tsx                 (modify — extend GutterIcon.onAdd to pass paragraph el)
├── CommentBubble.tsx               (modify — add isEditing/onEdit/onRemove props + edit UI)
├── CommentPane.tsx                 (modify — add editingId prop + sticky pinning)
├── ReviewerV2Shell.tsx             (modify — add editingId state + hook call + OutlinePane prop)
├── OutlinePane.tsx                 (modify — add annotationCounts prop + badge render)
├── hooks/
│   ├── useTextSelection.ts         (possibly extend — add getElementCharOffset export)
│   └── useSectionAnnotationCounts.ts (new — or inline in ReviewerV2Shell.tsx)
├── AnnotationForm.test.ts          (new — source-as-text tests)
├── ContentPane.test.ts             (extend — new form-state assertions)
├── CommentBubble.test.ts           (extend — edit/delete prop assertions)
├── CommentPane.test.ts             (extend — editingId + sticky assertions)
├── ReviewerV2Shell.test.ts         (extend — editingId + annotationCounts assertions)
├── OutlinePane.test.ts             (extend — annotationCounts badge assertions)
└── hooks/
    └── useSectionAnnotationCounts.test.ts (new — pure function unit tests)
```

### Pattern 1: Source-as-Text Testing (established, mandatory)

**What:** Tests import the module for its type but read the `.tsx`/`.ts` source as a string to assert structural patterns.
**When to use:** All tests in this phase. No `@testing-library/react` is used anywhere in the project.
**Example (from CommentBubble.test.ts):**
```typescript
// Source: /ui/src/reviewer-v2/CommentBubble.test.ts [VERIFIED: codebase]
const source = readFileSync(resolve(__dirname, './CommentBubble.tsx'), 'utf-8')

it('wires onMouseEnter callback to root article', () => {
  expect(source).toContain('onMouseEnter')
})
```
**For new pure functions** (e.g. `getElementCharOffset`, `useSectionAnnotationCounts`), test the exported function directly by calling it — they must be unit-testable without a browser DOM.

### Pattern 2: formState as Discriminated Union in ContentPane

**What:** `formState` is `{ type, anchorText, anchorStart, anchorEnd, prefill } | null`. When non-null, `SelectionToolbar` is NOT rendered; `AnnotationForm` is rendered instead at the same `position: fixed` coordinates derived from `lastRect` (stored from the selection at trigger time).
**When to use:** The entire annotation creation flow.
**Key implication:** `lastRect` must be stored in `ContentPane` state alongside `formState` so `AnnotationForm` can position itself after the selection has been cleared.

```typescript
// Source: 21-CONTEXT.md D-01 + 21-UI-SPEC.md [VERIFIED: CONTEXT.md]
type FormState = {
  type: AnnotationType
  anchorText: string
  anchorStart: number
  anchorEnd: number
  prefill: string
  rect: { top: number; left: number }  // captured from lastRect at trigger time
} | null

// ContentPane render:
{selectedText && offsets && !formState && (
  <SelectionToolbar ... onAction={handleAction} />
)}
{formState && (
  <AnnotationForm
    formState={formState}
    onSubmit={handleFormSubmit}
    onCancel={handleFormCancel}
  />
)}
```

### Pattern 3: Shell-Level Shared State (established)

**What:** State shared between multiple components (ContentPane, CommentPane, OutlinePane) lives in `ReviewerV2Shell`. Pattern already used for `hoveredCommentId`, `focusedCommentId`, `annotations`, `sections`, `activeId`.
**When to use:** `editingId` and `annotationCounts` follow this exact pattern.
**Example (from ReviewerV2Shell.tsx):**
```typescript
// Source: /ui/src/reviewer-v2/ReviewerV2Shell.tsx [VERIFIED: codebase]
const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null)
// Phase 21 adds:
const [editingId, setEditingId] = useState<string | null>(null)
const annotationCounts = useSectionAnnotationCounts(sections, annotations, planRef)
```

### Pattern 4: CSS Highlights API for Visual Anchoring (established)

**What:** `CSS.highlights.set(name, new Highlight(range))` pins a visual highlight without touching the DOM. Mocked in `vitest.setup.ts`.
**When to use:** Keep `selection-lock` active while `AnnotationForm` is open (D-04). Do NOT call `resetTextSelection()` until submit or cancel.
**Key implication for ContentPane:** The `capture` function in `useTextSelection`'s mouseup handler currently clears the selection state when no valid selection is found after mouseup. When `AnnotationForm` is open, a click outside the form should trigger form cancel — but that same click may also trigger the mouseup handler. The `AnnotationForm`'s `onMouseDown` on its container should call `e.stopPropagation()` to prevent the document-level mouseup handler from clearing `selectedText` / stored offsets before the form's click-outside handler fires.

### Pattern 5: getElementCharOffset (new pure utility)

**What:** Inverse of `rangeFromOffsets` — given a container element and a child element (heading), return the character offset of that element's start within the container's text node walk.
**Algorithm:**
```typescript
// Source: 21-CONTEXT.md D-15 + D-14 [VERIFIED: CONTEXT.md]
function getElementCharOffset(container: HTMLElement, targetElement: HTMLElement): number {
  // Walk text nodes until we reach a node that is inside targetElement
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let charCount = 0
  let node: Node | null
  while ((node = walker.nextNode())) {
    if (targetElement.contains(node)) return charCount
    charCount += (node.textContent ?? '').length
  }
  return charCount // fallback: element is at or past the end
}
```
**Unit-testable without browser:** Takes two `HTMLElement` arguments — tests can create DOM with `document.createElement` in jsdom (same approach as `rangeFromOffsets` tests in `useTextSelection.test.ts`).

### Pattern 6: CommentBubble Edit Mode (inline textarea replacement)

**What:** When `isEditing === true`, the `<p>` comment body is replaced by a `<textarea>` pre-filled with `annotation.comment`. CommentPane applies `position: sticky; top: 16px` to the wrapper instead of `position: absolute; top: anchorY`.
**Key:** `editingId` flows Shell → CommentPane → CommentBubble. CommentPane determines the wrapper style based on `editingId === ann.id`.
```typescript
// Source: 21-CONTEXT.md D-10, D-12 + 21-UI-SPEC.md [VERIFIED: CONTEXT.md + UI-SPEC]
// In CommentPane (edit bubble wrapper style):
const wrapperStyle: React.CSSProperties =
  editingId === ann.id
    ? { position: 'sticky', top: 16 }
    : { position: 'absolute', top: layoutItem.top }
```

### Pattern 7: Programmatic Paragraph Selection (new, gutter icon D-06)

**What:** When user clicks `+` gutter icon, ContentPane programmatically selects the entire paragraph text using Range API, which triggers `useTextSelection`'s existing `selectionchange` listener.
**Implementation note:** `useTextSelection` currently listens to `selectionchange` via keyboard path only when `mouseDown === false`. A programmatic `addRange` call fires `selectionchange` without a mouse event — it will be caught by the keyboard path's `captureKeyboard` listener. This is the correct and intended behavior per D-06.
```typescript
// Source: 21-CONTEXT.md D-06 + useTextSelection.ts analysis [VERIFIED: codebase]
function handleAdd(paragraphElement: HTMLElement) {
  const selection = window.getSelection()
  if (!selection) return
  selection.removeAllRanges()
  const range = document.createRange()
  range.selectNodeContents(paragraphElement)
  selection.addRange(range)
  // selectionchange fires → useTextSelection picks it up → SelectionToolbar appears
}
```
**GutterIcon signature change:** `onAdd: () => void` becomes `onAdd: (paragraphElement: HTMLElement) => void`. `GutterIcon` already receives `paragraph` prop — it can pass it to the callback. Alternatively, `PlanContent` can intercept by wrapping the callback before passing it to `GutterIcon`.

### Anti-Patterns to Avoid

- **Calling `resetTextSelection()` while form is open:** Per D-04, the `selection-lock` Highlight must stay active during form editing. Only call `resetTextSelection()` on submit or cancel.
- **Storing a live Range for lastRect:** Range objects can be collapsed by React reconciliation. Store the `{ top, left }` numbers from `lastRect` at trigger time (when `handleAction` fires), not the Range or DOMRect object.
- **Using `@testing-library/react`:** Explicitly forbidden by Phase 17 decisions. All tests must use source-as-text pattern or direct pure function calls.
- **Calling `window.getSelection()?.removeAllRanges()` from SelectionToolbar pill click:** The existing pill click handler (line 89 of SelectionToolbar.tsx) calls `window.getSelection()?.removeAllRanges()` after `onAction`. Phase 21 replaces the `onAction` handler in `ContentPane` — the new handler must NOT call `removeAllRanges` (Phase 20 already did this via `resetTextSelection()`). However, SelectionToolbar's own pill `onClick` still calls `removeAllRanges()` before `onAction` can store the rect. This means `ContentPane.handleAction` must capture `lastRect` from the stored offsets BEFORE the pill's onClick clears the selection. Check: `rangeFromOffsets` is called inside `handleAction` from the stored `storedOffsets.current` — not from the live DOM selection. So this is safe.
- **DOM mutation on `dangerouslySetInnerHTML` children:** Phase 18 blocking constraint. All highlights use CSS Highlights API; no DOM mutation on `planRef` contents.
- **`useEffect` lazy `.current` capture:** Established pitfall in this codebase. Always capture `ref.current` at effect entry.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Annotation CRUD | Custom state + reducer from scratch | `useAnnotations` — `editAnnotation(id, comment)` and `removeAnnotation(id)` already exist | [VERIFIED: useAnnotations.ts] All three action types already implemented |
| Selection highlight | Custom DOM highlight | CSS Highlights API via existing `'selection-lock'` name in `useTextSelection.ts` | [VERIFIED: codebase] Already mocked in vitest.setup.ts |
| Annotation ID generation | Custom UUID | `crypto.randomUUID()` | [VERIFIED: ContentPane.tsx line 99] Already established pattern |
| Offset-to-range | Custom text walker | `rangeFromOffsets(container, start, end)` | [VERIFIED: useTextSelection.ts] Already exported; already tested |

**Key insight:** The reducer, state shape, CSS Highlights API plumbing, and offset utilities are all already in place. Phase 21 is a UI layer on top of existing infrastructure.

---

## Common Pitfalls

### Pitfall 1: lastRect Capture Timing

**What goes wrong:** `handleAction` is called when the user clicks a pill. SelectionToolbar's pill `onClick` calls `window.getSelection()?.removeAllRanges()` (line 89 of SelectionToolbar.tsx) which clears the browser selection. At the moment `handleAction` fires, the browser selection may already be cleared.
**Why it happens:** The `onClick` handler in SelectionToolbar clears the selection as part of the pill click handler, before `onAction` (which calls `handleAction`) returns.
**How to avoid:** `handleAction` must read `lastRect` from the stored character offsets using `rangeFromOffsets(planRef.current, offsets.start, offsets.end)?.getClientRects()` before the selection is cleared. Since `storedOffsets.current` is set at mouseup time (before the pill click), it survives the `removeAllRanges()` call. Always derive the form position from `rangeFromOffsets` + `getClientRects()`, not from the live browser selection.
**Warning signs:** Form appearing at `top: 0, left: 0` or at wrong position on second click.

### Pitfall 2: Auto-Submit Race on D-03

**What goes wrong:** D-03 requires auto-submitting the pending form before opening a new one. If the auto-submit calls `onAddAnnotation` which triggers a Shell re-render, and then `setFormState(newForm)` is called in the same event handler, React may batch the updates — the new form may open before the re-render from the auto-submit has settled.
**Why it happens:** React 19 batches state updates by default, including across multiple `setState` calls in event handlers.
**How to avoid:** Auto-submit and new-form-open can both be in the same handler safely since they are sequential state updates that React will batch correctly. The annotation will be added; the form state will change. No async gap, no race. The concern is only if `onAddAnnotation` is asynchronous — in this codebase it dispatches synchronously to `useReducer`.
**Warning signs:** Annotations created by auto-submit appearing as duplicates or not appearing at all.

### Pitfall 3: Click-Outside Handler Conflicts Between Form and useTextSelection

**What goes wrong:** The `AnnotationForm` needs to cancel on "click outside." The document-level `mouseup` handler in `useTextSelection` also fires on clicks anywhere, and clears `selectedText`/`storedOffsets` if no valid selection is found. If the user clicks outside the form, the mouseup handler fires before the form's click-outside handler, clearing the stored offsets. If the form then tries to read offsets for cancellation (not strictly needed, but must not corrupt state), it may get null.
**Why it happens:** Event order: mousedown → mouseup (document listener captures, clears stored offsets) → click (form container detects outside click).
**How to avoid:** The form's cancel path (`setFormState(null)` + `resetTextSelection()`) does not need offsets — it just clears state. The `useTextSelection` clearing on click-outside is actually the desired behavior after cancel. Ensure the form wrapper's `onMouseDown` calls `e.stopPropagation()` to prevent the document mousedown handler from clearing `storedOffsets.current` while the form is open and the user is interacting with form controls.
**Warning signs:** `selection-lock` highlight disappearing while form is still open; form submitting with null offsets.

### Pitfall 4: `position: sticky` Editing Bubble Requires Scrollable Parent

**What goes wrong:** D-12 requires the editing bubble to use `position: sticky; top: 16px`. `position: sticky` only works within a scrollable ancestor — if the CommentPane wrapper's `overflow` is hidden or the parent context is wrong, `sticky` behaves like `static`.
**Why it happens:** The comment sidebar uses `overflow: auto` on the shared scroller (`mainRef`), not on the sidebar itself. The CommentPane's direct parent `<aside>` has no independent scroll.
**How to avoid:** Verify that `position: sticky` on the bubble wrapper sticks within the shared scroll container (`mainRef`). If it doesn't (because the containing block is the `<aside>` which doesn't scroll independently), the alternative is to compute a `fixed` position for the editing bubble using the `aside`'s `getBoundingClientRect().top + 16`.
**Warning signs:** Editing bubble disappearing on scroll; editing bubble always at top of page.

### Pitfall 5: `useLayoutEffect` Re-Application of `selection-lock` During Form Open

**What goes wrong:** `useTextSelection` has a `useLayoutEffect` that runs on every render and re-applies the `selection-lock` CSS highlight. If `storedOffsets.current` is non-null (which it will be while the form is open, per D-04), the highlight is re-applied on every render. This is the desired behavior — but if D-03 auto-submit clears and re-sets `storedOffsets` in the same render cycle, the highlight may flicker.
**Why it happens:** `useLayoutEffect` runs after every render. Auto-submit clears and re-sets form state in one event handler = two renders in React 19.
**How to avoid:** This is not actually a problem — `resetTextSelection()` is only called on form cancel or submit, not on auto-submit. On auto-submit (D-03), the old annotation is created, old form state is discarded, and new form state is set without calling `resetTextSelection()`. The `storedOffsets.current` continues to hold the new selection's offsets (captured in the new `handleAction` call after the programmatic selection event, if gutter icon is used, or from the previous stored offsets if a second pill click fires).
**Warning signs:** Double-submit behavior on annotations; highlights flickering.

### Pitfall 6: `getElementCharOffset` vs. `rangeFromOffsets` Walk Direction

**What goes wrong:** `rangeFromOffsets` walks text nodes; `getElementCharOffset` must walk text nodes to find a node contained by the target element. If the walk checks `element.contains(node)` on the first text node of the element, it works. But headings rendered in `dangerouslySetInnerHTML` may have inline elements (e.g., `<code>`, `<strong>` inside headings) that wrap the text node. The function must check if any ancestor of the current text node is the heading, not just immediate containment.
**Why it happens:** `element.contains(node)` correctly handles descendant nodes — `Element.contains()` returns true for any descendant. This is not actually a problem if `contains` is used (not `===`).
**How to avoid:** Use `targetElement.contains(node)` (not `targetElement === node.parentElement`).
**Warning signs:** `getElementCharOffset` returning 0 for all headings; section badges showing 0 despite annotations existing.

---

## Code Examples

Verified patterns from official sources:

### AnnotationForm — Position Calculation (reuses TOOLBAR_WIDTH from SelectionToolbar)

```typescript
// Source: 21-UI-SPEC.md + SelectionToolbar.tsx [VERIFIED: codebase + UI-SPEC]
// In ContentPane.handleAction, capture rect at trigger time:
const offsets = getOffsets()
if (!offsets || !planRef.current) return
const range = rangeFromOffsets(planRef.current, offsets.start, offsets.end)
const rects = range?.getClientRects() ?? []
const lastRect = rects.length > 0 ? rects[rects.length - 1] : range?.getBoundingClientRect()
const formTop = (lastRect?.bottom ?? 0) + 6
const formLeft = Math.min(lastRect?.right ?? 0, window.innerWidth - 280)

// Store in formState:
setFormState({ type, anchorText, anchorStart: offsets.start, anchorEnd: offsets.end, prefill, rect: { top: formTop, left: formLeft } })
```

### useSectionAnnotationCounts — Core Algorithm

```typescript
// Source: 21-CONTEXT.md D-13, D-14 + getElementCharOffset pattern [VERIFIED: CONTEXT.md]
function useSectionAnnotationCounts(
  sections: Section[],
  annotations: Annotation[],
  planRef: React.RefObject<HTMLDivElement | null>,
): Map<string, number> {
  // Compute heading char offsets from planRef DOM
  // For each annotation, find section whose [headingStart, nextHeadingStart) contains anchorStart
  // useMemo on [sections, annotations, planRef] to avoid recompute on every render
}
```

### CommentBubble — Edit Mode Textarea Render

```typescript
// Source: 21-CONTEXT.md D-10 + 21-UI-SPEC.md [VERIFIED: CONTEXT.md + UI-SPEC]
{isEditing ? (
  <textarea
    autoFocus
    defaultValue={annotation.comment}
    style={{ width: '100%', minHeight: 64, fontSize: 14, ... }}
    onKeyDown={(e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { /* save */ }
      if (e.key === 'Escape') { /* cancel */ }
    }}
  />
) : (
  <p>…{annotation.comment}…</p>
)}
```

### OutlinePane — Section Count Badge

```typescript
// Source: 21-UI-SPEC.md [VERIFIED: UI-SPEC]
{(annotationCounts?.get(section.id) ?? 0) > 0 && (
  <span
    aria-label={`${annotationCounts!.get(section.id)} comments`}
    style={{
      fontSize: 11, fontWeight: 600, lineHeight: 1,
      minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      marginLeft: 8,
      background: section.id === activeId ? 'var(--color-focus)' : 'rgba(59, 130, 246, 0.25)',
      color: section.id === activeId ? '#fff' : 'var(--color-focus)',
    }}
  >
    {annotationCounts!.get(section.id)}
  </span>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `handleAction` stub: `comment: anchorText` | Real `AnnotationForm` popover with textarea | Phase 21 | COMMENT-04 satisfied |
| `handleAdd` stub: `resetTextSelection()` only | Programmatic paragraph selection → SelectionToolbar | Phase 21 | Full paragraph annotation via gutter icon |
| CommentBubble: display-only | CommentBubble: edit/delete controls | Phase 21 | COMMENT-05 satisfied |
| OutlinePane: section names only | OutlinePane: section names + annotation count badges | Phase 21 | OUTLINE-04 satisfied |

**Deprecated/outdated stubs:**
- `comment: anchorText` in `handleAction` (ContentPane line ~100): replaced by textarea value
- `function handleAdd() { resetTextSelection() }` (ContentPane line ~111): replaced by programmatic selection

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `position: sticky; top: 16px` on editing bubble will work within the shared scroll container (`mainRef`) without additional CSS on the `<aside>` | Pitfall 4 + D-12 | Editing bubble won't stick; fallback needed (fixed positioning or scrollIntoView) |
| A2 | `useTextSelection`'s `captureKeyboard` (selectionchange) listener correctly picks up programmatic `addRange()` calls without a mousedown event | Pitfall on gutter icon flow | Gutter icon click won't populate SelectionToolbar; alternative: call `setSelectedText` directly |

---

## Open Questions

1. **`lastRect` storage: store in formState or as separate state?**
   - What we know: `formState` needs `{ type, anchorText, anchorStart, anchorEnd, prefill }` per D-01. Position info (`rect`) is needed to render `AnnotationForm` at the correct coordinates.
   - What's unclear: Should `rect` be part of `formState` type, or a separate `useState<{ top, left } | null>`?
   - Recommendation: Include `rect` in `formState` since it is only needed when form is active — keeps the state collocated and eliminates a second `useState`.

2. **`getElementCharOffset` placement**
   - What we know: D-15 leaves this to Claude's discretion. Options: add to `useTextSelection.ts` alongside `rangeFromOffsets`, or create a separate `hooks/useSectionAnnotationCounts.ts` that includes the utility.
   - What's unclear: Whether a dedicated file for the hook improves discoverability.
   - Recommendation: Co-locate `getElementCharOffset` in `useTextSelection.ts` (exported, next to `rangeFromOffsets`) since both are character-offset utilities operating on the same container model. The hook `useSectionAnnotationCounts` can be a separate file.

3. **GutterIcon signature change scope**
   - What we know: `onAdd: () => void` must become `onAdd: (el: HTMLElement) => void` OR `PlanContent` can wrap the callback and pass `hoveredParagraph` from its own state.
   - What's unclear: Which approach is less disruptive to `GutterIcon.test.ts`.
   - Recommendation: Change `PlanContent` to wrap the `onAdd` call: `<GutterIcon paragraph={hoveredParagraph} containerRef={planRef} onAdd={() => handleAdd(hoveredParagraph)} />`. This avoids changing `GutterIcon`'s interface, which is already tested. `handleAdd` in `ContentPane` receives the element from the closure.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — no new npm packages, no new CLI tools, no new services).

---

## Validation Architecture

`nyquist_validation` is `false` in `.planning/config.json`. Section skipped per config.

---

## Security Domain

Phase 21 adds no authentication, session management, cryptography, or external data fetching. The only input processing is user text in a textarea that becomes `annotation.comment` — a string stored in React state and serialized to JSON by existing infrastructure in Phase 22. No XSS vector is introduced because the comment text is rendered as text content (not `innerHTML`) via React's JSX rendering of `{annotation.comment}`.

ASVS V5 (Input Validation): annotation comment text is free-form user input; no server-side processing in this phase. No sanitization needed for local client-side rendering via React text nodes.

---

## Sources

### Primary (HIGH confidence)
- `/ui/src/reviewer-v2/ContentPane.tsx` — exact stub code to replace (handleAction, handleAdd); lastRect/TOOLBAR_WIDTH pattern
- `/ui/src/reviewer-v2/SelectionToolbar.tsx` — QUICK_ACTIONS constant; TOOLBAR_WIDTH = 280; pill onClick clears selection before onAction
- `/ui/src/reviewer-v2/hooks/useTextSelection.ts` — rangeFromOffsets, selection-lock highlight, storedOffsets pattern
- `/ui/src/reviewer-v2/CommentBubble.tsx` — existing prop interface; position: absolute; isFocused state
- `/ui/src/reviewer-v2/CommentPane.tsx` — anchorYMap; computeCommentLayout; existing scroll/resize wiring
- `/ui/src/reviewer-v2/ReviewerV2Shell.tsx` — hoveredCommentId/focusedCommentId state pattern
- `/ui/src/reviewer-v2/useAnnotations.ts` — editAnnotation/removeAnnotation already implemented
- `/ui/src/reviewer-v2/OutlinePane.tsx` — existing section button rendering; depth-based indent
- `/ui/src/reviewer-v2/GutterIcon.tsx` — paragraph prop available; onAdd callback
- `/ui/src/reviewer-v2/PlanContent.tsx` — hoveredParagraph state; GutterIcon wiring
- `/ui/src/reviewer-v2/types.ts` — Annotation, AnnotationType, Section types
- `.planning/phases/21-comment-actions/21-CONTEXT.md` — all locked decisions D-01 through D-15
- `.planning/phases/21-comment-actions/21-UI-SPEC.md` — complete visual spec, no new packages
- `ui/vitest.config.ts` + `ui/vitest.setup.ts` — test environment config

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — COMMENT-04, COMMENT-05, OUTLINE-04 text
- `.planning/phases/20-comment-pane/20-CONTEXT.md` — onAddAnnotation callback signature; CSS Highlights pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing libraries verified from codebase
- Architecture: HIGH — all patterns verified from existing source files
- Pitfalls: HIGH — derived from reading actual source code and existing test patterns

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable — no external dependencies)
