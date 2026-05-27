# Phase 28: Review Submission - Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 10 (5 new, 5 modified)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `ui/src/shared/connectivity.ts` | utility (move) | transform | `ui/src/reviewer-v2/connectivity.ts` | exact (source file) |
| `ui/src/shared/useHeartbeat.ts` | hook (move) | event-driven | `ui/src/reviewer-v2/useHeartbeat.ts` | exact (source file) |
| `ui/src/code-review/buildCodeReviewPayload.ts` | utility | transform | `ui/src/reviewer-v2/offlineLabels.ts` | role-match (pure serialization function) |
| `ui/src/code-review/buildCodeReviewPayload.test.ts` | test | — | `ui/src/reviewer-v2/offlineLabels.test.ts` | exact (same: pure function TDD tests) |
| `ui/src/code-review/CodeReviewSubmitPopover.tsx` | component | request-response | `ui/src/reviewer-v2/SubmitPopover.tsx` | exact (parallel component, different copy) |
| `ui/src/code-review/AppToolbar.tsx` | component (modify) | request-response | `ui/src/reviewer-v2/SubmitControls.tsx` | role-match (submit button pattern) |
| `ui/src/code-review/CodeReviewApp.tsx` | component (modify) | request-response | `ui/src/reviewer-v2/ReviewerV2Shell.tsx` | role-match (shell wiring useHeartbeat) |
| `ui/src/code-review/CodeReviewApp.test.ts` | test (modify) | — | `ui/src/code-review/AppToolbar.test.ts` | exact (same source-assertion pattern) |
| `ui/src/code-review/AppToolbar.test.ts` | test (modify) | — | `ui/src/code-review/AppToolbar.test.ts` | exact (self — add new assertions) |
| `ui/src/reviewer-v2/ReviewerV2Shell.tsx` | component (modify imports) | — | self | exact (import-path update only) |

---

## Pattern Assignments

### `ui/src/shared/connectivity.ts` (utility — move from reviewer-v2)

**Analog:** `ui/src/reviewer-v2/connectivity.ts` (the source file itself — move verbatim)

**Full file content to move verbatim** (`ui/src/reviewer-v2/connectivity.ts`, lines 1–30):
```typescript
export type ConnectivityStatus = 'online' | 'offline'

export interface HeartbeatState {
  status: ConnectivityStatus
  failCount: number
}

export type HeartbeatEvent = { type: 'success' } | { type: 'failure' }

export const initialHeartbeatState: HeartbeatState = {
  status: 'online',
  failCount: 0,
}

export function nextHeartbeatState(
  state: HeartbeatState,
  event: HeartbeatEvent,
): HeartbeatState {
  switch (event.type) {
    case 'success':
      return { status: 'online', failCount: 0 }
    case 'failure': {
      const failCount = state.failCount + 1
      if (failCount >= 3) {
        return { status: 'offline', failCount }
      }
      return { status: state.status, failCount }
    }
  }
}
```

**Action:** Git move (`git mv`) — do NOT copy. The original `ui/src/reviewer-v2/connectivity.ts` is deleted by this move. The test file `ui/src/reviewer-v2/connectivity.test.ts` moves too (same action).

---

### `ui/src/shared/useHeartbeat.ts` (hook — move from reviewer-v2)

**Analog:** `ui/src/reviewer-v2/useHeartbeat.ts` (the source file itself — move verbatim)

**Import line that must change** (`ui/src/reviewer-v2/useHeartbeat.ts`, line 1–8):
```typescript
// BEFORE (old path):
import {
  initialHeartbeatState,
  nextHeartbeatState,
  type ConnectivityStatus,
  type HeartbeatEvent,
  type HeartbeatState,
} from './connectivity'

// AFTER (new path when moved to shared/):
// stays './connectivity' — both files are co-located in shared/, path is unchanged
```

**Action:** Git move the file. Since both `useHeartbeat.ts` and `connectivity.ts` move together to `shared/`, the internal import `from './connectivity'` remains valid with no change. The test file `ui/src/reviewer-v2/useHeartbeat.test.ts` moves to `ui/src/shared/useHeartbeat.test.ts` — its imports of `from './useHeartbeat'` and `from './connectivity'` also remain valid unchanged.

---

### `ui/src/code-review/buildCodeReviewPayload.ts` (utility — new, TDD plan 28-01)

**Analog:** `ui/src/reviewer-v2/offlineLabels.ts`

**Imports pattern** (`ui/src/reviewer-v2/offlineLabels.ts`, lines 1–4):
```typescript
import type { ConnectivityStatus } from './connectivity'
// adapt for code-review/:
import type { CodeReviewComment } from './types'
import type { ConnectivityStatus } from '../shared/connectivity'
```

**Core pure-function pattern** (`ui/src/reviewer-v2/offlineLabels.ts`, lines 10–35):
```typescript
// offlineLabels.ts - the structural model for buildCodeReviewPayload
// Key pattern: guard on field presence before including in payload,
// use JSON.stringify on a typed object (not string templating)
export function buildClipboardPayload(
  decision: ClipboardDecision,
  denyText: string,
  overallComment: string,
  annotations: Annotation[],
): string {
  if (decision === 'allow') {
    const notes = serializeAnnotations('', overallComment, annotations)
    if (notes.trim()) {
      return JSON.stringify({ behavior: 'allow', notes })
    }
    return JSON.stringify({ behavior: 'allow' })  // ← key: omit field entirely
  }
  const message = serializeAnnotations(denyText, overallComment, annotations)
  return JSON.stringify({ behavior: 'deny', message })
}

export function shouldUseClipboard(status: ConnectivityStatus): boolean {
  return status === 'offline'
}
```

**Core pattern to implement** (from CONTEXT.md D-01 + RESEARCH.md Pattern 1):
```typescript
import type { CodeReviewComment } from './types'

export type ReviewDecision = 'approved' | 'changes_requested'

interface CommentOutput {
  file: string
  line?: number
  side?: 'additions' | 'deletions'
  endLine?: number
  text: string
}

interface CodeReviewPayload {
  decision: ReviewDecision
  global_instruction?: string   // omitted (not null) when blank
  comments?: CommentOutput[]    // omitted (not []) when approved with no comments
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

export function shouldUseClipboard(status: ConnectivityStatus): boolean {
  return status === 'offline'
}
```

**Critical guard pattern** (field omission — mirrors `offlineLabels.ts` lines 17–22):
- `global_instruction` omitted unless `globalInstruction.trim()` is non-empty
- `comments` omitted unless `comments.length > 0`
- Never emit `null` or `[]` — omit the key entirely from the payload object

---

### `ui/src/code-review/buildCodeReviewPayload.test.ts` (test — new, TDD plan 28-01)

**Analog:** `ui/src/reviewer-v2/offlineLabels.test.ts` (full file, lines 1–51)

**Test file structure pattern** (`ui/src/reviewer-v2/offlineLabels.test.ts`, lines 1–51):
```typescript
import { describe, it, expect } from 'vitest'
import {
  buildClipboardPayload,
  shouldUseClipboard,
  OFFLINE_BANNER_LINE_1,
  OFFLINE_BANNER_LINE_2,
} from './offlineLabels'
import type { Annotation } from './types'

describe('buildClipboardPayload (v2 copy)', () => {
  it('allow with no notes returns exactly {"behavior":"allow"}', () => {
    const result = buildClipboardPayload('allow', '', '', [])
    expect(result).toBe('{"behavior":"allow"}')  // ← exact JSON string comparison
  })

  it('deny serializes message including denyText', () => {
    // fixture inline, not imported
    const annotation: Annotation = { id: '1', anchorText: 'foo', ... }
    const result = buildClipboardPayload('deny', 'blocked', '', [annotation])
    const parsed = JSON.parse(result) as { behavior: string; message: string }
    expect(parsed.behavior).toBe('deny')
    expect(parsed.message.includes('blocked')).toBe(true)
  })
})

describe('shouldUseClipboard (v2 copy)', () => {
  it('returns true when status is offline', () => {
    expect(shouldUseClipboard('offline')).toBe(true)
  })
  it('returns false when status is online', () => {
    expect(shouldUseClipboard('online')).toBe(false)
  })
})
```

**Adapter pattern for code-review:** Replace `Annotation` fixture with `CodeReviewComment` fixtures (line and file variants from `ui/src/code-review/types.ts`). Test the 6 edge cases from RESEARCH.md:

```typescript
import { describe, it, expect } from 'vitest'
import { buildCodeReviewPayload, shouldUseClipboard } from './buildCodeReviewPayload'
import type { CodeReviewComment } from './types'

const lineFixture: CodeReviewComment = {
  id: 'x', type: 'line', file: 'src/foo.ts', lineNumber: 42,
  side: 'additions', text: 'Use const here', createdAt: '2026-05-25T00:00:00Z',
}
const fileFixture: CodeReviewComment = {
  id: 'y', type: 'file', file: 'src/bar.ts',
  text: 'Missing exports', createdAt: '2026-05-25T00:00:00Z',
}

describe('buildCodeReviewPayload', () => {
  it('clean approval: comments key is absent (not [])', () => {
    const result = buildCodeReviewPayload('approved', [])
    expect(result).toBe('{"decision":"approved"}')
    // Redundant but explicit:
    expect('comments' in (JSON.parse(result) as object)).toBe(false)
  })

  it('approval with global instruction includes global_instruction field', () => {
    const result = buildCodeReviewPayload('approved', [], 'Update the docs')
    const parsed = JSON.parse(result) as Record<string, unknown>
    expect(parsed.global_instruction).toBe('Update the docs')
    expect('comments' in parsed).toBe(false)
  })

  it('blank/whitespace instruction: global_instruction is omitted', () => {
    const result = buildCodeReviewPayload('approved', [], '   ')
    expect(result).toBe('{"decision":"approved"}')
  })

  it('request changes with line comment', () => {
    const result = buildCodeReviewPayload('changes_requested', [lineFixture])
    const parsed = JSON.parse(result) as Record<string, unknown>
    expect(parsed.decision).toBe('changes_requested')
    const comments = parsed.comments as Record<string, unknown>[]
    expect(comments[0].line).toBe(42)
    expect(comments[0].side).toBe('additions')
  })

  it('request changes with file comment: no line/side fields', () => {
    const result = buildCodeReviewPayload('changes_requested', [fileFixture])
    const parsed = JSON.parse(result) as Record<string, unknown>
    const comment = (parsed.comments as Record<string, unknown>[])[0]
    expect('line' in comment).toBe(false)
    expect('side' in comment).toBe(false)
  })
})

describe('shouldUseClipboard', () => {
  it('returns true when offline', () => { expect(shouldUseClipboard('offline')).toBe(true) })
  it('returns false when online', () => { expect(shouldUseClipboard('online')).toBe(false) })
})
```

---

### `ui/src/code-review/CodeReviewSubmitPopover.tsx` (component — new)

**Analog:** `ui/src/reviewer-v2/SubmitPopover.tsx` (full file, lines 1–130)

**Imports pattern** (`ui/src/reviewer-v2/SubmitPopover.tsx`, lines 1–1):
```typescript
import { useEffect, useRef, useState } from 'react'
// No other imports — standalone component
```

**Props interface pattern** (`ui/src/reviewer-v2/SubmitPopover.tsx`, lines 3–8):
```typescript
// BEFORE (reviewer-v2):
export interface SubmitPopoverProps {
  open: boolean
  messageRequired: boolean   // ← remove this prop in code-review version
  onDismiss: () => void
  onSubmit: (message: string) => void
}

// AFTER (code-review version — message always optional):
export interface CodeReviewSubmitPopoverProps {
  open: boolean
  onDismiss: () => void
  onConfirm: (globalInstruction?: string) => void
}
```

**Outside-click + Escape dismiss pattern** (`ui/src/reviewer-v2/SubmitPopover.tsx`, lines 23–45):
```typescript
const rootRef = useRef<HTMLDivElement>(null)
const [message, setMessage] = useState('')
const [prevOpen, setPrevOpen] = useState(open)

// Sync-during-render pattern to reset message when popover closes
if (prevOpen !== open) {
  setPrevOpen(open)
  if (!open) setMessage('')
}

useEffect(() => {
  if (!open) return
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { onDismiss() }
  }
  const handleMouseDown = (e: MouseEvent) => {
    if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
      onDismiss()
    }
  }
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('mousedown', handleMouseDown)
  return () => {
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('mousedown', handleMouseDown)
  }
}, [open, onDismiss])

if (!open) return null
```

**Visual shell pattern** (`ui/src/reviewer-v2/SubmitPopover.tsx`, lines 50–66):
```typescript
<div
  ref={rootRef}
  role="dialog"
  aria-modal="true"
  aria-label="Send feedback"   // ← change to "Approve review"
  style={{
    position: 'absolute',
    top: 40,
    right: 0,
    minWidth: 320,
    zIndex: 50,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: 16,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
  }}
>
```

**Textarea pattern** (`ui/src/reviewer-v2/SubmitPopover.tsx`, lines 68–99):
```typescript
<textarea
  aria-label="Global instruction (optional)"   // ← adapt label
  placeholder="Leave an instruction for the agent (optional)"  // ← adapt
  autoFocus   // ← keep autoFocus
  value={message}
  rows={4}
  style={{
    width: '100%',
    minHeight: 80,
    fontSize: 14,
    fontFamily: 'inherit',
    background: 'var(--color-bg)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: 4,
    padding: 12,
    resize: 'vertical',
    boxSizing: 'border-box',
    outline: 'none',
  }}
  onChange={(e) => setMessage(e.target.value)}
  onFocus={(e) => {
    e.currentTarget.style.outline = '2px solid var(--color-focus)'
    e.currentTarget.style.outlineOffset = '2px'
  }}
  onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
  onKeyDown={(e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      onConfirm(message || undefined)   // ← always submittable; message optional
      e.preventDefault()
    }
  }}
/>
```

**Submit button pattern** (`ui/src/reviewer-v2/SubmitPopover.tsx`, lines 101–127):
```typescript
<div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
  <button
    type="button"
    // No disabled logic — message always optional
    onClick={() => { onConfirm(message.trim() || undefined) }}
    style={{
      height: 32,
      paddingLeft: 16,
      paddingRight: 16,
      borderRadius: 6,
      border: 'none',
      background: 'var(--color-accent-approve)',  // ← green, not red
      color: '#fff',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      opacity: 1,
    }}
    onFocus={(e) => {
      e.currentTarget.style.outline = '2px solid var(--color-focus)'
      e.currentTarget.style.outlineOffset = '2px'
    }}
    onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
  >
    Confirm Approve   {/* ← changed from "Send Feedback" */}
  </button>
</div>
```

---

### `ui/src/code-review/AppToolbar.tsx` (component — modify: add submit controls)

**Analog:** `ui/src/reviewer-v2/SubmitControls.tsx` (full file, lines 1–244) for the new submit section; self for the existing toolbar wrapper.

**New props to add to AppToolbarProps** (`ui/src/code-review/AppToolbar.tsx`, lines 1–13 — current interface):
```typescript
// Add these 4 props to existing AppToolbarProps:
comments: CodeReviewComment[]       // derive canApprove / canRequestChanges
connectivity: ConnectivityStatus    // from shared/connectivity
onApprove: (globalInstruction?: string) => void
onRequestChanges: () => void
```

**New imports needed** (follow existing AppToolbar.tsx import style — no imports currently, add):
```typescript
import type { CodeReviewComment } from './types'
import type { ConnectivityStatus } from '../shared/connectivity'
import CodeReviewSubmitPopover from './CodeReviewSubmitPopover'
```

**SubmitState machine pattern** (`ui/src/reviewer-v2/SubmitControls.tsx`, lines 13–19):
```typescript
type SubmitState =
  | 'idle'
  | 'popover_open'
  | 'confirmed_approve'
  | 'confirmed_request_changes'
  | 'clipboard_confirmed'
  | 'clipboard_error'
```

**Auto-close tab useEffect pattern** (`ui/src/reviewer-v2/SubmitControls.tsx`, lines 29–36):
```typescript
useEffect(() => {
  if (submitState === 'confirmed_approve' || submitState === 'confirmed_request_changes') {
    const id = window.setTimeout(() => {
      try { window.close() } catch { /* browser may block window.close() — ignore */ }
    }, 500)
    return () => clearTimeout(id)
  }
}, [submitState])
```

**Clipboard auto-reset useEffect pattern** (`ui/src/reviewer-v2/SubmitControls.tsx`, lines 39–44):
```typescript
useEffect(() => {
  if (submitState === 'clipboard_confirmed') {
    const id = window.setTimeout(() => setSubmitState('idle'), 3000)
    return () => clearTimeout(id)
  }
}, [submitState])
```

**Approve button pattern** (`ui/src/reviewer-v2/SubmitControls.tsx`, lines 107–140):
```typescript
// Gate: canApprove = comments.length === 0 (D-06)
<button
  type="button"
  className="submit-btn"
  disabled={!canApprove}
  title={!canApprove ? 'Cannot approve while comments exist' : undefined}
  onClick={handleApprove}    // opens popover (online) or clipboard (offline)
  style={{
    height: 32,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 6,
    border: 'none',
    background: 'var(--color-accent-approve)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: canApprove ? 'pointer' : 'default',
    opacity: canApprove ? 1 : 0.4,
    outline: 'none',
  }}
  onFocus={(e) => {
    e.currentTarget.style.outline = '2px solid var(--color-focus)'
    e.currentTarget.style.outlineOffset = '2px'
  }}
  onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
  onMouseOver={(e) => {
    if (canApprove) e.currentTarget.style.background = 'var(--color-accent-approve-hover)'
  }}
  onMouseOut={(e) => {
    e.currentTarget.style.background = 'var(--color-accent-approve)'
  }}
>
  Approve
</button>
```

**Request Changes button pattern** (adapted from SubmitControls.tsx "Send Feedback" button, lines 141–179):
```typescript
// Gate: canRequestChanges = comments.length > 0 (D-06)
// No popover toggle — submits immediately (D-05)
<button
  type="button"
  className="submit-btn"
  disabled={!canRequestChanges}
  title={!canRequestChanges ? 'Add at least one comment before requesting changes' : undefined}
  onClick={() => { void handleRequestChanges() }}
  style={{
    height: 32,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 6,
    border: 'none',
    background: 'var(--color-accent-deny)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: canRequestChanges ? 'pointer' : 'default',
    opacity: canRequestChanges ? 1 : 0.4,
    outline: 'none',
  }}
  onFocus={(e) => { ... }}
  onBlur={(e) => { ... }}
>
  Request Changes
</button>
```

**handleApprove pattern** (adapted from `ui/src/reviewer-v2/SubmitControls.tsx`, lines 46–72):
```typescript
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

**handleRequestChanges pattern** (adapted from `ui/src/reviewer-v2/SubmitControls.tsx`, lines 74–101):
```typescript
async function handleRequestChanges() {
  if (shouldUseClipboard(connectivity)) {
    const json = buildCodeReviewPayload('changes_requested', comments)
    navigator.clipboard.writeText(json)
      .then(() => setSubmitState('clipboard_confirmed'))
      .catch(() => { setClipboardJson(json); setSubmitState('clipboard_error') })
    return
  }
  try {
    const body = buildCodeReviewPayload('changes_requested', comments)
    const res = await fetch('/api/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (res.ok || res.status === 409) {
      setSubmitState('confirmed_request_changes')
    } else {
      setClipboardJson(body)
      setSubmitState('clipboard_error')
    }
  } catch {
    const json = buildCodeReviewPayload('changes_requested', comments)
    setClipboardJson(json)
    setSubmitState('clipboard_error')
  }
}
```

**Status message / clipboard-error render pattern** (`ui/src/reviewer-v2/SubmitControls.tsx`, lines 182–241):
```typescript
{submitState === 'confirmed_approve' && (
  <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-accent-approve)' }}>Approved</span>
    <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>You can close this tab.</span>
  </div>
)}
{submitState === 'confirmed_request_changes' && (
  <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-accent-deny)' }}>Review submitted</span>
    <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>You can close this tab.</span>
  </div>
)}
{submitState === 'clipboard_confirmed' && (
  <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-accent-approve)' }}>Copied to clipboard</span>
    <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>Paste into your Claude conversation.</span>
  </div>
)}
{submitState === 'clipboard_error' && (
  <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-accent-deny)' }}>Clipboard write failed</span>
      <button
        type="button"
        onClick={() => setSubmitState('idle')}
        style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
      >
        Dismiss
      </button>
    </div>
    <textarea
      readOnly
      value={clipboardJson}
      aria-label="JSON payload — copy and paste into Claude"
      onClick={(e) => (e.target as HTMLTextAreaElement).select()}
      style={{ width: 320, height: 80, fontFamily: 'monospace', fontSize: 12, padding: 8, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', resize: 'vertical', cursor: 'text' }}
    />
  </div>
)}
```

**Reserved slot replacement** (`ui/src/code-review/AppToolbar.tsx`, lines 67–69):
```typescript
// BEFORE:
{/* Reserved: help / GitHub / theme — empty in Phase 25 (D-03) */}
<div />

// AFTER: replace the <div /> with submit controls inline or as sub-component
<div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
  {/* submit buttons, status messages, popover */}
</div>
```

**Placement:** The submit controls section goes inside the existing `{/* Right: controls */}` div (`AppToolbar.tsx`, line 67), replacing the `<div />` placeholder. The `useState` for `submitState` and `clipboardJson`, plus all handlers and effects, live at the top of `AppToolbar` (or in a new `SubmitBar` sub-component extracted for clarity — planner's discretion per CONTEXT.md D-02).

---

### `ui/src/code-review/CodeReviewApp.tsx` (component — modify: add useHeartbeat + pass connectivity)

**Analog:** `ui/src/reviewer-v2/ReviewerV2Shell.tsx` (lines 1–22 — the shell-level useHeartbeat call)

**Import to add** (`ui/src/reviewer-v2/ReviewerV2Shell.tsx`, line 6):
```typescript
// Pattern in ReviewerV2Shell.tsx:
import { useHeartbeat } from './useHeartbeat'

// Adapt for CodeReviewApp.tsx (imports from shared/, not local):
import { useHeartbeat } from '../shared/useHeartbeat'
import type { ConnectivityStatus } from '../shared/connectivity'
```

**useHeartbeat call pattern** (`ui/src/reviewer-v2/ReviewerV2Shell.tsx`, line 18):
```typescript
// Call at component top level, alongside other hooks:
const connectivity = useHeartbeat()
```

**Pass connectivity to AppToolbar** (adapt from `ui/src/code-review/CodeReviewApp.tsx`, lines 234–245 — current AppToolbar usage):
```typescript
<AppToolbar
  // existing props unchanged:
  diffStyle={diffStyle}
  contextExpanded={contextExpanded}
  contextLoading={loading && contextExpanded}
  onDiffStyleChange={setDiffStyle}
  onExpandAll={handleExpandAll}
  commitsOpen={drawerOpen}
  onCommitsToggle={handleCommitsToggle}
  allFilesExpanded={allFilesExpanded}
  filesCount={files.length}
  onToggleAllFiles={handleToggleAllFiles}
  // NEW props (Phase 28):
  comments={comments}
  connectivity={connectivity}
  onApprove={handleApprove}
  onRequestChanges={handleRequestChanges}
/>
```

**handleApprove/handleRequestChanges location choice:** These async handlers can live either in `CodeReviewApp` (passing `onApprove={handleApprove}` callbacks) or entirely inside `AppToolbar`/`SubmitBar`. If inside `CodeReviewApp`, `comments` is in scope naturally. If inside `AppToolbar`, `comments` is passed as a prop. Either approach is valid (Claude's discretion per CONTEXT.md).

---

### `ui/src/code-review/CodeReviewApp.test.ts` (test — modify: remove/replace negative useHeartbeat assertion)

**Analog:** Self (`ui/src/code-review/CodeReviewApp.test.ts`, lines 85–87)

**Line to remove** (line 85 — the NEGATIVE assertion that will break in Phase 28):
```typescript
// REMOVE this test entirely:
it('does NOT call useHeartbeat (RESEARCH Open Question 1)', () => {
  expect(source).not.toContain('useHeartbeat')
})
```

**Source-assertion pattern to add instead** (following pattern from lines 14–17 of same file):
```typescript
// ADD these tests:
it('Phase 28: imports useHeartbeat from shared/', () => {
  expect(source).toContain('useHeartbeat')
  expect(source).toContain("from '../shared/useHeartbeat'")
})

it('Phase 28: calls useHeartbeat() and assigns to connectivity', () => {
  expect(source).toContain('connectivity')
  expect(source).toContain('useHeartbeat()')
})

it('Phase 28: passes connectivity and comments to AppToolbar', () => {
  expect(source).toContain('connectivity={connectivity}')
  expect(source).toContain('comments={comments}')
})
```

---

### `ui/src/code-review/AppToolbar.test.ts` (test — modify: add new prop/button assertions)

**Analog:** Self (`ui/src/code-review/AppToolbar.test.ts`, lines 60–108 — Phase 26 additions section)

**Pattern for adding new prop assertions** (lines 60–86 of same file):
```typescript
// Phase 26 additions pattern — same structure to follow for Phase 28:
it('AppToolbarProps includes commitsOpen and onCommitsToggle', () => {
  expect(source).toContain('commitsOpen: boolean')
  expect(source).toContain('onCommitsToggle:')
})
it("renders the 'Commits' label literally", () => {
  expect(source).toContain("'Commits'")
})

// Phase 28 additions to add (following same pattern):
it('Phase 28: AppToolbarProps includes comments, connectivity, onApprove, onRequestChanges', () => {
  expect(source).toContain('comments: CodeReviewComment[]')
  expect(source).toContain('connectivity: ConnectivityStatus')
  expect(source).toContain('onApprove:')
  expect(source).toContain('onRequestChanges:')
})
it("Phase 28: renders 'Approve' and 'Request Changes' labels", () => {
  expect(source).toContain("'Approve'")
  expect(source).toContain("'Request Changes'")
})
it('Phase 28: Approve button uses --color-accent-approve', () => {
  expect(source).toContain('var(--color-accent-approve)')
})
it('Phase 28: Request Changes button uses --color-accent-deny', () => {
  expect(source).toContain('var(--color-accent-deny)')
})
it('Phase 28: imports ConnectivityStatus from shared/connectivity', () => {
  expect(source).toContain("from '../shared/connectivity'")
})
```

---

### `ui/src/reviewer-v2/ReviewerV2Shell.tsx` (component — import path updates only)

**Analog:** Self (current lines 6–6)

**Current imports that must change** (`ui/src/reviewer-v2/ReviewerV2Shell.tsx`, lines 6–8):
```typescript
// BEFORE:
import { useHeartbeat } from './useHeartbeat'
import { OFFLINE_BANNER_LINE_1, OFFLINE_BANNER_LINE_2 } from './offlineLabels'

// AFTER (useHeartbeat moved to shared/):
import { useHeartbeat } from '../shared/useHeartbeat'
import { OFFLINE_BANNER_LINE_1, OFFLINE_BANNER_LINE_2 } from './offlineLabels'
// offlineLabels stays in reviewer-v2/ — only useHeartbeat moves
```

**ReviewerV2Shell.test.ts assertion that must update** (RESEARCH.md Pitfall 2 — file not read but path known):
- Find: `expect(source).toContain("from './useHeartbeat'")`
- Replace with: `expect(source).toContain("from '../shared/useHeartbeat'")`

**Other reviewer-v2 files needing import updates:**
- `ui/src/reviewer-v2/SubmitControls.tsx` — `from './connectivity'` → `from '../shared/connectivity'`
- `ui/src/reviewer-v2/offlineLabels.ts` — `from './connectivity'` → `from '../shared/connectivity'`

---

## Shared Patterns

### Focus Ring Pattern
**Source:** `ui/src/code-review/AppToolbar.tsx`, lines 29–38 (`makeFocusHandlers`)
**Apply to:** All interactive buttons in AppToolbar submit controls and CodeReviewSubmitPopover
```typescript
// The existing makeFocusHandlers approach in AppToolbar:
function makeFocusHandlers(_id: string) {
  return {
    onFocus: (e: React.FocusEvent<HTMLButtonElement>) => {
      e.currentTarget.style.outline = '2px solid var(--color-focus)'
      e.currentTarget.style.outlineOffset = '2px'
    },
    onBlur: (e: React.FocusEvent<HTMLButtonElement>) => {
      e.currentTarget.style.outline = 'none'
    },
  }
}
// For new buttons use spread: {...makeFocusHandlers('approve')}
// For textarea: inline onFocus/onBlur handlers (cannot spread — different element type)
```

### CSS Token Pattern
**Source:** `ui/src/reviewer-v2/SubmitControls.tsx` (all color references)
**Apply to:** All new components in Phase 28
```
--color-accent-approve      Approve button bg; "Approved" status label
--color-accent-approve-hover  Approve button hover bg
--color-accent-deny         Request Changes button bg; "Clipboard write failed" label
--color-surface             Popover panel bg; toolbar bg
--color-border              Popover border; button outlines
--color-bg                  Textarea bg (within popover)
--color-text-primary        Popover textarea text; status labels
--color-text-secondary      Status body ("You can close this tab.")
--color-focus               2px focus ring
```

### submit-btn CSS Class Pattern
**Source:** `ui/src/reviewer-v2/SubmitControls.tsx`, lines 109 and 141
**Apply to:** Both Approve and Request Changes buttons
```typescript
className="submit-btn"
// Defined in ui/src/index.css Phase 22 block:
// transition: background 0.1s ease, opacity 0.1s ease
```

### Source-Assertion Test Pattern
**Source:** `ui/src/code-review/CodeReviewApp.test.ts` lines 1–8; `AppToolbar.test.ts` lines 1–8
**Apply to:** All new/modified test files (`buildCodeReviewPayload.test.ts` uses pure imports, not source-assertion; `CodeReviewApp.test.ts` and `AppToolbar.test.ts` modifications use source-assertion)
```typescript
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import TargetComponent from './TargetComponent'

const source = readFileSync(resolve(__dirname, './TargetComponent.tsx'), 'utf-8')

describe('TargetComponent', () => {
  it('exports a function as default', () => {
    expect(typeof TargetComponent).toBe('function')
  })
  // ... source string assertions for structural properties
})
```

### ESLint Rule Update Pattern
**Source:** `ui/eslint.config.js`, lines 24–38 (reviewer-v2 rule)
**Apply to:** `ui/eslint.config.js` — reviewer-v2 rule must allow `../shared/**`

**Current rule** (lines 24–38):
```javascript
{
  files: ['src/reviewer-v2/**'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['../**'],    // ← too broad: bans ALL ../ including ../shared/
        message: 'reviewer-v2/ files must not import from outside the subtree. ...',
      }],
    }],
  },
},
```

**Required change** — add an allowance for `../shared/**`:
```javascript
{
  files: ['src/reviewer-v2/**'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['../!(shared)/**', '../!(shared)'],  // ban ../ except ../shared/
          message: 'reviewer-v2/ files must not import from outside the subtree ' +
            '(exception: ../shared/** is allowed). ...',
        },
      ],
    }],
  },
},
```
Note: The exact ESLint glob pattern for "allow ../shared/ but ban everything else" requires verification with the eslint `no-restricted-imports` pattern negation syntax. An alternative is adding a separate `allowImportNames` or restructuring to explicitly list banned paths. The planner should note this as a verification step.

---

## No Analog Found

All files have analogs. No entries in this section.

---

## File Move Checklist

These are the file operations needed before writing any new code:

| Operation | Source | Destination | Test File Also Moves? |
|-----------|--------|-------------|----------------------|
| git mv | `ui/src/reviewer-v2/connectivity.ts` | `ui/src/shared/connectivity.ts` | Yes: `connectivity.test.ts` |
| git mv | `ui/src/reviewer-v2/useHeartbeat.ts` | `ui/src/shared/useHeartbeat.ts` | Yes: `useHeartbeat.test.ts` |

**Import updates required after moves:**
1. `ui/src/reviewer-v2/ReviewerV2Shell.tsx` — `from './useHeartbeat'` → `from '../shared/useHeartbeat'`
2. `ui/src/reviewer-v2/SubmitControls.tsx` — `from './connectivity'` → `from '../shared/connectivity'`
3. `ui/src/reviewer-v2/offlineLabels.ts` — `from './connectivity'` → `from '../shared/connectivity'`
4. `ui/eslint.config.js` — update reviewer-v2 rule to allow `../shared/**`
5. `ui/src/reviewer-v2/ReviewerV2Shell.test.ts` — update `from './useHeartbeat'` assertion to `from '../shared/useHeartbeat'`

**Import updates NOT needed:**
- `ui/src/shared/useHeartbeat.ts` internal import `from './connectivity'` — both files co-locate in `shared/`, no change
- `ui/src/shared/useHeartbeat.test.ts` internal imports `from './useHeartbeat'` and `from './connectivity'` — both co-locate, no change

---

## Metadata

**Analog search scope:** `ui/src/reviewer-v2/`, `ui/src/code-review/`, `ui/eslint.config.js`
**Files scanned:** 15 source files + 8 test files
**Pattern extraction date:** 2026-05-25
