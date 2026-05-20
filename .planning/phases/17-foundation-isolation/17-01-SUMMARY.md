---
phase: 17-foundation-isolation
plan: "01"
subsystem: test-infrastructure
tags:
  - vitest
  - jsdom
  - eslint
  - test-infrastructure
  - coupling-enforcement
dependency_graph:
  requires: []
  provides:
    - jsdom test environment for all subsequent v2 component tests
    - vitest.setup.ts with IntersectionObserver/ResizeObserver/CSS.highlights mocks
    - ESLint no-restricted-imports rule enforcing reviewer-v2 isolation
  affects:
    - ui/vite.config.ts
    - ui/eslint.config.js
tech_stack:
  added:
    - jsdom@^29.1.1 (devDependency — Vitest jsdom environment peer dep)
  patterns:
    - test.setupFiles in vite.config.ts for global mock registration
    - ESLint flat config files-scoped no-restricted-imports rule
key_files:
  created:
    - ui/vitest.setup.ts
  modified:
    - ui/package.json
    - ui/package-lock.json
    - ui/vite.config.ts
    - ui/eslint.config.js
decisions:
  - jsdom@^29.1.1 installed as dev dep — npm-verified, 14-year-old foundational package
  - environment:'jsdom' set globally in vite.config.ts (all 46 existing tests pass)
  - no-restricted-imports uses group:['../**'] to catch imports at any depth
  - ESLint block scoped to src/reviewer-v2/** (relative to eslint.config.js location)
metrics:
  duration_seconds: 92
  completed_date: "2026-05-20"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 4
---

# Phase 17 Plan 01: Test Infrastructure & Coupling Enforcement Summary

jsdom installed, Vitest wired to jsdom environment with IntersectionObserver/ResizeObserver/CSS.highlights mocks, and ESLint no-restricted-imports rule enforcing reviewer-v2 isolation at lint time.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install jsdom and wire Vitest jsdom environment | c7f7f33 | ui/package.json, ui/package-lock.json, ui/vitest.setup.ts, ui/vite.config.ts |
| 2 | Add reviewer-v2 ESLint coupling block | 8fc5d47 | ui/eslint.config.js |

## What Was Built

**Task 1 — jsdom test environment:**
- Installed `jsdom@^29.1.1` as a dev dependency (`npm install --save-dev jsdom@^29.1.1`)
- Created `ui/vitest.setup.ts` with three global mocks:
  - `global.IntersectionObserver` via `vi.fn().mockImplementation`
  - `global.ResizeObserver` via `vi.fn().mockImplementation`
  - `CSS.highlights` with defensive `typeof CSS === 'undefined'` guard
- Added `test: { environment: 'jsdom', setupFiles: ['./vitest.setup.ts'] }` to `vite.config.ts`
- All 46 existing tests continue to pass under the jsdom environment

**Task 2 — ESLint coupling enforcement:**
- Appended a new config block to `ui/eslint.config.js` inside `defineConfig([...])`
- Block scoped to `files: ['src/reviewer-v2/**']` (relative to `eslint.config.js` location)
- Rule: `no-restricted-imports` with `patterns: [{ group: ['../**'], message: '...' }]`
- Smoke-tested live: `../../App` import and `../utils/foo` import both caught with the custom message
- Clean repo lint exits 0 with no v2 files present

## Verification Results

1. `npm test` exits 0, all 46 tests pass under jsdom, no ReferenceError for mocked globals
2. `npm run lint` exits 0 on clean repo (no v2 files present)
3. Deliberate `../../App` import inside `src/reviewer-v2/` produces `no-restricted-imports` error
4. Deliberate `../utils/foo` import also caught (single-level confirmed)
5. `ui/src/reviewer-v2/` directory does NOT exist at end of plan (temp lint test removed)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates test infrastructure only, no UI components or data flows.

## Threat Flags

No new security-relevant surface introduced. All changes are test/lint configuration only.

## Self-Check: PASSED

- `ui/vitest.setup.ts` exists: confirmed
- `ui/vite.config.ts` contains `environment: 'jsdom'`: confirmed
- `ui/eslint.config.js` contains `no-restricted-imports`: confirmed
- Commit c7f7f33 exists: confirmed
- Commit 8fc5d47 exists: confirmed
