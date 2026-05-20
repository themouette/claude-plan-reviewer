---
phase: 18-content-pane
plan: 03
subsystem: frontend/reviewer-v2
tags: [typescript, react, components, tdd, markdown, fetch, hover, selection]
dependency_graph:
  requires:
    - phase: 18-01
      provides: ui/src/reviewer-v2/hooks/useTextSelection.ts, ui/src/reviewer-v2/utils/markdownRenderer.ts
    - phase: 18-02
      provides: ui/src/reviewer-v2/GutterIcon.tsx, ui/src/reviewer-v2/SelectionToolbar.tsx
  provides:
    - ui/src/reviewer-v2/PlanContent.tsx
    - ui/src/reviewer-v2/ContentPane.tsx
    - ui/src/reviewer-v2/PlanContent.test.ts
    - ui/src/reviewer-v2/ContentPane.test.ts
  affects:
    - ui/src/reviewer-v2/ReviewerV2Shell.tsx (ContentPane mounted in <main>)
    - ui/src/reviewer-v2/ReviewerV2.tsx (highlight.js import added)
    - ui/src/index.css (.paragraph-hovered class hook added)
tech_stack:
  added: []
  patterns:
    - "TDD source-assertion: readFileSync + expect(source).toContain() tests structural invariants without jsdom rendering"
    - "Imperative DOM style mutation inside useEffect with eslint-disable react-hooks/immutability"
    - "eslint-disable @typescript-eslint/no-unused-vars for Phase 21 stub params prefixed with underscore"
    - "Inline getOffsets() call for synchronous selection snapshot (simpler than useLayoutEffect for position:fixed toolbar)"
key_files:
  created:
    - ui/src/reviewer-v2/PlanContent.tsx
    - ui/src/reviewer-v2/PlanContent.test.ts
    - ui/src/reviewer-v2/ContentPane.tsx
    - ui/src/reviewer-v2/ContentPane.test.ts
  modified:
    - ui/src/reviewer-v2/ReviewerV2Shell.tsx
    - ui/src/reviewer-v2/ReviewerV2.tsx
    - ui/src/index.css
decisions:
  - "eslint-disable react-hooks/immutability for useEffect that imperatively mutates paragraph HTMLElement.style — same pattern as App.tsx DOM imperative mutations"
  - "eslint-disable @typescript-eslint/no-unused-vars for handleAction stub params — Phase 21 will replace the stub body"
  - "Inline getOffsets() over useLayoutEffect — position:fixed toolbar does not need scroll-offset math; simpler sync snapshot is correct"
  - "Worktree node_modules symlinked from main repo for test execution — worktree created from v0.5.0 release had no node_modules"
metrics:
  duration: "5m"
  completed: "2026-05-20T07:59:42Z"
  tasks_completed: 2
  files_created: 4
  files_modified: 3
---

# Phase 18 Plan 03: PlanContent + ContentPane End-to-End Wire Summary

PlanContent (markdown host with paragraph-hover event delegation) and ContentPane (fetch + selection orchestration container) created and wired into ReviewerV2Shell, replacing the center-column placeholder span and making the /v2 route functionally complete.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Failing tests for PlanContent source contract | f4a9f68 | ui/src/reviewer-v2/PlanContent.test.ts |
| 1 GREEN | PlanContent implementation + index.css hover class | 89fa1c9 | ui/src/reviewer-v2/PlanContent.tsx, ui/src/index.css |
| 2 RED | Failing tests for ContentPane source contract | fc208f1 | ui/src/reviewer-v2/ContentPane.test.ts |
| 2 GREEN | ContentPane + ReviewerV2Shell + ReviewerV2 wired | 8f624fe | ui/src/reviewer-v2/ContentPane.tsx, ui/src/reviewer-v2/ReviewerV2Shell.tsx, ui/src/reviewer-v2/ReviewerV2.tsx |

## Verification Results

- `npx vitest run src/reviewer-v2/PlanContent.test.ts` — 6 tests passed
- `npx vitest run src/reviewer-v2/ContentPane.test.ts` — 8 tests passed
- `npm test -- --run` — 97 tests passed (14 test files), 0 failures
- `npm run lint` — 0 errors, 3 pre-existing warnings in App.tsx (lines 956, 1009, 1081)
- `npx tsc -b --noEmit` — clean (0 errors)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added eslint-disable react-hooks/immutability for PlanContent useEffect**
- **Found during:** Task 1 GREEN lint check
- **Issue:** The `react-hooks/immutability` rule fired on `hoveredParagraph.style.background = ...` inside useEffect, treating the `useState` value as immutable React state rather than a live HTMLElement DOM reference
- **Fix:** Added `/* eslint-disable react-hooks/immutability */` / `/* eslint-enable */` block wrapping the useEffect. The pattern is intentional: hoveredParagraph is a raw DOM element whose `.style` property is correctly mutated imperatively (same pattern as App.tsx)
- **Files modified:** ui/src/reviewer-v2/PlanContent.tsx
- **Committed in:** 89fa1c9

**2. [Rule 1 - Bug] Added eslint-disable @typescript-eslint/no-unused-vars for ContentPane handleAction stub**
- **Found during:** Task 2 GREEN lint check
- **Issue:** The plan specified using underscore-prefixed params (`_type`, `_anchorText`, `_prefill`) to suppress `no-unused-vars`, but the TypeScript ESLint rule in this project is configured at severity 2 with default options that do NOT configure `argsIgnorePattern` for underscores
- **Fix:** Added `// eslint-disable-next-line @typescript-eslint/no-unused-vars` before the `handleAction` function definition
- **Files modified:** ui/src/reviewer-v2/ContentPane.tsx
- **Committed in:** 8f624fe

**3. [Rule 3 - Blocking Issue] Symlinked node_modules from main repo into worktree**
- **Found during:** Task 1 RED test execution
- **Issue:** The worktree branch was created from the v0.5.0 release commit and the worktree's `ui/` directory had no `node_modules/` — vitest failed with `Cannot find package 'vitest'`
- **Fix:** `ln -s /path/to/main/repo/ui/node_modules ui/node_modules` — the symlink is ignored by .gitignore (node_modules is gitignored)
- **Files modified:** none (symlink only, not tracked)

## TDD Gate Compliance

- RED gate (test commits): f4a9f68 (Task 1), fc208f1 (Task 2)
- GREEN gate (impl commits): 89fa1c9 (Task 1), 8f624fe (Task 2)
- Both RED → GREEN sequences preserved in git history

## Known Stubs

The following stubs are intentional Phase 21 hook points, documented per plan:

| Stub | File | Line | Reason |
|------|------|------|--------|
| `handleAction(_type, _anchorText, _prefill) { resetTextSelection() }` | ContentPane.tsx | ~37 | Phase 21 will replace with real annotation dispatch to useAnnotations reducer |
| `handleAdd() { resetTextSelection() }` | ContentPane.tsx | ~43 | Phase 21 will wire gutter-icon click to annotation creation flow |

Both stubs visibly conclude user actions (selection clears) even though no annotation is persisted. This is per the must_haves truth: "Toolbar clicks fire the onAction callback with the selected text (the selection is not cleared by mousedown); annotation persistence is Phase 21."

## Threat Surface Scan

No new network endpoints beyond the existing GET /api/plan (already in App.tsx). No new auth paths, file access patterns, or schema changes. Threat register mitigations confirmed:

- T-18-09 (target.closest matches outside planRef): mitigated — `planRef.current?.contains(para)` guard present in PlanContent.tsx handleMouseMove
- T-18-13 (imperative style mutation leaks): mitigated — useEffect cleanup resets all three style properties to empty strings

## Self-Check: PASSED
