# Project Research Summary

**Project:** claude-plan-reviewer
**Domain:** Local Rust binary + React/TS browser UI — offline resilience for hook review flow
**Researched:** 2026-05-05
**Confidence:** HIGH

## Executive Summary

v0.5.0 solves a structural gap in the existing tool: when Claude Code kills the hook process after its timeout, the HTTP server dies with it, leaving the browser tab orphaned with no way to submit the user's review. The research confirms that this entire problem is solvable using nothing but the existing stack — zero new Cargo or npm dependencies are needed. Four targeted changes (one Rust route, one React hook, clipboard export via a browser-native API, and a text update to the slash command prompt) form a complete offline-resilient workflow.

The core architecture insight is that connectivity state is orthogonal to app navigation state. The existing `AppState = 'loading' | 'error' | 'reviewing' | 'confirmed'` encodes what the user is doing; offline is about whether the server is reachable. Merging these two concerns into the same state union is the primary anti-pattern to avoid. Instead, a `ConnectivityStatus` type lives as a parallel value driven by the `useHeartbeat` hook, and the submit handlers branch on it without touching the navigation state machine.

The key risk is subtlety rather than complexity: four specific pitfalls can each silently corrupt the user experience. Single-failure offline detection produces false alarms. An async gap before `navigator.clipboard.writeText()` breaks the clipboard silently in Safari and Firefox. A mismatch between the clipboard JSON format and the Rust `build_opencode_output` format causes Claude to misparse the fallback result. And a stale heartbeat interval firing after confirmation can overwrite the confirmation screen. Each has a clear prevention strategy and a specific test that would catch it.

## Key Findings

### Recommended Stack

No new dependencies are required for v0.5.0. The existing stack (axum 0.8, React 19, TypeScript 6, Vitest 4) handles every requirement natively. The Clipboard API (`navigator.clipboard.writeText`) is Baseline Widely Available since March 2020 and works on `http://127.0.0.1` because localhost is a "potentially trustworthy origin" treated as a secure context by all modern browsers. The Page Visibility API (`document.visibilityState`) pauses polling when the tab is backgrounded without any library. AbortController — already used in the codebase — provides per-fetch cancellation for the heartbeat.

**Core technologies (all existing — no version bumps, no new packages):**
- **axum 0.8** — adds `/api/ping` GET route in five lines; same pattern as all existing handlers
- **React 19 hooks** (`useState`, `useEffect`, `useRef`) — implements `useHeartbeat` with no external library
- **`navigator.clipboard.writeText()`** — browser-native; Baseline 2020; no polyfill needed on localhost
- **`AbortSignal.timeout()`** — bounds each ping fetch so a dead server is detected within seconds, not after a 60-second TCP timeout
- **`document.visibilityState`** — pause polling when tab is hidden; three lines on top of the interval logic
- **Vitest 4** — tests `useHeartbeat` and the clipboard utility in isolation

### Expected Features

**Must have (table stakes):**
- Persistent amber offline banner — users expect to know the tool is degraded; a toast that auto-dismisses is insufficient for a persistent condition
- Submit button relabels to "Copy to clipboard" when offline — button must reflect the action it will actually perform
- "Copied!" feedback for 1.5 seconds after a successful clipboard write
- Visible fallback textarea with JSON when `writeText()` rejects — never fail silently
- No data loss when server dies mid-annotation — in-memory React state is safe; no reload, no page replacement needed
- Reconnect detection — banner clears and POST path restores if `/api/ping` succeeds after failure

**Should have (competitive advantage):**
- Silent offline entry — competing tools fail loudly; silently entering offline mode while keeping the UI fully usable is the step-change
- Clipboard JSON matches server POST exactly — `serializeAnnotations` output is byte-for-byte identical to what `POST /api/decide` would send
- Slash command paste fallback — complete end-to-end offline workflow: copy to clipboard → paste into Claude → Claude parses and acts
- Visibility-aware polling — pause when tab is backgrounded; three lines of code; meaningful battery/CPU saving on laptops

**Defer to v2+:**
- IndexedDB / localStorage annotation persistence — out of scope; state is ephemeral by design for one review session
- Custom polling interval UI — 5-second hardcoded interval is correct; no configuration needed
- WebSocket-based death detection — over-engineered for a single-user local tool

### Architecture Approach

The v0.5.0 changes are surgically small. The Rust side gains one stateless route (`GET /api/ping` returning `StatusCode::OK`). The React side gains a new hook file (`useHeartbeat.ts`), a new utility (`clipboard.ts`), inline JSX for the connectivity banner in `App.tsx`, and branching inside the existing `approve()` and `deny()` handlers. The slash command template string in `src/integrations/claude.rs` gains a fallback path in Step 4. Every other file in the codebase is untouched.

**New and modified components:**

1. `src/server.rs` — ADD: `get_ping()` handler + one `.route("/api/ping", get(get_ping))` line (5 lines total)
2. `ui/src/hooks/useHeartbeat.ts` — NEW FILE: polls `/api/ping` every 5 seconds; returns `ConnectivityStatus`; uses 3-consecutive-failure threshold before declaring offline; aborts each fetch with `AbortSignal.timeout(2000)`; stops polling when not in `'reviewing'` state
3. `ui/src/utils/clipboard.ts` — NEW FILE: `copyToClipboard(text)` with `navigator.clipboard.writeText` as primary path and deprecated `execCommand('copy')` as last-resort fallback; returns `boolean`
4. `ui/src/App.tsx` — MODIFY: call `useHeartbeat(5000)`; add connectivity banner JSX between header and columns; branch `approve()`/`deny()` on `connectivity !== 'online'`; relabel buttons; add `clipboardMode` prop to `ConfirmationView`
5. `ui/src/types.ts` — ADD: `export type ConnectivityStatus = 'online' | 'degraded' | 'offline'`
6. `src/integrations/claude.rs` — MODIFY: update `annotate_content` Step 4 string + update test assertions to match new fallback instructions

### Critical Pitfalls

1. **Single-failure offline detection (V5-01)** — A transient GC pause or sub-20ms packet loss on loopback can fail a single fetch. Require 3 consecutive failures (15 seconds total) before transitioning to `offline`. Use `AbortSignal.timeout(2000)` on every ping so a hung connection does not block the next interval tick.

2. **Async gap before `writeText()` (V5-02)** — `navigator.clipboard.writeText()` requires transient user activation. Any `await` before the call (including `await fetch(...)`) voids the activation in Safari and Firefox, causing a silent `NotAllowedError`. Serialize annotations synchronously inside the `onClick` handler first, then call `writeText()` directly — no async boundary before it.

3. **Clipboard JSON format mismatch (V5-08)** — The frontend clipboard export and the Rust `build_opencode_output` function are separate implementations that can drift. Pin the format before writing either: `{"behavior":"allow"}` or `{"behavior":"deny","message":"<serialized-string>"}` — identical to the existing `serializeAnnotations` output. Add a unit test asserting the clipboard payload matches the expected shape for both allow and deny cases.

4. **Stale heartbeat overwrites confirmed screen (V5-04)** — If the heartbeat `setInterval` is not cleared when `appState` enters `confirmed` or `error`, the 3-second server watchdog causes subsequent pings to fail, incrementing the failure counter and potentially re-rendering the offline banner over the confirmation screen. Gate the offline transition: `if (appState !== 'reviewing') return` inside the failure handler.

5. **AppState conflation: error vs offline (V5-03)** — The existing `'error'` state means "server was unreachable at load time." When the server dies mid-session, the user's data is safe and they can continue annotating — this is not an error. Mixing these two situations into the same state value shows the wrong message and wrong buttons. Keep `connectivity` as a separate parallel value, not a new `AppState` variant.

## Implications for Roadmap

Based on the dependency graph in the architecture research, the natural build order has five steps. Each step is independently testable before the next begins. Steps 1–4 are sequential; Step 5 has no code dependencies on the frontend steps and can be parallelized with Steps 3 or 4.

### Phase 1: Backend Heartbeat Endpoint

**Rationale:** The frontend polling loop has nothing to poll without `/api/ping`. This is the smallest possible change and it gates everything else. Completing it first also lets all subsequent work be developed against a real server.

**Delivers:** `GET /api/ping` returning `StatusCode::OK`; `cargo test` passes; `curl http://127.0.0.1:{port}/api/ping` returns 200.

**Implements:** `src/server.rs` route addition (5 lines).

**Avoids:** V5-06 (ping fetch without `AbortSignal.timeout()` — the backend must exist to validate timeout behavior).

### Phase 2: Connectivity State and Heartbeat Hook

**Rationale:** All frontend offline behavior is driven by `ConnectivityStatus`. This type and the hook that produces it must exist before any UI can branch on them. Building the hook in isolation (before touching `App.tsx`) keeps the change minimal and makes it independently unit-testable.

**Delivers:** `ConnectivityStatus` type in `types.ts`; `useHeartbeat.ts` with 3-failure threshold, `AbortSignal.timeout(2000)`, and visibility-aware pause; Vitest tests covering online→degraded→offline transitions and recovery.

**Avoids:** V5-01 (single-failure false offline), V5-04 (stale interval after confirm), V5-06 (missing AbortSignal).

### Phase 3: Connectivity Banner and Button Relabeling

**Rationale:** Pure rendering change — reads `connectivity`, shows/hides banner, changes button labels. No submit logic yet. Isolating this step makes it visually verifiable before the riskier submit-path changes are made.

**Delivers:** Amber non-blocking banner rendered between `PageHeader` and the two-column layout when `connectivity !== 'online'`; submit buttons relabeled in offline mode; banner clears on reconnect.

**Avoids:** V5-03 (connectivity as blocking error), UX pitfall of modal/blocking banner.

### Phase 4: Clipboard Submit Path

**Rationale:** The most impactful frontend change. Depends on Steps 2 and 3 (the `connectivity` state and relabeled buttons must already exist). Making this a separate step allows the full offline experience to be tested end-to-end after the banner is confirmed working.

**Delivers:** `clipboard.ts` utility with `navigator.clipboard.writeText` primary path and textarea fallback; `approve()` and `deny()` both branching on `connectivity !== 'online'`; clipboard payload format locked to `{"behavior":"allow"}` or `{"behavior":"deny","message":"..."}` matching `build_opencode_output`; `clipboardMode` prop on `ConfirmationView`; Vitest tests for both approve and deny offline paths.

**Avoids:** V5-02 (async gap before `writeText`), V5-07 (approve path missing offline behavior), V5-08 (format mismatch), UX pitfall of silent clipboard failure.

### Phase 5: Slash Command Fallback Instructions

**Rationale:** No code dependencies on the frontend steps. Pure string constant edit in `src/integrations/claude.rs`. Placed last because it is verified only by content-assertion unit tests and a manual end-to-end paste flow, which can only be tested once Steps 3 and 4 are stable.

**Delivers:** Updated `annotate_content` Step 4 section — primary stdout path unchanged; new fallback path instructs Claude to ask the user to paste clipboard JSON if stdout is empty; explicit disambiguation logic for the double-result case (clipboard paste received before background process timeout fires); updated `install_creates_annotate_md_with_expected_content` test assertions.

**Avoids:** V5-05 (dual-result race), V5-09 (ambiguous pasted-JSON detection), V5-10 (watchdog/stdout race).

### Phase Ordering Rationale

- `/api/ping` must exist before the frontend heartbeat can be developed against a real server (Phase 1 gates Phase 2).
- `ConnectivityStatus` and `useHeartbeat` must exist before `App.tsx` can branch on them (Phase 2 gates Phases 3 and 4).
- The banner and button relabeling (Phase 3) should be stable before the submit-path logic (Phase 4) is written, because Phase 4's end-to-end test requires the buttons to exist.
- Phase 5 (`annotate.md`) is independent of the frontend and can be worked on in parallel with Phases 3–4, but its manual test requires working clipboard copy, so it is verified last.
- Total estimated effort: approximately 2 working days. No phase has hidden complexity.

### Research Flags

Phases with standard patterns (skip `/gsd-research-phase`):

- **Phase 1 (Rust route):** Standard axum handler pattern already in `src/server.rs`. No research needed.
- **Phase 2 (useHeartbeat):** React hook with `setInterval` + `useEffect` cleanup is a well-documented pattern. `AbortSignal.timeout()` is in MDN spec. No research needed.
- **Phase 3 (Banner):** Pure JSX rendering. No research needed.
- **Phase 4 (Clipboard):** `navigator.clipboard.writeText` behavior on localhost already confirmed HIGH confidence in STACK.md. No research needed.
- **Phase 5 (annotate.md):** Text-only change; slash command mechanism is Claude Code's own. No research needed.

No phase requires a dedicated research step — all technical decisions were resolved during the v0.5.0 research cycle.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies confirmed; all browser APIs verified against MDN spec; localhost as secure context confirmed across Chrome, Safari, and Firefox |
| Features | HIGH | Feature list derived from direct codebase inspection plus web.dev UX guidelines; all complexity estimates verified against the code |
| Architecture | HIGH | Based on direct inspection of `src/server.rs`, `ui/src/App.tsx`, `ui/src/types.ts`, `src/integrations/claude.rs`, `src/main.rs`; no inference required |
| Pitfalls | HIGH | V5-01 through V5-10 all derive from code inspection plus confirmed browser API behavior; mitigation strategies are concrete and testable |

**Overall confidence:** HIGH

### Gaps to Address

- **annotate.md Step 4 disambiguation quality:** The text of the updated Step 4 must be tested manually with Claude to confirm the fallback logic is unambiguous. There is no automated proxy for this — flag it as a required manual smoke test after Phase 5 is complete.
- **3-second watchdog vs offline timeout:** In the offline path the user never POSTs to `/api/decide`, so the 3-second watchdog never fires; the process lives until the 540-second timeout. Research confirms this is acceptable, but the gap between "user copied to clipboard" and "Rust process finally exits" (up to 9 minutes) is worth noting in release documentation.
- **Clipboard API in embedded WebViews:** The research confirms the API works in standard desktop browsers on `http://127.0.0.1`. Not a v0.5.0 concern (the tool opens a real browser tab via `webbrowser::open()`), but worth noting if the tool is ever embedded differently.

## Sources

### Primary (HIGH confidence)

- MDN Clipboard API: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
- MDN Clipboard.writeText(): https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText
- MDN Secure Contexts (localhost as trustworthy origin): https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts
- MDN AbortSignal.timeout(): https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
- MDN Page Visibility API: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- axum 0.8 docs: https://docs.rs/axum/latest/axum/
- web.dev offline UX guidelines: https://web.dev/articles/offline-ux-design-guidelines
- Existing codebase (direct inspection): `src/server.rs`, `src/main.rs`, `src/integrations/claude.rs`, `ui/src/App.tsx`, `ui/src/types.ts`, `ui/src/utils/serializeAnnotations.ts`
- caniuse Clipboard.writeText: https://caniuse.com/mdn-api_clipboard_writetext — Baseline Widely Available since 2020

### Secondary (MEDIUM confidence)

- overreacted.io — `useInterval` polling hook pattern: https://overreacted.io/making-setinterval-declarative-with-react-hooks/
- LogRocket — toast vs banner UX distinction: https://blog.logrocket.com/ux-design/toast-notifications/
- Shoelace component library — "Copied!" feedback pattern: https://shoelace.style/components/copy-button
- Firefox DevTools UX — clipboard feedback pattern: https://github.com/firefox-devtools/ux/issues/51
- navigator.onLine unreliability for local process detection: https://dev.to/safal_bhandari/detecting-online-and-offline-status-in-react-1i6o

### Tertiary (LOW confidence)

- Clipboard API user gesture interoperability (Safari/Firefox vs Chrome divergence): https://github.com/w3c/clipboard-apis/issues/182 — confirms Safari/Firefox transient activation strictness; the mitigation (synchronous call before any await) is HIGH confidence

---
*Research completed: 2026-05-05*
*Ready for roadmap: yes*
