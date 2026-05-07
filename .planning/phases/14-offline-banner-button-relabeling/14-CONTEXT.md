# Phase 14: Offline Banner & Button Relabeling - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Render-only response to the `ConnectivityStatus` signal already produced by `useHeartbeat()` (Phase 13):

1. When `useHeartbeat()` returns `'offline'`, show a persistent amber banner with two-line copy below the page header.
2. When offline, relabel the existing submit buttons (Approve, outer Deny, inner Submit Denial) to `Copy to clipboard` variants.
3. When `useHeartbeat()` flips back to `'online'`, banner disappears and labels return to defaults.

**Explicitly out of scope (Phase 15 owns this):**
- Any change to `approve()` / `deny()` click handlers' bodies (still POST to `/api/decide`).
- Any clipboard write (`navigator.clipboard.writeText`).
- The "Copied to clipboard — paste into Claude" confirmation screen.
- Serialization of the `{behavior}` JSON for clipboard export.

This phase MUST NOT add or modify submit-path logic. The buttons keep their current behavior; only the visible text and the surrounding banner change.

</domain>

<decisions>
## Implementation Decisions

### Button Strategy
- **D-01:** Two relabeled buttons — NOT a single combined button. Approve and Deny both remain visible offline with new labels. Resolves the OFX-02 vs ROADMAP success criterion 3 wording conflict in favor of ROADMAP ("submit buttons are relabeled" — plural).
- **D-02:** Approve button label when offline: `Copy to clipboard — approve`.
- **D-03:** Outer Deny button (the one that toggles the deny form) label when offline: `Copy to clipboard — deny`. It remains a toggle — clicking it opens/closes the deny textarea, same as today.
- **D-04:** Inner Submit Denial button (inside the deny form) label when offline: `Copy to clipboard`.
- **D-05:** When `useHeartbeat()` returns `'online'`, all three buttons revert to their `approveLabel` / `denyLabel` / `Submit Denial` defaults — these labels are already driven by `/api/config` for the outer pair (see `App.tsx` `approveLabel`/`denyLabel` state from Phase 11.1) and stay statically `Submit Denial` for the inner.

### Banner Copy
- **D-06:** Two-line text:
  ```
  Server connection lost — working offline.
  When you're done, copy your decision to the clipboard and paste it back into Claude.
  ```
  Spec text is parametric ("or equivalent" per ROADMAP success criterion 1) but THIS exact text ships in v0.5.0.

### Banner Visual Style
- **D-07:** Solid amber bar, no icon, full-width, sits flush directly below `<PageHeader>` and above the review columns / loading / error / confirmed views (per ROADMAP success criterion 1: "between the page header and the review columns").
- **D-08:** New CSS variables in `ui/src/index.css`:
  - `:root` (dark theme): `--color-banner-bg: #f59e0b` (amber-500), `--color-banner-text: #0f1117` (matches `--color-bg` for inversion / AA contrast on amber).
  - `[data-theme="light"]`: `--color-banner-bg: #d97706` (amber-600), `--color-banner-text: #f8fafc` (matches `--color-bg`).
  - The banner element references these as `var(--color-banner-bg)` / `var(--color-banner-text)`.

### Banner Accessibility
- **D-09:** `role="status"` (polite live region) on the banner element. Screen readers announce the offline copy when the status transitions, without interrupting current speech. Do NOT use `role="alert"` (too disruptive for a non-destructive condition).

### Banner Visibility Across App States
- **D-10:** Banner renders whenever `useHeartbeat() === 'offline'`, regardless of `appState`. It can sit above `LoadingSpinner`, `ErrorView`, the two-column review layout, or `ConfirmationView`. No app-state branching for banner visibility.
- **D-11:** The banner does NOT replace `ErrorView` — they can coexist (e.g., `/api/plan` 500'd AND ping is offline). `ErrorView` remains a state-of-load condition; banner is a connectivity condition.

### Architectural Wiring
- **D-12:** Call `useHeartbeat()` once at the top of `App` (the existing default export in `ui/src/App.tsx`). Pass the resulting `ConnectivityStatus` down to whatever component needs it — likely a new `OfflineBanner` sub-component plus inline `status === 'offline'` checks in the action-bar JSX. No React Context provider — single consumer point and a couple of prop reads.
- **D-13:** Add an `OfflineBanner` sub-component in `ui/src/App.tsx` (alongside `PageHeader`, `LoadingSpinner`, `ErrorView`, `ConfirmationView`) — keep colocation pattern consistent. Do NOT extract to `ui/src/components/` unless the planner finds a strong reason; the file is already split this way.

### Claude's Discretion
- Exact font-size / padding / line-height of the banner (within reason — match the existing 16px body / 14px secondary scale).
- Whether the banner uses `position: sticky` or sits in normal flow (depends on whether the planner wants it to scroll with content or stay pinned). Default suggestion: normal flow, since `<PageHeader>` already handles sticky-top.
- Test approach for the relabeling logic. The labels-flip-on-offline behavior is business logic and IS testable in Vitest using a mocked `useHeartbeat` (export an injectable variant or just stub the module). Phase 14 MUST include a test task per CLAUDE.md "Test Coverage Requirements" — `App.tsx` is being modified with new business logic (label-switch + banner-render branches), and the existing `ui/src/` test infrastructure (Vitest) is already in place.
- Whether to test via component rendering or by extracting the label-selection logic into a pure helper function and unit-testing the helper. The pure-helper approach aligns with the project's no-`@testing-library/react` policy (Phase 13 RESEARCH.md A1).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §"Phase 14: Offline Banner & Button Relabeling" (lines 270-281) — Goal, Depends-On (Phase 13), 5 Success Criteria, UI hint flag.
- `.planning/REQUIREMENTS.md` OFX-01, OFX-02 (lines 88-89) — note the literal-text conflict between OFX-02 ("a single Copy to clipboard button") and ROADMAP success criterion 3 ("submit buttons are relabeled" — plural). D-01 resolves this in favor of ROADMAP.
- `.planning/PROJECT.md` "Current Milestone: v0.5.0 Offline Resilience" (lines 11-19) — milestone framing.
- `.planning/STATE.md` "Accumulated Context" → Decisions section (line 70+) — `ConnectivityStatus` parallel-to-`AppState` rule still applies.

### Phase 13 Hand-off (the signal source)
- `ui/src/utils/connectivity.ts` — `ConnectivityStatus = 'online' | 'offline'` type and the reducer (used internally by the hook).
- `ui/src/hooks/useHeartbeat.ts` — `useHeartbeat()` returns `ConnectivityStatus`. Already running, paused on tab hide, hysteretic (3 fail / 1 success).
- `.planning/phases/13-connectivity-state-heartbeat-hook/13-RESEARCH.md` — locked decisions list, especially "ConnectivityStatus is a parallel type to AppState — do NOT add 'offline' as an AppState variant."
- `.planning/phases/13-connectivity-state-heartbeat-hook/13-VERIFICATION.md` — Phase 13 acceptance evidence.

### Existing UI Code
- `ui/src/App.tsx` — primary file to modify. Inline-styles convention, sub-components colocated, action bar at lines 1206-1422.
- `ui/src/index.css` — CSS variables under `:root` and `[data-theme="light"]`. Add `--color-banner-bg` and `--color-banner-text` here.
- `ui/src/types.ts` — types convention (string-literal unions); banner does not need new types if logic stays in `App.tsx`.

### Project Conventions
- `CLAUDE.md` "Test Coverage Requirements" — modifying `App.tsx` (business logic — label-switch + banner-render branches) requires a test task. Plan-checker will WARN on existing-module-modification without one.
- `CLAUDE.md` "Code Quality" — `cargo fmt` / `cargo clippy` are pre-commit; for `ui/` changes the relevant gates are `npm run lint` and `npm test` (vitest run).
- `.claude/.../memory/project_stack_reality.md` — frontend is React 19, NOT Svelte. CLAUDE.md "Recommended Stack" Svelte block is aspirational.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`useHeartbeat()`** (`ui/src/hooks/useHeartbeat.ts`) — direct dependency. Call it at the top of `App` once: `const connectivity = useHeartbeat()`. No new state needed — the hook already manages everything.
- **`approveLabel` / `denyLabel` state in `App.tsx`** (lines 558-559) — already React state populated from `/api/config` (Phase 11.1). The offline-flip is computed at render time; do NOT mutate this state on offline transitions. Compute the displayed label as `connectivity === 'offline' ? 'Copy to clipboard — approve' : approveLabel` and similarly for deny.
- **Existing `PageHeader` / `ErrorView` / `LoadingSpinner` / `ConfirmationView` sub-components** in `App.tsx` — pattern to follow for `OfflineBanner` (function declaration, inline styles, props typed inline).
- **CSS variable system** in `ui/src/index.css` — `:root` for dark, `[data-theme="light"]` for light. Add the two new banner vars in both blocks.

### Established Patterns
- **Inline styles, no Tailwind utility classes in JSX** — even though `tailwindcss` is imported in `index.css`, the JSX uses `style={{...}}` exclusively (verified in `App.tsx` lines 39-86 etc.). Stick to inline styles for the banner.
- **String-literal union types** — if a new type is needed, use `'online' | 'offline'` style (see `ConnectivityStatus`, `AppState`, `Tab`, `ViewMode`).
- **No `@testing-library/react`** — tests use plain Vitest assertions on pure helpers and module mocks (see `useHeartbeat.test.ts` style). The label-selection helper should be a pure function for the same reason.
- **`AppState` is NOT extended for connectivity** — `appState` stays `'loading' | 'error' | 'reviewing' | 'confirmed'`. Connectivity is a parallel signal (Phase 13 decision, repeated here for emphasis).

### Integration Points
- **Banner mount point:** Between `<PageHeader />` (line 1075) and the conditional render block for non-reviewing states (line 1078). Renders unconditionally on `connectivity === 'offline'`, regardless of `appState`.
- **Approve button label:** `App.tsx` line 1297 (`{approveLabel}`). Wrap in the offline check.
- **Outer Deny button label:** `App.tsx` line 1335 (`{denyLabel}`). Wrap in the offline check.
- **Inner Submit Denial button label:** `App.tsx` line 1418 (`Submit Denial`). Wrap in the offline check.
- **CSS vars:** `ui/src/index.css` `:root` block (after line 21) and `[data-theme="light"]` block (after line 42).

</code_context>

<specifics>
## Specific Ideas

- Banner copy ships byte-for-byte:
  ```
  Server connection lost — working offline.
  When you're done, copy your decision to the clipboard and paste it back into Claude.
  ```
- Amber palette: `#f59e0b` (dark) / `#d97706` (light), text colors invert against the page background for AA contrast.
- The banner is non-dismissable (OFX-01) — no close button, no "x" affordance, no localStorage flag. It is purely status-driven by `useHeartbeat()`.
- The annotation UI (text selection, floating affordances, sidebar cards, overall comment textarea, deny textarea, theme toggle, tab switching) MUST remain fully interactive while the banner is shown. Success criterion 5 explicitly forbids any blocking-error treatment.

</specifics>

<deferred>
## Deferred Ideas

- **CLB-01 / CLB-02 — clipboard submit path & confirmation screen** — Phase 15. The buttons RELABEL in Phase 14 but their click handlers still POST to `/api/decide` until Phase 15.
- **OFX-03 — textarea fallback when `navigator.clipboard` API is blocked** — deferred per REQUIREMENTS.md line 112.
- **OFX-04 — graceful online recovery polish (e.g., "back online" toast)** — deferred per REQUIREMENTS.md line 113. The banner just disappears silently on recovery.
- **Animation / transitions on the banner appearance and label flips** — not asked for; ship without animation. Reduced-motion accommodation is moot.
- **Server-supplied banner text via `/api/config`** — not requested; copy is hard-coded in the React tree.
- **Different banner text per integration (claude vs gemini vs opencode)** — out of scope; v0.5.0 only ships the Claude Code annotate path with offline support.

</deferred>

---

*Phase: 14-Offline Banner & Button Relabeling*
*Context gathered: 2026-05-07*
