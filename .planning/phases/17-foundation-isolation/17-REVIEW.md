---
phase: 17-foundation-isolation
reviewed: 2026-05-20T05:32:03Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - ui/eslint.config.js
  - ui/package.json
  - ui/src/main.tsx
  - ui/src/reviewer-v2/ReviewerV2.tsx
  - ui/src/reviewer-v2/ReviewerV2Shell.tsx
  - ui/src/reviewer-v2/connectivity.test.ts
  - ui/src/reviewer-v2/connectivity.ts
  - ui/src/reviewer-v2/offlineLabels.test.ts
  - ui/src/reviewer-v2/offlineLabels.ts
  - ui/src/reviewer-v2/serializeAnnotations.ts
  - ui/src/reviewer-v2/types.ts
  - ui/src/reviewer-v2/useAnnotations.test.ts
  - ui/src/reviewer-v2/useAnnotations.ts
  - ui/src/reviewer-v2/useHeartbeat.test.ts
  - ui/src/reviewer-v2/useHeartbeat.ts
  - ui/vite.config.ts
  - ui/vitest.setup.ts
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-05-20T05:32:03Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

This phase establishes the `reviewer-v2/` subtree: infrastructure isolation (ESLint coupling rule), test tooling (jsdom, vitest setup), copies of `connectivity`, `serializeAnnotations`, and `offlineLabels`, a new minimal `Annotation` type, the `useAnnotations` reducer hook, and the scaffold `ReviewerV2` / `ReviewerV2Shell` components. All 61 tests pass and TypeScript compilation is clean.

Two critical defects were found. First, the v2 `Annotation` type intentionally omits the `replacement` field (per D-11/RESEARCH A2), but `serializeAnnotations.ts` silently emits an empty `[REPLACE]` entry with no replacement text when a `replace`-typed annotation is serialized — the type cast hides this from the compiler and there is no test exercising the `replace` branch against the v2 type. Second, the `annotationReducer`'s `edit` action only updates the `comment` field; if Phase 21 extends the `Annotation` type with `replacement` and a user edits a `replace` annotation, the replacement text will be silently dropped by the existing reducer. Four warnings and two informational items follow.

## Critical Issues

### CR-01: `replace`-type annotation serializes silently empty replacement text — no test covers the branch

**File:** `ui/src/reviewer-v2/serializeAnnotations.ts:35`

**Issue:** The v2 `Annotation` type (`types.ts`) deliberately omits the `replacement` field. The `replace` branch in `serializeAnnotations` copes by casting to `Annotation & { replacement?: string }` and defaulting to `''`, producing output like:

```
[REPLACE] Replace: "foo"
> With:
```

An empty "With:" line is structurally misleading and semantically useless — the recipient cannot act on it. This is not guarded at the call site (no `filter` on the v2 annotation store before passing to `serializeAnnotations`), and there is no test that exercises the `replace` branch against the v2 `Annotation` type, so the silent empty string has never been observed in any test run. The v1 implementation (`ui/src/utils/serializeAnnotations.ts:35`) accesses `a.replacement` directly and would also produce empty output for the same reason if fed v2 annotations.

The real question — whether `replace` annotations should even be reachable in Phase 17 before Phase 21 extends the type — is not answered by the tests.

**Fix options (choose one):**

Option A — Exclude `replace` entries that have no replacement text:
```typescript
case 'replace': {
  const replacement = ((a as Annotation & { replacement?: string }).replacement ?? '').trim()
  if (replacement) {
    feedbackItems.push(`[REPLACE] Replace: "${a.anchorText}"\n> With: ${replacement.replace(/\n/g, '\n> ')}`)
  }
  break
}
```

Option B — Add `replacement` to the v2 `Annotation` type now (ahead of Phase 21) so the compiler enforces it:
```typescript
// types.ts
export interface Annotation {
  id: string
  anchorText: string
  comment: string
  type: AnnotationType
  replacement: string // empty string for non-replace types
}
```
This mirrors the v1 shape and removes the need for the type cast in `serializeAnnotations`.

Either way, add a test:
```typescript
it('replace annotation with no replacement produces no [REPLACE] entry (or skips)', () => {
  const a: Annotation = { id: '1', anchorText: 'foo', comment: '', type: 'replace' }
  const result = serializeAnnotations('', '', [a])
  // assert expected behaviour under chosen option
})
```

---

### CR-02: `annotationReducer` `edit` action discards all fields except `comment` — silently corrupts `replace` annotations when Phase 21 extends the type

**File:** `ui/src/reviewer-v2/useAnnotations.ts:21-24`

**Issue:** The `edit` action replaces the target annotation with `{ ...a, comment: action.comment }`. The `AnnotationAction` union (`types.ts:11-13`) defines `edit` as `{ type: 'edit'; id: string; comment: string }` — only `comment` is carried. If Phase 21 adds a `replacement` field to `Annotation` and a user edits a `replace`-type annotation's replacement text, the action must carry that field too or the `replacement` will be silently reset.

This is not a latent bug yet (Phase 17 has no `replacement` field), but the `edit` action's signature is frozen at the wrong abstraction level: it conflates "update the comment of a comment-type annotation" with "update any field of any annotation type". Phase 21 will need to either break this action's signature or introduce a new action, at which point existing reducer tests must be updated. Identifying this now avoids a silent data-loss regression when the type is extended.

**Fix:** Widen the `edit` action to a generic "patch" action before Phase 21 so the type system enforces completeness:
```typescript
// types.ts
export type AnnotationAction =
  | { type: 'add'; annotation: Annotation }
  | { type: 'patch'; id: string; patch: Partial<Omit<Annotation, 'id'>> }
  | { type: 'remove'; id: string }
```
```typescript
// useAnnotations.ts
case 'patch':
  return {
    ...state,
    annotations: state.annotations.map((a) =>
      a.id === action.id ? { ...a, ...action.patch } : a,
    ),
  }
```
If the Phase 21 plan intentionally defers this rename, add a `// TODO Phase 21: extend edit action to carry replacement` comment so it is tracked.

---

## Warnings

### WR-01: Hook return values discarded with `void` — departs from plan and risks React Rules-of-Hooks surprise

**File:** `ui/src/reviewer-v2/ReviewerV2.tsx:9,13`

**Issue:** The implementation calls `void useHeartbeat()` and `void useAnnotations()` and ignores their return values. The Phase 17 plan (17-03-PLAN.md:148-149) specifies `const _connectivity = useHeartbeat()` and `const _annotations = useAnnotations()` — underscore-prefixed variables that make the intentional discard visible to both readers and ESLint. The `void` idiom suppresses the expression result but does not prevent re-render churn in React 19 StrictMode: because `useAnnotations` returns a new object literal on every render (the `addAnnotation`, `editAnnotation`, `removeAnnotation` callbacks are recreated each render), calling `void useAnnotations()` is fine for correctness today, but if a child component ever captures the dispatchers by ref this pattern silently breaks. Naming the result `_annotations` costs nothing and matches the convention the plan established.

Beyond the naming issue, calling a hook whose return value is `void`-discarded creates a trap for future contributors: there is no signal whether the hook was intentionally unused or whether wiring was forgotten.

**Fix:**
```typescript
// ReviewerV2.tsx
const _connectivity = useHeartbeat() // Phase 22 wires this to the offline banner
const _annotations = useAnnotations() // Phase 21 wires this into the UI
```

---

### WR-02: `offlineLabels.ts` drops all button-label exports present in v1 — diverges from v1 without documented intent

**File:** `ui/src/reviewer-v2/offlineLabels.ts:1-32`

**Issue:** The v1 `offlineLabels.ts` (`ui/src/utils/offlineLabels.ts`) exports six symbols beyond `buildClipboardPayload` and `shouldUseClipboard`: `OFFLINE_BANNER_LINE_1`, `OFFLINE_BANNER_LINE_2`, `OFFLINE_APPROVE_LABEL`, `OFFLINE_DENY_LABEL`, `OFFLINE_SUBMIT_DENIAL_LABEL`, `approveButtonLabel`, `denyButtonLabel`, and `submitDenialButtonLabel`. The v2 copy omits all of them. The Phase 17 plan (17-02-PLAN.md) states: "provides: Copies of buildClipboardPayload and shouldUseClipboard (the two functions v2 will need in Phase 22)". The plan appears intentional but it means Phase 22 will need to either add these constants to the v2 copy or re-derive them, creating a second divergence from v1. If this is deliberate, the file should have a comment documenting the scope decision. If unintentional, the missing exports should be added now.

**Fix (if intentional):** Add a comment at the top of `offlineLabels.ts`:
```typescript
// Phase 17 copy: only buildClipboardPayload and shouldUseClipboard are needed.
// Button-label exports (OFFLINE_APPROVE_LABEL etc.) will be added in Phase 22.
```

**Fix (if unintentional):** Copy the missing exports from `ui/src/utils/offlineLabels.ts` and add corresponding tests.

---

### WR-03: `serializeAnnotations` summary section counts differ from `feedbackItems` length when `denyText` is non-empty

**File:** `ui/src/reviewer-v2/serializeAnnotations.ts:42-57`

**Issue:** The header says "I've reviewed this plan and have N pieces of feedback" where N is `feedbackItems.length`. `feedbackItems` includes the raw `denyText` entry (line 19) as well as `[OVERALL]`, `[COMMENT]`, `[DELETE]`, and `[REPLACE]` items. The `## Summary` section at the end only tallies `typeCounts` (annotation types) plus `OVERALL` when present — it never counts the `denyText` item. So when `denyText` is provided and there are no annotations, the header says "1 piece of feedback" but the Summary section is absent (because `typeCounts.size === 0`). When `denyText` and annotations are both present, the header count includes `denyText` but the Summary section omits it.

This is the same bug present in the v1 copy (`ui/src/utils/serializeAnnotations.ts`) — it was copied faithfully — but neither v1 nor v2 has a test covering this combination.

**Fix:** Either add `denyText` to `typeCounts` when non-empty, or exclude `denyText` from `feedbackItems.length` in the header count. Example for the former:
```typescript
if (denyText.trim()) typeCounts.set('DENIAL REASON', 1)
```

---

### WR-04: `useHeartbeat` test coverage is minimal — only one scenario tested, leaving race-condition paths untested

**File:** `ui/src/reviewer-v2/useHeartbeat.test.ts:61-71`

**Issue:** The v2 `useHeartbeat.test.ts` contains exactly one test: "successful fetch keeps status online without calling onStatus". The v1 test file (`ui/src/hooks/useHeartbeat.test.ts`) is not in scope for this review, but the v2 copy exports `runHeartbeatTick` specifically to enable thorough DI testing. The following paths are not covered in the v2 test file:

1. Fetch failure transitions state correctly (failCount increments, offline at 3).
2. Cancelled tick (via `isCancelled`) does not touch state.
3. Superseded tick (generation guard: `myGen !== getCurrentGeneration()`) does not count as a failure.
4. Tab hidden (`isVisible() === false`) results in early return.
5. Non-2xx response triggers a failure event.

If the v2 heartbeat logic ever drifts from the v1 copy (e.g., someone adjusts the failure threshold), these uncovered cases will not be caught.

**Fix:** Port the missing scenario tests from the v1 test file (if it has them) or add them from scratch. The `createHarness` helper is already in place — adding cases is low-effort.

---

## Info

### IN-01: No `serializeAnnotations.test.ts` in the v2 subtree

**File:** `ui/src/reviewer-v2/serializeAnnotations.ts`

**Issue:** `serializeAnnotations` is a non-trivial pure function (handles five distinct item types, builds a numbered list, appends a summary section). The v1 utils directory has a `serializeAnnotations.test.ts` (confirmed present in `ui/src/utils/`). The v2 subtree has no test file for it. The v2 copy changed the `replace` branch (type cast + `?? ''` default), which is the only behavioral difference from v1 — exactly the change that is untested.

**Fix:** Create `ui/src/reviewer-v2/serializeAnnotations.test.ts` with at minimum: empty input returns `''`; overallComment only; single comment annotation; single delete annotation; replace annotation (exercising the v2 cast path); denyText only.

---

### IN-02: `vitest.setup.ts` installs `CSS.highlights` as `new Map()` but `CSS.highlights` is a `HighlightRegistry`, not a plain `Map`

**File:** `ui/vitest.setup.ts:24-26`

**Issue:**
```typescript
;(CSS as { highlights: unknown }).highlights = new Map()
```
`CSS.highlights` is a `HighlightRegistry` object in browsers, not a plain `Map`. The mock is typed as `unknown` so the TypeScript compiler does not catch the discrepancy. Any code that calls `CSS.highlights.set(name, highlight)` or `CSS.highlights.has(name)` in tests would receive a `Map` instead of a `HighlightRegistry`. If the CSS Highlight API is never called in the reviewer-v2 subtree this is harmless, but the mock is misleading.

**Fix:** Either use a no-op stub that matches the `HighlightRegistry` interface, or add a comment that this mock is intentionally minimal and only prevents `undefined` reference errors:
```typescript
// Minimal stub: prevents "Cannot set properties of undefined" on CSS.highlights.
// Only Map-compatible methods (set/delete/clear) are expected by the code under test.
;(CSS as { highlights: unknown }).highlights = new Map()
```

---

_Reviewed: 2026-05-20T05:32:03Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
