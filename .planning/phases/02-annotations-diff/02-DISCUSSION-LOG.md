# Phase 2: Annotations & Diff - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-09
**Phase:** 02-annotations-diff
**Mode:** discuss
**Areas discussed:** Annotation UX, Plan+Diff navigation, Diff highlighting, Annotation message format

## Gray Areas Presented

All four areas selected by user.

## Area: Annotation UX

**Q1: How does annotation flow begin when user selects text?**
- Options: Popup toolbar / Sidebar panel / Inline expansion
- **User selected:** Sidebar panel (plan content | annotations side-by-side)

**Q2: In sidebar, after clicking '+ Add annotation', what happens?**
- Options: Type picker first / Comment box opens immediately / Separate button per type
- **User selected:** Type picker first (Comment / Delete / Replace → then form)

**Q3: How are existing annotations ordered in sidebar?**
- Options: Positional order / Creation order / Grouped by type
- **User selected:** Positional order (top-to-bottom as they appear in plan)

**Q4: Global comment (ANN-04) placement in sidebar?**
- Options: Pinned at top / Pinned at bottom / Just another annotation
- **User selected:** Pinned at top

## Area: Plan + Diff Navigation

**Q1: Navigation between plan and diff?**
- Options: Tab bar at top (React state) / URL routing (react-router) / Side-by-side always
- **User selected:** Tab bar at top (no router, React state switch)

**Q2: No diff available — what shows?**
- Options: Empty state message / Hide the tab entirely / Error state
- **User selected:** Empty state message

## Area: Diff Highlighting

**Q: What does 'syntax highlighting' mean for this project?**
- Options: Diff-level only red/green / JS syntax highlighting (highlight.js) / Basic CSS file-type hints
- **User selected (custom):** Use `@pierre/diffs` (https://diffs.com/) for both code and diff highlighting
- **Note:** User specifically named this library — must be researched before planning

## Area: Annotation Message Format

**Q1: Message structure Claude receives?**
- Options: Structured sections / Inline quoted format / Bullet list
- **User selected:** Structured sections (## Overall Comment + ## Annotations with ### per type)

**Q2: Deny textarea behavior when annotations exist?**
- Options: Annotations replace textarea / Textarea + annotations combined / Textarea becomes Overall Comment
- **User selected:** Textarea + annotations combined (textarea optional when annotations exist, prepended to sections)

## Corrections Made

None — all selections were user's explicit choices.

## Deferred Ideas

- Approve-with-comments — v2 (UX-02)
- Line-level diff annotations — Out of Scope
- Countdown timer — v2 (UX-01)
