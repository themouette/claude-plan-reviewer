# Phase 4: Subcommands (install, uninstall, update) - Research

**Researched:** 2026-04-10
**Domain:** Rust CLI subcommand extension — multi-integration install/uninstall + self-update
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** No `review` subcommand. Default (no subcommand) = hook review flow. Unchanged from Phase 3.
- **D-02:** `install` and `uninstall` accept zero or more positional integration names. Zero names → TUI picker.
- **D-03:** Three integrations: `claude`, `opencode`, `codestral`.
- **D-04:** Research must determine the settings file paths and hook entry formats for `opencode` and `codestral`. `claude` is already implemented.
- **D-05:** `install` and `uninstall` are idempotent per integration.
- **D-06:** Interactive TUI picker when no integration names are given — multi-select (dialoguer or crossterm-based).
- **D-07:** Non-interactive / non-TTY: always pass explicit integration names. TUI never triggered from scripts.
- **D-08:** Non-TTY with no integration names → error with clear message.
- **D-09:** `plan-reviewer update` mirrors claude-vm's update command exactly: `self_update` crate, GitHub releases, progress bar, confirmation prompt, `--yes`/`-y` to skip, in-place binary replacement.
- **D-10:** `plan-reviewer update --check`: version-check-only, prints current + latest, changelog link. No download.
- **D-11:** `plan-reviewer update --version v0.2.0`: pin to specific release tag.
- **D-12:** After successful update, clear version check cache.
- **D-13:** Binary path in hook configs does NOT need updating after update — self_update replaces in-place at same path.

### Claude's Discretion

- Exact crate versions for dialoguer / crossterm (use latest stable)
- How to display already-installed status in the TUI picker (checkmark prefix)
- Output formatting for `install` / `uninstall` success/error messages
- Whether `update` shows a version notification on other commands (background check cadence)

### Deferred Ideas (OUT OF SCOPE)

- Background update check / startup notification (optional — include only if it doesn't add binary size or async complexity)
- Additional integrations beyond claude/opencode/codestral
- `plan-reviewer list-integrations`
- Full Apple notarization (DIST-06) — v2
- `cargo install` / crates.io distribution (DIST-05) — v2

</user_constraints>

---

## Summary

Phase 4 extends `plan-reviewer` in three areas: (1) refactoring `src/install.rs` into an integration-aware abstraction that supports `claude`, `opencode`, and `codestral`; (2) adding an `uninstall` subcommand; and (3) adding an `update` subcommand that self-updates the binary in-place from GitHub releases.

The critical research finding is that **`opencode` does not have a Claude Code-style `ExitPlanMode` / `PermissionRequest` hook** in its JSON config format. Its hook system is TypeScript/JS plugin-based and its only config-based hooks (`experimental.hook`) cover `file_edited` and `session_completed` — neither is a plan approval gate. This means the `opencode` integration target must be defined with clear documentation for the user about what "installing" it does (or a flag decision must be made about scope — see Open Questions). The same applies to `codestral`, which is a model name (Mistral AI) and not a standalone coding agent with hook infrastructure.

The `self_update` integration follows the claude-vm pattern closely. One critical incompatibility exists: cargo-dist produces `.tar.xz` archives by default, but `self_update` 0.44 only supports `.tar.gz` and `.zip`. The plan MUST change `Cargo.toml` to set `unix-archive = ".tar.gz"` to align with what `self_update` can download. [VERIFIED: axodotdev.github.io/cargo-dist docs, self_update README]

**Primary recommendation:** Implement `claude` integration uninstall, add `Update` subcommand copying claude-vm's pattern with the tar.gz fix, and defer or document-only `opencode`/`codestral` until those tools have a compatible hook mechanism.

---

## Project Constraints (from CLAUDE.md)

- **Tech stack:** Rust — single-binary output, no runtime dependency
- **Protocol:** Must be compatible with Claude Code PermissionRequest hook stdin/stdout JSON format (default behavior, unchanged)
- **Distribution:** Must install with a single `curl | sh`, no package manager required
- **Scope:** Local-only for v1 — no server-side infrastructure
- No async needed for install/uninstall/update — these are synchronous operations

---

## Standard Stack

### Core (new dependencies for Phase 4)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `self_update` | 0.44.0 | Self-update binary from GitHub releases | Exact library used by claude-vm reference; GitHub backend; progress bar; `no_confirm`; `target_version_tag` API matches D-09/D-10/D-11 |
| `dialoguer` | 0.12.0 | TUI multi-select picker for integration selection | De facto standard for Rust CLI prompts; `MultiSelect` with `defaults()` for pre-checked items; `interact_opt()` for graceful cancellation |

[VERIFIED: npm registry via `cargo search` — self_update 0.44.0, dialoguer 0.12.0]

### Supporting (already in Cargo.toml — no new additions)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `clap` | 4.x | Subcommand definition | Add `Uninstall` and `Update` variants to existing `Commands` enum |
| `serde_json` | 1.x | Read/modify/write settings JSON | Already used in `install.rs` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `dialoguer` | `crossterm` raw | More work; dialoguer already provides MultiSelect out of the box |
| `self_update` | Shell out to `install.sh` | Fragile; doesn't work after binary is moved; no version pinning |
| `self_update` | `self-replace` crate | Lower level; no GitHub backend; must hand-roll asset download and extraction |

### Installation (additions to Cargo.toml)

```toml
self_update = { version = "0.44", default-features = false, features = ["archive-tar", "compression-flate2", "rustls"] }
dialoguer = "0.12"
```

**Feature rationale:** `default-features = false` avoids native-tls (OpenSSL dependency that breaks musl builds). `rustls` is a pure-Rust TLS implementation. `archive-tar` + `compression-flate2` supports `.tar.gz`. [VERIFIED: self_update README, claude-vm Cargo.toml uses same pattern]

**CRITICAL — archive format change also required in Cargo.toml:**

```toml
[workspace.metadata.dist]
unix-archive = ".tar.gz"   # ADD THIS — cargo-dist default is .tar.xz; self_update doesn't support xz
```

Also update `install.sh` line 52: `ARCHIVE_NAME="${BINARY}-${LATEST_TAG}-${TARGET}.tar.gz"` (change `.xz` to `.gz`).

[VERIFIED: axodotdev.github.io/cargo-dist config docs — `unix-archive` accepts `.tar.gz`, `.tar.xz`, `.tar.zst`; self_update README — supported compression: `compression-flate2` (gzip) only, no xz]

### Version verification

```bash
cargo search self_update    # → 0.44.0
cargo search dialoguer      # → 0.12.0
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── main.rs           # Commands enum: add Uninstall, Update variants
├── install.rs        # Refactor: Integration trait + run_install(integrations)
├── uninstall.rs      # NEW: run_uninstall(integrations) — mirrors install.rs structure
├── update.rs         # NEW: run_update(check_only, target_version, skip_confirm)
├── version.rs        # NEW: REPO_OWNER, REPO_NAME, current_platform(), is_newer_version()
├── hook.rs           # unchanged
└── server.rs         # unchanged
```

### Pattern 1: Integration Abstraction

**What:** Replace the hardcoded Claude-only `run_install()` with a struct/enum that represents each integration and carries its settings path, idempotency check logic, and hook entry JSON.

**When to use:** Any time code branches on integration name.

```rust
// Source: derived from existing src/install.rs + CONTEXT.md D-03
pub struct Integration {
    pub slug: &'static str,           // "claude", "opencode", "codestral"
    pub display_name: &'static str,
    pub settings_path: fn(&str) -> std::path::PathBuf,  // takes HOME
    pub hook_entry: fn(&str) -> serde_json::Value,       // takes binary_path
    pub idempotency_key: fn(&serde_json::Value) -> bool, // checks if already installed
}
```

Or a simpler `match` on slug inside `fn for_slug(slug: &str) -> IntegrationDef`. Both approaches work; the struct is more testable.

### Pattern 2: Shared Install/Uninstall Logic

**What:** `run_install(integrations: &[&str])` and `run_uninstall(integrations: &[&str])` iterate over the slice, resolving each to its `Integration` definition, then performing the JSON read-modify-write.

```rust
// Conceptual
pub fn run_install(integrations: &[String]) {
    let binary_path = resolve_binary_path();
    let home = resolve_home();
    for slug in integrations {
        let def = integration_for_slug(slug);
        install_one(&def, &home, &binary_path);
    }
}
```

### Pattern 3: TUI Multi-Select (dialoguer)

**What:** When `integrations` slice is empty and stdin is a TTY, show a MultiSelect prompt. Pre-check integrations that are already installed so the user sees current state.

```rust
// Source: docs.rs/dialoguer/0.12.0/dialoguer/struct.MultiSelect.html
use dialoguer::{MultiSelect, theme::ColorfulTheme};
use dialoguer::console::Term;

let items = vec!["claude", "opencode", "codestral"];
let defaults = vec![claude_installed, opencode_installed, codestral_installed];

let selections = MultiSelect::with_theme(&ColorfulTheme::default())
    .with_prompt("Select integrations to install")
    .items(&items)
    .defaults(&defaults)
    .interact_on_opt(&Term::stderr())?;

match selections {
    Some(idxs) => { /* proceed with selected */ }
    None => { eprintln!("Cancelled"); std::process::exit(0); }
}
```

Non-TTY detection: dialoguer returns an error (not `None`) when stdin is not a TTY — the caller should catch this and print D-08 message before the MultiSelect is attempted. Use `std::io::IsTerminal` (std since Rust 1.70) to check TTY status before calling `MultiSelect`. [VERIFIED: docs.rs/dialoguer/0.12.0; Rust stdlib IsTerminal since 1.70]

```rust
use std::io::IsTerminal;
if !std::io::stdin().is_terminal() {
    eprintln!("No integrations specified. Run interactively or pass integration names: plan-reviewer install claude opencode codestral");
    std::process::exit(1);
}
```

### Pattern 4: Self-Update (mirrors claude-vm exactly)

**What:** `self_update::backends::github::Update::configure()` builder pointed at the `themouette/claude-plan-reviewer` GitHub repo.

```rust
// Source: ~/Projects/themouette/claude-vm/src/commands/update.rs (reference implementation)
use self_update::cargo_crate_version;

let mut builder = self_update::backends::github::Update::configure();
builder
    .repo_owner("themouette")
    .repo_name("claude-plan-reviewer")
    .bin_name("plan-reviewer")
    .target(&current_platform())   // must match asset filename substring
    .current_version(cargo_crate_version!())
    .show_download_progress(true)
    .no_confirm(skip_confirm);

if let Some(v) = target_version {
    builder.target_version_tag(&format!("v{}", v.trim_start_matches('v')));
}

let status = builder.build()?.update()?;
```

**`current_platform()` MUST return Rust target-triple substrings**, not short names like `macos-aarch64`. Cargo-dist names assets using the full triple (e.g., `plan-reviewer-v0.1.0-aarch64-apple-darwin.tar.gz`). The `target()` value is matched as a substring against asset filenames. [VERIFIED: install.sh asset naming `${BINARY}-${LATEST_TAG}-${TARGET}.tar.gz` where TARGET is the Rust triple]

```rust
pub fn current_platform() -> &'static str {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => "aarch64-apple-darwin",
        ("macos", "x86_64") => "x86_64-apple-darwin",
        ("linux", "aarch64") => "aarch64-unknown-linux-musl",
        ("linux", "x86_64") => "x86_64-unknown-linux-musl",
        _ => panic!("Unsupported platform"),
    }
}
```

Note: claude-vm uses short names (`macos-aarch64`) because its release assets use short names. plan-reviewer must use full Rust triples because that is what cargo-dist produces. [VERIFIED: install.sh line 22-36 — TARGET variables are Rust triples]

### Anti-Patterns to Avoid

- **Hard-coding binary path in uninstall check:** The path stored in settings.json may differ from `current_exe()`. The idempotency check for uninstall should match on the `"matcher": "ExitPlanMode"` key, not the command path — consistent with the install idempotency check.
- **Calling `self_update` on `.tar.xz` releases:** Will fail silently or with a compression error. The `unix-archive = ".tar.gz"` change in `Cargo.toml` is a prerequisite for `update` to work.
- **Calling `MultiSelect` before checking TTY:** dialoguer will error or hang. Always check `std::io::stdin().is_terminal()` first.

---

## Integration Target Reference (D-04 — Researcher's Finding)

### Claude Code (existing — `src/install.rs`)

| Property | Value |
|----------|-------|
| Settings file | `~/.claude/settings.json` |
| Hook section | `root["hooks"]["PermissionRequest"]` (array) |
| Idempotency key | any entry with `"matcher": "ExitPlanMode"` |
| Hook entry JSON | `{"matcher":"ExitPlanMode","hooks":[{"type":"command","command":"<binary_path>"}]}` |

[VERIFIED: src/install.rs code]

### OpenCode (`opencode`)

**FINDING: opencode does not have a Claude Code-style ExitPlanMode/PermissionRequest hook in its JSON config.** [VERIFIED: opencode.ai/config.json schema — no `hooks` key at top level; opencode.ai/docs/config/ — no hooks section documented]

OpenCode's hook mechanism is TypeScript/JS plugin-based (`~/.config/opencode/plugins/` or `.opencode/plugins/`). Its only config-based hooks are under `experimental.hook` covering `file_edited` and `session_completed`. There is no plan-approval hook in the config format. [CITED: gist.github.com/zeke/1e0ba44eaddb16afa6edc91fec778935]

**Note on forks:** The original `charmbracelet/opencode` was archived September 2025 and development moved to `charmbracelet/crush`. The current active fork is `sst/opencode` (opencode.ai). Crush (charmbracelet) has a feature request for plan/build modes (Issue #1734, December 2025) but no implementation. [CITED: github.com/charmbracelet/crush/issues/1734]

**Recommended approach for Phase 4:** opencode integration should install a plugin file rather than editing a JSON config. The installer would write a TypeScript plugin to `~/.config/opencode/plugins/plan-reviewer.ts` that hooks into tool execution to intercept plan approval. However, this is significantly more complex than the Claude Code approach and may be out of scope for this phase. **See Open Questions below.**

| Property | Value |
|----------|-------|
| Global config file | `~/.config/opencode/opencode.json` |
| Plugin directory | `~/.config/opencode/plugins/` |
| Plan hook mechanism | TypeScript plugin (NOT a JSON config hook) |
| Hook section | N/A — no JSON config hook for plan approval |

[VERIFIED: opencode.ai/config.json schema (fetched), opencode.ai/docs/config/ (fetched), dev.to/einarcesar article]

### Codestral (`codestral`)

**FINDING: Codestral is a model name (Mistral AI), not a standalone coding agent with hook infrastructure.** [VERIFIED: mistral.ai/news/codestral — Codestral is a code generation model, not an IDE/terminal agent]

There is no "codestral settings file" to write a hook into. Codestral is used via Continue.dev, Cursor, or other editors as a model provider. None of those editors have a plan approval hook system comparable to Claude Code. [CITED: docs.continue.dev; forum.cursor.com]

**Recommended approach for Phase 4:** The `codestral` integration slug in CONTEXT.md D-03 likely refers to a terminal coding agent that happens to use Codestral as its model backend. The researcher could not identify a specific tool matching this description with a Claude Code-style hook system. **This requires user confirmation before implementation — see Open Questions.**

| Property | Value |
|----------|-------|
| Settings file | UNKNOWN — no terminal agent named "codestral" identified |
| Hook section | UNKNOWN |
| Hook entry JSON | UNKNOWN |

[ASSUMED] — The "codestral" integration target as described in D-03 cannot be implemented without user clarification on which specific tool this refers to.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub releases HTTP download with progress | Custom reqwest + indicatif download loop | `self_update` | Handles asset name matching, version comparison, in-place replacement, Windows lock avoidance |
| Self-replacing binary on disk | Manual `fs::copy` + `fs::rename` | `self_update` | On Windows, a running binary cannot be replaced; self_update handles platform-specific swap atomically |
| Terminal prompt detection | Custom `isatty()` syscall | `std::io::IsTerminal` (std) | Stable since Rust 1.70; no extra crate needed |
| Multi-select TUI | Raw crossterm key events | `dialoguer::MultiSelect` | Full keyboard navigation, theme support, 12 lines of code vs 150+ |

**Key insight:** Self-update on Windows requires atomic binary swap that is non-trivial; `self_update` handles the temp-file + rename dance that works cross-platform.

---

## Common Pitfalls

### Pitfall 1: Archive Format Mismatch (BLOCKING)

**What goes wrong:** `self_update` attempts to decompress the downloaded `.tar.xz` asset and fails because it only supports gzip (`compression-flate2`) — not xz/lzma. The binary is not updated.

**Why it happens:** cargo-dist defaults to `.tar.xz` for Unix targets. `self_update` does not include an xz feature. Current `install.sh` also uses `.tar.xz`.

**How to avoid:**
1. Add `unix-archive = ".tar.gz"` to `[workspace.metadata.dist]` in `Cargo.toml` BEFORE cutting the release that `update` will download.
2. Update `install.sh` line 52: change `.tar.xz` to `.tar.gz`.
3. Add `compression-flate2` feature to `self_update` Cargo dependency.

**Warning signs:** `self_update` returns an error containing "archive" or "decompress" at runtime.

[VERIFIED: self_update README — supported compression features documented; axodotdev.github.io cargo-dist docs — unix-archive option]

### Pitfall 2: Wrong Platform String in `target()`

**What goes wrong:** `self_update` cannot find a matching release asset because the target string doesn't appear as a substring in any asset filename. Falls through to wrong binary or fails.

**Why it happens:** claude-vm uses short names (`macos-aarch64`). plan-reviewer uses Rust target triples (`aarch64-apple-darwin`). If you copy claude-vm's `version.rs` directly, the platform strings won't match.

**How to avoid:** Implement `current_platform()` returning full Rust triples. Verify against actual release asset names from GitHub.

[VERIFIED: install.sh lines 17-36 — TARGET uses Rust triples; cargo-dist asset naming convention]

### Pitfall 3: Calling TUI in Non-TTY Context

**What goes wrong:** `dialoguer::MultiSelect` hangs or errors when called in a non-TTY context (e.g., piped to from `install.sh`).

**Why it happens:** `install.sh` calls `plan-reviewer install` with no arguments. In the install script context, stdin is piped (the curl output), not a terminal.

**How to avoid:** Check `std::io::stdin().is_terminal()` before creating `MultiSelect`. If not a TTY and no integration names given, print D-08 error message and exit 1.

[VERIFIED: CONTEXT.md D-07, D-08; install.sh line 90]

### Pitfall 4: Uninstall Must Not Match on Binary Path

**What goes wrong:** Uninstall removes only the entry whose `"command"` exactly matches the current binary path. If the binary was moved or reinstalled, there may be a lingering entry with an old path.

**Why it happens:** The install entry stores the absolute binary path. After a reinstall to a different location, the old entry remains.

**How to avoid:** Uninstall scans for `"matcher": "ExitPlanMode"` (same idempotency key as install) and removes all matching entries, regardless of the `"command"` path. This is the intent of D-05 "idempotent uninstall."

[VERIFIED: src/install.rs idempotency check pattern]

### Pitfall 5: Permission Error on Binary Replacement

**What goes wrong:** `self_update` update() returns a "Permission denied" error when trying to replace a system-installed binary.

**Why it happens:** Binary installed to `/usr/local/bin/` requires elevated permissions.

**How to avoid:** Detect the error string and print a helpful message: "Cannot replace binary. Try running with sudo: sudo plan-reviewer update". This matches claude-vm's pattern. [VERIFIED: claude-vm src/commands/update.rs lines 100-105]

---

## Code Examples

### Install integration selection (main.rs)

```rust
// Source: derived from existing src/main.rs Commands enum pattern
#[derive(Subcommand, Debug)]
enum Commands {
    /// Wire the ExitPlanMode hook into one or more integrations (default: interactive)
    Install {
        /// Integration names: claude, opencode, codestral
        integrations: Vec<String>,
    },
    /// Remove the ExitPlanMode hook from one or more integrations
    Uninstall {
        /// Integration names: claude, opencode, codestral
        integrations: Vec<String>,
    },
    /// Update plan-reviewer to the latest version
    Update {
        /// Only check for updates, don't download
        #[arg(long)]
        check: bool,
        /// Pin to a specific version tag (e.g., v0.2.0)
        #[arg(long)]
        version: Option<String>,
        /// Skip confirmation prompt
        #[arg(short = 'y', long)]
        yes: bool,
    },
}
```

### TTY check before TUI

```rust
// Source: Rust stdlib 1.70+ std::io::IsTerminal
use std::io::IsTerminal;

fn resolve_integrations(given: &[String]) -> Vec<String> {
    if !given.is_empty() {
        return given.to_vec();
    }
    if !std::io::stdin().is_terminal() {
        eprintln!(
            "No integrations specified. Run interactively or pass integration names: \
             plan-reviewer install claude opencode codestral"
        );
        std::process::exit(1);
    }
    show_integration_picker()
}
```

### Self-update builder (update.rs)

```rust
// Source: ~/Projects/themouette/claude-vm/src/commands/update.rs (adapted for plan-reviewer)
use self_update::cargo_crate_version;

fn perform_update(target_version: Option<String>, skip_confirm: bool) -> Result<(), Box<dyn std::error::Error>> {
    let mut builder = self_update::backends::github::Update::configure();
    builder
        .repo_owner("themouette")
        .repo_name("claude-plan-reviewer")
        .bin_name("plan-reviewer")
        .target(current_platform())
        .current_version(cargo_crate_version!())
        .show_download_progress(true)
        .no_confirm(skip_confirm);

    if let Some(v) = target_version {
        let v = v.trim_start_matches('v');
        builder.target_version_tag(&format!("v{}", v));
    }

    match builder.build()?.update() {
        Ok(status) => {
            println!("Successfully updated to version {}", status.version());
            Ok(())
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("Permission denied") || msg.contains("EACCES") {
                eprintln!("Cannot replace binary. Try running with sudo: sudo plan-reviewer update");
                std::process::exit(1);
            }
            Err(e.into())
        }
    }
}

fn current_platform() -> &'static str {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => "aarch64-apple-darwin",
        ("macos", "x86_64") => "x86_64-apple-darwin",
        ("linux", "aarch64") => "aarch64-unknown-linux-musl",
        ("linux", "x86_64") => "x86_64-unknown-linux-musl",
        (os, arch) => panic!("Unsupported platform: {}-{}", os, arch),
    }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| opencode (charmbracelet) | archived Sep 2025; continuation is `sst/opencode` (opencode.ai) and `charmbracelet/crush` | Sep 2025 | "opencode" integration target must specify which fork |
| self_update 0.38-0.42 | self_update 0.44 | 2025 | Minor API additions; core Update::configure() builder unchanged |
| Rust `atty` crate for TTY detection | `std::io::IsTerminal` (stable since Rust 1.70) | Rust 1.70 (2023) | No extra crate needed; use std directly |

**Deprecated/outdated:**
- `atty` crate: unmaintained; `std::io::IsTerminal` is the stdlib replacement
- `self_update` < 0.40: older feature flag names differ slightly; use 0.44

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "codestral" integration refers to a terminal coding agent (not just the Mistral model). No such tool was identified. | Integration Target Reference | If it refers to a specific tool (e.g., a future CLI or Continue.dev integration), the settings path and hook format will differ entirely |
| A2 | The `sst/opencode` fork (opencode.ai) is the integration target when users say "opencode" — not `charmbracelet/crush` | Integration Target Reference | If users mean Crush or another fork, the config path differs (`.crush.json` not `opencode.json`) |
| A3 | Background version check (deferred) will use the same `check_and_notify()` pattern from claude-vm's `update_check.rs` if included | Architecture Patterns | If included, must avoid adding async dependency to non-hook flow |

**All other claims were verified or cited in this session.**

---

## Open Questions

1. **What tool is "codestral" in D-03?**
   - What we know: Codestral is a Mistral AI model, not a standalone terminal agent. No coding agent named "codestral" with a settings.json hook system was found.
   - What's unclear: Does the user mean a specific terminal agent that uses Codestral as its backend? (Possibly a fork of opencode? Or a future tool?)
   - Recommendation: Ask the user before implementing `codestral` integration. In the meantime, add the slug to the CLI enum but print "codestral integration: not yet implemented" when selected.

2. **What should `opencode` integration actually do?**
   - What we know: `opencode` (sst/opencode) does not have a JSON config hook for plan approval. Its hook system requires TypeScript plugins.
   - What's unclear: Does the user want (a) a TypeScript plugin file written to `~/.config/opencode/plugins/`, (b) a message telling the user to install a plugin manually, or (c) is this planned for a future tool version of opencode that will have a shell-command hook?
   - Recommendation: Implement as "write a minimal TypeScript plugin file" OR defer to a future phase. The plan should reserve the `opencode` slot in the `Commands` enum but print a "opencode integration requires plugin install" message.

3. **Is the archive format change backward-compatible with existing v0.1.0 installs?**
   - What we know: Changing `unix-archive` to `.tar.gz` affects future releases only. The `install.sh` and `self_update` must both change to `.tar.gz` consistently.
   - What's unclear: Will users who installed v0.1.0 via `install.sh` (which used `.tar.xz`) experience any issue? No — they have the binary already; the update flow downloads the new `.tar.gz` release.
   - Recommendation: Change both `Cargo.toml` `unix-archive` and `install.sh` in the same PR as the update subcommand.

---

## Environment Availability

Step 2.6: All phase work is purely Rust source code + Cargo.toml edits. No external services, databases, or CLIs are required at development time. At runtime, `self_update` requires HTTPS access to `api.github.com` — this is a user-environment concern, not a build-time concern.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust (cargo) | Build | Assumed (existing project builds) | 1.70+ (for IsTerminal) | — |
| HTTPS to api.github.com | `update` subcommand at runtime | User environment | — | Print "unable to check for updates" message |

---

## Validation Architecture

`nyquist_validation` is `false` in `.planning/config.json` — validation architecture section skipped.

---

## Security Domain

`security_enforcement` not set in config (absent = enabled).

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Integration slug validated against allowlist `["claude","opencode","codestral"]`; version tag sanitized (trim 'v' prefix only, reject non-semver) |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal in settings file path | Tampering | Settings paths are hardcoded per integration slug — no user input involved |
| Binary substitution during download | Tampering | self_update downloads over HTTPS; cargo-dist can optionally add ed25519 signatures (not yet enabled); low risk for local tool |
| Version string injection in terminal output | Tampering | Sanitize version strings before printing (see claude-vm's `sanitize_version()` pattern) |

---

## Sources

### Primary (HIGH confidence)

- `src/install.rs` (codebase, read this session) — existing Claude Code install logic, idempotency pattern
- `src/main.rs` (codebase, read this session) — existing Commands enum, install.sh call pattern
- `install.sh` (codebase, read this session) — archive naming `plan-reviewer-{TAG}-{TRIPLE}.tar.xz`
- `Cargo.toml` (codebase, read this session) — dependency versions, cargo-dist config
- `~/Projects/themouette/claude-vm/src/commands/update.rs` (codebase, read this session) — reference update implementation
- `~/Projects/themouette/claude-vm/src/update_check.rs` (codebase, read this session) — background version check pattern
- [docs.rs/self_update/0.44.0/self_update/backends/github/struct.UpdateBuilder.html](https://docs.rs/self_update/0.44.0/self_update/backends/github/struct.UpdateBuilder.html) — UpdateBuilder API
- [docs.rs/dialoguer/0.12.0/dialoguer/struct.MultiSelect.html](https://docs.rs/dialoguer/0.12.0/dialoguer/struct.MultiSelect.html) — MultiSelect API
- [axodotdev.github.io/cargo-dist/book/reference/config.html](https://axodotdev.github.io/cargo-dist/book/reference/config.html) — unix-archive config option
- `cargo search self_update` → 0.44.0 [VERIFIED: cargo registry]
- `cargo search dialoguer` → 0.12.0 [VERIFIED: cargo registry]

### Secondary (MEDIUM confidence)

- [opencode.ai/config.json schema](https://opencode.ai/config.json) (fetched this session) — confirmed no `hooks` key in schema
- [opencode.ai/docs/config/](https://opencode.ai/docs/config/) (fetched this session) — settings file paths confirmed
- [github.com/jaemk/self_update README](https://github.com/jaemk/self_update) (fetched this session) — feature flags, xz not supported
- [github.com/charmbracelet/crush](https://github.com/charmbracelet/crush) — crush config uses `.crush.json`

### Tertiary (LOW confidence / ASSUMED)

- "codestral" as an integration target — no verified tool found matching this description [ASSUMED A1]
- opencode plugin-file approach for plan approval — inferred from plugin system docs, not confirmed as viable [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all crate versions verified via cargo registry
- Architecture patterns: HIGH — directly derived from existing codebase + claude-vm reference
- Integration targets (claude): HIGH — verified from existing implementation
- Integration targets (opencode): MEDIUM — config format verified, but plan-hook gap is a significant finding
- Integration targets (codestral): LOW — "codestral" as a coding agent tool not identified
- Pitfalls: HIGH — verified archive format mismatch from both cargo-dist docs and self_update README

**Research date:** 2026-04-10
**Valid until:** 2026-07-10 (90 days — stable crate ecosystem; opencode may gain config hooks sooner)
