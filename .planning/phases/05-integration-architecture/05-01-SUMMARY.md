---
phase: 05-integration-architecture
plan: "01"
subsystem: integrations
tags: [refactor, trait, module-tree, claude, gemini, opencode]
dependency_graph:
  requires: []
  provides: [integrations-trait-boundary, claude-install-uninstall, gemini-stub, opencode-stub]
  affects: [src/main.rs, src/install.rs, src/uninstall.rs]
tech_stack:
  added: []
  patterns: [trait-polymorphism, integration-registry, box-dyn-trait]
key_files:
  created:
    - src/integrations/mod.rs
    - src/integrations/claude.rs
    - src/integrations/gemini.rs
    - src/integrations/opencode.rs
  modified:
    - src/main.rs
    - src/install.rs
    - src/uninstall.rs
  deleted:
    - src/integration.rs
decisions:
  - "Integration trait has exactly three methods: install, uninstall, is_installed — all take &InstallContext"
  - "IntegrationSlug roster is Claude/Gemini/Opencode — Codestral removed entirely"
  - "get_integration() returns Box<dyn Integration> via match on slug variant"
  - "display_name() and is_available() placed on IntegrationSlug (not on trait) to keep trait minimal"
  - "Stubs return Err(String) not unimplemented!() for clean user experience on premature use"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-10"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 3
  files_deleted: 1
requirements:
  - INTEG-05
---

# Phase 5 Plan 1: Integration Architecture Refactor Summary

**One-liner:** `Integration` trait with `Box<dyn Integration>` registry replacing flat `integration.rs` — Claude full impl, Gemini/Opencode stubs returning `Err`, install/uninstall dispatch reduced to single `get_integration(slug).method(&ctx)` call.

## What Was Built

Refactored `src/integration.rs` into a `src/integrations/` module tree with a Rust `Integration` trait, migrated the existing Claude implementation, added Gemini/Opencode stubs, and simplified install/uninstall dispatch to use trait-based polymorphism.

**New files:**
- `src/integrations/mod.rs` — `Integration` trait, `InstallContext` struct, `IntegrationSlug` enum (Claude/Gemini/Opencode), `get_integration()` registry, `resolve_integrations()`, `show_integration_picker()`
- `src/integrations/claude.rs` — `ClaudeIntegration` with full install/uninstall/is_installed implementation
- `src/integrations/gemini.rs` — `GeminiIntegration` stub returning `Err("gemini integration not yet implemented")`
- `src/integrations/opencode.rs` — `OpenCodeIntegration` stub returning `Err("opencode integration not yet implemented")`

**Modified files:**
- `src/main.rs` — `mod integration` → `mod integrations`, help text updated to "claude, gemini, opencode"
- `src/install.rs` — Rewritten: single `get_integration(slug).install(&ctx)` call, no match arms
- `src/uninstall.rs` — Rewritten: single `get_integration(slug).uninstall(&ctx)` call, no match arms

**Deleted:** `src/integration.rs` — all contents migrated to new module structure.

## Commits

| Hash | Message |
|------|---------|
| 0b78403 | feat(05-01): create src/integrations/ module tree with Integration trait and all implementations |
| 8117ee2 | fix(05-01): restore planning files accidentally deleted by worktree reset |
| 3b49a0f | feat(05-01): wire integrations module into main.rs, simplify install/uninstall dispatch, delete integration.rs |
| 4b6b204 | test(05-01): verify all tests pass, clippy clean, fmt clean |

## Verification Results

- `cargo build` — success (no errors)
- `cargo fmt --check` — exit 0
- `cargo clippy -- -D warnings` — exit 0 (0 warnings)
- `cargo test` — 13/13 tests pass
  - `integrations::tests::slug_round_trip` — claude/gemini/opencode parse; codestral returns None
  - `integrations::tests::slug_display` — lowercase string display
  - `integrations::tests::all_slugs_count` — exactly 3 slugs
  - `integrations::tests::get_integration_returns_for_all_slugs` — no panic for any slug
  - `integrations::tests::gemini_stub_returns_err` — Err contains "not yet implemented", is_installed false
  - `integrations::tests::opencode_stub_returns_err` — same pattern
  - `integrations::claude::tests::claude_settings_path_test` — correct path construction
  - `integrations::claude::tests::claude_hook_entry_has_exit_plan_mode` — correct hook entry
  - `integrations::claude::tests::claude_is_installed_detects_matcher` — correct idempotency detection
  - 4 main.rs git diff tests unchanged

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Planning files deleted by git reset --soft side effect**
- **Found during:** Task 1 commit
- **Issue:** `git reset --soft dc07ff8` (to rebase worktree onto correct base) staged deletions of planning files that were added in later commits on the main branch. The commit accidentally removed `.planning/phases/05-integration-architecture/05-01-PLAN.md` and related files.
- **Fix:** Recovered files from parent commit using `git show dc07ff8:path`, restored to worktree, committed as fix.
- **Files modified:** `.planning/phases/05-integration-architecture/05-01-PLAN.md`, `05-CONTEXT.md`, `05-DISCUSSION-LOG.md`, `05-RESEARCH.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`
- **Commit:** 8117ee2

**2. [Rule 1 - Bug] Clippy collapsible_if in claude.rs**
- **Found during:** Task 3 clippy run
- **Issue:** Nested `if let Some(parent) { if let Err(e) { ... } }` in `ClaudeIntegration::install()` triggered `clippy::collapsible-if`.
- **Fix:** Collapsed to `if let Some(parent) = ... && let Err(e) = ... { ... }` using Rust's `let_chains` syntax.
- **Files modified:** `src/integrations/claude.rs`
- **Commit:** 4b6b204

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| `src/integrations/gemini.rs` | `install/uninstall` return `Err("gemini integration not yet implemented")` | Intentional — Phase 6 will implement full Gemini CLI hook wiring |
| `src/integrations/opencode.rs` | `install/uninstall` return `Err("opencode integration not yet implemented")` | Intentional — Phase 7 will implement full opencode hook wiring |

These stubs are intentional — they exist to demonstrate the trait boundary and give clean error messages if a user runs `plan-reviewer install gemini` before Phase 6 ships.

## Threat Flags

No new security-relevant surface introduced. This refactor is purely structural — same filesystem operations, same trust boundaries, no new network endpoints or auth paths.

## Self-Check: PASSED

Files created:
- FOUND: src/integrations/mod.rs
- FOUND: src/integrations/claude.rs
- FOUND: src/integrations/gemini.rs
- FOUND: src/integrations/opencode.rs

Files deleted:
- CONFIRMED: src/integration.rs does not exist

Commits exist:
- FOUND: 0b78403
- FOUND: 8117ee2
- FOUND: 3b49a0f
- FOUND: 4b6b204

Test result: 13 passed, 0 failed.
