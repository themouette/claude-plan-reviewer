---
phase: 03-distribution
reviewed: 2026-04-10T07:53:47Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - Cargo.toml
  - .github/build-setup.yml
  - .github/workflows/release.yml
  - install.sh
  - src/main.rs
  - src/install.rs
findings:
  critical: 4
  warning: 5
  info: 2
  total: 11
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-10T07:53:47Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

This phase adds the full distribution pipeline: release CI, a hand-written install script, the `plan-reviewer install` subcommand, and the hook flow in `main.rs`. The distribution architecture is sound — cargo-dist, musl static binaries, rust-embed for zero-runtime installs. However, four issues will cause hard failures in production: the GitHub Actions action versions do not exist, the `build-setup.yml` path in `Cargo.toml` is wrong, the install script contains an unreplaced `OWNER` placeholder, and a race condition in the watchdog/stdout write sequence can silently truncate the hook response.

---

## Critical Issues

### CR-01: GitHub Actions versions reference non-existent tags

**File:** `.github/workflows/release.yml:59,69,119,143,178,200,209,227,249,257,260,277`

**Issue:** The workflow uses `actions/checkout@v6`, `actions/upload-artifact@v6`, and `actions/download-artifact@v7`. As of mid-2025 the latest stable versions are `checkout@v4`, `upload-artifact@v4`, and `download-artifact@v4`. Versions v6 and v7 do not exist. GitHub Actions will fail immediately at the `uses:` resolution step with "Unable to resolve action `actions/checkout@v6`". Every job in the workflow will fail, meaning no release can ever be published.

**Fix:** Replace all action version pins with the current stable versions:

```yaml
# checkout — replace every occurrence
- uses: actions/checkout@v4

# upload-artifact — replace every occurrence
- uses: actions/upload-artifact@v4

# download-artifact — replace every occurrence
- uses: actions/download-artifact@v4
```

Run `grep -n "uses: actions/" .github/workflows/release.yml` to find all occurrences. There are approximately 12 references to update.

---

### CR-02: `github-build-setup` path points outside the repository

**File:** `Cargo.toml:40`

**Issue:** `github-build-setup = "../build-setup.yml"` is interpreted relative to the workspace root (the directory containing `Cargo.toml`). This resolves to one directory *above* the repository root, not to `.github/build-setup.yml`. When cargo-dist processes this configuration during `dist plan`, it will either fail to find the file or silently ignore the custom build steps, meaning the frontend assets will never be built before the Rust compile step. The result is a binary with no embedded UI.

**Fix:**

```toml
# Cargo.toml, line 40
github-build-setup = ".github/build-setup.yml"
```

Verify with: `ls .github/build-setup.yml` (the file exists at this path in the repo).

---

### CR-03: Install script uses unreplaced `OWNER` placeholder

**File:** `install.sh:9`

**Issue:** `REPO="OWNER/claude-plan-reviewer"` is a placeholder that was never substituted with the real GitHub username/org. Any user running `curl | sh` will try to fetch from `https://api.github.com/repos/OWNER/claude-plan-reviewer/releases/latest` and `https://github.com/OWNER/claude-plan-reviewer/releases/...`, both of which return 404. The script will exit at line 44 with "Could not determine latest release tag". The repository is already named `themouette/claude-plan-reviewer` in `Cargo.toml` line 5.

**Fix:**

```sh
# install.sh, line 9
REPO="themouette/claude-plan-reviewer"
```

---

### CR-04: Watchdog race condition can truncate stdout before hook response is written

**File:** `src/main.rs:267-271`

**Issue:** A watchdog is spawned that calls `std::process::exit(0)` after 3 seconds. The `block_on(async_main(...))` call at line 213 returns the `HookOutput` struct *before* `serde_json::to_writer(stdout(), &output)` at line 216 writes it. However, `tokio::spawn` inside the runtime does not stop when `block_on` returns — the spawned task continues running on the same `current_thread` runtime. The sequence is:

1. `block_on` completes, task is spawned but not yet polled
2. `run_hook_flow` calls `serde_json::to_writer` — the write must complete within 3 seconds
3. If the write call is slow (buffered I/O flush, process scheduler delay), the watchdog fires first and calls `exit(0)` with nothing or partial JSON on stdout

Claude Code reads the hook response from stdout; a truncated or empty stdout causes it to misinterpret the response. More practically, the watchdog fires *unconditionally* — there is no cancellation path even after a successful write.

**Fix:** Track write success and either cancel the watchdog or simply remove it. If graceful server shutdown is needed after the response is written, use a `CancellationToken` rather than `process::exit` inside a spawned task:

```rust
// In run_hook_flow, write FIRST, then let the runtime drop:
serde_json::to_writer(std::io::stdout(), &output).expect("failed to write hook output");
// No watchdog needed — runtime drops when block_on returns and the
// current_thread executor completes its queue.
```

If the server must be kept alive briefly to serve the final HTTP response to the browser, use a proper shutdown signal (e.g. `tokio::sync::oneshot`) and drive it to completion before returning from `block_on`, rather than using a fire-and-forget `process::exit`.

---

## Warnings

### WR-01: Archive format mismatch in install script

**File:** `install.sh:52`

**Issue:** `ARCHIVE_NAME="${BINARY}-${LATEST_TAG}-${TARGET}.tar.xz"` hardcodes `.tar.xz` as the archive extension. The cargo-dist generated shell installer (the one cargo-dist generates and uploads as `plan-reviewer-installer.sh`) uses a different naming convention and adapts the extension per platform. If cargo-dist produces `.tar.gz` archives instead (possible depending on its configuration), the download at line 59 will 404. The cargo-dist-generated installer is the safer alternative to this hand-written script.

**Fix:** Either (a) use the cargo-dist generated installer script directly and remove `install.sh`, or (b) verify the exact archive name format cargo-dist produces for this project (check a test release artifact) and update the pattern accordingly.

---

### WR-02: `$TMPDIR` variable shadows macOS system variable

**File:** `install.sh:55`

**Issue:** `TMPDIR="$(mktemp -d)"` overwrites the `$TMPDIR` shell variable, which is set by macOS to `/var/folders/...` and used by system tools. If anything later in the script (or in a subprocess) relies on `$TMPDIR` being the system temp directory, it will receive the mktemp output instead. POSIX reserves `TMPDIR` as a well-known variable.

**Fix:** Use a different variable name:

```sh
TMP_WORKDIR="$(mktemp -d)"
trap 'rm -rf "${TMP_WORKDIR}"' EXIT
# ... use ${TMP_WORKDIR} throughout
```

---

### WR-03: Non-atomic write to `settings.json` can corrupt the file on crash

**File:** `src/install.rs:125`

**Issue:** `std::fs::write(&settings_path, output)` writes the file in-place. If the process is killed mid-write (power loss, `SIGKILL`, disk full), `settings.json` is left in a partially-written state. Claude Code reading a truncated JSON file will likely malfunction or lose all existing settings.

**Fix:** Write to a sibling temp file then rename atomically:

```rust
let tmp_path = settings_path.with_extension("json.tmp");
if let Err(e) = std::fs::write(&tmp_path, &output) {
    eprintln!("plan-reviewer install: cannot write temp file: {}", e);
    std::process::exit(1);
}
if let Err(e) = std::fs::rename(&tmp_path, &settings_path) {
    eprintln!("plan-reviewer install: cannot rename temp file: {}", e);
    let _ = std::fs::remove_file(&tmp_path);
    std::process::exit(1);
}
```

---

### WR-04: Panic if `PermissionRequest` array was already a non-array value

**File:** `src/install.rs:91`

**Issue:** After `or_insert_with(|| serde_json::json!([]))`, if `PermissionRequest` already existed as a non-array value (e.g. `null`, an object, or a string from a malformed settings file), `or_insert_with` is a no-op and the existing non-array value is left in place. The subsequent call to `.as_array_mut().unwrap()` on line 91 will `unwrap` a `None` and panic, crashing the installer without a user-friendly message.

**Fix:** Check and handle the case where `PermissionRequest` is not an array after insertion:

```rust
let pr = root["hooks"]["PermissionRequest"].as_array_mut();
let arr = match pr {
    Some(a) => a,
    None => {
        eprintln!(
            "plan-reviewer install: hooks.PermissionRequest is not an array in {}; \
             cannot safely modify it",
            settings_path.display()
        );
        std::process::exit(1);
    }
};
// use arr.iter().any(...) and arr.push(...) below
```

---

### WR-05: `comrak` version `0.52` is likely a typo

**File:** `Cargo.toml:19`

**Issue:** `comrak = { version = "0.52", ... }`. The latest published version of comrak on crates.io as of mid-2025 is in the `0.3x` range. `0.52` does not exist; `cargo build` will fail with "no matching version found for `comrak ^0.52`". This is almost certainly a typo for `"0.5.2"` (semver `^0.5.2`) or an outdated version specifier.

**Fix:** Check the current version on crates.io and pin accordingly:

```toml
comrak = { version = "0.37", default-features = false }
```

(Replace `0.37` with the actual latest version from `cargo search comrak`.)

---

## Info

### IN-01: No checksum verification in install script

**File:** `install.sh:59-62`

**Issue:** The download is not verified against a checksum. cargo-dist generates `.sha256` files alongside each release archive. Without checksum verification, a MITM or CDN compromise between GitHub and the user could deliver a tampered binary. The `curl -fsSL` flags abort on HTTP errors but do not authenticate content.

**Fix:** Download the corresponding `.sha256` file and verify before extraction:

```sh
curl -fsSL "${DOWNLOAD_URL}.sha256" -o "${TMP_WORKDIR}/${ARCHIVE_NAME}.sha256"
(cd "${TMP_WORKDIR}" && sha256sum -c "${ARCHIVE_NAME}.sha256")
```

Note: macOS uses `shasum -a 256 -c` instead of `sha256sum`. A cross-platform check is needed:

```sh
if command -v sha256sum > /dev/null 2>&1; then
  (cd "${TMP_WORKDIR}" && sha256sum -c "${ARCHIVE_NAME}.sha256")
elif command -v shasum > /dev/null 2>&1; then
  (cd "${TMP_WORKDIR}" && shasum -a 256 -c "${ARCHIVE_NAME}.sha256")
fi
```

---

### IN-02: Silent discard of non-UTF-8 diff content

**File:** `src/main.rs:136`

**Issue:** `if let Ok(s) = std::str::from_utf8(line.content())` silently skips any diff line that contains non-UTF-8 bytes (e.g. binary file patches, filenames with non-ASCII characters in certain encodings). The diff output will appear incomplete without any indication to the user that content was dropped.

**Fix:** Use `String::from_utf8_lossy` to preserve content with replacement characters, or log a warning when lines are dropped:

```rust
let s = String::from_utf8_lossy(line.content());
match line.origin() {
    '+' | '-' | ' ' => {
        output.push(line.origin());
        output.push_str(&s);
    }
    _ => {
        output.push_str(&s);
    }
}
```

---

_Reviewed: 2026-04-10T07:53:47Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
