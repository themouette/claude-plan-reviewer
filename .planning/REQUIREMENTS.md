# Requirements: claude-plan-reviewer

**Defined:** 2026-04-10
**Milestone:** v0.6.0 — Markdown Annotator v2
**Core Value:** One `curl | sh` installs a working plan reviewer — no Node.js, no Bun, no workspace setup required.

## v0.6.0 Requirements

New 3-column annotation reviewer built alongside the existing UI, architecturally isolated for eventual deletion of the existing view.

### Layout

- [ ] **LAYOUT-01**: New reviewer renders at `/v2` in a browser tab alongside the existing reviewer (no Rust changes — existing `FallbackBehavior::Ok` routes `/v2` to `index.html`)
- [ ] **LAYOUT-02**: Three-column shell: outline tree (left) / formatted markdown (center) / comment sidebar (right)

### Outline

- [ ] **OUTLINE-01**: Outline panel shows document heading hierarchy as a tree (not accordion); each item reflects its heading depth via indentation
- [ ] **OUTLINE-02**: Clicking an outline item scrolls the corresponding heading to the top of the content pane via `scrollIntoView` — no browser history change, no anchor link navigation
- [ ] **OUTLINE-03**: The heading closest to the top of the content viewport is highlighted in the outline and scrolled into view in the outline panel as the user scrolls (active section tracking)
- [ ] **OUTLINE-04**: Each outline item displays the count of comments whose anchor falls within that section; a comment spanning multiple sections counts only under the first section

### Content Pane

- [ ] **CONTENT-01**: Markdown content renders as formatted HTML with GFM support (tables, task lists, strikethrough) using `react-markdown` + `remark-gfm` + `rehype-highlight`
- [ ] **CONTENT-02**: Hovering a paragraph shows a subtle background highlight and a `+` comment gutter icon on the right edge of the paragraph (overlapping the comment column boundary)
- [ ] **CONTENT-03**: Selecting text replaces the paragraph hover highlight with a selection highlight and shows a comment toolbar anchored to the selection; text selection serializes to character offsets (not DOM paths)

### Comment Sidebar

- [ ] **COMMENT-01**: Comments appear in the right sidebar floating at the vertical level of their anchor text; as the content pane scrolls, comments follow so the anchor text and comment remain visually aligned; if comments would overflow below the last line of content, the content area extends to accommodate
- [ ] **COMMENT-02**: Hovering a comment highlights the corresponding anchor text in the content pane; hovering anchor text highlights the corresponding comment bubble — bidirectional, shared `hoveredCommentId` state
- [ ] **COMMENT-03**: When comments overlap, non-focused cards are shown in compact (2-line preview) form; the focused card expands to full height and snaps to its anchor Y; all comments remain reachable by scroll; the last clicked comment is on top; evaluate `sidenotes@2.0.1` as the implementation before rolling a custom `useCommentLayout` hook
- [ ] **COMMENT-04**: Three quick actions available on text selection or paragraph hover: **Comment** (opens textarea), **Delete** (opens textarea pre-filled with "Delete"), **Replace** (opens textarea pre-filled with "Replace"); an expandable menu reveals predefined actions — "Clarify this", "Needs test", "Give me an example", "Out of scope", "Search the web", "Search codebase" — each opens a textarea pre-filled with the action label
- [ ] **COMMENT-05**: Each submitted comment bubble has edit (pencil icon) and delete (× icon) buttons; edit reopens the textarea for inline editing; delete removes the comment with no confirmation

### Review Submission

- [ ] **SUBMIT-01**: Submit bar has "Approve" (disabled when any comment exists) and "Ask for changes" (disabled when no comments exist); "Ask for changes" allows an optional free-text overall message; submission returns the same JSON format as the existing reviewer
- [ ] **SUBMIT-02**: When the server is unreachable (offline/degraded mode), submission uses the clipboard fallback — clipboard JSON format is identical to the server response; the existing `buildClipboardPayload` and `shouldUseClipboard` utilities are reused, not reimplemented

### Architecture & Isolation

- [ ] **ARCH-01**: All new reviewer code lives under `ui/src/reviewer-v2/`; no file outside `reviewer-v2/` imports from within it (coupling direction: existing view may import shared utilities from `reviewer-v2/`, never vice versa)
- [ ] **ARCH-02**: The new reviewer owns its own heartbeat/connectivity detection via `useHeartbeat` — no dependency on `App.tsx` internal state or imported state from the existing component tree

### Tests & Regression Safety

- [x] **TEST-01**: Regression test suite covers the existing annotation flow (App.tsx review → approve/deny/annotate cycle) with zero regressions introduced by the `/v2` routing change in `main.tsx`
- [ ] **TEST-02**: `vitest.setup.ts` includes jsdom mocks for `IntersectionObserver`, `ResizeObserver`, and `CSS.highlights` before any v2 component code is written
- [ ] **TEST-03**: An ESLint rule (`no-restricted-imports` or equivalent) enforces the ARCH-01 coupling constraint automatically — violation is a lint error, not just a convention

## Future Requirements

### Annotation Enhancements

- **ANNOT-F-01**: Ask-from-UI — select text, type a question, stream AI response inline
- **ANNOT-F-02**: Per-comment color coding (multi-reviewer)
- **ANNOT-F-03**: Threaded comment replies

### Integrations (deferred from v0.3.0)

- **INTEG-F-01**: Gemini CLI integration — full hook install/uninstall via `plan-reviewer install gemini`
- **INTEG-F-02**: Integration test harness — `--no-browser`/`--port` flags + `assert_cmd`-based hook/install/server tests
- **ANNOT-F-04**: Annotation quick-actions from v0.3.0 plan — predefined chips, light/dark theme (superseded by v0.6.0 implementation)
- **DOCS-F-01**: README install/usage guide and per-integration wiring docs

## Out of Scope

| Feature | Reason |
|---------|--------|
| Migrating existing annotations to v2 format | Existing format stays until v2 is proven; no migration needed for plan review use case |
| URL sharing / team collaboration | Not needed for local-only use case |
| Real-time multi-user sync | Deferred; local-only for now |
| Mobile / native app | Web-first, browser tab is correct UX |
| TUI (terminal UI) | Browser UI chosen for rich rendering |
| `react-diff-view` | Brief explicitly excluded it; diff rendering stays in existing Tab |
| `@recogito/react-text-annotator` (React wrapper) | Incompatible data model; sidebar model differs from its popup model — use plain `@recogito/text-annotator` for anchor serialization inspiration only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAYOUT-01 | Phase 17 | Pending |
| LAYOUT-02 | Phase 17 | Pending |
| OUTLINE-01 | Phase 19 | Pending |
| OUTLINE-02 | Phase 19 | Pending |
| OUTLINE-03 | Phase 19 | Pending |
| OUTLINE-04 | Phase 21 | Pending |
| CONTENT-01 | Phase 18 | Pending |
| CONTENT-02 | Phase 18 | Pending |
| CONTENT-03 | Phase 18 | Pending |
| COMMENT-01 | Phase 20 | Pending |
| COMMENT-02 | Phase 20 | Pending |
| COMMENT-03 | Phase 20 | Pending |
| COMMENT-04 | Phase 21 | Pending |
| COMMENT-05 | Phase 21 | Pending |
| SUBMIT-01 | Phase 22 | Pending |
| SUBMIT-02 | Phase 22 | Pending |
| ARCH-01 | Phase 17 | Pending |
| ARCH-02 | Phase 17 | Pending |
| TEST-01 | Phase 23 | Complete |
| TEST-02 | Phase 17 | Pending |
| TEST-03 | Phase 17 | Pending |

**Coverage:**
- v0.6.0 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-05-19 after v0.6.0 roadmap creation (Phases 17-23)*
