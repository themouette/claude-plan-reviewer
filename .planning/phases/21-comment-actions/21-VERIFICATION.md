---
phase: 21-comment-actions
verified: 2026-05-22T14:45:00Z
status: human_needed
score: 3/4 must-haves verified
overrides_applied: 0
gaps: []
human_verification:
  - test: "Verify all nine behavioral flows listed in Plan 04 Task 3 (create / edit / delete / badge / auto-submit / gutter icon / keyboard cancel)"
    expected: "All 9 steps described in 21-04-PLAN.md Task 3 pass without any failure"
    why_human: "Plan 04 Task 3 is a checkpoint:human-verify gate with gate=\"blocking\". The 21-04-SUMMARY.md explicitly records 'awaiting user verification of all 9 behavioral steps' — no approval signal was ever received. The human verification step cannot be satisfied by code inspection."
  - test: "Verify QUICK_ACTIONS label 'search internet' satisfies the phase success criterion calling for 'Search the web'"
    expected: "Either the label matches 'Search the web' / 'Search the Web' (case-insensitive), or the product owner confirms 'search internet' is the accepted label"
    why_human: "UI-SPEC.md maps 'Search the web' to the implementation value 'search internet', treating this as an intentional rename. The phase success criterion (ROADMAP) and REQUIREMENTS.md COMMENT-04 both state the label should be 'Search the web'. A human must confirm whether the UI-SPEC deviation is accepted or whether REQUIREMENTS.md / ROADMAP is the governing contract."
---

# Phase 21: Comment Actions — Verification Report

**Phase Goal:** Users can create, edit, and delete comments via quick-action triggers on paragraph hover and text selection; three primary actions pre-fill the comment textarea; an expandable menu offers six predefined actions; existing bubbles have edit and delete controls
**Verified:** 2026-05-22T14:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After hovering a paragraph or selecting text, three quick-action buttons appear: "Comment" (empty textarea), "Delete" (textarea pre-filled with "Delete"), "Replace" (textarea pre-filled with "Replace") | ✓ VERIFIED | `SelectionToolbar.tsx` renders three pills with types `comment`, `delete`, `replace`; `ContentPane.handleAction` sets `prefill = ''` for comment, `'Delete'` for delete, `'Replace'` for replace |
| 2 | An expandable menu button reveals six predefined actions — "Clarify this", "Needs test", "Give me an example", "Out of scope", "Search the web", "Search codebase" | ? UNCERTAIN | Five of six labels match. `QUICK_ACTIONS` in `SelectionToolbar.tsx` has `'search internet'` where the ROADMAP/REQUIREMENTS success criterion says `"Search the web"`. UI-SPEC.md intentionally maps "Search the web" → `"search internet"` (a deliberate rename). Requires human confirmation of which spec is authoritative. |
| 3 | Every submitted comment bubble shows a pencil icon (edit) and an × icon (delete); clicking the pencil reopens the textarea with the existing text for inline editing; clicking × removes the bubble immediately with no confirmation dialog | ✓ VERIFIED | `CommentBubble.tsx` renders Edit / Delete buttons inside `isFocused && !isEditing` block; `isEditing` path replaces `<p>` with `<textarea defaultValue={annotation.comment}`; `onEdit()` and `onRemove()` wired through `CommentPane` and `ReviewerV2Shell`; no confirmation dialog exists in the code path |
| 4 | Each outline item shows a badge with the count of comments anchored within that section; a section with no comments shows no badge; adding a comment in the content pane updates its section's count immediately | ✓ VERIFIED | `OutlinePane.tsx` renders `<span>` badge when `(annotationCounts?.get(section.id) ?? 0) > 0`; `useSectionAnnotationCounts` is called in `ReviewerV2Shell` and threaded as `annotationCounts` prop; memoized on `[sections, annotations, planRef]` so updates on annotation add/remove |

**Score:** 3/4 truths verified (1 uncertain — requires human confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ui/src/reviewer-v2/AnnotationForm.tsx` | AnnotationForm component (popover + textarea + buttons) | ✓ VERIFIED | Exists, substantive (143 LOC), imported by ContentPane |
| `ui/src/reviewer-v2/AnnotationForm.test.ts` | Source-as-text assertions for AnnotationForm structure | ✓ VERIFIED | Exists, assertions pass |
| `ui/src/reviewer-v2/hooks/useSectionAnnotationCounts.ts` | useSectionAnnotationCounts hook + computeSectionAnnotationCounts | ✓ VERIFIED | Both exports present, imported by ReviewerV2Shell |
| `ui/src/reviewer-v2/hooks/useSectionAnnotationCounts.test.ts` | Unit tests for computeSectionAnnotationCounts | ✓ VERIFIED | Exists, tests pass |
| `ui/src/reviewer-v2/hooks/useTextSelection.ts` | getElementCharOffset export added | ✓ VERIFIED | `export function getElementCharOffset(` present, uses `targetElement.contains(node)` |
| `ui/src/reviewer-v2/ContentPane.tsx` | formState management + AnnotationForm rendering | ✓ VERIFIED | `useState<FormState | null>`, `handleAction`, `handleFormSubmit`, `handleFormCancel`, `handleAdd` all present |
| `ui/src/reviewer-v2/PlanContent.tsx` | onAdd signature wired to receive paragraph element | ✓ VERIFIED | `onAdd: (el: HTMLElement) => void` and `onAdd={() => onAdd(hoveredParagraph)}` present |
| `ui/src/reviewer-v2/CommentBubble.tsx` | edit/delete icon buttons + inline edit mode | ✓ VERIFIED | `isEditing`, pencil `✎` button, × button, textarea edit mode, Save/Discard row all present |
| `ui/src/reviewer-v2/CommentPane.tsx` | editingId prop + sticky wrapper for editing bubble | ✓ VERIFIED | `editingId` prop, `position: 'sticky'` wrapper, `key={ann.id}` on wrapper div |
| `ui/src/index.css` | .bubble-icon-btn transition rule | ✓ VERIFIED | `.bubble-icon-btn { transition: color 0.1s ease; }` present |
| `ui/src/reviewer-v2/ReviewerV2Shell.tsx` | editingId state + useSectionAnnotationCounts call + complete prop forwarding | ✓ VERIFIED | All four new props forwarded to CommentPane; annotationCounts to OutlinePane |
| `ui/src/reviewer-v2/OutlinePane.tsx` | annotationCounts prop + per-section count badge rendering | ✓ VERIFIED | `annotationCounts?: Map<string, number>` prop, conditional `<span>` badge |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ReviewerV2Shell.tsx` | `hooks/useSectionAnnotationCounts.ts` | `import { useSectionAnnotationCounts }` | ✓ WIRED | Line 6 of ReviewerV2Shell.tsx |
| `ReviewerV2Shell.tsx` | `CommentPane.tsx` | props `editingId`, `onEdit`, `onRemove`, `onCancelEdit` | ✓ WIRED | Lines 111-126 of ReviewerV2Shell.tsx |
| `ReviewerV2Shell.tsx` | `OutlinePane.tsx` | prop `annotationCounts={annotationCounts}` | ✓ WIRED | Line 75 of ReviewerV2Shell.tsx |
| `ContentPane.tsx` | `AnnotationForm.tsx` | `import AnnotationForm, { type FormState }` | ✓ WIRED | Line 7 of ContentPane.tsx |
| `ContentPane.tsx` | `SelectionToolbar.tsx` | `handleAction` third arg `prefillComment` | ✓ WIRED | `function handleAction(type: AnnotationType, anchorText: string, prefillComment?: string)` present |
| `CommentPane.tsx` | `CommentBubble.tsx` | props `isEditing`, `onEdit`, `onRemove`, `onCancelEdit` | ✓ WIRED | Lines 126-132 of CommentPane.tsx |
| `hooks/useSectionAnnotationCounts.ts` | `hooks/useTextSelection.ts` | `import { getElementCharOffset }` | ✓ WIRED | Line 3 of useSectionAnnotationCounts.ts |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `OutlinePane.tsx` | `annotationCounts` | `useSectionAnnotationCounts(sections, annotations, planRef)` in Shell | Yes — pure function walks actual DOM, counts by anchorStart | ✓ FLOWING |
| `CommentPane.tsx` | `editingId` | `useState<string | null>(null)` in Shell | Yes — set by `setEditingId(id)` in onEdit callback | ✓ FLOWING |
| `ContentPane.tsx` | `formState` | `useState<FormState | null>(null)` set in `handleAction` | Yes — set from live range rect + stored offsets | ✓ FLOWING |
| `CommentBubble.tsx` | `isEditing` | `editingId === ann.id` in CommentPane | Yes — derived from Shell state | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 312 vitest tests pass | `cd ui && npm test -- --run` | 22 test files, 312 tests, 0 failures | ✓ PASS |
| SelectionToolbar QUICK_ACTIONS exported | `grep -n "QUICK_ACTIONS" SelectionToolbar.tsx` | 6-label array found | ✓ PASS |
| 'search internet' vs 'Search the web' | `grep "search internet\|search the web" SelectionToolbar.tsx` | `'search internet'` in code; REQUIREMENTS.md says `"Search the web"` | ? UNCERTAIN |

### Probe Execution

Not applicable — no `scripts/*/tests/probe-*.sh` files found for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COMMENT-04 | 21-01, 21-02 | Three quick actions + expandable menu with six predefined actions | ? UNCERTAIN | Three pills verified; menu label `'search internet'` deviates from REQUIREMENTS.md `"Search the web"` — see SC-2 above |
| COMMENT-05 | 21-03, 21-04 | Edit (pencil) and delete (×) on each bubble; edit reopens textarea; delete removes with no confirmation | ✓ SATISFIED | CommentBubble.tsx has both icons, inline edit mode, immediate delete via onRemove |
| OUTLINE-04 | 21-01, 21-04 | Per-section annotation count badge in outline | ✓ SATISFIED | OutlinePane renders `<span>` badge when count > 0; useSectionAnnotationCounts memoized and threaded through Shell |

**Orphaned requirements check:** REQUIREMENTS.md maps COMMENT-04, COMMENT-05, OUTLINE-04 to Phase 21. All three are claimed across the five plan files. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `CommentBubble.tsx` | 257 | "Save Changes" button missing `onMouseDown={(e) => e.preventDefault()}` | ⚠️ Warning | Article's `onClick` (line 101) can fire before the button's `onClick`, potentially toggling `focusedCommentId` to null mid-click (CR-03 in code review) |
| `CommentPane.tsx` | 93 | `EXPANDED_HEIGHT_ESTIMATE = 160` magic constant inline with TODO comment | ℹ️ Info | Acknowledged as temporary in code comment |
| `ReviewerV2Shell.tsx` | 116-123 | `onRemove={removeAnnotation}` does not clear `editingId` when the removed annotation is the one being edited | ⚠️ Warning | Can leave `editingId` pointing to a deleted annotation's id (WR-01 in code review) |

No `TBD`, `FIXME`, or `XXX` debt markers found in any phase-modified file.

### Human Verification Required

#### 1. All nine behavioral flows from Plan 04 Task 3

**Test:** Run the dev server and execute all 9 verification steps defined in the `<how-to-verify>` block of `.planning/phases/21-comment-actions/21-04-PLAN.md` Task 3:
1. Comment pill flow — select text, click Comment, verify popover, type text, Cmd+Enter, verify bubble appears
2. Delete / Replace pre-fill — verify textarea opens with the correct prefill
3. Predefined-actions menu — open "more" menu, click a label, verify textarea pre-fill
4. Gutter-icon paragraph selection — hover paragraph, click +, verify entire paragraph selected and toolbar appears
5. Auto-submit on conflict (D-03) — open form, start a second without submitting, verify first auto-submits
6. Edit flow — focus bubble, click pencil, verify inline edit textarea; test Cmd+Enter save and Escape discard
7. Delete flow — focus bubble, click ×, verify immediate removal with no confirmation dialog
8. Section count badges — verify count badge appears/increments/disappears correctly
9. Escape clears edit mode globally

**Expected:** All 9 steps pass.

**Why human:** Plan 04 Task 3 is a `checkpoint:human-verify gate="blocking"`. The plan contract requires an explicit "approved" signal before Phase 21 can be considered complete. The 21-04-SUMMARY.md records "awaiting user verification of all 9 behavioral steps" — the gate was never passed. Behavioral interactions (visual appearance of popover, textarea focus, selection highlight staying active, sticky bubble scroll behavior, badge color switching) cannot be verified programmatically without a running browser.

#### 2. QUICK_ACTIONS label: "search internet" vs "Search the web"

**Test:** Open the running app, expand the "▾ more" menu in SelectionToolbar, verify what the fifth action label reads.

**Expected:** Confirm whether `'search internet'` (the implemented label) or `'Search the web'` (the REQUIREMENTS.md / ROADMAP success criterion label) is the accepted product contract.

**Why human:** UI-SPEC.md explicitly maps "Search the web" → `"search internet"` as an intentional rename. REQUIREMENTS.md COMMENT-04 states the label should be `"Search the web"`. These two authoritative specs conflict. A product decision is required to accept the deviation or update the implementation.

### Gaps Summary

No hard FAILED truths were found — all code artifacts exist, are substantive, and are fully wired. The phase reaches `human_needed` for two reasons:

1. **Mandatory blocking gate not passed:** Plan 04, Task 3 is a `checkpoint:human-verify` gate with `gate="blocking"`. The executor's own SUMMARY records it as "awaiting" — no approval was ever received. The entire behavioral acceptance gate for COMMENT-04, COMMENT-05, and OUTLINE-04 in the running application remains unverified.

2. **Label mismatch requiring product decision:** The fifth quick-action label reads `'search internet'` in code but `"Search the web"` in REQUIREMENTS.md and the ROADMAP success criteria. UI-SPEC.md intentionally introduced `'search internet'` as the normalized value. A human must confirm which spec governs. If REQUIREMENTS.md is authoritative, this is a BLOCKER (label fix required). If UI-SPEC.md override is accepted, this finding can be overridden.

---

_Verified: 2026-05-22T14:45:00Z_
_Verifier: Claude (gsd-verifier)_
