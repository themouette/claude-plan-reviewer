# Phase 27: Inline Comments - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 27-inline-comments
**Areas discussed:** Hunk trigger UX, Comment rendering, Anchor data model

---

## Hunk Trigger UX

| Option | Description | Selected |
|--------|-------------|----------|
| File header | Add a comment icon to the existing file header row — one button per file | (initially selected) |
| Hover overlay on file block | Wrap FileDiffRenderer in a relative container; show absolute + button on hover | |
| Parse patch hunks manually | Parse @@ hunk headers from file.patch; render each hunk as a discrete section with its own + button | |

**User's choice:** File header (initial selection), then revised after user clarification.

**Notes:** User clarified mid-discussion that `@pierre/diffs` provides a flexible annotation framework including `renderGutterUtility` (per-line hover trigger) and `lineAnnotations` + `renderAnnotation` (inline comment rendering). This changes the approach significantly — the + button appears per-line in the gutter, not just at the file header. The revised model:
- Line comment (COMMENT-01): `renderGutterUtility` triggers on line hover; `lineAnnotations` + `renderAnnotation` renders inline
- File comment (COMMENT-02): file header button triggers; renders between header and diff content

User confirmed this revised mental model is correct.

---

## Comment rendering

### Input form

| Option | Description | Selected |
|--------|-------------|----------|
| Inline textarea in the diff | Annotation entry appears below clicked line with textarea + Submit/Cancel. Rendered via renderAnnotation. GitHub-style. | ✓ |
| Floating overlay | Popover/dialog near the + button with textarea. Dismissed on Cancel/Submit. | |

**User's choice:** Inline textarea in the diff (GitHub-style)

### Submitted bubble appearance

| Option | Description | Selected |
|--------|-------------|----------|
| Simple text block | Lightly styled container with edit/delete icons. Minimal, matches existing token style. | |
| Reviewer-v2-style bubble | Richer card with author initials, timestamp, action menu. | ✓ |

**User's choice:** Reviewer-v2-style bubble

**Notes:** Can't import from `reviewer-v2/` — new implementation required in `code-review/`. Author display question raised next.

### Author display

| Option | Description | Selected |
|--------|-------------|----------|
| No author display | Skip author name/initials. Just text + timestamp + edit/delete. | ✓ |
| Git config name | Read from git config; show initials. Requires Rust-to-frontend pass. | |

**User's choice:** No author display — single-user tool, unnecessary.

---

## Anchor data model

### Phase 28 JSON anchor shape

| Option | Description | Selected |
|--------|-------------|----------|
| File + line number + side | `{file, line, side}` — mirrors @pierre/diffs natively, maximally precise | ✓ |
| File + hunk header string | `{file, hunk: '@@ -10,6 +10,8 @@'}` — less precise but more readable | |
| You decide | Claude picks the anchor shape | |

**User's choice:** File + line number + side

### State shape

| Option | Description | Selected |
|--------|-------------|----------|
| Single flat array, discriminated by type | One `CodeReviewComment[]`, each with `type: 'line' \| 'file'` | ✓ |
| Two separate arrays | `lineComments[]` and `fileComments[]` split | |

**User's choice:** Single flat array, discriminated by type

### Persistence scope

| Option | Description | Selected |
|--------|-------------|----------|
| React state only | Survives commit navigation. Lost on page refresh. Simple. | ✓ |
| localStorage | Survives page refresh. Keyed by repo + branch. | |

**User's choice:** React state only

---

## Claude's Discretion

- Comment `id` generation strategy (UUID, timestamp-based, incrementing counter)
- Exact textarea dimensions and Submit/Cancel button layout
- How `renderGutterUtility` click state interacts with the pending annotation (lifted to `CodeReviewApp` or local to `DiffPane`)
- Whether the open textarea renders as a `type: 'pending'` entry in the annotations array or via separate state

## Deferred Ideas

None — discussion stayed within phase 27 scope.
