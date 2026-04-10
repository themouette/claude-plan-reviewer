use self_update::cargo_crate_version;

const REPO_OWNER: &str = "themouette";
const REPO_NAME: &str = "claude-plan-reviewer";
const BIN_NAME: &str = "plan-reviewer";

/// Main entry point for the update subcommand.
/// - `check_only`: print current + latest version and changelog URL without downloading
/// - `target_version`: pin to a specific release tag (e.g., "v0.2.0" or "0.2.0")
/// - `skip_confirm`: bypass the confirmation prompt before replacing the binary
pub fn run_update(check_only: bool, target_version: Option<String>, skip_confirm: bool) {
    if check_only {
        check_and_display();
        return;
    }

    perform_update(target_version, skip_confirm);
}

/// Print current version, latest version from GitHub, and changelog URL. No download. (D-10)
fn check_and_display() {
    let current = cargo_crate_version!();
    println!("Current version: {}", current);
    println!("\nChecking for updates...");

    match get_latest_version() {
        Some(latest) if sanitize_version(&latest) != current => {
            println!("New version available: {}", sanitize_version(&latest));
            println!(
                "\nChangelog: https://github.com/{}/{}/releases/tag/v{}",
                REPO_OWNER,
                REPO_NAME,
                sanitize_version(&latest)
            );
            println!("\nRun 'plan-reviewer update' to upgrade");
        }
        Some(_) => println!("You're already running the latest version"),
        None => {
            eprintln!("Unable to check for updates (could not reach GitHub API)");
            std::process::exit(1);
        }
    }
}

/// Download and replace the binary in-place. (D-09, D-11)
fn perform_update(target_version: Option<String>, skip_confirm: bool) {
    let current = cargo_crate_version!();
    println!("Current version: {}", current);

    // Normalize target version: strip 'v' prefix, treat "latest" as None
    let resolved_target = match target_version {
        Some(v) if v == "latest" => None,
        Some(v) => Some(v.trim_start_matches('v').to_string()),
        None => None,
    };

    // If no specific version was requested, fetch latest and check if already current
    let resolved_target = if resolved_target.is_none() {
        match get_latest_version() {
            Some(latest) if sanitize_version(&latest) == current => {
                println!("You're already running the latest version");
                return;
            }
            Some(latest) => {
                println!("New version available: {}", sanitize_version(&latest));
                Some(sanitize_version(&latest))
            }
            None => {
                eprintln!("Unable to fetch latest version from GitHub");
                std::process::exit(1);
            }
        }
    } else {
        resolved_target
    };

    println!("\nDownloading update...");

    let platform = current_platform();

    let mut builder = self_update::backends::github::Update::configure();
    builder
        .repo_owner(REPO_OWNER)
        .repo_name(REPO_NAME)
        .bin_name(BIN_NAME)
        .target(platform)
        .current_version(cargo_crate_version!())
        .show_download_progress(true)
        .no_confirm(skip_confirm);

    if let Some(ref version) = resolved_target {
        builder.target_version_tag(&format!("v{}", version));
    }

    match builder.build().and_then(|u| u.update()) {
        Ok(status) => {
            println!("\nSuccessfully updated to version {}", status.version());
            // Clear version check cache so next run gets a fresh check (D-12)
            clear_update_cache();
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("Permission denied") || msg.contains("EACCES") {
                eprintln!(
                    "Cannot replace binary. Try running with sudo: sudo plan-reviewer update"
                );
                std::process::exit(1);
            }
            eprintln!("Update failed: {}", msg);
            std::process::exit(1);
        }
    }
}

/// Returns the full Rust target triple matching cargo-dist asset names.
/// cargo-dist produces: plan-reviewer-v0.1.0-aarch64-apple-darwin.tar.gz
/// self_update matches `target()` as a substring against asset filenames.
fn current_platform() -> &'static str {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => "aarch64-apple-darwin",
        ("macos", "x86_64") => "x86_64-apple-darwin",
        ("linux", "aarch64") => "aarch64-unknown-linux-musl",
        ("linux", "x86_64") => "x86_64-unknown-linux-musl",
        (os, arch) => {
            eprintln!("Unsupported platform: {}-{}", os, arch);
            std::process::exit(1);
        }
    }
}

/// Fetch the latest release version string from GitHub releases API.
/// Returns None if the API is unreachable or returns no releases.
fn get_latest_version() -> Option<String> {
    let releases = self_update::backends::github::ReleaseList::configure()
        .repo_owner(REPO_OWNER)
        .repo_name(REPO_NAME)
        .build()
        .ok()?
        .fetch()
        .ok()?;

    releases
        .first()
        .map(|r| r.version.trim_start_matches('v').to_string())
}

/// Delete the version check cache file so the next invocation fetches fresh data. (D-12)
fn clear_update_cache() {
    if let Ok(home) = std::env::var("HOME") {
        let cache_path = std::path::PathBuf::from(home)
            .join(".plan-reviewer")
            .join("update-check.json");
        let _ = std::fs::remove_file(cache_path);
    }
}

/// Sanitize a version string from the network before displaying it in the terminal.
/// Prevents terminal escape injection from malicious release tag names. (T-04-07)
fn sanitize_version(version: &str) -> String {
    version
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == '+')
        .collect()
}
