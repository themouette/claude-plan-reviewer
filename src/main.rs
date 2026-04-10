mod hook;
mod install;
mod server;

#[cfg(test)]
mod tests {
    use super::extract_diff;

    #[test]
    fn test_extract_diff_nonexistent_path() {
        let result = extract_diff("/nonexistent/path/xyz");
        assert_eq!(result, "", "Non-existent path should return empty string");
    }

    #[test]
    fn test_extract_diff_non_git_dir() {
        let result = extract_diff(std::env::temp_dir().to_str().unwrap());
        assert_eq!(result, "", "Non-git directory should return empty string");
    }

    #[test]
    fn test_extract_diff_dirty_repo() {
        use std::fs;
        // Create a temp dir with a git repo that has uncommitted changes
        let tmp = tempfile::tempdir().expect("failed to create temp dir");
        let repo = git2::Repository::init(tmp.path()).expect("failed to init repo");

        // Create initial commit so HEAD exists
        {
            let sig = git2::Signature::now("test", "test@test.com").unwrap();
            let tree_id = repo.index().unwrap().write_tree().unwrap();
            let tree = repo.find_tree(tree_id).unwrap();
            repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[])
                .unwrap();
        }

        // Write a new (untracked/modified) file
        let file_path = tmp.path().join("hello.txt");
        fs::write(&file_path, "hello world\n").expect("failed to write file");

        // Stage the file so it shows in diff_tree_to_workdir_with_index
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("hello.txt")).unwrap();
        index.write().unwrap();

        let result = extract_diff(tmp.path().to_str().unwrap());
        assert!(
            !result.is_empty(),
            "Dirty repo should return non-empty diff string"
        );
        // Should contain diff markers
        let has_diff_marker =
            result.contains("diff --git") || result.contains("@@") || result.contains('+');
        assert!(
            has_diff_marker,
            "Diff output should contain diff markers, got: {}",
            result
        );
    }

    #[test]
    fn test_extract_diff_clean_repo() {
        // Create a temp dir with a clean git repo (no uncommitted changes)
        let tmp = tempfile::tempdir().expect("failed to create temp dir");
        let repo = git2::Repository::init(tmp.path()).expect("failed to init repo");

        // Create initial commit
        {
            let sig = git2::Signature::now("test", "test@test.com").unwrap();
            let tree_id = repo.index().unwrap().write_tree().unwrap();
            let tree = repo.find_tree(tree_id).unwrap();
            repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[])
                .unwrap();
        }

        let result = extract_diff(tmp.path().to_str().unwrap());
        assert_eq!(result, "", "Clean repo should return empty diff string");
    }
}

use clap::{Parser, Subcommand};
use hook::{HookInput, HookOutput};
use server::Decision;

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

/// Extract the unified diff of the working tree against HEAD from the given
/// directory.  Returns an empty string if `cwd` is not a git repository,
/// does not exist, or has no uncommitted changes.
fn extract_diff(cwd: &str) -> String {
    let repo = match git2::Repository::open(cwd) {
        Ok(r) => r,
        Err(_) => return String::new(),
    };

    // Force standard a/b prefixes regardless of diff.mnemonicPrefix git config,
    // because @pierre/diffs regex only matches `a/` and `b/` prefixes.
    let mut opts = git2::DiffOptions::new();
    opts.old_prefix("a/").new_prefix("b/");

    // Prefer full working-tree diff vs HEAD (staged + unstaged)
    let diff = if let Ok(head) = repo.head() {
        if let Ok(commit) = head.peel_to_commit() {
            if let Ok(tree) = commit.tree() {
                repo.diff_tree_to_workdir_with_index(Some(&tree), Some(&mut opts))
                    .ok()
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    // Fallback: unstaged changes only (works on empty repos with no HEAD)
    let diff = diff.or_else(|| repo.diff_index_to_workdir(None, Some(&mut opts)).ok());

    let diff = match diff {
        Some(d) => d,
        None => return String::new(),
    };

    let mut output = String::new();
    let _ = diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        if let Ok(s) = std::str::from_utf8(line.content()) {
            match line.origin() {
                '+' | '-' | ' ' => {
                    output.push(line.origin());
                    output.push_str(s);
                }
                _ => {
                    // File headers, hunk headers, binary markers — already formatted by git2
                    output.push_str(s);
                }
            }
        }
        true
    });

    output
}

fn main() {
    // 1. Parse CLI args FIRST — before stdin read (Pitfall 5: install must not hang on stdin)
    let cli = Cli::parse();

    match &cli.command {
        Some(Commands::Install) => {
            // install subcommand: does NOT read stdin
            install::run_install();
        }
        None => {
            // Default: hook review flow — reads stdin JSON
            run_hook_flow(cli.no_browser);
        }
    }
}

fn run_hook_flow(no_browser: bool) {
    // 2. Read all of stdin synchronously (before any async runtime)
    let input_json = match std::io::read_to_string(std::io::stdin()) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to read stdin: {}", e);
            std::process::exit(1);
        }
    };

    // 3. Parse JSON into HookInput
    let hook_input: HookInput = serde_json::from_str(&input_json).unwrap_or_else(|e| {
        eprintln!("Failed to parse hook input: {}", e);
        std::process::exit(1);
    });

    // 4. In debug mode, verify frontend assets exist before starting the server.
    //    rust-embed reads from the filesystem in debug builds, so if ui/dist/ is
    //    missing the server would start but serve nothing.  Catch it early.
    #[cfg(debug_assertions)]
    {
        if server::Assets::get("index.html").is_none() {
            eprintln!("ERROR: Frontend assets not found at ui/dist/index.html");
            eprintln!(
                "Run 'cd ui && npm run build' first, or run 'cargo run' from the project root."
            );
            std::process::exit(1);
        }
    }

    // 5. Get plan markdown
    let plan_md = hook_input.tool_input.plan.unwrap_or_default();
    eprintln!("Plan received ({} bytes)", plan_md.len());

    // 5b. Extract git diff from the hook's cwd
    let diff_content = extract_diff(&hook_input.cwd);
    eprintln!("Diff extracted ({} bytes)", diff_content.len());

    // 6. Start tokio runtime (current_thread for single-user tool)
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    // Pass no_browser as a plain bool (not the old args struct)
    let output = rt.block_on(async_main(no_browser, plan_md, diff_content));

    // 7. Write decision to stdout — THE ONLY stdout write
    serde_json::to_writer(std::io::stdout(), &output).expect("failed to write hook output");
}

async fn async_main(no_browser: bool, plan_md: String, diff_content: String) -> HookOutput {
    // Start server
    let (port, decision_rx) = match server::start_server(plan_md, diff_content).await {
        Ok(v) => v,
        Err(e) => {
            eprintln!("Failed to start server: {}", e);
            return HookOutput::deny(format!("Internal error: {}", e));
        }
    };

    let url = format!("http://127.0.0.1:{}", port);

    // Always print URL to stderr (UI-06)
    eprintln!("Review UI: {}", url);

    // Open browser unless --no-browser (CONF-02)
    if !no_browser && let Err(e) = webbrowser::open(&url) {
        eprintln!("Failed to open browser: {}", e);
        eprintln!("Open manually: {}", url);
    }

    // Race: user decision vs timeout (540 seconds, per D-07)
    const TIMEOUT_SECS: u64 = 540;

    let decision = tokio::select! {
        result = decision_rx => {
            match result {
                Ok(d) => d,
                Err(_) => {
                    eprintln!("Decision channel closed unexpectedly");
                    Decision {
                        behavior: "deny".to_string(),
                        message: Some("Internal error: decision channel closed".to_string()),
                    }
                }
            }
        }
        _ = tokio::time::sleep(std::time::Duration::from_secs(TIMEOUT_SECS)) => {
            eprintln!("Review timed out after {} seconds", TIMEOUT_SECS);
            Decision {
                behavior: "deny".to_string(),
                message: Some("Review timed out \u{2014} plan was not approved".to_string()),
            }
        }
    };

    // Spawn 3-second watchdog for clean exit (HOOK-04)
    tokio::spawn(async {
        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
        std::process::exit(0);
    });

    // Convert Decision to HookOutput
    match decision.behavior.as_str() {
        "allow" => HookOutput::allow(),
        "deny" => HookOutput::deny(
            decision
                .message
                .unwrap_or_else(|| "Denied without message".to_string()),
        ),
        other => {
            eprintln!("Unknown decision behavior: {}", other);
            HookOutput::deny(format!("Unknown behavior: {}", other))
        }
    }
}
