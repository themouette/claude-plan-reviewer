# plan-reviewer

Intercepts your AI agent's plan approval flow and opens a local browser UI to review, annotate, approve, or deny before execution.

[![GitHub release](https://img.shields.io/github/v/release/themouette/claude-plan-reviewer)](https://github.com/themouette/claude-plan-reviewer/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

plan-reviewer hooks into your AI agent's plan approval flow. When the agent presents a plan, it starts a local HTTP server, opens a browser tab, and waits — you read, annotate, then approve or deny. The decision is returned to the agent via stdout.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/themouette/claude-plan-reviewer/main/install.sh | sh
```

The installer downloads the binary to `~/.local/bin/plan-reviewer`. After installing, run:

```sh
plan-reviewer install
```

to wire your AI agent integration (interactive picker).

It also warns if `~/.local/bin` is not on PATH with per-shell fix instructions:
  - bash: `echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc`
  - zsh: `echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc`
  - fish: `fish_add_path ~/.local/bin`

**Supported platforms:**
- macOS (Apple Silicon, Intel)
- Linux (x86_64, ARM64) — static musl binary, no glibc dependency

Pre-built binaries are also available on the [Releases page](https://github.com/themouette/claude-plan-reviewer/releases).

## Usage

### Approve, deny, annotate

When a hook fires, plan-reviewer starts a local server and opens a browser tab at `http://127.0.0.1:{port}`. Read the plan, optionally write a comment in the annotation field, then click **Approve** or **Deny**. The decision is returned to the agent via stdout.

If no decision is made within 9 minutes (540 seconds), the reviewer defaults to deny.

### Review a file without hook JSON

```sh
plan-reviewer review path/to/plan.md
```

Reads the file directly (does not read stdin). Opens the browser review UI. Outputs `{"behavior":"allow"}` or `{"behavior":"deny","message":"..."}` to stdout. Exit code 1 if file not found. Useful for scripts and agent workflows that don't construct hook JSON.

## Integrations

Run `plan-reviewer install` for an interactive picker, or target a specific integration directly:

```sh
plan-reviewer install claude    # Claude Code
plan-reviewer install gemini    # Gemini CLI
plan-reviewer install opencode  # opencode
```

To remove an integration:

```sh
plan-reviewer uninstall claude
plan-reviewer uninstall gemini
plan-reviewer uninstall opencode
```

## Subcommands reference

| Subcommand | Synopsis | Description |
|------------|----------|-------------|
| `review-hook` | `plan-reviewer review-hook` | Read hook JSON from stdin, open browser review UI. Explicit form of the default hook behavior. |
| `review` | `plan-reviewer review <file>` | Review any markdown file; outputs neutral `{"behavior":"allow"\|"deny"}` JSON to stdout. |
| `install` | `plan-reviewer install [claude\|gemini\|opencode]` | Wire ExitPlanMode hook. Omit argument for interactive picker. |
| `uninstall` | `plan-reviewer uninstall [claude\|gemini\|opencode]` | Remove hook wiring. Omit argument for interactive picker. |
| `update` | `plan-reviewer update [flags]` | Self-update binary from GitHub Releases; refreshes installed integration files. |

**update flags:**

| Flag | Purpose |
|------|---------|
| `--check` | Print current and latest version + changelog URL, no download |
| `--version X` | Pin to a specific version (e.g. `--version v0.2.0`) |
| `-y` / `--yes` | Skip confirmation prompt |

```sh
plan-reviewer update --check          # check without downloading
plan-reviewer update                  # update to latest (with prompt)
plan-reviewer update -y               # update to latest, no prompt
plan-reviewer update --version v0.2.0 # pin to specific version
```

## Contributing

Issues and PRs welcome at [github.com/themouette/claude-plan-reviewer](https://github.com/themouette/claude-plan-reviewer).
