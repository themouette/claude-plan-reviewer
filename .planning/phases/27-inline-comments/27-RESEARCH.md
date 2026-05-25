# Phase 27: Inline Comments — Research

**Researched:** 2026-05-25
**Domain:** React 19 + @pierre/diffs annotation API + reducer pattern
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Line comments use `renderGutterUtility` prop on `FileDiff` (React). `getHoveredLine()` returns `{ lineNumber, side }` — clicking + opens a comment input anchored to that line.
- **D-02:** `FileDiffComponent` accepts `lineAnnotations` and `renderAnnotation` props (already present in DiffPane.tsx, currently unpassed). Phase 27 wires these without changing the import.
- **D-03:** File-level comments (COMMENT-02) triggered by a button in the existing file header row. Input and submitted comments render between file header and diff content. No `lineAnnotations` involvement.
- **D-04:** Inline annotation entry appears as a React node via `renderAnnotation` (line comments) or in the file section header area (file comments). Contains `<textarea>` + Submit + Cancel. No popover or overlay. GitHub-style.
- **D-05:** Submitted comments render as styled cards: text, creation timestamp, edit (pencil) and delete (×) icon buttons. No author display.
- **D-06:** Card style uses existing CSS variable tokens. New components under `ui/src/code-review/`. MUST NOT import from `reviewer-v2/`.
- **D-07:** Single flat `CodeReviewComment[]` in `CodeReviewApp`. Discriminated union by `type`:
  ```ts
  type CodeReviewComment =
    | { id: string; type: 'line'; file: string; side: 'additions' | 'deletions'; lineNumber: number; text: string; createdAt: string }
    | { id: string; type: 'file'; file: string; text: string; createdAt: string }
  ```
- **D-08:** State via `useCodeReviewAnnotations` reducer with dispatches `ADD_COMMENT`, `EDIT_COMMENT`, `DELETE_COMMENT`. Pure reducer — testable without React renderer.
- **D-09:** Session persistence = React state. Comments survive commit navigation. Lost on page refresh. No localStorage. No backend.
- **D-10:** `FileListPane` receives `commentCounts: Record<string, number>`. Derived in `CodeReviewApp` via `useMemo`. Badge rendered when count > 0, using `--color-focus` background.
- **D-11:** Comment anchor shape mirrors `@pierre/diffs` `DiffLineAnnotation` natively. Phase 28 will serialize from this shape.

### Claude's Discretion

- Comment `id` generation strategy (UUID, timestamp-based, incrementing counter)
- Exact textarea dimensions and Submit/Cancel button layout within the inline form
- How `renderGutterUtility` + click state interact (`pendingLineAnchor` state in `DiffPane` or lifted to `CodeReviewApp`)
- Whether to show pending/draft annotation via separate mechanism or via a special `type: 'pending'` entry in the annotations array

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMMENT-01 | User can add a comment anchored to any diff hunk | D-01/D-02: `renderGutterUtility` + `lineAnnotations` + `renderAnnotation` API confirmed in @pierre/diffs types |
| COMMENT-02 | User can add a comment at the whole-file level | D-03: file header button + section above FileDiffRenderer |
| COMMENT-03 | User can edit or delete their own comments | D-05/D-08: reducer with EDIT_COMMENT/DELETE_COMMENT; CommentBubble edit/delete controls |
| COMMENT-04 | File list shows a comment count badge per file | D-10: `commentCounts` prop to FileListPane; derived with useMemo in CodeReviewApp |
</phase_requirements>

---

## Summary

Phase 27 adds an inline comment layer to the existing diff viewer. The implementation is pure frontend — React state, no new backend endpoints, no new npm packages. All API surface points have been confirmed directly from `@pierre/diffs` type definitions in the project's own `node_modules`.

The `@pierre/diffs` React `FileDiff` component already exposes the three props this phase needs: `lineAnnotations` (an array of `DiffLineAnnotation<T>` objects that anchor rows to rendered content), `renderAnnotation` (a callback returning a `ReactNode` rendered below each annotated line), and `renderGutterUtility` (a callback returning a `ReactNode` that appears in the gutter area on line hover). None of these props are currently passed in `DiffPane.tsx`'s `FileDiffRenderer` inner function — Phase 27 wires them in.

The architecture follows the same TDD-first, injectable-pure-function pattern established in Phase 26 (`useCommits`/`useDiff`). The reducer (`useCodeReviewAnnotations`) is a pure function that can be tested without mounting any React component. `CodeReviewApp` owns the single `comments` array and passes derived props down the tree.

**Primary recommendation:** Follow the 3-plan split from the roadmap — TDD reducer first, then UI components, then edit/delete/badge wiring. This ordering is safe because the reducer is a compile-time dependency of the UI components, but the UI components are not dependencies of the reducer tests.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Comment state (add/edit/delete) | Frontend App State (`CodeReviewApp`) | — | D-08/D-09: session-only React state; no backend persistence needed |
| Line-anchored comment trigger | `DiffPane` (wraps FileDiffComponent) | `CodeReviewApp` (owns `onAddComment`) | `renderGutterUtility` lives at the component layer; the click propagates up via callback |
| File-level comment trigger | `DiffPane` (file header row) | `CodeReviewApp` | Button in file header; same callback pattern |
| Comment form (textarea) | `HunkCommentForm` component | `DiffPane` | Rendered inline via `renderAnnotation` or in the file section header |
| Submitted comment display | `CommentBubble` component | `DiffPane` / `CodeReviewApp` | Rendered via `renderAnnotation` (line) or inline (file) |
| File list badge | `FileListPane` | `CodeReviewApp` (derives counts) | Count derived upstream; rendering is FileListPane's responsibility |
| ID generation | `useCodeReviewAnnotations` hook / reducer | — | Centralized in state management layer |

---

## Standard Stack

### Core (no new packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.2.4 | Component and state layer | Already installed — `useReducer` drives the annotation store |
| @pierre/diffs | ^1.1.12 | Diff rendering; provides `lineAnnotations`, `renderAnnotation`, `renderGutterUtility` | Already installed — no new dependency |
| TypeScript | ~6.0.2 | Type-safe discriminated union for `CodeReviewComment` | Already installed |
| Vitest | ^4.1.4 | Reducer and component tests | Already installed; jsdom environment configured |

[VERIFIED: npm registry] — all versions confirmed from `ui/package.json` and `ui/node_modules`.

### No New Packages

This phase requires zero additional npm packages. The existing dependencies cover all needs:
- State: `useReducer` (React built-in)
- IDs: `crypto.randomUUID()` — available in Node.js 15+ and all modern browsers [VERIFIED: confirmed available in project runtime]
- Styling: inline CSS with existing CSS variable tokens

**Installation:** None needed.

---

## Package Legitimacy Audit

No new packages are introduced in this phase.

| Package | Disposition |
|---------|-------------|
| (none) | N/A — zero new dependencies |

---

## Architecture Patterns

### System Architecture Diagram

```
CodeReviewApp (owns comments: CodeReviewComment[])
    │
    ├─ useCodeReviewAnnotations() ← dispatch: ADD/EDIT/DELETE
    │   └─ reduceAnnotations(state, action) ← pure, testable
    │
    ├─ useMemo → commentCounts: Record<string, number>
    │
    ├─ FileListPane(commentCounts) → badge per file when count > 0
    │
    └─ DiffPane(comments, onAddComment, onEditComment, onDeleteComment)
            │
            └─ FileDiffRenderer (per file)
                    │
                    ├─ FileDiffComponent(
                    │      lineAnnotations=[{side, lineNumber, metadata:{commentId}},...],
                    │      renderAnnotation=(ann) → <CommentBubble> | <HunkCommentForm>,
                    │      renderGutterUtility=(getHoveredLine) → <+button> on hover
                    │  )
                    │
                    └─ [file header row]
                           ├─ [comment button] → onAddFileComment(filename)
                           └─ [file comments] → <CommentBubble> per file-type comment
```

Data flow:
1. User hovers a diff line → `renderGutterUtility` receives `getHoveredLine` function; gutter + button renders
2. User clicks + button → `DiffPane` captures `{ lineNumber, side }` from `getHoveredLine()`, calls `onAddComment` with `{ type:'pending', ... }`
3. User submits HunkCommentForm → `ADD_COMMENT` dispatched to reducer → `comments` array updated
4. `DiffPane` converts `comments` for this file into `DiffLineAnnotation<{commentId}>[]` and passes as `lineAnnotations`
5. `renderAnnotation(annotation)` looks up full comment by `commentId`, renders `<CommentBubble>`
6. `CodeReviewApp` derives `commentCounts` from `comments`, passes to `FileListPane`

### Recommended Project Structure

```
ui/src/code-review/
├── hooks/
│   ├── useCodeReviewAnnotations.ts   # NEW: reducer + pure reduceAnnotations fn + hook
│   ├── useCodeReviewAnnotations.test.ts  # NEW: TDD tests for pure reducer
│   ├── useCommits.ts
│   └── useDiff.ts
├── HunkCommentForm.tsx               # NEW: inline textarea for line comments
├── HunkCommentForm.test.ts           # NEW: source-text tests
├── CommentBubble.tsx                 # NEW: submitted comment card (text + edit/delete)
├── CommentBubble.test.ts             # NEW: source-text tests
├── types.ts                          # MODIFIED: add CodeReviewComment union type
├── DiffPane.tsx                      # MODIFIED: wire lineAnnotations + gutter + file comments
├── DiffPane.test.ts                  # MODIFIED: add assertions for new props and DOM patterns
├── FileListPane.tsx                  # MODIFIED: accept commentCounts, render badge
├── FileListPane.test.ts              # MODIFIED: add badge assertions
├── CodeReviewApp.tsx                 # MODIFIED: own comments state, derive counts, pass down
└── CodeReviewApp.test.ts             # MODIFIED: add assertions for comments state pattern
```

### Pattern 1: Injectable Pure Reducer (established in Phase 26)

```typescript
// Source: ui/src/code-review/hooks/useCommits.ts (established pattern)
// Applied to useCodeReviewAnnotations — the reducer is exported for direct testing

export type CommentAction =
  | { type: 'ADD_COMMENT'; comment: CodeReviewComment }
  | { type: 'EDIT_COMMENT'; id: string; text: string }
  | { type: 'DELETE_COMMENT'; id: string }

export function reduceAnnotations(
  state: CodeReviewComment[],
  action: CommentAction
): CodeReviewComment[] {
  switch (action.type) {
    case 'ADD_COMMENT':
      return [...state, action.comment]
    case 'EDIT_COMMENT':
      return state.map(c => c.id === action.id ? { ...c, text: action.text } : c)
    case 'DELETE_COMMENT':
      return state.filter(c => c.id !== action.id)
  }
}

export function useCodeReviewAnnotations() {
  const [comments, dispatch] = useReducer(reduceAnnotations, [])
  return {
    comments,
    addComment: (comment: CodeReviewComment) => dispatch({ type: 'ADD_COMMENT', comment }),
    editComment: (id: string, text: string) => dispatch({ type: 'EDIT_COMMENT', id, text }),
    deleteComment: (id: string) => dispatch({ type: 'DELETE_COMMENT', id }),
  }
}
```

Tests call `reduceAnnotations` directly — no `useReducer` mounting needed. [VERIFIED: pattern confirmed from existing `useAnnotations.ts` in reviewer-v2 and `fetchCommitsOnce` in useCommits.ts]

### Pattern 2: DiffLineAnnotation with Metadata Reference

```typescript
// Source: ui/node_modules/@pierre/diffs/dist/types.d.ts
// DiffLineAnnotation<T> = { side: AnnotationSide; lineNumber: number; } & OptionalMetadata<T>

// Convert comments → lineAnnotations for one file
const lineAnnotations: DiffLineAnnotation<{ commentId: string }>[] = comments
  .filter((c): c is LineCodeReviewComment => c.type === 'line' && c.file === file.filename)
  .map(c => ({ side: c.side, lineNumber: c.lineNumber, metadata: { commentId: c.id } }))
```

`renderAnnotation` receives a `DiffLineAnnotation<{commentId}>` — it looks up the full comment from the `comments` array by `metadata.commentId`. This is the indirection pattern suggested in CONTEXT.md `<specifics>`. [VERIFIED: type confirmed from @pierre/diffs dist/types.d.ts]

### Pattern 3: renderGutterUtility for + Button

```typescript
// Source: ui/node_modules/@pierre/diffs/dist/react/types.d.ts
// renderGutterUtility?(getHoveredLine: () => GetHoveredLineResult<'diff'> | undefined): ReactNode

// GetHoveredLineResult<'diff'> = { lineNumber: number; side: AnnotationSide }

renderGutterUtility={(getHoveredLine) => (
  <button
    type="button"
    onClick={() => {
      const hovered = getHoveredLine()
      if (hovered) {
        onAddLineComment(file.filename, hovered.lineNumber, hovered.side)
      }
    }}
    style={{ ... }}
  >
    +
  </button>
)}
```

The gutter button calls `getHoveredLine()` on click (not on render) to get the current line context. [VERIFIED: type confirmed from dist/react/types.d.ts]

### Pattern 4: Pending Annotation State (Claude's Discretion)

Two viable approaches for the pending form:

**Option A — `pendingLineAnchor` state in DiffPane (recommended):**
```typescript
// DiffPane owns local state for the open-form anchor:
const [pendingLineAnchor, setPendingLineAnchor] = useState<{
  file: string; lineNumber: number; side: AnnotationSide
} | null>(null)

// When lineAnnotations is built per file, include a sentinel if pendingLineAnchor matches:
const lineAnnotations = [
  ...submittedAnnotations,
  ...(pendingLineAnchor?.file === file.filename
    ? [{ side: pendingLineAnchor.side, lineNumber: pendingLineAnchor.lineNumber, metadata: { commentId: '__pending__' } }]
    : [])
]

// renderAnnotation checks commentId === '__pending__' → render HunkCommentForm
```

**Option B — `type: 'pending'` entry in the global comments array:**
Adds complexity to the reducer (need to filter pendings out of counts/serialization). Option A is cleaner.

[ASSUMED] — both approaches are valid; Option A is the recommendation based on keeping `CodeReviewApp`'s comments array clean of transient state.

### Pattern 5: File-Level Comment Rendering

File comments are NOT wired through `lineAnnotations` (D-03). They render between the file header and the diff:

```tsx
{/* Between file header and diff body in DiffPane */}
{fileComments.length > 0 && fileComments.map(c => (
  <CommentBubble
    key={c.id}
    comment={c}
    onEdit={(text) => onEditComment(c.id, text)}
    onDelete={() => onDeleteComment(c.id)}
  />
))}
{pendingFileComment === file.filename && (
  <HunkCommentForm
    onSubmit={(text) => { onAddFileComment(file.filename, text); clearPendingFileComment() }}
    onCancel={clearPendingFileComment}
  />
)}
```

### Anti-Patterns to Avoid

- **Importing from `reviewer-v2/`**: ESLint rule `no-restricted-imports` will fail the build. Copy any needed pattern directly into `code-review/`. [VERIFIED: eslint.config.js confirmed]
- **Mutating state in reducer**: The reducer must return new arrays/objects on every change — React's `useReducer` identity-checks the result.
- **Calling `getHoveredLine()` during render**: Call it inside the click handler, not at render time. The hovered line changes as the mouse moves; capture it at click time.
- **Including `type: 'pending'` comments in `commentCounts`**: File list badge counts should only reflect submitted comments.
- **Using `lineAnnotations` for file-level comments**: The `DiffLineAnnotation` type requires a `lineNumber` and `side` — file-level comments have neither. Render them separately (D-03).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique IDs | Custom counter or Date.now() | `crypto.randomUUID()` | Collision-free, no state, works in browser + Node.js tests |
| Diff line hover detection | Manual DOM event listeners | `renderGutterUtility` + `getHoveredLine()` | @pierre/diffs already tracks the hovered line internally via its InteractionManager |
| Annotation row insertion | Custom DOM manipulation | `lineAnnotations` + `renderAnnotation` | @pierre/diffs handles layout, spacing, and virtualization — hand-rolling breaks with expand/collapse |

---

## Common Pitfalls

### Pitfall 1: `renderAnnotation` returns `ReactNode`, not `HTMLElement`
**What goes wrong:** The base (non-React) `FileDiff` class has `renderAnnotation` returning `HTMLElement`. The React wrapper version in `dist/react/types.d.ts` returns `ReactNode`.
**Why it happens:** The same prop name exists on both the vanilla JS class and the React wrapper — they have different return types.
**How to avoid:** Always import `FileDiff` from `@pierre/diffs/react`, never from `@pierre/diffs` bare. The React wrapper's `renderAnnotation` signature is: `(annotations: DiffLineAnnotation<LAnnotation>) => ReactNode`.
**Warning signs:** TypeScript error "Type 'ReactNode' is not assignable to type 'HTMLElement'."

### Pitfall 2: `isPartial: true` blocks lineAnnotations layout
**What goes wrong:** `PatchDiff` (used as fallback for binary or patch-only files) sets `isPartial: true` on the underlying `FileDiffMetadata`. With partial data, the component cannot reliably position annotations.
**Why it happens:** The `parseDiffFromFile` path (used in `FileDiffRenderer` when `old_content` and `new_content` exist) produces `isPartial: false`, which enables full annotation layout. The `PatchDiff` path does not.
**How to avoid:** Pass `lineAnnotations` only to `FileDiffComponent` (the non-partial path). The `PatchDiff` branch in `FileDiffRenderer` cannot accept `lineAnnotations` (component type mismatch) — treat binary/patch-only files as annotation-disabled.
**Warning signs:** Phase 25 PATTERNS.md specifically notes this. The `MEMORY.md` entry "pierre-diffs expansion pitfall" documents it.

### Pitfall 3: `getHoveredLine()` returns `undefined` when no line is hovered
**What goes wrong:** Click handler calls `getHoveredLine()` and uses the result without a null-check, throwing a runtime error when the user clicks the gutter button after moving the mouse away.
**Why it happens:** The gutter button is sticky (always visible during hover), but the mouse position can update between the hover-in event and the click.
**How to avoid:** Always guard: `const hovered = getHoveredLine(); if (!hovered) return`.

### Pitfall 4: `commentCounts` includes pending comments
**What goes wrong:** If `pendingLineAnchor` state leaks into the derived `commentCounts`, badges show counts for comments that haven't been submitted yet.
**How to avoid:** Derive `commentCounts` from the submitted `comments` array only — not from any pending state.

### Pitfall 5: `setLoading(true)` inside `useEffect` body
**What goes wrong:** React strict-mode double-invocation causes state update warnings. Phase 25 established the pattern of `loading = true` from `useState(true)` initialization to avoid calling `setLoading(true)` synchronously in effects.
**How to avoid:** `useCodeReviewAnnotations` does not fetch data — no loading state needed. But any future async operations must follow the `cancelledRef` pattern from `useCommits`.

### Pitfall 6: Stale closure in `renderAnnotation`
**What goes wrong:** `renderAnnotation` is created inline in the JSX. If `comments` is captured by the closure and then the array reference changes, the rendered bubbles see a stale comment list.
**How to avoid:** Pass `onEditComment` and `onDeleteComment` callbacks (stable references from `useCodeReviewAnnotations`) into `renderAnnotation`. Use `useCallback` or function references from the hook — do not create new lambdas inside `renderAnnotation`.

---

## Code Examples

### Type Definitions (types.ts addition)

```typescript
// Source: CONTEXT.md D-07 — confirmed type shape
export type CodeReviewComment =
  | {
      id: string
      type: 'line'
      file: string
      side: 'additions' | 'deletions'
      lineNumber: number
      text: string
      createdAt: string
    }
  | {
      id: string
      type: 'file'
      file: string
      text: string
      createdAt: string
    }
```

### Reducer (useCodeReviewAnnotations.ts)

```typescript
// Source: reviewer-v2/useAnnotations.ts pattern + CONTEXT.md D-08

export type CommentAction =
  | { type: 'ADD_COMMENT'; comment: CodeReviewComment }
  | { type: 'EDIT_COMMENT'; id: string; text: string }
  | { type: 'DELETE_COMMENT'; id: string }

// Pure function — tests call this directly (no React renderer needed)
export function reduceAnnotations(
  state: CodeReviewComment[],
  action: CommentAction
): CodeReviewComment[] {
  switch (action.type) {
    case 'ADD_COMMENT':
      return [...state, action.comment]
    case 'EDIT_COMMENT':
      return state.map(c =>
        c.id === action.id ? { ...c, text: action.text } : c
      )
    case 'DELETE_COMMENT':
      return state.filter(c => c.id !== action.id)
  }
}

export function useCodeReviewAnnotations() {
  const [comments, dispatch] = useReducer(reduceAnnotations, [])
  return {
    comments,
    addComment: (comment: CodeReviewComment) =>
      dispatch({ type: 'ADD_COMMENT', comment }),
    editComment: (id: string, text: string) =>
      dispatch({ type: 'EDIT_COMMENT', id, text }),
    deleteComment: (id: string) =>
      dispatch({ type: 'DELETE_COMMENT', id }),
  }
}
```

### CommentCounts derivation (CodeReviewApp.tsx)

```typescript
// Source: CONTEXT.md D-10
const commentCounts = useMemo<Record<string, number>>(() => {
  const counts: Record<string, number> = {}
  for (const comment of comments) {
    counts[comment.file] = (counts[comment.file] ?? 0) + 1
  }
  return counts
}, [comments])
```

### lineAnnotations conversion (DiffPane.tsx per-file)

```typescript
// Source: CONTEXT.md D-02 + @pierre/diffs DiffLineAnnotation type
import type { DiffLineAnnotation } from '@pierre/diffs'

const fileComments = comments.filter(c => c.type === 'line' && c.file === file.filename)
const lineAnnotations: DiffLineAnnotation<{ commentId: string }>[] = fileComments.map(c => ({
  side: (c as LineCodeReviewComment).side,
  lineNumber: (c as LineCodeReviewComment).lineNumber,
  metadata: { commentId: c.id },
}))
```

### Badge in FileListPane (renderFileNode)

```tsx
// Source: CONTEXT.md D-10
{(commentCounts[file.filename] ?? 0) > 0 && (
  <span style={{
    background: 'var(--color-focus)',
    color: '#fff',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
    padding: '1px 6px',
    marginLeft: 6,
    flexShrink: 0,
  }}>
    {commentCounts[file.filename]}
  </span>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| reviewerV2 sidebar comment model (floating, anchored to text) | Inline diff annotation model (anchored to line via `lineAnnotations`) | Phase 27 | Fundamentally different rendering — no floating layout needed |
| `annotationReducer` with `add/edit/remove` (v2) | `reduceAnnotations` with `ADD_COMMENT/EDIT_COMMENT/DELETE_COMMENT` | Phase 27 | Same pattern, different action names matching CONTEXT.md D-08 |

**Deprecated/outdated patterns for this phase:**
- Anything from `reviewer-v2/` — ESLint blocks it; the patterns must be replicated/adapted within `code-review/`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pendingLineAnchor` state in `DiffPane` is the cleaner approach for pending annotation (vs. `type: 'pending'` in global array) | Architecture Patterns / Pattern 4 | Low — both are valid. Planner can choose either; the test plan is the same shape either way |
| A2 | `crypto.randomUUID()` is available in the jsdom test environment | Standard Stack | Low — confirmed available in Node.js runtime used for tests |

**All type/API claims were verified directly from `ui/node_modules/@pierre/diffs/dist/` type definitions in this session.**

---

## Open Questions

1. **Pending form anchor: DiffPane-local vs lifted to CodeReviewApp**
   - What we know: CONTEXT.md leaves this to Claude's discretion. Both work.
   - What's unclear: Whether Phase 28's serialization story benefits from the pending anchor being visible at `CodeReviewApp` level (probably not — pending ≠ submitted).
   - Recommendation: Keep `pendingLineAnchor` as `DiffPane`-local state. Pass `onAddComment` up to `CodeReviewApp` only when the form is submitted.

2. **PatchDiff fallback and annotations**
   - What we know: Binary files and files without `old_content`/`new_content` go through `PatchDiff`, not `FileDiffComponent`. `PatchDiff` cannot accept `lineAnnotations`.
   - What's unclear: Should the file-level comment button still appear in the header for binary files?
   - Recommendation: Yes — file-level comments (D-03) render above the diff content regardless of whether the diff is full or partial. Only line-anchored comments require `FileDiffComponent`.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is entirely frontend code/state changes. No external tools, services, CLIs, databases, or runtimes beyond what the existing `npm run dev`/`npm test` setup already provides.

---

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json` — this section is omitted per instructions.

---

## Security Domain

This phase manages only session-scoped in-memory comment text entered by the local user for local consumption. There is no data transmission, no persistence, no authentication surface, and no input that crosses a trust boundary. ASVS categories V2/V3/V4/V6 do not apply. V5 input validation is not a concern here because the comment text is rendered only back to the same user who typed it (no XSS vector — React escapes text content by default). No ASVS review action required.

---

## Sources

### Primary (HIGH confidence)
- `ui/node_modules/@pierre/diffs/dist/react/types.d.ts` — `DiffBasePropsReact`: `lineAnnotations`, `renderAnnotation`, `renderGutterUtility` props; confirmed React return types
- `ui/node_modules/@pierre/diffs/dist/types.d.ts` — `DiffLineAnnotation<T>`, `AnnotationSide` types
- `ui/node_modules/@pierre/diffs/dist/components/FileDiff.d.ts` — `FileDiffOptions`, `renderAnnotation(annotation: DiffLineAnnotation<LAnnotation>): HTMLElement` (vanilla class); `renderGutterUtility` shape
- `ui/node_modules/@pierre/diffs/dist/managers/InteractionManager.d.ts` — `GetHoveredLineResult<'diff'> = { lineNumber: number; side: AnnotationSide }`
- `ui/src/code-review/DiffPane.tsx` — existing `FileDiffRenderer` structure; unused prop slots confirmed
- `ui/src/code-review/CodeReviewApp.tsx` — state ownership pattern; `useMemo`, `useReducer` usage
- `ui/src/code-review/FileListPane.tsx` — `renderFileNode` structure; badge insertion point
- `ui/src/code-review/hooks/useCommits.ts` — pure-function + hook pattern; `cancelledRef` pattern
- `ui/src/reviewer-v2/useAnnotations.ts` — existing reducer pattern this phase mirrors
- `ui/src/reviewer-v2/CommentBubble.tsx` — edit/delete button styling reference
- `ui/src/reviewer-v2/AnnotationForm.tsx` — textarea form styling reference
- `ui/vitest.setup.ts` — jsdom mocks; confirmed `matchMedia`, `ResizeObserver`, `IntersectionObserver` already mocked
- `ui/eslint.config.js` — `no-restricted-imports` rule for `code-review/` confirmed
- `.planning/phases/27-inline-comments/27-CONTEXT.md` — locked decisions D-01 through D-11

### Secondary (MEDIUM confidence)
- `ui/src/reviewer-v2/types.ts` — `AnnotationAction` union pattern adapted for `CommentAction`

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from existing node_modules and package.json
- Architecture: HIGH — all API types verified from @pierre/diffs dist/ type definitions; patterns verified from existing codebase
- Pitfalls: HIGH for API pitfalls (verified from types); MEDIUM for React pattern pitfalls (derived from existing code patterns)

**Research date:** 2026-05-25
**Valid until:** 2026-08-25 (stable — @pierre/diffs API is a locked dependency; React 19 stable)
