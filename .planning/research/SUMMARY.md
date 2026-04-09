# Research Summary

**Project:** claude-plan-reviewer
**Synthesized:** 2026-04-09

---

## Recommended Stack

| Layer | Choice | Version | Key reason |
|-------|--------|---------|------------|
| HTTP server | axum | 0.8.x | First-class rust-embed integration; Tokio team ships both |
| Async runtime | tokio (current_thread) | 1.x | Single-user tool; avoids Send+Sync complexity |
| Asset embedding | rust-embed | 8.x | Debug reads from disk, release embeds — best of both |
| Frontend | React + TypeScript + Vite | 19.x / 5.x / 6.x | Familiar ecosystem, strong typing, Vite compiles to static assets embedded in binary |
| Markdown render | comrak | 0.31+ | Full GFM (tables, task lists); used by crates.io/docs.rs |
| Git diff | git2 (vendored) | 0.20.x | No subprocess; static libgit2 for distributable binary |
| CLI | clap | 4.x | Industry standard; derive API |
| Browser open | webbrowser | 1.x | Cross-platform; suppresses browser stdout |
| Release CI | cargo-dist | 0.31.x | Generates curl\|sh installer + GitHub Actions matrix |

**Linux targets:** `*-unknown-linux-musl` only (fully static, no glibc floor).
**macOS:** Ad hoc sign both arm64 and x64 binaries in CI.

---

## Table Stakes Features

1. Render plan as formatted markdown — raw text is unusable
2. One-click approve (keyboard: `Enter`) — zero friction default path
3. One-click deny with message — reject and give feedback in one action
4. Block-until-decision — binary must hold until browser submits
5. Inline comment annotations — point at plan text, attach note
6. Structured feedback on deny — formatted markdown Claude can act on
7. Auto-open browser on hook trigger — no manual steps

---

## Key Architectural Decisions

**Core flow:**
```
stdin (sync read before runtime) → parse HookInput
→ git2 diff from cwd
→ AppState (Arc, read-only)
→ axum server on port 0 (OS-assigned, no collision)
→ webbrowser::open()
→ tokio::select! awaiting oneshot decision channel
→ stdout JSON → exit
```

**Two critical choices:**
- **Port 0**: `TcpListener::bind("127.0.0.1:0")` — zero collision risk, works with concurrent sessions
- **oneshot channel**: `/api/decision` POST sends decision; main task awaits it; triggers graceful server shutdown

**stdout discipline**: Only the final JSON goes to stdout. All logging/debug to **stderr**. This is non-negotiable — any stdout contamination breaks Claude Code's JSON parsing.

**Hook protocol output:**
```json
{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}
{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"deny","message":"..."}}}
```

---

## Annotation Model

Three types (not plannotator's five — simpler data model, same coverage):

| Type | Signal | When |
|------|--------|------|
| `delete` | Remove this step | Explicit rejection of a plan item |
| `replace` | Do this instead | Prescriptive rewrite |
| `comment` | Think about this | Non-prescriptive note |

Global comment = `comment` with empty `original_text`.

Deny feedback serialized as structured markdown in the `message` field — readable by Claude without parsing.

---

## Top Pitfalls to Avoid

| # | Pitfall | Prevention |
|---|---------|------------|
| 1 | **Stdout contamination** | `println!` only for final JSON; `eprintln!` for everything else |
| 2 | **Process doesn't exit** | Design clean oneshot shutdown from day one; watchdog timer |
| 3 | **Hook timeout** | Self-terminate before 10-min limit; show countdown in UI |
| 4 | **Linux glibc mismatch** | Build `*-musl` targets only |
| 5 | **macOS Gatekeeper** | Ad hoc sign `darwin-*` binaries in CI |
| 6 | **Port conflict** | Always use port 0; never fixed port |
| 7 | **Browser doesn't open** | Print URL to stderr always; `--no-browser` flag |
| 8 | **Frontend build in cross container** | Build frontend as separate CI step before Rust cross-compile |

---

## Open Questions (empirical validation needed in Phase 1)

1. **Does `tool_input.plan` contain the full plan markdown?** Confirmed via bug report but not officially documented. Must verify by inspecting hook stdin JSON at runtime.
2. **Can `updatedInput.plan` carry annotated text on `behavior: allow`?** Would enable "approve with notes" — needs protocol test.
3. **Is `transcript_path` in hook stdin useful for diff extraction?** May let us infer relevant files without user input.

---

## Phase Implications

- **Phase 1 (core):** Hook wiring, block-until-decision, plan render, approve/deny, clean exit. Validates protocol.
- **Phase 2 (annotations):** Full annotation surface, structured deny feedback, browser tab close UX.
- **Phase 3 (distribution):** musl cross-compile, macOS signing, cargo-dist, install script, PATH detection.
- **Later:** Diff view, approve-with-comments, plan revision history, timeout countdown.
