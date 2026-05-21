---
phase: 17-foundation-isolation
verified: 2026-05-20T07:40:00Z
status: human_needed
score: 11/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open http://127.0.0.1:<port>/v2 in a real browser against the release binary"
    expected: "A 48px header 'Reviewer v2', three visually distinct columns (200px Outline / flex-1 Content / 280px Comments with 1px borders), and a GET /api/ping request in DevTools Network within 5 seconds"
    why_human: "Task 3 (human-verify checkpoint) was auto-approved in AUTO MODE — no human ever observed the 3-column shell in a browser. LAYOUT-01 and LAYOUT-02 require visual confirmation. The release binary in target/release/plan-reviewer dates from May 7 (pre-Phase 17) and does not embed the new UI; cargo build --release must be re-run before verifying."
---

# Phase 17: Foundation & Isolation Verification Report

**Phase Goal:** The v2 reviewer scaffold is in place — test infrastructure (jsdom mocks, ESLint coupling rule) prevents regressions and enforces isolation before any feature code is written; main.tsx routes /v2 to the new entry; shared types and annotation store exist; the new reviewer renders at /v2 with a 3-column layout shell; heartbeat runs independently of the existing component tree
**Verified:** 2026-05-20T07:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npm test` runs in jsdom environment (DOM globals available) | VERIFIED | `ui/vite.config.ts` has `environment: 'jsdom'`; `npm test` exits 0, 61 tests pass |
| 2 | IntersectionObserver, ResizeObserver, CSS.highlights defined as test doubles before any test runs | VERIFIED | `ui/vitest.setup.ts` registers all three; `vite.config.ts` wires it via `setupFiles: ['./vitest.setup.ts']` |
| 3 | A file inside `ui/src/reviewer-v2/` with `../` import fails `npm run lint` | VERIFIED | Live probe: `../../App` import produced `no-restricted-imports` error; `../utils/foo` also caught |
| 4 | A file outside `ui/src/reviewer-v2/` importing from inside it does NOT trigger the coupling rule (D-06) | VERIFIED | Live probe: outside-to-inside import `./reviewer-v2/useAnnotations` caused no lint error (exit 0) |
| 5 | All 46 existing tests still pass after jsdom environment switch | VERIFIED | `npm test` reports 61 tests pass (46 pre-existing + 15 new); all green |
| 6 | All v2 code lives exclusively under `ui/src/reviewer-v2/` | VERIFIED | `grep -rE "from '\\.\\./" ui/src/reviewer-v2/` returns empty; flat layout confirmed |
| 7 | `reviewer-v2/hooks/useHeartbeat.ts` polls /api/ping independently from v1 copy | VERIFIED | Both `ui/src/hooks/useHeartbeat.ts` and `ui/src/reviewer-v2/useHeartbeat.ts` contain `fetch('/api/ping'`; imports repointed to `./connectivity` |
| 8 | `annotationReducer` handles add, edit, and remove actions correctly | VERIFIED | 5 tests in `useAnnotations.test.ts` cover all branches including missing-id edge cases; all pass |
| 9 | `main.tsx` routes /v2 to ReviewerV2, all other paths to App | VERIFIED | `window.location.pathname.startsWith('/v2')` ternary present in `ui/src/main.tsx` with both imports |
| 10 | ReviewerV2 calls its own useHeartbeat (v2 copy, not v1) | VERIFIED | `ReviewerV2.tsx` imports `useHeartbeat` from `'./useHeartbeat'`; calls `void useHeartbeat()` |
| 11 | `npm run lint` and `npm test` and `npm run build` all pass | VERIFIED | lint: 0 errors; test: 61/61; build: produces `ui/dist/index.html` and assets |
| 12 | /v2 renders 3-column shell visible in a real browser with v2 heartbeat firing | UNCERTAIN | Task 3 human-verify checkpoint was auto-approved in AUTO MODE; no human observation recorded; release binary predates Phase 17 (May 7 vs May 20 commits) |

**Score:** 11/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ui/vitest.setup.ts` | jsdom mocks for IntersectionObserver, ResizeObserver, CSS.highlights | VERIFIED | All three globals assigned; defensive `typeof CSS === 'undefined'` guard present |
| `ui/vite.config.ts` | `environment: 'jsdom'` + `setupFiles: ['./vitest.setup.ts']` | VERIFIED | Imports from `vitest/config`; test block present and correct |
| `ui/eslint.config.js` | `no-restricted-imports` scoped to `src/reviewer-v2/**` | VERIFIED | Block with `files: ['src/reviewer-v2/**']` and `group: ['../**']` present |
| `ui/package.json` | jsdom dev dependency | VERIFIED | `"jsdom": "^29.1.1"` in devDependencies |
| `ui/src/reviewer-v2/types.ts` | Annotation interface + AnnotationAction discriminated union | VERIFIED | `interface Annotation` with 4 fields; `AnnotationAction` with add/edit/remove arms |
| `ui/src/reviewer-v2/connectivity.ts` | Copy of ConnectivityStatus, HeartbeatState, nextHeartbeatState | VERIFIED | Verbatim copy; exports `nextHeartbeatState`, `initialHeartbeatState`, `ConnectivityStatus` |
| `ui/src/reviewer-v2/useHeartbeat.ts` | v2-owned useHeartbeat with runHeartbeatTick | VERIFIED | Exports `runHeartbeatTick`; `POLL_INTERVAL_MS = 5000`; imports from `'./connectivity'` |
| `ui/src/reviewer-v2/useAnnotations.ts` | annotationReducer + useAnnotations hook | VERIFIED | Exports `annotationReducer`, `initialAnnotationState`, `AnnotationState`, `useAnnotations` |
| `ui/src/reviewer-v2/ReviewerV2.tsx` | Top-level v2 entry; calls useHeartbeat + useAnnotations + renders shell | VERIFIED | Imports both hooks from `'./useHeartbeat'` and `'./useAnnotations'`; `void` call pattern |
| `ui/src/reviewer-v2/ReviewerV2Shell.tsx` | 3-column layout shell (Outline/Content/Comments) | VERIFIED | 200/280/48 dimensions; `var(--color-border)` / `var(--color-bg)` CSS vars; all 3 labels present |
| `ui/src/main.tsx` | Routing branch: pathname.startsWith('/v2') | VERIFIED | `const isV2 = window.location.pathname.startsWith('/v2')`; ternary mounts correct component |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ui/vite.config.ts` | `ui/vitest.setup.ts` | `test.setupFiles` array | VERIFIED | `setupFiles: ['./vitest.setup.ts']` present |
| `ui/eslint.config.js` | `ui/src/reviewer-v2/` | `files` glob scoping `no-restricted-imports` | VERIFIED | `files: ['src/reviewer-v2/**']` scopes the rule correctly |
| `ui/src/main.tsx` | `ui/src/reviewer-v2/ReviewerV2.tsx` | default import | VERIFIED | `import ReviewerV2 from './reviewer-v2/ReviewerV2'` |
| `ui/src/reviewer-v2/ReviewerV2.tsx` | `ui/src/reviewer-v2/useHeartbeat.ts` | named import + call | VERIFIED | `import { useHeartbeat } from './useHeartbeat'`; `void useHeartbeat()` |
| `ui/src/reviewer-v2/ReviewerV2.tsx` | `ui/src/reviewer-v2/useAnnotations.ts` | named import + call | VERIFIED | `import { useAnnotations } from './useAnnotations'`; `void useAnnotations()` |
| `ui/src/reviewer-v2/useHeartbeat.ts` | `ui/src/reviewer-v2/connectivity.ts` | relative import | VERIFIED | `from './connectivity'` — intra-subtree, not flagged by ESLint rule |
| `ui/src/reviewer-v2/useAnnotations.ts` | `ui/src/reviewer-v2/types.ts` | type import | VERIFIED | `import type { Annotation, AnnotationAction } from './types'` |

### Data-Flow Trace (Level 4)

Not applicable for Phase 17. All artifacts are infrastructure (test setup, ESLint config, layout shell with placeholder labels) — no dynamic data rendering. The annotation store and heartbeat hooks have no data source to trace at this phase; they are wired but intentionally not connected to UI output until Phases 21-22.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All tests pass under jsdom | `cd ui && npm test` | 61/61 pass, 0 failures | PASS |
| ESLint passes on clean repo | `cd ui && npm run lint` | 0 errors, 3 pre-existing warnings in App.tsx | PASS |
| ESLint coupling rule fires on ../X import from reviewer-v2 | Probe: `__lint_test__.ts` with `../../App` import | `no-restricted-imports` error on line 1 | PASS |
| Outside-to-inside import is NOT blocked (D-06) | Probe: file outside reviewer-v2 importing from inside | lint exits 0 — rule does not fire | PASS |
| Production build succeeds | `cd ui && npm run build` | `ui/dist/index.html` produced; exit 0 | PASS |
| No `../` imports anywhere in reviewer-v2 subtree | `grep -rE "from '\\.\\./" ui/src/reviewer-v2/` | No output | PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes declared for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TEST-02 | 17-01-PLAN.md | jsdom mocks for IntersectionObserver, ResizeObserver, CSS.highlights registered before any test | SATISFIED | `vitest.setup.ts` registers all three; linked via `vite.config.ts` setupFiles |
| TEST-03 | 17-01-PLAN.md | ESLint no-restricted-imports rule enforces ARCH-01 coupling constraint | SATISFIED | Rule active, scoped to `src/reviewer-v2/**`, fires on `../` imports; verified live |
| ARCH-01 | 17-02-PLAN.md | All new reviewer code under `ui/src/reviewer-v2/`; no `../` escapes | SATISFIED | grep confirms zero `../` imports; flat layout verified; ESLint rule provides mechanical enforcement |
| ARCH-02 | 17-02-PLAN.md | v2 owns its own useHeartbeat, independent of App.tsx | SATISFIED | `ui/src/reviewer-v2/useHeartbeat.ts` is a separate file polling `/api/ping` independently |
| LAYOUT-01 | 17-03-PLAN.md | New reviewer renders at `/v2` in a browser tab | NEEDS HUMAN | Routing code verified in source; visual confirmation never completed (auto-approve in AUTO MODE) |
| LAYOUT-02 | 17-03-PLAN.md | 3-column shell: outline/content/comments | NEEDS HUMAN | Shell code verified (200/280px, borders, labels); visual confirmation never completed |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ui/src/reviewer-v2/ReviewerV2Shell.tsx` | 47-49, 64-66, 79-81 | Placeholder labels "Outline", "Content", "Comments" | Info | Intentional scaffolding for Phase 17 — will be replaced by Phases 18-20 |
| `ui/src/reviewer-v2/ReviewerV2.tsx` | 9, 13 | `void useHeartbeat()` / `void useAnnotations()` — return values unused | Info | Intentional deferral documented in SUMMARY; Phase 21/22 will wire them |

No TBD, FIXME, or XXX debt markers found in any phase-touched file.

### Human Verification Required

#### 1. /v2 Route Renders 3-Column Shell (LAYOUT-01, LAYOUT-02)

**Test:** Rebuild the release binary with `cargo build --release` from the repository root (the existing binary at `target/release/plan-reviewer` dates from May 7 and does not embed Phase 17 UI). Start the server: `echo '{"hook_event_name":"PermissionRequest","tool_name":"ExitPlanMode","tool_input":{"plan":"Phase 17 verification"}}' | ./target/release/plan-reviewer review-hook --no-browser --port 4717 &`. Navigate to `http://127.0.0.1:4717/v2` in a browser.

**Expected:** A 48px header strip reading "Reviewer v2", three vertical columns — 200px left "Outline", flex-1 center "Content", 280px right "Comments" — separated by 1px visible borders using `var(--color-border)`. No content other than placeholder labels. Background matches the existing dark theme (`#0f1117`). Within 5 seconds, DevTools Network shows a `GET /api/ping` returning 200 (v2 heartbeat polling independently).

**Why human:** Task 3 of Plan 03 is a `checkpoint:human-verify` gate. It was auto-approved in AUTO MODE without any human observation. LAYOUT-01 and LAYOUT-02 success criteria are visual. The release binary on disk predates Phase 17 changes and cannot serve the new UI — `cargo build --release` must be re-run first.

#### 2. / Route Still Shows Existing App (LAYOUT-01 isolation)

**Test:** After confirming /v2, navigate to `http://127.0.0.1:4717/` in the same server session.

**Expected:** The existing v1 reviewer UI renders (plan content visible, Approve/Deny buttons present). No v2 shell visible.

**Why human:** Routing correctness at the v1 path requires visual confirmation alongside the v2 check.

### Gaps Summary

No code gaps found. All artifacts exist, are substantive, and are correctly wired. The sole open item is the human visual verification of the browser rendering, which was bypassed by AUTO MODE during execution. The code evidence for LAYOUT-01/LAYOUT-02 is strong (correct source, build passes), but the phase's own human-verify checkpoint was never fulfilled by a human.

---

_Verified: 2026-05-20T07:40:00Z_
_Verifier: Claude (gsd-verifier)_
