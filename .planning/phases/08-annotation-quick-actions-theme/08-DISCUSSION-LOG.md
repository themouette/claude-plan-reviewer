# Phase 8: Annotation Quick-Actions & Theme - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-11
**Phase:** 08-annotation-quick-actions-theme
**Mode:** discuss
**Areas analyzed:** Quick-action placement, Chip pre-fill behavior, Theme toggle placement, Light theme palette

## Gray Areas Presented

All four areas were selected for discussion.

## Discussion

### Quick-action chip placement

**Initial question:** Where/how do the 6 chips appear — in the AnnotationCard or in the floating affordance?

**User clarification:** Chips belong in the floating annotation affordance (the tooltip on text selection), next to Comment/Delete/Replace. Show first 2 inline; remaining 4 in a dropdown overflow menu. Keep existing button order; add quick-actions after.

**Decision:** FloatingAnnotationAffordance gets chips appended after existing pills. 2 visible + "▾ more" dropdown for the rest.

### Chip pre-fill behavior

Resolved implicitly by the placement clarification: chips create a new `comment` annotation with the label pre-filled. No overwrite/append question applies since each click is a fresh annotation creation.

### Theme toggle placement

**Question:** Header far right vs. between title and tabs.

**Decision:** Header far right (after TabBar). User selected this option.

### Light theme palette

**Question:** Define specific colors vs. standard palette at Claude's discretion.

**Decision:** Claude's discretion — standard light palette (off-white background, light gray surface, dark text).

## Corrections Applied

None — all decisions were first-pass confirmations.

## Deferred

- Quick-action chip order: user deferred the order discussion; keep requirement-specified order for now
