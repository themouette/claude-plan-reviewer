# Phase 17: Foundation & Isolation - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold the v2 reviewer before any feature code lands: test infrastructure (jsdom mocks, ESLint coupling rule), routing switch in `main.tsx`, v2 types, annotation store, heartbeat, and the 3-column layout shell. The output of this phase is a working `/v2` route that renders a visible 3-column shell with test infrastructure fully in place.

</domain>

<decisions>
## Implementation Decisions

### Routing

- **D-01:** Use an inline `window.location.pathname.startsWith('/v2')` check in `main.tsx` — no router library. Zero new dep.
- **D-02:** The `/v2` path prefix triggers the v2 reviewer. Rust's existing `FallbackBehavior::Ok` already serves `index.html` for any path — no Rust changes needed.

### Isolation & Coupling (ARCH-01)

- **D-03:** `reviewer-v2/` must NOT import from any local path outside `reviewer-v2/` — not even shared hooks like `hooks/useHeartbeat.ts`. The goal is that v1 can be deleted without breaking v2.
- **D-04:** reviewer-v2/ copies the utilities it needs (connectivity state machine, useHeartbeat, offlineLabels) into its own subtree. Some duplication is acceptable in exchange for total isolation.
- **D-05:** The ESLint coupling rule is enforced via `no-restricted-imports` in `eslint.config.js` using a `files: ['**/reviewer-v2/**']` config block that blocks `../` relative imports. Zero new deps.
- **D-06:** Coupling direction: existing view (v1) MAY import shared utilities from `reviewer-v2/` if useful — the ESLint rule does NOT block that direction.

### Heartbeat (ARCH-02)

- **D-07:** `reviewer-v2/` owns its own `useHeartbeat` copy (in `reviewer-v2/hooks/useHeartbeat.ts`) copied from the existing hook.
- **D-08:** v2 calls its own `useHeartbeat()` and gets its own `ConnectivityStatus` state — completely independent from App.tsx. Two pollers, same `/api/ping` endpoint.

### Annotation Store

- **D-09:** State is managed via `useReducer` with typed actions — matches the existing connectivity state machine pattern, testable by calling the reducer directly without a React renderer.
- **D-10:** Store lives in `reviewer-v2/hooks/useAnnotations.ts` — a hook wrapper that calls `useReducer` internally and exposes typed add/edit/remove helpers.
- **D-11:** Phase 17 defines a minimal Annotation type: `{ id, anchorText, comment, type }`. Later phases (20–21) will extend it with anchor offsets, sectionId, etc. Do not over-design the type now.

### Test Infrastructure (TEST-02, TEST-03)

- **D-12:** `vitest.setup.ts` must be created and registered before any v2 component code. It must mock `IntersectionObserver`, `ResizeObserver`, and `CSS.highlights` for jsdom.
- **D-13:** The ESLint coupling rule (D-05) must be active and failing on violations before any v2 feature code lands — TEST-03 is a gate, not a follow-up.

### Layout Shell

- **D-14:** The 3-column layout shell uses CSS Grid or Flexbox with Tailwind 4 classes. No new UI library. The layout boundary must be visible at `/v2` (columns rendered, no content yet).

### Claude's Discretion

- Specific Tailwind class names and CSS Grid vs Flexbox for the 3-column layout — either works.
- Directory structure within `reviewer-v2/` beyond the top-level `hooks/` and `utils/` subdirectories.
- Whether the `reviewer-v2/utils/connectivity.ts` copy is a verbatim copy or stripped to the minimum v2 needs.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — v0.6.0 requirements; Phase 17 covers: TEST-02, TEST-03, ARCH-01, ARCH-02, LAYOUT-01, LAYOUT-02
- `.planning/ROADMAP.md` Phase 17 — Success criteria (5 items) define exactly what must be TRUE

### Architecture Constraints
- `.planning/PROJECT.md` — Key Decisions table (ConnectivityStatus parallel type, clipboard byte-identical rule, React 19 decision)
- `.planning/STATE.md` — v0.6.0 accumulated decisions (especially: TEST-02/TEST-03 before any v2 component code; ARCH-01 via ESLint)

### Existing Code to Copy Into reviewer-v2/
- `ui/src/hooks/useHeartbeat.ts` — copy into `reviewer-v2/hooks/useHeartbeat.ts` verbatim; do not import from there
- `ui/src/utils/connectivity.ts` — copy into `reviewer-v2/utils/connectivity.ts`
- `ui/src/utils/offlineLabels.ts` — copy the parts v2 needs (buildClipboardPayload, shouldUseClipboard) into `reviewer-v2/utils/offlineLabels.ts`
- `ui/src/types.ts` — reference for the existing Annotation shape; v2 defines its own minimal type (do not import from here)

### ESLint Configuration
- `ui/eslint.config.js` — current flat config (ESLint 9); add the `reviewer-v2/` coupling block here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (copy, do not import)
- `ui/src/hooks/useHeartbeat.ts` — DI-based hook, fully testable by calling `runHeartbeatTick` directly without React renderer. Copy pattern and exported test helper into v2.
- `ui/src/utils/connectivity.ts` — pure state machine (`nextHeartbeatState`, `initialHeartbeatState`). Copy verbatim.
- `ui/src/utils/offlineLabels.ts` — `buildClipboardPayload` and `shouldUseClipboard` are the two functions v2 needs for SUBMIT-02 (degraded mode). Copy these.

### Established Patterns
- **No `@testing-library/react`**: All tests drive logic through exported pure functions or via dependency injection (see `runHeartbeatTick` in `useHeartbeat.ts`). The `useAnnotations` hook must follow this same pattern — export the reducer function for direct unit-test use.
- **State machine style**: ConnectivityStatus and HeartbeatState use a pure `nextState(state, event)` reducer. The annotation store should follow the same pattern.
- **ESLint 9 flat config**: `ui/eslint.config.js` uses `defineConfig` with `globalIgnores` and per-file `files` arrays. The reviewer-v2 coupling rule goes in a new config block with `files: ['src/reviewer-v2/**']`.

### Integration Points
- `ui/src/main.tsx` — add the pathname check here; mount `<ReviewerV2 />` for `/v2`, existing `<App />` for everything else.
- `ui/vite.config.ts` — no changes needed.
- `ui/package.json` — no new runtime deps. `vitest` already present; add `setup` field to vitest config if needed (can live in `vite.config.ts` under `test.setupFiles`).

</code_context>

<specifics>
## Specific Ideas

- The 3-column layout boundary should be visually clear even with no content — placeholder labels or colored backgrounds for each column during this phase are fine.
- The `vitest.setup.ts` mocks must be registered via `test.setupFiles` in `vite.config.ts` (or a `vitest.config.ts` if preferred) — not inline in test files.
- The ESLint `no-restricted-imports` pattern should block `'../**'` and `'./../**'` to catch both `../` and `../../` imports from within `reviewer-v2/`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 17-Foundation & Isolation*
*Context gathered: 2026-05-20*
