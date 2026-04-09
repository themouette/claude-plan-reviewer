# Domain Pitfalls

**Domain:** Single Rust binary with embedded web UI, distributed via curl|sh
**Researched:** 2026-04-09
**Confidence:** HIGH (protocol behavior from official Claude Code docs; glibc/signing from official Rust/Apple sources; rust-embed behavior from crate docs)

---

## Critical Pitfalls

Mistakes that cause rewrites, hard blockers, or user-facing failures at install time.

---

### Pitfall 1: Linux glibc version mismatch

**What goes wrong:** Rust binaries link dynamically to glibc by default. A binary compiled on Ubuntu 24 LTS (glibc 2.39) silently refuses to run on Ubuntu 20 LTS (glibc 2.31) with the cryptic message `version 'GLIBC_2.33' not found`. Users on enterprise Linux, Docker images, or WSL distros with older glibc will hit this immediately.

**Why it happens:** `rustc` links against the host system's glibc at compile time. The resulting binary encodes the minimum required version. GitHub-hosted Actions runners use recent Ubuntu images, so CI-produced binaries carry a high glibc floor by default.

**Warning sign:** The error message: `./plan-reviewer: /lib/x86_64-linux-gnu/libc.so.6: version 'GLIBC_X.YY' not found`.

**Consequences:** Binary silently fails to run on a large fraction of Linux systems. Users who just ran `curl | sh` get a cryptic error with no obvious fix. Support burden spikes.

**Prevention:**
- Build Linux targets against musl (`x86_64-unknown-linux-musl`, `aarch64-unknown-linux-musl`) for fully static binaries with zero libc dependency.
- If musl is not viable (e.g., a transitive C dependency refuses to compile with musl), use the `manylinux2014` build container (`quay.io/pypa/manylinux2014_x86_64`) which pins glibc to exactly 2.17 — acceptable to nearly all Linux distributions still in use.
- Use `houseabsolute/actions-rust-cross` GitHub Action, which wraps the `cross` tool in Docker containers with appropriate glibc targets.

**Detection:** After every CI build, run `objdump -p target/x86_64-unknown-linux-musl/release/plan-reviewer | grep GLIBC` — for a musl binary this should produce no output.

**Phase:** Binary distribution phase (cross-compile + release CI setup).

---

### Pitfall 2: macOS Gatekeeper blocks unsigned binaries on Sequoia 15+

**What goes wrong:** macOS 15 Sequoia (released 2024) closes the Ctrl+click bypass that previously let users run unnotarized binaries without Gatekeeper warnings. The Finder-level workaround is gone. CLI binaries downloaded via curl and executed in Terminal are *not* automatically quarantined (curl does not set `com.apple.quarantine`), so Gatekeeper does not block them — **but** if a user downloads via a browser or copies the binary between machines, the quarantine flag is set and macOS 15.1+ blocks execution with no user-accessible bypass.

**Why it happens:** Apple tightened Gatekeeper in Sequoia. The "right-click Open" bypass that worked since Mojave was removed in 15.1. CLI tools cannot be notarized directly (only `.app`, `.pkg`, `.dmg` containers can be notarized). Apple Silicon (ARM64) additionally *requires* code signing — at minimum an ad hoc signature — for native ARM code to execute at all.

**Warning sign:** User reports "the binary can't be opened because it's from an unidentified developer" or "operation not permitted" on macOS.

**Consequences:** darwin-arm64 and darwin-x64 targets are unusable for any user who received the binary through any channel other than a direct curl call. Blocks adoption on macOS entirely if not addressed.

**Prevention:**
- Ad hoc sign the binary as part of the release pipeline: `codesign --sign - --force --preserve-metadata=entitlements,requirements,flags,runtime ./plan-reviewer`. This satisfies the ARM64 signing requirement and suppresses most Gatekeeper friction for terminal users.
- For full Gatekeeper bypass (for browser-downloaded binaries), notarize a `.pkg` or `.dmg` wrapper using the `apple-codesign` Rust crate (supports CI without macOS hardware) combined with a valid Apple Developer ID certificate. This is a non-trivial one-time setup.
- The install script should detect macOS and run `xattr -d com.apple.quarantine ./plan-reviewer 2>/dev/null || true` after download as a belt-and-suspenders measure.

**Detection:** After building, verify: `codesign -dv ./plan-reviewer` should show a signature (ad hoc is acceptable); `spctl -a -v ./plan-reviewer` shows Gatekeeper assessment.

**Phase:** Binary distribution phase. Ad hoc signing: Phase 1. Full notarization: defer unless user reports force it.

---

### Pitfall 3: Hook stdout contamination causes JSON parse failure in Claude Code

**What goes wrong:** Claude Code spawns the hook binary in a non-interactive shell that sources the user's `~/.zshrc` or `~/.bashrc`. Any `echo`, `printf`, or `print` statement in those profiles that runs unconditionally prepends garbage text to the hook's stdout. Claude Code tries to parse the entire stdout as JSON and fails with `SyntaxError: Unexpected token 'C', "Claude con"...` or similar.

**Why it happens:** Claude Code's `PermissionRequest` hook protocol requires that stdout contain *only* the decision JSON object (e.g., `{"hookSpecificOutput": {"hookEventName": "PermissionRequest", "decision": {"behavior": "allow"}}}`). Any non-JSON prefix — even a single newline — breaks parsing.

**Warning sign:** Hook "fires" (process starts) but Claude Code shows a JSON validation error. Users with a greeting message in their shell profile (`echo "Hello $USER"`, nvm/conda/rbenv init output, etc.) hit this immediately.

**Consequences:** The hook always fails to return a valid response. Claude Code either falls back to prompting the user (unexpected behavior) or blocks tool use entirely. The user sees no clear explanation.

**Prevention:**
- The Rust binary must write exclusively to stdout as the final, single output. All diagnostic output — progress messages, debug logs, startup banners — must go to **stderr only**.
- The install instructions must explicitly warn users about shell profile contamination with the `$-` guard pattern.
- Consider validating at startup: read a few bytes from the environment and warn via stderr if stdin is not a valid JSON object.
- Never use `println!()` for anything except the final JSON response. Use `eprintln!()` for all logging.

**Detection:** Run `echo '{"hook_event_name":"PermissionRequest","tool_name":"ExitPlanMode"}' | ./plan-reviewer 2>/dev/null | python3 -m json.tool` — this must succeed cleanly.

**Phase:** Core hook protocol implementation (Phase 1 / first milestone).

---

### Pitfall 4: Hook process killed by Claude Code timeout before user completes review

**What goes wrong:** Claude Code hooks have a default timeout of 10 minutes, configurable per hook. If the user opens the browser review UI and takes longer than the configured timeout (or the default 10 minutes), Claude Code kills the hook process without warning. The hook's stdout is discarded. Claude Code behaves as if the hook did not exist — it proceeds with the default behavior (prompting the user interactively).

**Why it happens:** This is documented behavior. Claude Code kills hooks that exceed `timeout` seconds. Default is 10 minutes but users may configure shorter values. A "review all the files" use case can easily exceed 10 minutes.

**Warning sign:** Users report that Claude Code proceeds past the plan review without their approval, or that the browser tab is left open with no result after ~10 minutes.

**Consequences:** User's explicit review is silently dropped. This is a correctness failure — the tool's core purpose (intercepting plan approval) is defeated.

**Prevention:**
- Implement a visible countdown timer in the review UI showing the remaining hook timeout.
- The binary should read the timeout from an environment variable or CLI flag, defaulting to 8 minutes (20% buffer under the 10-minute default), and self-terminate cleanly before Claude Code kills it — returning a "timed out" deny response with a clear message.
- Install instructions must document how to set a longer timeout in `settings.json`: `"timeout": 1200` for 20 minutes.

**Detection:** Test by setting `"timeout": 10` in settings.json and verifying the binary returns a deny response before the 10-second mark.

**Phase:** Core hook integration (Phase 1). Countdown UI: Phase 2 (review UI).

---

## Moderate Pitfalls

---

### Pitfall 5: rust-embed debug vs. release path resolution mismatch causes "assets not found" in development

**What goes wrong:** `rust-embed` behaves fundamentally differently in debug vs. release builds. In debug mode (without the `debug-embed` feature), the crate reads files from the filesystem at runtime, resolving paths relative to the *current working directory at runtime* — not relative to `Cargo.toml`. In release mode, paths are resolved at compile time relative to `Cargo.toml` and baked into the binary. Running `cargo run` from a different directory than the project root produces "asset not found" panics in debug that do not reproduce in release.

**Why it happens:** This is a deliberate rust-embed design choice to speed up development iteration (filesystem reads instead of recompile). But it makes the debug experience inconsistent with the release experience.

**Warning sign:** `cargo run` from a parent directory or a CI working directory fails to serve assets; `cargo build --release && ./target/release/plan-reviewer` works fine.

**Prevention:**
- Always run `cargo run` from the project root (where `Cargo.toml` lives) during development.
- Add `debug-embed` to `[features]` and enable it in the dev profile or via `CARGO_FEATURE_DEBUG_EMBED=1` to get release-equivalent behavior in debug builds.
- Add an explicit `assets/` directory existence check at startup with a helpful error message pointing to the correct working directory.

**Detection:** Run `cargo run` from `/tmp` — it should produce a clear error message, not a silent hang or panic.

**Phase:** Embedded asset phase (Phase 2 / UI embedding). Document in contributor guide.

---

### Pitfall 6: Port conflict causes server bind failure with no user feedback

**What goes wrong:** The HTTP server attempts to bind to a fixed port (e.g., 7878). If another process already occupies that port, `TcpListener::bind()` fails. If this error is not surfaced clearly, the binary exits silently and Claude Code receives no response, proceeding as if the hook wasn't configured.

**Why it happens:** Developers often run multiple local tools simultaneously. Ports in the 7000-9000 range are commonly used by development servers, Jupyter, Vite, etc.

**Warning sign:** Binary exits with exit code 1 with only a low-level OS error message; no browser opens; Claude Code proceeds without review.

**Prevention:**
- Use port 0 (OS assigns an ephemeral port) for the listener: `TcpListener::bind("127.0.0.1:0")`. Read back the actual assigned port with `listener.local_addr()?.port()`. Pass this port into the URL opened in the browser.
- Alternatively, try a range of ports (e.g., 7878..7898) and bind to the first available one.
- On bind failure, write a clear diagnostic to stderr: "Could not bind to port XXXX: address in use. Try killing the process on that port."
- Never exit silently on bind failure — always write to stderr and return a deny JSON to stdout.

**Detection:** Start `nc -l 7878` before running the binary — the binary must still succeed (using ephemeral port) or produce a clear error.

**Phase:** HTTP server phase (Phase 1/2 depending on ordering). Use port 0 from day one.

---

### Pitfall 7: Browser fails to open in CI, SSH sessions, or remote/headless environments

**What goes wrong:** The `webbrowser` crate calls the platform's default browser open command (`open` on macOS, `xdg-open` on Linux). In SSH sessions without X11 forwarding, Docker containers, CI environments, and some WSL configurations, no DISPLAY is set and no GUI is available. The browser open call fails silently or hangs.

**Why it happens:** `webbrowser` is designed for desktop environments. It is non-blocking for GUI browsers but falls back to text-mode browsers (lynx) which block. In environments with no browser at all, the command may fail silently.

**Warning sign:** Binary starts, server binds, but no browser opens. Process hangs waiting for the user to submit a review that they cannot see.

**Prevention:**
- After calling `webbrowser::open()`, print the server URL to stderr regardless of whether the browser opened: `eprintln!("Review UI: http://127.0.0.1:{}", port)`. This gives SSH users a URL they can copy.
- Implement a `--no-browser` flag that skips the open call and only prints the URL.
- Set a timeout on the HTTP server: if no request arrives within 30 seconds of startup, assume the browser failed to open and print a prominent message to stderr with the URL.
- Detect headless environments heuristically (check `$DISPLAY` on Linux, `$SSH_CONNECTION`) and auto-switch to URL-only mode.

**Detection:** Run `DISPLAY="" ./plan-reviewer` on Linux — should print the URL to stderr without hanging.

**Phase:** HTTP server + browser integration (Phase 1/2). `--no-browser` flag: Phase 1.

---

### Pitfall 8: Browser tab stays open after hook completes, confusing the user

**What goes wrong:** After the user submits their review decision (approve/deny), the Rust binary writes the JSON response to stdout and exits. The HTTP server shuts down. But the browser tab is left open, showing either a stale UI or a connection-refused error page. The user is confused about whether their action was recorded.

**Why it happens:** There is no standard mechanism for a web server to close a browser tab from the server side. The server can redirect, but if it shuts down immediately after the redirect the browser may show a connection error instead of a clean "done" page.

**Prevention:**
- Serve a "review submitted" page from the HTTP server that includes a self-closing mechanism: `<meta http-equiv="refresh" content="3;url=about:blank">` or a brief JavaScript redirect to `window.close()` after showing a confirmation message.
- Give the server a 2-second grace period after writing the JSON stdout response before shutting down, so the browser receives the "done" page before the connection drops.
- Do NOT call `std::process::exit()` immediately after writing the JSON — let destructors run to flush the HTTP response.

**Detection:** Manually approve/deny in the UI — the browser tab should show a confirmation message, not a connection-refused error.

**Phase:** Review UI (Phase 2). Simple redirect page is trivial to implement; add from day one.

---

### Pitfall 9: Cross-compilation fails when frontend build step is not accounted for

**What goes wrong:** The project has a non-Rust frontend (e.g., a Vite/TypeScript bundle) that must be built before `rust-embed` can embed it. The Rust `build.rs` script may invoke `npm run build` or similar. Cross-compilation via `cross` runs the build inside a Docker container that has Rust toolchains but does not have Node.js, npm, or the frontend build tools installed.

**Why it happens:** `cross` containers are purpose-built for Rust cross-compilation. They do not include arbitrary frontend toolchains. The `build.rs` script fails with "npm: command not found" inside the container.

**Warning sign:** Cross-compilation succeeds locally (where npm is installed) but fails in CI inside the `cross` Docker container.

**Prevention:**
- Build the frontend assets as a separate CI step *before* invoking the Rust cross-compilation. Store the built assets in a path that `rust-embed` can find.
- In `build.rs`, only invoke the frontend build if a `SKIP_FRONTEND_BUILD` env var is not set, so CI can build frontend separately and pass pre-built assets to `cargo cross`.
- Alternatively, pre-commit the built frontend assets to the repository and only rebuild them in dedicated frontend CI jobs. This avoids the `build.rs` complexity entirely.
- If using GitHub Actions, use a matrix with `node-version` in the setup step before the Rust cross-compilation step.

**Detection:** Run `cross build --release --target aarch64-unknown-linux-musl` locally after clearing any cached frontend build — must succeed without `npm` available in PATH.

**Phase:** CI/release pipeline phase (Phase 3 or dedicated distribution phase).

---

### Pitfall 10: curl|sh installs to a location not on PATH

**What goes wrong:** The install script downloads the binary and places it in a directory (e.g., `~/.local/bin` or `/usr/local/bin`). If that directory is not in the user's `$PATH`, the binary is installed but inaccessible. The user runs `plan-reviewer` and gets "command not found" with no obvious explanation.

**Why it happens:** Shell PATH configuration varies enormously between users, distros, and macOS versions. `~/.local/bin` is common on Linux but not guaranteed. `/usr/local/bin` requires sudo. macOS's default PATH after Homebrew changes often differs from the login shell PATH.

**Warning sign:** User reports "command not found" immediately after a successful install.

**Prevention:**
- The install script must check whether the install directory is in PATH after installation, and print a shell-specific instruction if it is not: `export PATH="$HOME/.local/bin:$PATH" # add to ~/.zshrc`.
- Offer `/usr/local/bin` as a fallback install target with sudo, or `~/.local/bin` without sudo, and detect which is appropriate.
- Print the absolute path of the installed binary at the end of the install script regardless.
- The install script should provide a `--prefix` flag so users can override the install location.

**Detection:** Run the install script as a user with `PATH=/usr/bin:/bin` set explicitly — script must print PATH guidance.

**Phase:** Distribution/install script (Phase 3 or curl|sh phase).

---

### Pitfall 11: Process does not exit cleanly, blocking Claude Code from continuing

**What goes wrong:** After writing the JSON response to stdout, the Rust binary fails to exit. Common causes: an async runtime not being shut down, a spawned thread keeping the process alive, or the HTTP server's accept loop not being interrupted. Claude Code waits for the hook process to exit before acting on its response. If the process hangs, Claude Code waits indefinitely (up to the hook timeout).

**Why it happens:** Spawning a `tokio` or `actix-web` runtime and then writing a result to stdout does not automatically shut down the runtime. Background tasks keep the process alive.

**Warning sign:** Hook appears to return the correct JSON (visible in debug log) but Claude Code does not act on it immediately — it waits.

**Prevention:**
- Implement a clean shutdown channel: when the review form is submitted, signal the HTTP server to stop accepting, drain in-flight responses, then call a clean shutdown before writing the final stdout JSON and returning from `main()`.
- Set a watchdog timer: if the main logic has completed but the process has not exited within 5 seconds, call `std::process::exit(0)` as a safety valve.
- Test process exit: `time echo '...' | ./plan-reviewer` should complete in under 1 second after user interaction.

**Detection:** After submitting the review, `ps aux | grep plan-reviewer` must show no lingering process within 3 seconds.

**Phase:** Core hook integration (Phase 1). Exit discipline must be designed from the start, not retrofitted.

---

## Minor Pitfalls

---

### Pitfall 12: Binary size bloat from uncompressed embedded assets

**What goes wrong:** Embedding uncompressed frontend assets (JS bundles, fonts, CSS) in the binary inflates the download size. A typical Vite production build can be 500KB–2MB uncompressed. Embedded in a Rust binary without compression, this adds directly to the curl-downloaded binary size.

**Prevention:**
- Enable `rust-embed`'s compression support via the `include-flate` optional dependency, which compresses assets at compile time and serves them with `Content-Encoding: gzip`.
- Run `cargo build --release` with `opt-level = "z"` and `lto = "fat"` in the release profile.
- Ensure the Vite build uses code splitting and tree-shaking. Strip unused icons, fonts, and locales.
- Target binary size: under 10MB for the full release binary.

**Detection:** Check `wc -c target/release/plan-reviewer` after each release build.

**Phase:** Asset embedding optimization (Phase 2, after basic embedding works).

---

### Pitfall 13: Cache busting absent — browser serves stale embedded assets after binary update

**What goes wrong:** When the binary is updated (new release), the browser may serve cached versions of JS/CSS assets from a previous visit, causing the UI to mismatch the server-side API or protocol.

**Prevention:**
- Include a content-hash or build version in asset filenames (Vite does this by default: `assets/index-Bx7fj3kA.js`).
- Alternatively, set `Cache-Control: no-store` on all asset responses for simplicity in v1 (no caching at all).
- Set `ETag` headers using the file's hash, which rust-embed exposes via the `EmbeddedFile::metadata()` method.

**Detection:** Build two slightly different versions and verify the browser does not serve stale JS after switching binaries.

**Phase:** Asset embedding (Phase 2).

---

### Pitfall 14: settings.json hook config is too broad — captures unintended tool calls

**What goes wrong:** A `PermissionRequest` hook with an empty matcher (`""`) fires on *every* permission prompt in Claude Code — file writes, shell commands, everything — not just `ExitPlanMode`. If the binary is the hook handler, it opens a browser tab for each tool-use permission request, which is disruptive and breaks Claude Code's normal flow.

**Prevention:**
- The install instructions and generated settings snippet must use a precise matcher: `"matcher": "ExitPlanMode"`.
- Document this in the install output and in the README.

**Detection:** In a test Claude Code session, run a `Bash` tool call that requires permission — the plan-reviewer browser tab should NOT open.

**Phase:** Hook integration setup (Phase 1).

---

## Phase-Specific Warning Summary

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Hook protocol implementation | Stdout contamination (P3), JSON parse failure | Write only final JSON to stdout; all other output to stderr |
| Hook protocol implementation | Hook timeout (P4) | Self-terminate before timeout; show countdown in UI |
| Hook protocol implementation | Process not exiting (P11) | Design clean shutdown from the start |
| HTTP server startup | Port conflict (P6) | Use port 0 (ephemeral) from day one |
| HTTP server startup | Browser fails to open (P7) | Print URL to stderr always; `--no-browser` flag |
| Review UI | Browser tab stays open (P8) | Self-closing confirmation page with grace period |
| Asset embedding | Debug/release path mismatch (P5) | Run from project root; consider `debug-embed` feature |
| Asset embedding | Binary size bloat (P12) | Enable flate compression; optimize Vite build |
| Asset embedding | Cache busting absent (P13) | Use Vite content-hash filenames or `Cache-Control: no-store` |
| Cross-compile CI | glibc mismatch (P1) | Build Linux targets with musl or manylinux2014 container |
| Cross-compile CI | Frontend build in cross container (P9) | Build frontend before Rust cross-compilation step |
| Distribution | macOS Gatekeeper (P2) | Ad hoc sign all macOS binaries in CI |
| Distribution | PATH not set after install (P10) | Install script must detect and advise on PATH |
| Hook config | Overly broad matcher (P14) | Use `"matcher": "ExitPlanMode"` exactly |

---

## Sources

- Claude Code Hooks Guide (official, current): https://code.claude.ai/docs/en/hooks-guide
- Claude Code Hooks Reference (official): https://code.claude.ai/docs/en/hooks
- Building Rust binaries for older glibc (Kobzol's blog, 2021): https://kobzol.github.io/rust/ci/2021/05/07/building-rust-binaries-in-ci-that-work-with-older-glibc.html
- rust-embed crate documentation: https://docs.rs/rust-embed/latest/rust_embed/
- webbrowser crate documentation: https://docs.rs/webbrowser/latest/webbrowser/
- macOS Sequoia Gatekeeper changes (Hackaday, 2024): https://hackaday.com/2024/11/01/apple-forces-the-signing-of-applications-in-macos-sequoia-15-1/
- Apple code signing history (Eclectic Light, 2025): https://eclecticlight.co/2025/04/26/a-brief-history-of-code-signing-on-macs/
- Claude Code hook JSON validation bug reports: https://github.com/anthropics/claude-code/issues/34713
- houseabsolute/actions-rust-cross GitHub Action: https://github.com/houseabsolute/actions-rust-cross
- apple-codesign crate (for CI notarization): https://crates.io/crates/apple-codesign
