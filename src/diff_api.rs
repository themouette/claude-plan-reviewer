use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
};
use serde::Serialize;

// --- Types ---

#[derive(Debug, Clone, Serialize)]
pub struct FileDiff {
    pub filename: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub previous_filename: Option<String>,
    pub status: String, // "added" | "removed" | "modified" | "renamed" | "copied"
    pub additions: u32,
    pub deletions: u32,
    pub changes: u32,
    pub patch: String, // raw unified diff text
}

#[derive(Debug, Clone, Serialize)]
pub struct Commit {
    pub sha: String,
    pub short_sha: String,
    pub message: String,
    pub author: String,
    pub email: String,
    pub date: String, // ISO 8601 / RFC 3339
}

#[derive(Clone)]
pub struct CodeReviewState {
    pub repo_path: std::path::PathBuf,
}

// --- Base branch detection ---

/// Find the merge base candidate commit for the current branch.
///
/// Resolution order per D-07:
///
/// 1. refs/remotes/origin/HEAD (symbolic ref, resolved to direct ref)
/// 2. "main", "origin/main", "master", "origin/master" (revparse_single)
///
/// Returns None if no base branch can be resolved (D-07 — empty array, not error).
pub fn find_base_commit(repo: &git2::Repository) -> Option<git2::Oid> {
    // Step 1: refs/remotes/origin/HEAD symbolic ref (Pitfall 4 — resolve before target)
    if let Ok(origin_head) = repo.find_reference("refs/remotes/origin/HEAD")
        && let Ok(resolved) = origin_head.resolve()
        && let Some(oid) = resolved.target()
    {
        return Some(oid);
    }

    // Steps 2-5: fallback candidates
    let candidates = ["main", "origin/main", "master", "origin/master"];
    for candidate in &candidates {
        if let Ok(obj) = repo.revparse_single(candidate)
            && let Some(commit_oid) = obj.peel_to_commit().ok().map(|c| c.id())
        {
            return Some(commit_oid);
        }
    }

    None
}

// --- ISO 8601 date conversion ---

fn time_to_iso8601(t: &git2::Time) -> String {
    use chrono::{DateTime, FixedOffset, TimeZone};
    let offset = FixedOffset::east_opt(t.offset_minutes() * 60)
        .unwrap_or_else(|| FixedOffset::east_opt(0).unwrap());
    let dt: DateTime<FixedOffset> = offset
        .timestamp_opt(t.seconds(), 0)
        .single()
        .unwrap_or_else(|| offset.timestamp_opt(0, 0).unwrap());
    dt.to_rfc3339()
}

// --- Commit DTO mapping ---

fn commit_to_dto(c: &git2::Commit) -> Commit {
    let sha = c.id().to_string();
    let short_sha = sha.chars().take(7).collect();
    Commit {
        short_sha,
        sha,
        message: c.message().unwrap_or("").to_string(),
        author: c.author().name().unwrap_or("").to_string(),
        email: c.author().email().unwrap_or("").to_string(),
        date: time_to_iso8601(&c.author().when()),
    }
}

// --- Per-file diff extraction ---

fn build_file_diffs(diff: &git2::Diff) -> Vec<FileDiff> {
    // Use .len() on Deltas (ExactSizeIterator) to avoid consuming the iterator.
    // Do NOT call .deltas().count() — that exhausts the iterator (Pitfall 1).
    let num_deltas = diff.deltas().len();
    let mut file_diffs = Vec::with_capacity(num_deltas);

    for i in 0..num_deltas {
        let delta = match diff.get_delta(i) {
            Some(d) => d,
            None => continue,
        };

        let filename = delta
            .new_file()
            .path()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_default();

        let previous_filename = if delta.status() == git2::Delta::Renamed {
            delta
                .old_file()
                .path()
                .map(|p| p.to_string_lossy().into_owned())
        } else {
            None
        };

        let status = match delta.status() {
            git2::Delta::Added => "added",
            git2::Delta::Deleted => "removed",
            git2::Delta::Modified => "modified",
            git2::Delta::Renamed => "renamed",
            git2::Delta::Copied => "copied",
            _ => "modified",
        };

        match git2::Patch::from_diff(diff, i) {
            Ok(Some(mut patch)) => {
                let (_, additions, deletions): (usize, usize, usize) =
                    patch.line_stats().unwrap_or_default();
                let patch_text = match patch.to_buf() {
                    Ok(buf) => String::from_utf8_lossy(&buf).into_owned(),
                    Err(_) => String::new(),
                };
                file_diffs.push(FileDiff {
                    filename,
                    previous_filename,
                    status: status.to_string(),
                    additions: additions as u32,
                    deletions: deletions as u32,
                    changes: (additions + deletions) as u32,
                    patch: patch_text,
                });
            }
            Ok(None) => {
                // Binary file — emit sentinel FileDiff (Pitfall 2)
                file_diffs.push(FileDiff {
                    filename,
                    previous_filename,
                    status: status.to_string(),
                    additions: 0,
                    deletions: 0,
                    changes: 0,
                    patch: "[binary file]".to_string(),
                });
            }
            Err(_) => {
                // Skip deltas that cannot be patched
                continue;
            }
        }
    }

    file_diffs
}

// --- Handlers ---

/// GET /api/diff/branch — returns FileDiff[] for all changes between HEAD and
/// the detected base branch (merge base). Returns an empty array if the repo
/// cannot be opened or no base branch resolves (D-07).
async fn get_diff_branch(State(state): State<Arc<CodeReviewState>>) -> impl IntoResponse {
    Json(try_branch_diff(&state.repo_path).unwrap_or_default())
}

fn try_branch_diff(repo_path: &std::path::Path) -> Option<Vec<FileDiff>> {
    let repo = git2::Repository::open(repo_path).ok()?;

    let head = repo.head().ok()?.peel_to_commit().ok()?;
    let base_candidate = find_base_commit(&repo)?;
    let base_oid = repo.merge_base(head.id(), base_candidate).ok()?;

    let base_commit = repo.find_commit(base_oid).ok()?;
    let base_tree = base_commit.tree().ok()?;
    let head_tree = head.tree().ok()?;

    let mut opts = git2::DiffOptions::new();
    opts.old_prefix("a/").new_prefix("b/");

    let diff = repo
        .diff_tree_to_tree(Some(&base_tree), Some(&head_tree), Some(&mut opts))
        .ok()?;

    Some(build_file_diffs(&diff))
}

/// GET /api/commits — returns Commit[] for all commits between HEAD and the
/// detected base branch. Returns an empty array if the repo cannot be opened
/// or no base branch resolves (D-07).
async fn get_commits(State(state): State<Arc<CodeReviewState>>) -> impl IntoResponse {
    Json(try_list_commits(&state.repo_path).unwrap_or_default())
}

fn try_list_commits(repo_path: &std::path::Path) -> Option<Vec<Commit>> {
    let repo = git2::Repository::open(repo_path).ok()?;

    let head = repo.head().ok()?.peel_to_commit().ok()?;
    let head_oid = head.id();

    let base_oid = find_base_commit(&repo)
        .and_then(|base_candidate| repo.merge_base(head_oid, base_candidate).ok());

    let mut walk = repo.revwalk().ok()?;
    walk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)
        .ok()?;
    walk.push_head().ok()?;

    // Pitfall 3 — hide must be called before iteration
    if let Some(base) = base_oid {
        let _ = walk.hide(base);
    }

    let commits: Vec<Commit> = walk
        .filter_map(|r| {
            let oid = r.ok()?;
            let c = repo.find_commit(oid).ok()?;
            Some(commit_to_dto(&c))
        })
        .collect();

    Some(commits)
}

/// GET /api/diff/commit/:sha — returns FileDiff[] for the single named commit.
///
/// Returns:
/// - 200 + FileDiff[] on success
/// - 400 + JSON {"error": "..."} when sha is not a valid hex OID (T-24-PT mitigated)
/// - 404 + JSON {"error": "..."} when sha is valid hex but not found in the repo
async fn get_diff_commit(
    State(state): State<Arc<CodeReviewState>>,
    Path(sha): Path<String>,
) -> impl IntoResponse {
    // Validate SHA format via Oid::from_str — returns 400 on non-hex / wrong-length input.
    // This blocks path traversal and other injection patterns (T-24-PT).
    let oid = match git2::Oid::from_str(&sha) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "invalid sha"})),
            )
                .into_response();
        }
    };

    let repo = match git2::Repository::open(&state.repo_path) {
        Ok(r) => r,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "failed to open repository"})),
            )
                .into_response();
        }
    };

    // find_commit returns Err when the OID parses but does not exist — surface as 404 (T-24-NF).
    // No libgit2 error string forwarded to client.
    let commit = match repo.find_commit(oid) {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "commit not found"})),
            )
                .into_response();
        }
    };

    let commit_tree = match commit.tree() {
        Ok(t) => t,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "failed to read commit tree"})),
            )
                .into_response();
        }
    };

    // For the first commit (no parent), diff against the empty tree.
    // commit.parent(0).ok() returns None when there is no parent, and
    // diff_tree_to_tree treats None as the empty tree.
    let parent_tree = commit.parent(0).ok().and_then(|p| p.tree().ok());

    let mut opts = git2::DiffOptions::new();
    opts.old_prefix("a/").new_prefix("b/");

    let diff =
        match repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), Some(&mut opts)) {
            Ok(d) => d,
            Err(_) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "diff failed"})),
                )
                    .into_response();
            }
        };

    let file_diffs = build_file_diffs(&diff);
    (StatusCode::OK, Json(file_diffs)).into_response()
}

// --- Router factory ---

/// Create the diff-api sub-router with state attached.
/// Returns `Router<()>` so the assembler can `.merge()` it.
pub fn router(state: Arc<CodeReviewState>) -> Router<()> {
    Router::new()
        .route("/api/diff/branch", get(get_diff_branch))
        .route("/api/commits", get(get_commits))
        .route("/api/diff/commit/:sha", get(get_diff_commit))
        .with_state(state)
}
