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

---

# Stack Research — v0.5.0 Offline Resilience (APPENDED)

**Researched:** 2026-05-05
**Confidence:** HIGH — all claims verified against MDN specs and existing codebase

## Scope

New stack decisions needed for v0.5.0 only. Existing stack (axum 0.8, rust-embed 8, React 19, TypeScript 6, Vite 8, Vitest 4) is not re-researched. All four features (heartbeat polling, offline annotation mode, clipboard export, slash command resilience) are achievable with **zero new Cargo or npm dependencies**.

---

## New Additions Required

### 1. Axum: `/api/ping` Route (Rust)

**What:** A GET handler returning `200 OK`. No state access. No body required.

**Why:** The frontend needs a dedicated stateless endpoint to poll for liveness. Existing endpoints (`/api/plan`, `/api/diff`, `/api/decide`) are stateful or mutating — not suitable as a heartbeat target.

**Implementation:** One handler function + one `.route()` call in `src/server.rs`. No new crate.

```rust
async fn get_ping() -> impl IntoResponse {
    StatusCode::OK
}
// In start_server():
.route("/api/ping", get(get_ping))
```

`StatusCode::OK` with no body costs one allocation saved versus a `Json` response. The frontend checks `res.ok` only.

**Confidence:** HIGH — identical pattern to existing handlers; axum 0.8 is already in use.

---

### 2. React: `useHeartbeat` Hook (Frontend)

**What:** Custom React hook that polls `/api/ping` at a fixed interval and returns `isOnline: boolean`.

**Why:** Encapsulates interval lifecycle and AbortController cleanup. Keeps `App.tsx` free of polling boilerplate. Testable in isolation with Vitest.

**No new npm dependency.** Uses `useState`, `useEffect`, `useRef` — already used in `App.tsx`.

**Verified design decisions:**

- Do NOT use `navigator.onLine` / `window "online"/"offline"` events. These reflect the host machine's network adapter state, not the local process's liveness. The Rust binary can die while the machine stays online. Fetch-based polling is the only reliable signal.
- `AbortController` is single-use — create a new instance per poll cycle. The cleanup function must call `controller.abort()` on unmount and on interval teardown to prevent state updates on an unmounted component.
- `AbortError` must be caught and silently discarded — it signals cancellation, not server death.
- `setInterval` inside `useEffect` with a `useRef` for the controller avoids stale closure issues.
- 5-second poll interval: fast enough for the user to notice before they click "Submit"; light enough on loopback (< 1 KB per poll).

**Sketch (full implementation in planning, not here):**
```typescript
// ui/src/hooks/useHeartbeat.ts
export function useHeartbeat(intervalMs = 5000): boolean {
  const [isOnline, setIsOnline] = useState(true)
  const controllerRef = useRef<AbortController | null>(null)
  useEffect(() => {
    let mounted = true
    async function ping() {
      const controller = new AbortController()
      controllerRef.current = controller
      try {
        const res = await fetch('/api/ping', { signal: controller.signal })
        if (mounted) setIsOnline(res.ok)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        if (mounted) setIsOnline(false)
      }
    }
    ping()
    const id = setInterval(ping, intervalMs)
    return () => { mounted = false; clearInterval(id); controllerRef.current?.abort() }
  }, [intervalMs])
  return isOnline
}
```

**Confidence:** HIGH — standard React hook pattern; no external library needed.

---

### 3. React: Offline State Branching in `App.tsx`

**What:** `isOnline` from `useHeartbeat` threads into the approve/deny handlers and action bar rendering.

**Why:** Offline mode must be non-blocking — the user keeps annotating normally; only the submit path changes.

**Design (no new `AppState` value needed):**

- `isOnline` is a parallel boolean, not a new `AppState` variant.
- Action bar shows a non-blocking banner when `!isOnline` (e.g. amber strip: "Server disconnected — submit will copy to clipboard").
- `approve()` and `deny()` gain an `isOnline` branch:
  - Online: existing `fetch('/api/decide', ...)` path — unchanged.
  - Offline: `copyToClipboard(serializedPayload)` → transition to `confirmed` state.
- After a successful clipboard copy, the app sets `appState = 'confirmed'` as normal. The user pastes into Claude manually via the updated `annotate.md` Step 4.

**No new React primitives.** Uses existing `useState`, `useCallback`, `useEffect`.

**Confidence:** HIGH.

---

### 4. Browser API: `navigator.clipboard.writeText()`

**What:** Copy the serialized annotation payload to clipboard when the submit path is offline.

**Secure context — verified HIGH confidence:**
The app is served from `http://127.0.0.1:<port>`. Per MDN's [Secure Contexts spec](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts), `http://127.0.0.1` and `http://localhost` are "potentially trustworthy origins" treated as secure contexts by all modern browsers. `window.isSecureContext` evaluates to `true` on this origin. Firefox 84+ explicitly documents this; Chrome/Safari have done so since 2018.

**`navigator.clipboard.writeText()` is therefore available on the loopback origin with no HTTPS setup needed.** No polyfill required.

**Requirements verified:**
- Must be called from a user gesture (button click). Satisfied: user clicks "Submit" / "Copy to clipboard".
- Returns a Promise — must be awaited; errors caught and surfaced to the user (e.g., "Copy failed — paste this manually: ...").
- `navigator.clipboard` is `undefined` only if `window.isSecureContext` is `false`, which will not happen on 127.0.0.1. The `execCommand('copy')` fallback below guards the hypothetical case.

**Clipboard utility function (no library):**
```typescript
// ui/src/utils/clipboard.ts
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return true }
    catch { /* fall through */ }
  }
  // execCommand fallback — deprecated but functional; only reached if Clipboard API absent
  try {
    const ta = document.createElement('textarea')
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.focus(); ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch { return false }
}
```

**Do NOT make `execCommand('copy')` the primary path.** It is deprecated; browsers may remove it. The Clipboard API is the primary path.

**Serialization reuse:** `serializeAnnotations()` in `ui/src/utils/serializeAnnotations.ts` already produces the annotation string. The offline clipboard path calls the same function — no change to the serialization logic.

**Confidence:** HIGH — MDN spec confirmed; Clipboard API is Baseline Widely Available since March 2020.

---

### 5. Slash Command: `annotate.md` Text Update

**What:** Update the embedded `annotate.md` template (in `src/integrations/claude.rs` or equivalent) — specifically Step 4 — to instruct Claude to accept pasted clipboard JSON as an alternative to reading stdout.

**Why:** When the Rust binary is killed by Claude Code's timeout before the user submits, no stdout result arrives. The clipboard export gives the user the payload; the prompt must tell Claude to accept it pasted into the conversation instead.

**Implementation:** Text-only string change in Rust source. No new crate, no new file format.

**Confidence:** HIGH — this is a copy change.

---

## What NOT to Add

| Candidate | Why Rejected |
|-----------|--------------|
| `react-use` / `ahooks` (polling hooks) | 30-line custom hook is the right size; no library warranted |
| `tokio-tungstenite` (WebSocket) | Overkill for liveness detection; complicates existing graceful shutdown |
| Service Worker / Background Sync | Assets are embedded in binary — no offline caching needed |
| `navigator.onLine` events alone | Detects host network, not local process death; wrong signal |
| `react-query` / `swr` | No other data-fetching use cases justify these; overkill |
| `execCommand('copy')` as primary path | Deprecated; not needed on 127.0.0.1 loopback origin |

---

## Integration Points with Existing Stack

| Existing File | Touch Point | Change Type |
|---------------|-------------|-------------|
| `src/server.rs` | Add `/api/ping` GET route | +5 lines (handler + `.route()`) |
| `ui/src/App.tsx` | Call `useHeartbeat()`; branch approve/deny on `isOnline` | State threading; existing imports |
| `ui/src/hooks/` | Add `useHeartbeat.ts` | New file; same pattern as `useTextSelection.ts` |
| `ui/src/utils/` | Add `clipboard.ts` | New utility file |
| `ui/src/utils/serializeAnnotations.ts` | Reused as-is | No change |
| `src/integrations/claude.rs` | Update `annotate.md` template string | Text change only |

---

## Dependency Block (No Changes for v0.5.0)

No new Cargo or npm dependencies. Existing stack is fully sufficient:

- **axum 0.8** — handles the new `/api/ping` route
- **React 19 + TypeScript 6** — `useEffect`, `useRef`, `useState`, `fetch`, `AbortController`, `navigator.clipboard` all built-in
- **Vitest 4** — tests the new `useHeartbeat` hook and `clipboard.ts` utility

---

## Sources (v0.5.0 section)

- MDN Clipboard API: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
- MDN Clipboard.writeText(): https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText
- MDN Secure Contexts (localhost as trustworthy origin): https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts
- axum docs (0.8): https://docs.rs/axum/latest/axum/
- React useEffect + AbortController cleanup: https://blog.logrocket.com/understanding-react-useeffect-cleanup-function/
- navigator.onLine unreliability for local server detection: https://dev.to/safal_bhandari/detecting-online-and-offline-status-in-react-1i6o

---
*v0.5.0 Offline Resilience section appended: 2026-05-05*
