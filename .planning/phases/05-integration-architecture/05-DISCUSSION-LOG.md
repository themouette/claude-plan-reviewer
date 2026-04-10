# Phase 5: Integration Architecture - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion history.

**Date:** 2026-04-10
**Phase:** 05-integration-architecture
**Mode:** discuss
**Areas analyzed:** Trait interface design, Idempotency enforcement, Module structure, Slug cleanup

## Assumptions Presented

### Trait Interface Design

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| InstallContext struct preferred over flat args | Confirmed | User selected recommended option |
| Result<(), String> return type over internal exit | Confirmed | User selected recommended option |

### Idempotency Enforcement

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Check inside install() body | Confirmed | User selected recommended option |

### Module Structure

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| src/integrations/ folder with one file per integration | Confirmed | User selected recommended option |

### Slug Cleanup

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Remove Codestral, add Gemini stub | Confirmed | User selected recommended option |

## Corrections Made

No corrections — all recommended options confirmed.

## Gray Areas Selected by User

All four areas: Trait interface design, Idempotency enforcement, Module structure, Slug cleanup.

## Key Context

- Current `src/integration.rs` has a passive `Integration` struct (not a trait) — full refactor needed
- Claude implementation helpers (`claude_settings_path`, `claude_hook_entry`, `claude_is_installed`) move to `src/integrations/claude.rs`
- `install.rs` and `uninstall.rs` private `install_claude()` / `uninstall_claude()` fns migrate into `ClaudeIntegration::install()` / `ClaudeIntegration::uninstall()`
- Gemini stub returns `Err()` not `panic!()` — cleaner user experience before Phase 6 ships
