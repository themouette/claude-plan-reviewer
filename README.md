# plan-reviewer

Intercepts your AI agent's plan approval flow and opens a local browser UI to review, annotate, approve, or deny before execution.

[![GitHub release](https://img.shields.io/github/v/release/themouette/claude-plan-reviewer)](https://github.com/themouette/claude-plan-reviewer/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

plan-reviewer hooks into your AI agent's plan approval flow. When the agent presents a plan, it starts a local HTTP server, opens a browser tab, and waits — you read, annotate, then approve or deny. The decision is returned to the agent via stdout.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/themouette/claude-plan-reviewer/main/install.sh | sh
```

The installer:
- Downloads the binary to `~/.local/bin/plan-reviewer`
- Auto-wires Claude Code on first install (`plan-reviewer install claude` runs automatically)
- Warns if `~/.local/bin` is not on PATH with per-shell fix instructions:
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

**Global flags:**

| Flag | Default | Purpose |
|------|---------|---------|
| `--no-browser` | — | Skip auto-open; URL is printed to stderr |
| `--port N` | OS-assigned | Bind the review server to a specific port |

### Review a file without hook JSON

```sh
plan-reviewer review path/to/plan.md
```

Reads the file directly (does not read stdin). Opens the browser review UI. Outputs `{"behavior":"allow"}` or `{"behavior":"deny","message":"..."}` to stdout. Exit code 1 if file not found. Useful for scripts and agent workflows that don't construct hook JSON.

## Integrations

The curl | sh installer auto-wires Claude Code. For Gemini CLI or opencode, run the install subcommand separately.

### Claude Code

Wires plan-reviewer as a Claude Code plugin. Fires on `ExitPlanMode`.

```sh
plan-reviewer install claude
```

**What gets written:**
- `~/.local/share/plan-reviewer/claude-plugin/.claude-plugin/plugin.json` — plugin manifest
- `~/.local/share/plan-reviewer/claude-plugin/.claude-plugin/marketplace.json` — marketplace manifest
- `~/.local/share/plan-reviewer/claude-plugin/hooks/hooks.json` — ExitPlanMode hook
- `~/.claude/settings.json` — adds `extraKnownMarketplaces["plan-reviewer-local"]` and `enabledPlugins["plan-reviewer@plan-reviewer-local": true]`

**Verify:**
```sh
cat ~/.claude/settings.json | python3 -m json.tool | grep "plan-reviewer@plan-reviewer-local"
```

**Uninstall:**
```sh
plan-reviewer uninstall claude
```

Install and uninstall are idempotent — safe to run multiple times.

---

### Gemini CLI

Wires plan-reviewer as a Gemini CLI extension. Fires on `exit_plan_mode`. Auto-discovered — no `settings.json` modification required.

```sh
plan-reviewer install gemini
```

**What gets written:**
- `~/.gemini/extensions/plan-reviewer/gemini-extension.json` — extension manifest
- `~/.gemini/extensions/plan-reviewer/hooks/hooks.json` — BeforeTool/exit_plan_mode hook

The hooks.json written:
```json
{
  "hooks": {
    "BeforeTool": [{
      "matcher": "exit_plan_mode",
      "hooks": [{
        "name": "plan-reviewer",
        "type": "command",
        "command": "plan-reviewer review-hook",
        "timeout": 300000
      }]
    }]
  }
}
```

The 300000ms (5-minute) timeout is required — Gemini CLI's default 60-second timeout fires before the user finishes reviewing.

**Verify:**
```sh
ls ~/.gemini/extensions/plan-reviewer/gemini-extension.json
```

**Uninstall:**
```sh
plan-reviewer uninstall gemini
```

---

### opencode

Wires plan-reviewer as an opencode JS plugin. Fires on `submit_plan`.

```sh
plan-reviewer install opencode
```

**What gets written:**
- `~/.config/opencode/plugins/plan-reviewer-opencode.mjs` — bundled JS plugin
- `~/.config/opencode/opencode.json` — `plugin` array entry added

**Verify:**
```sh
ls ~/.config/opencode/plugins/plan-reviewer-opencode.mjs
```

**Uninstall:**
```sh
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
