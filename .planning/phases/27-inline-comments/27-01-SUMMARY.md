---
phase: 27-inline-comments
plan: 1
subsystem: code-review
tags:
  - react
  - reducer
  - tdd
  - code-review
dependency_graph:
  requires: []
  provides:
    - "CodeReviewComment discriminated union (line|file) in ui/src/code-review/types.ts"
    - "reduceAnnotations pure function exported from ui/src/code-review/hooks/useCodeReviewAnnotations.ts"
    - "useCodeReviewAnnotations React hook exported from ui/src/code-review/hooks/useCodeReviewAnnotations.ts"
    - "CommentAction union type exported from ui/src/code-review/hooks/useCodeReviewAnnotations.ts"
  affects:
    - "Plans 27-02 and 27-03 (consume CodeReviewComment type and useCodeReviewAnnotations hook)"
tech_stack:
  added: []
  patterns:
    - "Pure reducer pattern: flat array state (not wrapped object), exported as standalone function for direct test invocation"
    - "useReducer hook wrapping a pure reducer — dispatch helpers close over stable dispatch reference"
    - "Object.freeze immutability assertion in tests"
key_files:
  created:
    - ui/src/code-review/hooks/useCodeReviewAnnotations.ts
    - ui/src/code-review/hooks/useCodeReviewAnnotations.test.ts
  modified:
    - ui/src/code-review/types.ts
decisions:
  - "Flat array state (CodeReviewComment[]) rather than wrapped object — per CONTEXT.md D-08 and PATTERNS.md critical difference note"
  - "reduceAnnotations exported as named function (not default) so tests call it directly without mounting React"
  - "useCodeReviewAnnotations dispatch helpers inline (no useCallback) — dispatch reference from useReducer is already stable in React"
metrics:
  duration: "3m"
  completed_date: "2026-05-25"
  tasks_completed: 2
  files_modified: 3
  tests_added: 7
---

# Phase 27 Plan 1: Comment Types and Reducer Summary

**One-liner:** Pure `reduceAnnotations` reducer with `CodeReviewComment` discriminated union (line|file) and `useCodeReviewAnnotations` hook — TDD foundation for Phase 27 inline comments.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add CodeReviewComment discriminated union to types.ts | 7fbc94d | ui/src/code-review/types.ts (+18 lines) |
| 2a | TDD RED: failing reducer tests | 9fe9959 | ui/src/code-review/hooks/useCodeReviewAnnotations.test.ts (created, 111 lines) |
| 2b | TDD GREEN: implement reduceAnnotations + useCodeReviewAnnotations | c98d551 | ui/src/code-review/hooks/useCodeReviewAnnotations.ts (created, 42 lines) |

## What Was Built

### `ui/src/code-review/types.ts` (modified)
Added `CodeReviewComment` discriminated union with two variants:
- `line` variant: `id`, `type: 'line'`, `file`, `side: 'additions' | 'deletions'`, `lineNumber`, `text`, `createdAt`
- `file` variant: `id`, `type: 'file'`, `file`, `text`, `createdAt` (no `side`, no `lineNumber`)

Existing `FileDiff` and `Commit` exports untouched.

### `ui/src/code-review/hooks/useCodeReviewAnnotations.ts` (new)
Exports:
- `CommentAction` union: `ADD_COMMENT | EDIT_COMMENT | DELETE_COMMENT`
- `reduceAnnotations(state: CodeReviewComment[], action: CommentAction): CodeReviewComment[]` — pure function, all branches use spread/map/filter
- `useCodeReviewAnnotations()` — `useReducer(reduceAnnotations, [])` returning `{ comments, addComment, editComment, deleteComment }`

### `ui/src/code-review/hooks/useCodeReviewAnnotations.test.ts` (new)
7 tests (+7 tests):
- Test A: ADD_COMMENT appends to empty state
- Test B: EDIT_COMMENT updates text only (id/file/type/side/lineNumber/createdAt unchanged)
- Test C: DELETE_COMMENT removes matching id
- Test D: EDIT_COMMENT with unknown id is a no-op
- Test E: DELETE_COMMENT with unknown id is a no-op
- Test F: discriminated union — line and file fixtures both compile and are distinguishable by type
- Test G: Object.freeze assertion — reducer does not mutate input

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (`test(...)`) | 9fe9959 | PASS — tests committed first, confirmed failing |
| GREEN (`feat(...)`) | c98d551 | PASS — implementation committed, 7/7 tests passing |
| REFACTOR | N/A | No refactor needed — implementation was already clean |

## Verification Results

- `npm test -- --run src/code-review/hooks/useCodeReviewAnnotations.test.ts`: 7/7 passed
- `tsc --noEmit -p ui/tsconfig.json`: exit 0 (zero errors)
- `eslint src/code-review/types.ts src/code-review/hooks/useCodeReviewAnnotations.ts src/code-review/hooks/useCodeReviewAnnotations.test.ts`: exit 0 (zero warnings)

## Downstream Readiness

Plans 27-02 and 27-03 can now:
- `import type { CodeReviewComment } from '../types'` — union type with proper narrowing
- `import { useCodeReviewAnnotations } from './hooks/useCodeReviewAnnotations'` — hook returns `{ comments, addComment, editComment, deleteComment }`
- `import { reduceAnnotations } from './hooks/useCodeReviewAnnotations'` — pure function for any additional tests

## Deviations from Plan

**Pre-existing lint errors in `CodeReviewApp.tsx` and `useDiff.ts`** — `react-hooks/set-state-in-effect` error in `CodeReviewApp.tsx:47` and an unused eslint-disable directive in `useDiff.ts:195` are pre-existing, out of scope for this plan. Logged to `deferred-items.md`.

None affecting new files — plan executed exactly as written for the three new/modified files.

## Known Stubs

None — this plan creates pure logic with no UI stubs or hardcoded placeholder values.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. Comment state is React in-memory only per T-27-02 (accepted, no serialization in this plan). Immutability requirement T-27-01 met via Object.freeze test assertion (Test G).

## Self-Check: PASSED

- [x] `ui/src/code-review/types.ts` exists and contains `export type CodeReviewComment`
- [x] `ui/src/code-review/hooks/useCodeReviewAnnotations.ts` exists and exports `reduceAnnotations`, `useCodeReviewAnnotations`, `CommentAction`
- [x] `ui/src/code-review/hooks/useCodeReviewAnnotations.test.ts` exists with 7 tests
- [x] Commits 7fbc94d, 9fe9959, c98d551 exist in git log
- [x] 7/7 tests passing
- [x] tsc exit 0
