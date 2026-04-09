<!-- GSD:project-start source:PROJECT.md -->
## Project

**claude-plan-reviewer**

A Rust binary that intercepts Claude Code's plan approval flow, renders plans and code diffs in a local browser UI, and lets you annotate before approving or denying execution. It integrates via Claude Code's `ExitPlanMode` PermissionRequest hook and returns structured JSON feedback via stdout. Distributed as a single pre-built binary — no runtime, no monorepo, no complex install.

**Core Value:** One `curl | sh` installs a working plan reviewer — no Node.js, no Bun, no workspace setup required.

### Constraints

- **Tech stack**: Rust — for single-binary output and no runtime dependency
- **Protocol**: Must be compatible with Claude Code PermissionRequest hook stdin/stdout JSON format
- **Distribution**: Must install with a single `curl | sh` command, no package manager required
- **Scope**: Local-only for v1 — no server-side infrastructure
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Runtime and HTTP Server
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tokio | 1.x | Async runtime | De facto standard; required by axum; full features (macros, rt-multi-thread) |
| axum | 0.8.x | Local HTTP server | Built by the Tokio team, tight tower ecosystem integration, first-class rust-embed support via optional `axum` feature flag, actively maintained |
- `actix-web` — Actor model overhead is irrelevant for a single-user local tool; higher compile times; not the same ecosystem as tokio/tower
- `warp` — Last release (v0.4.1) was August 2019. The filter composition model adds complexity with no benefit here. MEDIUM confidence (GitHub shows PRs in early 2025 but the crate version itself has not shipped)
- `tiny_http` — Synchronous, thread-per-connection, no async; explicitly recommends using a framework instead; no middleware story
### Asset Embedding
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| rust-embed | 8.x (currently 8.11.0) | Embed compiled frontend assets into binary | Debug mode reads from filesystem (fast iteration), release mode embeds; compression support; first-class axum integration feature flag; most widely used pattern for this use case |
- `include_dir` — No debug/release duality, no compression, no axum integration; you'd hand-roll everything rust-embed already provides
- Raw `include_bytes!` / `include_str!` per file — Does not scale to a Vite build output with hashed asset filenames; requires manual MIME type assignment
### Frontend Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Svelte 5 | 5.x | UI components | Compiles to small, self-contained static assets; no runtime bundle needed; Vite is the official build tool; output is plain HTML + JS + CSS embeddable with rust-embed |
| Vite | 6.x | Frontend build | Official Svelte build tool; `--base ./` flag produces relative URLs compatible with rust-embed serving; outputs a `dist/` directory that rust-embed embeds directly |
- Vanilla JS — Acceptable but results in hand-written DOM manipulation for the diff viewer and annotation UI; Svelte's reactivity is worth the build step
- React / Vue — Larger bundle size than Svelte; React in particular pulls in a runtime; not worth it for a tool with no external users
- SvelteKit with adapter-static — Adds complexity (routing, server-side rendering primitives) that is not needed; use vanilla Svelte with Vite directly
- Leptos / Yew (Rust WASM) — Interesting but adds WASM compile target to the build matrix, significantly increases build complexity and binary size for no UX gain
- Tauri — This project deliberately avoids a native window manager. The goal is a browser tab, not a native app.
### Markdown Rendering
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| comrak | 0.x (check latest on crates.io) | Server-side markdown-to-HTML conversion | Full GFM support (tables, task lists, strikethrough, autolinks); actively maintained (author's day job since Sept 2025); used by crates.io, docs.rs, lib.rs, GitLab, Deno; AST model enables sanitization |
- `pulldown-cmark` for this use case — Faster but historically lags behind the GFM spec (the community notes it doesn't fully track cmark-gfm). Suitable if you only need CommonMark; not if you want task list checkboxes and tables to render correctly
- Client-side markdown rendering (marked.js, marked in the Svelte bundle) — Adds JS bundle weight and a second rendering path; unnecessary when the server can do it at zero frontend cost
### Git Diff Parsing
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| git2 | 0.20.x | Parse repository diffs | Safe bindings to libgit2; provides `Diff` and `Patch` structs directly; no subprocess; works on the repo the hook is invoked from |
- Shelling out to `git diff` — Fragile: depends on `git` being in `PATH`, inherits the user's git config, requires parsing unstructured text output, breaks if git is not installed at expected path. libgit2 is self-contained
- `gitoxide` (gix) — Promising pure-Rust rewrite but the diff API is still maturing; git2/libgit2 has a proven, stable diff API. Revisit in 12 months
- `git-diff` crate — Deprecated
### CLI Argument Parsing
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| clap | 4.x (currently 4.6.0) | CLI argument parsing | Industry standard; derive macro keeps argument definitions co-located with the struct; auto-generates `--help` and `--version` from Cargo.toml |
- `structopt` — Superseded by clap v3+ derive; unmaintained
- `argh` / `pico-args` — Lighter weight but unnecessary savings; clap compile time is acceptable here
### JSON I/O (Hook Protocol)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| serde | 1.x | Serialization framework | Universal; derive macros for zero-boilerplate struct mapping |
| serde_json | 1.x | JSON stdin/stdout | `from_reader(stdin())` parses the hook input; `to_writer(stdout(), &response)` emits the response; handles the full PermissionRequest protocol |
### Browser Launch
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| webbrowser | 1.x (currently 1.0.4) | Open browser tab | Cross-platform (macOS, Linux, Windows); non-blocking for GUI browsers; suppresses browser stdout/stderr from polluting the hook's stdout |
### Cross-Compilation and Binary Release
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| cargo-dist | 0.31.x | Release automation, curl-sh installer generation | Generates GitHub Actions CI that builds multi-target binaries, uploads to GitHub Releases, and produces a shell installer script; exactly the `curl \| sh` distribution model in the project requirements |
- `x86_64-apple-darwin`
- `aarch64-apple-darwin`
- `x86_64-unknown-linux-musl` (static, not gnu — avoids glibc version mismatch on older Linux)
- `aarch64-unknown-linux-musl`
- `cross` alone — Useful for building ARM on x86, but you still need to write all the release automation yourself; cargo-dist subsumes this use case
- Native GitHub Actions matrix without cargo-dist — Works but requires manually writing the matrix, packaging logic, and installer script that cargo-dist generates for free
- `cargo-zigbuild` alone — Useful for musl cross-compilation but again lacks the release automation layer
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| HTTP server | axum 0.8 | actix-web | Actor model unnecessary for local single-user tool; not Tokio/Tower ecosystem |
| HTTP server | axum 0.8 | warp | Last published release August 2019; filter composition is complex with no benefit here |
| HTTP server | axum 0.8 | tiny_http | Synchronous; no middleware; self-recommends using a framework instead |
| Asset embedding | rust-embed 8 | include_dir | No debug/release duality; no axum integration; no compression |
| Frontend | Svelte + Vite | Vanilla JS | Manageable but diff viewer + annotation state makes reactive framework worth the build step |
| Frontend | Svelte + Vite | Leptos/Yew | WASM compile target adds build complexity; no UX benefit |
| Markdown | comrak | pulldown-cmark | Lags GFM spec; no full task list / table guarantee |
| Markdown | comrak | Client-side JS | Unnecessary JS bundle weight when server can render |
| Git diff | git2 --vendored | Shell out to git | Fragile; unstructured output; PATH dependency |
| Git diff | git2 --vendored | gitoxide | Diff API still maturing |
| Release | cargo-dist | cross + manual CI | Requires writing installer script and release automation from scratch |
| Linux target | *-musl | *-gnu | gnu links glibc dynamically; breaks on older distros |
## Full Dependency Block
# none required — frontend build invoked from build.rs via std::process::Command
## Sources
- axum 0.8.0 announcement: https://tokio.rs/blog/2025-01-01-announcing-axum-0-8-0
- rust-embed docs (8.11.0): https://docs.rs/rust-embed/latest/rust_embed/
- clap docs (4.6.0): https://docs.rs/clap/latest/clap/
- git2 docs (0.20.4): https://docs.rs/git2/latest/git2/
- pulldown-cmark docs (0.13.3): https://docs.rs/pulldown-cmark/latest/pulldown_cmark/
- comrak GitHub: https://github.com/kivikakk/comrak
- cargo-dist docs: https://axodotdev.github.io/cargo-dist/book/introduction.html
- cargo-dist releases: https://github.com/axodotdev/cargo-dist/releases
- webbrowser crate: https://crates.io/crates/webbrowser
- Svelte+Rust axum embedding forum: https://users.rust-lang.org/t/how-to-embed-svelte-site-in-rust-binary-with-axum/127709
- Single Rust Binary with Vite+Svelte: https://fdeantoni.medium.com/single-rust-binary-with-vite-svelte-66944f9ac561
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
