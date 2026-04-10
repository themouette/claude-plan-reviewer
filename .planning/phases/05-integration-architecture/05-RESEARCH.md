# Phase 5: Integration Architecture - Research

**Researched:** 2026-04-10
**Domain:** Rust module refactoring — trait design, module system, idempotency patterns
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Define an `Integration` trait with three methods: `install`, `uninstall`, and `is_installed`
- **D-02:** All three methods receive `&self` and a `ctx: &InstallContext` parameter
- **D-03:** `InstallContext` is a struct carrying `home: String` and `binary_path: String`; additional fields can be added without changing the trait signature
- **D-04:** `install()` and `uninstall()` return `Result<(), String>`; callers (`install.rs`, `uninstall.rs`) handle errors with `eprintln!` + `process::exit(1)`
- **D-05:** `is_installed()` returns `bool`
- **D-06:** Idempotency lives inside each integration's `install()` body — it calls `self.is_installed(ctx)` and returns `Ok(())` early if already installed
- **D-07:** `uninstall()` is already idempotent by convention; each integration enforces this in its own body
- **D-08:** New `src/integrations/` directory replaces `src/integration.rs`
- **D-09:** `src/integrations/mod.rs` — defines `Integration` trait, `InstallContext` struct, and registry (`fn get_integration()` to look up an integration by slug)
- **D-10:** One file per integration: `src/integrations/claude.rs` (full impl), `src/integrations/gemini.rs` (stub), `src/integrations/opencode.rs` (stub)
- **D-11:** `install.rs` and `uninstall.rs` are simplified: they resolve slugs, call `get_integration(slug)`, and call the trait method — no integration-specific match arms
- **D-12:** Remove `Codestral` from `IntegrationSlug` (out of scope per REQUIREMENTS.md)
- **D-13:** Add `Gemini` to `IntegrationSlug`; `GeminiIntegration` struct is created but methods return `Err("gemini integration not yet implemented".into())`
- **D-14:** Final roster: `Claude`, `Gemini`, `Opencode`

### Claude's Discretion

- Exact field names and visibility on `InstallContext`
- Whether `get_integration()` returns `Box<dyn Integration>` or `Arc<dyn Integration>`
- Internal details of the registry (static array, match expression, or lazy_static)
- Error message wording for stub integrations

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTEG-05 | All install/uninstall commands are idempotent — safe to run multiple times without corrupting config | Early-return pattern in `install()` via `is_installed()` pre-check; `retain()` removal pattern in `uninstall()` is inherently idempotent; both already exist in the codebase and must be preserved during migration |
</phase_requirements>

## Summary

Phase 5 is a pure Rust refactor with no new dependencies, no external services, and no new user-visible functionality. The entire scope is: replace the flat `src/integration.rs` with a `src/integrations/` module tree, introduce the `Integration` trait with `InstallContext`, migrate the existing Claude implementation into the new structure, add stub implementations for Gemini and Opencode, and simplify the dispatch in `install.rs` and `uninstall.rs` to use the trait uniformly.

All decisions are locked via CONTEXT.md. The existing codebase already contains working, tested implementations of every behavior that needs to migrate. The primary risk is accidentally breaking tests or changing behavior during mechanical movement of code. There are no new algorithms to introduce — only structural reorganization.

**Primary recommendation:** Migrate code mechanically (copy-move functions, preserve existing logic exactly), add the trait wrapper around them, update dispatch in `install.rs`/`uninstall.rs`, remove `Codestral`, add `Gemini` stub, then run `cargo test` and `cargo clippy` to confirm no regressions.

## Standard Stack

### Core (already in Cargo.toml — no new dependencies)

| Library | Version | Purpose | Relevance to Phase |
|---------|---------|---------|---------------------|
| serde_json | 1.x | JSON manipulation in Claude impl | Already used; no change needed |
| dialoguer | 0.12 | TUI picker in `show_integration_picker` | Stays in `integrations/mod.rs` unchanged |

**No new dependencies.** [VERIFIED: Cargo.toml read directly]

### Rust Language Features Used

| Feature | Purpose | Notes |
|---------|---------|-------|
| `trait` objects (`dyn Integration`) | Polymorphic dispatch | Either `Box<dyn>` or `Arc<dyn>`; `Box<dyn>` is simpler given single-owner call sites |
| Module system (`mod.rs` + sibling files) | `src/integrations/` tree | Standard Rust folder-module pattern |
| `#[cfg(test)]` | In-file unit tests | Follow existing per-file pattern |

## Architecture Patterns

### Recommended Project Structure (post-refactor)

```
src/
├── integrations/
│   ├── mod.rs          # Integration trait, InstallContext struct, IntegrationSlug enum,
│   │                   # get_integration() registry, resolve_integrations(), show_integration_picker()
│   ├── claude.rs       # ClaudeIntegration struct + full install/uninstall/is_installed impl
│   ├── gemini.rs       # GeminiIntegration struct + stub methods returning Err(...)
│   └── opencode.rs     # OpenCodeIntegration struct + stub methods returning Err(...)
├── install.rs          # Simplified: resolves slugs, calls get_integration().install()
├── uninstall.rs        # Simplified: resolves slugs, calls get_integration().uninstall()
├── hook.rs             # Unchanged
├── server.rs           # Unchanged
├── update.rs           # Unchanged
└── main.rs             # Change `mod integration;` → `mod integrations;`
```

### Pattern 1: Integration Trait

```rust
// Source: CONTEXT.md §Specific Ideas (confirmed during /gsd-discuss-phase)
pub struct InstallContext {
    pub home: String,
    pub binary_path: String,
}

pub trait Integration {
    fn install(&self, ctx: &InstallContext) -> Result<(), String>;
    fn uninstall(&self, ctx: &InstallContext) -> Result<(), String>;
    fn is_installed(&self, ctx: &InstallContext) -> bool;
}
```

### Pattern 2: Registry via `get_integration()`

`get_integration()` returns a `Box<dyn Integration>`. A `match` expression on `IntegrationSlug` is the simplest registry — no `lazy_static` needed, each call allocates one small struct.

```rust
// [ASSUMED] — standard Rust pattern; no external verification needed
pub fn get_integration(slug: &IntegrationSlug) -> Box<dyn Integration> {
    match slug {
        IntegrationSlug::Claude => Box::new(ClaudeIntegration),
        IntegrationSlug::Gemini => Box::new(GeminiIntegration),
        IntegrationSlug::Opencode => Box::new(OpenCodeIntegration),
    }
}
```

`Box<dyn Integration>` is preferred over `Arc<dyn Integration>` because call sites in `install.rs` and `uninstall.rs` are single-owner — they call one method and drop the value.

### Pattern 3: Idempotent `install()` (preserved from existing `install_claude`)

```rust
// Source: src/install.rs:109-115 (existing, verified by direct read)
fn install(&self, ctx: &InstallContext) -> Result<(), String> {
    // ... read/parse settings ...
    if self.is_installed(ctx) {
        println!("plan-reviewer: ExitPlanMode hook already configured (no changes made)");
        return Ok(());
    }
    // ... mutate + write settings ...
    Ok(())
}
```

### Pattern 4: Idempotent `uninstall()` (preserved from existing `uninstall_claude`)

```rust
// Source: src/uninstall.rs:86-98 (existing, verified by direct read)
fn uninstall(&self, ctx: &InstallContext) -> Result<(), String> {
    if !self.is_installed(ctx) {
        println!("plan-reviewer: ExitPlanMode hook not found (no changes made)");
        return Ok(());
    }
    if let Some(arr) = root["hooks"]["PermissionRequest"].as_array_mut() {
        arr.retain(|entry| entry["matcher"].as_str() != Some("ExitPlanMode"));
    }
    Ok(())
}
```

### Pattern 5: Simplified dispatch in `install.rs` / `uninstall.rs`

The current `install.rs` resolves `binary_path` and `home` before the per-integration dispatch. After refactoring, both values move into `InstallContext` and are passed to `trait.install()`. The `match slug { IntegrationSlug::Claude => ..., _ => ... }` arms collapse to a single `get_integration(slug).install(&ctx)?` call.

```rust
// [ASSUMED] — standard Rust trait dispatch; structure matches locked decisions D-11
pub fn run_install(integrations: Vec<String>) {
    let slugs = integrations::resolve_integrations(&integrations, "...");
    let ctx = InstallContext {
        binary_path: /* current_exe() */,
        home: /* env::var("HOME") */,
    };
    for slug in &slugs {
        let integration = integrations::get_integration(slug);
        if let Err(e) = integration.install(&ctx) {
            eprintln!("plan-reviewer install: {}", e);
            std::process::exit(1);
        }
    }
}
```

Note: `install.rs` currently has a `supported` check before calling integration-specific logic. After refactoring, unsupported integrations (Gemini stub, Opencode stub) return `Err(...)` from their `install()` body — the `supported` field and the pre-check in the dispatcher are no longer needed.

### Pattern 6: Gemini Stub (clean user error, no panic)

```rust
// Source: CONTEXT.md §Specific Ideas
pub struct GeminiIntegration;

impl Integration for GeminiIntegration {
    fn install(&self, _ctx: &InstallContext) -> Result<(), String> {
        Err("gemini integration not yet implemented".into())
    }
    fn uninstall(&self, _ctx: &InstallContext) -> Result<(), String> {
        Err("gemini integration not yet implemented".into())
    }
    fn is_installed(&self, _ctx: &InstallContext) -> bool {
        false
    }
}
```

### Anti-Patterns to Avoid

- **`unimplemented!()` macro in stub methods:** Panics at runtime instead of returning a clean error. CONTEXT.md explicitly requires `Err(...)` return. [VERIFIED: CONTEXT.md §Specific Ideas]
- **Keeping `supported` field and pre-check in dispatcher:** After the trait refactor, unsupported behavior is expressed via `Err(...)` return, not a metadata flag. The old check belongs inside the integration impl.
- **Moving `show_integration_picker` to a per-integration file:** It reads all integrations and must stay in `integrations/mod.rs` as a module-level function.
- **Changing `resolve_integrations` behavior:** This function handles TTY detection and picker launch — its behavior must be preserved exactly. Only its module path changes.
- **Forgetting to update `main.rs`:** The line `mod integration;` must become `mod integrations;`. All `use crate::integration::` references in `install.rs` and `uninstall.rs` become `use crate::integrations::`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Trait object dispatch | Custom enum dispatch | `Box<dyn Integration>` | Already the right Rust idiom; no external library needed |
| JSON settings mutation | Custom parser | `serde_json::Value` with `entry()` API | Already used; `entry().or_insert_with()` is the correct safe pattern for creating nested keys |

**Key insight:** This phase is entirely mechanical. Every algorithm already exists in `integration.rs`, `install.rs`, and `uninstall.rs`. The risk is not implementing wrong logic — it is losing existing logic during the move.

## Runtime State Inventory

Step 2.5: SKIPPED — this is a code refactor phase, not a rename/rebrand/migration phase. No stored data, service configs, OS registrations, secrets, or build artifacts embed integration slug strings as keys.

The `IntegrationSlug` enum changes (Codestral removed, Gemini added), but these are in-process Rust enums with no external serialized form. [VERIFIED: src/integration.rs — slugs are not persisted to disk]

## Common Pitfalls

### Pitfall 1: Breaking the `show_integration_picker` installed-state pre-check

**What goes wrong:** The picker currently hard-codes a Claude-specific check (`if i.slug == IntegrationSlug::Claude`) to show "(installed)" labels. After refactoring, this should call `integration.is_installed(&ctx)` generically — but `ctx` requires `binary_path` which is not available in `show_integration_picker`.

**Why it happens:** `is_installed()` for Claude reads `settings.json` from disk (does not need `binary_path`). The `ctx` parameter includes `binary_path` for install, but `is_installed` only needs `home`. Passing a dummy `binary_path` is fine here since `is_installed` ignores it.

**How to avoid:** In `show_integration_picker`, build an `InstallContext` with `home` from `env::var("HOME")` and `binary_path` as an empty string or `"(checking)"`. The Claude `is_installed` implementation does not use `binary_path`.

**Warning signs:** Compiler error or clippy warning if `binary_path` is missing from `InstallContext` construction.

### Pitfall 2: Changing the `all()` method on `IntegrationSlug`

**What goes wrong:** `IntegrationSlug::all()` returns a `&'static [IntegrationSlug]` slice literal. Adding `Gemini` and removing `Codestral` requires updating this slice. If forgotten, the picker will show `Codestral` and not `Gemini`.

**Why it happens:** Static slice initializers are not automatically derived.

**How to avoid:** Update `all()` immediately when changing the enum variants. Update the `from_str()` match arms and `as_str()` match arms at the same time.

**Warning signs:** `cargo test` — `all_slugs_have_definitions` test will fail if roster is inconsistent. Test also needs updating for the new roster.

### Pitfall 3: Forgetting to update existing tests

**What goes wrong:** Tests in `integration.rs` reference `IntegrationSlug::Codestral` and `all_integrations_returns_all_three`. These will fail to compile after `Codestral` is removed and the count changes to 3 (Claude, Gemini, Opencode — still 3, but different members).

**Why it happens:** Test code is not always considered during refactors.

**How to avoid:** Search for `Codestral` in all test blocks before deleting the variant. Update tests in the new `integrations/mod.rs` to reflect the new roster.

**Warning signs:** `cargo test` compile errors referencing `Codestral`.

### Pitfall 4: stdout pollution from integration methods

**What goes wrong:** Claude's install/uninstall currently call `println!` for success messages. This is acceptable in the current code. After trait migration, the same `println!` calls must remain — not `eprintln!`. The hook flow requires stdout to carry only the JSON hook response; but install/uninstall are separate subcommands (non-hook path) where stdout is fine for user messages.

**Why it happens:** The "stdout discipline" rule applies to the hook flow only, not to subcommands.

**How to avoid:** Preserve all `println!` and `eprintln!` calls exactly as they are in the existing implementations. Do not change output routing during the migration.

**Warning signs:** Manual test of `plan-reviewer install claude` producing unexpected output.

### Pitfall 5: The `&'static [IntegrationSlug]` slice from `all()`

**What goes wrong:** `IntegrationSlug::all()` returns a reference to a static slice (`&'static [Self]`). This works in current code but requires the enum variants to be listed inline in the slice literal, which is a manual maintenance burden.

**Why it happens:** Rust does not auto-derive `all()` for enums.

**How to avoid:** Accept this pattern as-is — it is established in the codebase. Simply update the literal when changing variants. The alternative (procedural macro) is out of scope for this phase.

### Pitfall 6: Missing `mod` declarations in `integrations/mod.rs`

**What goes wrong:** Creating `src/integrations/claude.rs` without adding `pub mod claude;` to `src/integrations/mod.rs` causes the file to be silently ignored by the compiler.

**Why it happens:** Rust's module system requires explicit declarations.

**How to avoid:** Add `pub mod claude; pub mod gemini; pub mod opencode;` to `src/integrations/mod.rs` as the first step.

**Warning signs:** `cargo build` succeeds but types from `claude.rs` are not accessible.

## Code Examples

### Existing `install_claude` signature to migrate

```rust
// Source: src/install.rs:58-161 (verified by direct read)
// Current: private fn with explicit home/binary_path params
fn install_claude(home: &str, binary_path: &str) { ... }

// After: method on ClaudeIntegration
impl Integration for ClaudeIntegration {
    fn install(&self, ctx: &InstallContext) -> Result<(), String> {
        // same body, home = ctx.home, binary_path = ctx.binary_path
        // process::exit(1) calls become Err("message".into()) returns
    }
}
```

### Converting `process::exit(1)` to `Err(...)` inside trait methods

```rust
// Source: src/install.rs:74-82 (existing pattern)
// Before (in private fn):
Err(e) => {
    eprintln!("plan-reviewer install: cannot read {}: {}", settings_path.display(), e);
    std::process::exit(1);
}

// After (inside trait method — caller handles exit):
Err(e) => {
    return Err(format!("cannot read {}: {}", settings_path.display(), e));
}
```

The caller in `install.rs` then:
```rust
if let Err(e) = integration.install(&ctx) {
    eprintln!("plan-reviewer install: {}", e);
    std::process::exit(1);
}
```

### `is_installed` for Claude (reads only from `ctx.home`)

```rust
// Source: src/integration.rs:129-137 + src/install.rs:109-115 (verified)
fn is_installed(&self, ctx: &InstallContext) -> bool {
    let settings_path = PathBuf::from(&ctx.home).join(".claude/settings.json");
    if !settings_path.exists() { return false; }
    let Ok(content) = std::fs::read_to_string(&settings_path) else { return false; };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) else { return false; };
    json["hooks"]["PermissionRequest"]
        .as_array()
        .map(|arr| arr.iter().any(|e| e["matcher"].as_str() == Some("ExitPlanMode")))
        .unwrap_or(false)
}
```

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Flat `integration.rs` with helper fns | `src/integrations/` module tree with `Integration` trait | This phase implements the transition |
| Dispatcher with `match slug { ... }` arms in `install.rs` | Single `get_integration(slug).install(&ctx)?` call | Post-refactor target |
| `Integration` as a passive data struct | `Integration` as a behavior-defining trait | The core architectural shift |

## Environment Availability

Step 2.6: SKIPPED — this phase has no external dependencies. It is a pure Rust refactor. The build system (`cargo`) and all required crates are already installed and verified by the existing `Cargo.toml`. No new CLI tools, services, databases, or runtimes are needed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Box<dyn Integration>` is preferred over `Arc<dyn>` because call sites are single-owner | Architecture Patterns §Pattern 2 | Low — `Arc<dyn>` also works; no correctness impact |
| A2 | `process::exit(1)` calls inside trait method bodies should become `Err(...)` returns, with exit handled by caller | Code Examples | Low — locked by D-04; if wrong, integration-specific exit calls would bypass the caller's error handling |
| A3 | Passing empty string for `binary_path` in `show_integration_picker` is safe because `is_installed` for Claude ignores it | Pitfalls §Pitfall 1 | Low — confirmed by reading `claude_is_installed()` which checks only `settings.json` contents, never binary path |

## Open Questions (RESOLVED)

1. **Should `InstallContext.binary_path` be `Option<String>`?**
   - What we know: `is_installed()` does not use `binary_path`; `uninstall()` does not use it either; only `install()` uses it
   - What's unclear: Making it `Option<String>` is cleaner semantically but requires unwrapping at usage; keeping it `String` is simpler
   - Recommendation: Keep as `String` (locked by D-03 which says `binary_path: String`); callers pass empty string where not needed

2. **Should `opencode.rs` stub `uninstall()` also return `Err` or `Ok(())`?**
   - What we know: Gemini stub returns `Err("not yet implemented")` per CONTEXT.md; Opencode is in same category
   - What's unclear: CONTEXT.md only specifies Gemini stub behavior
   - Recommendation: Use same pattern as Gemini — `Err("opencode integration not yet implemented".into())` for consistency

## Sources

### Primary (HIGH confidence)
- `src/integration.rs` — Direct read; existing functions to migrate
- `src/install.rs` — Direct read; `install_claude` private fn to migrate
- `src/uninstall.rs` — Direct read; `uninstall_claude` private fn to migrate
- `.planning/phases/05-integration-architecture/05-CONTEXT.md` — All locked decisions
- `Cargo.toml` — Confirmed no new dependencies needed

### Secondary (MEDIUM confidence)
- Standard Rust module system documentation [ASSUMED — well-established language feature, training knowledge corroborated by existing codebase patterns]

## Metadata

**Confidence breakdown:**
- Locked decisions: HIGH — all sourced from CONTEXT.md which records /gsd-discuss-phase output
- Standard stack: HIGH — no new dependencies; all existing crates verified in Cargo.toml
- Architecture patterns: HIGH — based on direct reading of files to be migrated
- Migration mechanics: HIGH — pure mechanical move of existing code
- Pitfalls: HIGH — identified from direct reading of existing code and Rust module system behavior

**Research date:** 2026-04-10
**Valid until:** Indefinite — pure Rust refactor, no external dependencies to go stale
