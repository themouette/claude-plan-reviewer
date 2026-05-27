# Phase 27: Inline Comments - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 27 adds an inline comment layer to the code review diff viewer. Users can anchor a comment to any diff line (via a + button in the gutter on line hover) or to an entire file (via a button in the file header). Comments persist in React session state — they survive navigating between commits. Each comment can be edited or deleted. The file list shows a badge with the count of comments per file.

Not in scope: review submission / JSON serialization to agent (Phase 28), integration wiring — slash command and pre-PR hook (Phase 29).

</domain>

<decisions>
## Implementation Decisions

### Hunk Comment Trigger (D-01–D-02)

- **D-01:** Line comments use the `@pierre/diffs` `FileDiff` React component's `renderGutterUtility` prop to render a + button in the gutter when a diff line is hovered. `getHoveredLine()` (passed to `renderGutterUtility`) provides `{ lineNumber, side }` — clicking the + opens a comment input anchored to that line.
- **D-02:** The `FileDiffComponent` in `DiffPane.tsx` (currently `FileDiff as FileDiffComponent`) already accepts `lineAnnotations` and `renderAnnotation` props. Pass the relevant comments for each file via `lineAnnotations`, render them via `renderAnnotation`.

### File-Level Comment Trigger (D-03)

- **D-03:** File-level comments (COMMENT-02) are triggered by a comment button in the existing file header row in `DiffPane`. The input and submitted comments render between the file header and the diff content. No `lineAnnotations` involvement — file comments are rendered separately above the `FileDiffRenderer`.

### Comment Input Form (D-04)

- **D-04:** When the + button is clicked (or the file header comment button), an inline annotation entry appears immediately — rendered as a React node via `renderAnnotation` (for line comments) or in the file section header area (for file comments). The input contains a `<textarea>` with Submit and Cancel buttons. No popover or overlay. GitHub-style.

### Submitted Comment Bubble (D-05–D-06)

- **D-05:** Submitted comments render as styled cards: comment text, creation timestamp, edit (pencil) and delete (×) icon buttons. No author name or initials — single-user tool, author display is not needed.
- **D-06:** The card style uses existing CSS variable tokens (`--color-surface`, `--color-border`, `--color-text-primary`, `--color-text-secondary`). New implementation under `ui/src/code-review/` — must NOT import from `reviewer-v2/`.

### State Shape (D-07–D-09)

- **D-07:** Single flat `CodeReviewComment[]` array in `CodeReviewApp`. Each comment is discriminated by `type`:
  ```ts
  type CodeReviewComment =
    | { id: string; type: 'line'; file: string; side: 'additions' | 'deletions'; lineNumber: number; text: string; createdAt: string }
    | { id: string; type: 'file'; file: string; text: string; createdAt: string }
  ```
- **D-08:** State is managed by a `useCodeReviewAnnotations` reducer (plan 27-01). Dispatches: `ADD_COMMENT`, `EDIT_COMMENT`, `DELETE_COMMENT`. Reducer is a pure function — testable without React renderer.
- **D-09:** Session persistence = React state in `CodeReviewApp`. Comments survive commit navigation (switching commits, expanding context). Lost on page refresh. No localStorage, no backend storage.

### File List Badges (D-10)

- **D-10:** `FileListPane` receives `commentCounts: Record<string, number>` (filename → count). Derived in `CodeReviewApp` from the `comments` array. A badge renders after the filename in the file row when count > 0; zero-comment files show no badge. Use `--color-focus` for the badge background.

### Anchor Data Model for Phase 28 (D-11)

- **D-11:** The comment anchor shape mirrors `@pierre/diffs` `DiffLineAnnotation` natively:
  - Line comment: `{ file: string, line: number, side: 'additions' | 'deletions' }`
  - File comment: `{ file: string }` (no line/side)
  This is what Phase 28 will serialize into the structured JSON feedback output.

### Claude's Discretion

- Comment `id` generation strategy (UUID, timestamp-based, incrementing counter)
- Exact textarea dimensions and Submit/Cancel button layout within the inline form
- How `renderGutterUtility` + click state interact (e.g., a `pendingLineAnchor` state in `DiffPane` or lifted to `CodeReviewApp`)
- Whether to show a pending/draft annotation (the open textarea) via a separate mechanism from submitted `lineAnnotations`, or via a special `type: 'pending'` entry in the annotations array

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope
- `.planning/ROADMAP.md` Phase 27 — Goal, 5 success criteria, plan breakdown (27-01, 27-02, 27-03)
- `.planning/REQUIREMENTS.md` — COMMENT-01, COMMENT-02, COMMENT-03, COMMENT-04 (Phase 27 scope)

### @pierre/diffs Annotation API
- `ui/node_modules/@pierre/diffs/dist/react/types.d.ts` — `DiffBasePropsReact`: `lineAnnotations`, `renderAnnotation`, `renderGutterUtility` props
- `ui/node_modules/@pierre/diffs/dist/components/FileDiff.d.ts` — `FileDiffOptions`: `renderGutterUtility(getHoveredRow)`, `renderAnnotation(annotation)` callback shapes
- `ui/node_modules/@pierre/diffs/dist/types.d.ts` — `DiffLineAnnotation<T>`: `{ side: AnnotationSide, lineNumber: number, metadata: T }`

### Files to Modify
- `ui/src/code-review/DiffPane.tsx` — Pass `lineAnnotations` + `renderAnnotation` + `renderGutterUtility` to `FileDiffComponent`; add file comment trigger in file header; render file-level comments above diff content
- `ui/src/code-review/FileListPane.tsx` — Accept `commentCounts: Record<string, number>` prop; render badge per file when count > 0
- `ui/src/code-review/CodeReviewApp.tsx` — Own `comments: CodeReviewComment[]` state via `useCodeReviewAnnotations` reducer; derive `commentCounts`; pass down
- `ui/src/code-review/types.ts` — Add `CodeReviewComment` discriminated union type

### New Files (Phase 27)
- `ui/src/code-review/hooks/useCodeReviewAnnotations.ts` — Reducer + `fetchCommentsOnce`-style pure function + hook; tested in 27-01 plan
- `ui/src/code-review/HunkCommentForm.tsx` — Inline textarea form rendered via `renderAnnotation` (or `renderGutterUtility` return)
- `ui/src/code-review/CommentBubble.tsx` — Submitted comment card; text + timestamp + edit/delete controls

### Architecture Constraints
- `.planning/PROJECT.md` — React 19 + TypeScript + Vite; no new npm packages without justification
- `CLAUDE.md` — `cargo fmt && cargo clippy -D warnings` before commit; MUST NOT import from `reviewer-v2/`
- `.planning/phases/25-diff-viewer-ui/25-CONTEXT.md` — D-01–D-14: ESLint import direction, CSS variable tokens, AppToolbar header pattern
- `.planning/phases/26-commit-navigation/26-CONTEXT.md` — D-11–D-12: state ownership in `CodeReviewApp`, injectable `doFetch` pattern for hooks

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FileDiff as FileDiffComponent` in `DiffPane.tsx` — already accepts `lineAnnotations`, `renderAnnotation`, `renderGutterUtility` (currently unused). Phase 27 wires these props without changing the component import.
- CSS variable tokens (`--color-surface`, `--color-border`, `--color-text-primary`, `--color-text-secondary`, `--color-focus`) — use for comment bubble and badge styling
- `useCommits` hook pattern (`fetchCommitsOnce` + hook + cancelledRef) — `useCodeReviewAnnotations` reducer follows a similar TDD-first pattern (pure reducer tested without React renderer)

### Established Patterns
- **TDD first (CLAUDE.md + plan 27-01)**: types + reducer + serialization tests before any UI component code
- **State in `CodeReviewApp`**: `comments: CodeReviewComment[]` owned at the top level, props flow down to `DiffPane` and `FileListPane`. Consistent with `diffStyle`, `contextExpanded`, `selectedCommitShas`.
- **ESLint no-restricted-imports**: all Phase 27 components go under `ui/src/code-review/`. MUST NOT import from `ui/src/reviewer-v2/`.
- **Injectable pure function pattern**: `useCodeReviewAnnotations` exports a pure `reduceAnnotations(state, action)` function plus the `useCodeReviewAnnotations()` hook. Tests call the pure function directly.
- **Vitest + jsdom**: all tests use Vitest; mock `window.matchMedia` and `ResizeObserver` as needed.

### Integration Points
- `DiffPane.tsx` → `FileDiffRenderer` function: wrap each `FileDiffComponent` call to pass `lineAnnotations` (filtered to this file), `renderAnnotation`, and `renderGutterUtility`
- `DiffPane.tsx` → file header block: add file comment trigger button alongside the existing chevron + filename
- `FileListPane.tsx` → `renderFileNode`: add badge after the change counts span when `commentCounts[file.filename] > 0`
- `CodeReviewApp.tsx` → derive `commentCounts` from `comments` array with `useMemo`; pass as prop to `FileListPane`

</code_context>

<specifics>
## Specific Ideas

- "reviewer-v2-style bubble" — styled card with text, timestamp, edit (pencil) and delete (×) icon buttons. No author display.
- `DiffLineAnnotation<T>` where `T` is `{ commentId: string }` — so `renderAnnotation` can look up the full comment from `comments` by `commentId`
- The inline textarea form (D-04) renders as a `renderAnnotation` node — a `type: 'pending'` annotation entry in the annotations array (or via separate state) anchors the form to the clicked line
- Phase 28 will receive `comments: CodeReviewComment[]` from `CodeReviewApp` state and serialize them to `{ decision, comments: [{ file, line?, side?, text }] }`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 27-inline-comments*
*Context gathered: 2026-05-25*
