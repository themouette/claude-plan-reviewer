# Phase 20: Comment Pane - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 20-Comment Pane
**Areas discussed:** Anchor Positioning, sidenotes vs custom layout, Annotation creation wiring, Hover state location

---

## Anchor Positioning

| Option | Description | Selected |
|--------|-------------|----------|
| Store offsets on Annotation | Add anchorStart/anchorEnd character offsets; CommentPane re-resolves Range via rangeFromOffsets() + getBoundingClientRect() on scroll/resize | ✓ |
| Snapshot Y at creation time | Record anchor range top Y at creation; recompute on scroll/resize only | |
| ContentPane reports anchor rects up | ContentPane computes Map<annotationId, y> and passes to Shell | |

**User's choice:** Store offsets on Annotation (all sub-questions recommended option)

**Follow-up Q: How offsets flow into annotation at creation time:**

| Option | Description | Selected |
|--------|-------------|----------|
| ContentPane captures + passes to Shell | handleAction calls getOffsets() and passes { type, anchorText, anchorStart, anchorEnd } to Shell via prop callback | ✓ |
| Shell owns getOffsets via imperative handle | useImperativeHandle forwarded from ContentPane | |

**Follow-up Q: When to recompute anchor Y:**

| Option | Description | Selected |
|--------|-------------|----------|
| useLayoutEffect on scroll + ResizeObserver | Subscribe to mainRef scroll + ResizeObserver; recompute on each event | ✓ |
| React render cycle only | Recompute in useLayoutEffect on every render | |

**Follow-up Q: Comment column scroll model:**

| Option | Description | Selected |
|--------|-------------|----------|
| Absolutely positioned inside tall scroll container | overflow: 'auto', bubbles with position: 'absolute', top: anchorY | ✓ |
| position: fixed | Viewport-relative fixed positioning | |

---

## sidenotes vs custom layout

| Option | Description | Selected |
|--------|-------------|----------|
| Evaluate sidenotes first, adopt if it fits | Research agent checks sidenotes@2.0.1 API against COMMENT-03; adopt if compatible | ✓ |
| Go custom (useCommentLayout hook) | Write a useCommentLayout pure function hook from scratch | |
| You decide | Leave to planner/implementer | |

**User's choice:** Evaluate sidenotes@2.0.1 first, adopt if it fits the model.

**Follow-up Q: If sidenotes doesn't fit:**

**User's response (free-text):** "then let's discuss this when it happens, once we know why it does not fit"
**Notes:** Fallback decision deferred to implementation time after knowing the specific failure mode.

**Follow-up Q: Where should sidenotes evaluation happen:**

| Option | Description | Selected |
|--------|-------------|----------|
| Research agent during research phase | gsd-phase-researcher reads sidenotes docs, findings in RESEARCH.md | ✓ |
| First plan in Phase 20 is a spike | Plan 20-01 installs sidenotes and tests API | |

---

## Annotation creation wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 20 wires stub minimally | handleAction dispatches to useAnnotations.addAnnotation with anchorText as comment content (no textarea); Phase 21 adds textarea form | ✓ |
| Phase 20 uses fixture annotations | Build/test sidebar against hardcoded fixtures; real wiring deferred to Phase 21 | |

**Follow-up Q: Where useAnnotations lives:**

| Option | Description | Selected |
|--------|-------------|----------|
| Lift to ReviewerV2Shell | Shell owns useAnnotations, passes addAnnotation to ContentPane and annotations to CommentPane | ✓ |
| React context | AnnotationContext provider wrapping 3-column body | |

**Follow-up Q: Shell-facing callback signature:**

| Option | Description | Selected |
|--------|-------------|----------|
| onAddAnnotation(type, anchorText, anchorStart, anchorEnd) | ContentPane passes individual args; Shell builds Annotation object | ✓ |
| onAddAnnotation(annotation: Omit<Annotation, 'id'>) | ContentPane assembles near-complete annotation object | |

---

## Hover state location

| Option | Description | Selected |
|--------|-------------|----------|
| Lift to ReviewerV2Shell as useState | Shell has hoveredCommentId / setHoveredCommentId; consistent with activeId pattern | ✓ |
| Add to useAnnotations reducer | Add 'hover' action and hoveredId field | |
| React context | AnnotationsProvider with hoveredCommentId | |

**Follow-up Q: Anchor text highlight mechanism for hoveredCommentId:**

| Option | Description | Selected |
|--------|-------------|----------|
| CSS Highlights API | CSS.highlights.set('comment-hover', new Highlight(range)); consistent with selection-lock highlight | ✓ |
| Absolutely-positioned sibling overlay div | Follows Phase 18 overlay pattern | |
| You decide | Leave to planner | |

**Follow-up Q: focusedCommentId location:**

| Option | Description | Selected |
|--------|-------------|----------|
| Lift to ReviewerV2Shell alongside hoveredCommentId | Shell has focusedCommentId / setFocusedCommentId | ✓ |
| Local state in CommentPane | focusedCommentId lives inside CommentPane | |

---

## Claude's Discretion

- Exact scroll listener approach (passive event listener vs. onScroll prop)
- Whether Map<id, y> position state lives in CommentPane or a dedicated useCommentPositions hook
- CSS details for compact vs expanded comment card states
- Whether sidenotes is installed as devDependency (evaluation) or runtime dependency (if adopted)

## Deferred Ideas

- **sidenotes fallback approach** — deferred until research phase reveals why sidenotes doesn't fit (if it doesn't)
- **Paragraph-hover → CommentPane interaction** — not in COMMENT-02 scope; deferred to Phase 21 or later
