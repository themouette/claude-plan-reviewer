# Phase 22: Submit & Clipboard - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 4 (2 new, 2 modified)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `ui/src/reviewer-v2/SubmitBar.tsx` | component | request-response + event-driven | `ui/src/App.tsx` (approve/deny section) | role-match (action bar sub-section) |
| `ui/src/reviewer-v2/SubmitBar.test.ts` | test | — | `ui/src/reviewer-v2/ReviewerV2Shell.test.ts` | exact (same source-contract pattern) |
| `ui/src/reviewer-v2/ReviewerV2Shell.tsx` | component | event-driven | self — extending existing file | self-analog |
| `ui/src/reviewer-v2/ReviewerV2.tsx` | component | event-driven | self — removing void discards | self-analog |

## Pattern Assignments

### `ui/src/reviewer-v2/SubmitBar.tsx` (component, request-response + event-driven)

**Analog:** `ui/src/App.tsx` action bar section (lines 1349–1566)

**Imports pattern** — copy from analog, scoped to v2 subtree only (ARCH-01 enforced by ESLint: no imports from outside `reviewer-v2/`):

```typescript
import { useState } from 'react'
import type { Annotation } from './types'
import type { ConnectivityStatus } from './connectivity'
import { buildClipboardPayload, shouldUseClipboard } from './offlineLabels'
import { serializeAnnotations } from './serializeAnnotations'
```

**Props interface** — derived from RESEARCH.md architecture diagram:

```typescript
interface SubmitBarProps {
  annotations: Annotation[]
  connectivity: ConnectivityStatus
}
```

**Submit state type** — modelled on `AppState` in `ui/src/App.tsx` (line 36), scoped to bar outcomes only:

```typescript
type SubmitState =
  | 'idle'
  | 'confirmed_allow'
  | 'confirmed_deny'
  | 'clipboard_confirmed'
  | 'clipboard_error'
  | 'error'
```

**Gate logic** — pure read of annotation count, no side-effects (RESEARCH.md Pattern 2):

```typescript
const canApprove   = annotations.length === 0
const canAskChange = annotations.length > 0
```

**Approve handler (online + offline)** — copy structure from `ui/src/App.tsx` `approve()` (lines 785–814). Key constraints:
- Call `navigator.clipboard.writeText(json)` BEFORE any `await` (transient activation — Pitfall 4 in RESEARCH.md)
- Pass `overallMessage` as `denyText` (first param), `''` as `overallComment` (Pitfall 3)

```typescript
async function handleApprove() {
  if (shouldUseClipboard(connectivity)) {
    const json = buildClipboardPayload('allow', '', '', annotations)
    navigator.clipboard.writeText(json)
      .then(() => setSubmitState('clipboard_confirmed'))
      .catch(() => { setClipboardJson(json); setSubmitState('clipboard_error') })
    return
  }
  try {
    const res = await fetch('/api/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ behavior: 'allow' }),
    })
    if (res.ok || res.status === 409) setSubmitState('confirmed_allow')
    else setSubmitState('error')
  } catch {
    setSubmitState('error')
  }
}
```

**Ask-for-changes handler** — copy structure from `ui/src/App.tsx` `deny()` (lines 1170–1202):

```typescript
async function handleAskForChanges() {
  if (shouldUseClipboard(connectivity)) {
    const json = buildClipboardPayload('deny', overallMessage, '', annotations)
    navigator.clipboard.writeText(json)
      .then(() => setSubmitState('clipboard_confirmed'))
      .catch(() => { setClipboardJson(json); setSubmitState('clipboard_error') })
    return
  }
  const message = serializeAnnotations(overallMessage, '', annotations)
  try {
    const res = await fetch('/api/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ behavior: 'deny', message }),
    })
    if (res.ok || res.status === 409) setSubmitState('confirmed_deny')
    else setSubmitState('error')
  } catch {
    setSubmitState('error')
  }
}
```

**Button disabled attribute pattern** — use HTML `disabled` (not opacity-only). Pitfall 5 in RESEARCH.md says opacity alone allows keyboard activation:

```typescript
<button disabled={!canApprove} onClick={handleApprove} ...>
  Approve
</button>
<button disabled={!canAskChange} onClick={handleAskForChanges} ...>
  Ask for Changes
</button>
```

**Button styling** — copy from `ui/src/App.tsx` action bar buttons (lines 1406–1479). Approve uses `var(--color-accent-approve)`, Ask for Changes uses `var(--color-accent-deny)`. Focus ring pattern:

```typescript
onFocus={(e) => {
  e.currentTarget.style.outline = '2px solid var(--color-focus)'
  e.currentTarget.style.outlineOffset = '2px'
}}
onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
```

**Textarea pattern** — copy from `ui/src/App.tsx` overall-comment textarea (lines 1373–1401):

```typescript
<textarea
  id="overall-message"
  value={overallMessage}
  onChange={(e) => setOverallMessage(e.target.value)}
  placeholder="Add an overall note..."
  rows={2}
  style={{
    display: 'block',
    width: '100%',
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '4px',
    color: 'var(--color-text-primary)',
    padding: '8px',
    fontSize: '16px',
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
    outline: 'none',
  }}
  onFocus={(e) => {
    e.currentTarget.style.outline = '2px solid var(--color-focus)'
    e.currentTarget.style.outlineOffset = '2px'
  }}
  onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
/>
```

**Clipboard error fallback** — copy from `ui/src/App.tsx` `ClipboardErrorView` (lines 523–577): render a read-only textarea with the JSON payload and an `onClick` to select all. Keep inline in `SubmitBar` rather than a separate full-screen view (see RESEARCH.md Open Question 1 recommendation).

**Container layout** — copy from `ui/src/App.tsx` action bar container (lines 1349–1357):

```typescript
<div
  style={{
    position: 'sticky',
    bottom: 0,
    background: 'var(--color-surface)',
    borderTop: '1px solid var(--color-border)',
    padding: '16px 32px',
  }}
>
```

---

### `ui/src/reviewer-v2/SubmitBar.test.ts` (test, source-contract)

**Analog:** `ui/src/reviewer-v2/ReviewerV2Shell.test.ts` (lines 1–78) — exact same pattern

**File header pattern** (lines 1–10 of ReviewerV2Shell.test.ts):

```typescript
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import SubmitBar from './SubmitBar'

const source = readFileSync(
  resolve(__dirname, './SubmitBar.tsx'),
  'utf-8',
)
```

**Source-contract assertion pattern** — import path assertions using `toContain` (established across all v2 tests):

```typescript
describe('SubmitBar', () => {
  it('default export is a function', () => {
    expect(typeof SubmitBar).toBe('function')
  })

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

  it('uses disabled={!canApprove} on Approve button', () => {
    expect(source).toContain('disabled={!canApprove}')
  })

  it('uses disabled={!canAskChange} on Ask for Changes button', () => {
    expect(source).toContain('disabled={!canAskChange}')
  })

  it('POSTs to /api/decide with behavior: allow on approve', () => {
    expect(source).toContain("behavior: 'allow'")
    expect(source).toContain('/api/decide')
  })

  it('POSTs to /api/decide with behavior: deny on ask for changes', () => {
    expect(source).toContain("behavior: 'deny'")
  })

  it('imports serializeAnnotations from ./serializeAnnotations', () => {
    expect(source).toContain('serializeAnnotations')
    expect(source).toContain("from './serializeAnnotations'")
  })
})
```

**Multi-`describe` grouping pattern** — copy from `ReviewerV2Shell.test.ts` (lines 80–121) which groups phase-specific tests in a separate `describe` block labelled with the phase number.

---

### `ui/src/reviewer-v2/ReviewerV2Shell.tsx` (component, modified)

**Self-analog:** existing file at `/Users/julien.muetton/Projects/lab/claude-plan-reviewer/ui/src/reviewer-v2/ReviewerV2Shell.tsx`

**Current imports** (lines 1–7) — add `useHeartbeat` and `SubmitBar`:

```typescript
import { useEffect, useRef, useState } from 'react'
import ContentPane from './ContentPane'
import OutlinePane from './OutlinePane'
import CommentPane from './CommentPane'
import { useAnnotations } from './useAnnotations'
import { useHeartbeat } from './useHeartbeat'        // ADD
import SubmitBar from './SubmitBar'                  // ADD
import { useSectionAnnotationCounts } from './hooks/useSectionAnnotationCounts'
import type { Section } from './types'
```

**Hook call addition** — add `useHeartbeat()` call alongside `useAnnotations()` (line 14):

```typescript
const { annotations, addAnnotation, editAnnotation, removeAnnotation } = useAnnotations()
const connectivity = useHeartbeat()    // ADD — was void-discarded in ReviewerV2.tsx
```

**SubmitBar mount** — add inside the outer flex column, after the 3-column body row (after line 134 `</div>`). Place it as a sibling of the header and the body row, at the bottom:

```typescript
<SubmitBar annotations={annotations} connectivity={connectivity} />
```

The shell's outer `<div className="flex flex-col h-screen overflow-hidden">` already stacks children vertically — SubmitBar as last child sits at the bottom, and its `position: sticky; bottom: 0` keeps it pinned even if the body row scrolls.

---

### `ui/src/reviewer-v2/ReviewerV2.tsx` (component, modified)

**Self-analog:** existing file at `/Users/julien.muetton/Projects/lab/claude-plan-reviewer/ui/src/reviewer-v2/ReviewerV2.tsx`

**Current state** (full file, lines 1–17):

```typescript
import 'highlight.js/styles/github-dark.css'
import { useHeartbeat } from './useHeartbeat'
import { useAnnotations } from './useAnnotations'
import ReviewerV2Shell from './ReviewerV2Shell'

export default function ReviewerV2() {
  void useHeartbeat()    // Phase 22: move to ReviewerV2Shell
  void useAnnotations()  // Phase 22: remove — ReviewerV2Shell already owns it
  return <ReviewerV2Shell />
}
```

**Required changes:**
1. Remove `import { useHeartbeat } from './useHeartbeat'` — Shell now owns it
2. Remove `import { useAnnotations } from './useAnnotations'` — Shell already owns it; this was a phantom second reducer
3. Remove both `void` hook calls
4. Result is a clean pass-through to `<ReviewerV2Shell />`

---

## Shared Patterns

### Source-contract test structure
**Source:** `ui/src/reviewer-v2/ReviewerV2Shell.test.ts` (lines 1–10)
**Apply to:** `SubmitBar.test.ts`

```typescript
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import ComponentName from './ComponentName'

const source = readFileSync(
  resolve(__dirname, './ComponentName.tsx'),
  'utf-8',
)
```

No `@testing-library/react`. No DOM render. All assertions via `toContain` / `toMatch` on the source string or runtime `typeof` checks on the default export.

### Button styling with focus ring
**Source:** `ui/src/App.tsx` (lines 1406–1450)
**Apply to:** `SubmitBar.tsx` — all interactive buttons

```typescript
style={{
  background: 'var(--color-accent-approve)',  // or var(--color-accent-deny)
  color: 'var(--color-text-primary)',
  border: 'none',
  borderRadius: '6px',
  padding: '8px 16px',
  minHeight: '44px',
  fontSize: '16px',
  fontWeight: 600,
  cursor: 'pointer',
  outline: 'none',
}}
onFocus={(e) => {
  e.currentTarget.style.outline = '2px solid var(--color-focus)'
  e.currentTarget.style.outlineOffset = '2px'
}}
onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
```

### Offline clipboard write (transient activation safe)
**Source:** `ui/src/App.tsx` `approve()` (lines 789–797)
**Apply to:** `SubmitBar.tsx` both handlers

Call `navigator.clipboard.writeText(json)` synchronously inside the click handler. Do NOT `await` anything before the clipboard call. Chain `.then()` / `.catch()` for state transitions after the write.

```typescript
// CORRECT — clipboard write is synchronous in the click handler
navigator.clipboard.writeText(json)
  .then(() => setSubmitState('clipboard_confirmed'))
  .catch(() => { setClipboardJson(json); setSubmitState('clipboard_error') })
return   // return before any await
```

### Fetch POST to /api/decide with try/catch
**Source:** `ui/src/App.tsx` `approve()` (lines 799–813) and `deny()` (lines 1186–1202)
**Apply to:** `SubmitBar.tsx` online submit paths

```typescript
try {
  const res = await fetch('/api/decide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ behavior: 'allow' }),  // or 'deny' + message
  })
  if (res.ok || res.status === 409) setSubmitState('confirmed_allow')
  else setSubmitState('error')
} catch {
  setSubmitState('error')
}
```

Note: `res.status === 409` is the "already decided" case — treat as success to avoid showing an error to the user when the server already committed the decision.

### offlineLabels import scope
**Source:** `ui/src/reviewer-v2/offlineLabels.ts` (lines 1–32)
**Apply to:** `SubmitBar.tsx` — MUST import from `./offlineLabels`, NOT from `../../utils/offlineLabels`

ARCH-01 ESLint rule enforces that `reviewer-v2/` components only import from within the subtree. The v2 `offlineLabels.ts` is the canonical copy.

## No Analog Found

No files in this phase lack an analog. All four files have strong matches:

- `SubmitBar.tsx`: App.tsx action bar is a direct pattern reference
- `SubmitBar.test.ts`: ReviewerV2Shell.test.ts is an exact structural match
- `ReviewerV2Shell.tsx`: self-modification with clear extension point
- `ReviewerV2.tsx`: self-modification (cleanup — removal of stubs)

## Metadata

**Analog search scope:** `ui/src/reviewer-v2/`, `ui/src/App.tsx`
**Files scanned:** 8 (App.tsx, ReviewerV2.tsx, ReviewerV2Shell.tsx, ReviewerV2Shell.test.ts, CommentBubble.test.ts, offlineLabels.ts, offlineLabels.test.ts, serializeAnnotations.ts, useHeartbeat.ts, connectivity.ts, types.ts)
**Pattern extraction date:** 2026-05-22
