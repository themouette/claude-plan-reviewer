---
phase: 18-content-pane
plan: 01
subsystem: frontend/reviewer-v2
tags: [typescript, react, hooks, markdown, highlight.js, tdd]
dependency_graph:
  requires: [17-foundation-isolation]
  provides:
    - ui/src/reviewer-v2/hooks/useTextSelection.ts
    - ui/src/reviewer-v2/utils/markdownRenderer.ts
  affects:
    - ui/src/reviewer-v2/ (utility modules consumed by Plans 02 and 03)
tech_stack:
  added: []
  patterns:
    - "Module-level configured flag for idempotent marked.use() registration"
    - "TDD cycle: RED commit (test), GREEN commit (implementation), no REFACTOR needed"
key_files:
  created:
    - ui/src/reviewer-v2/hooks/useTextSelection.ts
    - ui/src/reviewer-v2/hooks/useTextSelection.test.ts
    - ui/src/reviewer-v2/utils/markdownRenderer.ts
    - ui/src/reviewer-v2/utils/markdownRenderer.test.ts
  modified:
    - ui/vitest.setup.ts
decisions:
  - "Copy useTextSelection verbatim from ui/src/hooks/ — zero behavioral drift, verified by diff"
  - "Highlight constructor mock added to vitest.setup.ts (jsdom omission; Rule 2 auto-add)"
  - "Module-level configured guard instead of React.useRef because markdownRenderer is not a hook"
metrics:
  duration: "4m"
  completed: "2026-05-20T07:40:42Z"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 18 Plan 01: reviewer-v2 Utility Modules (useTextSelection + markdownRenderer) Summary

Established the v2 reviewer's local copies of the text-selection hook and the GFM markdown renderer under the `reviewer-v2/` isolation boundary, satisfying the Phase 17 ESLint `no-restricted-imports` rule that blocks any `../` import from within `reviewer-v2/`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Failing test for useTextSelection v2 hook | ad4ba0e | ui/src/reviewer-v2/hooks/useTextSelection.test.ts |
| 1 GREEN | Copy useTextSelection into reviewer-v2/hooks/ | c2ab522 | ui/src/reviewer-v2/hooks/useTextSelection.ts, ui/vitest.setup.ts |
| 2 RED | Failing test for markdownRenderer v2 utility | c07cff9 | ui/src/reviewer-v2/utils/markdownRenderer.test.ts |
| 2 GREEN | Create markdownRenderer with GFM + highlight.js | 7fffa8d | ui/src/reviewer-v2/utils/markdownRenderer.ts |

## Verification Results

- `npx vitest run` — 73 tests passed (10 test files), 0 failures
- `npm run lint` — 0 errors, 3 pre-existing warnings in App.tsx (unrelated)
- `npx tsc -b --noEmit` — clean
- Task 1 acceptance criteria: all 6 checks passed
- Task 2 acceptance criteria: all 9 checks passed

## Deviations from Plan

### Auto-added Missing Infrastructure

**1. [Rule 2 - Missing Critical Functionality] Added Highlight constructor mock to vitest.setup.ts**
- **Found during:** Task 1 GREEN phase — test `CSS.highlights.set('selection-lock', new Highlight(range))` threw `ReferenceError: Highlight is not defined`
- **Issue:** jsdom does not implement the CSS Custom Highlight API's `Highlight` constructor; only `CSS.highlights` (a Map) was mocked, not the `Highlight` class itself
- **Fix:** Added a minimal `Highlight` class mock to `ui/vitest.setup.ts` that stores `ranges` passed to the constructor
- **Files modified:** ui/vitest.setup.ts
- **Commit:** c2ab522

## TDD Gate Compliance

- RED gate (test commits): ad4ba0e (Task 1), c07cff9 (Task 2)
- GREEN gate (impl commits): c2ab522 (Task 1), 7fffa8d (Task 2)
- Both RED → GREEN sequences preserved in git history

## Known Stubs

None — both modules are fully wired. `renderMarkdown` produces live GFM HTML output from `marked`; `useTextSelection` is a functional React hook. No placeholder values or TODO stubs.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All surface is browser-local (DOM reads, CSS Highlight API). Threat register from the plan covers the relevant items (T-18-02: selection container guard preserved verbatim; T-18-03: configured flag mitigates DoS from repeated marked.use() calls).

## Self-Check: PASSED
