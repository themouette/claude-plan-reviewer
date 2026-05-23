# Feature Landscape

**Domain:** Rich document annotation UI — v0.6.0 Markdown Annotator v2
**Researched:** 2026-05-19
**Confidence:** HIGH for UX patterns (cross-validated across Google Docs, GitHub PR review, Hypothesis, academic/patent literature); MEDIUM for complexity estimates (no direct implementation measurements)

> This document supersedes the v0.5.0 feature research for this milestone.
> Earlier research is preserved in git history.

---

## Context: What Already Exists (Do Not Re-Research)

Built in earlier milestones — treat as fixed:

- Browser-based plan review UI (approve/deny/annotate) — v0.1.0
- Text selection and annotation serialization (`comment`, `delete`, `replace` types) — v0.1.0
- Annotation quick-action chips (6 predefined), persistent theme switcher — v0.4.0
- Offline clipboard fallback (clipboard export, banner, heartbeat) — v0.5.0
- `/plan-reviewer:annotate` slash command with paste fallback — v0.4.0/v0.5.0

**This milestone's goal:** A new, parallel 3-column annotation reviewer UI component.
No backwards code coupling to existing view (existing may import new; never vice versa).

---

## The Five UX Patterns Under Study

### Pattern 1: Anchored Comments That Float at Text Level

**What the reference products do:**

- **Google Docs** (gold standard): Each comment bubble in the right sidebar maintains a
  vertical position aligned to the anchor text. When the focused comment changes, Google
  re-flows all visible comments: the selected comment snaps to its anchor's Y-coordinate,
  and other comments are pushed up/down as needed. Internally tracked via a proprietary
  `kix.*` anchor ID system.
- **Hypothesis**: Comments live in a right-side drawer. The drawer is always visible.
  When you click an annotation highlight in the body, the corresponding comment card in
  the drawer scrolls into view and is highlighted.
- **GitHub PR review (new docked panel, March 2026)**: Inline comments sit directly
  below the diff line they annotate. A separate docked "Comments" panel shows all
  comments in thread order but lacks per-line vertical alignment — community feedback
  identifies this as the key ergonomic gap.

**Core algorithm:** Greedy top-to-bottom placement.
1. Compute each comment's natural Y (= Y-coordinate of its anchor text in the document).
2. Sort comments by natural Y ascending.
3. Place first comment at its natural Y.
4. For each subsequent comment: place at `max(naturalY, previousBottom + gap)`.
5. On focus change: re-run placement with focused comment given priority at its exact anchor Y.

This is the well-known "interview scheduling / interval non-overlap" approach applied
to vertical layout. It is O(n log n) and fast enough for any realistic document.

**Implementation note for React:** Each comment card needs a `top` value in pixels set
via `style={{ top: computedY }}` inside a `position: relative` sidebar container.
The document's center pane and the comment sidebar must share the same scroll container
(or scroll together), otherwise the Y-coordinate mapping breaks.

---

### Pattern 2: Comment Overlap / Collapse

**What the reference products do:**

- **Google Docs**: Non-focused comments are fully visible but may be pushed down by the
  greedy algorithm. There is no "collapse" — they remain readable but displaced.
  When you click a comment, it animates to snap to anchor Y while others make room.
- **GitHub PR review**: Inline comments are always fully expanded. No overlap possible
  (they push the diff lines apart). The new docked panel collapses threads to a summary
  preview with unread counts.
- **Figma**: The focused comment expands to show the full thread; unfocused comments
  show a compact card (author avatar + first ~100 chars). Clicking a compact card
  expands it and collapses the previous focused card. This is the "accordion-in-sidebar"
  pattern.

**Practical recommendation for this project:**

Use the Figma model (compact vs expanded) rather than the Google Docs model (all full-height).
Rationale: plans can generate many comments on a short section. Full-height all-visible leads to
comments displaced far below their anchors, which severs the visual connection.

- **Expanded** (focused): full comment text, edit/delete icons, quick-action chips visible.
- **Compact** (non-focused): author label + first line of comment + anchor snippet.
  Max height ~2 lines. Click to expand.
- **Focused comment** rises to snap to anchor Y. Non-focused compact cards stack below.
- **All comments remain in the sidebar**, only height changes — no hiding. Users can
  scroll the sidebar to reach displaced compact cards.

---

### Pattern 3: Hover Linking Between Comment and Text

**What the reference products do:**

- **Google Docs**: Hover over a comment card → the corresponding highlight in the document
  body brightens. Hover over highlighted text → the comment card is highlighted in the sidebar.
  Same accent color used for both sides of the pair. Color is per-comment (each comment thread
  has its own color).
- **Hypothesis**: Click a highlight → the annotation card scrolls into view and is highlighted.
  There is no pure hover linking (click-based, not hover-based). Sidebar is always open.
- **Patent prior art (USPTO #11030395 "Top-align comments: just-in-time highlights and
  automatic scrolling")**: When comments enter the viewport, their paired anchor highlights
  are shown. When a "significant annotation" is focused, both the annotation and its anchor
  are highlighted with the same color.

**Implementation:**

Use a shared React state `hoveredCommentId: string | null`. Both the content pane and
the sidebar pane read this state.
- Content pane: `<mark>` or `<span>` with highlight class — adds `--highlight-active`
  class when `hoveredCommentId === comment.id`.
- Sidebar pane: comment card — adds `--card-active` class when `hoveredCommentId === comment.id`.
Both `onMouseEnter`/`onMouseLeave` on both sides set/clear `hoveredCommentId`.
No extra scroll-into-view needed for hover — only for click (which also focuses the comment).

**Color strategy:** All highlights use the same single accent color (this is a single-user
review tool, not multi-author collab). No per-comment color needed. This simplifies CSS.

---

### Pattern 4: Outline / TOC with Scroll Sync

**What the reference products do:**

- **Virtually all long-form doc editors** (Notion, Confluence, GitBook, most markdown preview
  tools): sticky left-panel TOC, active section highlighted as you scroll, click scrolls to
  section with `behavior: 'smooth'`.

**Standard implementation pattern (HIGH confidence — multiple verified sources):**

1. Parse headings from rendered HTML via `document.querySelectorAll('h1,h2,h3,h4,h5,h6')`.
2. Build a tree structure using heading level (H1 > H2 > H3 nesting).
3. Assign IDs to each heading (`id="slug-of-heading-text"`) — comrak can emit these.
4. Use `IntersectionObserver` on all heading elements with `rootMargin: '0% 0% -60% 0%'`
   to detect which heading is "at the top" of the viewport.
5. Active heading = the last heading whose top has crossed the 40% viewport mark.
6. TOC item gets `aria-current="true"` / `.active` class when its heading is active.
7. Click TOC item → `document.getElementById(id).scrollIntoView({ behavior: 'smooth' })`.

**Per-section comment count badges:**

- The TOC tree must know how many comments exist per heading section.
- A section spans from its heading to the next same-or-higher-level heading.
- Compute by checking each comment's `anchorHeadingId` (the nearest parent heading
  whose Y-coordinate is at or above the anchor's Y).
- Badge: a small pill `(3)` next to the heading text. Zero-count badges should be hidden,
  not shown as `(0)` — empty badges are noise.

**Edge cases:**
- Long sections where the heading scrolls off screen: the active section remains highlighted
  in the TOC until the next heading becomes active.
- Headings without ID (if comrak is not configured to emit IDs): fall back to generating
  IDs from heading text client-side.

---

### Pattern 5: Text Selection Toolbar

**What the reference products do:**

- **Google Docs**: Selection toolbar appears above the selection with formatting options.
  For commenting: a "+" / speech-bubble icon → opens the comment input sidebar.
- **Hypothesis**: Selection triggers a small "Annotate" / "Highlight" adder button floating
  near the selection.
- **GitHub PR review**: Line-click triggers a "+" button on the gutter; no text-selection
  toolbar per se.

**Standard implementation pattern (HIGH confidence — Floating UI, Tiptap, Material Design):**

1. Listen for `document.addEventListener('selectionchange')` or `mouseup` on the content pane.
2. Call `window.getSelection()` — if selection is non-empty and within the content pane:
   - Call `selection.getRangeAt(0).getBoundingClientRect()` to get the selection bounding box.
   - Position the toolbar above the selection (`bottom: window.innerHeight - rect.top + offset`).
   - Use `flip()` and `shift()` middleware (Floating UI) to handle viewport overflow.
3. Toolbar shows 3 primary actions: **Comment** / **Delete** / **Replace** (matching existing
   annotation types). An expandable `...` reveals predefined action chips.
4. On action click: toolbar closes, comment input appears anchored to the selection.
5. Toolbar hides on: `selectionchange` to empty, click outside, Escape key.

**Serializing the anchor:**

The selection must be serializable for persistence in the annotation JSON payload.
Use text-offset-based serialization (like `lakenen/serialize-selection`) rather than
DOM-path serialization (brittle across re-renders). Store:
```json
{
  "anchorStart": 1452,
  "anchorEnd": 1487,
  "anchorText": "the selected text for verification"
}
```
`anchorStart`/`anchorEnd` are character offsets from the start of the rendered markdown
text content (not HTML). The `anchorText` serves as a verification checksum — if the
document changes and offsets shift, display the comment as "orphaned" rather than misplacing it.

**Paragraph hover (complementary to text selection):**

When no text is selected, hovering a paragraph/block shows a subtle `+` gutter icon
(left of the block) to trigger a paragraph-level comment. This is simpler than text
selection (no range needed — the anchor is the entire paragraph block) and provides
a fast path for "this whole section needs work" comments.

---

## Table Stakes

Features users of annotation review UIs expect. Missing = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Comments float at anchor text vertical level | Every reference product (Google Docs, Hypothesis) anchors comments to text Y-position; arbitrary sidebar ordering is disorienting | MEDIUM | Greedy placement algorithm; shared scroll container between center and sidebar panes |
| Hover on comment highlights corresponding text | Cross-product expectation; severs usability without it — you lose context of what a comment refers to | LOW | Shared `hoveredCommentId` state; CSS class toggle; no scroll-into-view on hover |
| Hover on highlight activates comment card | Bidirectional — hover on text → sidebar card lights up | LOW | Same state, opposite direction; `onMouseEnter` on `<mark>` elements |
| Click-to-scroll from TOC to heading | Universal in long-form doc tools; expected for any document with headings | LOW | `scrollIntoView({ behavior: 'smooth' })` |
| Active section highlighted in TOC | Present in Notion, Confluence, GitBook, GitHub markdown preview; absence feels incomplete | LOW | `IntersectionObserver` on headings |
| Text selection triggers comment toolbar | Hypothesis, Google Docs, most annotation tools; users expect to select text and comment | MEDIUM | `selectionchange` + `getBoundingClientRect` + Floating UI positioning |
| Non-focused comments collapse to compact view | Required for density management when many comments exist on short sections | MEDIUM | Focused/compact card states; smooth height transition |
| Comment edit / delete via card icons | Expected: pencil icon edits, X icon removes — standard for all comment UIs | LOW | Per-card icon buttons; edit enters inline editing mode |
| Approve / ask-for-changes distinction with validation | GitHub PR review pattern: can't approve with open comments; can't ask-for-changes without comments | LOW | Button state guards; mirrors existing hook protocol |
| Clipboard fallback in degraded mode | Already exists in v0.5.0; must be preserved on the new reviewer | LOW | Port existing logic; no new complexity |
| Regression tests for existing annotation flow | Non-regression expectation when introducing a new parallel component | MEDIUM | Vitest tests covering existing `serializeAnnotations`, annotation types, clipboard path |

---

## Differentiators

Features not expected but that meaningfully improve this specific use case (single-user
AI plan review, not collaborative authoring).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-section comment count badges in TOC | Lets reviewer see at a glance which sections need work without scrolling; no reference product does this for the TOC specifically | LOW-MEDIUM | Compute per-heading comment counts; update reactively as comments are added/removed |
| Expandable predefined-action menu | Quick path for common plan annotations (comment / delete / replace + predefined chips) without free-text typing; reduces friction vs bare text field | LOW | Already exists in v0.1.0; migrate to new reviewer |
| Paragraph-level hover trigger (gutter `+` icon) | Allows whole-block annotation without text selection drag; faster for "delete this whole paragraph" actions | LOW | `onMouseEnter` on each rendered block → show gutter icon |
| Focused comment snaps to anchor Y with animation | Google Docs does this; competitors rarely do; creates strong visual connection between clicking a comment and understanding where it lives in the document | MEDIUM | CSS transition on `top` property; re-run placement algo on focus change |
| Orphaned comment detection | If anchor text changes (edge case: plan was already truncated), show comment as "anchor not found" rather than silently misplacing it | MEDIUM | Verify `anchorText` checksum on load; render orphaned state |
| Architectural isolation (no backwards coupling) | Enables safe deletion of old view later without risk to new component; clean slate design | LOW (discipline) | ESLint import rules; no shared mutable state between old and new component trees |

---

## Anti-Features

Features to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Per-comment color coding | Unnecessary complexity for a single-user tool; multi-color highlighting requires CSS variable management per comment and increases visual noise | Single accent color for all highlights; focused/unfocused state communicated by opacity/weight |
| Modal dialogs for comment input | Modals interrupt flow and lose scroll position context; the annotation appears disconnected from the anchor text | Inline comment input anchored in the sidebar at the comment's position |
| Full-height all-visible comments (Google Docs approach) | In a tool reviewing short markdown plans, many comments on adjacent lines causes all non-focused comments to be pushed far below their anchors, breaking the spatial mapping | Compact/expanded card model (Figma approach) |
| Comment threading / replies | Multi-turn annotation threads are unnecessary overhead for a single-user plan review; they add UI complexity and a data model change with no benefit | Single-level comments only; edit-in-place replaces threading |
| Drag-to-reorder comments | Comments are anchored to text positions; reordering implies re-anchoring which is complex and unnecessary | Comments are always ordered by anchor Y-position |
| Real-time multi-user collab | Out of scope per PROJECT.md; adds infrastructure requirements (WebSocket, CRDT) that conflict with single-binary constraint | Local-only; single user |
| Sharing / exporting as HTML | Not part of the hook protocol; adds complexity with no benefit for the review→JSON→Claude loop | JSON output only, via existing `POST /api/decide` or clipboard fallback |
| Comment visibility toggles (public/private) | Hypothesis has these for multi-user; meaningless for single-user local tool | No visibility controls |
| Inline markdown editing | This is a reviewer, not an editor; modifying the plan text blurs the reviewer's role and breaks the read-only → annotate → approve/deny flow | Display-only markdown; all feedback via comments |
| IntersectionObserver with `threshold: 1.0` for TOC | `threshold: 1.0` only fires when the element is fully visible — headings at the top of viewport are rarely fully visible. Causes TOC active section to lag | Use `rootMargin: '0% 0% -60% 0%'` with `threshold: 0` for reliable active-section detection |
| DOM-path anchor serialization | Fragile: breaks whenever React re-renders or the markdown is re-processed; causes misplaced or orphaned comments on reload | Text-offset serialization with `anchorText` checksum verification |

---

## Feature Dependencies

```
Text Selection → Anchor Serialization → Comment Creation
    └──depends on──> content pane renders markdown as HTML with stable block structure
    └──depends on──> comrak emits heading IDs (needed for section-level anchor resolution)
    └──produces──> { anchorStart, anchorEnd, anchorText } stored in comment object

Comment Positioning (greedy algorithm)
    └──depends on──> center pane and sidebar sharing scroll coordinate space
    └──depends on──> each comment having an anchorStart offset
    └──depends on──> DOM: can call getBoundingClientRect on the anchor text range

Hover Linking
    └──depends on──> comment has an anchor range (for highlight rendering in content pane)
    └──depends on──> shared React state (hoveredCommentId)
    └──independent from──> comment positioning algorithm (different concern)

TOC Tree
    └──depends on──> comrak emits heading IDs
    └──depends on──> comment objects know which heading section they belong to
    └──drives──> per-section comment count badges (reactive, updates on comment add/remove)
    └──drives──> active section highlight (via IntersectionObserver)

Compact/Expanded Card Model
    └──depends on──> focusedCommentId state
    └──triggers──> re-run greedy placement on focus change
    └──animation──> CSS transition on top (pixels); height collapses via max-height transition

Approve / Ask-for-Changes Validation
    └──approve disabled when──> comments.length > 0
    └──ask-for-changes disabled when──> comments.length === 0
    └──clipboard fallback──> same existing logic, triggered by isOffline state

Regression Tests (TEST-01)
    └──covers──> existing annotation serialization (serializeAnnotations)
    └──covers──> existing annotation types (comment, delete, replace)
    └──covers──> clipboard export path
    └──must pass before──> new reviewer component is merged

Architecture Isolation (ARCH-01)
    └──new reviewer component──> may use shared utilities (serializeAnnotations, types)
    └──existing view──> may import from new reviewer component (allowed)
    └──new reviewer──> must NOT import from existing view (enforced)
    └──enforcement method──> ESLint no-restricted-imports or directory-level rule
```

---

## MVP for v0.6.0

### Build (Required for Milestone)

1. **LAYOUT-01** — 3-column layout shell rendered in a new browser route alongside existing
2. **OUTLINE-01** — Heading tree with click-to-scroll and IntersectionObserver active section
3. **OUTLINE-02** — Per-section comment count badges
4. **CONTENT-01** — Markdown rendered as formatted HTML via existing comrak pipeline
5. **CONTENT-02** — Paragraph hover gutter icon → comment toolbar trigger
6. **CONTENT-03** — Text selection → floating comment toolbar (3 quick actions + expandable menu)
7. **COMMENT-01** — Sidebar scrolls with content; greedy placement; comments float at anchor Y
8. **COMMENT-02** — Hover linking: comment ↔ highlight, bidirectional
9. **COMMENT-03** — Compact/expanded card states; focused comment snaps to anchor Y
10. **COMMENT-04** — Quick actions (comment/delete/replace) + expandable predefined chips
11. **COMMENT-05** — Edit (pencil) / delete (X) per comment card
12. **SUBMIT-01** — Approve vs ask-for-changes with validation gates
13. **SUBMIT-02** — Clipboard fallback preserved on new reviewer
14. **TEST-01** — Regression test suite for existing annotation flow
15. **ARCH-01** — Architectural isolation enforced (no backwards imports)

### Defer

- Per-comment color coding — single accent color sufficient
- Orphaned comment detection — can be added as polish in a follow-on milestone
- Ask-from-UI (AI inline response) — listed in PROJECT.md as "Future"

---

## Complexity Assessment

| Feature / Phase | Estimated Effort | Confidence | Key Risk |
|----------------|-----------------|------------|----------|
| 3-column layout shell | XS | HIGH | None — standard CSS grid/flexbox |
| Heading tree + IntersectionObserver | S | HIGH | Edge case: very long sections where heading scrolls far off screen |
| Per-section comment count badges | S | MEDIUM | Requires mapping comment anchor offsets to heading sections |
| Markdown HTML rendering | XS | HIGH | comrak already integrated; route it to new component |
| Paragraph hover gutter icon | S | HIGH | `onMouseEnter` on block elements; show/hide gutter button |
| Text selection toolbar + Floating UI positioning | M | MEDIUM | Viewport overflow handling; selection coordinate mapping |
| Anchor serialization (text offset) | S | MEDIUM | Must survive React re-renders; verify checksum on restore |
| Greedy comment placement algorithm | M | HIGH | Straightforward algorithm; trickiest part is coordinate space sync |
| Compact/expanded card states + animation | S | HIGH | CSS max-height transition is well-known |
| Hover linking (bidirectional) | S | HIGH | Shared state; straightforward |
| Focused comment snap to anchor Y | S | MEDIUM | Requires re-running placement on focus change |
| Edit/delete per card | S | HIGH | Standard form-in-place pattern |
| Approve/ask-for-changes validation | XS | HIGH | Already designed in v0.1.0; port to new reviewer |
| Clipboard fallback | XS | HIGH | Copy existing v0.5.0 logic |
| Regression tests | M | MEDIUM | Depends on what is currently tested; need to audit |
| Arch isolation enforcement | S | HIGH | ESLint rule is cheap; requires discipline |
| **Total** | **~2–3 sprints** | MEDIUM | Greedy placement + scroll coordinate sync is the highest-complexity single piece |

---

## Sources

| Source | Confidence | Used For |
|--------|------------|----------|
| https://blog.logrocket.com/create-table-contents-highlighting-react/ | HIGH | TOC IntersectionObserver implementation pattern |
| https://css-tricks.com/sticky-table-of-contents-with-scrolling-active-states/ | HIGH | rootMargin for active-section detection |
| https://floating-ui.com/docs/computeposition | HIGH | Text selection toolbar positioning, flip/shift middleware |
| https://tiptap.dev/docs/ui-components/utils-components/floating-element | HIGH | FloatingElement React component for selection toolbar |
| https://github.com/lakenen/serialize-selection | MEDIUM | Text-offset selection serialization approach |
| https://discuss.prosemirror.net/t/vertically-align-sidebar-blocks-to-content/4775 | MEDIUM | Greedy placement algorithm for sidebar comment positioning |
| https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/tr-2000-95.pdf | MEDIUM | Robust annotation anchoring (keyword + offset approach) |
| https://www.figma.com/blog/behind-the-feature-figma-community-comments/ | MEDIUM | Focused/compact comment card model; expand/collapse animation |
| https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11030395 | LOW | Bidirectional highlight pattern ("significant annotation") |
| https://tomcritchlow.com/2019/02/12/annotations/ | MEDIUM | UX comparison: Hypothesis vs Genius vs Google Docs; table-stakes vs differentiator patterns |
| https://web.hypothes.is/help/hypothesis-comments-mode/ | MEDIUM | Anchor types (text-anchored vs page-note); sidebar always-open pattern |
| https://github.blog/changelog/2026-03-19-view-code-and-comments-side-by-side-in-pull-request-files-changed-page/ | HIGH | GitHub docked panel pattern; inline vs sidebar trade-off |
| https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request | HIGH | Approve / Request Changes / Comment validation model |

---

*Feature research for: AI coding-agent plan reviewer (v0.6.0 — Markdown Annotator v2)*
*Researched: 2026-05-19*
