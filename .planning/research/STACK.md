# Technology Stack

**Project:** claude-plan-reviewer
**Researched:** 2026-04-09

## Recommended Stack

### Core Runtime and HTTP Server

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tokio | 1.x | Async runtime | De facto standard; required by axum; full features (macros, rt-multi-thread) |
| axum | 0.8.x | Local HTTP server | Built by the Tokio team, tight tower ecosystem integration, first-class rust-embed support via optional `axum` feature flag, actively maintained |

**Use axum.** It has an optional `axum ^0.8` feature in rust-embed that wires static file serving in one call. The Tokio team ships both, so version compatibility is guaranteed.

**Do NOT use:**
- `actix-web` — Actor model overhead is irrelevant for a single-user local tool; higher compile times; not the same ecosystem as tokio/tower
- `warp` — Last release (v0.4.1) was August 2019. The filter composition model adds complexity with no benefit here. MEDIUM confidence (GitHub shows PRs in early 2025 but the crate version itself has not shipped)
- `tiny_http` — Synchronous, thread-per-connection, no async; explicitly recommends using a framework instead; no middleware story

### Asset Embedding

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| rust-embed | 8.x (currently 8.11.0) | Embed compiled frontend assets into binary | Debug mode reads from filesystem (fast iteration), release mode embeds; compression support; first-class axum integration feature flag; most widely used pattern for this use case |

**Use rust-embed.** The debug/release duality is the killer feature for this project: during development the binary reads the Vite build output from `frontend/dist/` directly; in release the files are baked in. The `axum` feature flag generates the necessary handler glue automatically.

**Do NOT use:**
- `include_dir` — No debug/release duality, no compression, no axum integration; you'd hand-roll everything rust-embed already provides
- Raw `include_bytes!` / `include_str!` per file — Does not scale to a Vite build output with hashed asset filenames; requires manual MIME type assignment

### Frontend Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | 19.x | UI components | User preference; large ecosystem; strong TypeScript support; Vite produces static assets embeddable via rust-embed |
| TypeScript | 5.x | Type safety | Strong typing for hook protocol structs and annotation model; catches protocol mismatches at compile time |
| Vite | 6.x | Frontend build | First-class React + TS support; `--base ./` flag produces relative URLs compatible with rust-embed serving; outputs a `dist/` directory rust-embed embeds directly |

**Use React + TypeScript + Vite.** The build pipeline is: `vite build --base ./` produces `dist/`, rust-embed embeds `dist/` at compile time. Use `create-vite` with the `react-ts` template. No React Router or SSR needed — a single-page app with local state is sufficient.

**Do NOT use:**
- Svelte — Smaller bundle but less familiar; React chosen explicitly for ecosystem familiarity
- SvelteKit / Next.js / Remix — SSR frameworks add complexity that is not needed for a local single-page tool
- Leptos / Yew (Rust WASM) — WASM compile target adds build complexity and binary size for no UX gain
- Tauri — This project deliberately avoids a native window manager. The goal is a browser tab, not a native app.
- Vanilla JS — Manageable but annotation state management (accumulating multiple annotations, syncing with forms) gets fiddly without React's reactivity

**Build integration note:** Add a `build.rs` that runs `npm run build` in the `frontend/` directory before cargo compiles the Rust code so that `rust-embed` always picks up a fresh build. Gate the build.rs invocation behind a `SKIP_FRONTEND_BUILD` env var for faster iteration and CI cross-compilation.

### Markdown Rendering

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| comrak | 0.x (check latest on crates.io) | Server-side markdown-to-HTML conversion | Full GFM support (tables, task lists, strikethrough, autolinks); actively maintained (author's day job since Sept 2025); used by crates.io, docs.rs, lib.rs, GitLab, Deno; AST model enables sanitization |

**Render markdown server-side in Rust, serve HTML to the frontend.** Claude's plan output uses GFM-ish markdown (headings, code blocks, bullet lists, potentially tables). Rendering on the server means the JS bundle does not need a markdown parser.

**Do NOT use:**
- `pulldown-cmark` for this use case — Faster but historically lags behind the GFM spec (the community notes it doesn't fully track cmark-gfm). Suitable if you only need CommonMark; not if you want task list checkboxes and tables to render correctly
- Client-side markdown rendering (marked.js, marked in the Svelte bundle) — Adds JS bundle weight and a second rendering path; unnecessary when the server can do it at zero frontend cost

### Git Diff Parsing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| git2 | 0.20.x | Parse repository diffs | Safe bindings to libgit2; provides `Diff` and `Patch` structs directly; no subprocess; works on the repo the hook is invoked from |

**Use git2.** The hook is invoked from within a git repository (Claude Code's working directory). `git2::Repository::open(".")` then `repo.diff_index_to_workdir()` or `repo.diff_head_to_index()` gives a full diff without shelling out.

**Do NOT use:**
- Shelling out to `git diff` — Fragile: depends on `git` being in `PATH`, inherits the user's git config, requires parsing unstructured text output, breaks if git is not installed at expected path. libgit2 is self-contained
- `gitoxide` (gix) — Promising pure-Rust rewrite but the diff API is still maturing; git2/libgit2 has a proven, stable diff API. Revisit in 12 months
- `git-diff` crate — Deprecated

**Note on static linking:** libgit2 can be statically linked via the `git2` crate's `vendored` feature flag (`git2 = { version = "0.20", features = ["vendored"] }`). This is required for distributable binaries — do not rely on the system libgit2.

### CLI Argument Parsing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| clap | 4.x (currently 4.6.0) | CLI argument parsing | Industry standard; derive macro keeps argument definitions co-located with the struct; auto-generates `--help` and `--version` from Cargo.toml |

The binary has minimal CLI surface: it reads JSON from stdin and writes JSON to stdout. Clap's derive API handles any flags (`--port`, `--no-open`, `--version`) with negligible boilerplate.

**Do NOT use:**
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

**Do NOT use `open`** — The `open` crate is simpler but `webbrowser` guarantees opening even for local file URLs and provides explicit browser selection if needed.

### Cross-Compilation and Binary Release

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| cargo-dist | 0.31.x | Release automation, curl-sh installer generation | Generates GitHub Actions CI that builds multi-target binaries, uploads to GitHub Releases, and produces a shell installer script; exactly the `curl \| sh` distribution model in the project requirements |

**Targets to configure in `Cargo.toml` (via cargo-dist):**
- `x86_64-apple-darwin`
- `aarch64-apple-darwin`
- `x86_64-unknown-linux-musl` (static, not gnu — avoids glibc version mismatch on older Linux)
- `aarch64-unknown-linux-musl`

**Use `*-musl` for Linux, not `*-gnu`.** musl produces fully static binaries. GNU binaries dynamically link glibc and break on distros with older glibc than the build machine.

**Use cargo-dist.** It handles: build matrix across targets, tarball packaging, installer script generation, and GitHub Release artifact upload — in a single `dist init` + `dist generate` invocation.

**Do NOT use:**
- `cross` alone — Useful for building ARM on x86, but you still need to write all the release automation yourself; cargo-dist subsumes this use case
- Native GitHub Actions matrix without cargo-dist — Works but requires manually writing the matrix, packaging logic, and installer script that cargo-dist generates for free
- `cargo-zigbuild` alone — Useful for musl cross-compilation but again lacks the release automation layer

**Note:** cargo-dist's `cargo-zigbuild` integration handles Linux cross-compilation automatically when targeting musl. The `git2 --vendored` flag ensures libgit2 is statically linked and does not interfere with the musl target.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| HTTP server | axum 0.8 | actix-web | Actor model unnecessary for local single-user tool; not Tokio/Tower ecosystem |
| HTTP server | axum 0.8 | warp | Last published release August 2019; filter composition is complex with no benefit here |
| HTTP server | axum 0.8 | tiny_http | Synchronous; no middleware; self-recommends using a framework instead |
| Asset embedding | rust-embed 8 | include_dir | No debug/release duality; no axum integration; no compression |
| Frontend | React + TS + Vite | Svelte + Vite | Smaller bundle but less familiar; React chosen for ecosystem preference |
| Frontend | React + TS + Vite | Leptos/Yew | WASM compile target adds build complexity; no UX benefit |
| Frontend | React + TS + Vite | Vanilla JS | Annotation state management gets fiddly without a reactive framework |
| Markdown | comrak | pulldown-cmark | Lags GFM spec; no full task list / table guarantee |
| Markdown | comrak | Client-side JS | Unnecessary JS bundle weight when server can render |
| Git diff | git2 --vendored | Shell out to git | Fragile; unstructured output; PATH dependency |
| Git diff | git2 --vendored | gitoxide | Diff API still maturing |
| Release | cargo-dist | cross + manual CI | Requires writing installer script and release automation from scratch |
| Linux target | *-musl | *-gnu | gnu links glibc dynamically; breaks on older distros |

## Full Dependency Block

```toml
[dependencies]
axum = { version = "0.8", features = ["macros"] }
tokio = { version = "1", features = ["full"] }
rust-embed = { version = "8", features = ["axum"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
git2 = { version = "0.20", features = ["vendored"] }
comrak = { version = "0.31", default-features = false, features = ["syntect"] }
clap = { version = "4", features = ["derive"] }
webbrowser = "1"

[build-dependencies]
# none required — frontend build invoked from build.rs via std::process::Command
```

Note: `comrak` version should be confirmed against crates.io at implementation time; the `syntect` feature enables syntax highlighting in code blocks. Omit it if binary size is a concern (pulls in syntect's syntax definitions).

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
