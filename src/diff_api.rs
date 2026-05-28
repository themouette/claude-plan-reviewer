use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
};
use serde::{Deserialize, Serialize};

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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_content: Option<String>, // full file text before change; None for binary files
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_content: Option<String>, // full file text after change; None for binary files
}

#[derive(Debug, Clone, Serialize)]
pub struct Commit {
    pub sha: String,
    pub short_sha: String,
    pub message: String,
    pub author: String,
    pub email: String,
    pub date: String, // ISO 8601 / RFC 3339
    pub branches: Vec<String>,
    pub tags: Vec<String>,
}

#[derive(Clone, Default)]
pub struct CodeReviewState {
    pub repo_path: std::path::PathBuf,
    pub base_branch: Option<String>,
}

#[derive(Deserialize)]
pub struct DiffContextQuery {
    pub context: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CommitList {
    pub commits: Vec<Commit>,
    pub truncated: bool,
}

const COMMIT_LIMIT: usize = 500;

/// Sentinel SHA used for the synthetic "uncommitted changes" commit list entry.
/// All-zeros is a valid 40-hex OID that can never be a real git object.
const UNCOMMITTED_SHA: &str = "0000000000000000000000000000000000000000";

/// Sentinel SHA used for the synthetic "untracked files" commit list entry.
/// One-terminated all-zeros — also can never be a real git object.
const UNTRACKED_SHA: &str = "0000000000000000000000000000000000000001";

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

/// Resolve the base commit, trying an explicit override branch first.
///
/// If `base_override` is Some, revparse_single is tried on that ref. Falls back
/// to `find_base_commit` if the override is absent or does not resolve.
pub fn resolve_base_commit(
    repo: &git2::Repository,
    base_override: Option<&str>,
) -> Option<git2::Oid> {
    if let Some(b) = base_override
        && let Ok(obj) = repo.revparse_single(b)
    {
        return obj.peel_to_commit().ok().map(|c| c.id());
    }
    find_base_commit(repo)
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

/// Build a map from OID → (branches, tags) by iterating all repository
/// references exactly once. Used by try_list_commits to avoid the O(refs × commits)
/// complexity of calling repo.references() inside commit_to_dto for every commit.
fn build_oid_ref_map(
    repo: &git2::Repository,
) -> std::collections::HashMap<git2::Oid, (Vec<String>, Vec<String>)> {
    let mut map: std::collections::HashMap<git2::Oid, (Vec<String>, Vec<String>)> =
        std::collections::HashMap::new();
    if let Ok(refs) = repo.references() {
        for r in refs.flatten() {
            if let Ok(peeled) = r.peel_to_commit()
                && let Some(name) = r.shorthand()
            {
                let entry = map.entry(peeled.id()).or_default();
                if r.is_branch() {
                    entry.0.push(name.to_string());
                } else if r.is_tag() {
                    entry.1.push(name.to_string());
                }
            }
        }
    }
    map
}

/// Map a git2::Commit to a Commit DTO.
/// Accepts a prebuilt OID→refs map so the caller can build it once for all
/// commits in a revwalk (O(1) per commit instead of O(refs) per commit).
fn commit_to_dto(
    c: &git2::Commit,
    oid_to_refs: &std::collections::HashMap<git2::Oid, (Vec<String>, Vec<String>)>,
) -> Commit {
    let sha = c.id().to_string();
    let short_sha = sha.chars().take(7).collect();

    let (branches, tags) = oid_to_refs.get(&c.id()).cloned().unwrap_or_default();

    Commit {
        short_sha,
        sha,
        message: c.message().unwrap_or("").to_string(),
        author: c.author().name().unwrap_or("").to_string(),
        email: c.author().email().unwrap_or("").to_string(),
        date: time_to_iso8601(&c.author().when()),
        branches,
        tags,
    }
}

// --- Per-file diff extraction ---

/// Read blob content as UTF-8 from a git object. Returns `Some("")` for the zero OID
/// (absent side of an add/delete), `None` for binary blobs or encoding errors.
fn extract_blob_content(repo: &git2::Repository, oid: git2::Oid) -> Option<String> {
    if oid.is_zero() {
        return Some(String::new());
    }
    let blob = repo.find_blob(oid).ok()?;
    if blob.is_binary() {
        return None;
    }
    String::from_utf8(blob.content().to_vec()).ok()
}

/// Read new-side file content.
///
/// For committed files the OID is non-zero and we read from the git object store.
/// For workdir files (staged or unstaged changes not yet committed) the OID is zero;
/// we read directly from the working tree so uncommitted changes are visible.
fn extract_new_content(
    repo: &git2::Repository,
    oid: git2::Oid,
    path: Option<&std::path::Path>,
) -> Option<String> {
    if !oid.is_zero() {
        return extract_blob_content(repo, oid);
    }
    // Zero OID = workdir file — read from disk.
    let full_path = repo.workdir()?.join(path?);
    let bytes = std::fs::read(&full_path).ok()?;
    if bytes.contains(&0u8) {
        return None; // treat files with NUL bytes as binary
    }
    String::from_utf8(bytes).ok()
}

fn build_file_diffs(diff: &git2::Diff, repo: &git2::Repository) -> Vec<FileDiff> {
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
                let old_content = extract_blob_content(repo, delta.old_file().id());
                // For deleted files the new side is always empty — use "" so the
                // frontend can use FileDiffComponent (line comments) instead of falling
                // back to PatchDiff. Only set Some("") when old_content is also Some
                // (i.e. the file was text); binary files stay None → PatchDiff.
                let new_content = if delta.status() == git2::Delta::Deleted {
                    old_content.as_ref().map(|_| String::new())
                } else {
                    extract_new_content(repo, delta.new_file().id(), delta.new_file().path())
                };
                file_diffs.push(FileDiff {
                    filename,
                    previous_filename,
                    status: status.to_string(),
                    additions: additions as u32,
                    deletions: deletions as u32,
                    changes: (additions + deletions) as u32,
                    patch: patch_text,
                    old_content,
                    new_content,
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
                    old_content: None,
                    new_content: None,
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
/// Accepts optional `?context=N` query param (u32) to control context lines;
/// defaults to 3. Returns 400 on non-u32 input (T-25-CINV).
async fn get_diff_branch(
    State(state): State<Arc<CodeReviewState>>,
    Query(params): Query<DiffContextQuery>,
) -> impl IntoResponse {
    let context_lines = params.context.unwrap_or(3);
    Json(
        try_branch_diff(
            &state.repo_path,
            context_lines,
            state.base_branch.as_deref(),
        )
        .unwrap_or_default(),
    )
}

fn try_branch_diff(
    repo_path: &std::path::Path,
    context_lines: u32,
    base_branch: Option<&str>,
) -> Option<Vec<FileDiff>> {
    let repo = git2::Repository::open(repo_path).ok()?;

    let head = repo.head().ok()?.peel_to_commit().ok()?;
    let base_candidate = resolve_base_commit(&repo, base_branch)?;
    let base_oid = repo.merge_base(head.id(), base_candidate).ok()?;

    let base_commit = repo.find_commit(base_oid).ok()?;
    let base_tree = base_commit.tree().ok()?;

    let mut opts = git2::DiffOptions::new();
    opts.old_prefix("a/").new_prefix("b/");
    opts.context_lines(context_lines);

    // diff_tree_to_workdir_with_index: base → workdir (staged + unstaged).
    // This includes committed branch changes AND any uncommitted work in progress.
    let diff = repo
        .diff_tree_to_workdir_with_index(Some(&base_tree), Some(&mut opts))
        .ok()?;

    Some(build_file_diffs(&diff, &repo))
}

fn has_uncommitted_changes(repo: &git2::Repository) -> bool {
    let Ok(head) = repo.head().and_then(|h| h.peel_to_commit()) else {
        return false;
    };
    let Ok(head_tree) = head.tree() else {
        return false;
    };
    let mut opts = git2::DiffOptions::new();
    repo.diff_tree_to_workdir_with_index(Some(&head_tree), Some(&mut opts))
        .map(|d| d.deltas().len() > 0)
        .unwrap_or(false)
}

fn try_uncommitted_diff(repo_path: &std::path::Path, context_lines: u32) -> Option<Vec<FileDiff>> {
    let repo = git2::Repository::open(repo_path).ok()?;
    let head_tree = repo.head().ok()?.peel_to_commit().ok()?.tree().ok()?;
    let mut opts = git2::DiffOptions::new();
    opts.old_prefix("a/").new_prefix("b/");
    opts.context_lines(context_lines);
    let diff = repo
        .diff_tree_to_workdir_with_index(Some(&head_tree), Some(&mut opts))
        .ok()?;
    Some(build_file_diffs(&diff, &repo))
}

fn has_untracked_files(repo: &git2::Repository) -> bool {
    let mut opts = git2::StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);
    repo.statuses(Some(&mut opts))
        .map(|s| s.iter().any(|e| e.status().contains(git2::Status::WT_NEW)))
        .unwrap_or(false)
}

fn try_untracked_diff(repo_path: &std::path::Path) -> Option<Vec<FileDiff>> {
    let repo = git2::Repository::open(repo_path).ok()?;
    let workdir = repo.workdir()?.to_path_buf();

    let mut opts = git2::StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);
    let statuses = repo.statuses(Some(&mut opts)).ok()?;

    let mut file_diffs = Vec::new();
    for entry in statuses.iter() {
        if !entry.status().contains(git2::Status::WT_NEW) {
            continue;
        }
        let Some(path) = entry.path() else { continue };
        let full_path = workdir.join(path);
        if full_path.is_dir() {
            continue;
        }
        match std::fs::read_to_string(&full_path) {
            Ok(content) => {
                let lines: Vec<&str> = content.lines().collect();
                let additions = lines.len() as u32;
                let patch_body: String = lines.iter().map(|l| format!("+{l}\n")).collect();
                let patch =
                    format!("--- /dev/null\n+++ b/{path}\n@@ -0,0 +1,{additions} @@\n{patch_body}");
                file_diffs.push(FileDiff {
                    filename: path.to_string(),
                    previous_filename: None,
                    status: "added".to_string(),
                    additions,
                    deletions: 0,
                    changes: additions,
                    patch,
                    old_content: Some(String::new()),
                    new_content: Some(content),
                });
            }
            Err(_) => {
                // Binary or unreadable file
                file_diffs.push(FileDiff {
                    filename: path.to_string(),
                    previous_filename: None,
                    status: "added".to_string(),
                    additions: 0,
                    deletions: 0,
                    changes: 0,
                    patch: "[binary file]".to_string(),
                    old_content: None,
                    new_content: None,
                });
            }
        }
    }

    Some(file_diffs)
}

/// GET /api/commits — returns `{ commits: Commit[], truncated: bool }` for
/// commits between HEAD and the detected base branch. Returns an empty list
/// if the repo cannot be opened or no base branch resolves (D-07).
/// Capped at COMMIT_LIMIT entries; `truncated: true` when the cap is hit.
async fn get_commits(State(state): State<Arc<CodeReviewState>>) -> impl IntoResponse {
    Json(
        try_list_commits(&state.repo_path, state.base_branch.as_deref()).unwrap_or(CommitList {
            commits: vec![],
            truncated: false,
        }),
    )
}

fn try_list_commits(repo_path: &std::path::Path, base_branch: Option<&str>) -> Option<CommitList> {
    let repo = git2::Repository::open(repo_path).ok()?;

    let head = repo.head().ok()?.peel_to_commit().ok()?;
    let head_oid = head.id();

    // D-07: no base branch → return empty list (consistent with get_diff_branch).
    // Without this guard the revwalk would traverse the entire repo history,
    // which hangs or OOMs in large monorepos.
    let base_candidate = resolve_base_commit(&repo, base_branch)?;
    let base_oid = repo.merge_base(head_oid, base_candidate).ok()?;

    let mut walk = repo.revwalk().ok()?;
    walk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)
        .ok()?;
    walk.push_head().ok()?;
    // Pitfall 3 — hide must be called before iteration
    let _ = walk.hide(base_oid);

    // WR-05: build the OID→refs map once before the revwalk so commit_to_dto
    // can look up branches/tags in O(1) instead of O(refs) per commit.
    let oid_to_refs = build_oid_ref_map(&repo);

    // Collect up to COMMIT_LIMIT + 1 so we can detect truncation without
    // walking the full history.
    let mut commits: Vec<Commit> = walk
        .filter_map(|r| {
            let oid = r.ok()?;
            let c = repo.find_commit(oid).ok()?;
            Some(commit_to_dto(&c, &oid_to_refs))
        })
        .take(COMMIT_LIMIT + 1)
        .collect();

    let truncated = commits.len() > COMMIT_LIMIT;
    commits.truncate(COMMIT_LIMIT);

    // Prepend synthetic entries for in-progress work. Detect both conditions upfront
    // so the insertion indices stay stable: uncommitted at 0, untracked at 1.
    let has_uncommitted = has_uncommitted_changes(&repo);
    let has_untracked = has_untracked_files(&repo);

    if has_uncommitted {
        commits.insert(
            0,
            Commit {
                sha: UNCOMMITTED_SHA.to_string(),
                short_sha: "--".to_string(),
                message: "Uncommitted changes".to_string(),
                author: String::new(),
                email: String::new(),
                date: String::new(),
                branches: vec![],
                tags: vec![],
            },
        );
    }
    if has_untracked {
        // Insert after "Uncommitted changes" if present, otherwise at top.
        commits.insert(
            usize::from(has_uncommitted),
            Commit {
                sha: UNTRACKED_SHA.to_string(),
                short_sha: "--".to_string(),
                message: "Untracked files".to_string(),
                author: String::new(),
                email: String::new(),
                date: String::new(),
                branches: vec![],
                tags: vec![],
            },
        );
    }

    Some(CommitList { commits, truncated })
}

/// GET /api/diff/commit/:sha — returns FileDiff[] for the single named commit.
///
/// Returns:
/// - 200 + FileDiff[] on success
/// - 400 + JSON {"error": "..."} when sha is not a valid hex OID (T-24-PT mitigated)
///   or when `?context` is not a valid u32 (T-25-CINV)
/// - 404 + JSON {"error": "..."} when sha is valid hex but not found in the repo
async fn get_diff_commit(
    State(state): State<Arc<CodeReviewState>>,
    Query(params): Query<DiffContextQuery>,
    Path(sha): Path<String>,
) -> impl IntoResponse {
    // Sentinel: return uncommitted (HEAD → workdir) diff.
    if sha == UNCOMMITTED_SHA {
        let context_lines = params.context.unwrap_or(3);
        let file_diffs = try_uncommitted_diff(&state.repo_path, context_lines).unwrap_or_default();
        return (StatusCode::OK, Json(file_diffs)).into_response();
    }

    // Sentinel: return untracked (new files not yet staged) diff.
    if sha == UNTRACKED_SHA {
        let file_diffs = try_untracked_diff(&state.repo_path).unwrap_or_default();
        return (StatusCode::OK, Json(file_diffs)).into_response();
    }

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

    let context_lines = params.context.unwrap_or(3);
    let mut opts = git2::DiffOptions::new();
    opts.old_prefix("a/").new_prefix("b/");
    opts.context_lines(context_lines);

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

    let file_diffs = build_file_diffs(&diff, &repo);
    (StatusCode::OK, Json(file_diffs)).into_response()
}

// --- Router factory ---

/// Create the diff-api sub-router with state attached.
/// Returns `Router<()>` so the assembler can `.merge()` it.
pub fn router(state: Arc<CodeReviewState>) -> Router<()> {
    Router::new()
        .route("/api/diff/branch", get(get_diff_branch))
        .route("/api/commits", get(get_commits))
        .route("/api/diff/commit/{sha}", get(get_diff_commit))
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use std::sync::Arc;
    use tower::ServiceExt;

    // --- Test fixture helpers ---

    /// Build a minimal repo with a single initial commit on a branch named `main`.
    /// Returns (TempDir, Repository) — the TempDir must be kept alive for the duration
    /// of the test to prevent the tmpdir from being deleted.
    fn make_repo_with_main() -> (tempfile::TempDir, git2::Repository) {
        let tmp = tempfile::tempdir().unwrap();
        let repo = git2::Repository::init(tmp.path()).unwrap();

        let sig = git2::Signature::now("test", "test@test.com").unwrap();
        // Build the initial tree from the (empty) index.
        let commit_oid = {
            let tree_id = repo.index().unwrap().write_tree().unwrap();
            let tree = repo.find_tree(tree_id).unwrap();
            let oid = repo
                .commit(Some("HEAD"), &sig, &sig, "init on main", &tree, &[])
                .unwrap();
            // `tree` borrow ends here — drop it before we move `repo` below.
            drop(tree);
            oid
        };

        // Ensure HEAD is on `refs/heads/main`.
        // After `repo.commit(Some("HEAD"), ...)`, git creates/advances the current HEAD branch.
        // If `git init` defaulted to `master`, we need to create `main` explicitly and
        // switch HEAD to it. If it defaulted to `main`, the branch already exists and
        // we just confirm HEAD.
        let head_branch = repo
            .head()
            .ok()
            .and_then(|h| h.shorthand().map(|s| s.to_string()));
        if head_branch.as_deref() != Some("main") {
            // HEAD is on a branch that is not `main` — create `main` from the commit.
            {
                let commit = repo.find_commit(commit_oid).unwrap();
                repo.branch("main", &commit, false).unwrap();
            }
            repo.set_head("refs/heads/main").unwrap();

            // Delete the old default branch (e.g. `master`).
            if let Ok(mut master) = repo.find_branch("master", git2::BranchType::Local) {
                master.delete().unwrap_or(());
            }
        }

        (tmp, repo)
    }

    /// Build a repo with an initial commit on `main`, then a `feature` branch with one commit
    /// per entry in `extra_files`. Returns (TempDir, Repository, Vec<Oid>) where the Oid
    /// list contains the feature-branch commit OIDs in order.
    fn make_repo_with_main_and_feature(
        extra_files: &[(&str, &str)],
    ) -> (tempfile::TempDir, git2::Repository, Vec<git2::Oid>) {
        use std::fs;

        let (tmp, repo) = make_repo_with_main();

        // Obtain the main commit (current HEAD) as the feature-branch base.
        let main_commit_oid = repo.head().unwrap().peel_to_commit().unwrap().id();

        // Create and switch to `feature` branch.
        // Scope the main_commit borrow so it is dropped before we move `repo` later.
        {
            let main_commit = repo.find_commit(main_commit_oid).unwrap();
            repo.branch("feature", &main_commit, false).unwrap();
            // `main_commit` dropped here.
        }
        repo.set_head("refs/heads/feature").unwrap();

        let sig = git2::Signature::now("test", "test@test.com").unwrap();
        let mut parent_oid = main_commit_oid;
        let mut feature_oids = Vec::new();

        for (path, content) in extra_files {
            // Write the file into the tmpdir.
            let full_path = tmp.path().join(path);
            fs::write(&full_path, content).unwrap();

            // Scope tree and parent_commit so they are dropped before the next iteration
            // (both borrow `repo` and must not outlive its move at end of function).
            let oid = {
                let mut index = repo.index().unwrap();
                index.add_path(std::path::Path::new(path)).unwrap();
                index.write().unwrap();
                let tree_id = index.write_tree().unwrap();
                let tree = repo.find_tree(tree_id).unwrap();
                let parent_commit = repo.find_commit(parent_oid).unwrap();
                let msg = format!("feature: add {path}");
                let o = repo
                    .commit(Some("HEAD"), &sig, &sig, &msg, &tree, &[&parent_commit])
                    .unwrap();
                drop(tree);
                drop(parent_commit);
                o
            };
            feature_oids.push(oid);
            parent_oid = oid;
        }

        (tmp, repo, feature_oids)
    }

    /// Send a GET request to the router and return (StatusCode, parsed JSON body).
    async fn do_get(state: Arc<CodeReviewState>, uri: &str) -> (StatusCode, serde_json::Value) {
        let app = router(state);
        let res = app
            .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
            .await
            .unwrap();
        let status = res.status();
        let body = res.into_body().collect().await.unwrap().to_bytes();
        let json = serde_json::from_slice(&body).unwrap_or(serde_json::Value::Null);
        (status, json)
    }

    // --- Tests ---

    /// Test 1: /api/diff/branch returns an empty array when no base branch resolves.
    /// Uses a repo whose only branch is named `wip` (not in the candidate list).
    #[tokio::test]
    async fn get_diff_branch_returns_empty_array_when_no_base_resolves() {
        let tmp = tempfile::tempdir().unwrap();
        let repo = git2::Repository::init(tmp.path()).unwrap();

        let sig = git2::Signature::now("test", "test@test.com").unwrap();
        let commit_oid = {
            let tree_id = repo.index().unwrap().write_tree().unwrap();
            let tree = repo.find_tree(tree_id).unwrap();
            let oid = repo
                .commit(Some("HEAD"), &sig, &sig, "wip commit", &tree, &[])
                .unwrap();
            drop(tree);
            oid
        };

        // Point HEAD at a branch name that is not in the candidate list.
        {
            let commit = repo.find_commit(commit_oid).unwrap();
            repo.branch("wip", &commit, false).unwrap();
        }
        repo.set_head("refs/heads/wip").unwrap();

        // Delete `master`/`main` if git created them so find_base_commit returns None.
        if let Ok(mut b) = repo.find_branch("master", git2::BranchType::Local) {
            b.delete().unwrap_or(());
        }
        if let Ok(mut b) = repo.find_branch("main", git2::BranchType::Local) {
            b.delete().unwrap_or(());
        }

        let state = Arc::new(CodeReviewState {
            repo_path: tmp.path().to_path_buf(),
            ..Default::default()
        });
        let (status, json) = do_get(state, "/api/diff/branch").await;
        assert_eq!(status, StatusCode::OK);
        assert!(
            json.as_array().unwrap().is_empty(),
            "Expected empty array, got: {json}"
        );
    }

    /// Test 2: /api/diff/branch returns a FileDiff[] with the added file when on a feature branch.
    #[tokio::test]
    async fn get_diff_branch_returns_added_file_against_main_base() {
        let (tmp, _repo, _oids) = make_repo_with_main_and_feature(&[("new.txt", "hello\n")]);
        let state = Arc::new(CodeReviewState {
            repo_path: tmp.path().to_path_buf(),
            ..Default::default()
        });
        let (status, json) = do_get(state, "/api/diff/branch").await;
        assert_eq!(status, StatusCode::OK);

        let arr = json.as_array().expect("expected JSON array");
        assert_eq!(arr.len(), 1, "Expected 1 file diff, got {}", arr.len());

        let entry = &arr[0];
        assert_eq!(entry["filename"], "new.txt");
        assert_eq!(entry["status"], "added");
        assert_eq!(entry["additions"].as_u64(), Some(1));
        assert_eq!(entry["deletions"].as_u64(), Some(0));
        assert!(
            entry.get("previous_filename").is_none(),
            "previous_filename must be absent for added files"
        );
    }

    /// Test 3: /api/commits returns only the feature-branch commits.
    #[tokio::test]
    async fn get_commits_returns_only_branch_commits() {
        let (tmp, _repo, _oids) = make_repo_with_main_and_feature(&[("new.txt", "hello\n")]);
        let state = Arc::new(CodeReviewState {
            repo_path: tmp.path().to_path_buf(),
            ..Default::default()
        });
        let (status, json) = do_get(state, "/api/commits").await;
        assert_eq!(status, StatusCode::OK);

        assert_eq!(json["truncated"], false, "truncated must be false");
        let arr = json["commits"].as_array().expect("expected commits array");
        assert_eq!(arr.len(), 1, "Expected 1 commit, got {}", arr.len());

        let entry = &arr[0];
        assert_eq!(
            entry["short_sha"].as_str().unwrap().len(),
            7,
            "short_sha must be 7 chars"
        );
        assert_eq!(
            entry["sha"].as_str().unwrap().len(),
            40,
            "sha must be 40 chars"
        );
        assert!(
            !entry["date"].as_str().unwrap().is_empty(),
            "date must be non-empty"
        );
        assert!(
            entry["message"].as_str().unwrap().contains("feature"),
            "commit message must contain 'feature', got: {}",
            entry["message"]
        );
    }

    /// Test 4: /api/diff/commit/:sha with a syntactically invalid SHA returns HTTP 400.
    #[tokio::test]
    async fn get_diff_commit_with_invalid_sha_returns_400() {
        let (tmp, _repo) = make_repo_with_main();
        let state = Arc::new(CodeReviewState {
            repo_path: tmp.path().to_path_buf(),
            ..Default::default()
        });
        let (status, json) = do_get(state, "/api/diff/commit/zzz").await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert!(
            json["error"].is_string(),
            "Expected error field in body, got: {json}"
        );
    }

    /// Test 5: /api/diff/commit/:sha with a valid hex SHA that doesn't exist returns HTTP 404.
    #[tokio::test]
    async fn get_diff_commit_with_unknown_sha_returns_404() {
        let (tmp, _repo) = make_repo_with_main();
        let state = Arc::new(CodeReviewState {
            repo_path: tmp.path().to_path_buf(),
            ..Default::default()
        });
        let unknown = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
        let uri = format!("/api/diff/commit/{unknown}");
        let (status, json) = do_get(state, &uri).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert!(
            json["error"].is_string(),
            "Expected error field in body, got: {json}"
        );
    }

    /// Test 5b: deleted files have new_content: "" so FileDiffComponent (line comments) can render them.
    #[tokio::test]
    async fn deleted_file_has_empty_string_new_content() {
        use std::fs;
        let (tmp, repo, feature_oids) =
            make_repo_with_main_and_feature(&[("todelete.txt", "hello\nworld\n")]);

        // Create a second commit on the feature branch that deletes the file.
        fs::remove_file(tmp.path().join("todelete.txt")).unwrap();
        let mut index = repo.index().unwrap();
        index
            .remove_path(std::path::Path::new("todelete.txt"))
            .unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = git2::Signature::now("test", "test@test.com").unwrap();
        let parent = repo.find_commit(feature_oids[0]).unwrap();
        let delete_oid = repo
            .commit(Some("HEAD"), &sig, &sig, "delete file", &tree, &[&parent])
            .unwrap();

        // Request the diff for that specific commit — it shows todelete.txt as removed.
        let state = Arc::new(CodeReviewState {
            repo_path: tmp.path().to_path_buf(),
            ..Default::default()
        });
        let (status, json) = do_get(state, &format!("/api/diff/commit/{delete_oid}")).await;
        assert_eq!(status, StatusCode::OK);

        let arr = json.as_array().expect("expected JSON array");
        let entry = arr
            .iter()
            .find(|e| e["filename"].as_str() == Some("todelete.txt"))
            .expect("todelete.txt not in diff");

        assert_eq!(
            entry["status"].as_str(),
            Some("removed"),
            "status must be 'removed'"
        );
        assert_eq!(
            entry["new_content"].as_str(),
            Some(""),
            "new_content must be \"\" for deleted text files so FileDiffComponent can render them"
        );
        assert!(
            entry["old_content"].as_str().is_some(),
            "old_content must be present for deleted text files"
        );
    }

    /// Test 6: /api/diff/commit/:sha on the first commit returns a diff against the empty tree.
    #[tokio::test]
    async fn get_diff_commit_for_first_commit_diffs_against_empty_tree() {
        use std::fs;

        let tmp = tempfile::tempdir().unwrap();
        let repo = git2::Repository::init(tmp.path()).unwrap();

        // Write hello.txt and make the first (and only) commit.
        fs::write(tmp.path().join("hello.txt"), "hi\n").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("hello.txt")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = git2::Signature::now("test", "test@test.com").unwrap();
        let first_oid = repo
            .commit(Some("HEAD"), &sig, &sig, "first commit", &tree, &[])
            .unwrap();

        let state = Arc::new(CodeReviewState {
            repo_path: tmp.path().to_path_buf(),
            ..Default::default()
        });
        let uri = format!("/api/diff/commit/{first_oid}");
        let (status, json) = do_get(state, &uri).await;
        assert_eq!(status, StatusCode::OK);

        let arr = json.as_array().expect("expected JSON array");
        assert_eq!(arr.len(), 1, "Expected 1 file diff, got {}", arr.len());

        let entry = &arr[0];
        assert_eq!(entry["filename"], "hello.txt");
        assert_eq!(entry["status"], "added");
        assert!(
            entry["additions"].as_u64().unwrap() >= 1,
            "Expected at least 1 addition"
        );
    }

    /// Test 7: /api/diff/commit/:sha for the second commit returns only that commit's changes.
    #[tokio::test]
    async fn get_diff_commit_for_named_commit_returns_only_that_commits_changes() {
        let (tmp, _repo, feature_oids) =
            make_repo_with_main_and_feature(&[("a.txt", "first\n"), ("b.txt", "second\n")]);
        // Query the SECOND feature commit (adds b.txt, not a.txt).
        let second_oid = feature_oids[1];

        let state = Arc::new(CodeReviewState {
            repo_path: tmp.path().to_path_buf(),
            ..Default::default()
        });
        let uri = format!("/api/diff/commit/{second_oid}");
        let (status, json) = do_get(state, &uri).await;
        assert_eq!(status, StatusCode::OK);

        let arr = json.as_array().expect("expected JSON array");
        assert_eq!(arr.len(), 1, "Expected 1 file diff, got {}", arr.len());
        assert_eq!(
            arr[0]["filename"], "b.txt",
            "Expected b.txt (second commit), not a.txt"
        );
    }

    /// Test 8: ?context=0 returns a smaller patch than ?context=999 for a multi-line file.
    /// Verifies D-05: Expand All = context=999 produces strictly more context than context=0.
    ///
    /// The fixture creates a file with many stable lines on main, then modifies one middle
    /// line on the feature branch. With context=0 the patch shows only the changed lines;
    /// with context=999 the patch includes all surrounding lines.
    #[tokio::test]
    async fn get_diff_branch_context_param_changes_patch_size() {
        use std::fs;

        // Build a file with many stable lines around a single modification point.
        // "stable" has 5 lines on each side — context=0 hides them; context=999 shows them.
        let stable_lines: String = (1..=10).map(|i| format!("stable{i}\n")).collect();
        let main_content = format!("{stable_lines}ORIGINAL\n{stable_lines}");
        let feature_content = format!("{stable_lines}MODIFIED\n{stable_lines}");

        // Step 1: create main with the multi-line file already present.
        let tmp = tempfile::tempdir().unwrap();
        let repo = git2::Repository::init(tmp.path()).unwrap();
        let sig = git2::Signature::now("test", "test@test.com").unwrap();

        let file_path = tmp.path().join("multi.txt");
        fs::write(&file_path, &main_content).unwrap();
        let main_oid = {
            let mut index = repo.index().unwrap();
            index.add_path(std::path::Path::new("multi.txt")).unwrap();
            index.write().unwrap();
            let tree_id = index.write_tree().unwrap();
            let tree = repo.find_tree(tree_id).unwrap();
            let oid = repo
                .commit(
                    Some("HEAD"),
                    &sig,
                    &sig,
                    "init main with multi.txt",
                    &tree,
                    &[],
                )
                .unwrap();
            drop(tree);
            oid
        };

        // Ensure HEAD is on `refs/heads/main` (handle git defaulting to master).
        let head_branch = repo
            .head()
            .ok()
            .and_then(|h| h.shorthand().map(|s| s.to_string()));
        if head_branch.as_deref() != Some("main") {
            let commit = repo.find_commit(main_oid).unwrap();
            repo.branch("main", &commit, false).unwrap();
            repo.set_head("refs/heads/main").unwrap();
            if let Ok(mut master) = repo.find_branch("master", git2::BranchType::Local) {
                master.delete().unwrap_or(());
            }
        }

        // Step 2: create feature branch from main and commit the modification.
        {
            let main_commit = repo.find_commit(main_oid).unwrap();
            repo.branch("feature", &main_commit, false).unwrap();
        }
        repo.set_head("refs/heads/feature").unwrap();

        fs::write(&file_path, &feature_content).unwrap();
        {
            let mut index = repo.index().unwrap();
            index.add_path(std::path::Path::new("multi.txt")).unwrap();
            index.write().unwrap();
            let tree_id = index.write_tree().unwrap();
            let tree = repo.find_tree(tree_id).unwrap();
            let parent = repo.find_commit(main_oid).unwrap();
            repo.commit(
                Some("HEAD"),
                &sig,
                &sig,
                "feature: modify multi.txt",
                &tree,
                &[&parent],
            )
            .unwrap();
        }

        let state = Arc::new(CodeReviewState {
            repo_path: tmp.path().to_path_buf(),
            ..Default::default()
        });

        let (status0, json0) = do_get(Arc::clone(&state), "/api/diff/branch?context=0").await;
        assert_eq!(status0, StatusCode::OK);
        let (status999, json999) = do_get(Arc::clone(&state), "/api/diff/branch?context=999").await;
        assert_eq!(status999, StatusCode::OK);

        let arr0 = json0.as_array().unwrap();
        let arr999 = json999.as_array().unwrap();
        assert_eq!(arr0.len(), 1, "Expected 1 file diff for context=0");
        assert_eq!(arr999.len(), 1, "Expected 1 file diff for context=999");

        let patch0 = arr0[0]["patch"].as_str().unwrap().to_string();
        let patch999 = arr999[0]["patch"].as_str().unwrap().to_string();

        assert!(
            patch999.len() > patch0.len(),
            "context=999 patch ({} bytes) should be longer than context=0 patch ({} bytes)",
            patch999.len(),
            patch0.len()
        );
    }

    /// Test 9: /api/diff/branch?context=abc returns HTTP 400 (axum Query rejects non-u32).
    #[tokio::test]
    async fn get_diff_branch_invalid_context_returns_400() {
        let (tmp, _repo, _oids) = make_repo_with_main_and_feature(&[("x.txt", "a\nb\n")]);
        let state = Arc::new(CodeReviewState {
            repo_path: tmp.path().to_path_buf(),
            ..Default::default()
        });
        let (status, _json) = do_get(state, "/api/diff/branch?context=abc").await;
        assert_eq!(
            status,
            StatusCode::BAD_REQUEST,
            "Non-u32 ?context must return 400"
        );
    }

    /// Test 10: /api/diff/branch (no param) returns the same patch as ?context=3 (default = 3).
    #[tokio::test]
    async fn get_diff_branch_default_matches_context_3() {
        let (tmp, _repo, _oids) =
            make_repo_with_main_and_feature(&[("y.txt", "one\ntwo\nthree\n")]);
        let state = Arc::new(CodeReviewState {
            repo_path: tmp.path().to_path_buf(),
            ..Default::default()
        });

        let (status_default, json_default) = do_get(Arc::clone(&state), "/api/diff/branch").await;
        assert_eq!(status_default, StatusCode::OK);

        let (status_3, json_3) = do_get(Arc::clone(&state), "/api/diff/branch?context=3").await;
        assert_eq!(status_3, StatusCode::OK);

        let patch_default = json_default.as_array().unwrap()[0]["patch"]
            .as_str()
            .unwrap()
            .to_string();
        let patch_3 = json_3.as_array().unwrap()[0]["patch"]
            .as_str()
            .unwrap()
            .to_string();

        assert_eq!(
            patch_default, patch_3,
            "No-param patch must be byte-identical to ?context=3 patch"
        );
    }

    /// Test 11: /api/diff/commit/:sha?context=999 returns HTTP 200 with a JSON array.
    #[tokio::test]
    async fn get_diff_commit_accepts_context_param() {
        let content_base = "line\n".repeat(5) + "ORIGINAL\n" + &"line\n".repeat(4);
        let content_mod = "line\n".repeat(5) + "MODIFIED\n" + &"line\n".repeat(4);
        let (tmp, _repo, feature_oids) = make_repo_with_main_and_feature(&[
            ("multi.txt", &content_base),
            ("multi.txt", &content_mod),
        ]);

        // Use the second commit which modifies multi.txt.
        let second_oid = feature_oids[1];
        let state = Arc::new(CodeReviewState {
            repo_path: tmp.path().to_path_buf(),
            ..Default::default()
        });
        let uri = format!("/api/diff/commit/{second_oid}?context=999");
        let (status, json) = do_get(state, &uri).await;
        assert_eq!(status, StatusCode::OK, "?context=999 must return 200");

        let arr = json.as_array().expect("expected JSON array");
        assert_eq!(arr.len(), 1, "Expected 1 file diff, got {}", arr.len());
    }

    /// Test 12: /api/commits returns commits[0].branches as a non-empty JSON array
    /// when the HEAD commit is pointed to by a named branch ref.
    /// The fixture creates a `feature` branch pointing at the feature commit, so
    /// branches must contain at least one entry.
    #[tokio::test]
    async fn get_commits_populates_branches_from_repo_refs() {
        let (tmp, _repo, _feature_oids) = make_repo_with_main_and_feature(&[("a.txt", "x\n")]);
        let state = Arc::new(CodeReviewState {
            repo_path: tmp.path().to_path_buf(),
            ..Default::default()
        });
        let (status, json) = do_get(state, "/api/commits").await;
        assert_eq!(status, StatusCode::OK);

        let commits = json["commits"].as_array().expect("expected commits array");
        assert!(!commits.is_empty(), "Expected at least one commit");

        let branches = commits[0]["branches"]
            .as_array()
            .expect("commits[0].branches must be a JSON array");
        assert!(
            !branches.is_empty(),
            "commits[0].branches must be non-empty — the feature branch ref should be resolved; got: {branches:?}"
        );
    }

    /// Test 13: /api/commits does NOT include an "Untracked files" entry when there are none.
    #[tokio::test]
    async fn get_commits_no_untracked_entry_when_none_exist() {
        let (tmp, _repo, _oids) = make_repo_with_main_and_feature(&[("a.txt", "x\n")]);
        let state = Arc::new(CodeReviewState {
            repo_path: tmp.path().to_path_buf(),
            ..Default::default()
        });
        let (status, json) = do_get(state, "/api/commits").await;
        assert_eq!(status, StatusCode::OK);

        let commits = json["commits"].as_array().expect("expected commits array");
        assert!(
            commits
                .iter()
                .all(|c| c["message"].as_str() != Some("Untracked files")),
            "No untracked entry expected when workdir is clean"
        );
    }

    /// Test 14: /api/commits includes an "Untracked files" entry when the workdir has new files.
    #[tokio::test]
    async fn get_commits_includes_untracked_entry_when_new_files_exist() {
        use std::fs;
        let (tmp, _repo, _oids) = make_repo_with_main_and_feature(&[("a.txt", "x\n")]);
        // Write an untracked file (not staged)
        fs::write(tmp.path().join("untracked.txt"), "new content\n").unwrap();

        let state = Arc::new(CodeReviewState {
            repo_path: tmp.path().to_path_buf(),
            ..Default::default()
        });
        let (status, json) = do_get(state, "/api/commits").await;
        assert_eq!(status, StatusCode::OK);

        let commits = json["commits"].as_array().expect("expected commits array");
        let untracked_entry = commits
            .iter()
            .find(|c| c["message"].as_str() == Some("Untracked files"))
            .expect("Expected an 'Untracked files' synthetic entry");

        assert_eq!(untracked_entry["sha"].as_str(), Some(UNTRACKED_SHA));
        assert_eq!(untracked_entry["short_sha"].as_str(), Some("--"));
    }

    /// Test 15: /api/diff/commit/UNTRACKED_SHA returns the untracked file as an added FileDiff.
    #[tokio::test]
    async fn get_diff_commit_untracked_sha_returns_untracked_files() {
        use std::fs;
        let (tmp, _repo, _oids) = make_repo_with_main_and_feature(&[("a.txt", "x\n")]);
        fs::write(tmp.path().join("new.txt"), "hello\nworld\n").unwrap();

        let state = Arc::new(CodeReviewState {
            repo_path: tmp.path().to_path_buf(),
            ..Default::default()
        });
        let uri = format!("/api/diff/commit/{UNTRACKED_SHA}");
        let (status, json) = do_get(state, &uri).await;
        assert_eq!(status, StatusCode::OK);

        let arr = json.as_array().expect("expected JSON array");
        assert_eq!(arr.len(), 1, "Expected 1 FileDiff for the untracked file");

        let entry = &arr[0];
        assert_eq!(entry["filename"].as_str(), Some("new.txt"));
        assert_eq!(entry["status"].as_str(), Some("added"));
        assert_eq!(entry["additions"].as_u64(), Some(2));
        assert_eq!(entry["deletions"].as_u64(), Some(0));
        let patch = entry["patch"].as_str().unwrap_or("");
        assert!(
            patch.contains("+hello"),
            "Patch should contain '+hello': {patch}"
        );
        assert!(
            patch.contains("+world"),
            "Patch should contain '+world': {patch}"
        );
        assert_eq!(
            entry["new_content"].as_str(),
            Some("hello\nworld\n"),
            "new_content should hold the full file text"
        );
        assert_eq!(
            entry["old_content"].as_str(),
            Some(""),
            "old_content must be \"\" for untracked files so FileDiffComponent can render them"
        );
    }

    /// Test shell_branch_diff: directly calling the shell path on a standard repo
    /// must return the same single-file result as the git2 path.
    #[tokio::test]
    async fn shell_branch_diff_returns_added_file() {
        let (tmp, _repo, _oids) = make_repo_with_main_and_feature(&[("shell_test.txt", "hello\n")]);
        let result = shell_branch_diff(tmp.path(), 3, None);
        let file_diffs = result.expect("shell_branch_diff must return Some");
        assert_eq!(file_diffs.len(), 1, "Expected 1 file diff, got {}", file_diffs.len());
        assert_eq!(file_diffs[0].filename, "shell_test.txt");
        assert_eq!(file_diffs[0].status, "added");
        assert_eq!(file_diffs[0].additions, 1);
    }

    /// Test shell_list_commits: directly calling the shell path on a standard repo
    /// must return commits with the correct count and message.
    #[tokio::test]
    async fn shell_list_commits_returns_feature_commits() {
        let (tmp, _repo, _oids) = make_repo_with_main_and_feature(&[("shell_commit.txt", "data\n")]);
        let result = shell_list_commits(tmp.path(), None);
        let commit_list = result.expect("shell_list_commits must return Some");
        // Exactly 1 real commit (plus possibly Uncommitted/Untracked sentinels).
        let real_commits: Vec<_> = commit_list
            .commits
            .iter()
            .filter(|c| c.sha != UNCOMMITTED_SHA && c.sha != UNTRACKED_SHA)
            .collect();
        assert_eq!(real_commits.len(), 1, "Expected 1 real commit");
        assert!(
            real_commits[0].message.contains("feature"),
            "commit message must contain 'feature', got: {}",
            real_commits[0].message
        );
        assert_eq!(real_commits[0].sha.len(), 40, "sha must be 40 chars");
    }

    /// Test 16: both "Uncommitted changes" and "Untracked files" entries are present
    /// when the workdir has both modified tracked files and new untracked files,
    /// with "Uncommitted changes" at index 0 and "Untracked files" at index 1.
    #[tokio::test]
    async fn get_commits_both_synthetic_entries_ordering() {
        use std::fs;
        let (tmp, repo, _oids) = make_repo_with_main_and_feature(&[("a.txt", "original\n")]);
        // Modify a tracked file (unstaged)
        fs::write(tmp.path().join("a.txt"), "modified\n").unwrap();
        // Ensure git sees the modification (re-read index from disk)
        let _ = repo.index();
        // Also write an untracked file
        fs::write(tmp.path().join("untracked.txt"), "new\n").unwrap();

        let state = Arc::new(CodeReviewState {
            repo_path: tmp.path().to_path_buf(),
            ..Default::default()
        });
        let (status, json) = do_get(state, "/api/commits").await;
        assert_eq!(status, StatusCode::OK);

        let commits = json["commits"].as_array().expect("expected commits array");
        assert!(
            commits.len() >= 2,
            "Expected at least 2 entries; got: {commits:?}"
        );
        assert_eq!(
            commits[0]["message"].as_str(),
            Some("Uncommitted changes"),
            "Index 0 must be 'Uncommitted changes'"
        );
        assert_eq!(
            commits[1]["message"].as_str(),
            Some("Untracked files"),
            "Index 1 must be 'Untracked files'"
        );
    }
}
