use std::sync::{Arc, Mutex};

use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
};
use tokio::sync::oneshot;

// --- Decision type ---

#[derive(serde::Deserialize, Debug, Clone)]
pub struct Decision {
    pub behavior: String,
    pub message: Option<String>,
    pub comments: Vec<serde_json::Value>,
}

// --- Review mode ---

/// Indicates whether the server is handling a plan-review or code-review request.
///
/// In plan-review mode the `behavior` field is mandatory; a missing `behavior`
/// key indicates a malformed payload and is rejected with 422.
/// In code-review mode the frontend sends `{ message, comments }` with no
/// `behavior` key, so a missing `behavior` is expected and defaults to "allow".
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReviewMode {
    PlanReview,
    CodeReview,
}

// --- AppState ---

pub struct AppState {
    pub plan_md: String,
    pub approve_label: String,
    pub deny_label: String,
    pub mode: ReviewMode,
    pub decision_tx: Mutex<Option<oneshot::Sender<Decision>>>,
}

// --- Route handlers ---

async fn get_plan(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::json!({ "plan_md": state.plan_md }))
}

async fn get_config(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::json!({
        "approve_label": state.approve_label,
        "deny_label": state.deny_label,
    }))
}

async fn post_decide(
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let behavior_value = body.get("behavior").and_then(|v| v.as_str());

    let behavior = match behavior_value {
        Some(b) => b.to_string(),
        None => match state.mode {
            ReviewMode::CodeReview => {
                // Code-review frontend sends { message, comments } with no behavior key —
                // this is the expected shape; default to "allow".
                "allow".to_string()
            }
            ReviewMode::PlanReview => {
                // In plan-review mode behavior is required. A missing key likely
                // indicates a malformed or misrouted payload — reject it.
                eprintln!(
                    "plan-reviewer: POST /api/decide missing required 'behavior' field in \
                     plan-review mode; returning 422. Payload keys: {:?}",
                    body.as_object().map(|m| m.keys().collect::<Vec<_>>())
                );
                return StatusCode::UNPROCESSABLE_ENTITY.into_response();
            }
        },
    };

    let message = body
        .get("message")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let comments = body
        .get("comments")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let decision = Decision {
        behavior,
        message,
        comments,
    };

    let tx = state.decision_tx.lock().unwrap().take();
    match tx {
        Some(tx) => {
            let _ = tx.send(decision);
            StatusCode::OK.into_response()
        }
        None => StatusCode::CONFLICT.into_response(), // 409 — already decided
    }
}

// --- Router factory ---

/// Create the plan-review sub-router with state attached.
/// Returns `Router<()>` so the assembler can `.merge()` it.
/// Does NOT attach a fallback — the SPA fallback is added by the assembler only.
pub fn router(state: Arc<AppState>) -> Router<()> {
    Router::new()
        .route("/api/plan", get(get_plan))
        .route("/api/config", get(get_config))
        .route("/api/decide", post(post_decide))
        .with_state(state)
}
