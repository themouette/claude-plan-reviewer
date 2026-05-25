---
phase: 27-inline-comments
plan: 3
subsystem: code-review
tags:
  - react
  - state-integration
  - badges
  - code-review
  - human-verified
status: complete
verification: human-verified
---

# Plan 27-03 Summary — CodeReviewApp state wiring + FileListPane badges

## What Was Built

**Task 1** — `FileListPane.tsx`: accepts `commentCounts: Record<string, number>` prop and renders a blue pill badge (`background: var(--color-focus)`) after the filename when `count > 0`. Zero-comment files show no badge. 33 source-text tests.

**Task 2** — `CodeReviewApp.tsx`: owns comment state via `useCodeReviewAnnotations()`, derives `commentCounts` with `useMemo([comments])`, passes `comments + onAddLineComment + onAddFileComment + onEditComment + onDeleteComment` to `DiffPane`, passes `commentCounts` to `FileListPane`. ID generation via `crypto.randomUUID()`, timestamp via `new Date().toISOString()`. 61 source-text tests.

**Task 3** — Fix pass: all 593 tests green, `tsc` exit 0.

**Task 4** — Human verification: COMMENT-01..04 confirmed working in browser.

## Bug Fixes Applied During Verification

1. **`reduceAnnotations` readonly state** (27-01 post-merge): `Object.freeze` test failed TypeScript check — `state` parameter widened to `readonly CodeReviewComment[]`.

2. **`enableGutterUtility: true` missing** (27-03): `renderGutterUtility` provides the slot content but `enableGutterUtility: true` in `options` is required to activate pointer hover tracking in `@pierre/diffs`. Without it the `+` button is never shown on line hover.

## Deferred Items (out of Phase 27 scope)

- UI polish for the gutter `+` button (GitHub-like styling with opacity transitions)
- Multi-line comment selection support

## Key Files

- `ui/src/code-review/CodeReviewApp.tsx` — state owner
- `ui/src/code-review/FileListPane.tsx` — badge rendering
- `ui/src/code-review/DiffPane.tsx` — `enableGutterUtility: true` fix
- `ui/src/code-review/hooks/useCodeReviewAnnotations.ts` — readonly state fix

## Test Results

593/593 tests passing. Human-verified COMMENT-01..04 end-to-end.

## Self-Check: PASSED
