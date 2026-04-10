# Stack Research

**Domain:** Local Rust binary + React/TS browser UI — v0.3.0 incremental additions
**Researched:** 2026-04-10
**Confidence:** HIGH for opencode (confirmed via official docs + plannotator source) | HIGH for theme | MEDIUM for codestral (confirmed: it is a model, no agent hook system)

---

## Scope

This document covers ONLY new stack decisions needed for v0.3.0. The existing validated stack (axum 0.8, rust-embed 8, git2 0.20, comrak, clap 4, self_update 0.44, dialoguer 0.12, React 19, TS, Vite, Tailwind CSS 4) is not re-researched here.

---

## Recommended Stack — New Additions

### opencode Integration

**Verdict: No Rust config changes. Requires writing an npm plugin in TypeScript.**

opencode does NOT have a config-based hook analogous to Claude Code's `ExitPlanMode`. The only config-based hooks are experimental (`experimental.hook.file_edited`, `experimental.hook.session_completed`) and have no plan approval event. Plan review in opencode is achieved via the plugin system: an npm package is listed in the `plugin` array and registers a `submit_plan` tool that the agent calls after drafting a plan.

This is confirmed by:
- Plannotator's opencode integration (`@plannotator/opencode@latest`) uses exactly this pattern
- open-plan-annotator (`open-plan-annotator@latest`) uses the same `submit_plan` tool approach
- opencode's changelog and docs show no config hook for plan approval as of v1.4.3 (April 10 2026)

**What this means for plan-reviewer:**

| Approach | Verdict | Reason |
|----------|---------|--------|
| Write a config hook entry (like Claude Code) | NOT POSSIBLE | No such hook exists in opencode |
| Write a Rust binary plugin | NOT POSSIBLE | opencode plugins must be TypeScript/JavaScript npm packages |
| Publish an npm plugin package that shells out to the plan-reviewer binary | CORRECT PATH | Plugin registers `submit_plan` tool; on invocation it calls `plan-reviewer` via subprocess, waits for browser decision, returns result to opencode |

**Integration path — opencode config file:**

- Global: `~/.config/opencode/opencode.json` or `~/.config/opencode/opencode.jsonc`
- Project: `opencode.json` or `opencode.jsonc` at project root (merged on top of global)
- Field: `"plugin": ["@plan-reviewer/opencode@latest"]`

**Example config after install:**
```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@plan-reviewer/opencode@latest"]
}
```

**New artifacts required:**
- A separate npm package (`packages/opencode-plugin/` in a monorepo, or a standalone repo)
- The plugin registers a `submit_plan` tool via opencode SDK
- On `submit_plan` invocation: shell out to `plan-reviewer` binary (path from env var or discovery), capture stdout JSON, return decision to opencode
- `plan-reviewer install opencode` writes the plugin entry to opencode.json; `uninstall opencode` removes it

**No new Rust crates needed** for the install/uninstall side — this is string manipulation on a JSON file, identical in pattern to the existing Claude Code installer. The Rust side uses `serde_json` (already present) to read/write `opencode.json`.

### codestral Integration

**Verdict: Codestral is a language model, not a coding agent. No hook integration is possible.**

Codestral (by Mistral AI) is a code-generation LLM. It has no agent runtime, no settings file, no hook infrastructure. It is used as a backend model inside other tools (Continue.dev, LM Studio, Ollama, etc.). The relevant agentic product from Mistral is Devstral, but Devstral also has no published plan-approval hook system.

**Current stub in integration.rs is correct**: `supported: false`, reason "Codestral is a model, not a coding agent with hook infrastructure." This should remain. Do not implement codestral integration in v0.3.0 — it is architecturally impossible without a future hook system from Mistral.

**No new crates or config formats to research.**

### Annotation Predefined Action Types — Frontend Only

**Verdict: Pure frontend change. No new npm packages needed.**

The existing `AnnotationType` union (`'comment' | 'delete' | 'replace'`) needs a new member: `'action'` (or keep as the existing types and add a `predefinedAction` field). The predefined actions (clarify this, needs test, give me an example, out of scope, search internet, search codebase) are strings passed as the annotation comment field with a fixed label.

**Recommended approach:** Add `predefinedAction` as an optional field on the existing `Annotation` interface, or add `'action'` as a new `AnnotationType`. The latter is cleaner since it gets its own display badge color and requires no free-text textarea.

**No new libraries.** The existing React component model handles this as a new branch in the `getTypeBadgeLabel` / `getTypeColor` switches. The serialization to the Claude hook's `message` field (already in `hook.rs`) is a string — predefined actions are serialized the same way as comments.

**Frontend changes only:**
- `types.ts`: extend `AnnotationType` or add `predefinedAction?: string` to `Annotation`
- `AnnotationSidebar.tsx`: new card variant showing action button grid instead of textarea
- `App.tsx`: add `onAddPredefinedAction` handler
- No changes to `server.rs`, `hook.rs`, or any Rust code

### Theme Switcher — Frontend Only, No New Packages

**Verdict: Zero new npm packages. Tailwind CSS v4 already in the project supports class-based dark mode natively.**

**Tailwind CSS v4 dark mode setup:**

Add to `index.css`:
```css
@custom-variant dark (&:where(.dark, .dark *));
```

This makes every `dark:*` utility active whenever a `.dark` class appears on any ancestor. Toggle it on `<html>` (or `<body>`).

**Persistence via localStorage — no library needed:**
```ts
// Read on load (in main.tsx, before React renders):
const saved = localStorage.getItem('theme')
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
if (saved === 'dark' || (!saved && prefersDark)) {
  document.documentElement.classList.add('dark')
}

// Toggle handler:
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark')
  localStorage.setItem('theme', isDark ? 'dark' : 'light')
}
```

**Existing CSS variable approach in index.css is already dark-only.** Implementing light mode means adding a second set of CSS custom properties scoped to `:root.light` (or `:root:not(.dark)`). The variables (`--color-bg`, `--color-surface`, `--color-text-primary`, etc.) already exist — add light-mode values.

**No FOUC risk** because the theme class is set in `main.tsx` before the first React render paints. Since this is a single-page app served from a local HTTP server with no SSR, there is no server/client mismatch problem.

**Frontend changes only:**
- `index.css`: add `@custom-variant dark` line + light-mode color token overrides under `.light` (or `html:not(.dark)`)
- `main.tsx`: add pre-render theme initialization
- `App.tsx` or a new `ThemeToggle` component: button that calls `toggleTheme()`
- No changes to any Rust code

---

## What NOT to Add

| Avoid | Why |
|-------|-----|
| `next-themes` or any theme-management library | Zero-dependency approach works; the app has no SSR hydration problem |
| `react-markdown` or `rehype-*` | Server-side markdown rendering already done by comrak; client-side redundant |
| `prefers-color-scheme` media-query-only approach | Won't allow user override; localStorage toggle requires the class approach |
| Any npm package for opencode plugin invocation of plan-reviewer binary | Use Node.js `child_process.spawnSync` in the plugin TS code; no extra dependency |
| `toml` or `yaml` Rust crate | opencode config is JSON/JSONC; `serde_json` already handles it |

---

## Integration Points — Config File Summary

| Integration | Config File | Field | Format |
|-------------|-------------|-------|--------|
| Claude Code | `~/.claude/settings.json` | `hooks.PermissionRequest[]` | `{"matcher":"ExitPlanMode","hooks":[{"type":"command","command":"<binary>"}]}` |
| opencode | `~/.config/opencode/opencode.json` (global) or `opencode.json` (project) | `plugin[]` | `"@plan-reviewer/opencode@latest"` (npm package name string) |
| codestral | N/A — model, not agent | N/A | N/A — not implementable |

---

## Version Compatibility

All changes are additive to the existing stack. No version bumps required.

| Change | Impact on Existing Deps |
|--------|------------------------|
| opencode JSON install/uninstall | None — uses `serde_json` already present |
| Annotation predefined types | None — pure React/TS frontend change |
| Dark mode | None — Tailwind CSS 4 already supports `@custom-variant dark` |

---

## Sources

- opencode config docs: https://opencode.ai/docs/config/ — confirmed `plugin[]` array format, `~/.config/opencode/opencode.json` global path
- opencode plugins docs: https://opencode.ai/docs/plugins/ — confirmed TypeScript-only plugin system, no config-based command hooks for plan approval
- opencode modes docs: https://opencode.ai/docs/modes/ — confirmed plan mode exists, no approval hook fires
- plannotator opencode guide: https://plannotator.ai/docs/guides/opencode/ — confirmed `plugin: ["@plannotator/opencode@latest"]` pattern
- open-plan-annotator GitHub: https://github.com/ndom91/open-plan-annotator — confirmed `submit_plan` tool registration pattern, plugin-based (not config hook)
- opencode hooks issue: https://github.com/anomalyco/opencode/issues/1473 — confirmed maintainer chose plugin system over traditional hooks
- Tailwind CSS v4 dark mode: https://tailwindcss.com/docs/dark-mode — confirmed `@custom-variant dark` syntax for class-based dark mode
- KristjanPikhof/OpenCode-Hooks: https://github.com/KristjanPikhof/OpenCode-Hooks — confirmed available hook events (session.*, tool.*, file.changed); no plan approval hook
- Codestral: https://mistral.ai/news/codestral — confirmed model product, no agent runtime or hook system

---
*Stack research for: claude-plan-reviewer v0.3.0 (opencode/codestral hooks, annotation actions, theme switcher)*
*Researched: 2026-04-10*
