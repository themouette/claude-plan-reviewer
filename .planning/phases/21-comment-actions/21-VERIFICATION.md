---
phase: 21-comment-actions
verified: 2026-05-22T18:10:00Z
status: gaps_found
score: 2/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 3/4
  gaps_closed:
    - "QUICK_ACTIONS label 'search internet' — fixed to 'Search the web' in Plan 06"
    - "Delete and predefined actions bypass textarea popup — implemented in Plan 06"
    - "Gutter icon click does not display action tray — fixed in Plan 07 (TreeWalker range)"
    - "Auto-submit on conflict (D-03) via gutter icon — fixed in Plan 07 (formOpen prop + handleAdd auto-submit)"
  gaps_remaining:
    - "Lint: 9 errors in Phase-21-introduced files (no-restricted-imports × 2, react-hooks/refs × 4, no-unused-vars × 1, no-regex-spaces × 1, plus 3 warnings)"
    - "ROADMAP SC-1 deviation: Delete action bypasses textarea; ROADMAP says 'textarea pre-filled with Delete'"
    - "ROADMAP SC-2 deviation: Predefined actions create bubbles directly; ROADMAP says 'each opens a textarea pre-filled with that label'"
  regressions: []
gaps:
  - truth: "An expandable menu button reveals six predefined actions — each opens a textarea pre-filled with that label (ROADMAP SC-2)"
    status: failed
    reason: "Predefined quick actions bypass the textarea popup and directly create comment bubbles (Plan 06 UAT-driven product change). ROADMAP SC-2 says 'each opens a textarea pre-filled with that label'. The ROADMAP was not updated to reflect this product decision."
    artifacts:
      - path: "ui/src/reviewer-v2/ContentPane.tsx"
        issue: "handleAction bypass path fires for all prefillComment !== undefined (all predefined actions). Direct create, no form open."
    missing:
      - "Either update ROADMAP SC-2 to reflect 'each directly creates a comment bubble with that label as comment text', OR restore textarea popup for predefined actions"
  - truth: "After hovering a paragraph or selecting text, three quick-action buttons appear: 'Comment' (empty textarea), 'Delete' (textarea pre-filled with 'Delete'), 'Replace' (textarea pre-filled with 'Replace') (ROADMAP SC-1, partial)"
    status: failed
    reason: "Delete action bypasses the textarea popup and directly creates a delete bubble (Plan 06 UAT-driven product change). ROADMAP SC-1 says 'Delete (textarea pre-filled with Delete)'. Comment and Replace still open a textarea. The ROADMAP was not updated."
    artifacts:
      - path: "ui/src/reviewer-v2/ContentPane.tsx"
        issue: "Line 117: bypass path fires when type === 'delete', calls onAddAnnotation directly, no setFormState."
    missing:
      - "Either update ROADMAP SC-1 to say 'Delete (directly creates delete bubble)', OR restore textarea popup for Delete"
  - truth: "All vitest tests pass and npm run lint reports zero new errors (Plan 01 acceptance criteria)"
    status: failed
    reason: "npm run lint reports 9 errors (3 warnings). Errors were introduced by Phase 21 files. Plans 01 and 02 acceptance criteria explicitly require 'npm run lint reports no new errors'."
    artifacts:
      - path: "ui/src/reviewer-v2/hooks/useSectionAnnotationCounts.ts"
        issue: "no-restricted-imports: '../types' violates ../** pattern (line 2). react-hooks/refs: 4 errors for accessing planRef.current inside useMemo (lines 58–61)."
      - path: "ui/src/reviewer-v2/hooks/useSectionAnnotationCounts.test.ts"
        issue: "no-restricted-imports: '../types' violates ../** pattern (line 6)."
      - path: "ui/src/reviewer-v2/hooks/useTextSelection.ts"
        issue: "@typescript-eslint/no-unused-vars: '_e' is defined but never used (line 168)."
      - path: "ui/src/reviewer-v2/hooks/useTextSelection.test.ts"
        issue: "no-regex-spaces: Spaces are hard to count. Use {4} (line 128)."
    missing:
      - "Fix useSectionAnnotationCounts.ts import: change 'import type { Annotation, Section } from ../types' to use a path that does not match ../** (e.g. copy types to hooks/types.ts, or use eslint-disable comment with justification)"
      - "Fix useSectionAnnotationCounts.ts: move planRef.current read out of useMemo into a useEffect, or use useRef inside the hook"
      - "Fix useTextSelection.ts: remove the _e parameter name prefix underscore issue (or disable the rule with justification)"
      - "Fix useTextSelection.test.ts: replace literal spaces in regex with {4} quantifier"
human_verification:
  - test: "Confirm product decision: Delete action should bypass textarea (no popup) vs. open a textarea pre-filled with 'Delete'"
    expected: "Product owner confirms whether ROADMAP SC-1 should be updated to reflect 'Delete directly creates a bubble' or whether the implementation should restore the textarea popup for Delete."
    why_human: "ROADMAP SC-1 says 'textarea pre-filled with Delete'. UAT drove Plan 06 to make Delete a direct-create action. Both specs cannot be correct simultaneously. A product decision is needed."
  - test: "Confirm product decision: Predefined quick actions should bypass textarea (no popup) vs. open a textarea"
    expected: "Product owner confirms whether ROADMAP SC-2 should be updated to reflect 'each directly creates a comment bubble' or whether the implementation should restore textarea popups for predefined actions."
    why_human: "ROADMAP SC-2 says 'each opens a textarea pre-filled with that label'. UAT drove Plan 06 to make all predefined actions direct-create. ROADMAP needs to be updated or implementation restored."
---

# Phase 21: Comment Actions — Re-Verification Report

**Phase Goal:** Users can create, edit, and delete comments via quick-action triggers on paragraph hover and text selection; three primary actions pre-fill the comment textarea; an expandable menu offers six predefined actions; existing bubbles have edit and delete controls
**Verified:** 2026-05-22T18:10:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap closure plans 05, 06, 07

## Re-Verification Context

Previous verification (`human_needed`, score 3/4) identified two items:

1. Blocking: Plan 04 Task 3 human gate never passed — UAT was subsequently run and found 4 failures.
2. Label mismatch: `'search internet'` vs `'Search the web'`.

Gap-closure plans 05, 06, 07 addressed all four UAT failures:
- Plan 05: Removed 3 stale scroll-listener tests from CommentPane.test.ts
- Plan 06: Fixed label to 'Search the web'; made Delete and predefined actions bypass the textarea popup; added orange border for Replace type
- Plan 07: Fixed handleAdd to use text-node TreeWalker range; added data-gutter-icon attribute + AnnotationForm exemption; added formOpen prop to PlanContent to unblock hover tracking while form is open

All 316 vitest tests pass. However, three gaps remain:
1. ROADMAP SC-1 semantic deviation (Delete bypasses textarea)
2. ROADMAP SC-2 semantic deviation (predefined actions bypass textarea)
3. 9 lint errors introduced by Phase 21 files

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After hovering a paragraph or selecting text, three quick-action buttons appear: "Comment" (empty textarea), "Delete" (textarea pre-filled with "Delete"), "Replace" (textarea pre-filled with "Replace") | ✗ FAILED | Comment and Replace match SC. Delete bypasses textarea and directly creates a bubble (Plan 06 product change). ROADMAP SC-1 says Delete should open "textarea pre-filled with 'Delete'" — this is a documented deviation. |
| 2 | An expandable menu button reveals six predefined actions — "Clarify this", "Needs test", "Give me an example", "Out of scope", "Search the web", "Search codebase" — each opens a textarea pre-filled with that label | ✗ FAILED | All six labels are correct including 'Search the web' (fixed in Plan 06). However ROADMAP SC-2 says "each opens a textarea pre-filled with that label" — implementation bypasses textarea for all predefined actions (Plan 06 product change). |
| 3 | Every submitted comment bubble shows a pencil icon (edit) and an × icon (delete); clicking the pencil reopens the textarea with the existing text for inline editing; clicking × removes the bubble immediately with no confirmation dialog | ✓ VERIFIED | `CommentBubble.tsx` renders `✎` and `×` buttons inside `isFocused && !isEditing`; `isEditing` replaces `<p>` with `<textarea defaultValue={annotation.comment}`; `onEdit()` and `onRemove()` wired through `CommentPane` → `ReviewerV2Shell`; no confirmation dialog in any code path. |
| 4 | Each outline item shows a badge with the count of comments anchored within that section; a section with no comments shows no badge; adding a comment in the content pane updates its section's count immediately | ✓ VERIFIED | `OutlinePane.tsx` renders `<span>` badge when `(annotationCounts?.get(section.id) ?? 0) > 0`; `useSectionAnnotationCounts` called in Shell memoized on `[sections, annotations, planRef]`; threaded as `annotationCounts` prop to OutlinePane; all 13 pure-function tests pass. |

**Score:** 2/4 truths verified (2 failed due to ROADMAP contract deviation; SC-3 and SC-4 verified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ui/src/reviewer-v2/AnnotationForm.tsx` | AnnotationForm component (popover + textarea + buttons) | ✓ VERIFIED | 144 LOC; position:fixed, aria-label, autoFocus, keyboard contract, click-outside handler with gutter-icon exemption, orange border for replace type |
| `ui/src/reviewer-v2/AnnotationForm.test.ts` | Source-as-text assertions for AnnotationForm structure | ✓ VERIFIED | 20+ assertions pass including data-gutter-icon exemption (Plan 07) |
| `ui/src/reviewer-v2/hooks/useSectionAnnotationCounts.ts` | useSectionAnnotationCounts hook + computeSectionAnnotationCounts | ⚠️ STUB | Both exports present and functionally correct. Lint errors: no-restricted-imports on `'../types'` + 4 react-hooks/refs violations for planRef.current in useMemo |
| `ui/src/reviewer-v2/hooks/useSectionAnnotationCounts.test.ts` | Unit tests calling computeSectionAnnotationCounts directly | ⚠️ STUB | 13 tests pass. Lint error: no-restricted-imports on `'../types'` |
| `ui/src/reviewer-v2/hooks/useTextSelection.ts` | getElementCharOffset export added | ⚠️ STUB | `export function getElementCharOffset(` present at line 103; uses `.contains()` correctly. Lint error: `_e` unused variable (line 168) |
| `ui/src/reviewer-v2/hooks/useTextSelection.test.ts` | Tests for getElementCharOffset | ⚠️ STUB | Tests pass. Lint error: no-regex-spaces in test helper regex (line 128) |
| `ui/src/reviewer-v2/ContentPane.tsx` | formState + AnnotationForm + bypass paths + gutter fix | ✓ VERIFIED | All Phase 21 wiring present including bypass paths (Plan 06), formOpen prop wiring (Plan 07), TreeWalker range in handleAdd (Plan 07), auto-submit in handleAdd (Plan 07) |
| `ui/src/reviewer-v2/PlanContent.tsx` | formOpen prop + unblocked hover/gutter tracking | ✓ VERIFIED | `formOpen?: boolean`, `if (selectedText && !formOpen) return`, `hoveredParagraph && (!selectedText \|\| formOpen)` |
| `ui/src/reviewer-v2/GutterIcon.tsx` | data-gutter-icon attribute | ✓ VERIFIED | `data-gutter-icon=""` on button element (line 19) |
| `ui/src/reviewer-v2/CommentBubble.tsx` | edit/delete icon buttons + inline edit mode | ✓ VERIFIED | `isEditing`, pencil `✎` button, × button, textarea edit mode, Save/Discard row all present |
| `ui/src/reviewer-v2/CommentPane.tsx` | editingId prop + sticky wrapper for editing bubble | ✓ VERIFIED | `editingId` prop, `position: 'sticky'` wrapper, `key={ann.id}` on wrapper div |
| `ui/src/index.css` | .bubble-icon-btn transition rule | ✓ VERIFIED | `.bubble-icon-btn { transition: color 0.1s ease; }` at line 265 |
| `ui/src/reviewer-v2/ReviewerV2Shell.tsx` | editingId state + useSectionAnnotationCounts + prop forwarding | ✓ VERIFIED | All four new props forwarded to CommentPane; `annotationCounts` to OutlinePane |
| `ui/src/reviewer-v2/OutlinePane.tsx` | annotationCounts prop + per-section count badge | ✓ VERIFIED | `annotationCounts?: Map<string, number>`, conditional `<span>` badge with active/inactive colors |
| `ui/src/reviewer-v2/SelectionToolbar.tsx` | QUICK_ACTIONS with 'Search the web' at index 4 | ✓ VERIFIED | `'Search the web'` at index 4 of QUICK_ACTIONS array (fixed in Plan 06) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ReviewerV2Shell.tsx` | `hooks/useSectionAnnotationCounts.ts` | `import { useSectionAnnotationCounts }` | ✓ WIRED | Line 6 |
| `ReviewerV2Shell.tsx` | `CommentPane.tsx` | props `editingId`, `onEdit`, `onRemove`, `onCancelEdit` | ✓ WIRED | Lines 111-125 |
| `ReviewerV2Shell.tsx` | `OutlinePane.tsx` | prop `annotationCounts={annotationCounts}` | ✓ WIRED | Line 75 |
| `ContentPane.tsx` | `AnnotationForm.tsx` | `import AnnotationForm, { type FormState }` | ✓ WIRED | Line 7 |
| `ContentPane.tsx` | `PlanContent.tsx` | `formOpen={formState !== null}` | ✓ WIRED | Line 249 |
| `ContentPane.tsx` | `SelectionToolbar.tsx` | `handleAction` third arg `prefillComment` | ✓ WIRED | Line 97 |
| `CommentPane.tsx` | `CommentBubble.tsx` | props `isEditing`, `onEdit`, `onRemove`, `onCancelEdit` | ✓ WIRED | Lines 126-132 |
| `hooks/useSectionAnnotationCounts.ts` | `hooks/useTextSelection.ts` | `import { getElementCharOffset }` | ✓ WIRED | Line 3 |
| `GutterIcon.tsx` | `AnnotationForm.tsx` | `data-gutter-icon` attribute read by click-outside handler | ✓ WIRED | GutterIcon line 19; AnnotationForm line 30 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `OutlinePane.tsx` | `annotationCounts` | `useSectionAnnotationCounts(sections, annotations, planRef)` in Shell | Yes — pure function walks actual DOM, counts by anchorStart | ✓ FLOWING |
| `CommentPane.tsx` | `editingId` | `useState<string \| null>(null)` in Shell, set by `setEditingId(id)` | Yes — state reflects user click on pencil icon | ✓ FLOWING |
| `ContentPane.tsx` | `formState` | `useState<FormState \| null>(null)`, set in `handleAction` form path | Yes — set from live range rect + stored offsets (comment/replace only) | ✓ FLOWING |
| `CommentBubble.tsx` | `isEditing` | `editingId === ann.id` in CommentPane | Yes — derived from Shell state | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 316 vitest tests pass | `cd ui && npm test -- --run` | 22 test files, 316 tests, 0 failures | ✓ PASS |
| 'Search the web' label in QUICK_ACTIONS | `grep "Search the web" SelectionToolbar.tsx` | One match at line 15 | ✓ PASS |
| No 'search internet' in code | `grep "search internet" SelectionToolbar.tsx` | No matches | ✓ PASS |
| Delete bypass path present | `grep "type === 'delete' \|\| prefillComment !== undefined" ContentPane.tsx` | One match at line 117 | ✓ PASS |
| Lint clean | `cd ui && npm run lint` | 9 errors, 3 warnings — FAIL | ✗ FAIL |
| data-gutter-icon on GutterIcon button | `grep "data-gutter-icon" GutterIcon.tsx` | One match at line 19 | ✓ PASS |
| TreeWalker SHOW_TEXT in handleAdd | `grep "NodeFilter.SHOW_TEXT" ContentPane.tsx` | One match at line 195 | ✓ PASS |
| selectNodeContents removed | `grep "selectNodeContents" ContentPane.tsx` | No matches | ✓ PASS |
| formOpen prop in PlanContent | `grep "formOpen" PlanContent.tsx` | 4 matches (prop, guard × 2, render) | ✓ PASS |

### Probe Execution

Not applicable — no `scripts/*/tests/probe-*.sh` files found for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COMMENT-04 | 21-01, 21-02, 21-06, 21-07 | Three quick actions + expandable menu with six predefined actions | ✗ BLOCKED | Three pills present and functional. Delete bypasses textarea (ROADMAP SC-1 deviation). All six predefined labels correct including 'Search the web'. Predefined actions bypass textarea (ROADMAP SC-2 deviation). The quick-action mechanism works end-to-end but deviates from ROADMAP-defined behavior for Delete and predefined actions. |
| COMMENT-05 | 21-03, 21-04 | Edit (pencil) and delete (×) on each bubble; edit reopens textarea; delete removes with no confirmation | ✓ SATISFIED | CommentBubble.tsx has both icons, inline edit textarea, immediate delete via onRemove, no confirmation dialog. ReviewerV2Shell wires editAnnotation/removeAnnotation. All tests pass. |
| OUTLINE-04 | 21-01, 21-04 | Per-section annotation count badge in outline | ✓ SATISFIED | OutlinePane renders `<span>` badge when count > 0; useSectionAnnotationCounts memoized; active/inactive color switching; all 13 pure-function tests pass. |

**Orphaned requirements check:** REQUIREMENTS.md maps COMMENT-04, COMMENT-05, OUTLINE-04 to Phase 21. All three claimed across plan files. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `hooks/useSectionAnnotationCounts.ts` | 2 | `no-restricted-imports`: `'../types'` path matches `../**` pattern | 🛑 Blocker | ESLint reports error. ARCH-01 coupling rule intended to block imports FROM OUTSIDE reviewer-v2, but the overly-broad `../**` pattern also blocks intra-subtree hook-to-parent-dir imports. The import is semantically correct (types.ts is inside reviewer-v2) but the rule fires. |
| `hooks/useSectionAnnotationCounts.ts` | 58–61 | `react-hooks/refs`: `planRef.current` read inside `useMemo` (4 violations) | 🛑 Blocker | ESLint reports error. Accessing refs during render via useMemo is flagged. Should be moved to `useEffect` or use a different pattern. |
| `hooks/useSectionAnnotationCounts.test.ts` | 6 | `no-restricted-imports`: `'../types'` path (same rule) | 🛑 Blocker | Same as above. |
| `hooks/useTextSelection.ts` | 168 | `@typescript-eslint/no-unused-vars`: `_e` defined but never used | 🛑 Blocker | The underscore prefix convention to suppress unused warnings is not working with the current tseslint config. |
| `hooks/useTextSelection.test.ts` | 128 | `no-regex-spaces`: literal spaces in regex | 🛑 Blocker | Use `{4}` quantifier instead of spaces. |
| `CommentBubble.tsx` | 257–273 | "Save Changes" button missing `onMouseDown={(e) => e.preventDefault()}` | ⚠️ Warning | Article's `onClick` (line 101) may fire before the button's `onClick`, potentially toggling `focusedCommentId` to null mid-click (CR-03 in code review). Carried over from previous verification. |
| `ReviewerV2Shell.tsx` | 124 | `onRemove={removeAnnotation}` does not clear `editingId` when the removed annotation is the one being edited | ⚠️ Warning | Can leave `editingId` pointing to a deleted annotation's id (WR-01 in code review). Carried over from previous verification. |

No `TBD`, `FIXME`, or `XXX` debt markers found in any phase-modified file.

### Human Verification Required

#### 1. Confirm product decision: Delete action textarea vs. direct-create

**Test:** Confirm with the product owner whether the ROADMAP SC-1 description of Delete ("textarea pre-filled with 'Delete'") should be updated, or whether the implementation should be reverted.

**Expected:** One of:
  a) "ROADMAP SC-1 should be updated: Delete directly creates a delete bubble (no textarea)" — update ROADMAP and this VERIFICATION becomes PASS for SC-1
  b) "Implementation should match ROADMAP: restore textarea popup for Delete" — fix ContentPane handleAction to open form for delete type

**Why human:** UAT (21-HUMAN-UAT.md) explicitly requested the no-popup behavior. Plan 06 implemented it. ROADMAP was not updated. These two authoritative specs conflict and only a product owner can resolve which governs.

#### 2. Confirm product decision: Predefined actions textarea vs. direct-create

**Test:** Confirm with the product owner whether the ROADMAP SC-2 description ("each opens a textarea pre-filled with that label") should be updated, or whether implementation should be reverted.

**Expected:** One of:
  a) "ROADMAP SC-2 should be updated: predefined actions directly create comment bubbles" — update ROADMAP
  b) "Implementation should match ROADMAP: restore textarea popup for predefined actions" — fix ContentPane handleAction to open form when prefillComment !== undefined

**Why human:** Same conflict as above — UAT drove the product change but ROADMAP documentation was not updated.

### Gaps Summary

Phase 21 reached `gaps_found` for three reasons:

1. **ROADMAP SC-1 semantic deviation (BLOCKER):** Delete action no longer opens a textarea as the ROADMAP contract specifies. Instead it directly creates a delete bubble. This was a UAT-driven product decision (Plan 06) but the ROADMAP was not updated. The ROADMAP success criterion is the non-negotiable verification contract.

2. **ROADMAP SC-2 semantic deviation (BLOCKER):** Predefined quick actions no longer open a textarea as the ROADMAP contract specifies. Instead they directly create comment bubbles. Same UAT-driven product decision.

3. **Lint errors (BLOCKER):** 9 ESLint errors in Phase-21-introduced files violate the explicit acceptance criteria of Plans 01 and 02 ("npm run lint reports no new errors"):
   - `useSectionAnnotationCounts.ts`: no-restricted-imports (../types path), react-hooks/refs × 4 (planRef.current in useMemo)
   - `useSectionAnnotationCounts.test.ts`: no-restricted-imports (../types path)
   - `useTextSelection.ts`: no-unused-vars (_e)
   - `useTextSelection.test.ts`: no-regex-spaces

**GAPs 1 and 2 suggest adding ROADMAP overrides** if the product decision is confirmed. **GAP 3 requires code fixes** regardless of product decision.

**Note:** If GAPs 1 and 2 are resolved by updating ROADMAP (product decision a), and GAP 3 is fixed, then the re-verification score becomes 4/4 and status can be `human_needed` (behavioral UAT still desirable for the new direct-create behavior) or `passed` if the product confirms no further human gate is needed.

---

_Verified: 2026-05-22T18:10:00Z_
_Verifier: Claude (gsd-verifier)_
