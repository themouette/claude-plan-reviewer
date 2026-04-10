# Phase 3: Distribution - Research

**Researched:** 2026-04-10
**Domain:** Rust binary distribution, cargo-dist, GitHub Actions CI, macOS codesigning, shell installer, clap subcommands, Claude Code settings.json
**Confidence:** HIGH

## Summary

Phase 3 ships pre-built binaries for four targets (darwin-arm64, darwin-x64, linux-musl-x64, linux-musl-arm64), provides a `curl | sh` installer that calls `plan-reviewer install`, and adds the `install` subcommand to wire the Claude Code hook automatically.

cargo-dist v0.31.0 now supports all four required targets: macOS targets build natively on `macos-latest`, x86_64-musl builds natively on `ubuntu-latest`, and aarch64-musl cross-compiles via cargo-zigbuild (added in v0.26.0). The `github-build-setup` key (added in v0.20.0) injects pre-build steps for npm/frontend assets before the Rust compile.

The critical finding for DIST-04 (macOS Gatekeeper): cargo-dist does NOT have a built-in TOML key for macOS ad hoc signing. However, `curl | sh` installs do NOT set `com.apple.quarantine`, so Gatekeeper is never triggered at all for terminal-installed binaries. This means ad hoc signing (`codesign --force --sign -`) must be run as a post-build step in the GitHub Actions workflow via `github-build-setup` or a custom CI step — but it is only needed as a precaution for macOS binary integrity on Apple Silicon (where the OS requires some signature), not to bypass Gatekeeper for curl-installed tools.

The cargo-dist shell installer cannot run post-install commands, so `plan-reviewer install` hook wiring must happen as a separate manual step — OR the `install.sh` must be a custom wrapper that invokes `plan-reviewer install` after the cargo-dist installer runs. Decision D-09 in CONTEXT.md requires calling `plan-reviewer install` from `install.sh`, which means a custom install script wrapping cargo-dist's installer.

**Primary recommendation:** Use cargo-dist 0.31.x for binary building and GitHub Releases, cargo-zigbuild for the aarch64-musl target, `github-build-setup` to run npm build before Rust compile (with `SKIP_FRONTEND_BUILD` for non-local runners if needed), manual `codesign --force --sign -` in a post-build step for macOS targets, and a hand-rolled `install.sh` wrapper (or the `install-success-msg` pointing users to run `plan-reviewer install`) since cargo-dist's shell installer cannot call post-install commands.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use cargo-dist for cross-compilation and release automation. Generates GitHub Actions CI, builds all four targets, uploads to GitHub Releases, produces hosted `install.sh`. Uses built-in `GITHUB_TOKEN` — no new secrets required.
- **D-02:** Targets: `aarch64-apple-darwin`, `x86_64-apple-darwin`, `x86_64-unknown-linux-musl`, `aarch64-unknown-linux-musl`. `vendored-libgit2` already ensures fully static Linux builds.
- **D-03:** Installed binary named `plan-reviewer`. Cargo.toml gets `[[bin]]` with `name = "plan-reviewer"`; package name `claude-plan-reviewer` unchanged. Hook configs and README reference `plan-reviewer`.
- **D-04:** Default install location `~/.local/bin` (no sudo). Install script warns if not on PATH.
- **D-05:** No `review` subcommand. Default behavior (no subcommand) = hook flow. Keeps existing hook configs working unchanged through Phase 4.
- **D-06:** `-h` / `--help` shows help. `plan-reviewer install -h` shows install subcommand help. Standard clap behavior.
- **D-07:** Phase 3 adds `install` subcommand (Claude Code only). Phase 4 extends to multi-integration, adds `uninstall` and `update`.
- **D-08:** `plan-reviewer install` idempotently writes ExitPlanMode hook to `~/.claude/settings.json`. Handles: file missing, no hooks section, hook already present (no-op).
- **D-09:** cargo-dist generated `install.sh` drops binary, then calls `plan-reviewer install` to wire hook. Single `curl | sh` = fully working setup.
- **D-10:** Ad hoc signing only (`codesign --force --sign -`). No Apple Developer account needed. Satisfies DIST-04. Full notarization is v2.

### Claude's Discretion
- Exact `install.sh` messaging and formatting (beyond PATH warning requirement)
- cargo-dist configuration details (compression, artifact naming)
- Error handling in `plan-reviewer install` for malformed `settings.json`
- Whether to print a post-install summary showing what was configured

### Deferred Ideas (OUT OF SCOPE)
- Multi-integration selector for `install`/`uninstall` (opencode, etc.) — Phase 4
- `plan-reviewer uninstall` — Phase 4
- `plan-reviewer update` — Phase 4
- Full Apple notarization (DIST-06) — v2
- `cargo install` / crates.io distribution (DIST-05) — v2
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIST-01 | Pre-built binaries for darwin-arm64, darwin-x64, linux-musl-x64, linux-musl-arm64 published to GitHub Releases | cargo-dist 0.31.x supports all four targets; aarch64-musl via cargo-zigbuild (v0.26+). |
| DIST-02 | Install script installs with single `curl \| sh`, no Rust/Node required | cargo-dist generates hosted `install.sh`; custom wrapper calls `plan-reviewer install`. |
| DIST-03 | Install script detects PATH and warns if install dir not on PATH | cargo-dist's shell installer already warns about PATH. Custom wrapper must preserve this. |
| DIST-04 | macOS binaries ad hoc code-signed to satisfy Gatekeeper | curl installs don't set quarantine xattr → Gatekeeper not triggered. Ad hoc signing still required on Apple Silicon for AMFI. Must be done as a GitHub Actions post-build step. |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase |
|-----------|----------------|
| Rust-only tech stack; no runtime dependency | cargo-dist produces self-contained binaries; no Node.js needed at user install time |
| Distribution via `curl \| sh`, no package manager | cargo-dist shell installer is the distribution vehicle |
| `vendored-libgit2` feature required | Must carry through to all cross-compiled targets; already declared in Cargo.toml |
| Binary size conscious (tokio feature subset) | No new "full" feature additions for the install subcommand |
| All stderr for diagnostics, stdout only for hook JSON | `plan-reviewer install` output goes to stdout (user-facing), NOT to hook stdout. The subcommand is never invoked as a hook, so this constraint is naturally satisfied. |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cargo-dist | 0.31.0 | Cross-compilation, GitHub Release creation, shell installer generation | D-01 locked decision; supports all 4 required targets including aarch64-musl via cargo-zigbuild |
| clap | 4.x (already in Cargo.toml) | CLI argument parsing with subcommands | Already in use; derive macro supports `Option<Commands>` for default behavior |
| serde_json | 1.x (already in Cargo.toml) | Read-modify-write `~/.claude/settings.json` | Already in use; `serde_json::Value` for arbitrary JSON manipulation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cargo-zigbuild | (cargo-dist internal) | Cross-compile aarch64-linux-musl on ubuntu-latest runner | Used automatically by cargo-dist for the aarch64-unknown-linux-musl target |

**No new Rust dependencies required.** The install subcommand only needs `std::fs`, `std::path`, `serde_json`, and `clap` — all already present.

**Installation (cargo-dist):**
```bash
cargo install cargo-dist --version "^0.31"
```

**Version verification:**
```
cargo-dist: 0.31.0 [VERIFIED: github.com/axodotdev/cargo-dist/releases, 2026-04-10]
```

---

## Architecture Patterns

### Cargo.toml Changes Required

**1. Add `[[bin]]` section** (D-03 — rename binary output):
```toml
[[bin]]
name = "plan-reviewer"
path = "src/main.rs"
```

**2. Add `[workspace.metadata.dist]` section** (cargo-dist configuration):
```toml
[workspace.metadata.dist]
cargo-dist-version = "0.31.0"
ci = ["github"]
installers = ["shell"]
targets = [
  "aarch64-apple-darwin",
  "x86_64-apple-darwin",
  "x86_64-unknown-linux-musl",
  "aarch64-unknown-linux-musl",
]
install-path = ["$HOME/.local/bin"]
# cargo-zigbuild is used automatically for aarch64-unknown-linux-musl
github-build-setup = ".github/build-setup.yml"
```

**Note:** The `install-path` value may need to be `["~/.local/bin"]` or `"$HOME/.local/bin"` — verify exact syntax with `dist init` output. [ASSUMED — exact install-path value for ~/.local/bin not confirmed from official docs]

### build-setup.yml (Pre-Build Steps for Frontend)

cargo-dist v0.20.0+ supports injecting pre-build GitHub Actions steps via `github-build-setup`. Since `build.rs` calls `npm install && npm run build`, the CI runner needs Node.js available before the Rust build starts.

**`.github/build-setup.yml`:**
```yaml
- name: Install Node.js
  uses: actions/setup-node@v4
  with:
    node-version: "20"
- name: Build frontend assets
  run: |
    cd ui
    npm install
    npm run build
```

**CRITICAL:** This pre-build file is injected into every `build-local-artifacts` job, including the Linux musl jobs. Since `build.rs` checks `SKIP_FRONTEND_BUILD`, the Linux runners can re-use the pre-built assets OR skip the build. However, the cleanest approach is to set `SKIP_FRONTEND_BUILD=1` in the cargo-dist build environment for musl targets and pre-build the frontend on the GitHub runner before invoking cargo. Alternatively, since Node.js is available on `ubuntu-latest` runners by default, the `npm` approach in `build-setup.yml` works for all four target builds.

**However:** aarch64-musl cross-compiles FROM `ubuntu-latest` using cargo-zigbuild, so Node.js IS available on that runner. No special handling needed — `build-setup.yml` runs on all runners uniformly.

### macOS Ad Hoc Codesigning

cargo-dist has no built-in TOML key for macOS ad hoc signing. [VERIFIED: cargo-dist docs only document `ssldotcom-windows-sign` for signing, 2026-04-10]

The signing step must be injected as a post-build action. Two options:

**Option A: In `github-build-setup.yml` (runs before build — won't work post-build)**

**Option B: Custom post-build step via `build-local-artifacts` custom job override**

**Option C: Use `taiki-e/upload-rust-binary-action` which has a built-in `codesign` input** — but this conflicts with locked decision D-01 (cargo-dist).

**Practical workaround within cargo-dist:** Add a step to the `github-build-setup.yml` that signs binaries. But `github-build-setup` runs BEFORE the build, not after.

**Actual resolution:** cargo-dist does not support post-build injection. The codesign must happen inside a custom `build-local-artifacts = false` workflow where cargo-dist's build step is replaced, OR by adding a separate GitHub Actions step that modifies the built archives after `dist build`. The cleanest approach is:

1. Let cargo-dist build normally
2. In `.github/workflows/release.yml` (after `dist init` generates it), manually add a codesign step after `dist build` in the macOS build job

**But cargo-dist regenerates `.github/workflows/release.yml` on every `dist init` run**, overwriting manual edits.

**Best path forward:** Use `github-build-setup` only for pre-build steps, and accept that cargo-dist will regenerate the workflow. For macOS ad hoc signing, use a custom build workflow that wraps cargo-dist rather than editing the generated file.

**Alternative:** Since `curl | sh` does not set `com.apple.quarantine`, Gatekeeper is NOT triggered for command-line tools installed this way. Ad hoc signing is still recommended for Apple Silicon AMFI compatibility, but it can be done as a step in `github-build-setup` by not actually building during that step — instead it would be a no-op pre-build marker. The actual signing happens in a separate step that we must add manually to the workflow. [ASSUMED: cargo-dist generated workflows can have manual steps added without them being overwritten if `cargo dist init` is not re-run]

**Pragmatic approach for Phase 3:** Document that the generated `release.yml` requires a manual codesign step added to macOS build jobs, and that this step must be re-added if `dist init` is ever run again.

### Clap Subcommand Refactor (D-05)

The current `Args` struct must become an `Option<Commands>` structure where no subcommand = hook behavior.

**Pattern for "no subcommand = default behavior":**
```rust
// Source: clap derive docs + github.com/clap-rs/clap/discussions/5433
#[derive(Parser, Debug)]
#[command(version, about = "Claude Code plan reviewer hook binary")]
struct Cli {
    /// Skip opening the browser (hook mode only)
    #[arg(long, global = true, default_value_t = false)]
    no_browser: bool,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Wire the ExitPlanMode hook into ~/.claude/settings.json
    Install,
}

fn main() {
    let cli = Cli::parse();
    match cli.command {
        None => run_hook_flow(cli.no_browser),  // D-05: default = hook
        Some(Commands::Install) => run_install(),
    }
}
```

**Key attribute:** `#[arg(global = true)]` on `--no-browser` so it appears in `plan-reviewer --help` but is irrelevant when using subcommands. Alternatively, remove `--no-browser` from the global scope and only attach it when there's no subcommand.

**Cleaner pattern** (avoids global flag confusion):
```rust
#[derive(Parser, Debug)]
#[command(version, about)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    #[command(flatten)]
    hook_args: HookArgs,  // only used when command is None
}

#[derive(Args, Debug)]
struct HookArgs {
    #[arg(long, default_value_t = false)]
    no_browser: bool,
}
```

[VERIFIED: clap docs at docs.rs/clap/latest/clap/_derive, 2026-04-10]

### `plan-reviewer install` — JSON Read-Modify-Write

The install subcommand writes to `~/.claude/settings.json`. The exact JSON structure is confirmed from the live file on this machine:

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "ExitPlanMode",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/plan-reviewer"
          }
        ]
      }
    ]
  }
}
```

**Implementation pattern (serde_json):**
```rust
// Source: docs.rs/serde_json [VERIFIED]
// 1. Resolve binary path (current executable)
let binary_path = std::env::current_exe()?.to_string_lossy().into_owned();

// 2. Read existing settings (or start from empty object)
let settings_path = dirs::home_dir()
    .unwrap()
    .join(".claude/settings.json");

let mut root: serde_json::Value = if settings_path.exists() {
    let content = std::fs::read_to_string(&settings_path)?;
    serde_json::from_str(&content).unwrap_or(serde_json::Value::Object(Default::default()))
} else {
    serde_json::Value::Object(Default::default())
};

// 3. Navigate/create: root.hooks.PermissionRequest[]
// 4. Check idempotency: is ExitPlanMode hook already present with same binary?
// 5. If not present, push the hook entry
// 6. Write back with pretty-printing
let output = serde_json::to_string_pretty(&root)?;
std::fs::create_dir_all(settings_path.parent().unwrap())?;
std::fs::write(&settings_path, output)?;
```

**Note on formatting:** `serde_json::to_string_pretty` rewrites the entire file with 2-space indentation. This is acceptable — the formatting changes but the semantics are preserved. [VERIFIED: serde_json docs 2026-04-10]

**Idempotency check:** Before inserting, scan `root["hooks"]["PermissionRequest"]` array for any entry with `matcher == "ExitPlanMode"`. If found with same binary path → no-op + message. If found with different path → warn but do not overwrite (user may have custom setup). If not found → insert.

**New dependency needed:** `dirs` crate for cross-platform `~` expansion, OR use `std::env::var("HOME")` directly. Using `std::env::var("HOME")` is simpler and avoids a new dependency. [ASSUMED: HOME env var is always set on macOS/Linux; this is true in practice but not guaranteed by POSIX]

### Custom `install.sh` Wrapper (D-09)

Decision D-09 requires the install script to call `plan-reviewer install` after placing the binary. cargo-dist's shell installer **cannot run post-install commands** [VERIFIED: cargo-dist docs, 2026-04-10].

**Two options:**

**Option A: Host a custom `install.sh` alongside cargo-dist artifacts**
A hand-written script that:
1. Downloads the cargo-dist installer
2. Runs it (drops binary to `~/.local/bin`)
3. Calls `~/.local/bin/plan-reviewer install`
4. Detects PATH and warns (DIST-03)

This is what D-09 implies. The script is hosted in the repo (e.g., `install.sh` at repo root) and linked from `README.md`.

**Option B: Use cargo-dist's `install-success-msg` to prompt user**
Set a success message telling the user to run `plan-reviewer install` manually.

**D-09 explicitly says:** "The cargo-dist generated install.sh drops the binary then calls `plan-reviewer install` to wire the hook." This means Option A — a custom wrapper.

**Custom `install.sh` structure:**
```bash
#!/bin/sh
set -eu

# 1. Detect platform (uname -s, uname -m)
# 2. Download correct binary archive from GitHub Releases
# 3. Extract to ~/.local/bin/plan-reviewer
# 4. Check PATH, warn if ~/.local/bin not on PATH
# 5. Call plan-reviewer install
# 6. Print success message
```

OR alternatively: call cargo-dist's generated installer, then call `plan-reviewer install`.

**PATH warning (DIST-03):** Check `echo "$PATH" | grep -q "$HOME/.local/bin"` and print a warning if not found. Include shell-specific instructions for adding to PATH.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub Release creation | Manual gh CLI script | cargo-dist | Handles versioning, checksums, manifests, installer hosting |
| musl cross-compilation | Cross.toml + Docker | cargo-dist + cargo-zigbuild | cargo-dist v0.26+ handles this automatically |
| shell installer script | Custom downloader | cargo-dist shell installer (as base) | Already handles platform detection, archive extraction, PATH management |
| Binary archive format | Custom tar/zip | cargo-dist default (`.tar.xz` on Unix) | Consistent format, checksum files included automatically |
| JSON Value navigation | Custom recursive fn | `serde_json::Value` pointer/index | Handles all edge cases including missing keys at any depth |

---

## Common Pitfalls

### Pitfall 1: build.rs Requires Node.js During Cross-Compilation
**What goes wrong:** `build.rs` runs `npm install && npm run build`. On a GitHub runner cross-compiling for musl, `npm` must be available before the build starts.
**Why it happens:** cargo runs `build.rs` on the host (not the target), so the runner needs Node.js even when cross-compiling.
**How to avoid:** Use `github-build-setup` to run `npm run build` before the Rust compile. The pre-built `ui/dist/` artifacts are embedded via rust-embed. Since `build.rs` checks `SKIP_FRONTEND_BUILD`, if the build step already ran, it won't re-run.
**Warning signs:** CI fails with "npm: command not found" or "Frontend assets not found at ui/dist/index.html"

### Pitfall 2: Binary Name Mismatch
**What goes wrong:** Current Cargo.toml has no `[[bin]]` section, so the binary is named after the package: `claude-plan-reviewer`. Decision D-03 renames it to `plan-reviewer`.
**Why it happens:** Without an explicit `[[bin]]` name, cargo uses the package name.
**How to avoid:** Add `[[bin]]` section with `name = "plan-reviewer"` before running `cargo dist init`.
**Warning signs:** After install, `plan-reviewer` not found but `claude-plan-reviewer` exists.

### Pitfall 3: cargo-dist Regenerates release.yml
**What goes wrong:** Any manual edits to `.github/workflows/release.yml` are lost when `cargo dist init` is re-run.
**Why it happens:** cargo-dist owns the generated workflow file.
**How to avoid:** Use `github-build-setup` for all pre-build customization. For post-build steps (codesign), document that they must be re-applied manually after `dist init`.
**Warning signs:** Codesign step missing after a `dist init` run.

### Pitfall 4: serde_json Overwrites Existing Settings Formatting
**What goes wrong:** `plan-reviewer install` rewrites `~/.claude/settings.json` with different indentation/formatting.
**Why it happens:** `serde_json::to_string_pretty` re-formats the entire file.
**How to avoid:** This is expected behavior — document it. The JSON content is semantically preserved. Consider a note in the output to the user.
**Warning signs:** User complains about formatting changes. Not a bug — just cosmetic.

### Pitfall 5: install subcommand reads stdin (hook path conflict)
**What goes wrong:** When invoked as a hook (no subcommand), `main()` reads stdin to get `HookInput`. If `plan-reviewer install` is called directly, stdin is the terminal, and the program hangs waiting for input.
**Why it happens:** The current `main()` reads stdin before checking the subcommand.
**How to avoid:** Parse CLI args FIRST, then branch: if subcommand is `Install`, run install logic (no stdin read). If no subcommand, read stdin for hook flow.
**Warning signs:** `plan-reviewer install` hangs waiting for input.

### Pitfall 6: `codesign` not available on all macOS GitHub runners
**What goes wrong:** `codesign` is part of Xcode Command Line Tools. On `macos-latest` GitHub runners, it should be pre-installed, but it's worth verifying.
**Why it happens:** Some stripped-down runner images may lack it.
**How to avoid:** Add `xcode-select --install` or verify `codesign --version` in the GitHub Actions step.
**Warning signs:** CI fails with "codesign: command not found"

### Pitfall 7: `dirs` crate or HOME resolution
**What goes wrong:** On unusual setups, `HOME` env var is not set or points to an unexpected location.
**Why it happens:** Edge case on some Linux containers or non-interactive shells.
**How to avoid:** Use `std::env::var("HOME")` with a clear error message if unset. Alternatively add the `dirs` crate (v5.x) for robust path resolution.
**Warning signs:** `plan-reviewer install` fails with "HOME not set"

---

## Code Examples

### 1. Cargo.toml `[[bin]]` and `[workspace.metadata.dist]`

```toml
# Source: cargo-dist docs, CONTEXT.md D-01 through D-04
[[bin]]
name = "plan-reviewer"
path = "src/main.rs"

[workspace.metadata.dist]
cargo-dist-version = "0.31.0"
ci = ["github"]
installers = ["shell"]
targets = [
  "aarch64-apple-darwin",
  "x86_64-apple-darwin",
  "x86_64-unknown-linux-musl",
  "aarch64-unknown-linux-musl",
]
install-path = ["~/.local/bin"]
github-build-setup = ".github/build-setup.yml"
```

### 2. `.github/build-setup.yml` (Pre-Build Frontend)

```yaml
# Source: cargo-dist v0.20.0+ github-build-setup feature
- name: Install Node.js
  uses: actions/setup-node@v4
  with:
    node-version: "20"
- name: Build frontend assets
  working-directory: ui
  run: |
    npm install
    npm run build
```

### 3. Clap Subcommand Structure (src/main.rs refactor)

```rust
// Source: docs.rs/clap/latest/clap/_derive
use clap::{Parser, Subcommand};

#[derive(Parser, Debug)]
#[command(version, about = "Claude Code plan reviewer hook binary")]
struct Cli {
    /// Skip opening the browser and print the review URL to stderr only
    #[arg(long, default_value_t = false)]
    no_browser: bool,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Wire the ExitPlanMode hook into ~/.claude/settings.json (Claude Code only)
    Install,
}

fn main() {
    let cli = Cli::parse();

    match &cli.command {
        Some(Commands::Install) => {
            // Does NOT read stdin. Runs install logic, prints to stdout.
            run_install();
        }
        None => {
            // Hook flow: read stdin, run review, write to stdout
            run_hook_flow(cli.no_browser);
        }
    }
}
```

### 4. `plan-reviewer install` JSON Manipulation

```rust
// Source: docs.rs/serde_json/latest [VERIFIED]
fn run_install() {
    let binary_path = std::env::current_exe()
        .expect("cannot determine binary path")
        .to_string_lossy()
        .into_owned();

    let home = std::env::var("HOME").expect("HOME not set");
    let settings_path = std::path::PathBuf::from(&home)
        .join(".claude/settings.json");

    // Read or create empty object
    let mut root: serde_json::Value = if settings_path.exists() {
        let content = std::fs::read_to_string(&settings_path)
            .expect("cannot read settings.json");
        serde_json::from_str(&content)
            .unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Ensure hooks.PermissionRequest is an array
    root["hooks"]["PermissionRequest"]
        .get_or_insert(serde_json::json!([]));

    let hooks_arr = root["hooks"]["PermissionRequest"]
        .as_array_mut()
        .expect("hooks.PermissionRequest must be an array");

    // Idempotency: check if ExitPlanMode hook already present
    let already_present = hooks_arr.iter().any(|entry| {
        entry["matcher"].as_str() == Some("ExitPlanMode")
    });

    if already_present {
        println!("plan-reviewer: ExitPlanMode hook already configured (no changes made)");
        return;
    }

    // Insert new hook entry
    hooks_arr.push(serde_json::json!({
        "matcher": "ExitPlanMode",
        "hooks": [{
            "type": "command",
            "command": binary_path
        }]
    }));

    // Write back (pretty-printed)
    std::fs::create_dir_all(settings_path.parent().unwrap())
        .expect("cannot create ~/.claude directory");
    let output = serde_json::to_string_pretty(&root)
        .expect("cannot serialize settings.json");
    std::fs::write(&settings_path, output)
        .expect("cannot write settings.json");

    println!("plan-reviewer: ExitPlanMode hook installed at {}", settings_path.display());
}
```

### 5. macOS Ad Hoc Codesign in GitHub Actions

```yaml
# To be added MANUALLY to .github/workflows/release.yml after dist init
# in the macOS build job steps, AFTER the "dist build" step
- name: Ad hoc codesign macOS binary
  if: runner.os == 'macOS'
  run: |
    # Sign each built archive's binary
    # cargo-dist archives are in target/distrib/
    find target/distrib -name "plan-reviewer" -type f | xargs -I{} \
      codesign --force --sign - {}
```

**Note:** The exact path where cargo-dist places binaries before archiving must be verified by inspecting a CI run's output. [ASSUMED: target/distrib is the staging area — verify in practice]

### 6. Custom `install.sh` Wrapper Structure

```sh
#!/bin/sh
# install.sh — wrapper around cargo-dist installer that also wires the Claude Code hook
set -eu

INSTALL_DIR="${HOME}/.local/bin"
GITHUB_REPO="USER/claude-plan-reviewer"  # replace with actual repo

# Detect platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# ... (download correct archive, extract to $INSTALL_DIR)
# ... (call cargo-dist generated installer, or download/extract directly)

# Wire the hook
"${INSTALL_DIR}/plan-reviewer" install

# PATH warning (DIST-03)
case ":${PATH}:" in
  *":${INSTALL_DIR}:"*) ;;
  *)
    echo ""
    echo "WARNING: ${INSTALL_DIR} is not on your PATH."
    echo "Add the following to your shell profile:"
    echo "  export PATH=\"\${HOME}/.local/bin:\${PATH}\""
    ;;
esac

echo "plan-reviewer installed successfully. Run 'plan-reviewer --help' to get started."
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| cargo-dist manual Linux aarch64 workaround | cargo-zigbuild automatic support | v0.26.0 (Aug 2024) | aarch64-musl works without custom runner config |
| cargo-dist config in `Cargo.toml` only | `dist-workspace.toml` also supported | v0.20.0+ | Can use separate config file; Cargo.toml approach still works |
| Hand-roll GitHub Actions workflow | cargo-dist generated + `github-build-setup` | v0.20.0+ | Pre-build steps injectable without owning the full workflow |

**Deprecated/outdated:**
- `cargo-dist-version` in Cargo.toml is still the right approach for single-crate projects (no separate workspace file needed)
- Old `[package.metadata.dist]` is equivalent to `[workspace.metadata.dist]` for single-crate repos

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `install-path = ["~/.local/bin"]` is the exact TOML syntax for cargo-dist | Standard Stack / Code Examples | `dist init` may use different syntax; must run `dist init` to confirm |
| A2 | cargo-dist places built binaries in `target/distrib/` before archiving | Code Examples §5 | Codesign step targets wrong path; would fail silently |
| A3 | Manual edits to release.yml survive if `dist init` is not re-run | Pitfall 3 | Codesign step is overwritten; DIST-04 not satisfied |
| A4 | `HOME` env var is always set when `plan-reviewer install` is invoked | Code Examples §4 | Install fails on unusual environments; use `dirs` crate as fallback |
| A5 | `serde_json::Value` index operator (`["key"]`) creates nested keys if missing | Code Examples §4 | JSON manipulation panics on absent keys; use `entry()` API instead |
| A6 | `github-build-setup` runs on all build matrix runners including musl | Architecture Patterns | npm not run for musl; rust-embed serves empty or stale assets |

---

## Open Questions

1. **How does cargo-dist's codesign step work exactly?**
   - What we know: cargo-dist v0.30.0 added macOS codesigning via `CODESIGN_OPTIONS` env var; issue #1121 was closed.
   - What's unclear: Is there a TOML key to enable it? Does it do ad hoc by default? Or only with a certificate?
   - Recommendation: Run `cargo dist init` and inspect the generated workflow to see if a codesign step is auto-generated. If not, add manual step.

2. **Does `serde_json::Value["key"]` create the key if absent?**
   - What we know: `Value::Index` returns `Value::Null` for missing keys on objects but does NOT create them.
   - What's unclear: The `get_or_insert` approach in the code example may need to be replaced with `entry()` API.
   - Recommendation: Use `root.as_object_mut().unwrap().entry("hooks").or_insert(json!({}))` chain pattern for safe nested creation.

3. **Exact install-path syntax for `~/.local/bin` in cargo-dist**
   - What we know: cargo-dist supports `CARGO_HOME`, `~/.subdir`, and `$VAR/subdir` patterns.
   - What's unclear: Does it support a plain array `["~/.local/bin"]` or a different syntax for this path?
   - Recommendation: Run `cargo dist init --yes` and inspect generated config to verify exact syntax.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| cargo | Rust build | Yes | 1.94.1 (Homebrew) | — |
| Node.js | build.rs frontend build | Yes | v25.8.1 | — |
| npm | build.rs frontend build | Yes | 11.11.0 | — |
| cargo-dist | Release automation | No (not installed) | — | Install: `cargo install cargo-dist` |
| codesign | macOS ad hoc signing | No (Xcode CLI tools not in PATH) | — | Available on GitHub Actions `macos-latest` runners |
| GitHub repo with Actions enabled | CI/CD | Not verified locally | — | Required for release pipeline |

**Missing dependencies with no fallback:**
- cargo-dist must be installed locally to run `dist init` (one-time setup)
- GitHub repository must have Actions enabled and `GITHUB_TOKEN` write permissions to releases

**Missing dependencies with fallback:**
- codesign is not in the local PATH but IS available on macOS GitHub Actions runners

---

## Sources

### Primary (HIGH confidence)
- cargo-dist 0.31.0 release notes — [github.com/axodotdev/cargo-dist/releases](https://github.com/axodotdev/cargo-dist/releases) — version, musl support, codesign
- cargo-dist v0.26.0 release — cargo-zigbuild + aarch64-musl support confirmed
- cargo-dist configuration reference — [axodotdev.github.io/cargo-dist/book/reference/config.html](https://axodotdev.github.io/cargo-dist/book/reference/config.html) — install-path, targets, installers keys
- cargo-dist shell installer docs — no post-install hooks confirmed
- cargo-dist `github-build-setup` feature — v0.20.0 release notes; confirmed YAML injection mechanism
- clap derive docs — [docs.rs/clap/latest/clap/_derive](https://docs.rs/clap/latest/clap/_derive/index.html) — `Option<Commands>` pattern for default behavior
- serde_json docs — [docs.rs/serde_json](https://docs.rs/serde_json/latest/serde_json/) — Value read-modify-write
- Claude Code hooks reference — [code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks) — exact `~/.claude/settings.json` JSON structure
- Live `~/.claude/settings.json` inspection — confirmed exact hook JSON format on target machine

### Secondary (MEDIUM confidence)
- macOS Gatekeeper quarantine mechanics — HackTricks, rsms gist: curl does NOT set `com.apple.quarantine`; Gatekeeper only checks quarantined files
- cargo-dist issue #1121 — Apple codesign support closed; v0.30.0 added CODESIGN_OPTIONS but no documented TOML key for ad hoc signing
- cargo-dist issue #1581 — aarch64-musl cross-compile fixed (closed Nov 2024); workaround via .cargo/config.toml linker settings documented

### Tertiary (LOW confidence)
- `target/distrib/` as cargo-dist binary staging path — inferred from workflow inspection; not from official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — cargo-dist 0.31.x verified from releases page; all four targets confirmed supported
- Architecture patterns: MEDIUM — github-build-setup and install-path exact syntax needs `dist init` verification
- macOS signing: MEDIUM — Gatekeeper/quarantine mechanics well-sourced; cargo-dist's exact codesign integration unclear
- Clap patterns: HIGH — from official clap docs
- settings.json manipulation: HIGH — confirmed from live settings file + official Claude Code docs
- install.sh structure: MEDIUM — based on cargo-dist shell installer limitations (confirmed) + custom wrapper pattern

**Research date:** 2026-04-10
**Valid until:** 2026-07-10 (cargo-dist releases frequently; re-verify if dist init behavior changes)
