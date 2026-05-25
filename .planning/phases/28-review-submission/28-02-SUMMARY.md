---
phase: 28-review-submission
plan: 02
subsystem: ui
tags: [typescript, vitest, tdd, serializer, code-review, json]

# Dependency graph
requires:
  - phase: 28-review-submission
    plan: 01
    provides: "ui/src/shared/connectivity.ts with ConnectivityStatus type"
provides:
  - "ui/src/code-review/buildCodeReviewPayload.ts — D-01 pure JSON serializer"
  - "ui/src/code-review/buildCodeReviewPayload.test.ts — 10 Vitest assertions"
affects:
  - 28-03-PLAN (imports buildCodeReviewPayload + shouldUseClipboard from this module)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure serializer with explicit omit semantics (conditional key assignment vs null)"
    - "TDD RED/GREEN with module-not-found as RED trigger for pure TypeScript modules"

key-files:
  created:
    - "ui/src/code-review/buildCodeReviewPayload.ts (exports: buildCodeReviewPayload, shouldUseClipboard, ReviewDecision)"
    - "ui/src/code-review/buildCodeReviewPayload.test.ts (10 Vitest it() cases)"

key-decisions:
  - "endLine chosen as JSON key for line-range upper bound (not endLineNumber) — documented in source comment"
  - "Comments key entirely omitted when list is empty (not emitted as [])"
  - "global_instruction entirely omitted when blank/whitespace-only (not emitted as null)"

patterns-established:
  - "Conditional key assignment pattern for omit-when-empty: assign key only when truthy"

requirements-completed: [SUBMIT-01, SUBMIT-02, SUBMIT-03]

# Metrics
duration: 2min
completed: 2026-05-25
---

# Phase 28 Plan 02: buildCodeReviewPayload Pure Serializer (TDD)

**TDD implementation of D-01 JSON payload serializer with 10 Vitest assertions covering all edge cases: empty approval, global_instruction trim/omit, line/file comment field mapping, endLine naming, and mixed comment lists**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-25T20:40:59Z
- **Completed:** 2026-05-25T20:43:00Z
- **Tasks:** 2 (RED + GREEN)
- **Files created:** 2

## Accomplishments

- RED: Created `buildCodeReviewPayload.test.ts` with 10 failing `it()` cases covering all D-01 edge cases
- GREEN: Implemented `buildCodeReviewPayload.ts` — all 10 assertions pass
- TypeScript strict check passes (`npx tsc --noEmit` exits 0)
- ESLint clean on both new files (no reviewer-v2 imports, no violations)
- No REFACTOR step required (function is sufficiently small and clean as implemented)

## Exports from buildCodeReviewPayload.ts

- `ReviewDecision` — union type `'approved' | 'changes_requested'`
- `buildCodeReviewPayload(decision, comments, globalInstruction?)` — pure D-01 JSON serializer
- `shouldUseClipboard(status: ConnectivityStatus)` — returns `status === 'offline'`

## Key Design Choices

**Chosen field name for line-range upper bound:** `endLine` (NOT `endLineNumber`)
- Documented in source with comment: "Field name chosen: endLine (not endLineNumber) — matches D-01 'Claude's-discretion' note in CONTEXT.md"
- Plan 28-03 must use `endLine` consistently when reading from the serialized output

**shouldUseClipboard location:** Exported from `buildCodeReviewPayload.ts` alongside the serializer. Plan 28-03 imports it from one place: `import { buildCodeReviewPayload, shouldUseClipboard } from './buildCodeReviewPayload'`

## Task Commits

1. **RED — failing tests:** `2ba6035` (test)
2. **GREEN — implementation:** `dbcf78c` (feat)

## Files Created

- `ui/src/code-review/buildCodeReviewPayload.ts` — 83 lines
- `ui/src/code-review/buildCodeReviewPayload.test.ts` — 121 lines

## Deviations from Plan

None — plan executed exactly as written.

The pre-existing lint errors in `CodeReviewApp.tsx` (react-hooks/set-state-in-effect) and `useDiff.ts` (unused eslint-disable directive) are out of scope per deviation boundary rule. They existed before this plan and are not caused by these changes.

## TDD Gate Compliance

- RED commit exists: `2ba6035` (test(28-02): add failing tests...)
- GREEN commit exists: `dbcf78c` (feat(28-02): implement...)
- Gate sequence: RED → GREEN confirmed in git log

## Self-Check: PASSED

- `ui/src/code-review/buildCodeReviewPayload.ts` exists
- `ui/src/code-review/buildCodeReviewPayload.test.ts` exists
- RED commit `2ba6035` in git history
- GREEN commit `dbcf78c` in git history
- 10 Vitest assertions pass
- No reviewer-v2 imports in either file
