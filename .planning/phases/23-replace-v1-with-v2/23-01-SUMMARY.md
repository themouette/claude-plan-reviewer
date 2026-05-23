---
phase: 23-replace-v1-with-v2
plan: 01
subsystem: frontend-cleanup
tags: [migration, cleanup, v1-removal, entry-point]
dependency_graph:
  requires: []
  provides: [single-renderer, clean-entry-point]
  affects: [ui/src/main.tsx, src/main.rs]
tech_stack:
  added: []
  patterns: [remove-dead-code]
key_files:
  created: []
  modified:
    - ui/src/main.tsx
    - src/main.rs
    - .planning/REQUIREMENTS.md
  deleted:
    - ui/src/App.tsx
    - ui/src/types.ts
    - ui/src/components/AnnotationSidebar.tsx
    - ui/src/components/DiffView.tsx
    - ui/src/components/PlanOutline.tsx
    - ui/src/components/TabBar.tsx
    - ui/src/hooks/useHeartbeat.ts
    - ui/src/hooks/useHeartbeat.test.ts
    - ui/src/hooks/useTextSelection.ts
    - ui/src/utils/connectivity.ts
    - ui/src/utils/connectivity.test.ts
    - ui/src/utils/offlineLabels.ts
    - ui/src/utils/offlineLabels.test.ts
    - ui/src/utils/serializeAnnotations.ts
    - ui/src/utils/serializeAnnotations.test.ts
decisions:
  - "ReviewerV2 is now the sole frontend renderer — v1 App.tsx and all v1-only source deleted"
  - "Browser opens at http://127.0.0.1:{port}/ (not /v2) — URL updated in src/main.rs"
metrics:
  duration: 8m
  completed_date: "2026-05-22"
  tasks_completed: 3
  tasks_total: 3
requirements_completed:
  - TEST-01
---

# Phase 23 Plan 01: Replace V1 With V2 Summary

ReviewerV2 is now the sole frontend renderer — `main.tsx` renders `<ReviewerV2 />` unconditionally, all v1-only source files deleted, both test suites green with zero failures.

## What Was Built

### Task 1 — Update entry points (commit 378568b)

- `ui/src/main.tsx`: Removed `import App from './App'` and the `const isV2` conditional; now renders `<ReviewerV2 />` unconditionally inside `<StrictMode>`.
- `src/main.rs`: Changed URL from `http://127.0.0.1:{}/v2` to `http://127.0.0.1:{}/` so the browser opens at the root path.
- Both `npm run build` and `cargo check` passed after these changes.

### Task 2 — Delete v1 source files (commit c98f58e)

Deleted via `git rm`, 15 files / 3,210 lines removed:

- `ui/src/App.tsx`
- `ui/src/types.ts`
- `ui/src/components/AnnotationSidebar.tsx`
- `ui/src/components/DiffView.tsx`
- `ui/src/components/PlanOutline.tsx`
- `ui/src/components/TabBar.tsx`
- `ui/src/hooks/useHeartbeat.ts`
- `ui/src/hooks/useHeartbeat.test.ts`
- `ui/src/hooks/useTextSelection.ts`
- `ui/src/utils/connectivity.ts`
- `ui/src/utils/connectivity.test.ts`
- `ui/src/utils/offlineLabels.ts`
- `ui/src/utils/offlineLabels.test.ts`
- `ui/src/utils/serializeAnnotations.ts`
- `ui/src/utils/serializeAnnotations.test.ts`

Preserved (as required): `ui/src/index.css`, `ui/src/main.tsx`, `ui/src/reviewer-v2/` (entire subtree).

`npm run build` passed after deletion — no missing-import errors.

### Task 3 — Verify zero failures and no residual v1 imports

- `npm test -- --run`: **335 passed (20 files), 0 failed** (down from 381/24 — the 4 deleted v1 test files contained 46 tests).
- `cargo test`: **132 passed (109 unit + 23 integration), 0 failed** — including no new failures beyond baseline.
- Grep audits:
  - `../types`, `../components`, `../hooks`, `../utils` relative imports: all matches inside `ui/src/reviewer-v2/hooks/` resolve to `ui/src/reviewer-v2/types.ts` (v2's own types) — not the deleted v1 path.
  - `./App`, `./types` sibling imports: all matches inside `ui/src/reviewer-v2/` resolve to v2's own sibling files — not deleted v1 paths.
  - `/v2` references in `src/` and `ui/src/`: **zero matches**.
- `npx tsc --noEmit`: exit 0 — no missing-module errors.
- REQUIREMENTS.md: TEST-01 row updated to `Complete`.

## Deviations from Plan

None — plan executed exactly as written.

The grep audits in Task 3 returned matches, but all were within `ui/src/reviewer-v2/` pointing to v2's own `types.ts` — not the deleted v1 paths. This was expected given v2's self-contained structure and is not a deviation.

## Self-Check

- [ ] ui/src/main.tsx exists and renders ReviewerV2 unconditionally
- [ ] src/main.rs URL is http://127.0.0.1:{}/ (no /v2)
- [ ] All v1 files deleted
- [ ] Both test suites green

## Known Stubs

None.

## Threat Flags

None — this plan only removes dead code; no new network endpoints, auth paths, or schema changes introduced.
