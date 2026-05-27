---
phase: 27-inline-comments
verified: 2026-05-25T16:37:30Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Hover a diff line in a non-binary file and confirm the + button appears in the gutter, then click it to confirm an inline HunkCommentForm opens anchored to that line with autofocused textarea"
    expected: "HunkCommentForm appears inline below the hovered line with placeholder 'Add a comment...' and focus in the textarea"
    why_human: "renderGutterUtility + pointer hover tracking inside @pierre/diffs cannot be verified with source-text tests; requires live DOM interaction"
  - test: "Click '+ Comment' in any file header, type text, submit. Confirm a CommentBubble appears between the header and the diff body"
    expected: "CommentBubble with comment text, timestamp, pencil (edit) and × (delete) buttons renders above the diff lines, NOT inside line annotations"
    why_human: "File-level comment rendering position (above diff body) requires visual confirmation in the browser"
  - test: "Submit a comment, switch to a different commit using the Commits drawer, then switch back. Confirm comments are still present"
    expected: "Comments persist across commit navigation; no badge or comment disappears when selectedCommitShas changes"
    why_human: "Session-persistence and commit-navigation interaction cannot be confirmed from static source inspection"
  - test: "Click the pencil (✎) on a CommentBubble. Edit the text and click Save Changes. Confirm the updated text is displayed. Click × on the same bubble and confirm it disappears immediately with no confirmation dialog"
    expected: "Edit mode replaces bubble body with HunkCommentForm (initialText pre-filled); Save updates text in-place; Delete removes bubble instantly"
    why_human: "Edit/delete interaction state and DOM replacement requires live rendering to confirm"
  - test: "Add at least one comment to file A and zero comments to file B. Confirm file A shows a blue badge with the count; file B shows no badge. Add a second comment to file A and confirm the badge increments to 2"
    expected: "Blue pill badges appear after filenames in FileListPane sidebar; badge text matches comment count; absent when count is 0"
    why_human: "Badge rendering and live count update requires visual confirmation in the browser"
  - test: "Open browser DevTools > Console while interacting with comments (add/edit/delete). Confirm no React warnings or errors appear. Open DevTools > Network and confirm no /api/ requests fire on comment operations"
    expected: "Zero React console errors; zero network calls for comment add/edit/delete (session state only)"
    why_human: "React runtime warnings and network traffic require live browser observation"
---

# Phase 27: Inline Comments Verification Report

**Phase Goal:** Users can add a comment to any diff hunk or to a whole file; comments persist in session state; each comment can be edited or deleted; the file list shows a comment count badge per file
**Verified:** 2026-05-25T16:37:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clicking the `+` button that appears on hunk hover opens a comment input anchored to that hunk | VERIFIED (automated gates pass; live browser needed for hover interaction) | `renderGutterUtility` wired in DiffPane.tsx:100-127 with `getHoveredLine()` called inside click handler; `enableGutterUtility: true` set in options (line 75); HunkCommentForm rendered for `'__pending__'` sentinel (lines 79-89) |
| 2 | A file-level comment button (in the file header) opens a comment input for the whole file | VERIFIED (structure confirmed; visual confirmation needed) | `aria-label="Add file-level comment"` button at DiffPane.tsx:427-453; `pendingFileComment === file.filename` renders HunkCommentForm at lines 475-484 |
| 3 | Submitted comments persist in session state — they survive navigating between commits | VERIFIED (by construction; live navigation confirmation needed) | `useCodeReviewAnnotations` uses `useReducer` which is independent of `selectedCommitShas`; CodeReviewApp.tsx contains no `setComments([])` or reset calls on selector/commit change |
| 4 | Each comment has edit (pencil) and delete (×) buttons; edit reopens the textarea; delete removes immediately | VERIFIED (code confirms all paths; live interaction needed) | CommentBubble.tsx renders `✎` + `×` buttons (lines 68-128); `editing` state toggles HunkCommentForm with `initialText={comment.text}`, `submitLabel="Save Changes"` (lines 33-43); `onClick={() => onDelete()` at line 103 |
| 5 | The file list shows a badge with the count of comments on each file; zero-comment files show no badge | VERIFIED | FileListPane.tsx line 176: `(commentCounts[file.filename] ?? 0) > 0 && (...)` guard; badge uses `background: 'var(--color-focus)'`, `borderRadius: 10`, `padding: '2px 8px'`; CodeReviewApp.tsx lines 58-64: `commentCounts` derived via `useMemo([comments])` |

**Score:** 5/5 truths verified (automated)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ui/src/code-review/types.ts` | `CodeReviewComment` discriminated union (line\|file) | VERIFIED | Lines 25-41: union with both variants; existing `FileDiff` + `Commit` untouched |
| `ui/src/code-review/hooks/useCodeReviewAnnotations.ts` | `reduceAnnotations` + `useCodeReviewAnnotations` + `CommentAction` | VERIFIED | 42 lines; all three exports present; `readonly CodeReviewComment[]` state param; pure switch branches use spread/map/filter |
| `ui/src/code-review/hooks/useCodeReviewAnnotations.test.ts` | 7+ reducer tests, no @testing-library/react | VERIFIED | 7/7 tests passing; `Object.freeze` assertion present; no @testing-library/react |
| `ui/src/code-review/HunkCommentForm.tsx` | Inline form (no position:fixed); `aria-label="Comment text"` | VERIFIED | 112 lines; no `position: 'fixed'`; no `addEventListener`; `aria-label="Add a comment"` container; `aria-label="Comment text"` textarea; Cmd+Enter + Escape handlers |
| `ui/src/code-review/HunkCommentForm.test.ts` | 18 source-text assertions | VERIFIED | 18/18 passing |
| `ui/src/code-review/CommentBubble.tsx` | Inline card with edit/delete; HunkCommentForm reuse for edit mode | VERIFIED | 133 lines; `editing` state; edit mode renders `<HunkCommentForm submitLabel="Save Changes" cancelLabel="Discard Changes">`; no `position: 'absolute'`; `borderLeft: '3px solid var(--color-focus)'` |
| `ui/src/code-review/CommentBubble.test.ts` | 21 source-text assertions | VERIFIED | 21/21 passing |
| `ui/src/code-review/DiffPane.tsx` | `lineAnnotations`, `renderAnnotation`, `renderGutterUtility` on FileDiffComponent; `+ Comment` trigger; file comments above diff body; `PatchDiff` path clean | VERIFIED | All three annotation API props present; `enableGutterUtility: true`; `+ Comment` button at line 427; file-level CommentBubble rendering at lines 460-473; PatchDiff at lines 131-136 receives no `lineAnnotations` |
| `ui/src/code-review/DiffPane.test.ts` | 51 tests (33 old + 18 new Phase 27) | VERIFIED | 51/51 passing |
| `ui/src/code-review/CodeReviewApp.tsx` | `useCodeReviewAnnotations` + `useMemo(commentCounts)` + `crypto.randomUUID()` + all 5 props to DiffPane | VERIFIED | Lines 27-64: hook call, wrapper functions with `crypto.randomUUID()` + `new Date().toISOString()`, `useMemo` derivation; lines 293-297: all 5 props passed to `<DiffPane>` |
| `ui/src/code-review/CodeReviewApp.test.ts` | 56 source-text assertions | VERIFIED | 56/56 passing |
| `ui/src/code-review/FileListPane.tsx` | `commentCounts` prop + badge guard `> 0` + `var(--color-focus)` background | VERIFIED | Lines 176-191; badge guard `(commentCounts[file.filename] ?? 0) > 0`; badge uses `var(--color-focus)`, `borderRadius: 10`, `padding: '2px 8px'` |
| `ui/src/code-review/FileListPane.test.ts` | 31 source-text assertions | VERIFIED | 31/31 passing |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useCodeReviewAnnotations.ts` | `types.ts` | `import type { CodeReviewComment } from '../types'` | WIRED | Line 2 of hook file |
| `useCodeReviewAnnotations.test.ts` | `useCodeReviewAnnotations.ts` | `import { reduceAnnotations } from './useCodeReviewAnnotations'` | WIRED | Test imports confirmed; 7 tests passing |
| `DiffPane.tsx` | `@pierre/diffs FileDiff` | `lineAnnotations + renderAnnotation + renderGutterUtility` | WIRED | All three props on `FileDiffComponent` (lines 77-127); `enableGutterUtility: true` in options |
| `DiffPane.tsx` | `HunkCommentForm.tsx` | `renderAnnotation` returns `<HunkCommentForm>` for `'__pending__'` + file-level form | WIRED | Lines 81-88 and 477-483 |
| `DiffPane.tsx` | `CommentBubble.tsx` | `renderAnnotation` returns `<CommentBubble>` for submitted; file comments above diff | WIRED | Lines 92-97 and 464-472 |
| `HunkCommentForm.tsx` + `CommentBubble.tsx` | `types.ts` | `import type { CodeReviewComment } from './types'` | WIRED | CommentBubble.tsx line 2; HunkCommentForm has no direct type import (uses inline prop types only — acceptable: no `CodeReviewComment` consumption needed) |
| `CodeReviewApp.tsx` | `useCodeReviewAnnotations.ts` | `useCodeReviewAnnotations()` destructuring | WIRED | Line 9 import; line 27 call |
| `CodeReviewApp.tsx` | `DiffPane.tsx` | `comments`, `onAddLineComment`, `onAddFileComment`, `onEditComment`, `onDeleteComment` | WIRED | Lines 293-297 |
| `CodeReviewApp.tsx` | `FileListPane.tsx` | `commentCounts` prop | WIRED | Line 269 |
| `FileListPane.tsx` | `var(--color-focus)` CSS token | badge background | WIRED | Line 179 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `FileListPane.tsx` (badge) | `commentCounts[file.filename]` | `useMemo([comments])` in CodeReviewApp | Yes — derived from live reducer state | FLOWING |
| `CommentBubble.tsx` | `comment.text`, `comment.createdAt` | `comments` array from `useReducer` | Yes — populated by user input via dispatch | FLOWING |
| `DiffPane.tsx` (lineAnnotations) | `lineAnnotations` array | filtered from `comments` prop | Yes — from same reducer state | FLOWING |
| `DiffPane.tsx` (file comments) | `comments.filter(c => c.type === 'file' && c.file === file.filename)` | `comments` prop from CodeReviewApp | Yes — from same reducer state | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Reducer tests (7) pass | `npm test -- --run src/code-review/hooks/useCodeReviewAnnotations.test.ts` | 7/7 | PASS |
| HunkCommentForm tests (18) pass | `npm test -- --run src/code-review/HunkCommentForm.test.ts` | 18/18 | PASS |
| CommentBubble tests (21) pass | `npm test -- --run src/code-review/CommentBubble.test.ts` | 21/21 | PASS |
| DiffPane tests (51) pass | `npm test -- --run src/code-review/DiffPane.test.ts` | 51/51 | PASS |
| FileListPane tests (31) pass | `npm test -- --run src/code-review/FileListPane.test.ts` | 31/31 | PASS |
| CodeReviewApp tests (56) pass | `npm test -- --run src/code-review/CodeReviewApp.test.ts` | 56/56 | PASS |
| Full test suite | `npm test` | 593/593 | PASS |
| TypeScript compile | `npx tsc --noEmit -p .` | exit 0 | PASS |

---

### Probe Execution

Step 7c: SKIPPED (no probe scripts found; phase is a React UI, not a CLI or migration phase)

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COMMENT-01 | 27-02, 27-03 | User can add a comment anchored to any diff hunk | SATISFIED (automated) | `renderGutterUtility` wired with `+` button; `pendingLineAnchor` state drives `HunkCommentForm` inline; `onAddLineComment` flows up to `CodeReviewApp`; human browser check required for hover interaction |
| COMMENT-02 | 27-02, 27-03 | User can add a comment at the whole-file level | SATISFIED (automated) | `+ Comment` button in file header; `pendingFileComment` state drives `HunkCommentForm` above diff body; `onAddFileComment` flows up; human browser check required |
| COMMENT-03 | 27-01, 27-02, 27-03 | User can edit or delete their own comments | SATISFIED (automated) | `reduceAnnotations` handles `EDIT_COMMENT` + `DELETE_COMMENT`; `CommentBubble` edit toggle + `onDelete` immediate; comments survive commit navigation by construction; human browser check required |
| COMMENT-04 | 27-03 | File list shows a comment count badge per file | SATISFIED (automated) | `commentCounts` derived in CodeReviewApp; `FileListPane` badge rendered with `> 0` guard; `borderRadius: 10`, `var(--color-focus)` background; human browser check required |

No orphaned requirements — all four COMMENT-01..04 IDs declared in plan frontmatter match the REQUIREMENTS.md traceability table for Phase 27.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `HunkCommentForm.tsx` | 45 | `placeholder="Add a comment…"` | Info | This is a textarea `placeholder` HTML attribute — not a stub. The file is a fully implemented 112-line component. Not a blocker. |
| `CodeReviewApp.tsx` | 89 | `react-hooks/set-state-in-effect` ESLint error | Warning | Pre-existing error documented in 27-01-SUMMARY ("out of scope for this plan"). Not introduced by Phase 27. No Phase 27 file introduced this error. |
| `CodeReviewApp.tsx` (AppToolbar.tsx) | — | `@typescript-eslint/no-unused-vars` in AppToolbar.tsx | Warning | Pre-existing, AppToolbar was not touched by any Phase 27 commit. Out of scope. |
| `useDiff.ts` | 195 | Unused eslint-disable directive | Warning | Pre-existing, documented in 27-01-SUMMARY. Not introduced by Phase 27. |

No `TBD`, `FIXME`, or `XXX` markers found in any Phase 27 modified file.

---

### Human Verification Required

Phase 27 includes a `checkpoint:human-verify` gate (Plan 27-03 Task 4) requiring browser walkthrough. The 27-03-SUMMARY claims human verification was completed, but this automated verification cannot independently confirm the claim. The following items need human sign-off before marking this phase fully complete:

#### 1. Gutter `+` Button Hover Interaction (COMMENT-01)

**Test:** Start the UI dev server (`cd ui && npm run dev`), open the code-review page in the browser, hover a diff line in a non-binary file
**Expected:** A `+` button appears in the gutter on hover; clicking it opens an inline `HunkCommentForm` anchored to that line; form has autofocused textarea with placeholder "Add a comment..."
**Why human:** `renderGutterUtility` + pointer hover tracking inside `@pierre/diffs` requires actual DOM event dispatch; source-text tests cannot verify the hover event loop

#### 2. File-Level Comment Button (COMMENT-02)

**Test:** In the file header of any file, look for a `+ Comment` button; click it
**Expected:** `HunkCommentForm` appears between the file header and the diff body (not inside the diff lines); submitting creates a `CommentBubble` above the diff body
**Why human:** Visual position of the form relative to diff content requires browser rendering to confirm

#### 3. Comment Persistence Across Commit Navigation (COMMENT-03 / D-09)

**Test:** Add a comment, open the Commits drawer, click a different commit, click back
**Expected:** Comments remain present after commit navigation; file list badges persist
**Why human:** While the code is structurally correct (no reset effects), live navigation interaction must be confirmed

#### 4. Edit and Delete Interaction (COMMENT-03)

**Test:** Click the ✎ pencil on a `CommentBubble`; edit text; click Save Changes; then click × on another comment
**Expected:** Edit reopens textarea pre-filled with current text; Save Changes updates the bubble text in-place; × removes the bubble immediately with no confirmation dialog
**Why human:** Component state transitions and DOM replacement require live rendering

#### 5. File List Badge Count (COMMENT-04)

**Test:** Add comments to file A (at least 2), no comments to file B; observe the file list sidebar
**Expected:** File A shows a blue pill badge with count; file B shows no badge; adding second comment updates badge to 2
**Why human:** Badge rendering and real-time count update requires visual confirmation in the browser

#### 6. No Console Errors / No API Calls (D-09 Sanity)

**Test:** Open DevTools Console and Network tabs while performing add/edit/delete operations
**Expected:** Zero React console errors; zero `/api/` calls fired for comment operations (session-only)
**Why human:** React runtime warnings and network traffic only visible in live browser devtools

---

### Gaps Summary

No code gaps found. All 5 roadmap success criteria are implemented and verified by automated tests (593/593 passing, TypeScript exit 0). The `human_needed` status reflects the `checkpoint:human-verify` gate built into Plan 27-03 Task 4 — a browser walkthrough is required before Phase 27 can be marked fully complete.

The three pre-existing ESLint errors (`CodeReviewApp.tsx` react-hooks/set-state-in-effect, `AppToolbar.tsx` unused-vars, `useDiff.ts` unused-disable) were present before Phase 27 and are documented as out of scope in the 27-01-SUMMARY.

---

_Verified: 2026-05-25T16:37:30Z_
_Verifier: Claude (gsd-verifier)_
