# Feature Landscape

**Domain:** AI coding-agent plan reviewer — v0.5.0 Offline Resilience milestone
**Researched:** 2026-05-05
**Confidence:** HIGH overall (all claims sourced to official docs or verified against multiple sources)

> This document supersedes the v0.3.0 feature research. It focuses exclusively on
> features targeted for v0.5.0. Earlier research is preserved in git history.

---

## Context: What Already Exists

The following are built and NOT re-researched here:

- Plan review with markdown rendering and code diff display in browser (v0.1.0)
- Claude Code ExitPlanMode hook wiring (full install/uninstall, JSON protocol) (v0.1.0)
- Annotation system: `comment`, `delete`, `replace` types with free-text inputs (v0.1.0)
- `AnnotationSidebar`, `serializeAnnotations`, full annotation output pipeline (v0.1.0)
- `install`, `uninstall`, `update` subcommands (v0.1.0)
- React + TypeScript + Vite frontend with CSS custom properties (dark/light theme) (v0.3.0)
- Annotation quick-action chips (6 predefined), persistent theme switcher (v0.4.0)
- `/plan-reviewer:annotate` slash command, background execution mode (v0.4.0)

**AppState in current codebase:** `'loading' | 'error' | 'reviewing' | 'confirmed'`

**Current submit flow:** `POST /api/decide` → success → `appState = 'confirmed'`.
On network error, `appState = 'error'` (shows generic "reload page" message).

**Key constraint:** The binary is both server and hook. When Claude Code kills the hook
process after the hook fires, the HTTP server goes down with it. The browser tab stays
open but has no server to POST to. This is the exact problem v0.5.0 solves.

---

## Table Stakes (Users Expect These)

Features in the offline-resilience domain that are accepted norms — missing them makes
the tool feel broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Offline status indicator — persistent banner | Users expect to know when the tool is in a degraded state; a toast alone is insufficient because it auto-dismisses and the condition persists | LOW | Banner (not toast) at top or bottom of viewport. Persistent while offline. Contains icon + plain-language message + optional action link. Must not occlude the main content area. Remove immediately when server is reachable again. |
| Submit button changes label when offline | Users expect buttons to reflect what action they will actually perform; "Submit" that copies instead of posting is deceptive | LOW | When offline: button reads "Copy to clipboard" (or similar). When online: returns to "Submit". The visual affordance change is the primary signal that the flow has changed. |
| Clear "copied" confirmation after clipboard copy | Users expect immediate feedback that the copy succeeded; silent clipboard writes feel broken | LOW | Button briefly changes to "Copied!" with a checkmark icon for 1.5–2 seconds, then returns to "Copy to clipboard". An `aria-live="polite"` region announces the copy for screen readers. |
| Error on clipboard failure | Users need to know if the copy failed (permission denied, tab out of focus) so they can take action | LOW | If `navigator.clipboard.writeText` rejects, show a specific error message with the JSON in a `<textarea>` for manual copy. Do not silently fail. |
| No data loss when server dies mid-annotation | Users expect that work-in-progress annotations survive the server dying; losing them during the 5-minute review window is a critical UX failure | LOW | In-memory React state is not at risk from server death — the server dying does not reset the browser tab. No localStorage persistence needed (the tab is ephemeral by design). The heartbeat only triggers a UI mode change, not a page reload. |
| Reconnect detection (server comes back) | Users expect the offline banner to disappear and the normal submit flow to resume if the server somehow comes back (e.g., another invocation) | LOW | Heartbeat continues polling even when offline. When `/api/ping` succeeds after failure, clear the offline indicator and restore POST submit path. |

---

## Differentiators (Competitive Advantage)

Features not expected in a tool of this type, but that meaningfully improve the experience.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Silent offline entry — no blocking error on server death | Competing tools fail loudly when the server dies (the tab goes to an error state, work is lost). Silently entering offline mode while keeping the UI fully usable is a step-change in resilience. | MEDIUM | On first heartbeat failure, set `isOffline = true` in React state. Annotations, overall comment, deny message are all still editable. Only the submit path changes. User notices the banner — not an error blocking their work. |
| Clipboard JSON matches server POST exactly | Users who paste via the slash command need the clipboard JSON to be byte-for-byte identical to what the server would have emitted. Any divergence breaks the `annotate.md` parsing step. | LOW | `serializeAnnotations` already produces the correct output. The clipboard payload is `JSON.stringify({ behavior, message })` — the same body that `POST /api/decide` sends. No new serialization logic needed. |
| Slash command handles paste fallback | Annotate workflow surviving backend death end-to-end: user copies JSON, pastes into Claude conversation, slash command parses it. This is a complete offline-resilient workflow with no broken links. | MEDIUM | `annotate.md` Step 4 needs to detect pasted JSON (starts with `{`) vs natural language. JSON branch: parse `behavior` and `message` fields, skip the stdout wait. Natural language branch: treat as denial message (current behavior). |
| Visibility-aware polling (Page Visibility API) | Pausing the heartbeat when the tab is backgrounded avoids unnecessary network requests and battery drain on laptops. | LOW | `document.addEventListener('visibilitychange', ...)`. When `document.hidden`, pause the polling interval. Resume on `visibilitychange` to `visible`. Three lines of code on top of the interval logic. |

---

## Anti-Features (Explicitly Avoid)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Modal dialog on server death | A modal blocks the entire UI — the user cannot continue annotating, which is the core resilience goal. Modals are for irreversible or blocking decisions. | Persistent banner (non-modal, non-blocking). |
| Toast-only offline notification | Toasts auto-dismiss after 2–4 seconds. The offline condition is persistent, not momentary. A dismissed toast with no other indicator leaves users confused about submit failure later. | Non-dismissable banner that stays until the condition clears. |
| Page reload on server death | A reload destroys all in-progress annotation state. This is the worst possible outcome — the exact failure mode we are solving. | Never reload the page. Switch UI mode in place. |
| Polling at 500ms or faster | Sub-second polling adds no meaningful detection latency improvement but doubles/quadruples network noise and can interfere with the browser's idle/background throttling. | Poll every 3–5 seconds. The human review window is 30s–5min; 5-second detection lag is imperceptible. |
| Exponential backoff on ping failure | Exponential backoff makes sense for reconnection retries when the server may recover and you don't want to hammer it. But once the server is dead (process killed), it will never recover in this session. Backoff would silently delay reconnection detection if the server does come back. | Keep polling at a fixed interval. The server is a local process, not a remote API — no rate-limit concern. |
| IndexedDB / localStorage annotation persistence | Annotation state is ephemeral by design: it exists for one review session, then the tab is closed. Persisting to storage adds complexity, sync problems, and a stale-data risk on the next review opening. | Keep state in React memory only. |
| SSE or WebSocket for heartbeat | SSE/WebSocket would give push-based death detection. But SSE dies silently (the connection drops), requiring the same client-side polling to detect loss. WebSocket adds framing overhead. For a single-user local tool, HTTP polling to `/api/ping` is simpler, more debuggable, and requires no server-side streaming code. | Poll `GET /api/ping` via `fetch`. |
| Permissions API check before clipboard write | `navigator.permissions.query({ name: 'clipboard-write' })` is not needed for `writeText` on localhost. Chrome auto-grants clipboard-write on active-tab localhost. Firefox does not implement clipboard permissions at all (falls through). Checking permissions adds code that behaves differently per browser. | Call `navigator.clipboard.writeText()` directly, catch the rejection, and show the fallback textarea on failure. |
| User-initiated "go offline" button | There is no use case for the user manually switching to offline mode. Offline mode is an automatic response to server death, not a preference. | Offline mode is only triggered by heartbeat failure. |

---

## Feature Dependencies

```
Heartbeat polling (setInterval + GET /api/ping)
    └──drives──> isOffline React state
                    └──controls──> Offline status banner (rendered when isOffline)
                    └──controls──> Submit button label/handler (POST vs clipboard)
                    └──controls──> ConfirmationView skip condition (offline path skips HTTP)
                    └──resets when──> /api/ping succeeds after failure

Clipboard export
    └──depends on──> isOffline === true (only active in offline mode)
    └──depends on──> serializeAnnotations (existing — produces JSON payload)
    └──depends on──> navigator.clipboard.writeText (Baseline Newly Available, March 2025)
    └──fallback──> textarea with manual copy if writeText rejects
    └──produces──> Same JSON body as POST /api/decide (behavior + message fields)

Slash command annotate.md paste handling
    └──depends on──> Clipboard export producing valid JSON
    └──depends on──> User pasting clipboard content into Claude conversation
    └──new branch──> JSON detection: if input starts with '{', parse as result JSON
    └──existing branch──> Natural language: treat as denial message (current behavior)

Visibility-aware polling (optional but recommended)
    └──depends on──> Page Visibility API (document.visibilityState)
    └──enhances──> Heartbeat polling (pauses when tab hidden)
```

### Dependency Notes

- **No Rust changes for heartbeat**: `GET /api/ping` is a trivial route returning `200 OK`
  with `{}`. The existing axum server can add this in under 10 lines.
- **No new AnnotationType**: Offline mode does not change what annotations look like.
  `serializeAnnotations` output is identical whether submitted online or copied offline.
- **clipboard.writeText on localhost**: `navigator.clipboard` requires a secure context.
  localhost is treated as a secure context by all modern browsers (Chrome, Safari, Firefox).
  No HTTPS setup needed. Confirmed: MDN Clipboard API docs.
- **Slash command change is Markdown only**: `annotate.md` is a Markdown file installed
  by `plan-reviewer install claude`. Updating Step 4 requires only editing that embedded
  Markdown — no Rust logic change (the slash command mechanism is Claude Code's own).
- **AppState extension**: `AppState` may need a new value, or `isOffline` can be
  a separate boolean that overlays on top of the existing `'reviewing'` state. The latter
  is simpler and avoids rewriting all the existing state machine guards.

---

## UX Patterns (What Users Expect)

### Offline Detection Timing

From research: detect within one polling interval (3–5 seconds). The server is killed
instantly when Claude Code's hook timeout fires — there is no graceful shutdown.
`fetch('/api/ping')` will reject immediately with a network error (not a timeout).
Detection lag is effectively one polling interval.

**Recommendation:** Poll every 5 seconds. First failure sets `isOffline = true`.
No retry confirmation needed — a rejected fetch to localhost is definitive.

### Offline Banner Placement

From web.dev offline UX guidelines and LogRocket toast/banner research:

- **Banner, not toast** — the condition is persistent, not momentary
- **Top of viewport** — more visible than bottom; does not compete with the sticky action bar
  at the bottom of this UI (where the submit button lives)
- **Non-dismissable** — banner clears automatically when server is reachable again
- **Language:** Avoid "offline" (technical jargon). Prefer: "Server stopped — your work
  is saved. Use 'Copy to clipboard' to export your review."
- **Color:** Amber/warning (not error red) — the user's work is safe, the situation is
  recoverable

### Clipboard Copy UX

From ShadCN, Shoelace, and Firefox DevTools UX research (2025 standards):

1. User clicks "Copy to clipboard" button
2. `navigator.clipboard.writeText(payload)` is called
3. On success: button text changes to "Copied!" + checkmark icon for 1.5 seconds,
   then reverts. `aria-live="polite"` region announces "Copied to clipboard."
4. On failure: show a modal or expanded section containing the JSON in a `<textarea>`
   with a "Select all" button. Message: "Could not copy automatically — copy the text
   below manually."

Do NOT transition to `appState = 'confirmed'` on clipboard copy. The user has not
submitted their review — they have only copied it. The tab should stay open so they
can paste into Claude and verify. The confirmed state (with auto-close timer) is only
for successful POST to `/api/decide`.

### Slash Command Paste Fallback

The `annotate.md` slash command currently waits for the plan-reviewer binary to write
JSON to stdout, then captures it and feeds it back to Claude. When the server dies before
the user submits, this stdout never arrives.

Fallback UX flow:
1. User copies JSON via "Copy to clipboard" button
2. User pastes the JSON directly into the Claude conversation (step 4 of annotate.md)
3. `annotate.md` Step 4 must handle this: detect pasted JSON vs natural language input

Detection heuristic: if the pasted value starts with `{` and parses as valid JSON
containing a `behavior` key, treat it as a result. Otherwise treat as free-text denial.

**Important:** The slash command change is in the Markdown template, not Rust.
The template explains the fallback in its own instructions so Claude knows what to do.

---

## MVP Definition for v0.5.0

### Launch With

- [ ] `GET /api/ping` route in Rust (returns `200 {"ok":true}`, <10 lines)
- [ ] `useHeartbeat` hook in React: polls `/api/ping` every 5 seconds, sets `isOffline` state
- [ ] Visibility-aware pause: heartbeat pauses when `document.hidden`, resumes on show
- [ ] Offline banner: persistent, amber, non-blocking, appears when `isOffline === true`
- [ ] Submit button: shows "Copy to clipboard" when `isOffline`, "Submit" when online
- [ ] Clipboard copy handler: calls `navigator.clipboard.writeText(JSON.stringify(payload))`
- [ ] Copy success feedback: "Copied!" button state for 1.5s + aria-live announcement
- [ ] Copy failure fallback: expand textarea with JSON for manual copy
- [ ] No `appState = 'confirmed'` on clipboard copy (tab stays open)
- [ ] `annotate.md` Step 4: updated to explain pasted-JSON fallback path

### Defer to Later

- [ ] IndexedDB annotation persistence — out of scope per PROJECT.md
- [ ] Custom polling interval UI — single hardcoded 5s is sufficient
- [ ] WebSocket-based death detection — over-engineered for a local server

---

## Complexity Assessment

| Feature | Estimated Effort | Confidence |
|---------|-----------------|------------|
| `GET /api/ping` Rust route | XS (< 1 hour) | HIGH |
| `useHeartbeat` React hook with visibility awareness | S (2–3 hours) | HIGH |
| Offline banner component | S (2–3 hours) | HIGH |
| Submit button conditional label + handler | S (1–2 hours) | HIGH |
| Clipboard copy with success/failure feedback | S (2–3 hours) | HIGH — `navigator.clipboard.writeText` is Baseline 2025; localhost is a secure context |
| `annotate.md` paste-fallback update | XS (< 1 hour) | HIGH |
| **Total** | **~2 days** | HIGH |

No fundamentally new technology is needed. All pieces use existing React patterns
(hooks, state) and existing browser APIs (Clipboard API, Page Visibility API).

---

## Sources

| Source | Confidence | Used For |
|--------|------------|----------|
| https://web.dev/articles/offline-ux-design-guidelines | HIGH | Banner vs toast, language guidance, graceful degradation |
| https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API | HIGH | `navigator.clipboard.writeText` behavior, secure context requirement |
| https://caniuse.com/mdn-api_clipboard_writetext | HIGH | Clipboard API browser support (Baseline Newly Available 2025) |
| https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API | HIGH | `document.hidden`, `visibilitychange` event |
| https://blog.logrocket.com/ux-design/toast-notifications/ | MEDIUM | Toast vs banner distinction; persistent status indicator pattern |
| https://github.com/firefox-devtools/ux/issues/51 | HIGH | "Copied!" feedback pattern — standard 1–2s button state change |
| https://shoelace.style/components/copy-button | MEDIUM | `feedback-duration` attribute, "Copied!" confirmation UX |
| https://overreacted.io/making-setinterval-declarative-with-react-hooks/ | HIGH | `useInterval` / `useHeartbeat` React hook implementation pattern |
| https://medium.com/tech-pulse-by-collatzinc/modern-javascript-polling-adaptive-strategies | MEDIUM | Polling interval strategy; fixed vs adaptive; visibility awareness |
| https://medium.com/@seeranjeeviramavel/the-pitfall-of-using-navigator-clipboard-in-non-https-web-apps | HIGH | Localhost = secure context confirmation; `window.isSecureContext` |

---

*Feature research for: AI coding-agent plan reviewer (v0.5.0 — Offline Resilience)*
*Researched: 2026-05-05*
