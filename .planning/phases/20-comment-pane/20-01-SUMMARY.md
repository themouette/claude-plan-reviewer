---
phase: 20-comment-pane
plan: "01"
subsystem: frontend/types+layout
tags: [tdd, pure-function, css-highlights, annotation-types]
dependency_graph:
  requires: []
  provides:
    - "Annotation.anchorStart/anchorEnd fields (required number)"
    - "computeCommentLayout pure function (hooks/useCommentLayout.ts)"
    - "::highlight(comment-hover) CSS rule (dark + light)"
  affects:
    - "ui/src/reviewer-v2/types.ts"
    - "ui/src/reviewer-v2/useAnnotations.test.ts"
    - "ui/src/reviewer-v2/hooks/useCommentLayout.ts"
    - "ui/src/index.css"
tech_stack:
  added: []
  patterns:
    - "TDD red/green cycle for pure-function layout algorithm"
    - "CSS Highlights API ::highlight() rule pattern (dark + light variants)"
key_files:
  created:
    - ui/src/reviewer-v2/hooks/useCommentLayout.ts
    - ui/src/reviewer-v2/hooks/useCommentLayout.test.ts
  modified:
    - ui/src/reviewer-v2/types.ts
    - ui/src/reviewer-v2/useAnnotations.test.ts
    - ui/src/index.css
decisions:
  - "anchorStart/anchorEnd added as required (not optional) fields to enforce fixture updates at compile time"
  - "Algorithm verbatim from 20-RESEARCH.md Pattern 2 with COMPACT_HEIGHT=48, GAP=8, PUSH_THRESHOLD=40"
  - "CSS comment-hover rule placed immediately after existing ::highlight(annotation-hover) rule"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-21"
  tasks_completed: 3
  files_changed: 5
---

# Phase 20 Plan 01: Type Foundation and computeCommentLayout Summary

Extended the `Annotation` interface with required `anchorStart`/`anchorEnd` offset fields and implemented the pure `computeCommentLayout` greedy layout function with full TDD cycle plus `::highlight(comment-hover)` CSS rules.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend Annotation type and update fixtures | 4871355 | types.ts, useAnnotations.test.ts |
| 2 | Write failing tests for computeCommentLayout (RED) | b05df44 | hooks/useCommentLayout.test.ts |
| 3 | Implement computeCommentLayout + CSS highlight (GREEN) | 1187c79 | hooks/useCommentLayout.ts, index.css |

## What Was Built

**`ui/src/reviewer-v2/types.ts`** — `Annotation` interface extended with `anchorStart: number` and `anchorEnd: number` as required fields. Placing them as required ensures every fixture and factory in the codebase is updated at compile time (D-01 mandate).

**`ui/src/reviewer-v2/hooks/useCommentLayout.ts`** — Pure function `computeCommentLayout` implementing the greedy top-down layout algorithm from 20-RESEARCH.md Pattern 2. Constants: `COMPACT_HEIGHT=48`, `GAP=8`, `PUSH_THRESHOLD=40`. No React imports, no DOM references — directly unit-testable.

**`ui/src/reviewer-v2/hooks/useCommentLayout.test.ts`** — 5 test cases: single item (top=anchorY), overlap pushes down and marks compact (delta > PUSH_THRESHOLD=40), focused item snaps to anchorY, empty input, id preservation.

**`ui/src/index.css`** — `::highlight(comment-hover)` CSS rule added in dark and `[data-theme="light"]` variants, immediately after the existing `::highlight(annotation-hover)` rule.

## TDD Gate Compliance

- RED gate commit: `test(20-01)` b05df44 — 5 failing tests, module-not-found error confirmed
- GREEN gate commit: `feat(20-01)` 1187c79 — all 5 tests pass, full suite 143/143 green

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. All changes are additive TypeScript/CSS with no user-typed input surfaces.

## Self-Check: PASSED

- `ui/src/reviewer-v2/types.ts` exists with `anchorStart: number` and `anchorEnd: number`
- `ui/src/reviewer-v2/hooks/useCommentLayout.ts` exists with `export function computeCommentLayout`
- `ui/src/reviewer-v2/hooks/useCommentLayout.test.ts` exists with 5 test cases
- `ui/src/index.css` contains `::highlight(comment-hover)` (dark) and `[data-theme="light"] ::highlight(comment-hover)` (light)
- Commits 4871355, b05df44, 1187c79 verified in git history
- Full test suite: 16 files, 143 tests, 0 failures
