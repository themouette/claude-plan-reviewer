# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v0.1.0 — MVP

**Shipped:** 2026-04-10
**Phases:** 4 | **Plans:** 14 | **Tasks:** 24

### What Was Built

- **Phase 1**: Full ExitPlanMode hook loop — Rust binary parses stdin, renders plan via comrak, opens browser, returns `behavior: allow/deny` + annotations to stdout. React+TS+Vite frontend embedded via rust-embed/axum.
- **Phase 2**: Annotation surface (text selection → comment/delete/replace) and two-column code diff view (git2-powered, syntax highlighted). All annotations serialized into deny message.
- **Phase 3**: cargo-dist release pipeline — multi-target cross-compilation (darwin-arm64/x64, linux-musl-arm64/x64), codesign patch, `install.sh` with PATH detection, v0.1.0 release tag on GitHub.
- **Phase 4**: `install`/`uninstall`/`update` subcommands with `integration.rs` abstraction, dialoguer TUI picker, self_update from GitHub releases. Default hook-review behavior unchanged.

### What Worked

- **Wave-based parallel execution**: Each plan executed in an isolated worktree agent. Parallelism was sequential here (1 plan/wave) but the infrastructure is proven — Wave 1 artifacts flowed cleanly into Wave 2 via explicit `files_to_read` in agent prompts.
- **Integration abstraction design**: Defining `IntegrationSlug` enum and helper functions in Plan 01 before Plan 02 used them worked perfectly — no rework needed when wiring install/uninstall.
- **cargo-dist for distribution**: Generated the full release pipeline (multi-target CI matrix, shell installer, GitHub releases) with minimal config. The right tool for the job.
- **comrak for markdown**: GFM rendering with task lists and tables worked out of the box — no client-side JS rendering needed.

### What Was Inefficient

- **Worktree agents writing to main working tree**: Wave 1 and Wave 2 agents wrote to absolute main-tree paths alongside their worktree, causing merge conflicts requiring `git stash` before merge. The worktree isolation was partially bypassed by the agents using absolute paths.
- **REQUIREMENTS.md traceability not auto-updated**: Phases 3+4 requirements showed "Pending" in the traceability table at milestone completion — the `phase complete` CLI didn't update them. Required manual resolution at archive time.
- **Plan spec omitting reqwest feature**: Plan 04-01 omitted the `reqwest` feature flag required by `self_update`'s HTTP backend, causing 25 compile errors that the executor had to diagnose and self-correct.
- **Code review file extraction**: The SUMMARY.md extraction script in the code-review workflow failed to correctly parse the frontmatter (picked up `decisions:` entries as file paths). Had to fall back to git diff for file scoping.

### Patterns Established

- **Integration abstraction before subcommands**: Create the shared type system (enums, helper fns) in Wave 1 before Wave N implements the subcommands that use it. Prevents rework.
- **`--no-verify` for parallel worktree commits**: Parallel executor agents use `--no-verify` to avoid pre-commit hook lock contention; orchestrator validates hooks once post-wave.
- **Orchestrator owns STATE.md and ROADMAP.md**: Worktree agents skip these writes; orchestrator merges worktrees then updates shared artifacts in one pass.
- **`.tar.gz` not `.tar.xz`**: cargo-dist defaults to `.tar.xz` but `self_update`'s `archive-tar` feature requires `.tar.gz`. Set `unix-archive = ".tar.gz"` in `[workspace.metadata.dist]`.

### Key Lessons

1. **Agent absolute paths bypass worktree isolation** — Agents using absolute paths (e.g., `/Users/x/repo/src/file.rs`) write to the main working tree even when running in a worktree. The fix: agents should always use relative paths from their working directory.
2. **Specify all dependency features in plan specs** — Missing features (like `reqwest` for `self_update`) cause cascading compile failures. Plan specs should include full dependency feature lists, not just crate names.
3. **SUMMARY.md frontmatter extraction needs section boundary detection** — The YAML parser must reset `inSection` when encountering any top-level key (no leading indent), not just indented keys. Otherwise sibling sections like `decisions:` bleed into `key_files:` extraction.

### Cost Observations

- Model: claude-sonnet-4-6 throughout
- Sessions: ~6 (research, discuss, plan, execute phases 1-4, complete milestone)
- Notable: Phase 4 executed in ~1 hour wall-clock with 3 sequential worktree agents. Full MVP from zero to shipped in ~2 sessions.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v0.1.0 | 4 | 14 | Initial baseline — full GSD workflow from scratch |

### Cumulative Quality

| Milestone | Tests | Notes |
|-----------|-------|-------|
| v0.1.0 | 13 unit tests | integration.rs + git diff extraction |

### Top Lessons (Verified Across Milestones)

1. Worktree agents using absolute paths bypass isolation — always use relative paths in executor agents.
2. Plan specs must include full dependency feature lists to avoid executor self-correction cycles.
