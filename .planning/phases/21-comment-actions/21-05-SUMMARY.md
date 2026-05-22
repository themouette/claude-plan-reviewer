---
plan: 21-05
phase: 21-comment-actions
status: complete
wave: 4
gap_closure: true
completed: "2026-05-22"
requirements: [COMMENT-04, COMMENT-05, OUTLINE-04]
key-files:
  modified:
    - ui/src/reviewer-v2/CommentPane.test.ts
---

## Summary

Removed 3 stale scroll-listener tests from `CommentPane.test.ts` that asserted behaviors never present in the implementation. The tests checked for `addEventListener('scroll'`, `passive: true`, and `removeEventListener` — none of which exist in CommentPane.tsx, which uses ResizeObserver exclusively. The stale tests were written for an earlier scroll-listener design that was superseded before implementation.

## What Was Built

Deleted the 3 failing `it()` blocks (lines 17-27 in the pre-edit file) from the `CommentPane` describe block. All remaining 19 tests are intact and passing.

## Verification

- `cd ui && npm test -- --run CommentPane`: 19 passed, 0 failed
- `cd ui && npm test -- --run` (full suite): 22 test files, 312 tests, 0 failures
- `ui/src/reviewer-v2/CommentPane.tsx` is not modified

## Deviations

None.

## Self-Check: PASSED

All acceptance criteria met:
- ✓ `CommentPane.test.ts` does NOT contain `addEventListener('scroll'`
- ✓ `CommentPane.test.ts` does NOT contain `passive: true`
- ✓ `CommentPane.test.ts` does NOT contain `removeEventListener`
- ✓ `CommentPane.test.ts` still contains `ResizeObserver` and `.disconnect()`
- ✓ Full vitest suite exits 0 with 0 failed tests
- ✓ CommentPane.tsx not modified
