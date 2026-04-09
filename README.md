# claude-plan-reviewer

Intercepts Claude Code's plan approval flow and renders the plan in a local browser UI, letting you annotate before approving or denying execution.

## Build

Prerequisites: Rust toolchain (`rustup`), Node.js (the UI is built automatically by `build.rs`).

```sh
cargo build --release
```

The binary is at `target/release/claude-plan-reviewer`.

## Install as a Claude Code hook

Add the hook to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "ExitPlanMode",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/claude-plan-reviewer"
          }
        ]
      }
    ]
  }
}
```

Replace `/path/to/claude-plan-reviewer` with the absolute path to the built binary (e.g. `~/Projects/lab/claude-plan-reviewer/target/release/claude-plan-reviewer`).

## Usage

When Claude Code enters plan mode and you approve, the reviewer opens a browser tab showing the plan. You can annotate sections, leave an overall comment, then approve or deny. The decision and annotations are returned to Claude as structured feedback.
