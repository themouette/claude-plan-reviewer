# Roadmap: claude-plan-reviewer

## Overview

Three phases deliver the tool end-to-end. Phase 1 wires the complete approve/deny loop — Claude Code triggers the hook, the binary opens a browser, the user decides, JSON exits stdout. Phase 2 adds the annotation surface and code diff view so the deny message carries structured, actionable feedback. Phase 3 cross-compiles for all targets, signs macOS binaries, and ships a `curl | sh` installer from GitHub releases.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Hook & Review UI** - Core approve/deny loop wired end-to-end via ExitPlanMode hook
- [ ] **Phase 2: Annotations & Diff** - Structured feedback surface with text annotations and code diff view
- [ ] **Phase 3: Distribution** - Cross-platform binary release with curl | sh installer

## Phase Details

### Phase 1: Hook & Review UI
**Goal**: A developer can intercept a Claude Code plan in the browser and approve or deny it with structured JSON returned to Claude
**Depends on**: Nothing (first phase)
**Requirements**: HOOK-01, HOOK-02, HOOK-03, HOOK-04, HOOK-05, UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, CONF-01, CONF-02
**Success Criteria** (what must be TRUE):
  1. Running the binary with a valid ExitPlanMode JSON payload on stdin opens a browser tab with the rendered plan
  2. Pressing Enter in the browser approves the plan and writes a valid `behavior: allow` JSON to stdout, then the process exits cleanly
  3. Submitting a deny message in the browser writes a valid `behavior: deny` JSON with the message to stdout, then the process exits cleanly
  4. All diagnostic output (server URL, errors) goes to stderr — stdout contains only the final JSON object
  5. If the browser fails to open, the review URL is printed to stderr and the `--no-browser` flag skips auto-open entirely
**Plans:** 4 plans

Plans:
- [ ] 01-01-PLAN.md — Rust project scaffold with protocol types, CLI, stdin/stdout round-trip, comrak rendering
- [ ] 01-02-PLAN.md — axum HTTP server with decision pipeline, browser launch, timeout, clean exit
- [ ] 01-03-PLAN.md — React+TS+Vite frontend with Tailwind, full plan review UI, build.rs integration
- [ ] 01-04-PLAN.md — Wire embedded SPA into binary, end-to-end integration, human verification

**UI hint**: yes

### Phase 2: Annotations & Diff
**Goal**: A developer can annotate specific plan text and view the working-tree diff alongside the plan before deciding
**Depends on**: Phase 1
**Requirements**: ANN-01, ANN-02, ANN-03, ANN-04, ANN-05, DIFF-01, DIFF-02, DIFF-03
**Success Criteria** (what must be TRUE):
  1. User can select plan text in the browser and attach a comment, delete, or replace annotation
  2. User can add a global comment not anchored to any specific plan text
  3. On deny, all annotations are serialized as readable structured markdown in the `message` field Claude receives
  4. The working-tree git diff is displayed alongside the plan with unified-format syntax highlighting
**Plans**: TBD
**UI hint**: yes

### Phase 3: Distribution
**Goal**: Any developer can install the binary on macOS or Linux with a single `curl | sh` and wire it into Claude Code in under two minutes
**Depends on**: Phase 2
**Requirements**: DIST-01, DIST-02, DIST-03, DIST-04
**Success Criteria** (what must be TRUE):
  1. Pre-built binaries for darwin-arm64, darwin-x64, linux-musl-x64, and linux-musl-arm64 are published to GitHub releases
  2. `curl -fsSL https://.../install.sh | sh` installs the binary without requiring Rust, Node.js, or any other runtime
  3. The install script detects whether the install directory is on PATH and warns the user if not
  4. macOS binaries pass ad hoc Gatekeeper signing so the OS does not block execution on first run
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Hook & Review UI | 0/4 | Planned | - |
| 2. Annotations & Diff | 0/TBD | Not started | - |
| 3. Distribution | 0/TBD | Not started | - |
