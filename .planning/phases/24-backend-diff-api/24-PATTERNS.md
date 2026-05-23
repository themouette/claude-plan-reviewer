# Phase 24: Backend Diff API - Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 4 (src/diff_api.rs, src/plan_review.rs, src/server.rs, Cargo.toml)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/diff_api.rs` | service+controller | request-response | `src/server.rs` (State, handler, Json response pattern) | role-match |
| `src/plan_review.rs` | controller | request-response | `src/server.rs` (direct content move) | exact — content refactor |
| `src/server.rs` | config/assembler | request-response | `src/server.rs` lines 114–141 (router build block) | exact — becomes thin wrapper |
| `Cargo.toml` | config | — | `Cargo.toml` existing `[dependencies]` block | exact |

---

## Pattern Assignments

### `src/plan_review.rs` (controller, request-response)

**Analog:** `src/server.rs` — this file is the **direct destination** of the current `src/server.rs` content. Copy it verbatim and change the module declaration.

**Imports pattern** (`src/server.rs` lines 1–14):
```rust
use std::sync::{Arc, Mutex};

use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
};
use axum_embed::{FallbackBehavior, ServeEmbed};
use rust_embed::RustEmbed;
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use tokio_util::sync::CancellationToken;
```

**State struct pattern** (`src/server.rs` lines 32–38):
```rust
pub struct AppState {
    pub plan_md: String,
    pub diff_content: String,
    pub approve_label: String,
    pub deny_label: String,
    pub decision_tx: Mutex<Option<oneshot::Sender<Decision>>>,
}
```

**Handler signature pattern** (`src/server.rs` lines 42–55):
```rust
async fn get_plan(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::json!({ "plan_md": state.plan_md }))
}

async fn get_diff(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::json!({ "diff": state.diff_content }))
}
```

**POST handler with body extraction** (`src/server.rs` lines 57–69):
```rust
async fn post_decide(
    State(state): State<Arc<AppState>>,
    Json(body): Json<Decision>,
) -> impl IntoResponse {
    let tx = state.decision_tx.lock().unwrap().take();
    match tx {
        Some(tx) => {
            let _ = tx.send(body);
            StatusCode::OK
        }
        None => StatusCode::CONFLICT, // 409 — already decided
    }
}
```

**Key change for `plan_review.rs`:** The `router()` factory must return `Router<()>` via `.with_state(state)` so the assembler can `.merge()` it. The current `server.rs` applies `.with_state(state)` at the end of the full router build. In `plan_review.rs`, the factory must call `.with_state(state)` before returning, and must NOT attach `fallback_service`. The SPA fallback moves to the assembler.

**Router factory shape** (new pattern, derived from `src/server.rs` lines 114–121):
```rust
// In plan_review.rs — sub-router factory, no fallback_service
pub fn router(state: Arc<AppState>) -> Router<()> {
    Router::new()
        .route("/api/plan", get(get_plan))
        .route("/api/diff", get(get_diff))
        .route("/api/config", get(get_config))
        .route("/api/decide", post(post_decide))
        .with_state(state)   // converts to Router<()> for merge
}
```

---

### `src/diff_api.rs` (service+controller, request-response)

**Analog:** `src/server.rs` — for State extraction, handler signature, JSON response pattern, and Router factory shape. Additionally, `src/main.rs` lines 367–420 for the git2 open + DiffOptions pattern.

**Imports pattern** (modeled on `src/server.rs` lines 1–14 + git2 additions):
```rust
use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
};
use serde::Serialize;
```

**Struct definitions** — snake_case field names match the existing codebase convention (verified: `plan_md`, `approve_label`, `diff_content` in `server.rs` are already snake_case in JSON):
```rust
#[derive(Debug, Clone, Serialize)]
pub struct FileDiff {
    pub filename: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub previous_filename: Option<String>,
    pub status: String,       // "added" | "removed" | "modified" | "renamed" | "copied"
    pub additions: u32,
    pub deletions: u32,
    pub changes: u32,
    pub patch: String,        // raw unified diff text
}

#[derive(Debug, Clone, Serialize)]
pub struct Commit {
    pub sha: String,
    pub short_sha: String,
    pub message: String,
    pub author: String,
    pub email: String,
    pub date: String,         // ISO 8601 / RFC 3339
}

#[derive(Clone)]
pub struct CodeReviewState {
    pub repo_path: std::path::PathBuf,
}
```

**State extraction pattern** — copy from `src/server.rs` lines 42–44, substituting state type:
```rust
async fn get_diff_branch(
    State(state): State<Arc<CodeReviewState>>,
) -> impl IntoResponse {
    // ...
    Json(file_diffs)
}
```

**Path parameter extraction** (new pattern, no existing analog in codebase):
```rust
async fn get_diff_commit(
    State(state): State<Arc<CodeReviewState>>,
    Path(sha): Path<String>,
) -> impl IntoResponse {
    // sha is the :sha path segment
}
```

**git2 repo open + DiffOptions** — copy from `src/main.rs` lines 368–376:
```rust
// src/main.rs lines 368-376 — established git2 open + options pattern
let repo = match git2::Repository::open(cwd) {
    Ok(r) => r,
    Err(_) => return String::new(),
};

let mut opts = git2::DiffOptions::new();
opts.old_prefix("a/").new_prefix("b/");
```

In `diff_api.rs` handlers, adapt the error return to `Json` + `StatusCode`:
```rust
let repo = match git2::Repository::open(&state.repo_path) {
    Ok(r) => r,
    Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR,
                      Json(serde_json::json!({"error": "failed to open repository"}))).into_response(),
};
```

**Router factory pattern** (same shape as `plan_review.rs`):
```rust
pub fn router(state: Arc<CodeReviewState>) -> Router<()> {
    Router::new()
        .route("/api/diff/branch", get(get_diff_branch))
        .route("/api/commits", get(get_commits))
        .route("/api/diff/commit/:sha", get(get_diff_commit))
        .with_state(state)
}
```

---

### `src/server.rs` (assembler, config)

**Analog:** Current `src/server.rs` — specifically the `start_server()` function body (`src/server.rs` lines 82–141). The assembler is built from its router-build block.

**Complete assembler shape** (derived from `src/server.rs` lines 96–133, adapted):
```rust
// src/server.rs — thin assembler after Phase 24 refactor

pub use plan_review::{AppState, Decision};  // re-export for main.rs compatibility

pub async fn start_server(
    plan_md: String,
    diff_content: String,
    approve_label: String,
    deny_label: String,
    port: u16,
) -> Result<(u16, oneshot::Receiver<Decision>), Box<dyn std::error::Error + Send + Sync>> {
    // Create decision channel + cancellation token (unchanged from current server.rs lines 90-93)
    let (decision_tx, decision_rx) = oneshot::channel::<Decision>();
    let token = CancellationToken::new();
    let token_clone = token.clone();

    // Build plan_review state (unchanged fields, src/server.rs lines 97-103)
    let plan_state = Arc::new(AppState {
        plan_md,
        diff_content,
        approve_label,
        deny_label,
        decision_tx: Mutex::new(Some(decision_tx)),
    });

    // Build code_review state (new)
    let cwd = std::env::current_dir().unwrap_or_default();
    let code_review_state = Arc::new(diff_api::CodeReviewState {
        repo_path: cwd,
    });

    // SPA fallback stays here — only one fallback allowed after merge
    let spa = ServeEmbed::<Assets>::with_parameters(
        Some("index.html".to_owned()),
        FallbackBehavior::Ok,
        None,
    );

    // Merge sub-routers — both return Router<()> already
    let app = plan_review::router(plan_state)
        .merge(diff_api::router(code_review_state))
        .route("/api/ping", get(get_ping))
        .fallback_service(spa);

    // Bind + spawn (src/server.rs lines 124-133 — unchanged)
    let listener = TcpListener::bind(format!("127.0.0.1:{}", port)).await?;
    let port = listener.local_addr()?.port();

    tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async move { token_clone.cancelled().await })
            .await
            .ok();
    });

    drop(token);
    Ok((port, decision_rx))
}
```

**Critical:** `get_ping`, `Assets`, `RustEmbed` embed declaration, and all tokio/axum_embed imports stay in `server.rs` (they belong to the assembler layer, not to either sub-module).

---

### `Cargo.toml` (config)

**Analog:** `Cargo.toml` lines 11–24 existing `[dependencies]` block.

**New dependency to add** (append to `[dependencies]`):
```toml
chrono = { version = "0.4", default-features = false, features = ["std"] }
```

**New dev-dependencies to add** (append to `[dev-dependencies]`):
```toml
tower = { version = "0.5", features = ["util"] }
http-body-util = "0.1"
```

These two are already transitive deps of axum (verified in `Cargo.lock`); adding them to `[dev-dependencies]` makes them importable directly in test files.

**Existing `[dev-dependencies]` block** (`Cargo.toml` lines 27–31) for reference — append after `ureq`:
```toml
[dev-dependencies]
tempfile = "3"
assert_cmd = "2"
predicates = "3"
ureq = { version = "3", features = ["json"] }
# ADD:
tower = { version = "0.5", features = ["util"] }
http-body-util = "0.1"
```

---

## Shared Patterns

### git2 Repository Open + DiffOptions
**Source:** `src/main.rs` lines 368–376
**Apply to:** All three handlers in `src/diff_api.rs`
```rust
let repo = match git2::Repository::open(cwd) {
    Ok(r) => r,
    Err(_) => return String::new(),
};

let mut opts = git2::DiffOptions::new();
opts.old_prefix("a/").new_prefix("b/");
```
The `a/`/`b/` prefixes are established convention in this codebase. Use them for all diffs in `diff_api.rs`.

### git2 Commit Fixture Pattern (Integration Tests)
**Source:** `src/main.rs` lines 192–202 (test fixture block)
**Apply to:** `tests/integration/diff_api_routes.rs`
```rust
let tmp = tempfile::tempdir().expect("failed to create temp dir");
let repo = git2::Repository::init(tmp.path()).expect("failed to init repo");

{
    let sig = git2::Signature::now("test", "test@test.com").unwrap();
    let tree_id = repo.index().unwrap().write_tree().unwrap();
    let tree = repo.find_tree(tree_id).unwrap();
    repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[])
        .unwrap();
}
```
This is the established pattern for integration test fixtures. Extend it for Phase 24 tests that need multiple commits or named branches.

### Axum State Extraction
**Source:** `src/server.rs` lines 42–44
**Apply to:** All handlers in `src/diff_api.rs` and `src/plan_review.rs`
```rust
async fn get_plan(State(state): State<Arc<AppState>>) -> impl IntoResponse {
```
Use `State(state): State<Arc<T>>` destructuring pattern consistently. Never use `Extension` or global state.

### JSON Error Response Shape
**Source:** `src/server.rs` lines 63–68 (CONFLICT return pattern)
**Apply to:** All fallible handlers in `src/diff_api.rs`

The existing codebase returns typed `StatusCode` values directly. For `diff_api.rs` handlers that need both a status code AND a JSON body on error, use the tuple pattern:
```rust
return (
    StatusCode::BAD_REQUEST,
    Json(serde_json::json!({"error": "invalid sha"})),
).into_response();
```
On success, return `Json(vec)` directly (axum defaults to 200).

### Module Declaration in `src/main.rs`
**Source:** `src/main.rs` lines 1–6
**Apply to:** `src/main.rs` (modification) — add `mod diff_api;` and `mod plan_review;`, remove `mod server;` (or keep `mod server;` as the assembler).

Current block:
```rust
mod hook;
mod install;
mod integrations;
mod server;
mod uninstall;
mod update;
```
After Phase 24, `mod server;` remains (it's still the public entry point). Add `mod diff_api;` and `mod plan_review;` since `server.rs` will `mod`-declare them internally or they need to be declared here. Follow the existing alphabetical ordering convention.

---

## Integration Test Pattern

### `tests/integration/diff_api_routes.rs` (test)

**Analog:** `src/main.rs` test block lines 188–244 (git2 fixture pattern) + RESEARCH.md Pattern 9.

**Test module registration** — `tests/integration/main.rs` current content:
```rust
mod install_uninstall;
mod review_subcommand;
mod server_cycle;
```
Add `mod diff_api_routes;` following the same alphabetical/append convention.

**oneshot test shape** (from RESEARCH.md Pattern 9 — no existing analog in codebase yet):
```rust
use axum::{body::Body, http::{Request, StatusCode}};
use http_body_util::BodyExt;
use tower::ServiceExt;
use std::sync::Arc;

#[tokio::test]
async fn get_diff_branch_returns_array() {
    let tmp = tempfile::tempdir().unwrap();
    let repo = git2::Repository::init(tmp.path()).unwrap();
    // ... create commits using the fixture pattern from src/main.rs lines 192-202

    let state = Arc::new(claude_plan_reviewer::diff_api::CodeReviewState {
        repo_path: tmp.path().to_path_buf(),
    });
    let app = claude_plan_reviewer::diff_api::router(state);

    let response = app
        .oneshot(Request::builder().uri("/api/diff/branch").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(json.is_array());
}
```

**Key imports needed for test file:**
- `tower::ServiceExt` for `.oneshot()`
- `http_body_util::BodyExt` for `.collect()`
- `axum::body::Body` for empty request body
- `tempfile` + `git2` for fixtures (already in `[dev-dependencies]`)

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Path parameter extraction (`Path(sha): Path<String>`) | handler extractor | request-response | No existing route in codebase uses path parameters — only query-less GET and body POST handlers exist |
| `tower::ServiceExt::oneshot` test pattern | test | request-response | All existing tests use subprocess (`assert_cmd`, `ureq` against live binary) — no in-process handler tests exist yet |
| `chrono` ISO 8601 date formatting | utility | transform | No date formatting exists anywhere in the codebase currently |

---

## Metadata

**Analog search scope:** `src/` (all Rust source files), `tests/integration/`, `Cargo.toml`
**Files scanned:** `src/server.rs`, `src/main.rs`, `Cargo.toml`, `tests/integration/main.rs`, `tests/integration/server_cycle.rs`
**Pattern extraction date:** 2026-05-23
