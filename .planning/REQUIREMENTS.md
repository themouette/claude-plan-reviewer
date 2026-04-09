# Requirements: claude-plan-reviewer

**Defined:** 2026-04-09
**Core Value:** One `curl | sh` installs a working plan reviewer — no Node.js, no Bun, no workspace setup required.

## v1 Requirements

### Hook Integration

- [ ] **HOOK-01**: Binary reads Claude Code ExitPlanMode PermissionRequest JSON from stdin on invocation
- [ ] **HOOK-02**: Binary writes valid PermissionRequest decision JSON exclusively to stdout on exit
- [ ] **HOOK-03**: All diagnostic output goes to stderr only — stdout contains only the final JSON response
- [ ] **HOOK-04**: Binary exits cleanly within 3 seconds of decision submission
- [ ] **HOOK-05**: Binary self-terminates with a deny response before the Claude Code hook timeout (default 10 min) is reached

### Plan Review UI

- [ ] **UI-01**: Binary spawns a local HTTP server on an OS-assigned port (port 0) and opens the system browser
- [ ] **UI-02**: Plan markdown is rendered as formatted HTML in the browser (headings, lists, code blocks, tables)
- [ ] **UI-03**: User can approve the plan with a single action (keyboard: Enter)
- [ ] **UI-04**: User can deny the plan with a message
- [ ] **UI-05**: Browser tab shows a confirmation page and self-closes after decision is submitted
- [ ] **UI-06**: Binary prints the review URL to stderr in case the browser fails to open

### Annotations

- [ ] **ANN-01**: User can add a comment annotation (select text → attach note)
- [ ] **ANN-02**: User can add a delete annotation (mark plan text for removal)
- [ ] **ANN-03**: User can add a replace annotation (select text → provide replacement)
- [ ] **ANN-04**: User can add a global comment (overall note not anchored to specific text)
- [ ] **ANN-05**: Annotations are serialized as structured markdown in the deny `message` field

### Code Diff View

- [ ] **DIFF-01**: Binary reads the git diff of the working tree from the `cwd` field in hook stdin
- [ ] **DIFF-02**: Diff is displayed alongside the plan in the review UI
- [ ] **DIFF-03**: Diff view supports unified format with syntax highlighting

### Distribution

- [ ] **DIST-01**: Binary is distributed as pre-built platform binaries via GitHub releases (darwin-arm64, darwin-x64, linux-musl-x64, linux-musl-arm64)
- [ ] **DIST-02**: Install script installs the binary with a single `curl | sh` command
- [ ] **DIST-03**: Install script detects PATH and advises if install directory is not on PATH
- [ ] **DIST-04**: macOS binaries are ad hoc code-signed to satisfy Gatekeeper

### Configuration

- [ ] **CONF-01**: Hook is configured via a minimal `~/.claude/settings.json` snippet with `"matcher": "ExitPlanMode"`
- [ ] **CONF-02**: Binary accepts a `--no-browser` flag to skip browser open and print URL only

## v2 Requirements

### Advanced UX

- **UX-01**: Countdown timer in the review UI showing remaining time before hook timeout
- **UX-02**: Approve-with-comments — approve the plan while attaching notes Claude will see
- **UX-03**: Fast-approve mode — skip browser and auto-approve after N seconds (configurable)

### Plan History

- **HIST-01**: Plan revision history within a session — show previous versions when agent revises
- **HIST-02**: Archive of past plan decisions accessible via CLI

### Distribution

- **DIST-05**: Published to crates.io for `cargo install` installation
- **DIST-06**: Full Apple notarization for browser-downloaded macOS binaries

### Collaboration

- **SHARE-01**: Share plan review via URL (encrypted, 7-day auto-delete)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-agent platform support (Copilot, Gemini, etc.) | Claude Code only for v1; different hook protocols per platform |
| TUI (terminal UI) | Browser UI chosen for richer markdown/diff rendering |
| Image/screenshot attachments | Text covers 99% of cases; binary payload in JSON is complex |
| Insert annotation type | Replace + comment covers the use cases; position tracking adds complexity |
| "Annotate any file" command | Out of scope — this is a plan reviewer, not a general annotation tool |
| Real-time collaboration | Local-only; server infrastructure disproportionate for this tool |
| Line-level diff annotations | Significant complexity; plan-level annotations are sufficient for v1 |
| Cross-session annotation storage | In-memory per session only; no persistence needed |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HOOK-01 | Phase 1 | Pending |
| HOOK-02 | Phase 1 | Pending |
| HOOK-03 | Phase 1 | Pending |
| HOOK-04 | Phase 1 | Pending |
| HOOK-05 | Phase 1 | Pending |
| UI-01 | Phase 1 | Pending |
| UI-02 | Phase 1 | Pending |
| UI-03 | Phase 1 | Pending |
| UI-04 | Phase 1 | Pending |
| UI-05 | Phase 1 | Pending |
| UI-06 | Phase 1 | Pending |
| CONF-01 | Phase 1 | Pending |
| CONF-02 | Phase 1 | Pending |
| ANN-01 | Phase 2 | Pending |
| ANN-02 | Phase 2 | Pending |
| ANN-03 | Phase 2 | Pending |
| ANN-04 | Phase 2 | Pending |
| ANN-05 | Phase 2 | Pending |
| DIFF-01 | Phase 2 | Pending |
| DIFF-02 | Phase 2 | Pending |
| DIFF-03 | Phase 2 | Pending |
| DIST-01 | Phase 3 | Pending |
| DIST-02 | Phase 3 | Pending |
| DIST-03 | Phase 3 | Pending |
| DIST-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-09*
*Last updated: 2026-04-09 after roadmap creation*
