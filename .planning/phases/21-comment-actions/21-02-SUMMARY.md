---
phase: 21-comment-actions
plan: "02"
subsystem: frontend/reviewer-v2
tags: [react-19, formState, annotation-form, programmatic-selection, tdd]
dependency_graph:
  requires: ["21-01"]
  provides: ["ContentPane formState wiring", "AnnotationForm integration", "handleAdd D-06"]
  affects: ["ui/src/reviewer-v2/ContentPane.tsx", "ui/src/reviewer-v2/AnnotationForm.tsx", "ui/src/reviewer-v2/PlanContent.tsx"]
tech_stack:
  added: []
  patterns:
    - "formState as discriminated union (FormState | null) for annotation creation flow"
    - "latestFormValueRef for D-03 auto-submit of pending form on second pill click"
    - "PlanContent closure wrapping onAdd to pass hoveredParagraph to ContentPane"
    - "Range API programmatic selection (D-06) for gutter icon paragraph selection"
key_files:
  created: []
  modified:
    - ui/src/reviewer-v2/ContentPane.tsx
    - ui/src/reviewer-v2/AnnotationForm.tsx
    - ui/src/reviewer-v2/PlanContent.tsx
    - ui/src/reviewer-v2/ContentPane.test.ts
    - ui/src/reviewer-v2/AnnotationForm.test.ts
    - ui/src/reviewer-v2/PlanContent.test.ts
decisions:
  - "GutterIcon interface kept as onAdd: () => void (unchanged) — PlanContent wraps with closure per RESEARCH.md Q3"
  - "latestFormValueRef holds latest textarea value for D-03 auto-submit without controlled input overhead"
  - "handleAction uses rangeFromOffsets from stored offsets (not live DOM selection) per Pitfall 1"
metrics:
  duration: "~4 minutes"
  completed: "2026-05-21T11:22:30Z"
  tasks_completed: 2
  files_modified: 6
---

# Phase 21 Plan 02: ContentPane Wiring Layer Summary

COMMENT-04 annotation creation flow fully wired: SelectionToolbar pill click opens AnnotationForm at the same fixed coordinates; textarea value flows through handleFormSubmit; D-03 auto-submit uses latestFormValueRef; gutter icon programmatically selects entire paragraph via Range API (D-06); selection-lock highlight is preserved while form is open (D-04).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | PlanContent onAdd HTMLElement signature — failing tests | 86ce3fc | PlanContent.test.ts |
| 1 (GREEN) | PlanContent onAdd signature to accept HTMLElement | 86685c1 | PlanContent.tsx |
| 2 (RED) | ContentPane formState wiring + AnnotationForm onTextareaChange — failing tests | 521df58 | ContentPane.test.ts, AnnotationForm.test.ts |
| 2 (GREEN) | ContentPane formState + AnnotationForm + handleAdd + handleFormSubmit + handleFormCancel | 90d89f9 | ContentPane.tsx, AnnotationForm.tsx, ContentPane.test.ts |

## What Was Built

### Task 1: PlanContent + GutterIcon onAdd signature

- `PlanContent.tsx` prop `onAdd` type changed from `() => void` to `(el: HTMLElement) => void`
- GutterIcon JSX updated: `onAdd={() => onAdd(hoveredParagraph)}` — closure passes the hovered paragraph element
- `GutterIcon.tsx` interface is **unchanged** (still `() => void`) per RESEARCH.md Open Question 3 resolution
- New assertions in `PlanContent.test.ts` pin both behaviors

### Task 2: ContentPane formState wiring + AnnotationForm extension

**ContentPane.tsx changes:**
- Added `import AnnotationForm, { type FormState } from './AnnotationForm'`
- Added `const [formState, setFormState] = useState<FormState | null>(null)`
- Added `const latestFormValueRef = useRef<string>('')`
- Replaced `handleAction` stub (D-07 `comment: anchorText`) with real implementation:
  - Computes rect from `rangeFromOffsets` (not live DOM selection — Pitfall 1 avoidance)
  - Determines prefill: `prefillComment` override > type-based default (`'Delete'`, `'Replace'`, `''`)
  - D-03 auto-submit: reads `latestFormValueRef.current`, calls `onAddAnnotation` for pending form
  - Sets `formState` — does NOT call `resetTextSelection()` (D-04 contract preserved)
- Added `handleFormSubmit(comment: string)`: creates annotation, clears formState, calls `resetTextSelection()`
- Added `handleFormCancel()`: clears formState, calls `resetTextSelection()`, no annotation created
- Replaced `handleAdd` stub with Range API programmatic selection (D-06):
  - `window.getSelection()`, `removeAllRanges()`, `createRange()`, `selectNodeContents()`, `addRange()`
  - Fires `selectionchange` → `useTextSelection` captures it → `SelectionToolbar` appears
- Render branch: `SelectionToolbar` renders only when `selectedText && offsets && !formState`; `AnnotationForm` renders when `formState !== null`

**AnnotationForm.tsx extension:**
- Added optional prop `onTextareaChange?: (value: string) => void`
- Added `onChange={(e) => onTextareaChange?.(e.target.value)}` on `<textarea>` (uncontrolled input preserved via `defaultValue`)

## Test Summary

- 91 tests across 4 test files, all passing
- 22 new RED assertions committed before any implementation
- All existing assertions preserved and still passing

```
Test Files  4 passed (4)
     Tests  91 passed (91)
```

## Verification Results

- `npm test -- --run ContentPane PlanContent GutterIcon AnnotationForm`: 91/91 pass
- `npm run lint`: no new errors from modified files (pre-existing errors in unrelated files unchanged)
- `npm run build`: succeeds (272ms) — no TypeScript errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed regex spaces in test assertions**
- **Found during:** Task 2 after lint check
- **Issue:** Three test regex patterns used literal spaces inside `/regex/` (e.g. `\n  \}`) which triggered the `no-regex-spaces` ESLint rule
- **Fix:** Changed `\n  \}` to `\n {2}\}` in the three handleAction/handleFormSubmit/handleFormCancel body matchers
- **Files modified:** `ui/src/reviewer-v2/ContentPane.test.ts`
- **Commit:** Included in 90d89f9 GREEN commit

None other — plan executed as written.

## Known Stubs

None. The D-07 `comment: anchorText` stub has been fully removed. All annotation creation now flows through the textarea form.

## Threat Flags

No new threat surface introduced beyond what is documented in the plan's `<threat_model>`. T-21-05 mitigation (latestFormValueRef updated on every keystroke) and T-21-09 mitigation (handleFormCancel calls resetTextSelection) are both implemented and pinned by tests.

## Self-Check: PASSED

Files created/modified:
- FOUND: /Users/julien.muetton/Projects/lab/claude-plan-reviewer/ui/src/reviewer-v2/ContentPane.tsx
- FOUND: /Users/julien.muetton/Projects/lab/claude-plan-reviewer/ui/src/reviewer-v2/AnnotationForm.tsx
- FOUND: /Users/julien.muetton/Projects/lab/claude-plan-reviewer/ui/src/reviewer-v2/PlanContent.tsx
- FOUND: /Users/julien.muetton/Projects/lab/claude-plan-reviewer/ui/src/reviewer-v2/ContentPane.test.ts
- FOUND: /Users/julien.muetton/Projects/lab/claude-plan-reviewer/ui/src/reviewer-v2/AnnotationForm.test.ts
- FOUND: /Users/julien.muetton/Projects/lab/claude-plan-reviewer/ui/src/reviewer-v2/PlanContent.test.ts

Commits verified:
- 86ce3fc: test(21-02): add failing tests for PlanContent onAdd HTMLElement signature
- 86685c1: feat(21-02): update PlanContent onAdd signature to accept HTMLElement
- 521df58: test(21-02): add failing tests for ContentPane formState wiring and AnnotationForm onTextareaChange
- 90d89f9: feat(21-02): wire ContentPane formState + AnnotationForm rendering (COMMENT-04)
