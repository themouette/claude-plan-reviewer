# Phase 27: Inline Comments — Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 10 (3 new, 7 modified)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `ui/src/code-review/hooks/useCodeReviewAnnotations.ts` | hook/store | event-driven (reducer) | `ui/src/reviewer-v2/useAnnotations.ts` | exact |
| `ui/src/code-review/hooks/useCodeReviewAnnotations.test.ts` | test | — | `ui/src/reviewer-v2/useAnnotations.test.ts` | exact |
| `ui/src/code-review/HunkCommentForm.tsx` | component | request-response (form submit) | `ui/src/reviewer-v2/AnnotationForm.tsx` | role-match |
| `ui/src/code-review/HunkCommentForm.test.ts` | test | — | `ui/src/reviewer-v2/AnnotationForm.test.ts` | exact |
| `ui/src/code-review/CommentBubble.tsx` | component | event-driven (edit/delete) | `ui/src/reviewer-v2/CommentBubble.tsx` | exact |
| `ui/src/code-review/CommentBubble.test.ts` | test | — | `ui/src/reviewer-v2/CommentBubble.test.ts` | exact |
| `ui/src/code-review/types.ts` | model | — | `ui/src/reviewer-v2/types.ts` | role-match |
| `ui/src/code-review/DiffPane.tsx` | component | event-driven | `ui/src/code-review/DiffPane.tsx` (self, extend) | self |
| `ui/src/code-review/FileListPane.tsx` | component | CRUD (display) | `ui/src/code-review/FileListPane.tsx` (self, extend) | self |
| `ui/src/code-review/CodeReviewApp.tsx` | provider/orchestrator | event-driven | `ui/src/code-review/CodeReviewApp.tsx` (self, extend) | self |

---

## Pattern Assignments

### `ui/src/code-review/hooks/useCodeReviewAnnotations.ts` (hook, event-driven reducer)

**Analog:** `ui/src/reviewer-v2/useAnnotations.ts`

**Critical difference from analog:** Phase 27 uses a flat array (not a `{ annotations: [] }` wrapper object) so the reducer state is `CodeReviewComment[]` directly. The analog wraps in `AnnotationState`. Use the flat array form as specified in CONTEXT.md D-08 and RESEARCH.md Pattern 1.

**Imports pattern** (`ui/src/reviewer-v2/useAnnotations.ts` lines 1-2):
```typescript
import { useReducer } from 'react'
import type { Annotation, AnnotationAction } from './types'
```

For the new file, adapt imports to:
```typescript
import { useReducer } from 'react'
import type { CodeReviewComment } from '../types'
```

**Action union type pattern** (`ui/src/reviewer-v2/types.ts` lines 12-16):
```typescript
export type AnnotationAction =
  | { type: 'add'; annotation: Annotation }
  | { type: 'edit'; id: string; comment: string }
  | { type: 'remove'; id: string }
```

Adapt to Phase 27 action names (D-08):
```typescript
export type CommentAction =
  | { type: 'ADD_COMMENT'; comment: CodeReviewComment }
  | { type: 'EDIT_COMMENT'; id: string; text: string }
  | { type: 'DELETE_COMMENT'; id: string }
```

**Core reducer pattern** (`ui/src/reviewer-v2/useAnnotations.ts` lines 12-32):
```typescript
export function annotationReducer(
  state: AnnotationState,
  action: AnnotationAction,
): AnnotationState {
  switch (action.type) {
    case 'add':
      return { ...state, annotations: [...state.annotations, action.annotation] }
    case 'edit':
      return {
        ...state,
        annotations: state.annotations.map((a) =>
          a.id === action.id ? { ...a, comment: action.comment } : a,
        ),
      }
    case 'remove':
      return {
        ...state,
        annotations: state.annotations.filter((a) => a.id !== action.id),
      }
  }
}
```

Phase 27 version operates on `CodeReviewComment[]` directly (no wrapping object). The pure function is exported and named `reduceAnnotations` so tests can call it without mounting React.

**Hook wrapper pattern** (`ui/src/reviewer-v2/useAnnotations.ts` lines 34-46):
```typescript
export function useAnnotations() {
  const [state, dispatch] = useReducer(annotationReducer, initialAnnotationState)

  return {
    annotations: state.annotations,
    addAnnotation: (annotation: Annotation) =>
      dispatch({ type: 'add', annotation }),
    editAnnotation: (id: string, comment: string) =>
      dispatch({ type: 'edit', id, comment }),
    removeAnnotation: (id: string) =>
      dispatch({ type: 'remove', id }),
  }
}
```

---

### `ui/src/code-review/hooks/useCodeReviewAnnotations.test.ts` (test, pure reducer)

**Analog:** `ui/src/reviewer-v2/useAnnotations.test.ts`

**Test file header pattern** (`ui/src/reviewer-v2/useAnnotations.test.ts` lines 1-13):
```typescript
import { describe, it, expect } from 'vitest'
import { annotationReducer, initialAnnotationState } from './useAnnotations'
import type { Annotation } from './types'

const sampleAnnotation: Annotation = {
  id: 'a1',
  anchorText: 'some text',
  comment: 'original comment',
  type: 'comment',
  anchorStart: 0,
  anchorEnd: 9,
}
```

Adapt to Phase 27: import `reduceAnnotations` directly; fixture is a `CodeReviewComment` (line type). No React renderer, no `@testing-library/react`.

**Test case structure** (`ui/src/reviewer-v2/useAnnotations.test.ts` lines 15-77):
```typescript
describe('annotationReducer', () => {
  it('add: appends annotation to empty state', () => {
    const next = annotationReducer(initialAnnotationState, {
      type: 'add',
      annotation: sampleAnnotation,
    })
    expect(next.annotations).toHaveLength(1)
    expect(next.annotations[0].id).toBe('a1')
  })

  it('add then edit: updates comment field while keeping other fields unchanged', ...)
  it('add then remove: removes annotation by id', ...)
  it('edit non-existent id: state is structurally equivalent (no error, no mutation)', ...)
  it('remove non-existent id: state is structurally equivalent (no error, no mutation)', ...)
})
```

Required test cases for Phase 27: ADD_COMMENT appends, EDIT_COMMENT updates text field only (id/file/lineNumber/side unchanged), DELETE_COMMENT removes by id, edit unknown id is a no-op, delete unknown id is a no-op. Also test discriminated union: ADD line comment and ADD file comment both work.

---

### `ui/src/code-review/HunkCommentForm.tsx` (component, form submit)

**Analog:** `ui/src/reviewer-v2/AnnotationForm.tsx`

**Critical difference from analog:** Phase 27 form is inline (not `position: fixed`). It renders as a `ReactNode` returned by `renderAnnotation` (embedded in the diff layout). Remove the fixed-position and `rect`-based positioning. Remove the `document.addEventListener('mousedown')` click-outside cancel — inline forms cancel via an explicit Cancel button only (GitHub-style per D-04).

**Imports pattern** (`ui/src/reviewer-v2/AnnotationForm.tsx` lines 1-2):
```typescript
import { useEffect, useRef } from 'react'
import type { AnnotationType } from './types'
```

Phase 27 removes `useEffect` (no click-outside listener) and `AnnotationType` import. Only `useRef` is needed.

**Props interface pattern** (`ui/src/reviewer-v2/AnnotationForm.tsx` lines 13-22):
```typescript
export default function AnnotationForm({
  formState,
  onSubmit,
  onCancel,
  onTextareaChange,
}: {
  formState: FormState
  onSubmit: (comment: string) => void
  onCancel: () => void
  onTextareaChange?: (value: string) => void
}): React.JSX.Element {
```

Phase 27 simplifies: no `formState` position bag. Props are just `{ onSubmit, onCancel }`.

**Textarea pattern** (`ui/src/reviewer-v2/AnnotationForm.tsx` lines 72-94):
```typescript
<textarea
  ref={textareaRef}
  autoFocus
  defaultValue={formState.prefill}
  placeholder={formState.prefill === '' ? 'Add a comment…' : undefined}
  aria-label="Comment text"
  onKeyDown={handleKeyDown}
  onChange={(e) => onTextareaChange?.(e.target.value)}
  onMouseDown={(e) => e.stopPropagation()}
  style={{
    width: '100%',
    minHeight: 64,
    fontSize: 14,
    fontFamily: 'inherit',
    background: 'transparent',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: 4,
    padding: 8,
    resize: 'vertical',
    boxSizing: 'border-box',
  }}
/>
```

Keep: `autoFocus`, `aria-label="Comment text"`, `Cmd+Enter` submit, `Escape` cancel, CSS variable tokens. Remove: `formState.prefill` (empty start), `onTextareaChange` (not needed for Phase 27).

**Submit/Cancel button pattern** (`ui/src/reviewer-v2/AnnotationForm.tsx` lines 95-143):
```typescript
<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={onCancel}
    onFocus={(e) => {
      e.currentTarget.style.outline = '2px solid var(--color-focus)'
      e.currentTarget.style.outlineOffset = '2px'
    }}
    onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
    style={{
      background: 'transparent',
      color: 'var(--color-text-secondary)',
      height: 28,
      padding: '0 8px',
      fontSize: 13,
      fontWeight: 400,
      borderRadius: 4,
      border: 'none',
      cursor: 'pointer',
    }}
  >
    Dismiss
  </button>
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={handleSubmit}
    ...
    style={{
      background: 'var(--color-focus)',
      color: '#fff',
      height: 28,
      padding: '0 12px',
      fontSize: 13,
      fontWeight: 600,
      borderRadius: 4,
      border: 'none',
      cursor: 'pointer',
      minWidth: 44,
    }}
  >
    Post Comment
  </button>
</div>
```

Use "Cancel" instead of "Dismiss", "Add Comment" instead of "Post Comment" — button label is Claude's discretion per CONTEXT.md. Retain `onMouseDown={(e) => e.preventDefault()}` pattern on buttons (prevents textarea blur before submit).

**Container pattern** (`ui/src/reviewer-v2/AnnotationForm.tsx` lines 53-71):
```typescript
<div
  ref={containerRef}
  role="group"
  aria-label="Add annotation"
  onMouseDown={(e) => e.stopPropagation()}
  style={{
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    padding: 8,
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    width: 280,
  }}
>
```

Phase 27: remove `position: 'fixed'`, `top/left/zIndex` — inline layout; keep surface/border/shadow tokens.

---

### `ui/src/code-review/HunkCommentForm.test.ts` (test, source-text)

**Analog:** `ui/src/reviewer-v2/AnnotationForm.test.ts`

**Test pattern** (`ui/src/reviewer-v2/AnnotationForm.test.ts` lines 1-9):
```typescript
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import AnnotationForm from './AnnotationForm'

const source = readFileSync(resolve(__dirname, './AnnotationForm.tsx'), 'utf-8')
```

Phase 27 uses the same `readFileSync` source-text approach. Tests assert source contains specific strings — no DOM rendering, no `@testing-library/react`. This is the established test pattern for UI components in this codebase (confirmed by all existing `.test.ts` component files).

**Representative test assertions to replicate** (`ui/src/reviewer-v2/AnnotationForm.test.ts` lines 10-107):
- `expect(typeof HunkCommentForm).toBe('function')` — default export is callable
- `expect(source).toContain('aria-label="Comment text"')` — textarea label
- `expect(source).toContain('autoFocus')` — focus on mount
- `expect(source).toContain('e.metaKey || e.ctrlKey')` — Cmd+Enter submit
- `expect(source).toContain("=== 'Escape'")` — Escape cancel
- `expect(source).not.toContain("position: 'fixed'")` — Phase 27 specific: inline, not fixed
- `expect(source).not.toContain('@testing-library/react')` — enforce no renderer
- `expect(source).toContain('var(--color-focus)')` — submit button color

---

### `ui/src/code-review/CommentBubble.tsx` (component, edit/delete)

**Analog:** `ui/src/reviewer-v2/CommentBubble.tsx`

**Critical differences from analog:** Phase 27 bubble is much simpler — single-user tool, no `isCompact`, `isHovered`, `isFocused`, `top`, `position: 'absolute'`. Always show edit+delete controls. Always show full text. No annotation type colors. Props are `{ comment: CodeReviewComment, onEdit, onDelete }`.

**Imports pattern** (`ui/src/reviewer-v2/CommentBubble.tsx` lines 1-2):
```typescript
import { useRef } from 'react'
import type { Annotation } from './types'
```

Phase 27:
```typescript
import { useRef, useState } from 'react'
import type { CodeReviewComment } from './types'
```

**Card container pattern** (`ui/src/reviewer-v2/CommentBubble.tsx` lines 44-56):
```typescript
const baseStyle: React.CSSProperties = {
  position: 'absolute',   // Phase 27: remove — inline, not absolute
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  padding: '8px 12px',
  background: 'var(--color-surface)',
  cursor: 'pointer',
}
```

Phase 27 removes `position: 'absolute'`, `top`, `zIndex`. Adds `marginBottom: 4` or similar for stacking.

**Edit button pattern** (`ui/src/reviewer-v2/CommentBubble.tsx` lines 181-207):
```typescript
<button
  type="button"
  className="bubble-icon-btn"
  aria-label="Edit comment"
  onMouseDown={(e) => e.preventDefault()}
  onClick={(e) => { e.stopPropagation(); onEdit() }}
  onMouseOver={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)' }}
  onMouseOut={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)' }}
  onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-focus)'; e.currentTarget.style.outlineOffset = '2px' }}
  onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
  style={{
    width: 20,
    height: 20,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: 0,
    color: 'var(--color-text-secondary)',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
  }}
>
  ✎
</button>
```

**Delete button pattern** (`ui/src/reviewer-v2/CommentBubble.tsx` lines 208-235):
```typescript
<button
  type="button"
  className="bubble-icon-btn"
  aria-label="Delete comment"
  onMouseDown={(e) => e.preventDefault()}
  onClick={(e) => { e.stopPropagation(); onRemove() }}
  onMouseOver={(e) => { e.currentTarget.style.color = 'var(--color-accent-deny)' }}
  onMouseOut={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)' }}
  onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-focus)'; e.currentTarget.style.outlineOffset = '2px' }}
  onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
  style={{ /* same 20x20 icon button style */ }}
>
  ×
</button>
```

**Edit mode (textarea) pattern** (`ui/src/reviewer-v2/CommentBubble.tsx` lines 119-147):
```typescript
<textarea
  ref={textareaRef}
  autoFocus
  defaultValue={annotation.comment}
  onMouseDown={(e) => e.stopPropagation()}
  onClick={(e) => e.stopPropagation()}
  onKeyDown={(e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      onEdit(textareaRef.current?.value ?? '')
    }
    if (e.key === 'Escape') {
      onCancelEdit()
    }
  }}
  style={{
    width: '100%',
    minHeight: 64,
    fontSize: 14,
    fontFamily: 'inherit',
    background: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: 4,
    padding: 8,
    resize: 'vertical',
    boxSizing: 'border-box',
  }}
/>
```

**Timestamp display:** Not present in the analog — new in Phase 27 (D-05). Use `comment.createdAt` formatted with `new Date(comment.createdAt).toLocaleString()` or keep as-is. Style with `color: 'var(--color-text-secondary)', fontSize: 12`.

---

### `ui/src/code-review/CommentBubble.test.ts` (test, source-text)

**Analog:** `ui/src/reviewer-v2/CommentBubble.test.ts`

**Test file header pattern** (`ui/src/reviewer-v2/CommentBubble.test.ts` lines 1-10):
```typescript
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import CommentBubble from './CommentBubble'

const source = readFileSync(
  resolve(__dirname, './CommentBubble.tsx'),
  'utf-8',
)
```

**Key assertions to replicate** (`ui/src/reviewer-v2/CommentBubble.test.ts` lines 12-134):
- `expect(typeof CommentBubble).toBe('function')`
- `expect(source).toContain('aria-label="Edit comment"')`
- `expect(source).toContain('aria-label="Delete comment"')`
- `expect(source).toContain('✎')` — pencil icon
- `expect(source).toContain('×')` — delete icon
- `expect(source).toContain('e.metaKey || e.ctrlKey')` — Cmd+Enter in edit mode
- `expect(source).toContain('autoFocus')` — textarea in edit mode
- `expect(source).toContain('defaultValue={')` — uncontrolled textarea
- `expect(source).toContain('var(--color-accent-deny)')` — delete hover color
- `expect(source).toContain('var(--color-surface)')` — card background
- `expect(source).toContain('createdAt')` — timestamp rendered (Phase 27 specific)
- `expect(source).not.toContain("position: 'absolute'")` — Phase 27: inline, not absolute
- `expect(source).not.toContain('@testing-library/react')`

---

### `ui/src/code-review/types.ts` (model, discriminated union addition)

**Analog:** `ui/src/reviewer-v2/types.ts`

**Existing types pattern** (`ui/src/code-review/types.ts` lines 1-23) — current file to extend:
```typescript
export interface FileDiff { ... }
export interface Commit { ... }
```

**Union type pattern from analog** (`ui/src/reviewer-v2/types.ts` lines 12-16):
```typescript
export type AnnotationAction =
  | { type: 'add'; annotation: Annotation }
  | { type: 'edit'; id: string; comment: string }
  | { type: 'remove'; id: string }
```

Add to `types.ts` following the same union-type pattern (from CONTEXT.md D-07):
```typescript
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

---

### `ui/src/code-review/DiffPane.tsx` (component, extend existing)

**Analog:** `ui/src/code-review/DiffPane.tsx` (self — add new props)

**Props extension pattern** (`ui/src/code-review/DiffPane.tsx` lines 60-86) — follow the exact same optional-with-defaults pattern used for Phase 26 additions:
```typescript
export interface DiffPaneProps {
  // ... existing props ...
  // Phase 26 additions — all optional; default values preserve existing call sites
  viewMode?: 'branch' | 'commit'  // default 'branch'
  activeCommitSha?: string | null // default null
  // Phase 27 additions — all optional; default values preserve existing call sites
  comments?: CodeReviewComment[]           // default []
  onAddLineComment?: (file: string, lineNumber: number, side: 'additions' | 'deletions', text: string) => void
  onAddFileComment?: (file: string, text: string) => void
  onEditComment?: (id: string, text: string) => void
  onDeleteComment?: (id: string) => void
}
```

**`FileDiffRenderer` extension pattern** (`ui/src/code-review/DiffPane.tsx` lines 18-58) — inner function receives new props and passes to `FileDiffComponent`:
```typescript
function FileDiffRenderer({
  file,
  diffStyle,
  contextExpanded,
  // Phase 27 new params:
  lineAnnotations,
  renderAnnotation,
  renderGutterUtility,
}: { ... }) {
  if (fileDiffMetadata) {
    return (
      <FileDiffComponent
        fileDiff={fileDiffMetadata}
        disableWorkerPool={true}
        options={{ ... }}
        lineAnnotations={lineAnnotations}
        renderAnnotation={renderAnnotation}
        renderGutterUtility={renderGutterUtility}
      />
    )
  }
  // PatchDiff path: no lineAnnotations (per RESEARCH pitfall 2)
}
```

**File header pattern** (`ui/src/code-review/DiffPane.tsx` lines 276-332) — existing header `role="button"` div. Phase 27 adds a comment trigger button alongside the chevron + filename. Stop propagation on the comment button click (prevents file collapse toggle):
```tsx
{/* Phase 27: File-level comment trigger — stop propagation prevents collapse toggle */}
<button
  type="button"
  aria-label="Add file comment"
  onClick={(e) => { e.stopPropagation(); onAddFileComment?.(file.filename) }}
  style={{ /* icon button style — same 20x20 pattern as bubble-icon-btn */ }}
>
  {/* comment icon */}
</button>
```

**File comments rendering pattern** (between file header and diff body, `ui/src/code-review/DiffPane.tsx` around line 335) — new section in the `!isCollapsed` block:
```tsx
{!isCollapsed && (
  <>
    {/* Phase 27: file-level comments above diff body */}
    {fileComments.map(c => (
      <CommentBubble
        key={c.id}
        comment={c}
        onEdit={(text) => onEditComment?.(c.id, text)}
        onDelete={() => onDeleteComment?.(c.id)}
      />
    ))}
    {pendingFileComment === file.filename && (
      <HunkCommentForm
        onSubmit={(text) => { ... }}
        onCancel={() => setPendingFileComment(null)}
      />
    )}
    {/* existing content */}
    {file.patch === '[binary file]' ? (...) : (
      <FileDiffRenderer ... />
    )}
  </>
)}
```

---

### `ui/src/code-review/FileListPane.tsx` (component, extend existing)

**Analog:** `ui/src/code-review/FileListPane.tsx` (self — add `commentCounts` prop)

**Props extension pattern** (`ui/src/code-review/FileListPane.tsx` lines 5-9):
```typescript
export interface FileListPaneProps {
  files: FileDiff[]
  activeIndex: number | null
  diffPaneRef: React.RefObject<HTMLDivElement | null>
  onActiveIndexChange: (index: number) => void
  // Phase 27 addition:
  commentCounts?: Record<string, number>  // default {} — filename → submitted comment count
}
```

**Badge insertion pattern** in `renderFileNode` (`ui/src/code-review/FileListPane.tsx` lines 169-179) — after the basename span, before the change counts span:
```tsx
{/* Basename */}
<span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
  {basename}
</span>

{/* Phase 27: Comment count badge — from RESEARCH.md Pattern code example */}
{(commentCounts?.[file.filename] ?? 0) > 0 && (
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
    {commentCounts![file.filename]}
  </span>
)}

{/* Change counts — omitted when additions + deletions === 0 */}
{showCounts && (
  <span style={{ marginLeft: 'auto', ... }}>
```

---

### `ui/src/code-review/CodeReviewApp.tsx` (orchestrator, extend existing)

**Analog:** `ui/src/code-review/CodeReviewApp.tsx` (self — add comments state + derive counts)

**State addition pattern** (`ui/src/code-review/CodeReviewApp.tsx` lines 11-22) — follow existing `useState` declarations:
```typescript
// Phase 27: comment state via useCodeReviewAnnotations reducer (D-08/D-09)
const { comments, addComment, editComment, deleteComment } = useCodeReviewAnnotations()
```

**useMemo derivation pattern** (`ui/src/code-review/CodeReviewApp.tsx` — new, follows existing `selectorKey` derivation style):
```typescript
// Phase 27: derive commentCounts for FileListPane badge (D-10)
const commentCounts = useMemo<Record<string, number>>(() => {
  const counts: Record<string, number> = {}
  for (const comment of comments) {
    counts[comment.file] = (counts[comment.file] ?? 0) + 1
  }
  return counts
}, [comments])
```

**Prop passing pattern** — existing `<FileListPane>` and `<DiffPane>` JSX additions follow the same `prop={value}` style as existing Phase 26 additions (lines 222-250):
```tsx
<FileListPane
  files={files}
  activeIndex={activeIndex}
  diffPaneRef={diffPaneRef}
  onActiveIndexChange={setActiveIndex}
  commentCounts={commentCounts}  {/* Phase 27 */}
/>
<DiffPane
  ...
  comments={comments}            {/* Phase 27 */}
  onAddLineComment={addLineComment}
  onAddFileComment={addFileComment}
  onEditComment={editComment}
  onDeleteComment={deleteComment}
/>
```

---

## Shared Patterns

### CSS Variable Tokens (applies to all Phase 27 components)
**Source:** `ui/src/code-review/DiffPane.tsx` and all `reviewer-v2/` components
**Apply to:** `HunkCommentForm.tsx`, `CommentBubble.tsx`, badge in `FileListPane.tsx`
```typescript
// Approved CSS variable tokens (CONTEXT.md D-06):
'var(--color-surface)'        // card/form background
'var(--color-border)'         // card/form border, textarea border
'var(--color-text-primary)'   // comment body text
'var(--color-text-secondary)' // timestamp, secondary actions, inactive icons
'var(--color-focus)'          // submit button background, badge background, focus ring
'var(--color-accent-deny)'    // delete button hover color
```

### Focus Ring Pattern (applies to all interactive buttons)
**Source:** `ui/src/reviewer-v2/AnnotationForm.tsx` lines 101-104 and `ui/src/reviewer-v2/CommentBubble.tsx` lines 189-190
**Apply to:** All `<button>` elements in `HunkCommentForm.tsx` and `CommentBubble.tsx`
```typescript
onFocus={(e) => {
  e.currentTarget.style.outline = '2px solid var(--color-focus)'
  e.currentTarget.style.outlineOffset = '2px'
}}
onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
```

### No-Import-From-reviewer-v2 Rule
**Source:** `ui/eslint.config.js` (confirmed in RESEARCH.md)
**Apply to:** ALL Phase 27 files under `ui/src/code-review/`
- Copy patterns from `reviewer-v2/` — do NOT import from them.
- ESLint `no-restricted-imports` rule will fail the build if any `code-review/` file imports from `reviewer-v2/`.

### Source-Text Test Pattern (applies to all component tests)
**Source:** `ui/src/reviewer-v2/AnnotationForm.test.ts` lines 1-9, `ui/src/reviewer-v2/CommentBubble.test.ts` lines 1-10, `ui/src/code-review/CodeReviewApp.test.ts` lines 1-9
**Apply to:** `HunkCommentForm.test.ts`, `CommentBubble.test.ts`
```typescript
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import TheComponent from './TheComponent'

const source = readFileSync(resolve(__dirname, './TheComponent.tsx'), 'utf-8')

describe('TheComponent', () => {
  it('default export is a function', () => {
    expect(typeof TheComponent).toBe('function')
  })
  // All other tests use: expect(source).toContain('...')
  // No @testing-library/react
})
```

### Optional Props With Defaults Pattern (applies to modified components)
**Source:** `ui/src/code-review/DiffPane.tsx` lines 68-86
**Apply to:** Phase 27 prop additions to `DiffPane.tsx` and `FileListPane.tsx`
```typescript
// Pattern: add optional props with defaults to preserve existing call sites
export default function DiffPane({
  ...existingProps,
  comments = [],              // Phase 27
  onAddLineComment,           // Phase 27 — optional callbacks, no defaults needed
  onAddFileComment,
  onEditComment,
  onDeleteComment,
}: DiffPaneProps): React.JSX.Element {
```

---

## No Analog Found

All 10 files have analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `ui/src/code-review/`, `ui/src/reviewer-v2/`
**Files scanned:** 17 (code-review) + 22 (reviewer-v2) = 39
**Pattern extraction date:** 2026-05-25
