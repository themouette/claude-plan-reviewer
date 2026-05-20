---
phase: 17-foundation-isolation
plan: "03"
subsystem: ui
tags:
  - reviewer-v2
  - routing
  - layout-shell
  - tailwind
  - react

dependency_graph:
  requires:
    - phase: 17-foundation-isolation
      plan: "01"
      provides: jsdom test environment and ESLint no-restricted-imports coupling rule
    - phase: 17-foundation-isolation
      plan: "02"
      provides: useHeartbeat and useAnnotations hooks in ui/src/reviewer-v2/
  provides:
    - ui/src/reviewer-v2/ReviewerV2.tsx — top-level v2 entry mounting useHeartbeat + useAnnotations + ReviewerV2Shell
    - ui/src/reviewer-v2/ReviewerV2Shell.tsx — pure 3-column layout shell (48px header / 200px outline / flex-1 content / 280px comments)
    - ui/src/main.tsx routing branch — pathname.startsWith('/v2') mounts ReviewerV2; else mounts App
    - ui/vite.config.ts fix — defineConfig imported from vitest/config to satisfy TypeScript type check
  affects:
    - Phase 18 ContentPane (populates center column)
    - Phase 19 OutlinePane (populates left column)
    - Phase 20 CommentPane (populates right column)

tech_stack:
  added: []
  patterns:
    - "Inline-style + CSS custom property pattern for pixel-precise UI-SPEC values (200/280/48px)"
    - "void hook() expression to call hooks intentionally without capturing return value (satisfies ESLint no-unused-vars)"
    - "window.location.pathname.startsWith('/v2') routing branch in main.tsx (D-01 — no router library)"

key_files:
  created:
    - ui/src/reviewer-v2/ReviewerV2.tsx
    - ui/src/reviewer-v2/ReviewerV2Shell.tsx
  modified:
    - ui/src/main.tsx
    - ui/vite.config.ts

decisions:
  - "void useHeartbeat() / void useAnnotations() — return value intentionally ignored in Phase 17; void expression preferred over underscore-prefix convention because @typescript-eslint/no-unused-vars does not suppress underscore vars by default without explicit varsIgnorePattern config"
  - "defineConfig imported from vitest/config not vite — vitest/config re-exports defineConfig with the test property typed; importing from vite lacks the test type and causes TS2769 on tsconfig.node.json compilation"
  - "Flat v2 root layout for new files — consistent with Plan 02 flat layout decision; no ../ imports anywhere in reviewer-v2/"

requirements_completed:
  - LAYOUT-01
  - LAYOUT-02

metrics:
  duration_seconds: 540
  completed_date: "2026-05-20"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 2
---

# Phase 17 Plan 03: v2 Entry Routing and 3-Column Shell Summary

**ReviewerV2.tsx mounts v2 hooks and renders a 3-column shell (200px outline / flex-1 content / 280px comments) via main.tsx routing branch on /v2; cargo release build succeeds with embedded assets**

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ReviewerV2 component and 3-column shell | bf4251d | ui/src/reviewer-v2/ReviewerV2.tsx, ui/src/reviewer-v2/ReviewerV2Shell.tsx, ui/vite.config.ts |
| 2 | Add the /v2 routing branch in main.tsx | 9ebe3b7 | ui/src/main.tsx |
| 3 | Human verification — auto-approved (AUTO MODE) | — | (no file mutations) |

## What Was Built

**Task 1 — ReviewerV2Shell.tsx (pure 3-column layout):**
- Header strip: 48px fixed height, `var(--color-surface)` background, 1px bottom border in `var(--color-border)`, "Reviewer v2" label at 14px / 400 / `var(--color-text-secondary)` left-aligned with 16px horizontal padding
- Left column: `<aside>` 200px wide, `flexShrink: 0`, right border in `var(--color-border)`, `var(--color-bg)` background, padding 16px, "Outline" placeholder label
- Center column: `<main>` `flex: 1`, `minWidth: 0`, `var(--color-bg)` background, padding 32px, "Content" placeholder label
- Right column: `<aside>` 280px wide, `flexShrink: 0`, left border in `var(--color-border)`, `var(--color-bg)` background, padding 16px, "Comments" placeholder label
- All placeholder labels: 14px / 400 / `var(--color-text-secondary)` per UI-SPEC
- No `../` imports; no business logic; no imports beyond React

**Task 1 — ReviewerV2.tsx (top-level v2 entry):**
- Imports `useHeartbeat` from `'./useHeartbeat'` and `useAnnotations` from `'./useAnnotations'`
- Calls both hooks via `void` expression (intentionally ignoring return values in Phase 17)
- Returns `<ReviewerV2Shell />` as the render output
- ARCH-02 satisfied: v2 heartbeat poller fires independently on `/v2` mount

**Task 2 — main.tsx routing branch:**
- Added `import ReviewerV2 from './reviewer-v2/ReviewerV2'`
- Added `const isV2 = window.location.pathname.startsWith('/v2')`
- Changed JSX to `{isV2 ? <ReviewerV2 /> : <App />}` inside existing `<StrictMode>`
- StrictMode, createRoot, and getElementById unchanged per D-01

**Task 3 — Cargo release build:**
- `cargo build --release` succeeded (53s, embedded `ui/dist/` via rust-embed)
- Binary `target/release/plan-reviewer` is executable

## Verification Results

1. `npm run lint` exits 0 (0 errors, 3 pre-existing warnings in App.tsx)
2. `npm test` exits 0, all 61 tests pass (no new tests added — no new business logic)
3. `npx tsc -b --noEmit` exits 0 (after fixing vite.config.ts import)
4. `npm run build` exits 0, `ui/dist/index.html` and assets produced
5. `cargo build --release` exits 0, binary is executable
6. Human verification: AUTO MODE — auto-approved
7. `grep -rE "from '\\.\\./" src/reviewer-v2/` returns empty (ARCH-01 preserved)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript error in vite.config.ts**
- **Found during:** Task 1 (verification step `npx tsc -b --noEmit`)
- **Issue:** `vite.config.ts` imported `defineConfig` from `'vite'` which lacks the `test` property type. TypeScript reported `TS2769: Object literal may only specify known properties, and 'test' does not exist in type 'UserConfigExport'`. This was a pre-existing issue from Plan 01 that was somehow masked in that plan's verification.
- **Fix:** Changed `import { defineConfig } from 'vite'` to `import { defineConfig } from 'vitest/config'`. The `vitest/config` module re-exports `defineConfig` with the `InlineConfig` (test property) typed correctly.
- **Files modified:** `ui/vite.config.ts`
- **Commit:** bf4251d (included in Task 1 commit)

**2. [Rule 1 - Bug] Used `void` expression instead of underscore-prefix for unused hook returns**
- **Found during:** Task 1 (lint step)
- **Issue:** Initial implementation used `const _connectivity = useHeartbeat()` and `const _annotations = useAnnotations()` per plan action text. ESLint reported `@typescript-eslint/no-unused-vars` errors because the config's `tseslint.configs.recommended` does not configure `varsIgnorePattern` to exempt underscore-prefixed vars by default.
- **Fix:** Changed to `void useHeartbeat()` and `void useAnnotations()` which calls the hooks (mounts them per React rules) without creating a named binding, avoiding the lint error entirely.
- **Files modified:** `ui/src/reviewer-v2/ReviewerV2.tsx`
- **Commit:** bf4251d

## Known Stubs

The following placeholder labels are intentional scaffolding for Phase 17. They will be replaced by real content in subsequent phases:

| File | Line | Stub | Resolution |
|------|------|------|------------|
| `ui/src/reviewer-v2/ReviewerV2Shell.tsx` | ~49 | "Outline" placeholder label | Phase 19 OutlinePane |
| `ui/src/reviewer-v2/ReviewerV2Shell.tsx` | ~65 | "Content" placeholder label | Phase 18 ContentPane |
| `ui/src/reviewer-v2/ReviewerV2Shell.tsx` | ~79 | "Comments" placeholder label | Phase 20 CommentPane |
| `ui/src/reviewer-v2/ReviewerV2.tsx` | ~13 | `void useHeartbeat()` — return value unused | Phase 22 Submit |
| `ui/src/reviewer-v2/ReviewerV2.tsx` | ~17 | `void useAnnotations()` — return value unused | Phase 21 Annotations |

These stubs do NOT prevent Plan 03's goal (visible 3-column shell on `/v2`) — the plan explicitly specifies placeholder labels as the Phase 17 deliverable.

## Threat Flags

No new security-relevant surface introduced. Analysis per threat_model in PLAN.md:
- `main.tsx` routing branch: pure `startsWith('/v2')` string operation on browser-parsed pathname — no HTML injection vector
- Both v1 and v2 share the existing `/api/ping` endpoint (stateless, loopback-only) — no new endpoints
- All trust boundary mitigations accepted per T-17-03-01 through T-17-03-SC

## Self-Check: PASSED

- `ui/src/reviewer-v2/ReviewerV2.tsx` exists: confirmed
- `ui/src/reviewer-v2/ReviewerV2Shell.tsx` exists: confirmed
- `ui/src/main.tsx` contains `startsWith('/v2')`: confirmed
- `ui/vite.config.ts` imports from `vitest/config`: confirmed
- Commit bf4251d exists: confirmed
- Commit 9ebe3b7 exists: confirmed
- Zero `../` imports in reviewer-v2/: confirmed
- `npm test` exits 0, 61 tests pass: confirmed
- `npm run lint` exits 0: confirmed
- `npx tsc -b --noEmit` exits 0: confirmed
- `npm run build` exits 0: confirmed
- `cargo build --release` exits 0: confirmed

---
*Phase: 17-foundation-isolation*
*Completed: 2026-05-20*
