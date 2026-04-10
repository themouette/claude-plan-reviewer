# Phase 3: Distribution - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship pre-built binaries for darwin-arm64, darwin-x64, linux-musl-x64, and linux-musl-arm64 to GitHub Releases. Provide a `curl | sh` installer that drops the binary into `~/.local/bin`, calls `plan-reviewer install` to wire the Claude Code hook, and warns if the install directory is not on PATH. macOS binaries are ad hoc code-signed. Phase 3 also adds the `install` subcommand (Claude Code only) as groundwork for Phase 4's multi-integration support.

</domain>

<decisions>
## Implementation Decisions

### Release Automation
- **D-01:** Use cargo-dist for cross-compilation and release automation. It generates GitHub Actions CI, builds all four targets, uploads binaries to GitHub Releases, and produces a hosted `install.sh`. Uses the built-in `GITHUB_TOKEN` — no new secrets or auth required.
- **D-02:** Targets: `aarch64-apple-darwin`, `x86_64-apple-darwin`, `x86_64-unknown-linux-musl`, `aarch64-unknown-linux-musl`. The `vendored-libgit2` feature already ensures fully static Linux builds.

### Binary Name
- **D-03:** The installed binary is named `plan-reviewer`. Cargo.toml gets a `[[bin]]` section with `name = "plan-reviewer"`; the package name (`claude-plan-reviewer`) stays unchanged. Hook configs in `settings.json` and README snippets reference `plan-reviewer`.

### Install Path
- **D-04:** Default install location is `~/.local/bin` (cargo-dist default, no sudo required). Install script warns clearly if `~/.local/bin` is not on PATH.

### CLI Structure
- **D-05:** No `review` subcommand. Default behavior (no subcommand given) remains the hook flow — reads stdin JSON, opens browser, writes decision to stdout. This keeps existing hook configs working unchanged through Phase 4.
- **D-06:** `-h` / `--help` always shows help (lists subcommands + top-level flags). `plan-reviewer install -h` shows install subcommand help. Standard clap behavior, zero extra code.
- **D-07:** Phase 3 adds the `install` subcommand (Claude Code only). Phase 4 extends it to multi-integration support and adds `uninstall` and `update`.

### Hook Wiring (install subcommand)
- **D-08:** `plan-reviewer install` idempotently writes the ExitPlanMode hook into `~/.claude/settings.json`. It handles the case where the file doesn't exist, where it exists but has no hooks section, and where the hook is already present (no-op). Claude Code only for Phase 3.
- **D-09:** The cargo-dist generated `install.sh` drops the binary then calls `plan-reviewer install` to wire the hook. The user gets a fully working setup from a single `curl | sh`.

### macOS Signing
- **D-10:** Ad hoc signing only (`codesign --force --sign -`). No Apple Developer account or certificates needed. Satisfies DIST-04 / Gatekeeper first-run blocking. Full notarization is v2 (DIST-06).

### Claude's Discretion
- Exact `install.sh` messaging and formatting (beyond PATH warning requirement)
- cargo-dist configuration details (compression, artifact naming)
- Error handling in `plan-reviewer install` for malformed `settings.json`
- Whether to print a post-install summary showing what was configured

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements & constraints
- `.planning/REQUIREMENTS.md` — DIST-01 through DIST-04 define the acceptance criteria for this phase
- `CLAUDE.md` — Tech stack section documents cargo-dist, cross-compilation targets, and the rationale for each choice; follow these decisions

### Phase context
- `.planning/ROADMAP.md` §Phase 3 — Success criteria (4 items)
- `.planning/ROADMAP.md` §Phase 4 — Phase 4 goal and scope; Phase 3's `install` subcommand must be designed so Phase 4 can extend it without breaking changes

### Existing code
- `Cargo.toml` — Current dependencies, package name (`claude-plan-reviewer`), version (`0.1.0`); `[[bin]]` section must be added
- `src/main.rs` — Current `Args` struct (clap `Parser`); must be refactored to support subcommands while preserving default hook behavior

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main.rs` `Args` struct — current single-command clap setup; refactor point for subcommand addition
- `src/hook.rs` — `HookInput`/`HookOutput` types; the `install` subcommand needs to know the hook binary path to write into `settings.json`

### Established Patterns
- `vendored-libgit2` feature on `git2` — ensures static linking; same approach needed for musl targets (no dynamic glibc/libgit2 dependency)
- tokio feature subset (`rt/macros/net/time/sync/signal`) — binary size conscious; keep this discipline in any new dependencies
- All stderr for diagnostics, stdout only for hook JSON — `plan-reviewer install` output goes to stdout (user-facing), not hook stdout

### Integration Points
- `Cargo.toml` — cargo-dist adds `[workspace.metadata.dist]` (or `[package.metadata.dist]`); `[[bin]]` section needed for binary rename
- `.github/workflows/` — cargo-dist generates these; do not hand-write
- `~/.claude/settings.json` — target file for `plan-reviewer install`; must be read-modify-write with JSON preservation

</code_context>

<specifics>
## Specific Ideas

- "implement phase 4 install and call it in the install.sh script" — Phase 3 ships `plan-reviewer install` (Claude Code only) so `install.sh` can call it. Phase 4 extends to multi-integration without breaking the interface.
- Default behavior stays at top-level (no subcommand = hook) through Phase 4 — no `review` subcommand needed

</specifics>

<deferred>
## Deferred Ideas

- Multi-integration selector for `install`/`uninstall` (opencode, etc.) — Phase 4
- `plan-reviewer uninstall` — Phase 4
- `plan-reviewer update` — Phase 4 (model after ~/Projects/themouette/claude-vm update)
- Full Apple notarization (DIST-06) — v2
- `cargo install` / crates.io distribution (DIST-05) — v2

</deferred>

---

*Phase: 03-distribution*
*Context gathered: 2026-04-10*
