# Requirements: claude-plan-reviewer

**Defined:** 2026-04-10
**Milestone:** v0.7.0 — Code Review
**Core Value:** One `curl | sh` installs a working plan reviewer — no Node.js, no Bun, no workspace setup required.

## v0.7.0 Requirements

Code review mode: inspect, navigate, and annotate agent-generated diffs before a PR, then return structured feedback to the agent.

### Diff Viewer

- [ ] **DIFF-01**: User can view a full branch diff (all changed files combined, vs main)
- [ ] **DIFF-02**: User can expand collapsed context lines within a diff hunk
- [ ] **DIFF-03**: User can toggle between unified and side-by-side layout
- [ ] **DIFF-04**: User can navigate directly to any changed file via a file list
- [ ] **DIFF-05**: User can select which commits to include in the current diff view

### Commit Navigation

- [ ] **COMMIT-01**: User can view a list of all commits in the current branch
- [ ] **COMMIT-02**: User can click a commit to view its individual diff
- [ ] **COMMIT-03**: User can switch between per-commit view and full branch diff mode
- [ ] **COMMIT-04**: User can navigate between commits with keyboard (prev/next)

### Inline Comments

- [ ] **COMMENT-01**: User can add a comment anchored to any diff hunk
- [ ] **COMMENT-02**: User can add a comment at the whole-file level
- [ ] **COMMENT-03**: User can edit or delete their own comments
- [ ] **COMMENT-04**: File list shows a comment count badge per file

### Review Submission

- [ ] **SUBMIT-01**: User can approve the review when no comments exist
- [ ] **SUBMIT-02**: User can include an optional global instruction when approving
- [ ] **SUBMIT-03**: User can submit with comments; structured feedback JSON returned to agent
- [ ] **SUBMIT-04**: Submitting "request changes" requires at least one comment

### Integration

- [ ] **INTEG-01**: User can invoke code review via a slash command
- [ ] **INTEG-02**: Agent can trigger code review automatically via a pre-PR hook
- [ ] **INTEG-03**: `plan-reviewer install` wires up slash command + hook; `uninstall` removes them

### Architecture

- [ ] **ARCH-01**: Code review viewer replaces the existing (unused) diff tab — prior diff code removed

## v0.6.0 Requirements (Shipped 2026-05-22)

All v0.6.0 requirements shipped. Archived for reference.

- [x] **LAYOUT-01**: New reviewer renders at root URL `/`; v1 codepath removed as of Phase 23
- [x] **LAYOUT-02**: Three-column shell: outline tree (left) / formatted markdown (center) / comment sidebar (right)
- [x] **OUTLINE-01**: Outline panel shows document heading hierarchy as a tree
- [x] **OUTLINE-02**: Clicking an outline item scrolls the corresponding heading into view
- [x] **OUTLINE-03**: Active section tracking — heading closest to viewport top highlighted in outline
- [x] **OUTLINE-04**: Per-section comment count badges in the outline tree
- [x] **CONTENT-01**: Markdown rendered as formatted HTML with GFM support
- [x] **CONTENT-02**: Paragraph hover highlight + comment gutter icon
- [x] **CONTENT-03**: Text selection → comment toolbar anchored to selection
- [x] **COMMENT-01**: Comment sidebar with floating alignment to anchor text
- [x] **COMMENT-02**: Bidirectional hover cross-highlight (comment ↔ anchor text)
- [x] **COMMENT-03**: Overlap/collapse handling — focused card rises, all reachable by scroll
- [x] **COMMENT-04**: Quick actions: comment / delete / replace + expandable predefined menu
- [x] **COMMENT-05**: Edit (pencil) and delete (×) on each comment bubble
- [x] **SUBMIT-01**: Approve vs. ask-for-changes with validation gates
- [x] **SUBMIT-02**: Clipboard fallback (degraded mode) preserved
- [x] **ARCH-01**: Reviewer code isolated under `ui/src/reviewer-v2/`; coupling direction enforced
- [x] **ARCH-02**: Reviewer owns its own heartbeat/connectivity detection
- [x] **TEST-01**: Regression test suite covers existing annotation flow
- [x] **TEST-02**: jsdom mocks for IntersectionObserver, ResizeObserver, CSS.highlights
- [x] **TEST-03**: ESLint no-restricted-imports enforces ARCH-01 coupling constraint

## Future Requirements

- **ANNOT-F-01**: Ask-from-UI — select text, type a question, stream AI response inline
- **ANNOT-F-02**: Per-comment color coding (multi-reviewer)
- **ANNOT-F-03**: Threaded comment replies
- **INTEG-F-01**: Gemini CLI integration — full hook install/uninstall
- **INTEG-F-02**: Integration test harness — `--no-browser`/`--port` flags + `assert_cmd`-based tests
- **DOCS-F-01**: README install/usage guide and per-integration wiring docs

## Out of Scope

| Feature | Reason |
|---------|--------|
| URL sharing / team collaboration | Not needed for local-only use case |
| Real-time multi-user sync | Deferred; local-only for now |
| Mobile / native app | Web-first, browser tab is correct UX |
| TUI (terminal UI) | Browser UI chosen for rich rendering |
| AI-assisted code suggestions in review UI | Deferred to future milestone |
| `@recogito/react-text-annotator` | Incompatible data model for sidebar approach |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DIFF-01 | TBD | Pending |
| DIFF-02 | TBD | Pending |
| DIFF-03 | TBD | Pending |
| DIFF-04 | TBD | Pending |
| DIFF-05 | TBD | Pending |
| COMMIT-01 | TBD | Pending |
| COMMIT-02 | TBD | Pending |
| COMMIT-03 | TBD | Pending |
| COMMIT-04 | TBD | Pending |
| COMMENT-01 | TBD | Pending |
| COMMENT-02 | TBD | Pending |
| COMMENT-03 | TBD | Pending |
| COMMENT-04 | TBD | Pending |
| SUBMIT-01 | TBD | Pending |
| SUBMIT-02 | TBD | Pending |
| SUBMIT-03 | TBD | Pending |
| SUBMIT-04 | TBD | Pending |
| INTEG-01 | TBD | Pending |
| INTEG-02 | TBD | Pending |
| INTEG-03 | TBD | Pending |
| ARCH-01 | TBD | Pending |

**Coverage:**
- v0.7.0 requirements: 21 total
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 21 ⚠️

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-05-23 — v0.7.0 requirements defined*
