# Phase 14: Offline Banner & Button Relabeling - Research

**Researched:** 2026-05-07
**Domain:** React 19 conditional render + CSS variable theming + pure-helper Vitest unit testing (no `@testing-library/react`)
**Confidence:** HIGH

## Summary

Phase 14 is render-only. It consumes the already-shipped `ConnectivityStatus` signal from `useHeartbeat()` (Phase 13, verified 2026-05-07 — `13-VERIFICATION.md` 5/5 passed) and produces three visible artifacts: (1) a persistent amber banner under `<PageHeader>` when offline, (2) three relabeled submit buttons with the offline strings, (3) two new CSS variables in `:root` and `[data-theme="light"]`. There is no new submit-path logic, no clipboard write, no animation, and no new dependency.

CONTEXT.md (D-01..D-13) and UI-SPEC.md have already locked color tokens, copy strings, mount point, padding, typography, and accessibility role. This research closes the only six remaining open questions: test strategy, module-mock pattern, exact JSX insertion site, prop threading, risk audit, and verification commands.

**Primary recommendation:** Extract a tiny pure helper module `ui/src/utils/offlineLabels.ts` with three label functions and the two banner copy constants. Co-locate `OfflineBanner` inside `App.tsx` per D-13. Call `useHeartbeat()` once at line ~543 (next to the `theme` state, before any data-loading effects) and thread the resulting `ConnectivityStatus` directly through three render-time ternaries — no Context, no prop drilling beyond the already-flat `App` body. Test the helper with a sibling Vitest file mirroring `connectivity.test.ts`. No `@testing-library/react`, no integration tests, no new dependencies. `npm test && npm run lint && npm run build` is the full verification cycle.

## Project Constraints (from CLAUDE.md)

These are mandatory directives the planner MUST honor:

1. **Test Coverage Requirements (WARNING-level for App.tsx).** `App.tsx` is being modified with new business logic (label-switch ternaries + banner-render branch). CLAUDE.md classifies modification of an existing module with new business logic as a WARNING, not a BLOCKER — but the planner MUST include a test task to clear the warning. The test task SHOULD target the extracted pure helper, not `App.tsx` directly. `[VERIFIED: ./CLAUDE.md "Test Coverage Requirements" section]`
2. **No `@testing-library/react`.** Not in `package.json` (verified — see Phase 13 RESEARCH.md A1 and the existing `connectivity.test.ts` / `useHeartbeat.test.ts` — both use plain Vitest with module mocks or pure helpers; zero React renderer harness). Adding it would contradict the bundle-size rule and break with project convention. `[VERIFIED: ui/package.json — no @testing-library/* dependency]`
3. **Inline-style convention.** `App.tsx` uses `style={{...}}` exclusively in JSX. No Tailwind utility classes in JSX. `[VERIFIED: ui/src/App.tsx:39-86 — PageHeader uses inline styles]`
4. **CSS variables under both themes.** Anything theme-dependent goes in `:root` (dark) and `[data-theme="light"]` blocks of `ui/src/index.css`. `[VERIFIED: ui/src/index.css:1-43]`
5. **Code quality gates for `ui/`.** `npm run lint` (eslint) and `npm test` (vitest run) — equivalent of the Rust `cargo fmt`/`cargo clippy` pre-commit. `cargo test` is irrelevant for this phase (no Rust touched). `[VERIFIED: ui/package.json scripts]`
6. **GSD workflow:** edits flow through `/gsd-plan-phase`. Already in flight. `[VERIFIED: this is gsd-phase-researcher invocation]`
7. **Single-binary distribution.** `ui/dist/` is embedded via `rust-embed`; bundle size matters. The phase adds zero new npm packages. `[VERIFIED: CLAUDE.md "Constraints" section]`

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Two relabeled buttons — NOT one combined button. Both Approve and Deny remain visible offline with new labels (resolves OFX-02 vs ROADMAP-success-criterion-3 wording conflict in favor of ROADMAP plural).
- **D-02:** Approve label offline → `Copy to clipboard — approve` (literal em dash U+2014).
- **D-03:** Outer Deny label offline → `Copy to clipboard — deny`. Outer Deny remains a toggle for the deny form (no behavior change).
- **D-04:** Inner Submit Denial label offline → `Copy to clipboard`.
- **D-05:** Online → buttons revert to existing `approveLabel` / `denyLabel` state and the static `Submit Denial`. The flip is computed at render time; do NOT mutate `approveLabel`/`denyLabel` React state on connectivity transitions.
- **D-06:** Banner copy ships byte-for-byte (two lines, em dash, ASCII straight apostrophe — see UI-SPEC.md Copywriting Contract for the exact bytes).
- **D-07:** Solid amber bar, no icon, full-width, between `<PageHeader>` and the appState block.
- **D-08:** New CSS vars `--color-banner-bg` / `--color-banner-text`. NOTE: UI-SPEC overrides D-08's literal light-theme text from `#f8fafc` to `#0f172a` to fix AA contrast. **Use the UI-SPEC value.**
- **D-09:** `role="status"` (polite live region). NOT `role="alert"`.
- **D-10:** Banner renders unconditionally on `connectivity === 'offline'`, regardless of `appState`.
- **D-11:** Banner does NOT replace `ErrorView`; they coexist.
- **D-12:** Single `useHeartbeat()` call at top of `App`. No React Context provider. Pass via props/render-scope reads.
- **D-13:** `OfflineBanner` is a colocated sub-component inside `App.tsx`, NOT a separate file.

### Claude's Discretion

- Test approach (pure helper vs component-level mocks) — **resolved in this research:** pure helper. See "Architecture Patterns → Pattern 1" below.
- Whether banner is `position: sticky` or normal flow — **resolved by UI-SPEC:** normal flow (UI-SPEC §Spacing).
- Banner padding/typography within reason — **resolved by UI-SPEC:** `16px 32px` padding, `14px / 400 / 1.5` typography, 8px line gap.

### Deferred Ideas (OUT OF SCOPE)

- CLB-01 / CLB-02: clipboard submit path & confirmation screen → Phase 15.
- OFX-03: textarea fallback when `navigator.clipboard` blocked → deferred.
- OFX-04: graceful online-recovery polish (e.g., "back online" toast) → deferred. The banner just disappears silently on recovery.
- Animation / transitions on banner mount/unmount or label flip → deferred.
- Server-supplied banner text via `/api/config` → deferred.
- Per-integration banner text (claude vs gemini vs opencode) → out of scope.
- Modifying `approve()` / `deny()` click handlers' bodies → Phase 15 owns the clipboard write; Phase 14 must NOT touch the bodies.

## Phase Requirements

| ID    | Description                                                                          | Research Support                                                                                                                                                                                                                                                                                            |
|-------|--------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| OFX-01 | When offline is detected, a persistent non-dismissable banner appears               | `OfflineBanner` sub-component rendered conditionally on `connectivity === 'offline'`. Mount point = between `<PageHeader>` (App.tsx:1075) and the appState block (App.tsx:1078). No close button, no localStorage flag, no escape handler. UI-SPEC §Layout & Interaction Contract enumerates the contract. |
| OFX-02 | When offline, submit buttons are replaced with a "Copy to clipboard" button         | Three render-time ternaries at App.tsx:1297 (`{approveLabel}`), App.tsx:1335 (`{denyLabel}`), App.tsx:1418 (`Submit Denial`). The literal text and the choice to relabel three buttons (not collapse to one) come from D-01..D-04. The pure helper `offlineLabels.ts` provides the three label functions. |

## Architectural Responsibility Map

| Capability                                  | Primary Tier      | Secondary Tier | Rationale                                                                                                                                                          |
|---------------------------------------------|-------------------|----------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Render the offline banner JSX               | Browser / Client  | —              | Pure presentational; consumes the `ConnectivityStatus` signal already produced in the browser by Phase 13.                                                          |
| Compute online vs offline button labels     | Browser / Client  | —              | Pure render-time ternary on a client-side signal; nothing to send to the server.                                                                                  |
| Define banner CSS variables                 | Browser / Client  | —              | Inline-style + CSS-variable system lives entirely in `ui/src/`.                                                                                                    |
| Decide which buttons exist (Approve, Deny) | Browser / Client  | —              | Layout decision; D-01 keeps both visible offline (only labels swap). No backend coupling.                                                                          |
| Read `ConnectivityStatus`                   | Browser / Client  | —              | The status is computed by `useHeartbeat()` (Phase 13) — already a client-side signal.                                                                              |
| Submitting the decision (POST /api/decide)  | Browser / Client  | API            | UNCHANGED in Phase 14. The button click handlers continue to POST to `/api/decide`. Phase 15 will swap this out for clipboard write.                              |

**Tier sanity check:** No work in API/SSR/static/database tiers. All Phase 14 work is in `ui/src/` (App.tsx + index.css + a new utils helper + its test).

## Standard Stack

### Core (already installed — verified)

| Library      | Version                          | Purpose                                  | Why Standard                                                                                                                  |
|--------------|----------------------------------|------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| react        | ^19.2.4 (registry: 19.2.6)       | Component model, conditional render      | Already the framework; introducing anything else is out of scope.                                                              |
| typescript   | ~6.0.2                           | Static typing for the new helper module  | Already configured.                                                                                                            |
| vitest       | ^4.1.4 (registry: 4.1.5)         | Unit test runner                         | Already wired (`ui/package.json` "test": `vitest run`); existing tests `connectivity.test.ts`, `useHeartbeat.test.ts`, `serializeAnnotations.test.ts` use it. |

### Supporting (zero new dependencies required)

| API/Module                       | Origin                  | Purpose                                          | When to Use                                                                                                                |
|----------------------------------|-------------------------|--------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| `useHeartbeat()`                 | `ui/src/hooks/useHeartbeat.ts` | Returns `ConnectivityStatus` ('online'\|'offline') | Call once at top of `App` body. Single consumer per D-12.                                                                  |
| `ConnectivityStatus` type        | `ui/src/utils/connectivity.ts`   | The signal type                                  | Import from `connectivity.ts` directly; the type is already exported there. Do NOT re-define.                              |
| `var(--color-banner-bg)` / `var(--color-banner-text)` | `ui/src/index.css` (NEW) | Theme-aware banner palette | Reference from the inline `style` of the banner element.                                                                   |
| Inline `style={{...}}`           | React                   | All visual presentation                          | Match the existing `App.tsx` convention (PageHeader, ErrorView, ConfirmationView all use inline styles).                     |

### Test-only Supporting (NEW — zero dependencies, recommended)

| Library                                  | Status         | Purpose                                | When to Use                                                                                                                  |
|------------------------------------------|----------------|----------------------------------------|------------------------------------------------------------------------------------------------------------------------------|
| `@testing-library/react`                 | NOT installed  | `renderHook`, `render` for testing components | DO NOT add. The pure-helper test approach below covers the contract without it. Phase 13 made the same call (RESEARCH A1). |
| `vi.mock('../hooks/useHeartbeat')`       | Built-in vitest | Module mock for component-level tests  | Not needed if the planner adopts the pure-helper pattern below. Documented in case the planner prefers it.                 |

**Recommendation: do NOT add `@testing-library/react`.** Three reasons: (1) Phase 13 already established the pure-helper precedent (`connectivity.ts` + `connectivity.test.ts`); (2) bundle-size rule from CLAUDE.md; (3) the offline label logic is structurally a pure function — it does not need a renderer to test.

### Alternatives Considered

| Instead of                                | Could Use                                                            | Tradeoff                                                                                                                                          |
|-------------------------------------------|---------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| Pure helper `offlineLabels.ts`            | Inline ternary `connectivity === 'offline' ? '...' : approveLabel` directly in JSX | Inline keeps the file count smaller but moves the testable logic out of reach of Vitest. CLAUDE.md test-coverage requirement is harder to satisfy without an extracted helper. The helper is 12 lines — extraction cost is trivial. |
| Pure helper module                        | A `useMemo` inside `App.tsx` that returns `{approveText, denyText, submitDenialText}` | `useMemo` is testable only via component mount — that requires `@testing-library/react`. Helper module preserves the no-renderer test rule.   |
| Extracting `OfflineBanner` to `ui/src/components/` | New file at `ui/src/components/OfflineBanner.tsx`                | Forbidden by D-13. Existing pattern is colocation in `App.tsx`.                                                                                  |
| New CSS class for the banner              | Tailwind utilities or a new `.offline-banner` block in `index.css`   | App.tsx uses inline `style` exclusively. Adding a CSS class for one element breaks the convention. Inline `style` with CSS vars is the right move. |
| Context provider for connectivity         | `<ConnectivityContext.Provider value={connectivity}>` wrapping `App` | Forbidden by D-12. Single consumer point; no need for Context.                                                                                  |
| Ref-based label-flip (mutate in place)    | Update `approveLabel`/`denyLabel` state via `setApproveLabel` on transition | Forbidden by D-05. State mutation breaks the "labels come from `/api/config`" invariant — an offline transition would persist offline strings into state and they'd survive the recovery transition. Render-time ternary is correct. |

**Installation:** None. Zero new packages.

**Version verification (run 2026-05-07 against `ui/package.json` and the registry):**

```bash
npm view react version
# 19.2.6 (installed: ^19.2.4 — within range)
npm view vitest version
# 4.1.5 (installed: ^4.1.4 — within range)
npm view typescript version
# 6.0.x (installed: ~6.0.2 — within range)
```
`[VERIFIED: ui/package.json read 2026-05-07]`

## Architecture Patterns

### System Architecture Diagram

```
                         +---------------------------+
                         |   ui/src/index.css        |
                         |   :root         {         |
                         |     --color-banner-bg     |
                         |     --color-banner-text   |
                         |   }                        |
                         |   [data-theme="light"] {  |
                         |     --color-banner-bg     |
                         |     --color-banner-text   |
                         |   }                        |
                         +-------------+-------------+
                                       | (referenced via var(...))
                                       v
   +-----------------------------+   +------------------------------+
   |  ui/src/utils/              |   |  ui/src/App.tsx              |
   |  offlineLabels.ts (NEW)     |   |                              |
   |                             |   |  function App() {            |
   |  OFFLINE_BANNER_LINE_1      |   |    const connectivity =      |
   |  OFFLINE_BANNER_LINE_2      |   |      useHeartbeat()          |
   |  OFFLINE_APPROVE_LABEL      |   |    ...                       |
   |  OFFLINE_DENY_LABEL         |   |    return (                  |
   |  OFFLINE_SUBMIT_DENIAL_LABEL|   |      <>                      |
   |                             |   |        <PageHeader />        |
   |  approveButtonLabel(s,d)    |   |        {connectivity ==       |
   |  denyButtonLabel(s,d)       |   |          'offline' &&        |
   |  submitDenialButtonLabel(s) |   |          <OfflineBanner />}  |
   |                             |   |        {appState != 'review' |
   |                             |   |          && <NonReview />}   |
   |                             |   |        {appState == 'review' |
   |                             |   |          && <ReviewLayout /> |
   |                             |   |        }                     |
   |                             |   |        {appState == 'review' |
   |                             |   |          && <ActionBar       |
   |                             |   |             connectivity={s} |
   |                             |   |             />}              |
   |                             |   |      </>                     |
   |                             |   |    )                          |
   |                             |   |  }                            |
   +-------------+---------------+   +-------+----------------------+
                 |                            |
                 | imported (label fns)       | imports useHeartbeat,
                 +----------------------------+ ConnectivityStatus
                                              v
                              +------------------------------+
                              |  ui/src/hooks/useHeartbeat.ts|
                              |  (Phase 13 — UNCHANGED)      |
                              +------------------------------+
                                              |
                                              v
                              +------------------------------+
                              |  ui/src/utils/connectivity.ts|
                              |  (Phase 13 — UNCHANGED;      |
                              |   re-exports                 |
                              |   ConnectivityStatus type)   |
                              +------------------------------+

   +-----------------------------+
   |  ui/src/utils/              |
   |  offlineLabels.test.ts (NEW)|  <-- imports offlineLabels.ts only
   |  Vitest pure-function tests |      (no DOM, no React harness)
   +-----------------------------+
```

### Recommended Project Structure

```
ui/src/
├── App.tsx                          # MODIFIED: 1 hook call + 1 sub-component + 4 ternaries
├── index.css                        # MODIFIED: 2 vars in :root, 2 vars in [data-theme="light"]
├── hooks/
│   ├── useHeartbeat.ts              # UNCHANGED (Phase 13)
│   ├── useHeartbeat.test.ts         # UNCHANGED (Phase 13)
│   └── useTextSelection.ts          # UNCHANGED
└── utils/
    ├── connectivity.ts              # UNCHANGED (Phase 13 — already exports ConnectivityStatus)
    ├── connectivity.test.ts         # UNCHANGED (Phase 13)
    ├── offlineLabels.ts             # NEW — Phase 14 deliverable (pure helper)
    ├── offlineLabels.test.ts        # NEW — Phase 14 deliverable (Vitest unit tests)
    ├── serializeAnnotations.ts      # UNCHANGED
    └── serializeAnnotations.test.ts # UNCHANGED
```

No new folder. No new file outside `ui/src/utils/` and the two `App.tsx` / `index.css` edits.

### Pattern 1: Pure helper module + sibling Vitest test (RECOMMENDED)

**What:** Extract the three label-selection functions and the two banner-copy constants into `ui/src/utils/offlineLabels.ts`. Test them directly in `offlineLabels.test.ts`. The hook and the JSX become thin call sites.

**When to use:** Whenever business logic can be reduced to a function whose inputs are values (not React state). Aligns with the project's no-`@testing-library/react` policy and mirrors `connectivity.ts` / `connectivity.test.ts` and `serializeAnnotations.ts` / `serializeAnnotations.test.ts`.

**Suggested helper signature:**

```ts
// ui/src/utils/offlineLabels.ts
import type { ConnectivityStatus } from './connectivity'

export const OFFLINE_BANNER_LINE_1 = 'Server connection lost — working offline.'
export const OFFLINE_BANNER_LINE_2 =
  "When you're done, copy your decision to the clipboard and paste it back into Claude."

export const OFFLINE_APPROVE_LABEL = 'Copy to clipboard — approve'
export const OFFLINE_DENY_LABEL = 'Copy to clipboard — deny'
export const OFFLINE_SUBMIT_DENIAL_LABEL = 'Copy to clipboard'

export function approveButtonLabel(
  status: ConnectivityStatus,
  defaultLabel: string,
): string {
  return status === 'offline' ? OFFLINE_APPROVE_LABEL : defaultLabel
}

export function denyButtonLabel(
  status: ConnectivityStatus,
  defaultLabel: string,
): string {
  return status === 'offline' ? OFFLINE_DENY_LABEL : defaultLabel
}

export function submitDenialButtonLabel(status: ConnectivityStatus): string {
  return status === 'offline' ? OFFLINE_SUBMIT_DENIAL_LABEL : 'Submit Denial'
}
```

**Test file (mirrors `connectivity.test.ts` style — see "Code Examples" section for the full test body).**

`[VERIFIED: codebase grep — connectivity.test.ts and serializeAnnotations.test.ts both follow this pure-function pattern with `describe`/`it` and no React renderer]`

### Pattern 2: Render-time ternary at the call site

**What:** Each of the three button label sites in `App.tsx` becomes a single ternary calling the helper. Do NOT mutate `approveLabel`/`denyLabel` state.

**When to use:** Whenever the displayed value is a derived view of a signal — never store a derived value in state if the source is already in state.

**Example (the three sites):**

```tsx
// ui/src/App.tsx — line ~1297 (Approve button text)
{approveButtonLabel(connectivity, approveLabel)}
// keep the existing "↵ Enter" hint <span> right after, unchanged

// ui/src/App.tsx — line ~1335 (Outer Deny button text)
{denyButtonLabel(connectivity, denyLabel)}

// ui/src/App.tsx — line ~1418 (Inner Submit Denial button text)
{submitDenialButtonLabel(connectivity)}
```

`[VERIFIED: ui/src/App.tsx:1297, 1335, 1418 — these are the exact lines today; confirmed via direct read of App.tsx]`

### Pattern 3: Colocated `OfflineBanner` sub-component

**What:** Function-declared `OfflineBanner` in `App.tsx`, alongside `PageHeader`, `LoadingSpinner`, `ErrorView`, `ConfirmationView`. Zero props. Imports the two banner constants from `offlineLabels.ts`. Inline-styled.

**When to use:** Match D-13 and the existing colocation pattern.

**Example:**

```tsx
// ui/src/App.tsx — co-located with PageHeader / LoadingSpinner / ErrorView
import { OFFLINE_BANNER_LINE_1, OFFLINE_BANNER_LINE_2 } from './utils/offlineLabels'

function OfflineBanner() {
  return (
    <div
      role="status"
      style={{
        background: 'var(--color-banner-bg)',
        color: 'var(--color-banner-text)',
        padding: '16px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'flex-start',
        fontSize: '14px',
        fontWeight: 400,
        lineHeight: 1.5,
        flexShrink: 0,
      }}
    >
      <div>{OFFLINE_BANNER_LINE_1}</div>
      <div>{OFFLINE_BANNER_LINE_2}</div>
    </div>
  )
}
```

Why two `<div>` children with `gap: 8px` instead of one `<p>` with `<br />`: the UI-SPEC §Live-Region Behavior says both lines should be a single utterance. With `role="status"` (which implies `aria-atomic="true"`), screen readers read the entire subtree as one announcement regardless of whether the children are `<div>` or `<p>` — but `<div>`+`<div>`+`gap` is the cleanest way to get the 8 px line gap without per-child margin bookkeeping. `[VERIFIED: UI-SPEC.md §Layout & Interaction Contract]`

`flexShrink: 0` is the only addition beyond what UI-SPEC dictates — the parent `<div>` of `App` is `flex-direction: column`, and without `flexShrink: 0` the banner would compress when the action bar grows to consume vertical space on small viewports. The page header also uses `flexShrink: 0` for the same reason (App.tsx:51). `[VERIFIED: ui/src/App.tsx:51]`

### Pattern 4: Threading `connectivity` from `App` to action bar without prop drilling

**What:** Phase 14 has only ONE distant consumer of `connectivity` outside the banner: the three button labels live inside the action bar JSX, which is currently inlined inside `App`'s return tree (App.tsx:1206-1422). There is no intermediate component to pass through. The action bar is just JSX in `App`'s body — `connectivity` is in scope automatically.

**When to use:** When the consumer tree is shallow, do not extract a component just to pass props.

**Decision:** Keep the action bar inline. Do NOT extract `<ActionBar />` as a sub-component. The four sites (banner conditional + three button label ternaries) all read `connectivity` directly from the `useHeartbeat()` call result, which is a local `const` in `App`'s body.

**Why not extract `<ActionBar />`:**
- It's not in the existing colocation list (PageHeader, LoadingSpinner, ErrorView, ConfirmationView). Adding it would change the file's component-extraction policy and is unrelated to Phase 14's scope.
- It would force a 6+ prop signature (`approveLabel`, `denyLabel`, `connectivity`, `denyOpen`, `setDenyOpen`, `denyMessage`, `setDenyMessage`, `denyMessageValid`, `approve`, `deny`, `denyTextareaRef`, `denyButtonRef`, `overallComment`, `setOverallComment`) — all the action bar's existing inline references to `App` body locals.
- D-12 explicitly ruled out a Context provider; the equivalent argument applies to component extraction.

`[VERIFIED: ui/src/App.tsx:1206-1422 — action bar is currently inline JSX inside App's return]`

### Pattern 5: CSS variables in both theme blocks

**What:** Add the same two variable names to `:root` (dark) and `[data-theme="light"]` blocks of `ui/src/index.css`. The values differ; the names are identical so the inline `style` reference resolves to the right token under either theme.

**Example (locked values — copy verbatim):**

```css
/* ui/src/index.css — :root block, after the existing dark-theme vars */
:root {
  /* ...existing dark vars (lines 4-21)... */
  --color-banner-bg: #f59e0b;
  --color-banner-text: #0f1117;
}

[data-theme="light"] {
  /* ...existing light vars (lines 25-42)... */
  --color-banner-bg: #d97706;
  --color-banner-text: #0f172a;  /* UI-SPEC override of D-08 literal #f8fafc — AA contrast */
}
```

**Why two separate var names rather than reusing existing tokens:** UI-SPEC §Color is explicit that the banner is a NEW semantic surface (connectivity-warning), not part of the 60/30/10 surface palette. Reusing `--color-text-primary` for the banner text would tie the two concerns together; if the project later changes the dominant text color, the banner contrast would break unintentionally. Distinct vars decouple the two.

`[VERIFIED: UI-SPEC.md §Color, lines 96-130]`

### Anti-Patterns to Avoid

- **Mutating `approveLabel` / `denyLabel` React state on connectivity transitions.** Forbidden by D-05. The state is sourced from `/api/config` (Phase 11.1) and serves as the *online* default. Overwriting it on transition would persist offline strings into state and survive the recovery transition. Render-time ternary is the correct shape.
- **Adding `offline` as an `AppState` variant.** Forbidden by STATE.md and reiterated by Phase 13's research. `ConnectivityStatus` is parallel; do not merge.
- **Wrapping the banner in `<header>` / `<aside>` / `<section>`.** UI-SPEC §Layout calls for `<div role="status">`. Semantic elements add ARIA implications that may conflict with the polite live-region role.
- **Calling `useHeartbeat()` more than once in the tree.** Each call sets up its own interval, listener, and AbortController. A second call doubles the network traffic and breaks the visibility-pause invariant in unpredictable ways. D-12 mandates a single call at the top of `App`.
- **Adding `tabindex="0"` or any focusable child to the banner.** UI-SPEC §Tab Order forbids it; the banner contains no interactive content.
- **Using `role="alert"` (or `aria-live="assertive"`).** UI-SPEC §Live-Region forbids — too disruptive for a non-destructive status.
- **Animating the banner mount/unmount or label flip.** UI-SPEC §Animation forbids; CONTEXT `<deferred>` confirms.
- **Hard-coding `'offline'` / `'online'` string literals throughout `App.tsx`.** Use the `ConnectivityStatus` type from `connectivity.ts` and the helper functions from `offlineLabels.ts`. Hard-coding scatters change blast radius.
- **Reading `useHeartbeat()` inside `OfflineBanner`.** Two consumers ⇒ two intervals (anti-pattern above). The `App`-level call is single-source.
- **Wrapping the banner inside the existing `appState !== 'reviewing'` block (App.tsx:1078) or the `appState === 'reviewing'` block (App.tsx:1089).** D-10 demands `OfflineBanner` lives between `<PageHeader>` and the appState block, NOT inside it. Putting it inside one branch makes it disappear on the other branch.

## Don't Hand-Roll

| Problem                                | Don't Build                                          | Use Instead                                                       | Why                                                                                                                          |
|----------------------------------------|------------------------------------------------------|-------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|
| Connectivity polling                   | A second polling effect or `navigator.onLine` listener | `useHeartbeat()` from Phase 13                                    | Already shipped, tested, and locked by D-12 as the single source.                                                            |
| Theme-aware colors                     | Conditional inline color based on `theme` state      | Two CSS variables defined in both theme blocks                    | The existing CSS-variable system already handles theme switching; bolting on JS-driven color picks would break parity with all other tokens. |
| Markdown rendering of banner copy      | `marked.parse(bannerText)` or HTML injection         | Plain text in two `<div>` children                                | Banner copy is plain sentences; introducing markdown rendering opens an XSS surface for zero benefit.                       |
| Label-flip via `useEffect` on connectivity transitions | `useEffect(() => { if(connectivity==='offline') setApproveLabel('Copy ...') }, [connectivity])` | Render-time ternary using the helper functions                    | `useEffect` causes an extra render and persists offline strings into state — survives the offline→online transition wrong. Render-time ternary is computed lazily on each render and reverts cleanly. |
| Component-level test of the banner     | `@testing-library/react` + `render(<App />)`         | Pure helper test on `offlineLabels.ts`                            | Forbidden by project convention; would add a dependency the codebase has consciously avoided.                                |
| Live-region polite announcement        | `aria-live="polite"` + `aria-atomic="true"` on the div manually | `role="status"`                                                   | `role="status"` already implies both. Setting them manually is redundant and risks a typo.                                  |

**Key insight:** The phase is small, but the value lies in *not* doing the wrong thing. Every "Don't Build" entry above is a tempting wrong path that survives a casual implementation reading.

## Common Pitfalls

### Pitfall 1: Banner mount inside the wrong appState branch

**What goes wrong:** Engineer puts `<OfflineBanner />` inside the `appState === 'reviewing'` block (App.tsx:1089). The banner disappears whenever `appState` is `loading`, `error`, or `confirmed` — but those are exactly the states where the user most needs the offline indicator (e.g., `/api/plan` 500'd because the server is gone).

**Why it happens:** Visual ordering temptation — "the banner is below the header and above the review columns, so it goes inside the column block."

**How to avoid:** Mount the banner OUTSIDE both appState branches, at App.tsx:~1076 (between `<PageHeader />` and the `appState !== 'reviewing'` block). Verify with this DOM walk in DevTools after offlining: `document.querySelector('[role="status"]')` should be a sibling of, not a descendant of, the appState branches.

**Warning signs:** Banner only appears during one or two of the four appStates; banner disappears when ErrorView shows.

`[VERIFIED: D-10 mandates appState-independent visibility; UI-SPEC §Banner Placement diagram shows the correct DOM order]`

### Pitfall 2: `flexShrink` not set on the banner

**What goes wrong:** On a viewport where the action bar plus content fills more than the available height, the parent `display: flex; flex-direction: column` distributes the overflow by shrinking each child. The banner's height (~58 px) shrinks to fit, truncating the second line of copy or eating part of the padding.

**Why it happens:** The default `flex-shrink` value is `1` for flex children. The page header explicitly sets `flexShrink: 0` (App.tsx:51); the banner needs the same.

**How to avoid:** Add `flexShrink: 0` to the banner's inline style. Confirm by mounting at `375px` width and triggering the offline state — both lines must remain readable.

**Warning signs:** Banner copy clipped on small viewports; banner height jumps when the deny form opens.

`[VERIFIED: ui/src/App.tsx:51 — page header uses flexShrink: 0; banner needs identical treatment in the same flex context]`

### Pitfall 3: Inline em dash typed as two hyphens or hyphen-minus

**What goes wrong:** Engineer types `--` or `-` instead of `—` (U+2014) in `Copy to clipboard — approve`. Tests pass against the literal-typed source but the rendered string is incorrect. Worse: an autocompleting editor may "fix" `--` to `–` (en dash, U+2013) silently.

**Why it happens:** US keyboards do not have a dedicated em dash key. ESLint and TypeScript do not flag this.

**How to avoid:** (1) Define the constants once in `offlineLabels.ts`, never inline; (2) the Vitest tests assert string equality against `'Copy to clipboard — approve'` etc. — the test will fail if the dash is wrong; (3) use a hex/Unicode-aware grep in CI: `grep -P '\x{2014}' ui/src/utils/offlineLabels.ts` should find at least 3 hits (banner line 1, approve label, deny label).

**Warning signs:** UI-SPEC verification "byte-for-byte" check fails; clipboard JSON in Phase 15 contains a different dash than the spec text.

`[VERIFIED: UI-SPEC.md §Copywriting Contract — "literal Unicode character, NOT a hyphen-minus and NOT two hyphens"]`

### Pitfall 4: ASCII apostrophe vs curly Unicode apostrophe in `you're`

**What goes wrong:** A copy-paste from a markdown source or an autocorrecting editor inserts `you're` (U+2019, right single quotation mark) instead of `you're` (U+0027, ASCII apostrophe). Strings render visually identical but compare unequal.

**Why it happens:** Default macOS text input has "smart quotes" enabled in some contexts.

**How to avoid:** Define in `offlineLabels.ts` once. The Vitest assertion `expect(OFFLINE_BANNER_LINE_2).toBe("When you're done, copy your decision to the clipboard and paste it back into Claude.")` enforces the exact byte sequence. CI grep: `grep -c $'’' ui/src/utils/offlineLabels.ts` should return 0.

**Warning signs:** UI-SPEC byte-for-byte check fails.

`[VERIFIED: UI-SPEC.md §Copywriting Contract — "straight apostrophe ' is the ASCII U+0027, not the curly U+2019"]`

### Pitfall 5: Banner shifts layout when it appears on offline transition

**What goes wrong:** When the banner appears (offline transition), the content below shifts down by ~58 px. If the user is mid-scroll in the plan, their reading position jumps. When the banner disappears (recovery), the position jumps back up.

**Why it happens:** The banner is in normal flow (UI-SPEC §Spacing forbids `position: sticky`/`fixed`), so adding/removing it changes the page's layout box. The two-column review layout uses `overflow: hidden` on the outer container (App.tsx:1095) and `overflowY: auto` on the inner panes (App.tsx:1116) — meaning the column scroll position is preserved across the layout shift, but the *visible top* of the column moves.

**How to avoid:** This is intrinsic to the locked design (D-07 + UI-SPEC normal-flow). Two mitigations are acceptable:
1. Document as expected behavior — offline transitions are rare (server killed by Claude Code), recovery is rarer still. The visual jump is a feature, not a bug, because it announces the state change to a sighted user.
2. If the planner wants to silence the jump, they can reserve the banner's height with a sibling spacer that becomes visible-but-empty when online — but UI-SPEC §Spacing explicitly forbids any spacer ("Margin between banner and content beneath: 0px"). The planner MUST NOT add a spacer.

The recommended path is mitigation 1 (do nothing). Add a verification-checklist line: "Banner mount/unmount causes a single, instantaneous layout reflow with no layout-shift artifacts."

**Warning signs:** Phase 14 review feedback about "the page jumps when the banner appears."

`[ASSUMED]: The reflow is acceptable. UI-SPEC.md does not mention layout-shift CLS handling, and OFX-04 (graceful recovery polish) is explicitly deferred. If the planner disagrees, surface to the user before locking the plan.`

### Pitfall 6: Calling `useHeartbeat()` inside `OfflineBanner` instead of `App`

**What goes wrong:** Engineer reads "the banner needs to know about connectivity" and adds `const connectivity = useHeartbeat()` inside `OfflineBanner`. Now the hook is mounted twice (once in `App`, once in the banner) — TWO 5-second intervals, TWO visibility listeners, TWO AbortControllers. Network tab shows pings every 2.5 s on average. The action bar's button labels read from the App-level call, the banner from its own call — they can momentarily disagree during the offline transition.

**Why it happens:** "The banner is the consumer, so the hook lives in the banner."

**How to avoid:** Single call at top of `App` body (D-12). `OfflineBanner` is rendered conditionally on the App-level value, not on its own. Smoke check: open DevTools Network tab, force the offline state, count `/api/ping` requests over a 30s window — should be exactly 6.

**Warning signs:** Doubled ping rate in DevTools; ESLint react-hooks warnings about hook count if the planner ever conditionally renders `OfflineBanner` (which they must NOT — `OfflineBanner` always exists in the tree, just `null`-rendered when online).

`[VERIFIED: D-12 mandates single call site]`

### Pitfall 7: `connectivity` not in the deps array of memoized callbacks (false alarm)

**What goes wrong:** ESLint react-hooks/exhaustive-deps warns that `connectivity` is missing from `useCallback`/`useMemo` dependency arrays in `App.tsx`.

**Why it doesn't actually happen here:** `connectivity` is read at *render time* in three ternaries and one conditional render. None of those sites are inside a `useCallback` or `useMemo`. The existing `approve()` and `deny()` callbacks (App.tsx:~1030-1062) are NOT modified in this phase — they continue to POST to `/api/decide` regardless of `connectivity`. So ESLint will not complain.

**How to verify:** After implementation, `cd ui && npm run lint` — if ESLint surfaces an exhaustive-deps warning mentioning `connectivity`, the planner has accidentally captured the variable in a memoized callback. Move the read to render time.

`[ASSUMED]: ESLint config enforces react-hooks/exhaustive-deps as warning. Verified package.json:30 — eslint-plugin-react-hooks ^7.0.1 is installed; exact rule level not inspected. Risk if wrong: false-positive lint warning easily fixed.`

### Pitfall 8: `connectivity` referenced in JSX before the `useHeartbeat()` call site

**What goes wrong:** The planner adds `useHeartbeat()` near the bottom of `App`'s body initialization (e.g., line 1000) but the JSX consumer at line 1075 still gets `undefined`-during-mount. With React 19 hooks rules enforced, this would be flagged as conditional hook ordering.

**Why this doesn't happen:** Hook calls in `App` are at the body's top (line 539+ region), BEFORE the `return` JSX. `connectivity` will exist in scope by the time the return statement runs, regardless of where in the hook block it sits.

**How to avoid:** Place `useHeartbeat()` call adjacent to existing hook calls — recommended: immediately after the `theme` state initialization (`App.tsx:540`) and before the data-loading state (`App.tsx:551`). It is a derived signal, not user-driven state, so the order matters only for readability.

**Warning signs:** None — if the planner accidentally places the call inside a conditional, ESLint react-hooks/rules-of-hooks will block.

`[VERIFIED: ui/src/App.tsx body structure — hooks live in lines 539-590, return JSX starts at line 1067]`

## Code Examples

### Verified pattern: pure helper test (sibling Vitest file)

```ts
// ui/src/utils/offlineLabels.test.ts
// Source: codebase pattern (ui/src/utils/connectivity.test.ts)
import { describe, it, expect } from 'vitest'
import {
  OFFLINE_BANNER_LINE_1,
  OFFLINE_BANNER_LINE_2,
  OFFLINE_APPROVE_LABEL,
  OFFLINE_DENY_LABEL,
  OFFLINE_SUBMIT_DENIAL_LABEL,
  approveButtonLabel,
  denyButtonLabel,
  submitDenialButtonLabel,
} from './offlineLabels'

describe('offlineLabels constants', () => {
  it('Test 1: banner line 1 ships byte-for-byte', () => {
    expect(OFFLINE_BANNER_LINE_1).toBe(
      'Server connection lost — working offline.',
    )
  })

  it('Test 2: banner line 2 ships byte-for-byte', () => {
    expect(OFFLINE_BANNER_LINE_2).toBe(
      "When you're done, copy your decision to the clipboard and paste it back into Claude.",
    )
  })

  it('Test 3: approve offline label uses em dash', () => {
    expect(OFFLINE_APPROVE_LABEL).toBe('Copy to clipboard — approve')
  })

  it('Test 4: deny offline label uses em dash', () => {
    expect(OFFLINE_DENY_LABEL).toBe('Copy to clipboard — deny')
  })

  it('Test 5: submit-denial offline label is the bare phrase', () => {
    expect(OFFLINE_SUBMIT_DENIAL_LABEL).toBe('Copy to clipboard')
  })
})

describe('approveButtonLabel', () => {
  it('Test 6: returns default when online', () => {
    expect(approveButtonLabel('online', 'Approve')).toBe('Approve')
  })

  it('Test 7: preserves a custom default (Phase 11.1) when online', () => {
    expect(approveButtonLabel('online', 'No issues')).toBe('No issues')
  })

  it('Test 8: returns offline label when offline (default Approve)', () => {
    expect(approveButtonLabel('offline', 'Approve')).toBe(OFFLINE_APPROVE_LABEL)
  })

  it('Test 9: offline label overrides any custom default', () => {
    expect(approveButtonLabel('offline', 'No issues')).toBe(OFFLINE_APPROVE_LABEL)
  })
})

describe('denyButtonLabel', () => {
  it('Test 10: returns default when online', () => {
    expect(denyButtonLabel('online', 'Deny')).toBe('Deny')
  })

  it('Test 11: preserves a custom default (Phase 11.1) when online', () => {
    expect(denyButtonLabel('online', 'Leave feedback')).toBe('Leave feedback')
  })

  it('Test 12: returns offline label when offline (default Deny)', () => {
    expect(denyButtonLabel('offline', 'Deny')).toBe(OFFLINE_DENY_LABEL)
  })

  it('Test 13: offline label overrides any custom default', () => {
    expect(denyButtonLabel('offline', 'Leave feedback')).toBe(OFFLINE_DENY_LABEL)
  })
})

describe('submitDenialButtonLabel', () => {
  it('Test 14: returns default when online', () => {
    expect(submitDenialButtonLabel('online')).toBe('Submit Denial')
  })

  it('Test 15: returns offline label when offline', () => {
    expect(submitDenialButtonLabel('offline')).toBe(OFFLINE_SUBMIT_DENIAL_LABEL)
  })
})
```

`[VERIFIED: pattern matches ui/src/utils/connectivity.test.ts and ui/src/utils/serializeAnnotations.test.ts conventions]`

### Verified pattern: exact `App.tsx` integration sites

The four edit sites in `App.tsx`:

```tsx
// ── Edit 1: Imports (top of file, after line 4) ────────────────────────
import { useHeartbeat } from './hooks/useHeartbeat'
import {
  OFFLINE_BANNER_LINE_1,
  OFFLINE_BANNER_LINE_2,
  approveButtonLabel,
  denyButtonLabel,
  submitDenialButtonLabel,
} from './utils/offlineLabels'

// ── Edit 2: OfflineBanner sub-component (after ErrorView, ~line 150) ───
function OfflineBanner() {
  return (
    <div
      role="status"
      style={{
        background: 'var(--color-banner-bg)',
        color: 'var(--color-banner-text)',
        padding: '16px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'flex-start',
        fontSize: '14px',
        fontWeight: 400,
        lineHeight: 1.5,
        flexShrink: 0,
      }}
    >
      <div>{OFFLINE_BANNER_LINE_1}</div>
      <div>{OFFLINE_BANNER_LINE_2}</div>
    </div>
  )
}

// ── Edit 3: Hook call inside App() body (after `theme` state, ~line 543) ─
const connectivity = useHeartbeat()

// ── Edit 4a: Banner mount point (between line 1075 and 1078) ───────────
<PageHeader activeTab={activeTab} onTabChange={setActiveTab} theme={theme} onThemeToggle={handleThemeToggle} />
{connectivity === 'offline' && <OfflineBanner />}

{/* Non-reviewing states: loading, error, confirmed */}
{appState !== 'reviewing' && ( ... )}

// ── Edit 4b: Approve label site (line 1297) ────────────────────────────
{approveButtonLabel(connectivity, approveLabel)}

// ── Edit 4c: Outer Deny label site (line 1335) ─────────────────────────
{denyButtonLabel(connectivity, denyLabel)}

// ── Edit 4d: Inner Submit Denial label site (line 1418) ────────────────
{submitDenialButtonLabel(connectivity)}
```

`[VERIFIED: line numbers re-confirmed via direct read of ui/src/App.tsx 2026-05-07]`

### Verified pattern: `index.css` additions

```css
/* ui/src/index.css — appended INSIDE the existing :root block, after line 21 */
:root {
  /* ...existing dark theme tokens... */
  --color-link: #60a5fa;
  --color-banner-bg: #f59e0b;
  --color-banner-text: #0f1117;
}

/* ui/src/index.css — appended INSIDE the existing [data-theme="light"] block, after line 42 */
[data-theme="light"] {
  /* ...existing light theme tokens... */
  --color-link: #1d4ed8;
  --color-banner-bg: #d97706;
  --color-banner-text: #0f172a; /* UI-SPEC override of D-08 literal #f8fafc — AA contrast 5.60:1 */
}
```

`[VERIFIED: ui/src/index.css read 2026-05-07; line numbers in CONTEXT.md "after line 21" / "after line 42" map to the closing brace of each block — actual insertion is at line 21 (last line before `}`) and line 42 (last line before `}`).]`

### Verified pattern: smoke test for offline forcing in `npm run dev`

To exercise the offline state during local dev without killing the binary, the developer can use Chrome DevTools `Network → Throttling → Offline`. This makes `fetch('/api/ping')` reject with a network error. After 3 ticks (~15 s), `useHeartbeat` flips to `'offline'` and the banner appears. Toggle back to "No throttling" and after one successful ping (~5 s), the banner disappears. This is the most reliable manual smoke test for Phase 14.

Alternative: kill the running `cargo run -- review some.md` process. The next ping fails with `fetch failed`; same 15s offline transition. `[ASSUMED]: Standard DevTools workflow; no project-specific smoke harness.`

## State of the Art

| Old Approach                                 | Current Approach                                        | When Changed       | Impact                                                                                                              |
|----------------------------------------------|---------------------------------------------------------|--------------------|---------------------------------------------------------------------------------------------------------------------|
| `aria-live="polite"` + `aria-atomic="true"` manually | `role="status"` (implies both)                       | ARIA 1.1+ (2017)    | Single attribute, fewer typos.                                                                                     |
| Theme via JS-driven inline color picks       | CSS variables in `[data-theme="..."]` blocks            | Project pattern (Phase 8) | Standard for this codebase; no JS branching needed for theme switching.                                       |
| Component-level testing with `@testing-library/react` | Pure-helper tests + Vitest                       | Project policy      | Smaller bundle, simpler tests, faster runs.                                                                        |
| Mutating React state on derived transitions  | Computing the derived value at render time              | React idiom         | Avoids state staleness during recovery transitions.                                                                |
| `<header>` / `<aside>` for status bars       | `<div role="status">`                                   | ARIA design pattern | The semantic landmark roles imply page navigation structure; `role="status"` is the correct ephemeral notification. |

**Deprecated/outdated:**
- Adding `--color-banner-bg` only to `:root` and assuming the light theme inherits — the `[data-theme="light"]` block re-declares vars, not augments. Both blocks must list the new vars.

## Validation Architecture

> Skipped — `workflow.nyquist_validation: false` in `.planning/config.json` (verified: line 12).

## Security Domain

> Skipped — `security_enforcement` is not present in `.planning/config.json` and this phase introduces no auth, input validation surface, secrets, or new attack surface. The banner is plain text from a constant; the relabeled buttons retain their existing click handlers (which already POST to a same-origin local endpoint with JSON body).

## Environment Availability

| Dependency      | Required By                                         | Available | Version              | Fallback                                                       |
|-----------------|-----------------------------------------------------|-----------|----------------------|----------------------------------------------------------------|
| Node + npm      | Vite, Vitest, ESLint                                | yes       | (project-local)      | —                                                              |
| `vitest`        | Test execution (`npm test`)                         | yes       | 4.1.4 (registry 4.1.5) | —                                                            |
| `eslint`        | Lint gate (`npm run lint`)                          | yes       | 9.39.4                | —                                                              |
| `react`         | Component model                                     | yes       | 19.2.4 (registry 19.2.6) | —                                                          |
| `useHeartbeat()` | Connectivity signal (Phase 13 deliverable)          | yes       | shipped 2026-05-07   | —                                                              |
| `ConnectivityStatus` type | Typed signal                                | yes       | shipped 2026-05-07   | —                                                              |
| Local axum binary running on 127.0.0.1 | Manual smoke test of offline→online transition | yes (Phase 12 shipped) | — | —                                                  |
| `@testing-library/react` | Component-level tests (NOT recommended)     | NO        | —                    | Use pure-helper tests on `offlineLabels.ts` — recommended.   |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `@testing-library/react` is the only candidate; the recommended approach avoids it entirely.

## Files Modified

| Path                                            | Status   | Purpose                                                                                                          |
|-------------------------------------------------|----------|------------------------------------------------------------------------------------------------------------------|
| `ui/src/App.tsx`                                | MODIFIED | Add 1 import block, 1 colocated `OfflineBanner` sub-component, 1 `useHeartbeat()` call in body, 1 conditional banner mount, 3 button-label ternaries. |
| `ui/src/index.css`                              | MODIFIED | Add `--color-banner-bg` and `--color-banner-text` to `:root` AND `[data-theme="light"]` blocks (4 lines total).  |
| `ui/src/utils/offlineLabels.ts`                 | NEW      | Pure helper module: 5 string constants + 3 label functions.                                                      |
| `ui/src/utils/offlineLabels.test.ts`            | NEW      | 15 Vitest pure-function unit tests covering constants and the three label functions across both connectivity states. |

**No file removed.** **No file in `ui/src/components/`** (forbidden by D-13). **No `ui/package.json` change.**

## Verification Commands

| Step | Command                                              | Expected                                                                                                         |
|------|------------------------------------------------------|------------------------------------------------------------------------------------------------------------------|
| 1    | `cd ui && npm test -- --run`                         | All Vitest tests pass: existing 15 tests + 15 new = 30 total. `Test Files: 3 passed (3)`.                         |
| 2    | `cd ui && npm run lint`                              | Exit 0, no output. ESLint clean — including no react-hooks/exhaustive-deps warnings for `connectivity`.          |
| 3    | `cd ui && npm run build`                             | TypeScript compile + Vite bundle. Exit 0. Warns: none.                                                            |
| 4    | `grep -P '\x{2014}' ui/src/utils/offlineLabels.ts`   | At least 3 hits (line-1 banner copy + approve label + deny label). Confirms em dash is U+2014, not `--`.         |
| 5    | `grep -c $'’' ui/src/utils/offlineLabels.ts`    | 0. Confirms ASCII apostrophe in `you're` (U+0027), not curly U+2019.                                              |
| 6    | `grep -c 'role="status"' ui/src/App.tsx`             | 1. Confirms `OfflineBanner` uses `role="status"` and exactly one such role exists in App.tsx.                    |
| 7    | `grep -c 'role="alert"' ui/src/App.tsx`              | 0. Confirms no accidental `role="alert"`.                                                                        |
| 8    | `grep -c 'useHeartbeat()' ui/src/App.tsx`            | 1. Single call site (D-12 invariant).                                                                            |
| 9    | `grep -cE '\-\-color-banner-(bg\|text)' ui/src/index.css` | 4. Two vars × two themes.                                                                                  |
| 10   | Manual smoke: `cargo run -- review tests/fixtures/sample.md` then DevTools Network → Offline | After ~15 s the amber banner appears; both lines render. Toggle back to "No throttling": after ~5 s the banner disappears. Action bar buttons swap labels in both directions. |
| 11   | Manual smoke: theme toggle while offline             | Banner background switches from `#f59e0b` (dark) to `#d97706` (light) and text from `#0f1117` (dark) to `#0f172a` (light). Both pass AA contrast. |
| 12   | Manual smoke: keyboard tab order                     | Tabbing through the page does NOT land on the banner. Approve → Outer Deny → Submit Denial (when open) tab order is preserved. |
| 13   | Manual smoke: annotation interactivity while offline | Text selection, comment textarea, deny textarea, theme toggle, tab bar all remain fully interactive. No backdrop, no `pointer-events: none`. |

`[VERIFIED: commands 1-9 against existing project tooling; commands 10-13 are manual UI smoke tests derived from UI-SPEC verification checklist]`

## Risk Audit

| Risk | Severity | Mitigation |
|------|----------|------------|
| Banner mounted inside `appState === 'reviewing'` block | HIGH | Pitfall 1 — explicit verification step in plan: "Banner is a sibling of, not a descendant of, the `appState !== 'reviewing'` block." |
| Em dash typed as `--` or hyphen-minus | HIGH | Pitfall 3 — Vitest assertion `—` + grep verification step. |
| Curly apostrophe in `you're` | MEDIUM | Pitfall 4 — grep verification step. |
| Banner lacks `flexShrink: 0`, clips on small viewports | MEDIUM | Pitfall 2 — explicit `flexShrink: 0` in OfflineBanner inline style. |
| Engineer mutates `approveLabel`/`denyLabel` state | MEDIUM | D-05 explicit; helper functions take default as a parameter rather than reading from React state directly — discourages the bad pattern. |
| Engineer extracts `OfflineBanner` to `ui/src/components/` | LOW | D-13 explicit; verification grep `find ui/src/components -name 'OfflineBanner*'` should return nothing. |
| Engineer adds `@testing-library/react` to package.json | LOW | Plan-checker can grep `package.json` for `@testing-library` and BLOCK if present. |
| Engineer puts `useHeartbeat()` call inside `OfflineBanner` | LOW | Pitfall 6; manual smoke check on ping rate (should be 1/5s, not 2/5s). |
| Light-theme banner uses D-08 literal `#f8fafc` (3.04:1 contrast) instead of UI-SPEC override `#0f172a` | LOW | UI-SPEC §Color override rationale is locked; verification step 11 confirms theme switch produces the override value. |
| Layout shift on offline transition | LOW (intrinsic) | Pitfall 5 — accept as expected; document in verification checklist. |
| Banner copy regressed on a future Phase 15 / 16 edit | LOW | Constants in `offlineLabels.ts` + Vitest assertions are the regression gate. |
| Action bar extracted to a separate component, breaking inline-`connectivity` access | LOW | Plan should explicitly forbid extraction (Pattern 4 rationale). Plan-checker review can flag any new `<ActionBar>` JSX site. |

## Assumptions Log

| #  | Claim                                                                                                                                                  | Section                  | Risk if Wrong                                                                                                                       |
|----|--------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| A1 | The recommended pure-helper test pattern is the right call vs. component-level tests.                                                                 | Pattern 1, Standard Stack | Reviewer prefers integration tests; planner can add `@testing-library/react` later. Low risk — both satisfy CLAUDE.md test-coverage rule. |
| A2 | Layout shift on offline-transition mount/unmount is acceptable user-visible behavior for v0.5.0.                                                      | Pitfall 5                | If the user wants smooth recovery, OFX-04 covers it (deferred). Surface in plan-checker review if planner has alternative ideas.   |
| A3 | The action bar should remain inline JSX in `App.tsx` rather than being extracted as `<ActionBar>`.                                                    | Pattern 4                | If a future phase needs to extract, that work is independent. Phase 14 itself does not require extraction.                          |
| A4 | ESLint `react-hooks/exhaustive-deps` is configured at warning level (not error). The exact severity is not inspected in this research.                | Pitfall 7                | If error-level, `npm run lint` would fail on a missing-dep mistake — but the recommended pattern reads `connectivity` only at render time, never inside a memoized closure, so the rule does not fire. |
| A5 | The `flexShrink: 0` requirement on the banner is correct for the existing `App` flex container layout.                                                | Pitfall 2                | If the page header's `flexShrink: 0` is purely cosmetic, banner may not need it. Verified by symmetry with header (App.tsx:51); risk negligible. |
| A6 | The four `App.tsx` line numbers (1075 mount point, 1297 approve, 1335 deny, 1418 submit-denial) are correct as of this session.                       | Code Examples            | Verified by direct read 2026-05-07; if the planner edits `App.tsx` before applying Phase 14 plans (e.g., merge of an unrelated PR), line numbers may shift but anchor strings stay unique. |
| A7 | Manual smoke tests via DevTools Network throttling are the canonical way to exercise the offline transition during dev without killing the binary.    | Code Examples            | Standard browser dev practice. If Chrome behavior changes, fall back to killing the running binary.                                |
| A8 | `cargo run -- review tests/fixtures/sample.md` is a valid way to launch the local server with the UI for manual smoke testing.                        | Verification Commands    | The exact fixture path is illustrative — any markdown file the developer has handy works. The mechanism (local server + browser tab) is unchanged from Phase 13's smoke approach. |

## Open Questions

All previously open questions are resolved. The remaining items below are advisory — flagged for the planner to decide explicitly before locking the plan.

1. **Should the planner add an `OfflineBanner.tsx` snapshot or visual regression test?**
   - What we know: the project has no existing snapshot test infrastructure; the visual contract is locked in UI-SPEC.md.
   - What's unclear: whether the planner wants belt-and-suspenders verification beyond the manual smoke checks.
   - Recommendation: NO. Snapshot tests add tooling weight (e.g., Playwright, Storybook) for one banner. Manual smoke against UI-SPEC §Verification Checklist is sufficient.

2. **Should the helper module live at `ui/src/utils/offlineLabels.ts` or somewhere else?**
   - What we know: existing utils (`connectivity.ts`, `serializeAnnotations.ts`) live there; the test files are siblings.
   - What's unclear: whether a "Phase 14" theme of work merits its own folder.
   - Recommendation: `ui/src/utils/offlineLabels.ts`. Folder per phase is over-organization for two files.

3. **Should the planner gate the banner on `connectivity === 'offline'` or `connectivity !== 'online'`?**
   - What we know: `ConnectivityStatus = 'online' | 'offline'` (only two members).
   - What's unclear: nothing — the union has exactly two members, both forms produce identical truth tables.
   - Recommendation: `connectivity === 'offline'` reads as the explicit positive condition and is consistent with `submitDenialButtonLabel(status)`'s internal check `status === 'offline'`.

## Sources

### Primary (HIGH confidence)
- Codebase: `ui/src/App.tsx` lines 1, 32-87, 113-150, 540-590, 1067-1426 (insertion sites, existing patterns)
- Codebase: `ui/src/index.css` lines 1-43 (CSS variable system)
- Codebase: `ui/src/utils/connectivity.ts` and `connectivity.test.ts` (Phase 13 — `ConnectivityStatus` type + reducer + test pattern)
- Codebase: `ui/src/utils/serializeAnnotations.test.ts` (existing pure-function test style)
- Codebase: `ui/src/hooks/useHeartbeat.ts` and `useHeartbeat.test.ts` (Phase 13 — hook contract + test pattern)
- Codebase: `ui/package.json` (no `@testing-library/react`; Vitest 4.1.4; React 19.2.4)
- `.planning/phases/14-offline-banner-button-relabeling/14-CONTEXT.md` (D-01..D-13)
- `.planning/phases/14-offline-banner-button-relabeling/14-UI-SPEC.md` (locked design contract — color, copy, typography, spacing, ARIA)
- `.planning/phases/13-connectivity-state-heartbeat-hook/13-RESEARCH.md` (test-strategy precedent)
- `.planning/phases/13-connectivity-state-heartbeat-hook/13-VERIFICATION.md` (Phase 13 acceptance evidence)
- `.planning/REQUIREMENTS.md` lines 88-89 (OFX-01, OFX-02)
- `.planning/ROADMAP.md` Phase 14 section (5 success criteria)
- `.planning/STATE.md` Decisions section (parallel-type rule)
- `.planning/config.json` (`workflow.nyquist_validation: false`)
- `./CLAUDE.md` (Test Coverage Requirements; inline-style convention; bundle-size policy)

### Secondary (MEDIUM confidence)
- MDN: `role="status"` ARIA semantics (implicit `aria-live="polite"`, `aria-atomic="true"`). https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/status_role

### Tertiary (LOW confidence)
- None — no LOW-confidence claims drove a recommendation.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — every dependency is already in `package.json`; verified versions against the registry.
- Architecture / Patterns: HIGH — patterns lifted from existing project files (Phase 13's `connectivity.ts` + `connectivity.test.ts`, Phase 11.1's `serializeAnnotations.ts`, App.tsx's existing colocated sub-components).
- Pitfalls: HIGH — every pitfall is grounded in a specific App.tsx line number or UI-SPEC clause.
- File modification list: HIGH — exact line numbers verified by direct read on 2026-05-07.
- Verification commands: HIGH — same `npm test` / `npm run lint` / `npm run build` pipeline as Phase 13.

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (30 days). Codebase line numbers may shift if `App.tsx` is modified by an unrelated phase before Phase 14 lands; anchor-string searches (`{approveLabel}`, `{denyLabel}`, `Submit Denial`) provide a stable secondary index.
