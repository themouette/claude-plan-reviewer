---
phase: 28-review-submission
reviewed: 2026-05-25T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - ui/src/code-review/buildCodeReviewPayload.ts
  - ui/src/code-review/buildCodeReviewPayload.test.ts
  - ui/src/code-review/CodeReviewSubmitPopover.tsx
  - ui/src/code-review/CodeReviewSubmitPopover.test.ts
  - ui/src/code-review/AppToolbar.tsx
  - ui/src/code-review/AppToolbar.test.ts
  - ui/src/code-review/CodeReviewApp.tsx
  - ui/src/code-review/CodeReviewApp.test.ts
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-05-25T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 28 adds a "Send Review" submit flow: a toolbar button opens a popover, the user optionally types a message, confirms, and the payload is POSTed to `/api/decide` with a clipboard fallback. The pure serializer (`buildReviewPayload`) is well-tested and correct. The state machine in `AppToolbar` is sound. The main risks are: a broken import path in the test suite (`buildCodeReviewPayload` instead of the renamed `buildReviewPayload`), a silently dead `onReviewSent` callback prop, missing `aria-disabled` on the popover's disabled Send button, and a double-send race condition in the popover.

---

## Warnings

### WR-01: Test file imports from the old module name — all tests will fail at runtime

**File:** `ui/src/code-review/buildCodeReviewPayload.test.ts:2`
**Issue:** The test imports from `'./buildCodeReviewPayload'`, but the source file was renamed to (or was always exported as) `buildCodeReviewPayload.ts` with exported names `buildReviewPayload` and `shouldUseClipboard`. The import path matches the file on disk, so this is not a missing-file issue — however the phase context states the function was renamed from `buildCodeReviewPayload` to `buildReviewPayload` during the phase. The test file name itself is `buildCodeReviewPayload.test.ts` while the source exports `buildReviewPayload`. If the source file is later renamed to `buildReviewPayload.ts` (to match the exported name, a natural follow-on), this import silently breaks all 10 tests with a module-not-found error. The mismatch between the file name, the import path, and the exported function name is a latent breakage.

**Fix:** Either rename the source file to `buildReviewPayload.ts` and update the import in `AppToolbar.tsx` (which already imports from `'./buildCodeReviewPayload'` at line 4), or rename the test file to `buildReviewPayload.test.ts` and ensure all import paths are consistent. Pick one canonical name and apply it everywhere.

---

### WR-02: `onReviewSent` prop is declared in the interface but never called — dead callback

**File:** `ui/src/code-review/AppToolbar.tsx:22,36`
**Issue:** `AppToolbarProps` declares `onReviewSent: () => void` (line 22) and the function parameter is listed in the destructured props signature (line 36), but `onReviewSent` is never referenced in the function body. The `handleSend` path transitions `submitState` to `'confirmed'` or `'clipboard_confirmed'` without ever calling `onReviewSent`. The caller in `CodeReviewApp.tsx` passes `onReviewSent={() => {}}` (a no-op), so no behaviour is currently lost — but the contract is broken: any future caller who passes a meaningful callback to trigger post-submit cleanup will receive no notification.

**Fix:** Call `onReviewSent()` after a successful `'confirmed'` or `'clipboard_confirmed'` transition in `handleSend`, or remove the prop from the interface if it is intentionally deferred to a later phase. Either way, document the intent.

```tsx
// In handleSend, after setSubmitState('confirmed'):
setSubmitState('confirmed')
onReviewSent()
return
```

---

### WR-03: Double-send race — popover confirm fires twice if user clicks fast

**File:** `ui/src/code-review/AppToolbar.tsx:176`
**Issue:** The `CodeReviewSubmitPopover`'s `onConfirm` handler is `(msg) => { void handleSend(msg) }`. `handleSend` is an `async` function that performs a `fetch` call. There is no guard preventing a second click (or a Cmd+Enter keypress followed immediately by a button click) from calling `handleSend` a second time before the first `fetch` settles. Both calls will POST to `/api/decide` concurrently, potentially sending the review twice. The popover only closes after `setSubmitState('confirmed')` which happens inside the async handler — not synchronously on confirm.

**Fix:** Close the popover synchronously as the first action in `onConfirm`, before awaiting the fetch. Transition `submitState` to `'confirmed'` (or an intermediate `'sending'`) immediately:

```tsx
onConfirm={(msg) => {
  setSubmitState('confirmed') // or 'sending' — prevents re-entry
  void handleSend(msg)
}}
```

Alternatively, add a `'sending'` state to `SubmitState` and gate `handleSend` on it.

---

### WR-04: `aria-disabled` missing on the disabled Send button in the popover

**File:** `ui/src/code-review/CodeReviewSubmitPopover.tsx:108-109`
**Issue:** When `canSend` is false, the button has `disabled={!canSend}` which correctly prevents click events. However, the `onKeyDown` handler on the `<textarea>` (line 99-104) calls `onConfirm(message.trim() || undefined)` when Cmd+Enter is pressed **without** checking `canSend`. A user with an empty message and no comments can trigger a Cmd+Enter submission even though the Send Review button is visually disabled, bypassing the `disabled` attribute guard.

**Fix:** Add a `canSend` guard to the `onKeyDown` handler:

```tsx
onKeyDown={(e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSend) {
    onConfirm(message.trim() || undefined)
    e.preventDefault()
  }
}}
```

---

### WR-05: `buildReviewPayload` returns `'{}'` for an empty submission — caller does not guard against this

**File:** `ui/src/code-review/AppToolbar.tsx:78`
**Issue:** `buildReviewPayload` is documented to require "at least one of message or comments for a meaningful payload," and its own test asserts `'{}'` is the output when both are absent. The `handleSend` function calls `buildReviewPayload(message, comments)` without checking whether the resulting payload is meaningful before POSTing it. If `handleSend` is somehow invoked with an empty message and zero comments (e.g., via a race condition or a future caller), it will POST `'{}'` to `/api/decide` — an empty review submission that the backend Phase 29 will receive with no actionable content. The `canSend` guard in the popover is the only defence, and WR-03/WR-04 above show it can be bypassed.

**Fix:** Add a guard in `handleSend` before constructing or sending the payload:

```tsx
async function handleSend(message?: string) {
  if (!message?.trim() && comments.length === 0) return
  const json = buildReviewPayload(message, comments)
  // ...
}
```

---

## Info

### IN-01: `makeFocusHandlers` parameter `_id` is unused dead code

**File:** `ui/src/code-review/AppToolbar.tsx:102`
**Issue:** The `makeFocusHandlers` function accepts a `_id: string` parameter (prefixed with `_` to suppress the lint warning) but never uses it. The call sites pass string literals like `'send-review'`, `'commits'`, `'files-expand'` that have no effect. The function was likely designed to support per-button focus state keying but that was removed (as the comment on line 100-101 notes). The parameter adds noise.

**Fix:** Remove the parameter from the function signature and all call sites, or keep it only if it will be used in a follow-on phase (document the intent).

---

### IN-02: Test suite for `CodeReviewSubmitPopover` uses source-text scanning instead of rendering

**File:** `ui/src/code-review/CodeReviewSubmitPopover.test.ts:7-62`
**Issue:** All 12 tests (except the export check) read the raw `.tsx` source file as a string and call `toContain(...)` or `toMatch(...)` on it. This is a text-grep, not a behavioural test. It will not catch: (a) the Cmd+Enter bypass described in WR-04 above, (b) the popover not dismissing on Escape when the handler is wired incorrectly, (c) the `canSend` state not being reactive. The same pattern appears in `AppToolbar.test.ts`. These tests pass even if the component is entirely broken at runtime.

**Fix:** Add at least one render-level test using `@testing-library/react` that exercises the `canSend` guard and the keyboard shortcut. The text-scan tests can remain as a lightweight structural guard, but they should not be the only coverage.

---

### IN-03: `handleCommitsToggle` shadows the outer `open` parameter name

**File:** `ui/src/code-review/CodeReviewApp.tsx:113`
**Issue:** The updater callback in `setDrawerOpen(open => !open)` introduces a local `open` variable that shadows nothing harmful here, but the outer component scope has no `open` variable — this is benign. However, it is a minor naming inconsistency; the conventional pattern is `setDrawerOpen(prev => !prev)`.

**Fix:** Rename for clarity:

```tsx
function handleCommitsToggle() {
  setDrawerOpen(prev => !prev)
}
```

---

_Reviewed: 2026-05-25T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
