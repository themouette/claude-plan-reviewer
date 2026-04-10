# Phase 5: Integration Architecture - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor `src/integration.rs` into a clean `src/integrations/` folder-per-integration structure with a Rust `Integration` trait. Migrate the existing Claude implementation to the new structure. Simplify `install.rs` and `uninstall.rs` dispatch so that adding a new integration in Phase 6+ requires only implementing the trait and registering it — no changes to dispatch logic. No new integration functionality is shipped in this phase.

</domain>

<decisions>
## Implementation Decisions

### Trait Interface
- **D-01:** Define an `Integration` trait with three methods: `install`, `uninstall`, and `is_installed`
- **D-02:** All three methods receive `&self` and a `ctx: &InstallContext` parameter
- **D-03:** `InstallContext` is a struct carrying `home: String` and `binary_path: String`; additional fields can be added without changing the trait signature
- **D-04:** `install()` and `uninstall()` return `Result<(), String>`; callers (`install.rs`, `uninstall.rs`) handle errors with `eprintln!` + `process::exit(1)`
- **D-05:** `is_installed()` returns `bool`

### Idempotency
- **D-06:** Idempotency lives inside each integration's `install()` body — it calls `self.is_installed(ctx)` and returns `Ok(())` early if already installed
- **D-07:** `uninstall()` is already idempotent by convention (returns `Ok(())` if not installed); each integration enforces this in its own body

### Module Structure
- **D-08:** New `src/integrations/` directory replaces `src/integration.rs`
- **D-09:** `src/integrations/mod.rs` — defines `Integration` trait, `InstallContext` struct, and registry (fn to look up an integration by slug)
- **D-10:** One file per integration: `src/integrations/claude.rs` (full implementation), `src/integrations/gemini.rs` (stub — Phase 6 fills it), `src/integrations/opencode.rs` (stub — Phase 7 fills it)
- **D-11:** `install.rs` and `uninstall.rs` are simplified: they resolve slugs, call `get_integration(slug)`, and call the trait method — no integration-specific match arms

### Integration Roster
- **D-12:** Remove `Codestral` from `IntegrationSlug` (out of scope per REQUIREMENTS.md)
- **D-13:** Add `Gemini` to `IntegrationSlug`; `GeminiIntegration` struct is created but methods use `unimplemented!()` or return `Err("not yet implemented".into())`
- **D-14:** Final roster: `Claude`, `Gemini`, `Opencode`

### Claude's Discretion
- Exact field names and visibility on `InstallContext`
- Whether `get_integration()` returns `Box<dyn Integration>` or `Arc<dyn Integration>`
- Internal details of the registry (static array, match expression, or lazy_static)
- Error message wording for stub integrations

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` §INTEG-05 — Idempotency requirement (all install/uninstall must be safe to run multiple times)
- `.planning/ROADMAP.md` §Phase 5 — Success criteria (3 acceptance tests define "done")

### Existing source to migrate
- `src/integration.rs` — Current flat structure: `IntegrationSlug` enum, passive `Integration` struct, helper fns for Claude; this file is the primary subject of the refactor
- `src/install.rs` — Current install dispatch; must be simplified to use the trait
- `src/uninstall.rs` — Current uninstall dispatch; must be simplified to use the trait

### Reference for Claude implementation details
- `src/integration.rs:102–137` — `claude_settings_path()`, `claude_hook_entry()`, `claude_is_installed()` — these move into `src/integrations/claude.rs`
- `src/install.rs:57–130` — `install_claude()` private fn — migrates into `ClaudeIntegration::install()`
- `src/uninstall.rs:44–125` — `uninstall_claude()` private fn — migrates into `ClaudeIntegration::uninstall()`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `integration::resolve_integrations()` — slug resolution + TTY picker; stays in `integrations/mod.rs` unchanged
- `integration::show_integration_picker()` — dialoguer TUI picker; stays in `integrations/mod.rs`
- `integration::claude_settings_path()`, `claude_hook_entry()`, `claude_is_installed()` — move to `integrations/claude.rs` as `ClaudeIntegration` methods

### Established Patterns
- Error output to `stderr`, hook JSON to `stdout` — maintained throughout (stdout discipline non-negotiable)
- `serde_json::Value` for JSON manipulation — Claude implementation uses this; carry forward
- `process::exit(1)` for fatal errors in CLI commands — trait returns `Result`, callers call exit
- All tests in `#[cfg(test)]` blocks within the same file — follow this per integration file

### Integration Points
- `main.rs` dispatches to `install::run_install()` and `uninstall::run_uninstall()` — no changes needed there
- `Cargo.toml` — no new dependencies expected for this phase (pure refactor)

</code_context>

<specifics>
## Specific Ideas

- The trait preview confirmed during discussion:
  ```rust
  struct InstallContext {
      home: String,
      binary_path: String,
      // future fields without breaking trait
  }

  trait Integration {
      fn install(&self, ctx: &InstallContext) -> Result<(), String>;
      fn uninstall(&self, ctx: &InstallContext) -> Result<(), String>;
      fn is_installed(&self, ctx: &InstallContext) -> bool;
  }
  ```
- Gemini stub should `return Err("gemini integration not yet implemented".into())` (not `unimplemented!()` which panics — cleaner user experience if someone runs `install gemini` before Phase 6)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-integration-architecture*
*Context gathered: 2026-04-10*
