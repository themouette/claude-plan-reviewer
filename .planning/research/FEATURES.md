# Feature Landscape

**Domain:** AI coding-agent plan reviewer — v0.3.0 milestone additions
**Researched:** 2026-04-10
**Confidence:** MEDIUM-HIGH overall

> This document supersedes the v0.1.0 feature research. It focuses exclusively on
> features targeted for v0.3.0. The v0.1.0 research is preserved in git history.

---

## Context: What Already Exists

The following are already built (v0.1.0) and are NOT re-researched here:

- Plan review with markdown rendering and code diff display in browser
- Claude Code ExitPlanMode hook wiring (full install/uninstall, JSON protocol)
- Annotation system: `comment`, `delete`, `replace` types with free-text inputs
- `AnnotationSidebar`, `serializeAnnotations`, full annotation output pipeline
- `install`, `uninstall`, `update` subcommands
- React 19 + TypeScript + Tailwind v4 + Vite frontend (dark-only CSS custom properties)

---

## Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Opencode: `submit_plan` tool via plugin | De-facto opencode plan review pattern; both Plannotator and open-plan-annotator use it; users switching from those tools expect this exact mechanism | HIGH | Requires a JS/TS plugin file installed in `~/.config/opencode/plugins/` or `.opencode/plugins/`. Plugin registers a `submit_plan` tool via the opencode Plugin SDK. `plan-reviewer install opencode` writes the file and updates `~/.config/opencode/opencode.json`. This is the ONLY working approach — the `permission.asked` hook is defined in SDK types but never triggered (GitHub issue #7006, unresolved as of Jan 2026). |
| Annotation quick-action labels (6 predefined) | Reviewers want one-click annotation without typing; Plannotator ships 10 default labels as chip buttons | LOW | Chips above the comment form pre-fill the comment text. No new AnnotationType needed — label text becomes the `comment` field value. Labels: "Clarify this", "Needs test", "Give me an example", "Out of scope", "Search internet", "Search codebase". Zero changes to hook output format or Rust code. |
| Light/dark theme toggle, persisted | Dark-only UIs frustrate light-mode users; developer tool audience expects this control | MEDIUM | Current CSS: hardcoded dark values in `:root` as CSS custom properties. Tailwind v4 class-based dark mode via `@custom-variant dark (&:where(.dark, .dark *))` in `index.css`. Toggle class on `<html>`. Persist to `localStorage`. Fall back to `prefers-color-scheme` when no stored preference. Requires defining ~15 light-mode color values. |
| User README (install, configure, review, annotate) | Without documentation, install friction is insurmountable for new users | LOW | Markdown in repo root. Covers: `curl \| sh` install, `plan-reviewer install <tool>`, how hook fires per integration, the review workflow, annotation types, `update` subcommand. One doc, not split. |
| Integration guide per tool (Claude Code + opencode) | Users of each tool need a specific section with exact config steps | LOW | Can live within README as headed sections. Claude Code section: minimal (already stable). Opencode section: `opencode.json` snippet, plugin placement, what `submit_plan` does, how to verify it loaded. |

---

## Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `plan-reviewer install opencode` writes plugin file | Same zero-friction UX as Claude Code install — one command sets everything up | HIGH | The JS plugin file is embedded in the Rust binary at compile time (`include_str!` on the plugin `.mjs` source). Install writes it to disk + updates `opencode.json`. Uninstall removes the file + config entry. This is the key differentiator over tools that require manual `opencode.json` editing. |
| Annotation label tip text (agent-facing instruction) | Labels can carry an invisible agent instruction beyond just the label name — "Search internet: verify this by searching before proceeding" — shaping how the agent responds | LOW | Extend `Annotation` interface with optional `label` (display name) and `tip` (agent instruction). `serializeAnnotations` emits the tip text in the feedback block. Plannotator implements this; it meaningfully improves agent behavior. |
| Three-state theme picker (Light / Dark / System) | "System" respects OS setting without the user having to re-toggle on theme changes — better than binary light/dark | LOW | Upgrade from binary toggle. `ThemeMode = 'light' \| 'dark' \| 'system'`. `'system'` removes the `localStorage` key so `prefers-color-scheme` takes over. Minimal extra complexity once binary toggle is in place. |

---

## Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Codestral config-file hook integration | PROJECT.md lists "codestral integration" as a milestone target | Codestral is a Mistral AI language model, not a CLI coding agent. It has no settings file, no hook system, and no plan approval mechanism. Mistral's actual CLI coding agent is `mistral-vibe` (`~/.vibe/config.toml`) but it has no documented external plan-review hook — only MCP server support and per-tool permission levels. Writing a config entry for "codestral" would have no effect. | Treat the v0.3.0 milestone deliverable as a documentation and UX decision: (a) update the `Codestral` stub's `unsupported_reason` to accurately explain it is a model, (b) document this clearly in the README, (c) optionally rename or remove the stub. Do NOT ship fake hook wiring. |
| Opencode `permission.asked` hook wiring (Claude Code-style config entry) | Appears to be the obvious parallel to Claude Code's `settings.json` hook | The `permission.asked` plugin hook is defined in opencode SDK types but is NEVER called by the opencode runtime (confirmed issue #7006, January 2026). Config-based hooks in `opencode.json` only support `file_edited` and `session_completed` (experimental). There is no config-file equivalent of Claude's `PermissionRequest` entry for plan interception. | Use the `submit_plan` plugin tool pattern — the only working approach. |
| opencode plugin using stdin/stdout subprocess | Seems natural for IPC between the JS plugin and the Rust binary | Documented issues: `child_process.spawn()` with piped stdio in opencode plugins does not reliably deliver data to the child process stdin (GitHub issue #21293). | Plugin communicates with the already-running Rust HTTP server via HTTP fetch — reliable, tested by Plannotator and open-plan-annotator. |
| Custom annotation label editor in v0.3.0 | Plannotator supports up to 12 customizable labels with color pickers | High implementation cost (settings UI, persistence, validation) with low marginal value before the feature is validated. Ship 6 hardcoded labels first. | Defer label customization to v0.4.0+ after confirming users use the predefined ones. |
| Annotation quick-action as a new AnnotationType | Could model quick-action labels as first-class types (`clarify`, `needs-test`, etc.) | Creates 6+ new type variants in the Rust `HookOutput` and serializer. Breaks existing output format. Adds a combinatoric maintenance surface (type × has-comment × has-replacement). | Labels are metadata on the existing `comment` type — the label text becomes the comment content. Zero Rust changes needed. |

---

## Feature Dependencies

```
Opencode JS plugin file (embedded in Rust binary at compile time)
    └──required by──> plan-reviewer install opencode (writes plugin to disk)
                          └──required by──> plan-reviewer uninstall opencode (removes plugin + config entry)

Opencode plugin (submit_plan tool) calls Rust HTTP server
    └──depends on──> plan-reviewer binary running as HTTP server before plugin fires
                      [Note: current arch starts server only when hook fires — opencode
                       integration may require a different startup trigger]

Annotation quick-action labels
    └──builds on──> Existing comment AnnotationType (no new type)
    └──feeds into──> serializeAnnotations (emits label tip text if present)
    └──optional enhancement──> label tip text (agent-facing instruction per label)

Theme CSS light-mode tokens (~15 new --color-* values)
    └──required by──> Theme toggle button (React component in PageHeader)
    └──required by──> localStorage persistence (useTheme hook)
    └──requires──> Tailwind v4 @custom-variant dark declaration added to index.css

User README
    └──requires──> All v0.3.0 features stable
    └──depends on──> Opencode integration working to document it accurately
```

### Dependency Notes

- **Opencode plugin startup**: The current architecture starts the HTTP server when Claude Code fires the hook (binary is the hook command). For opencode, the binary is NOT the hook — it's a plugin-registered tool. The plugin needs to either (a) launch the binary as a subprocess that runs the server then returns JSON, or (b) call a pre-running binary via HTTP. This startup model needs design work in Phase 1.
- **Labels do not touch Rust**: The quick-action label feature is entirely in the React frontend. `serializeAnnotations.ts` may need a small update to emit tip text if a `tip` field is added to `Annotation`, but the Rust `HookOutput` struct is unchanged.
- **Theme FOUC prevention**: A small inline `<script>` in `index.html` `<head>` (before React loads) must apply the stored theme class before the browser renders. Without it, users see a flash of dark/light on page load.

---

## MVP Definition for v0.3.0

### Launch With (v0.3.0)

- [ ] Opencode plugin file authored (JS, registers `submit_plan` tool, calls plan-reviewer HTTP server)
- [ ] `plan-reviewer install opencode` — writes plugin to `~/.config/opencode/plugins/` + updates `opencode.json`
- [ ] `plan-reviewer uninstall opencode` — removes plugin file + config entry
- [ ] Annotation quick-action labels — 6 predefined chips: "Clarify this", "Needs test", "Give me an example", "Out of scope", "Search internet", "Search codebase"
- [ ] Light/dark theme toggle in `PageHeader`, persisted to `localStorage`, falls back to `prefers-color-scheme`
- [ ] FOUC-prevention inline script in `index.html`
- [ ] Codestral stub updated: `unsupported_reason` accurately says "model, not agent; no hook infrastructure"
- [ ] README: install guide, Claude Code integration steps, opencode integration steps, review workflow, annotation types

### Add After Validation (v0.4.0)

- [ ] Annotation label tip text (agent-facing instruction per label) — add once users confirm they use predefined labels
- [ ] Three-state theme picker (Light / Dark / System) — upgrade from binary toggle
- [ ] Mistral-vibe integration research — only if users report using mistral-vibe
- [ ] Ask-from-UI (select text, stream AI response inline) — already v0.4.0 candidate in PROJECT.md

### Future Consideration (v0.5.0+)

- [ ] Custom annotation label editor (add/remove/reorder/color labels in settings UI)
- [ ] Annotation "insert" type (new content at a position) — high implementation cost vs replace

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Opencode install/uninstall | HIGH — unlocks opencode user segment | HIGH — JS plugin file + embed + config R/W | P1 |
| Annotation quick-action labels | HIGH — speeds up most common workflow | LOW — chips UI + pre-fill logic | P1 |
| Light/dark theme toggle | MEDIUM — quality-of-life; dark-only frustrates light users | MEDIUM — new CSS tokens + toggle component + hook | P1 |
| User README + integration guide | HIGH — without docs, new users are blocked | LOW — writing only | P1 |
| Codestral stub update | LOW user impact but prevents confusion | LOW — text change + test update | P2 |
| Label tip text | MEDIUM — shapes agent behavior meaningfully | LOW — small Annotation type extension | P2 |
| Three-state theme picker | LOW — binary toggle covers 90% of need | LOW (once binary toggle exists) | P3 |

---

## Opencode Integration: Technical Detail

**Architecture (HIGH confidence — verified via Plannotator opencode README, open-plan-annotator source, opencode plugin docs):**

1. Plugin file in `~/.config/opencode/plugins/plan-reviewer.mjs` (global) or `.opencode/plugins/plan-reviewer.mjs` (project).
2. `opencode.json` references it: `"plugin": ["/absolute/path/to/plan-reviewer.mjs"]` or `"plugin": ["@plan-reviewer/opencode@latest"]` if published to npm.
3. Plugin exports a function returning an object with a `tool` property defining `submit_plan`.
4. When LLM calls `submit_plan`, plugin makes an HTTP call to the plan-reviewer server.
5. Server blocks, browser opens, user reviews, decision returns as HTTP response to plugin.
6. Plugin returns structured feedback to the LLM as the tool result.

**Config file paths:**
- Global opencode config: `~/.config/opencode/opencode.json`
- Global plugin directory: `~/.config/opencode/plugins/`
- Project config: `<project>/opencode.json`
- Project plugin directory: `<project>/.opencode/plugins/`

**Config entry format:**
```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["/path/to/plan-reviewer-opencode.mjs"]
}
```

**Minimal plugin structure (JS, not TS — avoids transpilation requirement):**
```javascript
// plan-reviewer-opencode.mjs
export const PlanReviewerPlugin = async (ctx) => {
  return {
    tool: {
      submit_plan: {
        description: "Submit a plan for human review before implementation.",
        parameters: {
          type: "object",
          properties: {
            plan: { type: "string", description: "The plan to review" }
          },
          required: ["plan"]
        },
        execute: async ({ plan }) => {
          // POST to plan-reviewer local HTTP server
          const resp = await fetch("http://localhost:<PORT>/review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan })
          });
          return await resp.json(); // returns { decision, message }
        }
      }
    }
  };
};
```

**What does NOT work for opencode:**
- `permission.asked` hook — defined in SDK types but never triggered (issue #7006, Jan 2026)
- Config-based hooks in `opencode.json` — only `file_edited` and `session_completed` (experimental)
- `child_process.spawn()` with piped stdin/stdout — unreliable in opencode plugin context (issue #21293)

---

## Codestral Integration: Technical Detail

**Conclusion (HIGH confidence from multiple sources):**

"Codestral" is a Mistral AI language model. It is not a coding agent and has no settings file, hook system, or plan approval mechanism. There is nothing to wire.

Mistral's CLI coding agent is `mistral-vibe`, using `~/.vibe/config.toml`. As of research date, mistral-vibe has no documented external plan-review hook or `submit_plan`-equivalent mechanism.

**v0.3.0 deliverables for this item:**
1. Update `get_integration(IntegrationSlug::Codestral).unsupported_reason` to say: "Codestral is a Mistral AI language model, not a coding agent. It has no hook infrastructure. For Mistral's coding agent (mistral-vibe), no plan review hook is currently available."
2. Update the test `opencode_and_codestral_unsupported` to match the new reason string.
3. Document in the README under "Supported integrations" table.

---

## Annotation Quick-Action Labels: Technical Detail

**Reference:** Plannotator "Quick Labels" — chip buttons that auto-populate the comment field. Clicking a chip: creates or updates a `comment` annotation with the label text pre-filled.

**Implementation (no new types, no Rust changes):**

- Add optional `label?: string` to `Annotation` interface in `types.ts` (metadata only)
- Render chip buttons in the selection popup (shown when text is selected in the plan)
- Clicking a chip: `addAnnotation({ type: 'comment', comment: label.text, label: label.name })`
- `serializeAnnotations.ts`: if `a.label` is set, render as `[COMMENT: ${a.label}]` header — no breaking change to existing output
- Optional: add `tip?: string` per label; `serializeAnnotations` appends tip to the comment block

**6 predefined labels (PROJECT.md spec):**

| Label | Pre-filled Comment Text |
|-------|------------------------|
| Clarify this | "Clarify this section before proceeding — the intent is ambiguous." |
| Needs test | "Add a test for this. Do not proceed without test coverage for this path." |
| Give me an example | "Provide a concrete example of how this will work in practice." |
| Out of scope | "This is out of scope for the current task. Skip this step." |
| Search internet | "Search the internet to verify this claim before proceeding." |
| Search codebase | "Search the codebase for existing implementations before writing new code." |

---

## Theme Switching: Technical Detail

**Stack:** React 19 + Tailwind v4 (`@tailwindcss/vite ^4.2.2`) + Vite. CSS uses `@import "tailwindcss"` and CSS custom properties in `:root` (dark values only, 15 variables).

**Tailwind v4 class-based dark mode:**
```css
/* index.css — add this line */
@custom-variant dark (&:where(.dark, .dark *));
```

**Current architecture:** All styling uses CSS custom properties on component inline styles. Tailwind `dark:` utilities are NOT used. This means theming is controlled by redefining the CSS variables, not by adding `dark:` classes to every element.

**Option A (recommended — minimal refactor):**

Define light-mode values as defaults in `:root`, override with dark values in `:root.dark`:
```css
:root {
  --color-bg: #ffffff;
  --color-surface: #f8fafc;
  --color-border: #e2e8f0;
  --color-text-primary: #0f172a;
  /* ... all ~15 variables with light values */
}

:root.dark {
  --color-bg: #0f1117;
  --color-surface: #1a1d27;
  /* ... existing dark values */
}
```

Toggle: `document.documentElement.classList.toggle('dark', isDark)`.

**Persistence pattern (Tailwind official recommendation):**
```html
<!-- index.html <head> — prevents FOUC -->
<script>
  (function() {
    var theme = localStorage.getItem('theme');
    var dark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  })();
</script>
```

**React `useTheme` hook:**
```typescript
function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  return { theme, toggle: () => setTheme(t => t === 'dark' ? 'light' : 'dark') };
}
```

Toggle button placed in `PageHeader` (already the top-level header component).

---

## Competitor Feature Analysis

| Feature | Plannotator | open-plan-annotator | plan-reviewer (v0.3.0) |
|---------|-------------|---------------------|------------------------|
| Claude Code integration | Plugin marketplace | Plugin | Config hook (v0.1.0) |
| Opencode integration | `@plannotator/opencode` plugin | `open-plan-annotator@latest` plugin | Plugin (v0.3.0) |
| Codestral | Not mentioned | Not mentioned | Documented as N/A (model) |
| Annotation types | Delete, Replace, Comment, Insert | Same | Comment, Delete, Replace |
| Quick-action labels | 10 default + customizable up to 12 | Not documented | 6 predefined (v0.3.0) |
| Light/dark mode | Not documented | Not documented | Toggle + persist (v0.3.0) |
| Distribution | Bun runtime + npm | npm | Single static binary, `curl \| sh` |
| Install command | Manual `opencode.json` edit | Manual | `plan-reviewer install opencode` |

---

## Sources

| Source | Confidence | Used For |
|--------|------------|----------|
| https://opencode.ai/docs/plugins/ | HIGH | Opencode plugin format, hook events |
| https://opencode.ai/docs/config/ | HIGH | Config file path, plugin array format |
| https://github.com/anomalyco/opencode/issues/7006 | HIGH | `permission.asked` unimplemented — confirmed |
| https://github.com/anomalyco/opencode/issues/21293 | HIGH | stdin/stdout spawn unreliable — confirmed |
| https://github.com/backnotprop/plannotator/blob/main/apps/opencode-plugin/README.md | HIGH | Working opencode plugin pattern |
| https://github.com/ndom91/open-plan-annotator | HIGH | Second working opencode plugin reference |
| https://github.com/backnotprop/plannotator | HIGH | Quick Labels UX pattern, annotation types |
| https://tailwindcss.com/docs/dark-mode | HIGH | Tailwind v4 dark mode class strategy |
| https://github.com/mistralai/mistral-vibe | MEDIUM | Mistral's actual CLI coding agent — no plan hooks |
| https://docs.mistral.ai/mistral-vibe/introduction | MEDIUM | mistral-vibe config.toml, no external hooks |
| https://dev.to/jacobandrewsky/better-feedback-in-code-reviews-with-conventional-comments-2c3k | LOW | Annotation label design patterns |

---

*Feature research for: AI coding-agent plan reviewer (v0.3.0 — opencode/codestral integrations, annotation quick-actions, theme switching, user docs)*
*Researched: 2026-04-10*
