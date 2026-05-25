---
phase: 27-inline-comments
plan: 2
subsystem: code-review
tags:
  - react
  - pierre-diffs
  - code-review
  - inline-comments
  - tdd
dependency_graph:
  requires:
    - "CodeReviewComment discriminated union from ui/src/code-review/types.ts (plan 27-01)"
  provides:
    - "HunkCommentForm component — inline textarea form (textarea + Submit + Dismiss)"
    - "CommentBubble component — inline submitted comment card with edit/delete and edit-mode form reuse"
    - "DiffPane wired with lineAnnotations + renderAnnotation + renderGutterUtility on FileDiffComponent"
    - "DiffPaneProps Phase 27 additions: comments, onAddLineComment, onAddFileComment, onEditComment, onDeleteComment"
  affects:
    - "Plan 27-03 (consumes DiffPaneProps additions, HunkCommentForm + CommentBubble via DiffPane)"
    - "CodeReviewApp.tsx (call site; no breakage — all new props are optional)"
tech_stack:
  added: []
  patterns:
    - "Source-text test pattern: readFileSync + toContain assertions, no @testing-library/react"
    - "TDD RED/GREEN cycle for both new components"
    - "DiffLineAnnotation<{commentId}> indirection: annotations carry commentId, renderAnnotation looks up full comment"
    - "pendingLineAnchor DiffPane-local state (Pattern 4 Option A) — CodeReviewApp.comments stays clean of transient state"
    - "Pending sentinel __pending__ inserted into lineAnnotations; renderAnnotation renders HunkCommentForm for it"
    - "getHoveredLine() called inside click handler, never at render time (Pitfall 3 mitigation)"
    - "PatchDiff path receives no lineAnnotations (Pitfall 2 mitigation)"
key_files:
  created:
    - ui/src/code-review/HunkCommentForm.tsx
    - ui/src/code-review/HunkCommentForm.test.ts
    - ui/src/code-review/CommentBubble.tsx
    - ui/src/code-review/CommentBubble.test.ts
  modified:
    - ui/src/code-review/DiffPane.tsx
    - ui/src/code-review/DiffPane.test.ts
decisions:
  - "HunkCommentForm uses defaultValue (uncontrolled textarea) + useRef to read value on submit — no controlled state"
  - "CommentBubble manages own editing state locally via useState(false) — no prop drilling for edit mode"
  - "DiffPane.tsx FileDiffRenderer extended in-place with new params — not refactored to a separate hook"
  - "File-level comments render as plain array map (no useMemo) — comment counts per file are small"
metrics:
  duration: "8m"
  completed_date: "2026-05-25"
  tasks_completed: 3
  files_modified: 6
  tests_added: 90
---

# Phase 27 Plan 2: Inline Comment Components and DiffPane Wiring Summary

**One-liner:** HunkCommentForm + CommentBubble inline components wired into DiffPane via @pierre/diffs `lineAnnotations` + `renderAnnotation` + `renderGutterUtility` API, with file-level `+ Comment` trigger and pending state management.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1a | TDD RED: failing HunkCommentForm source-text tests | 8657359 | ui/src/code-review/HunkCommentForm.test.ts (created, 81 lines) |
| 1b | TDD GREEN: implement HunkCommentForm | 5440142 | ui/src/code-review/HunkCommentForm.tsx (created, 112 lines) |
| 2a | TDD RED: failing CommentBubble source-text tests | 59e0aaf | ui/src/code-review/CommentBubble.test.ts (created, 96 lines) |
| 2b | TDD GREEN: implement CommentBubble | 552a209 | ui/src/code-review/CommentBubble.tsx (created, 133 lines) |
| 3 | Wire DiffPane with annotation API + file-level comment support | 241b30f | ui/src/code-review/DiffPane.tsx (+170 lines), DiffPane.test.ts (+68 lines) |

## What Was Built

### `ui/src/code-review/HunkCommentForm.tsx` (new, 112 lines)
Inline textarea form (GitHub-style — no position:fixed, no overlay):
- Container: `<div role="group" aria-label="Add a comment">`, background `var(--color-surface)`, border, borderRadius 6, padding 8
- Textarea: `aria-label="Comment text"`, autoFocus, `placeholder="Add a comment…"`, minHeight 64, resize vertical, `fontFamily: 'inherit'`, `fontSize: 14`, CSS token colors
- Keyboard contract: Cmd+Enter/Ctrl+Enter → submit; Escape → cancel
- Buttons row (flex-end, gap 8): Dismiss (cancelLabel, transparent, text-secondary) and Add Comment (submitLabel, color-focus bg, white text)
- `onMouseDown={(e) => e.preventDefault()}` on both buttons to prevent textarea blur
- No `document.addEventListener` click-outside listener
- No import from `reviewer-v2/`
- Props: `{ initialText?, onSubmit, onCancel, submitLabel?, cancelLabel? }`

### `ui/src/code-review/CommentBubble.tsx` (new, 133 lines)
Inline submitted comment card:
- `<article aria-label="Comment on line N">` (line) or `<article aria-label="Comment on file">` (file)
- Always-visible left accent border: `borderLeft: '3px solid var(--color-focus)'`
- Display mode: `<p>` for comment.text + `<span>` for `new Date(comment.createdAt).toLocaleString()`
- Footer row: edit (✎, className=bubble-icon-btn, aria-label="Edit comment") + delete (×, aria-label="Delete comment") icon buttons
- Edit mode: delegates to `<HunkCommentForm submitLabel="Save Changes" cancelLabel="Discard Changes" />`, keeping the article wrapper intact
- Local `useState(false)` for edit toggle — no prop drilling
- No `position: 'absolute'`, no `isCompact`/`isFocused`/`isHovered` props
- No import from `reviewer-v2/`, no `dangerouslySetInnerHTML` (T-27-02-XSS mitigation)

### `ui/src/code-review/DiffPane.tsx` (modified, lines ~18 → ~620)
Phase 27 wiring:

**A. Imports added:**
- `import type { DiffLineAnnotation, AnnotationSide } from '@pierre/diffs'`
- `import type { CodeReviewComment } from './types'` (extended)
- `import HunkCommentForm from './HunkCommentForm'`
- `import CommentBubble from './CommentBubble'`

**B. DiffPaneProps additions (all optional):**
```typescript
comments?: CodeReviewComment[]
onAddLineComment?: (file: string, lineNumber: number, side: 'additions' | 'deletions', text: string) => void
onAddFileComment?: (file: string, text: string) => void
onEditComment?: (id: string, text: string) => void
onDeleteComment?: (id: string) => void
```

**C. Local state in DiffPane:**
```typescript
const [pendingLineAnchor, setPendingLineAnchor] = useState<{ file: string; lineNumber: number; side: AnnotationSide } | null>(null)
const [pendingFileComment, setPendingFileComment] = useState<string | null>(null)
```

**D. FileDiffRenderer extended (non-partial path):**
- Builds `lineAnnotations` from submitted line comments + pending sentinel
- `renderAnnotation`: HunkCommentForm for `__pending__`; CommentBubble for submitted (null-guard on stale — T-27-02-STALE mitigation)
- `renderGutterUtility`: `+` button (aria-label="Add comment to this line", 20×20) calls `getHoveredLine()` in click handler with null guard (T-27-02-HOVER mitigation)

**E. PatchDiff path unchanged (no lineAnnotations — Pitfall 2 / T-27-02-PARTIAL mitigation)**

**F. File header additions:**
- `+ Comment` button (aria-label="Add file-level comment", height 24, ghost border style, `e.stopPropagation()`)

**G. File body additions (before diff, after header):**
- File-level submitted comments rendered as `<CommentBubble>` per file
- `pendingFileComment === file.filename` renders `<HunkCommentForm>` above diff body

### `ui/src/code-review/DiffPane.test.ts` (modified)
18 new Phase 27 assertions added; 33 existing assertions preserved → 51 total.

## Test Results

| File | Tests | Status |
|------|-------|--------|
| HunkCommentForm.test.ts | 18/18 | PASSED |
| CommentBubble.test.ts | 21/21 | PASSED |
| DiffPane.test.ts | 51/51 (33 old + 18 new) | PASSED |
| Full test suite | 572/572 (31 files) | PASSED |
| TypeScript | exit 0 | PASSED |
| ESLint (new files only) | exit 0 | PASSED |

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED - HunkCommentForm (`test(...)`) | 8657359 | PASS |
| GREEN - HunkCommentForm (`feat(...)`) | 5440142 | PASS |
| RED - CommentBubble (`test(...)`) | 59e0aaf | PASS |
| GREEN - CommentBubble (`feat(...)`) | 552a209 | PASS |

## Downstream Contracts (for Plan 27-03)

Plan 27-03 can now:
- Import `HunkCommentForm` from `./HunkCommentForm` — props: `{ initialText?, onSubmit, onCancel, submitLabel?, cancelLabel? }`
- Import `CommentBubble` from `./CommentBubble` — props: `{ comment: CodeReviewComment, onEdit, onDelete }`
- Pass Phase 27 optional props to `<DiffPane>`:
  - `comments={comments}` — `CodeReviewComment[]` from `useCodeReviewAnnotations`
  - `onAddLineComment={(file, lineNumber, side, text) => addComment({...})}` — creates line comment
  - `onAddFileComment={(file, text) => addComment({...})}` — creates file comment
  - `onEditComment={(id, text) => editComment(id, text)}`
  - `onDeleteComment={(id) => deleteComment(id)}`

## Verification Results

- `npm test -- --run src/code-review/HunkCommentForm.test.ts`: 18/18 passed
- `npm test -- --run src/code-review/CommentBubble.test.ts`: 21/21 passed
- `npm test -- --run src/code-review/DiffPane.test.ts`: 51/51 passed (33 old + 18 new)
- `npm test` (full suite): 572/572 passed
- `npx tsc --noEmit -p .`: exit 0
- `eslint` (new files): exit 0 (pre-existing errors in CodeReviewApp.tsx and useDiff.ts are out of scope)

## Deviations from Plan

None — plan executed exactly as written.

Pre-existing lint errors in `CodeReviewApp.tsx:47` (`react-hooks/set-state-in-effect`) and `useDiff.ts:195` (unused eslint-disable) are pre-existing and out of scope (documented in 27-01 SUMMARY). All new files pass ESLint cleanly.

## Known Stubs

None. HunkCommentForm and CommentBubble are fully functional components. DiffPane wiring passes all new assertions. The optional props default to no-op (`comments=[]`, callbacks=`undefined`) until plan 27-03 wires them into `CodeReviewApp`.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

Threat mitigations implemented per threat model:

| Threat ID | Mitigation Applied |
|-----------|---------------------|
| T-27-02-XSS | `comment.text` rendered as React text content (`{comment.text}` in `<p>`); no `dangerouslySetInnerHTML`; verified by `grep` |
| T-27-02-PARTIAL | `PatchDiff` path left unchanged, receives no `lineAnnotations`; verified by DiffPane test assertion |
| T-27-02-STALE | `renderAnnotation` null-guards with `if (!c \|\| c.type !== 'line') return null` before rendering CommentBubble |
| T-27-02-HOVER | Click handler guards: `const hovered = getHoveredLine(); if (!hovered) return` |
| T-27-SC | Zero new npm packages installed |

## Self-Check: PASSED

- [x] `ui/src/code-review/HunkCommentForm.tsx` exists with `export default function HunkCommentForm`
- [x] `ui/src/code-review/HunkCommentForm.test.ts` exists with 18 tests (81 lines)
- [x] `ui/src/code-review/CommentBubble.tsx` exists with `export default function CommentBubble`
- [x] `ui/src/code-review/CommentBubble.test.ts` exists with 21 tests (96 lines)
- [x] `ui/src/code-review/DiffPane.tsx` contains `lineAnnotations`, `renderAnnotation`, `renderGutterUtility`, `HunkCommentForm`, `CommentBubble`
- [x] `ui/src/code-review/DiffPane.test.ts` has 51 passing tests (18 new Phase 27 + 33 existing)
- [x] Commits 8657359, 5440142, 59e0aaf, 552a209, 241b30f exist in git log
- [x] 572/572 tests passing
- [x] tsc exit 0
