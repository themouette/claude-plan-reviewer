# Phase 19: Outline Pane - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 19-Outline Pane
**Areas discussed:** Data flow, Section model, Scroll tracking, Heading scroll targets

---

## Data flow

### Q1: How should OutlinePane receive heading data?

| Option | Description | Selected |
|--------|-------------|----------|
| ContentPane callback | ContentPane extracts Section[] from DOM, calls onSectionsFound(sections). Shell stores and passes to OutlinePane. | ✓ |
| Lift fetch to Shell | Shell fetches /api/plan, passes planMd to both panes. ContentPane becomes a pure renderer. | |
| OutlinePane queries DOM directly | Shell passes mainRef. OutlinePane querySelectorAll after ContentPane renders. | |

**User's choice:** ContentPane callback
**Notes:** Prior research note confirmed ("ContentPane produces Section[] used by OutlinePane"). Lift-to-Shell rejected to avoid refactoring ContentPane's fetch.

---

### Q2: What should a Section carry for the scroll target?

| Option | Description | Selected |
|--------|-------------|----------|
| DOM element ref | Section includes HTMLElement. OutlinePane calls element.scrollIntoView() directly. | |
| Heading ID string | renderMarkdown adds IDs; Section carries id string; OutlinePane uses getElementById. | ✓ |
| You decide | Let the planner pick whichever is simpler. | |

**User's choice:** Initially "You decide" — user then flagged concern that DOM element refs would be buggy across re-renders. Confirmed heading ID string approach.
**Notes:** User correctly identified that storing DOM nodes through React props is an antipattern — React can re-create DOM nodes during reconciliation, leaving stale refs. Heading IDs are string primitives, stable after the initial render.

---

## Section model

### Q1: How should comment counts per section be computed (OUTLINE-04)?

| Option | Description | Selected |
|--------|-------------|----------|
| Add sectionId to Annotation now | Extend Annotation type with sectionId?: string. Phase 21 populates. Phase 19 shows 0 counts. | |
| Compute from anchorText at render time | Scan DOM to find which section contains anchorText. Fragile, expensive. | |
| Defer counts to Phase 21 | Phase 19 renders outline tree only. Phase 21 handles all badge UI. | ✓ |

**User's choice:** Defer counts to Phase 21

---

### Q2: How to handle the OUTLINE-04 requirement being in Phase 19's scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 19 adds sectionId + badge UI (Phase 21 populates) | Phase 19 lays groundwork; badges show 0 until Phase 21. | |
| Fully defer to Phase 21 | Phase 19 renders tree only; OUTLINE-04 moves to Phase 21 scope. | ✓ |

**User's choice:** Fully defer to Phase 21 — accept OUTLINE-04 moves out of Phase 19's verification scope.

---

## Scroll tracking

### Q1: How should active section tracking work (OUTLINE-03)?

| Option | Description | Selected |
|--------|-------------|----------|
| IntersectionObserver | root: mainRef, narrow top-band rootMargin. Zero polling, browser-native. | ✓ |
| Scroll event + getBoundingClientRect | Listen to scroll on mainRef. Throttle with rAF. Simpler. | |
| You decide | Let the planner pick. | |

**User's choice:** IntersectionObserver

---

### Q2: How should the outline panel scroll to keep active item visible?

| Option | Description | Selected |
|--------|-------------|----------|
| scrollIntoView on active item ref | activeItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) | ✓ |
| Manual scrollTop calculation | Compute new scrollTop from offsetTop values. | |
| You decide | Let the planner pick. | |

**User's choice:** scrollIntoView on active item ref (block: 'nearest' to avoid jarring scroll)

---

## Claude's Discretion

- Exact rootMargin values for IntersectionObserver top band — calibrate during implementation
- Slug collision strategy for duplicate heading text (numeric suffix direction confirmed)
- Directory structure for new files within reviewer-v2/
- Whether useOutline scroll tracking lives as a standalone hook or inline in OutlinePane

## Deferred Ideas

- **OUTLINE-04 comment count badges** — moved to Phase 21 scope. Needs `sectionId?: string` on Annotation type (Phase 21 populates at comment creation) and badge UI on outline items.
