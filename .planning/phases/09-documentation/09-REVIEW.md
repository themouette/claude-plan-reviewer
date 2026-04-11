---
phase: 09-documentation
reviewed: 2026-04-11T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - README.md
  - install.sh
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-04-11
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Both files were reviewed at standard depth. `README.md` documents the CLI accurately — subcommands, flags, and timeout value all match the source. `install.sh` is functionally sound for the happy path but has three issues worth addressing: a variable name collision that shadows a system environment variable, an undetected curl failure in the tag-resolution pipeline, and a discrepancy between the PATH fix instructions printed by the installer versus what the README documents.

---

## Warnings

### WR-01: `TMPDIR` variable shadows system environment variable

**File:** `install.sh:55`
**Issue:** The script assigns `TMPDIR="$(mktemp -d)"` using the name `TMPDIR`, which is a well-known POSIX/macOS environment variable (`/tmp` or a custom temp directory path). Overwriting it in the script's environment means any subprocess launched after line 55 that consults `$TMPDIR` will receive the script's working directory instead of the real system temp directory. On macOS, `/usr/bin/tar` and other tools do consult `TMPDIR`. This will not break typical installs today, but it is fragile and violates the principle of least surprise.

**Fix:** Rename to a script-local name such as `TMP_DIR` or `WORK_DIR`:
```sh
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT
# ...
curl -fsSL "${DOWNLOAD_URL}" -o "${TMP_DIR}/${ARCHIVE_NAME}"
tar -xzf "${TMP_DIR}/${ARCHIVE_NAME}" -C "${TMP_DIR}"
cp "${TMP_DIR}/${BINARY}-${LATEST_TAG}-${TARGET}/${BINARY}" "${INSTALL_DIR}/${BINARY}"
```

---

### WR-02: Curl failure in tag-resolution pipeline is not detected

**File:** `install.sh:40-42`
**Issue:** `LATEST_TAG` is resolved via a pipeline:
```sh
LATEST_TAG="$(curl -fsSL "..." | grep '"tag_name"' | sed '...')"
```
POSIX `sh` (and `set -e`) only propagates the exit code of the **last** command in a pipeline (`sed`). If `curl` fails silently (e.g., network timeout, 404, rate-limit response) but produces some output, `grep` or `sed` may also exit non-zero — but if the GitHub API returns valid JSON without a `tag_name` field, `grep` exits 1 which with `set -e` will abort the script before the empty-check on line 44. Conversely, if `grep` matches something unexpected (e.g., an error body containing the literal string `"tag_name"`), the empty-check on line 44 will not catch it and an invalid tag will be used in the download URL, causing a confusing 404 on the archive download.

**Fix:** Capture curl output first, then parse:
```sh
GITHUB_RESPONSE="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")"
LATEST_TAG="$(printf '%s\n' "${GITHUB_RESPONSE}" | grep '"tag_name"' \
  | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')"

if [ -z "${LATEST_TAG}" ]; then
  echo "Could not determine latest release tag from GitHub API." >&2
  exit 1
fi
```
This ensures curl exit code is checked independently by `set -e` before the grep/sed stage runs.

---

### WR-03: PATH fix instructions differ between install.sh and README.md

**File:** `install.sh:80` / `README.md:25-27`
**Issue:** The installer prints:
```
bash/zsh:   echo 'export PATH="${HOME}/.local/bin:${PATH}"' >> ~/.profile
```
But the README documents:
```
bash: echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
zsh:  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```
The two sources give contradictory instructions to users. `~/.profile` is sourced only at login-shell startup and is not typically sourced by interactive non-login shells (e.g., most terminal emulators on Ubuntu/Debian running bash or zsh). Users who follow the README instructions will get the correct result; users who follow the installer output will find that `plan-reviewer` is unavailable in new interactive terminals until they restart a login shell.

Either align the installer output to match the README (shell-specific `~/.bashrc` / `~/.zshrc` with a `source` hint), or update the README to match the installer's `~/.profile` recommendation and remove the `source` hint — whichever is the intended user-facing guidance. The README is the higher-authority document here since it's what users read before running the installer.

**Fix (align installer to README):**
```sh
# --- PATH check ---
case ":${PATH}:" in
  *":${INSTALL_DIR}:"*)
    ;;
  *)
    echo ""
    echo "WARNING: ${INSTALL_DIR} is not on your PATH."
    echo "To add it, run the command for your shell:"
    echo ""
    echo "  bash:  echo 'export PATH=\"\${HOME}/.local/bin:\${PATH}\"' >> ~/.bashrc && source ~/.bashrc"
    echo "  zsh:   echo 'export PATH=\"\${HOME}/.local/bin:\${PATH}\"' >> ~/.zshrc  && source ~/.zshrc"
    echo "  fish:  fish_add_path ~/.local/bin"
    echo ""
    ;;
esac
```

---

## Info

### IN-01: Archive directory layout assumption is undocumented and fragile

**File:** `install.sh:66`
**Issue:** The `cp` command assumes the archive extracts to a subdirectory named `${BINARY}-${LATEST_TAG}-${TARGET}/`:
```sh
cp "${TMPDIR}/${BINARY}-${LATEST_TAG}-${TARGET}/${BINARY}" "${INSTALL_DIR}/${BINARY}"
```
This is a convention specific to cargo-dist's archive layout. If a future cargo-dist version changes the layout (e.g., a flat archive or a different subdirectory name), the script will fail with a cryptic "No such file or directory" message. A brief comment would help future maintainers understand the dependency.

**Fix:** Add a comment before line 66 to document the expected layout:
```sh
# cargo-dist archives extract to: ${BINARY}-${LATEST_TAG}-${TARGET}/${BINARY}
# See: https://axodotdev.github.io/cargo-dist/book/artifacts.html
cp "${TMP_DIR}/${BINARY}-${LATEST_TAG}-${TARGET}/${BINARY}" "${INSTALL_DIR}/${BINARY}"
```

---

_Reviewed: 2026-04-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
