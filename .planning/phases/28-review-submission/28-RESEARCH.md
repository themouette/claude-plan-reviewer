# Phase 28: Review Submission - Research

**Researched:** 2026-05-25
**Domain:** React 19 + TypeScript — submit bar, state machine, payload serialization, offline/clipboard fallback
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Output JSON Schema**
```json
{
  "decision": "approved" | "changes_requested",
  "global_instruction": "...",
  "comments": [
    { "file": "src/foo.ts", "line": 42, "side": "additions", "text": "..." },
    { "file": "src/bar.ts", "text": "..." }
  ]
}
```
- Line comments include `file`, `line`, `side`, `text`. Range comments add `endLine` (mirror Phase 27's `endLineNumber` or normalize to `endLine` — Claude's discretion).
- File-level comments include `file` and `text` only.
- `global_instruction` omitted (not `null`) when blank.
- `comments` omitted (not `[]`) when decision is `"approved"` with no comments.
- `buildCodeReviewPayload(decision, comments, globalInstruction?)` lives in `ui/src/code-review/`. Tested TDD-first (plan 28-01).

**D-02 — SubmitBar Placement**
Approve and Request Changes buttons go in `AppToolbar` right side (the `{/* Reserved */}<div />` gap). `AppToolbar` receives new props: `comments: CodeReviewComment[]`, `connectivity: ConnectivityStatus`, `onApprove`, `onRequestChanges`.

**D-03 — Heartbeat move to shared/**
`useHeartbeat` and `connectivity.ts` are MOVED (not copied) from `reviewer-v2/` to `ui/src/shared/`. Both `reviewer-v2` and `code-review` import from `shared/`.

**D-04 — CodeReviewApp calls useHeartbeat**
`CodeReviewApp` calls `useHeartbeat()` from `ui/src/shared/useHeartbeat`. The `does NOT call useHeartbeat` assertion in `CodeReviewApp.test.ts` must be removed/replaced.

**D-05 — Approve popover**
Clicking Approve opens `CodeReviewSubmitPopover` (new, under `ui/src/code-review/`). Request Changes submits immediately — no popover.

**D-06 — Validation gates**
- Approve: disabled when `comments.length > 0`
- Request Changes: disabled when `comments.length === 0`
- UI-only enforcement in Phase 28 (no server-side validation).

### Claude's Discretion

- Exact prop shape for passing `comments` and callbacks into `AppToolbar` vs a new `SubmitBar` sub-component
- Whether `CodeReviewSubmitPopover` is standalone or inlined in `AppToolbar`
- Field name for comment line ranges in JSON: `endLine` vs `endLineNumber`
- Clipboard fallback UX details (banner wording, button labels) — follow reviewer-v2 patterns

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. Phase 29 wires the backend `/api/decide` POST endpoint for code review.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SUBMIT-01 | User can approve the review when no comments exist | Gate logic D-06: Approve enabled when `comments.length === 0`; popover D-05 opens for optional global instruction |
| SUBMIT-02 | User can include an optional global instruction when approving | `CodeReviewSubmitPopover` with optional textarea; `global_instruction` field in JSON schema D-01 |
| SUBMIT-03 | User can submit with comments; structured feedback JSON returned to agent | `buildCodeReviewPayload` pure function + `comments` array serialized into D-01 schema |
| SUBMIT-04 | Submitting "request changes" requires at least one comment | Gate logic D-06: Request Changes disabled when `comments.length === 0` |
</phase_requirements>

---

## Summary

Phase 28 adds the review submission flow to the code review UI. The work splits into three independent sub-problems: (1) a pure serialization function `buildCodeReviewPayload` that maps `CodeReviewComment[]` to the structured JSON schema, (2) a state-machine-driven `AppToolbar` extension with `Approve` / `Request Changes` buttons and an `Approve` popover, and (3) moving the heartbeat/connectivity infrastructure from `reviewer-v2/` to a new `ui/src/shared/` directory so `code-review/` can consume it without violating the ESLint import boundary.

The codebase already contains the complete reference implementation: `reviewer-v2/SubmitControls.tsx` (state machine, auto-close, clipboard fallback), `reviewer-v2/SubmitPopover.tsx` (popover pattern), and `reviewer-v2/connectivity.ts` / `useHeartbeat.ts` (heartbeat polling). Phase 28 re-implements the submit pattern for `code-review/` — it must NOT import from `reviewer-v2/`. All new files go under `ui/src/code-review/` except the two shared files moved to `ui/src/shared/`.

The critical test constraint is that `CodeReviewApp.test.ts` currently asserts `does NOT call useHeartbeat`. This assertion must be removed and replaced with a positive assertion that `useHeartbeat` IS called from `shared/`.

**Primary recommendation:** Implement in order — shared/ move first (breaks no tests if imports are updated simultaneously), then TDD `buildCodeReviewPayload`, then UI components.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| JSON payload serialization | Frontend (pure function) | — | Pure function, no I/O — belongs in the UI layer close to the data it reads |
| Validation gate logic | Frontend | — | Button disabled states derived from `comments.length`; no server round-trip needed |
| Approve popover UX | Frontend component | — | Local UI state machine (`'idle' \| 'popover_open'`) |
| Offline detection | Shared hook (useHeartbeat) | — | Polling hook shared by both reviewer-v2 and code-review |
| Clipboard fallback | Frontend | — | `navigator.clipboard.writeText` — browser API, no server |
| POST to /api/decide | Frontend → Backend | — | Phase 28 fires the request; backend endpoint for code review is Phase 29 |

---

## Standard Stack

No new npm packages. This phase is pure in-codebase work using:

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.x | Component rendering | Project standard [ASSUMED — pinned in ui/package.json] |
| TypeScript | 5.x | Type safety | Project standard [ASSUMED] |
| Vitest + jsdom | project version | Unit tests | Established test framework; all existing tests use it [VERIFIED: codebase inspection] |

### No New Packages
Per CONTEXT.md and `ui/src/code-review/` convention: no new npm packages unless justified. All patterns are covered by existing code in `reviewer-v2/`.

---

## Package Legitimacy Audit

Not applicable — this phase installs no external packages.

---

## Architecture Patterns

### System Architecture Diagram

```
CodeReviewApp
├── useHeartbeat()                     ← from ui/src/shared/useHeartbeat (moved)
│   └── ConnectivityStatus             → flows down as prop
├── useCodeReviewAnnotations()         ← already wired (Phase 27)
│   └── comments: CodeReviewComment[]  → flows to AppToolbar + submit path
│
├── AppToolbar (modified)
│   ├── [existing buttons unchanged]
│   └── [NEW] SubmitBar area (right side "Reserved" slot)
│       ├── Approve button (gated: disabled when comments.length > 0)
│       │   └── onClick → SubmitState: idle → popover_open (online)
│       │                             idle → clipboard (offline)
│       ├── Request Changes button (gated: disabled when comments.length === 0)
│       │   └── onClick → handleRequestChanges → POST /api/decide | clipboard
│       └── [NEW] CodeReviewSubmitPopover
│           ├── optional global instruction textarea
│           └── Confirm → onApprove(globalInstruction?)
│
├── submit path (online)
│   └── fetch POST /api/decide  ← endpoint body = buildCodeReviewPayload(...)
│       └── on success → SubmitState: confirmed_approve | confirmed_request_changes
│                      → window.close() after 500ms
│
└── submit path (offline / error fallback)
    └── navigator.clipboard.writeText(buildCodeReviewPayload(...))
        ├── success → SubmitState: clipboard_confirmed (auto-reset 3000ms)
        └── failure → SubmitState: clipboard_error (read-only textarea shown)
```

### Recommended Project Structure

```
ui/src/
├── shared/                              ← NEW directory
│   ├── connectivity.ts                  ← MOVED from reviewer-v2/connectivity.ts
│   └── useHeartbeat.ts                  ← MOVED from reviewer-v2/useHeartbeat.ts
├── code-review/
│   ├── buildCodeReviewPayload.ts        ← NEW: pure serialization function (plan 28-01)
│   ├── buildCodeReviewPayload.test.ts   ← NEW: Vitest TDD tests (plan 28-01)
│   ├── CodeReviewSubmitPopover.tsx      ← NEW: Approve popover (plan 28-02)
│   ├── AppToolbar.tsx                   ← MODIFIED: new props + submit controls
│   ├── CodeReviewApp.tsx                ← MODIFIED: add useHeartbeat(), pass connectivity
│   ├── CodeReviewApp.test.ts            ← MODIFIED: remove/replace useHeartbeat negative assertion
│   └── AppToolbar.test.ts              ← MODIFIED: add tests for new props and buttons
└── reviewer-v2/
    ├── ReviewerV2Shell.tsx              ← MODIFIED: update imports from ./useHeartbeat → ../shared/useHeartbeat
    ├── useHeartbeat.ts                  ← DELETED (moved to shared/)
    ├── useHeartbeat.test.ts             ← MOVED to shared/ or updated to import from ../shared/
    ├── connectivity.ts                  ← DELETED (moved to shared/)
    └── connectivity.test.ts             ← MOVED to shared/ or updated to import from ../shared/
```

### Pattern 1: buildCodeReviewPayload (Pure Serialization Function)

**What:** Maps `CodeReviewComment[]` + decision + optional global instruction to the D-01 JSON schema.
**When to use:** Called by both online POST path and offline clipboard path.

```typescript
// Source: CONTEXT.md D-01 schema + Phase 27 types.ts CodeReviewComment discriminated union
import type { CodeReviewComment } from './types'

export type ReviewDecision = 'approved' | 'changes_requested'

interface CommentOutput {
  file: string
  line?: number
  side?: 'additions' | 'deletions'
  endLine?: number  // or endLineNumber — Claude's discretion
  text: string
}

interface CodeReviewPayload {
  decision: ReviewDecision
  global_instruction?: string   // omitted when blank
  comments?: CommentOutput[]    // omitted when approved with no comments
}

export function buildCodeReviewPayload(
  decision: ReviewDecision,
  comments: CodeReviewComment[],
  globalInstruction?: string,
): string {
  const payload: CodeReviewPayload = { decision }

  if (globalInstruction && globalInstruction.trim()) {
    payload.global_instruction = globalInstruction.trim()
  }

  if (comments.length > 0) {
    payload.comments = comments.map((c) => {
      if (c.type === 'file') {
        return { file: c.file, text: c.text }
      }
      const out: CommentOutput = {
        file: c.file,
        line: c.lineNumber,
        side: c.side,
        text: c.text,
      }
      if (c.endLineNumber !== undefined) out.endLine = c.endLineNumber
      return out
    })
  }

  return JSON.stringify(payload)
}
```

### Pattern 2: Submit State Machine

**What:** `SubmitState` union type managing all states of the submit flow. Mirror of `reviewer-v2/SubmitControls.tsx`.
**When to use:** Local state in `AppToolbar` (or a `SubmitBar` sub-component within it).

```typescript
// Source: ui/src/reviewer-v2/SubmitControls.tsx (verified by codebase inspection)
type SubmitState =
  | 'idle'
  | 'popover_open'
  | 'confirmed_approve'
  | 'confirmed_request_changes'
  | 'clipboard_confirmed'
  | 'clipboard_error'
```

Key side-effects to replicate (from SubmitControls.tsx):
- `confirmed_approve` / `confirmed_request_changes` → `window.close()` after 500ms
- `clipboard_confirmed` → auto-reset to `'idle'` after 3000ms

### Pattern 3: useHeartbeat Move

**What:** Move two files from `reviewer-v2/` to `shared/`. Update all imports.
**When to use:** Step 0 before any UI changes — keeps reviewer-v2 green throughout.

Files to move:
- `ui/src/reviewer-v2/useHeartbeat.ts` → `ui/src/shared/useHeartbeat.ts`
- `ui/src/reviewer-v2/connectivity.ts` → `ui/src/shared/connectivity.ts`

Files that need import updates after the move [VERIFIED: codebase inspection]:
- `reviewer-v2/ReviewerV2Shell.tsx` — `from './useHeartbeat'` → `from '../shared/useHeartbeat'`
- `reviewer-v2/SubmitControls.tsx` — `from './connectivity'` → `from '../shared/connectivity'`
- `reviewer-v2/offlineLabels.ts` — `from './connectivity'` → `from '../shared/connectivity'`
- `reviewer-v2/useHeartbeat.ts` — internal import `from './connectivity'` → `from './connectivity'` (same file, no change needed if test files are moved too)
- `reviewer-v2/useHeartbeat.test.ts` — imports from `./useHeartbeat` and `./connectivity` — if this test moves to `shared/`, imports stay `./useHeartbeat` etc.
- `reviewer-v2/connectivity.test.ts` — imports from `./connectivity`

**ESLint note:** The current ESLint rule for `reviewer-v2/**` forbids `../**` imports. After the move, `reviewer-v2/ReviewerV2Shell.tsx` will import from `../shared/useHeartbeat` — this IS a `../**` import and WILL violate the current rule. The rule must be updated to allow `../shared/**` for reviewer-v2 files. [VERIFIED: codebase inspection of eslint.config.mjs]

### Pattern 4: AppToolbar New Props

**What:** Extend `AppToolbarProps` with submit controls. The `{/* Reserved */}<div />` placeholder is replaced with the actual submit controls.
**When to use:** Plan 28-02 — after TDD tests for buildCodeReviewPayload are green.

```typescript
// Source: ui/src/code-review/AppToolbar.tsx (verified by codebase inspection)
// Add to AppToolbarProps:
comments: CodeReviewComment[]       // derive canApprove / canRequestChanges
connectivity: ConnectivityStatus    // from shared/connectivity
onApprove: (globalInstruction?: string) => void
onRequestChanges: () => void
```

### Pattern 5: CodeReviewSubmitPopover

**What:** New component mirroring `reviewer-v2/SubmitPopover.tsx`. Key differences from original:
- `aria-label="Approve review"` (not "Send feedback")
- Textarea label: "Global instruction (optional)"
- Textarea placeholder: "Leave an instruction for the agent (optional)"
- Submit button label: "Confirm Approve"
- Submit button color: `var(--color-accent-approve)` (green, not red)
- No `messageRequired` prop (message always optional)
- Keyboard: Cmd+Enter submits

Visual shell dimensions are identical to `SubmitPopover.tsx`: `position: absolute; top: 40px; right: 0; minWidth: 320px; zIndex: 50`. [VERIFIED: codebase inspection of SubmitPopover.tsx]

### Anti-Patterns to Avoid

- **Importing from reviewer-v2/:** ESLint rule enforces this. Will break CI. All submit patterns must be re-implemented in `code-review/`.
- **Importing `shared/` before creating it:** The `ui/src/shared/` directory does not yet exist. The move must create it.
- **Forgetting the ESLint rule update for reviewer-v2/:** After moving connectivity.ts to shared/, `reviewer-v2/ReviewerV2Shell.tsx` will import `../shared/useHeartbeat`. The existing rule bans ALL `../**` imports from reviewer-v2. The rule needs an exception for `../shared/**`.
- **Leaving the negative useHeartbeat assertion in CodeReviewApp.test.ts:** Line 85 asserts `expect(source).not.toContain('useHeartbeat')`. Phase 28 adds `useHeartbeat` to CodeReviewApp. This assertion will fail — it MUST be replaced with a positive assertion.
- **Adding `comments` to the JSON output when approved with no comments:** D-01 says `comments` is omitted (not `[]`) for clean approval. An empty array would change the JSON shape.
- **Duplicating `connectivity.ts` instead of moving it:** D-03 says MOVE, not copy. The reviewer-v2 path no longer exists after the move.
- **Blocking Request Changes with a popover:** D-05 says Request Changes submits immediately — no popover.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Heartbeat polling | Custom fetch loop | `useHeartbeat` (already exists in reviewer-v2, moving to shared/) | 3-failure hysteresis, visibilitychange integration, AbortSignal.any, generation guards — all already solved |
| State machine transitions | Ad-hoc boolean flags | SubmitState union type + useState | Mirrors the proven pattern in reviewer-v2/SubmitControls.tsx; explicit states prevent impossible state combinations |
| Popover dismiss behavior | Custom event listener | Replicate SubmitPopover.tsx pattern exactly (Escape + outside-click handlers) | Pattern already tested and stable; don't diverge |
| JSON serialization | Custom string templating | `JSON.stringify(payload)` with TypeScript type enforcement | Type safety prevents field omission bugs |

**Key insight:** 95% of Phase 28 is replication, not invention. Every pattern exists in `reviewer-v2/`. The discipline is to replicate (not import) — the ESLint rule is a hard gate.

---

## Common Pitfalls

### Pitfall 1: ESLint Import Boundary After shared/ Move

**What goes wrong:** After moving `connectivity.ts` to `ui/src/shared/`, `reviewer-v2/ReviewerV2Shell.tsx` must import from `../shared/useHeartbeat`. The current ESLint rule (`no-restricted-imports` for `reviewer-v2/**`) bans ALL `../**` patterns. The import fails lint.
**Why it happens:** The rule was written when reviewer-v2 was fully self-contained. Moving connectivity to shared/ creates a legitimate cross-subtree import.
**How to avoid:** Update `eslint.config.mjs` — change the `group: ['../**']` pattern for `reviewer-v2/**` to allow `../shared/**`. Example: use two patterns `['../**/!(*shared*)', '*/!(*shared*)/reviewer-v2/**']` or restructure to explicitly allow `../shared/**`.
**Warning signs:** `npm run lint` (or `eslint src/reviewer-v2/`) failing after the move with "must not import from outside the subtree."

### Pitfall 2: ReviewerV2Shell.test.ts Assertion on Import Path

**What goes wrong:** `ReviewerV2Shell.test.ts` (line 124) asserts `from './useHeartbeat'` (relative local path). After the move, the import becomes `from '../shared/useHeartbeat'`. The test will fail.
**Why it happens:** Source-assertion tests check exact import strings.
**How to avoid:** Update the assertion in `ReviewerV2Shell.test.ts` to match the new path `../shared/useHeartbeat`.
**Warning signs:** `ReviewerV2Shell.test.ts` failing with "does not contain `./useHeartbeat`."

### Pitfall 3: Negative useHeartbeat Assertion in CodeReviewApp.test.ts

**What goes wrong:** Line 85 of `CodeReviewApp.test.ts` explicitly asserts `expect(source).not.toContain('useHeartbeat')`. Phase 28 adds `useHeartbeat` to CodeReviewApp. This test will immediately fail.
**Why it happens:** The assertion was added in Phase 25 to enforce that code-review didn't prematurely depend on heartbeat before the connectivity infrastructure was ready.
**How to avoid:** Remove the negative assertion; add a positive one: `expect(source).toContain('useHeartbeat')` and `expect(source).toContain("from '../shared/useHeartbeat'")` (or `from './shared/useHeartbeat'` depending on directory layout).
**Warning signs:** First test run of Phase 28-02 failing.

### Pitfall 4: `comments` Field Emitted for Clean Approval

**What goes wrong:** `buildCodeReviewPayload('approved', [], undefined)` emits `{"decision":"approved","comments":[]}` instead of `{"decision":"approved"}`.
**Why it happens:** Forgetting the `comments.length > 0` guard before building the comments array.
**How to avoid:** TDD first — write a test that asserts `JSON.parse(result)` has no `comments` key for the zero-comment approval case.
**Warning signs:** A test asserting `!('comments' in parsed)` failing.

### Pitfall 5: useHeartbeat.test.ts / connectivity.test.ts Relative Imports

**What goes wrong:** If the test files are kept in `reviewer-v2/` after the source files are moved to `shared/`, the relative imports (`from './connectivity'`, `from './useHeartbeat'`) will resolve to files that no longer exist.
**Why it happens:** Forgetting to move or update the test files as part of the same PR.
**How to avoid:** Move the test files to `ui/src/shared/` together with the source files, or update their import paths to `../shared/`.
**Warning signs:** TypeScript compile error "Cannot find module './connectivity'."

---

## Code Examples

### buildCodeReviewPayload — Edge Cases to Cover in TDD

```typescript
// Source: CONTEXT.md D-01 schema — verified edge cases

// 1. Clean approval (no comments, no instruction) — comments key omitted
buildCodeReviewPayload('approved', [])
// → '{"decision":"approved"}'

// 2. Approval with global instruction
buildCodeReviewPayload('approved', [], 'Please also update the docs')
// → '{"decision":"approved","global_instruction":"Please also update the docs"}'

// 3. Approval with blank instruction — global_instruction omitted
buildCodeReviewPayload('approved', [], '   ')
// → '{"decision":"approved"}'

// 4. Request changes with line comment
buildCodeReviewPayload('changes_requested', [{
  id: 'x', type: 'line', file: 'src/foo.ts', lineNumber: 42,
  side: 'additions', text: 'Use const here', createdAt: '...'
}])
// → '{"decision":"changes_requested","comments":[{"file":"src/foo.ts","line":42,"side":"additions","text":"Use const here"}]}'

// 5. Request changes with file comment
buildCodeReviewPayload('changes_requested', [{
  id: 'y', type: 'file', file: 'src/bar.ts', text: 'Missing exports', createdAt: '...'
}])
// → '{"decision":"changes_requested","comments":[{"file":"src/bar.ts","text":"Missing exports"}]}'

// 6. Range comment (endLineNumber present)
// → output includes endLine (or endLineNumber — Claude's discretion on field name)
```

### Auto-close Tab Pattern (from reviewer-v2/SubmitControls.tsx)

```typescript
// Source: ui/src/reviewer-v2/SubmitControls.tsx (verified by codebase inspection)
useEffect(() => {
  if (submitState === 'confirmed_approve' || submitState === 'confirmed_request_changes') {
    const id = window.setTimeout(() => {
      try { window.close() } catch { /* browser may block window.close() — ignore */ }
    }, 500)
    return () => clearTimeout(id)
  }
}, [submitState])
```

### Clipboard Auto-reset Pattern (from reviewer-v2/SubmitControls.tsx)

```typescript
// Source: ui/src/reviewer-v2/SubmitControls.tsx (verified by codebase inspection)
useEffect(() => {
  if (submitState === 'clipboard_confirmed') {
    const id = window.setTimeout(() => setSubmitState('idle'), 3000)
    return () => clearTimeout(id)
  }
}, [submitState])
```

### handleApprove Pattern (adapted for code-review)

```typescript
// Source: reviewer-v2/SubmitControls.tsx pattern — adapted for code-review
async function handleApprove(globalInstruction?: string) {
  if (shouldUseClipboard(connectivity)) {
    const json = buildCodeReviewPayload('approved', comments, globalInstruction)
    navigator.clipboard.writeText(json)
      .then(() => setSubmitState('clipboard_confirmed'))
      .catch(() => { setClipboardJson(json); setSubmitState('clipboard_error') })
    return
  }
  try {
    const body = buildCodeReviewPayload('approved', comments, globalInstruction)
    const res = await fetch('/api/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (res.ok || res.status === 409) {
      setSubmitState('confirmed_approve')
    } else {
      setClipboardJson(body)
      setSubmitState('clipboard_error')
    }
  } catch {
    const json = buildCodeReviewPayload('approved', comments, globalInstruction)
    setClipboardJson(json)
    setSubmitState('clipboard_error')
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `reviewer-v2` heartbeat self-contained | `shared/` heartbeat used by both apps | Phase 28 | Allows `code-review/` to use connectivity without ESLint violation |
| No submit flow in code-review | Full submit bar with gate logic | Phase 28 | Completes SUBMIT-01 through SUBMIT-04 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `buildCodeReviewPayload` output is consumed directly as the POST body to `/api/decide` in Phase 28 | Code Examples | Low risk — Phase 28 CONTEXT says Phase 29 wires the backend endpoint; Phase 28 wires the client path. The body format may need alignment with Phase 29 backend schema. |
| A2 | `endLine` is the correct field name for line ranges in output JSON (vs `endLineNumber` from Phase 27 internal type) | Pattern 1 code example | CONTEXT.md D-01 leaves this as Claude's discretion — either name is acceptable per spec |

---

## Open Questions

1. **ESLint rule update scope for reviewer-v2/ after shared/ move**
   - What we know: current rule bans all `../**` imports from `reviewer-v2/**`
   - What's unclear: whether to use a narrower exclusion (`../shared/**` allowed) or restructure the rule entirely
   - Recommendation: add a second pattern entry that explicitly allows `../shared/**` while keeping the existing ban on other `../**` paths

2. **Should useHeartbeat.test.ts and connectivity.test.ts move to shared/ or stay in reviewer-v2/?**
   - What we know: tests currently import via relative paths that will break if source moves
   - What's unclear: project convention for co-location of tests for shared utilities
   - Recommendation: move test files to `shared/` alongside the source files for consistency with the project pattern of co-located tests

3. **Handling `status === 409` in code-review POST path**
   - What we know: reviewer-v2/SubmitControls.tsx treats `res.status === 409` as success (already submitted)
   - What's unclear: whether the code-review submit endpoint will use the same 409 convention (Phase 29 scope)
   - Recommendation: replicate the `res.ok || res.status === 409` pattern for defensive programming; Phase 29 can refine

---

## Environment Availability

Step 2.6: SKIPPED — no external tools required. This phase is pure TypeScript/React file changes within the existing Vite project.

---

## Security Domain

> `security_enforcement` not set in config.json — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (minimal) | `globalInstruction.trim()` before including; `comments.length` gate |
| V6 Cryptography | no | — |

### Known Threat Patterns for Submit Flow

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via comment text in JSON payload | Tampering | `JSON.stringify` escapes all special characters automatically — no manual sanitization needed |
| Clipboard interception | Information Disclosure | Local-only tool; clipboard is the designed offline fallback — acceptable risk |
| POST to /api/decide with malformed payload | Tampering | Phase 29 responsibility — Phase 28 constructs payload via typed `buildCodeReviewPayload` function |

---

## Sources

### Primary (HIGH confidence)
- `ui/src/reviewer-v2/SubmitControls.tsx` — state machine, auto-close, clipboard pattern (verified by codebase inspection)
- `ui/src/reviewer-v2/SubmitPopover.tsx` — popover pattern, outside-click dismiss, Cmd+Enter (verified by codebase inspection)
- `ui/src/reviewer-v2/useHeartbeat.ts` — heartbeat polling implementation (verified by codebase inspection)
- `ui/src/reviewer-v2/connectivity.ts` — ConnectivityStatus type, HeartbeatState (verified by codebase inspection)
- `ui/src/reviewer-v2/offlineLabels.ts` — shouldUseClipboard pattern (verified by codebase inspection)
- `ui/src/code-review/types.ts` — CodeReviewComment discriminated union, exact field names (verified by codebase inspection)
- `ui/src/code-review/AppToolbar.tsx` — Reserved `<div />` slot location, existing props (verified by codebase inspection)
- `ui/src/code-review/CodeReviewApp.tsx` — full current state; existing useHeartbeat negative test (verified by codebase inspection)
- `ui/src/code-review/CodeReviewApp.test.ts` — line 85 negative assertion (verified by codebase inspection)
- `ui/eslint.config.mjs` — no-restricted-imports rules for both reviewer-v2 and code-review (verified by codebase inspection)
- `.planning/phases/28-review-submission/28-CONTEXT.md` — all locked decisions D-01 through D-06 (verified)
- `.planning/phases/28-review-submission/28-UI-SPEC.md` — copywriting contract, spacing, color tokens, submit state names (verified)

### Secondary (MEDIUM confidence)
- `.planning/phases/27-inline-comments/27-CONTEXT.md` — CodeReviewComment discriminated union shape confirmed as Phase 27 output

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing verified codebase
- Architecture: HIGH — all patterns verified from existing source files
- Pitfalls: HIGH — all identified from direct codebase inspection (ESLint rules, test assertions)
- Serialization schema: HIGH — D-01 locked in CONTEXT.md

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (stable — no external dependencies)
