# Phase 22: Submit & Clipboard - Research

**Researched:** 2026-05-22
**Domain:** React 19 submit bar UI, v2 reviewer wiring, clipboard fallback integration
**Confidence:** HIGH

## Summary

Phase 22 adds a submit bar to the v2 reviewer (`ReviewerV2Shell`) that enforces annotation
discipline: Approve is disabled when comments exist, Ask for Changes is disabled when no
comments exist. The free-text overall message for Ask for Changes is optional (an empty
message is permitted so long as at least one comment exists). Both the online submit path
(`POST /api/decide`) and the offline clipboard path reuse utilities that already exist in
`ui/src/reviewer-v2/offlineLabels.ts` — no reimplementation is needed.

The key architectural constraint (from STATE.md decision history and SUBMIT-02) is that
`buildClipboardPayload` and `shouldUseClipboard` from `reviewer-v2/offlineLabels.ts` are
the single source of truth — the same copies already used in the v2 subtree. Phase 22
must wire these into the submit bar without duplicating them.

The v2 reviewer already has `useHeartbeat` mounted in `ReviewerV2.tsx` (returning `void`
with a comment noting "Phase 22 will wire it to the offline banner"). The annotation store
is also mounted there but currently `void`. The submit bar is the first component in the v2
tree that will need both — so Phase 22 must lift heartbeat status and annotation state
up to a level where the submit bar can consume them.

**Primary recommendation:** Introduce a `SubmitBar` component under `reviewer-v2/`, wire
the existing `useHeartbeat` and annotation state into it via `ReviewerV2Shell`, and reuse
`buildClipboardPayload` / `shouldUseClipboard` / `serializeAnnotations` already in the
`reviewer-v2/` subtree.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Approve/Ask-for-changes buttons + disabled state | Browser / Client | — | Pure client-side reactive UI gating |
| Optional overall message textarea | Browser / Client | — | Local form state, no server round-trip until submit |
| Online submit POST /api/decide | API / Backend | Browser (fetch caller) | Server owns the decision; client fires and awaits |
| Offline clipboard write | Browser / Client | — | navigator.clipboard is browser-only; no server involved |
| Connectivity detection (shouldUseClipboard) | Browser / Client | — | Already owned by useHeartbeat in reviewer-v2 subtree |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | ^19.2.4 | Component & state | Already installed; all v2 code is React [VERIFIED: ui/package.json] |
| TypeScript ~6 | ~6.0.2 | Type safety | Project standard [VERIFIED: ui/package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `reviewer-v2/offlineLabels.ts` | in-repo | Clipboard payload builder + shouldUseClipboard guard | Always — this is the canonical implementation |
| `reviewer-v2/serializeAnnotations.ts` | in-repo | Serializes annotation list to a feedback message string | Used by buildClipboardPayload and by the /api/decide POST body |
| `reviewer-v2/connectivity.ts` | in-repo | ConnectivityStatus type | Passed from useHeartbeat to shouldUseClipboard |
| `reviewer-v2/useHeartbeat.ts` | in-repo | Polls /api/ping, returns ConnectivityStatus | Already mounted in ReviewerV2.tsx — lift to shell or pass as prop |

### No new packages required
No new npm dependencies are needed for this phase. All utilities exist in the v2 subtree.

## Package Legitimacy Audit

No new packages are installed in this phase. Not applicable.

## Architecture Patterns

### System Architecture Diagram

```
User click (Approve / Ask for Changes)
          |
          v
    SubmitBar component
    ├── reads: annotations[] (from ReviewerV2Shell)
    ├── reads: connectivity (from useHeartbeat via ReviewerV2Shell)
    ├── local state: overallMessage (textarea)
    ├── disabled gate: Approve disabled when annotations.length > 0
    ├── disabled gate: Ask for Changes disabled when annotations.length === 0
    |
    ├── Online path (shouldUseClipboard → false)
    |     ├── Approve → POST /api/decide { behavior: 'allow' }
    |     └── Ask for Changes → POST /api/decide { behavior: 'deny', message: serializeAnnotations(...) }
    |               └── server responds → show ConfirmationView (or transition state)
    |
    └── Offline path (shouldUseClipboard → true)
          ├── buildClipboardPayload('allow'|'deny', overallMessage, annotations)
          ├── navigator.clipboard.writeText(json)
          └── show ClipboardConfirmationView / ClipboardErrorView
```

### Recommended Project Structure

The existing `reviewer-v2/` structure is extended with one new component and its test:

```
ui/src/reviewer-v2/
├── SubmitBar.tsx        # NEW — approve/ask-for-changes bar with disabled gates
├── SubmitBar.test.ts    # NEW — source-contract tests (matching established pattern)
└── ReviewerV2Shell.tsx  # MODIFIED — passes annotations + connectivity to SubmitBar
```

`ReviewerV2.tsx` must also be modified to lift `useHeartbeat` return value and pass it down
(or move `useHeartbeat` call into `ReviewerV2Shell` which already owns other state).

### Pattern 1: Source-contract tests (established project pattern)

Every v2 component test follows the "source-contract" pattern: read the source file with
`readFileSync`, then assert that specific strings (import paths, prop names, API call
strings) are present. No `@testing-library/react` — this is the project-wide testing
constraint.

```typescript
// Source: ui/src/reviewer-v2/ReviewerV2Shell.test.ts (existing pattern)
const source = readFileSync(resolve(__dirname, './SubmitBar.tsx'), 'utf-8')
describe('SubmitBar', () => {
  it('imports buildClipboardPayload from ./offlineLabels', () => {
    expect(source).toContain('buildClipboardPayload')
    expect(source).toContain("from './offlineLabels'")
  })
  it('imports shouldUseClipboard from ./offlineLabels', () => {
    expect(source).toContain('shouldUseClipboard')
  })
  it('calls navigator.clipboard.writeText on offline path', () => {
    expect(source).toContain('navigator.clipboard.writeText')
  })
})
```

### Pattern 2: Approve/Ask-for-changes disabled gate

Gate logic is pure — no side effects, just reads annotation count:

```typescript
// Source: [ASSUMED — derived from SUBMIT-01 requirements]
const canApprove   = annotations.length === 0   // disabled when comments exist
const canAskChange = annotations.length > 0      // disabled when no comments
```

### Pattern 3: Online submit path (matching App.tsx existing pattern)

```typescript
// Source: App.tsx approve() + deny() (existing reviewer pattern)
// POST approve:
await fetch('/api/decide', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ behavior: 'allow' }),
})

// POST ask-for-changes:
const message = serializeAnnotations('', overallMessage, annotations)
await fetch('/api/decide', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ behavior: 'deny', message }),
})
```

Note: the existing App.tsx uses an empty string for the `denyText` parameter and passes
`overallComment` as the second param. The v2 submit bar does not have a separate
"denyText" — the overall message IS the deny text. Pass it as the first argument
(`denyText`) to `buildClipboardPayload` to ensure serializeAnnotations includes it.

### Pattern 4: ReviewerV2.tsx wiring (current state)

```typescript
// Current state (ReviewerV2.tsx):
void useHeartbeat()   // return value discarded — Phase 22 comment says "wire to offline banner"
void useAnnotations() // return value discarded — Phase 21 comment
```

These void-discarded hooks need to be moved into `ReviewerV2Shell` (the simpler path) or
their return values need to be threaded down as props. Since `ReviewerV2Shell` already
owns all annotation state via `useAnnotations()`, the cleanest fix is:
1. Remove the redundant `useAnnotations()` call from `ReviewerV2.tsx`
2. Add `useHeartbeat()` call inside `ReviewerV2Shell` (it already has `useAnnotations`)
3. Pass `connectivity` and `annotations` as props to `SubmitBar`

### Pattern 5: Offline banner in v2

The existing `App.tsx` shows an `<OfflineBanner>` when `connectivity === 'offline'`.
SUBMIT-02 says the v2 submit falls back to clipboard — but the phase description also
mentions "offline banner" in the goal sentence. The success criteria do NOT list an offline
banner as a pass/fail criterion. The ARCH-02 decision says v2 owns its own heartbeat.
Offline banner is implicitly needed for the user to understand why clipboard is happening,
but is not a separately required criterion. The planner should include it but at lower
priority — success criteria drive TDD.

### Anti-Patterns to Avoid

- **Importing from outside reviewer-v2/:** ARCH-01 is enforced by ESLint. The submit bar
  MUST import `buildClipboardPayload` from `./offlineLabels` (the v2 copy), NOT from
  `../../utils/offlineLabels`.
- **Reimplementing clipboard payload builder:** SUBMIT-02 is explicit — reuse
  `buildClipboardPayload`, do not write a new one.
- **Using `@testing-library/react`:** The project forbids it (established throughout all
  v2 test files). Use source-contract tests only.
- **Awaiting before clipboard write:** The existing App.tsx pattern writes clipboard
  synchronously inside the click handler (no `await` before `navigator.clipboard.writeText`)
  to avoid transient activation errors in Safari/Firefox. Follow the same pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Clipboard payload JSON | Custom serializer | `buildClipboardPayload` from `./offlineLabels` | SUBMIT-02 — format must be identical to existing reviewer |
| Offline detection | Custom fetch poller | `shouldUseClipboard(connectivity)` + existing `useHeartbeat` | ARCH-02 — v2 already has independent heartbeat |
| Annotation serialization | Custom formatter | `serializeAnnotations` from `./serializeAnnotations` | Already in v2 subtree, tested, format-stable |

## Common Pitfalls

### Pitfall 1: Redundant useAnnotations() in ReviewerV2.tsx
**What goes wrong:** `ReviewerV2.tsx` calls `void useAnnotations()` discarding the return.
`ReviewerV2Shell` also calls `useAnnotations()`. These are TWO separate reducer instances.
If SubmitBar consumes annotations from the Shell instance, the void instance in ReviewerV2
is harmless but confusing.
**Why it happens:** Phase 17 mounted both hooks as stubs. Phase 21 wired the Shell instance.
The void one in ReviewerV2.tsx was never removed.
**How to avoid:** Remove the `void useAnnotations()` call from `ReviewerV2.tsx` at the start
of Phase 22. Only one annotations reducer should exist in the v2 subtree.
**Warning signs:** `annotations` array in SubmitBar is always empty even after adding comments.

### Pitfall 2: void useHeartbeat() not wired
**What goes wrong:** `ReviewerV2.tsx` calls `void useHeartbeat()` discarding connectivity.
If `SubmitBar` needs `ConnectivityStatus` to call `shouldUseClipboard`, it has no source.
**Why it happens:** The Phase 17 stub comment says "Phase 22 will wire it to the offline banner"
but does not specify HOW.
**How to avoid:** Move `useHeartbeat()` call into `ReviewerV2Shell` (alongside `useAnnotations`),
capture the return value, and pass it as a `connectivity` prop to `SubmitBar`.
**Warning signs:** Submit always hits `/api/decide` even when server is unreachable.

### Pitfall 3: Passing denyText vs overallMessage to buildClipboardPayload
**What goes wrong:** `buildClipboardPayload(decision, denyText, overallComment, annotations)` —
the v2 submit bar has only ONE message field (overall message). If you pass it as `overallComment`
instead of `denyText`, the deny payload's `message` field will include an `[OVERALL]` header
prefix rather than the raw message prefix.
**Why it happens:** The original App.tsx has both a `denyMessage` (shown in deny form) and an
`overallComment` (shown separately). The v2 has a single "overall message" field that serves
the deny-text role.
**How to avoid:** Pass `overallMessage` as the `denyText` param (first string arg) and pass `''`
as `overallComment` — or pass `overallMessage` as both. Review the `serializeAnnotations` output
format carefully against SUBMIT-04's "identical format" requirement.
**Warning signs:** JSON payload has `[OVERALL]` wrapper in the deny message.

### Pitfall 4: Transient activation for clipboard.writeText
**What goes wrong:** `navigator.clipboard.writeText` requires a "transient user activation"
(a recent click/keypress). If called inside an async function after an `await`, the activation
window may have expired in Safari/Firefox.
**Why it happens:** Async paths naturally introduce `await` before the clipboard call.
**How to avoid:** Call `navigator.clipboard.writeText(json)` synchronously inside the click
handler before any `await`. In the offline path, there is no need for a server fetch first —
just build the payload and write synchronously.
**Warning signs:** `clipboard_error` state triggered on Safari even when clipboard access is
permitted.

### Pitfall 5: Approve button needs disabled attribute, not just opacity
**What goes wrong:** Styling a button as visually disabled with `opacity: 0.4` without setting
`disabled` attribute means keyboard users can still tab to it and activate it.
**Why it happens:** Shortcut to avoid `pointer-events: none` interaction complexity.
**How to avoid:** Use the HTML `disabled` attribute: `<button disabled={!canApprove} ...>`.
This prevents click, enter-key, and focus simultaneously.
**Warning signs:** Keyboard navigation allows submitting with comments present.

## Code Examples

### SubmitBar props interface

```typescript
// Source: [ASSUMED — designed from SUBMIT-01/02 requirements]
interface SubmitBarProps {
  annotations: Annotation[]
  connectivity: ConnectivityStatus
}
```

### Approve handler (online + offline)

```typescript
// Source: [ASSUMED — derived from App.tsx approve() pattern and buildClipboardPayload API]
async function handleApprove() {
  if (shouldUseClipboard(connectivity)) {
    const json = buildClipboardPayload('allow', '', '', annotations)
    navigator.clipboard.writeText(json)
      .then(() => setSubmitState('clipboard_confirmed'))
      .catch(() => { setClipboardJson(json); setSubmitState('clipboard_error') })
    return
  }
  const res = await fetch('/api/decide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ behavior: 'allow' }),
  })
  if (res.ok || res.status === 409) setSubmitState('confirmed_allow')
  else setSubmitState('error')
}
```

### Ask-for-changes handler

```typescript
// Source: [ASSUMED — derived from App.tsx deny() pattern]
async function handleAskForChanges() {
  if (shouldUseClipboard(connectivity)) {
    const json = buildClipboardPayload('deny', overallMessage, '', annotations)
    navigator.clipboard.writeText(json)
      .then(() => setSubmitState('clipboard_confirmed'))
      .catch(() => { setClipboardJson(json); setSubmitState('clipboard_error') })
    return
  }
  const message = serializeAnnotations(overallMessage, '', annotations)
  const res = await fetch('/api/decide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ behavior: 'deny', message }),
  })
  if (res.ok || res.status === 409) setSubmitState('confirmed_deny')
  else setSubmitState('error')
}
```

### Gate logic

```typescript
// Source: [ASSUMED — from SUBMIT-01]
const canApprove   = annotations.length === 0
const canAskChange = annotations.length > 0
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `void useHeartbeat()` in ReviewerV2.tsx | Wire return value into shell + submit bar | Phase 22 | Submit bar can detect offline |
| `void useAnnotations()` in ReviewerV2.tsx | Removed (redundant — Shell already owns it) | Phase 22 | Eliminate phantom second reducer instance |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SubmitBar receives `annotations` and `connectivity` as props | Architecture Patterns | Wrong prop contract → refactor needed |
| A2 | `overallMessage` passed as `denyText` (not `overallComment`) to `buildClipboardPayload` | Common Pitfalls | Wrong param → `[OVERALL]` prefix in deny message |
| A3 | The confirm/error states for v2 are inline in SubmitBar (not full-screen views) | Code Examples | Full-screen confirm views may be preferred — planner decides |
| A4 | `void useAnnotations()` in ReviewerV2.tsx should be removed in this phase | Common Pitfalls | Leaving it would not break behavior but is confusing debt |
| A5 | Offline banner showing in v2 header/shell is a "nice to have" implied by the goal sentence, not a hard success criterion | Architecture Patterns | If planner treats it as a separate requirement, an extra task is needed |

## Open Questions (RESOLVED)

1. **Confirm/error state: full-screen view or inline in submit bar?**
   - What we know: App.tsx uses full-screen `ConfirmationView` and `ClipboardConfirmationView`
   - What's unclear: The v2 shell has a persistent header + 3 columns — a full-screen overlay
     would need the shell to switch render modes; an inline message in the submit bar is simpler
   - Recommendation: Use inline confirmation state in the SubmitBar (a message band replacing
     the buttons) to avoid needing a new "v2AppState" type and full shell restructuring.
   - **RESOLVED: inline confirmation state per Plan 22-03** — SubmitControls renders four
     inline confirmation/error states (`confirmed_allow`, `confirmed_deny`,
     `clipboard_confirmed`, `clipboard_error`) in place of the button group; no full-screen
     overlay, no `v2AppState` reshape. See `.planning/phases/22-submit-clipboard/22-03-PLAN.md`
     §"Render" and the SubmitState state machine literals.

2. **Where does `useHeartbeat` live after Phase 22?**
   - What we know: Currently called in `ReviewerV2.tsx` (void discarded)
   - What's unclear: Should it stay in ReviewerV2.tsx and be passed as a prop, or move into
     ReviewerV2Shell alongside other state?
   - Recommendation: Move the call into `ReviewerV2Shell.tsx` alongside `useAnnotations` —
     this keeps all reactive state in one place and avoids prop-threading through ReviewerV2.
   - **RESOLVED: useHeartbeat moved to ReviewerV2Shell per Plan 22-04** — `ReviewerV2.tsx`
     becomes a clean pass-through; `ReviewerV2Shell.tsx` calls `const connectivity =
     useHeartbeat()` alongside `useAnnotations()` and passes `connectivity` as a prop to
     `SubmitControls` and as the gate for the conditional `<OfflineBanner />` render. See
     `.planning/phases/22-submit-clipboard/22-04-PLAN.md` Task 1 (strip ReviewerV2.tsx) and
     Task 2 Step A (Shell wiring).

3. **Submit bar component name and shape**
   - **RESOLVED: inline confirmations in submit bar per Plan 22-03** — the component is
     named `SubmitControls` (default export from `ui/src/reviewer-v2/SubmitControls.tsx`),
     not `SubmitBar`, and renders the two-button group (Approve + Send Feedback ▾) plus the
     inline confirmation states. The naming was finalized during UI-SPEC review to align
     with the GitHub-style split-button + popover pattern adopted for the Send Feedback
     trigger. References to "SubmitBar" elsewhere in this research document refer to the
     same component.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — pure in-repo UI code change, no new tools or services required)

## Sources

### Primary (HIGH confidence)
- `ui/src/reviewer-v2/offlineLabels.ts` — `buildClipboardPayload`, `shouldUseClipboard` API verified
- `ui/src/reviewer-v2/serializeAnnotations.ts` — serialization function signature verified
- `ui/src/reviewer-v2/types.ts` — `Annotation`, `ConnectivityStatus` types verified
- `ui/src/reviewer-v2/ReviewerV2.tsx` — current wiring state, void hooks confirmed
- `ui/src/reviewer-v2/ReviewerV2Shell.tsx` — current shell structure, annotation state ownership
- `ui/src/App.tsx` — reference implementation of approve/deny handlers, online+offline paths
- `.planning/STATE.md` — locked decision: "SUBMIT-02 reuses buildClipboardPayload + shouldUseClipboard"
- `ui/package.json` — React 19 confirmed, no @testing-library/react present

### Secondary (MEDIUM confidence)
- `ui/src/reviewer-v2/ReviewerV2Shell.test.ts` — source-contract test pattern established
- `ui/src/reviewer-v2/CommentBubble.test.ts` — source-contract test pattern confirmed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies are in-repo, already verified
- Architecture: HIGH — wiring constraints are explicit in existing code + STATE.md decisions
- Pitfalls: HIGH — pitfalls derived from existing code patterns and App.tsx implementation
- Assumptions: LOW for A3 (confirm state design) — planner has freedom to choose

**Research date:** 2026-05-22
**Valid until:** This research is based on the live codebase state at Phase 21 completion —
valid until Phase 22 starts editing files.
