use std::io::{Read, Write};
use std::net::TcpListener;
use std::process::Command;
use std::sync::{Arc, Mutex};

use assert_cmd::prelude::*;

const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Marker bytes placed inside the fake binary served by the mock update archive.
/// The replacement test asserts the copied binary's content changes to this.
const FAKE_BIN_MARKER: &[u8] = b"FAKE-UPDATED-BINARY-FROM-MOCK\n";

/// A release tag strictly newer than the crate's current version. The tests
/// must NEVER hardcode a version (e.g. "v0.9.0"): after a release bumps the
/// crate version, a hardcoded tag becomes the CURRENT version and the update
/// flow correctly answers "already up to date", failing the test. Deriving
/// the newer version at test time keeps the suite valid across every future
/// release bump.
fn newer_tag() -> String {
    let mut parts: Vec<u64> = CURRENT_VERSION
        .split('.')
        .map(|p| p.split('-').next().unwrap_or(p).parse().unwrap_or(0))
        .collect();
    while parts.len() < 3 {
        parts.push(0);
    }
    let last = parts.len() - 1;
    parts[last] += 1;
    format!(
        "v{}",
        parts
            .iter()
            .map(|p| p.to_string())
            .collect::<Vec<_>>()
            .join(".")
    )
}

// ---------------------------------------------------------------------------
// Mock GitHub releases API
// ---------------------------------------------------------------------------

/// Mirror of `src/update.rs::current_platform()` — integration tests cannot
/// reach into the binary, so the mapping is duplicated here. The mock names
/// release assets exactly like cargo-dist does so the `target()` substring
/// match in the real update flow finds them.
fn target_triple() -> &'static str {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => "aarch64-apple-darwin",
        ("macos", "x86_64") => "x86_64-apple-darwin",
        ("linux", "aarch64") => "aarch64-unknown-linux-musl",
        ("linux", "x86_64") => "x86_64-unknown-linux-musl",
        (os, arch) => panic!("Unsupported test platform: {}-{}", os, arch),
    }
}

/// Minimal synchronous mock of the GitHub releases API.
///
/// Routes (checked in order — single-release endpoints before the generic
/// listing prefix):
/// - `GET .../releases/tags/{tag}` -> single release OBJECT (GitHub shape)
/// - `GET .../releases/latest`     -> first release OBJECT
/// - `GET .../releases`            -> release list ARRAY
/// - `GET /download/...`           -> the configured tar.gz bytes
/// - anything else                 -> 404
///
/// self_update 1.3 pins the builder to the resolved tag (release_tag), so the
/// update flow fetches the single-release-by-tag endpoint, which must answer
/// with a bare release object — not the array. Pagination is a non-issue:
/// self_update follows `Link` headers and a plain response is a single page.
struct MockGitHub {
    port: u16,
    requests: Arc<Mutex<Vec<String>>>,
}

impl MockGitHub {
    /// Bind a listener, then serve the given release tags (server-side order:
    /// first entry is "latest") and the given asset archive. Asset download
    /// URLs are generated from the actually-bound port.
    fn spawn(tags: Vec<String>, archive: Arc<Vec<u8>>) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind mock API");
        let port = listener.local_addr().unwrap().port();
        let base = format!("http://127.0.0.1:{}", port);

        let releases: Vec<serde_json::Value> =
            tags.iter().map(|t| release_json(&base, t)).collect();
        let releases = serde_json::Value::Array(releases);
        let releases_body = serde_json::to_string(&releases).unwrap();

        let requests = Arc::new(Mutex::new(Vec::new()));
        let req_log = Arc::clone(&requests);

        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut stream) = stream else { break };
                let request = read_request_head(&mut stream);
                req_log.lock().unwrap().push(request.clone());

                let path = request.split(' ').nth(1).unwrap_or("");

                if path.contains("/releases/tags/") {
                    let tag = path.rsplit("/tags/").next().unwrap_or("");
                    let release = releases
                        .as_array()
                        .and_then(|rs| rs.iter().find(|r| r["tag_name"].as_str() == Some(tag)));
                    match release {
                        Some(release) => respond(
                            &mut stream,
                            200,
                            "application/json",
                            serde_json::to_string(release).unwrap().as_bytes(),
                        ),
                        None => respond(&mut stream, 404, "text/plain", b"release not found"),
                    }
                } else if path.ends_with("/releases/latest") {
                    match releases.as_array().and_then(|rs| rs.first()) {
                        Some(release) => respond(
                            &mut stream,
                            200,
                            "application/json",
                            serde_json::to_string(release).unwrap().as_bytes(),
                        ),
                        None => respond(&mut stream, 404, "text/plain", b"no releases"),
                    }
                } else if path.contains("/repos/themouette/claude-plan-reviewer/releases") {
                    respond(
                        &mut stream,
                        200,
                        "application/json",
                        releases_body.as_bytes(),
                    );
                } else if path.starts_with("/download/") {
                    respond(&mut stream, 200, "application/octet-stream", &archive);
                } else {
                    respond(&mut stream, 404, "text/plain", b"not found");
                }
            }
        });

        MockGitHub { port, requests }
    }

    fn base_url(&self) -> String {
        format!("http://127.0.0.1:{}", self.port)
    }

    /// Request lines received so far (e.g. "GET /repos/... HTTP/1.1").
    fn request_lines(&self) -> Vec<String> {
        self.requests.lock().unwrap().clone()
    }
}

/// Read from the stream until the end of the HTTP request head (\r\n\r\n).
/// All requests in this flow are GETs with no body.
fn read_request_head(stream: &mut std::net::TcpStream) -> String {
    let mut buf = Vec::new();
    let mut chunk = [0u8; 4096];
    loop {
        let n = stream.read(&mut chunk).unwrap_or(0);
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&chunk[..n]);
        if buf.ends_with(b"\r\n\r\n") {
            break;
        }
    }
    String::from_utf8_lossy(&buf).into_owned()
}

/// Write a minimal HTTP/1.1 response with `Connection: close`.
fn respond(stream: &mut std::net::TcpStream, code: u16, content_type: &str, body: &[u8]) {
    let reason = match code {
        200 => "OK",
        404 => "Not Found",
        _ => "Error",
    };
    let head = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        code,
        reason,
        content_type,
        body.len()
    );
    let _ = stream.write_all(head.as_bytes());
    let _ = stream.write_all(body);
    let _ = stream.flush();
}

/// Build one GitHub-style release object. The first release in the list is
/// what the update flow treats as "latest" (GitHub's API returns releases
/// newest-first — see `Releases::latest()` upstream, which takes the first
/// element).
fn release_json(base_url: &str, tag: &str) -> serde_json::Value {
    let triple = target_triple();
    serde_json::json!({
        "tag_name": tag,
        "name": tag,
        "created_at": "2026-09-09T00:00:00Z",
        "assets": [{
            "name": format!("plan-reviewer-{}-{}.tar.gz", tag, triple),
            "url": format!("{}/download/{}-{}", base_url, tag, triple),
        }],
    })
}

/// Build the tar.gz served as a release asset: a single binary entry at
/// `claude-plan-reviewer-<triple>/plan-reviewer` (mirroring cargo-dist's
/// archive layout) containing FAKE_BIN_MARKER instead of a real binary.
fn make_release_archive() -> Vec<u8> {
    let path_in_archive = format!("claude-plan-reviewer-{}/plan-reviewer", target_triple());

    let gz = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
    let mut tar = tar::Builder::new(gz);

    let mut header = tar::Header::new_gnu();
    header.set_size(FAKE_BIN_MARKER.len() as u64);
    header.set_mode(0o755);
    header.set_cksum();
    tar.append_data(&mut header, &path_in_archive, FAKE_BIN_MARKER)
        .expect("append fake binary to archive");

    tar.into_inner()
        .expect("finish tar")
        .finish()
        .expect("finish gzip")
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Copy the compiled `plan-reviewer` binary into an isolated tempdir and
/// return the copy's path. The update-replacement tests MUST run the copy,
/// not the original: `perform_update` replaces the running executable, and
/// running `target/debug/plan-reviewer` directly would destroy the build
/// artifact.
fn copy_binary_to(home: &tempfile::TempDir) -> std::path::PathBuf {
    let dest = home.path().join("plan-reviewer");
    std::fs::copy(assert_cmd::cargo::cargo_bin("plan-reviewer"), &dest).expect("copy test binary");
    dest
}

fn run_check(api_base: &str) -> std::process::Output {
    let home = tempfile::tempdir().unwrap();
    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .args(["update", "--check"])
        .env("HOME", home.path())
        .env("PLAN_REVIEWER_GITHUB_API_BASE", api_base)
        .output()
        .expect("run plan-reviewer update --check")
}

fn stdout_of(output: &std::process::Output) -> String {
    String::from_utf8_lossy(&output.stdout).into_owned()
}

fn stderr_of(output: &std::process::Output) -> String {
    String::from_utf8_lossy(&output.stderr).into_owned()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/// `update --check` against a mock serving a newer release reports the new
/// version and the changelog URL. Covers `get_latest_version` +
/// `check_and_display` over the wire.
#[test]
fn update_check_reports_new_version() {
    let newer = newer_tag();
    let mock = MockGitHub::spawn(vec![newer.clone()], Arc::new(Vec::new()));

    let output = run_check(&mock.base_url());

    assert!(output.status.success(), "stderr: {}", stderr_of(&output));
    let stdout = stdout_of(&output);
    assert!(
        stdout.contains(&format!("Current version: {}", CURRENT_VERSION)),
        "stdout should report the current version, got: {}",
        stdout
    );
    assert!(
        stdout.contains(&format!(
            "New version available: {}",
            newer.trim_start_matches('v')
        )),
        "stdout should report the new version, got: {}",
        stdout
    );
    assert!(
        stdout.contains(&format!("releases/tag/{}", newer)),
        "stdout should include the changelog URL, got: {}",
        stdout
    );

    // The flow must have hit the releases listing endpoint (and nothing else
    // before download — --check never fetches assets).
    let requests = mock.request_lines();
    assert!(
        requests
            .iter()
            .any(|r| r.contains("/repos/themouette/claude-plan-reviewer/releases")),
        "expected a releases-list request, got: {:?}",
        requests
    );
    assert!(
        requests.iter().all(|r| !r.contains("/download/")),
        "--check must not download any asset, got: {:?}",
        requests
    );
}

/// `update --check` when the mock serves only the current version reports
/// "already running the latest version" and exits 0.
#[test]
fn update_check_already_latest() {
    let current_tag = format!("v{}", CURRENT_VERSION);
    let mock = MockGitHub::spawn(vec![current_tag], Arc::new(Vec::new()));

    let output = run_check(&mock.base_url());

    assert!(output.status.success(), "stderr: {}", stderr_of(&output));
    assert!(
        stdout_of(&output).contains("You're already running the latest version"),
        "stdout should report up-to-date, got: {}",
        stdout_of(&output)
    );
}

/// `update --check` against a broken/unknown endpoint exits 1 with the
/// friendly "Unable to check for updates" error (raw HTTP errors must not
/// leak to the user).
#[test]
fn update_check_unreachable_reports_friendly_error() {
    let mock = MockGitHub::spawn(vec![], Arc::new(Vec::new()));
    // Point the binary at a nonexistent owner: every releases request misses
    // the mock's routes and yields 404s (GitHub-equivalent of repo not found).
    let bad_base = format!("{}/nonexistent-owner", mock.base_url());

    let output = run_check(&bad_base);

    assert_eq!(
        output.status.code(),
        Some(1),
        "unreachable API must exit 1, got success: {}",
        stdout_of(&output)
    );
    assert!(
        stderr_of(&output).contains("Unable to check for updates"),
        "stderr should carry the friendly error, got: {}",
        stderr_of(&output)
    );
}

/// Multi-release list: the update flow treats the FIRST entry as latest
/// (GitHub's newest-first contract, per `Releases::latest()` upstream).
/// Guards the ordering assumption documented in `get_latest_version`.
#[test]
fn update_check_takes_first_release_from_list() {
    let newer = newer_tag();
    let mock = MockGitHub::spawn(
        vec![newer.clone(), format!("v{}", CURRENT_VERSION)],
        Arc::new(Vec::new()),
    );

    let output = run_check(&mock.base_url());

    assert!(output.status.success(), "stderr: {}", stderr_of(&output));
    assert!(
        stdout_of(&output).contains(&format!(
            "New version available: {}",
            newer.trim_start_matches('v')
        )),
        "the first (newest) release must be reported as latest, got: {}",
        stdout_of(&output)
    );
}

/// The critical end-to-end: `update --yes` downloads the asset from the mock,
/// extracts `claude-plan-reviewer-<triple>/plan-reviewer` from the archive,
/// and replaces the RUNNING executable (a tempdir copy — never the build
/// artifact). After success the copy must contain the fake marker binary.
#[test]
fn update_replaces_binary() {
    let home = tempfile::tempdir().unwrap();
    let copy = copy_binary_to(&home);
    let before = std::fs::read(&copy).expect("read binary copy before update");
    assert!(
        !before
            .windows(FAKE_BIN_MARKER.len())
            .any(|w| w == FAKE_BIN_MARKER),
        "sanity: the real binary must not already contain the fake marker"
    );

    let newer = newer_tag();
    let mock = MockGitHub::spawn(vec![newer.clone()], Arc::new(make_release_archive()));

    let output = Command::new(&copy)
        .args(["update", "--yes"])
        .env("HOME", home.path())
        .env("PLAN_REVIEWER_GITHUB_API_BASE", mock.base_url())
        .output()
        .expect("run copied plan-reviewer update --yes");

    assert!(
        output.status.success(),
        "update must succeed, stdout: {} stderr: {}",
        stdout_of(&output),
        stderr_of(&output)
    );
    assert!(
        stdout_of(&output).contains(&format!(
            "Successfully updated to version {}",
            newer.trim_start_matches('v')
        )),
        "stdout should report the successful replacement, got: {}",
        stdout_of(&output)
    );

    let after = std::fs::read(&copy).expect("read binary copy after update");
    assert!(
        after
            .windows(FAKE_BIN_MARKER.len())
            .any(|w| w == FAKE_BIN_MARKER),
        "the running binary copy must have been replaced by the fake asset"
    );

    // The wire sequence: releases list first, then the asset download.
    let requests = mock.request_lines();
    assert!(
        requests
            .iter()
            .any(|r| r.contains("/repos/themouette/claude-plan-reviewer/releases")),
        "expected a releases-list request, got: {:?}",
        requests
    );
    assert!(
        requests.iter().any(|r| r.contains("/download/")),
        "expected an asset download request, got: {:?}",
        requests
    );
}

/// Pinned-version update: `--version <newer>` skips the latest-version fetch
/// and goes straight to the tagged release (exercises the `release_tag` path
/// end-to-end, including the v-prefix normalization).
#[test]
fn update_pinned_version_tag_replaces_binary() {
    let home = tempfile::tempdir().unwrap();
    let copy = copy_binary_to(&home);
    let newer = newer_tag();

    let mock = MockGitHub::spawn(
        vec![format!("v{}", CURRENT_VERSION), newer.clone()],
        Arc::new(make_release_archive()),
    );

    let output = Command::new(&copy)
        .args(["update", "--yes", "--version", &newer])
        .env("HOME", home.path())
        .env("PLAN_REVIEWER_GITHUB_API_BASE", mock.base_url())
        .output()
        .expect("run copied plan-reviewer update --version {newer} --yes");

    assert!(
        output.status.success(),
        "pinned update must succeed, stdout: {} stderr: {}",
        stdout_of(&output),
        stderr_of(&output)
    );
    let after = std::fs::read(&copy).expect("read binary copy after update");
    assert!(
        after
            .windows(FAKE_BIN_MARKER.len())
            .any(|w| w == FAKE_BIN_MARKER),
        "the pinned update must also replace the binary copy"
    );

    // With an explicit target version the flow must NOT probe for the latest
    // (no releases-LIST request on the wire) — it goes straight to the
    // single-release-by-tag endpoint and then downloads. Note the tags path
    // contains the /releases prefix, so match on the exact list endpoint.
    let requests = mock.request_lines();
    assert!(
        requests.iter().all(|r| {
            !r.split(' ')
                .nth(1)
                .unwrap_or("")
                .ends_with("/repos/themouette/claude-plan-reviewer/releases")
        }),
        "pinned update must not fetch the releases list, got: {:?}",
        requests
    );
    assert!(
        requests
            .iter()
            .any(|r| r.contains(&format!("/releases/tags/{}", newer))),
        "pinned update must fetch the single-release-by-tag endpoint, got: {:?}",
        requests
    );
}
