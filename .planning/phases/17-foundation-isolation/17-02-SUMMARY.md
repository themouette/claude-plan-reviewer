---
phase: 17-foundation-isolation
plan: "02"
subsystem: ui
tags:
  - reviewer-v2
  - isolation
  - heartbeat
  - annotations
  - useReducer
  - subtree
  - react
  - typescript

dependency_graph:
  requires:
    - phase: 17-foundation-isolation
      plan: "01"
      provides: jsdom test environment and ESLint no-restricted-imports coupling rule
  provides:
    - ui/src/reviewer-v2/types.ts — minimal Annotation interface + AnnotationAction discriminated union
    - ui/src/reviewer-v2/connectivity.ts — v2-owned ConnectivityStatus state machine
    - ui/src/reviewer-v2/serializeAnnotations.ts — feedback serializer (replacement field defaulted to '')
    - ui/src/reviewer-v2/offlineLabels.ts — buildClipboardPayload + shouldUseClipboard (no banner constants)
    - ui/src/reviewer-v2/useHeartbeat.ts — v2-independent heartbeat poller satisfying ARCH-02
    - ui/src/reviewer-v2/useAnnotations.ts — pure annotationReducer + useAnnotations hook per D-09/D-10
    - Tests covering connectivity state machine, offlineLabels, annotationReducer, and heartbeat smoke test
  affects:
    - 17-03 (imports useHeartbeat and useAnnotations from this subtree to build ReviewerV2.tsx)

tech_stack:
  added: []
  patterns:
    - "Exported pure reducer + hook wrapper: annotationReducer(state, action) exported for direct testing; useAnnotations hook wraps useReducer"
    - "Dependency-injected runHeartbeatTick: exported for unit tests; hook wires real fetch/refs"
    - "Flat v2 subtree layout: all files at ui/src/reviewer-v2/ root to avoid ESLint ../  coupling rule"

key_files:
  created:
    - ui/src/reviewer-v2/types.ts
    - ui/src/reviewer-v2/connectivity.ts
    - ui/src/reviewer-v2/connectivity.test.ts
    - ui/src/reviewer-v2/serializeAnnotations.ts
    - ui/src/reviewer-v2/offlineLabels.ts
    - ui/src/reviewer-v2/offlineLabels.test.ts
    - ui/src/reviewer-v2/useHeartbeat.ts
    - ui/src/reviewer-v2/useHeartbeat.test.ts
    - ui/src/reviewer-v2/useAnnotations.ts
    - ui/src/reviewer-v2/useAnnotations.test.ts
  modified: []

key_decisions:
  - "Flat v2 subtree layout adopted — files placed at ui/src/reviewer-v2/ root instead of utils/ and hooks/ subdirectories; ESLint no-restricted-imports blocks literal '../' strings, so subdirectory files importing '../types' would be flagged even though the path resolves within the subtree"
  - "v2 Annotation type omits replacement field per D-11; serializeAnnotations replace branch defaults to (a.replacement ?? '') via optional cast to avoid TypeScript strict mode errors"
  - "annotationReducer exported as pure function; useAnnotations hook wraps useReducer — same DI pattern as v1 connectivity/useHeartbeat tests require no @testing-library/react"

patterns_established:
  - "v2 subtree isolation: zero '../' imports; all intra-subtree references use './X' form"
  - "Pure reducer + hook wrapper: pure function exported at module level for DI-testable behavior"

requirements_completed:
  - ARCH-01
  - ARCH-02

metrics:
  duration: "8min"
  completed_date: "2026-05-20"
  tasks_completed: 2
  tasks_total: 2
  files_created: 10
  files_modified: 0
---

# Phase 17 Plan 02: Scaffold v2 Subtree (utilities, hooks, tests) Summary

**v2 subtree fully scaffolded with isolated connectivity state machine, serializeAnnotations, offlineLabels, independent useHeartbeat poller, and pure annotationReducer hook — zero `../` imports, all 61 tests pass**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-20T07:14:00Z
- **Completed:** 2026-05-20T07:18:30Z
- **Tasks:** 2 completed
- **Files modified:** 10 created, 0 modified

## Accomplishments

- Scaffolded the complete `ui/src/reviewer-v2/` subtree as a self-contained module with flat layout
- v2 has its own `useHeartbeat` (independent poller, ARCH-02 satisfied) repointed to local `./connectivity`
- `annotationReducer` is a pure exported function covering add/edit/remove with missing-id edge cases
- ESLint coupling rule from Plan 01 validates zero `../` imports on all 10 new files
- Total test count: 46 (pre-existing) + 15 new = 61 passing

## Task Commits

1. **Task 1: Copy connectivity, serializeAnnotations, offlineLabels into the v2 subtree** - `451dbbd` (feat)
2. **Task 2: Copy useHeartbeat into v2 and create useAnnotations reducer hook with tests** - `d0581c7` (feat)

## Files Created/Modified

- `ui/src/reviewer-v2/types.ts` — minimal Annotation interface (no replacement field) + AnnotationAction discriminated union
- `ui/src/reviewer-v2/connectivity.ts` — verbatim copy of v1 connectivity state machine (no imports to repoint)
- `ui/src/reviewer-v2/connectivity.test.ts` — 5 tests mirroring v1 connectivity suite
- `ui/src/reviewer-v2/serializeAnnotations.ts` — copy with `(a.replacement ?? '')` optional cast for v2 Annotation
- `ui/src/reviewer-v2/offlineLabels.ts` — partial copy: only buildClipboardPayload + shouldUseClipboard; no banner constants
- `ui/src/reviewer-v2/offlineLabels.test.ts` — 4 tests covering allow payload, deny payload with annotation, shouldUseClipboard
- `ui/src/reviewer-v2/useHeartbeat.ts` — verbatim copy of v1 with `from './connectivity'` import; exports runHeartbeatTick
- `ui/src/reviewer-v2/useHeartbeat.test.ts` — 1 smoke test: successful fetch keeps status online without calling onStatus
- `ui/src/reviewer-v2/useAnnotations.ts` — pure annotationReducer + useAnnotations hook
- `ui/src/reviewer-v2/useAnnotations.test.ts` — 5 tests: add / add+edit / add+remove / edit-missing / remove-missing

## Decisions Made

1. **Flat v2 subtree layout** — adopted to satisfy the ESLint `no-restricted-imports` rule that blocks any `../` import literally (not resolved-path semantics). Files placed at `ui/src/reviewer-v2/` root instead of `utils/` and `hooks/` subdirectories as in the frontmatter default. D-04 grants discretion over subdirectory structure.

2. **v2 Annotation omits `replacement` field** — per D-11/RESEARCH A2. `serializeAnnotations.ts` casts the annotation as `Annotation & { replacement?: string }` to default missing values to `''` without breaking TypeScript strict mode.

3. **offlineLabels partial copy** — only `ClipboardDecision`, `buildClipboardPayload`, and `shouldUseClipboard` copied. Banner constants (`OFFLINE_BANNER_LINE_*`) and label helpers belong to v1 banner UI and are not needed in v2 per CONTEXT D-04.

## Deviations from Plan

### Layout Adjustment (Rule 2 — ARCH-01 compliance)

**Flat layout instead of `utils/` and `hooks/` subdirectories**

- **Found during:** Task 1 planning (plan action section line 210+)
- **Issue:** ESLint `no-restricted-imports` with `group: ['../**']` matches literal import strings, not resolved paths. A file in `utils/` importing `../types` would be flagged even though it resolves to `src/reviewer-v2/types.ts` (inside the subtree).
- **Fix:** Adopted flat layout — all files at `ui/src/reviewer-v2/` root so all internal imports use `'./X'` form.
- **Files modified:** Layout choice applies to all 10 created files.
- **The plan's own action section explicitly recommended this layout** — this was anticipated and instructed, not a surprise.

---

**Total deviations:** 1 layout adjustment (pre-specified by plan action section as recommended approach)
**Impact on plan:** Zero functional impact. Flat layout was the plan's own recommendation to satisfy the coupling rule.

## Issues Encountered

- `node_modules` not present in worktree `ui/` directory — ran `npm install` to install dependencies before running lint/test. No impact on plan outcome.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 17-03 can proceed: `useHeartbeat` and `useAnnotations` are importable from `'./useHeartbeat'` and `'./useAnnotations'` inside `src/reviewer-v2/` for use in `ReviewerV2.tsx`
- ARCH-01 is mechanically enforced: ESLint coupling rule catches any `../` escape from the subtree
- ARCH-02 satisfied: both `ui/src/hooks/useHeartbeat.ts` and `ui/src/reviewer-v2/useHeartbeat.ts` independently poll `/api/ping`

## Threat Flags

No new security-relevant surface introduced. All changes are TypeScript source files within the existing `ui/` module. The v2 heartbeat poller shares the existing `/api/ping` endpoint (stateless, loopback-only) with no new attack surface.

## Self-Check: PASSED

- `ui/src/reviewer-v2/types.ts` exists: confirmed
- `ui/src/reviewer-v2/connectivity.ts` exists: confirmed
- `ui/src/reviewer-v2/serializeAnnotations.ts` exists: confirmed
- `ui/src/reviewer-v2/offlineLabels.ts` exists: confirmed
- `ui/src/reviewer-v2/useHeartbeat.ts` exists: confirmed
- `ui/src/reviewer-v2/useAnnotations.ts` exists: confirmed
- All test files exist: confirmed (4 test files)
- Commit 451dbbd exists: confirmed
- Commit d0581c7 exists: confirmed
- Zero `../` imports: confirmed (`grep -rE "from '\\.\\./" src/reviewer-v2/` returns empty)
- `npm test` exits 0, 61 tests pass: confirmed
- `npm run lint` exits 0 (0 errors): confirmed
- `npx tsc -b --noEmit` exits 0: confirmed

---
*Phase: 17-foundation-isolation*
*Completed: 2026-05-20*
