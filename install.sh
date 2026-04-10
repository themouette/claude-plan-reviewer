#!/bin/sh
# install.sh — plan-reviewer installer
# Installs the plan-reviewer binary to ~/.local/bin and wires the Claude Code hook.
# Usage: curl -fsSL https://raw.githubusercontent.com/themouette/claude-plan-reviewer/main/install.sh | sh
#
# Repository: https://github.com/themouette/claude-plan-reviewer
set -eu

REPO="themouette/claude-plan-reviewer"
INSTALL_DIR="${HOME}/.local/bin"
BINARY="plan-reviewer"

# --- Platform detection ---
OS="$(uname -s)"
ARCH="$(uname -m)"

case "${OS}" in
  Darwin)
    case "${ARCH}" in
      arm64)  TARGET="aarch64-apple-darwin" ;;
      x86_64) TARGET="x86_64-apple-darwin" ;;
      *)      echo "Unsupported macOS architecture: ${ARCH}" >&2; exit 1 ;;
    esac
    ;;
  Linux)
    case "${ARCH}" in
      x86_64)          TARGET="x86_64-unknown-linux-musl" ;;
      aarch64|arm64)   TARGET="aarch64-unknown-linux-musl" ;;
      *)               echo "Unsupported Linux architecture: ${ARCH}" >&2; exit 1 ;;
    esac
    ;;
  *)
    echo "Unsupported operating system: ${OS}" >&2
    exit 1
    ;;
esac

# --- Resolve latest release tag ---
echo "Detecting latest release..."
LATEST_TAG="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep '"tag_name"' \
  | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')"

if [ -z "${LATEST_TAG}" ]; then
  echo "Could not determine latest release tag from GitHub API." >&2
  exit 1
fi

echo "Installing ${BINARY} ${LATEST_TAG} for ${TARGET}..."

# --- Download and extract ---
ARCHIVE_NAME="${BINARY}-${LATEST_TAG}-${TARGET}.tar.gz"
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/${ARCHIVE_NAME}"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "${TMPDIR}"' EXIT

echo "Downloading ${DOWNLOAD_URL}..."
curl -fsSL "${DOWNLOAD_URL}" -o "${TMPDIR}/${ARCHIVE_NAME}"

echo "Extracting..."
tar -xzf "${TMPDIR}/${ARCHIVE_NAME}" -C "${TMPDIR}"

# --- Install binary ---
mkdir -p "${INSTALL_DIR}"
cp "${TMPDIR}/${BINARY}-${LATEST_TAG}-${TARGET}/${BINARY}" "${INSTALL_DIR}/${BINARY}"
chmod +x "${INSTALL_DIR}/${BINARY}"
echo "Installed ${BINARY} to ${INSTALL_DIR}/${BINARY}"

# --- PATH check (DIST-03) ---
case ":${PATH}:" in
  *":${INSTALL_DIR}:"*)
    # Already on PATH — no action needed
    ;;
  *)
    echo ""
    echo "WARNING: ${INSTALL_DIR} is not on your PATH."
    echo "To add it, run one of the following depending on your shell:"
    echo ""
    echo "  bash/zsh:   echo 'export PATH=\"\${HOME}/.local/bin:\${PATH}\"' >> ~/.profile"
    echo "  fish:       fish_add_path ~/.local/bin"
    echo ""
    echo "Then restart your shell or run: export PATH=\"\${HOME}/.local/bin:\${PATH}\""
    echo ""
    ;;
esac

# --- Wire Claude Code hook (D-09) ---
echo "Wiring Claude Code ExitPlanMode hook..."
"${INSTALL_DIR}/${BINARY}" install claude

echo ""
echo "plan-reviewer ${LATEST_TAG} installed successfully."
echo "Run '${BINARY} --help' to get started."
