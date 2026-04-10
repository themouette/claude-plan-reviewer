# Pitfalls Research

**Domain:** Multi-tool AI coding agent hook manager (Rust binary + React+TS frontend)
**Researched:** 2026-04-10
**Confidence:** HIGH for existing system pitfalls, MEDIUM for opencode/codestral integration pitfalls (config formats still evolving), LOW for codestral as coding agent hook target

---

## Critical Pitfalls

### Pitfall 1: opencode Does Not Have an ExitPlanMode-Equivalent Hook

**What goes wrong:**
The integration.rs stubs label opencode as "unsupported" because "OpenCode does not have a plan approval hook in its config format." This assessment may have been correct at v0.1.0, but the opencode ecosystem is moving fast. Implementing the opencode integration by assuming it mirrors Claude Code's `ExitPlanMode` PermissionRequest pattern will produce a non-functional integration.

**Why it happens:**
OpenCode's hook mechanism is fundamentally different from Claude Code's. Claude Code uses a stdio JSON protocol: a hook binary receives a JSON payload on stdin and writes a structured JSON decision to stdout. OpenCode's hook system is plugin-based (TypeScript/JavaScript files in `.opencode/plugin/` or `~/.config/opencode/plugin/`), with event-driven hooks like `tool.execute.before`. The `permission.asked` hook exists in the SDK types but as of early 2026 is documented as not being triggered by the permission system (GitHub issue #7006). There is no direct equivalent to ExitPlanMode that accepts an external binary via a settings file key.

**How to avoid:**
Before implementing, verify the current opencode hook model against official docs at https://opencode.ai/docs/ and the changelog. The correct integration path for opencode (if it exists) is likely a plugin file, not a settings.json entry. Implement only after confirming the exact hook API, stdin/stdout contract, and whether blocking execution is possible. Flag opencode as "coming soon" with a link to the tracked issue rather than shipping a broken integration.

**Warning signs:**
- Implementing opencode install by mimicking `install_claude` and writing to `~/.config/opencode/opencode.json` without verifying the config schema
- Assuming the `supported: false` stub in integration.rs is just a placeholder that can be flipped to `true` without spec work
- The opencode `permission.asked` plugin hook being listed in types but never fired (confirmed bug as of early 2026)

**Phase to address:**
Integration research phase (before any opencode install/uninstall code is written). Flag as "needs spec validation" in the phase plan.

---

### Pitfall 2: Codestral Is a Model, Not a Coding Agent — No Hook Infrastructure Exists

**What goes wrong:**
The current integration.rs stub says: "Codestral is a model, not a coding agent with hook infrastructure. No settings file to configure." This is accurate. However, the v0.3.0 milestone lists "codestral integration — full hook wiring" as a target feature. If this is pursued without resolving what "codestral integration" actually means at the agent level, the feature ships as unreachable.

**Why it happens:**
Codestral is Mistral AI's code generation model. As a model, it has no agent runtime, no hooks, and no config file path. The agent using Codestral (e.g., Continue.dev, Cursor, a custom CLI) would need its own hook support. "Codestral integration" is likely shorthand for "integration with whatever agent runtime uses Codestral as its model," not integration with the model itself.

**How to avoid:**
Resolve the milestone ambiguity before coding: which agent runtime is meant? Mistral Code (the CLI agent, announced 2025)? Continue.dev configured to use Codestral? A generic "Mistral agent" integration? Each has a different config path and hook format. If no specific agent runtime is targeted, remove codestral from the milestone scope or rename it to accurately describe the target.

**Warning signs:**
- The phrase "codestral integration" in the milestone scope without specifying which agent runtime
- Writing `codestral_settings_path()` by analogy with `claude_settings_path()` without finding the actual path
- "codestral supported: true" flip in integration.rs without a corresponding config path + hook format discovered

**Phase to address:**
Pre-implementation definition phase. Resolve scope ambiguity before the integration phase begins.

---

### Pitfall 3: stdout Pollution Kills the Hook Protocol

**What goes wrong:**
The hook flow (default subcommand) writes exactly one thing to stdout: the JSON decision from `serde_json::to_writer(std::io::stdout(), &output)`. Any other write to stdout — a stray `println!`, a library that logs to stdout, or a debug build flag left on — causes Claude Code (and any future tool) to receive malformed JSON, silently breaking plan review. The hook caller sees the output as garbage and either errors out or applies a wrong decision.

**Why it happens:**
Rust's `println!` is stdout; `eprintln!` is stderr. The existing code is disciplined about this (install.rs/uninstall.rs use `println!` for status, hook flow uses `eprintln!` for diagnostics). The risk grows when adding new integration code that reuses patterns from install.rs in the hook path, or when a new dependency calls `println!` internally.

**How to avoid:**
The existing architecture is correct: only `serde_json::to_writer(stdout(), &output)` touches stdout in the hook path. Enforce this as a rule when adding new integration detection code: any "is this integration installed?" check called during the hook flow must use only `eprintln!` for diagnostics. Add an integration test that pipes the binary in hook mode and asserts `stdout` is valid JSON and `stdout.lines().count() == 1`.

**Warning signs:**
- New code in `run_hook_flow()` or `async_main()` calling `println!`
- A dependency added to `Cargo.toml` that prints to stdout on initialization
- install/uninstall helper functions being called (accidentally) from the hook path

**Phase to address:**
Hook flow phase; verified by test that asserts stdout is parseable JSON.

---

### Pitfall 4: Config Path Collision When Multiple Integrations Share a Config File

**What goes wrong:**
Claude Code uses `~/.claude/settings.json`. If opencode or any other agent also uses a config file at a path that plan-reviewer writes to, multiple integrations could corrupt each other's config on install/uninstall. More subtly: if two integrations use the same config key structure (e.g., both use a `hooks` key), the idempotency check for integration A might falsely pass for integration B.

**Why it happens:**
Each integration has its own config schema, but the code currently only implements Claude Code's schema. When opencode support is added, the developer may copy the `install_claude` pattern. If opencode uses a `hooks` key with a different sub-schema, the idempotency check (`claude_is_installed`) could be accidentally applied to the wrong config file, or the opencode idempotency check might match on a Claude-installed entry.

**How to avoid:**
Each integration must have its own:
- Config path function (e.g., `opencode_settings_path(home: &str) -> PathBuf`)
- Idempotency key (a unique marker that is specific to plan-reviewer and that integration)
- Install/uninstall functions that never touch other integrations' files

Never share idempotency logic across integrations. The `claude_is_installed` function checks for `"matcher": "ExitPlanMode"` — the opencode equivalent must check for a different, opencode-specific marker.

**Warning signs:**
- `is_installed` functions that take a generic `serde_json::Value` and apply the same check across integrations
- A single `settings_path(integration: &IntegrationSlug)` function that dispatches to different paths — correct approach, but only if each branch has integration-specific idempotency logic
- Uninstall removing entries from the wrong config file

**Phase to address:**
Integration install/uninstall phase; verified by unit tests for each integration's idempotency check.

---

### Pitfall 5: Config File Merging in opencode Breaks Naive Write Strategies

**What goes wrong:**
OpenCode merges multiple config files (global at `~/.config/opencode/opencode.json`, project-local at `./opencode.json`, plus env vars and XDG paths). Writing only to the global config may not produce the expected result if a project-level config overrides it. Conversely, writing to a project-level config installs the hook only for that project, not globally.

**Why it happens:**
Claude Code has a single global settings.json. OpenCode has a layered merge system. The naive approach of mimicking `install_claude` by writing to a single file will either install the hook only for one project (wrong) or miss that the hook is already installed via a higher-precedence layer (idempotency failure).

**How to avoid:**
Default to writing the global config file (`~/.config/opencode/opencode.json`) for the opencode integration, but document this limitation. Warn users if a project-level config exists that might override the hook. The idempotency check should read all config layers (or at minimum the global one) to determine if the hook is already active.

**Warning signs:**
- opencode install succeeds silently but the hook never fires because a project config overrides it
- install reports "already installed" when the hook is in a project config that was deleted
- An opencode `is_installed` check that reads only one config file layer

**Phase to address:**
opencode integration phase; verify with manual test that global install works for a project without a local opencode.json.

---

## Moderate Pitfalls

### Pitfall 6: FOUC (Flash of Unstyled Content) on Theme Load

**What goes wrong:**
The theme preference is stored in `localStorage`. On page load, React renders first with the default (dark) CSS variables, then reads localStorage and applies the light theme. This causes a visible flash — the page renders dark, then instantly switches to light. For a tool opened every time Claude Code creates a plan, this flicker is noticed immediately.

**Why it happens:**
The Vite + React setup renders the `<div id="root">` contents after JS hydration. If the theme toggle reads localStorage inside a React `useEffect` or `useState`, it runs after the first paint. The current `index.html` has no inline script in `<head>`, so there is no way to apply the theme class before first paint.

**How to avoid:**
Add a small inline `<script>` in `index.html`'s `<head>` (before any CSS or JS imports) that reads `localStorage.getItem('theme')` and sets `document.documentElement.classList.add('dark')` or `document.documentElement.setAttribute('data-theme', 'dark')`. This runs synchronously before any rendering, eliminating the flash. With Tailwind v4, the `@custom-variant dark` directive must reference the class or attribute the script sets.

**Warning signs:**
- Theme toggle implemented entirely inside React state with no `<head>` script
- The inline script is present but runs after `<script type="module" src="/src/main.tsx">` (wrong order)
- The chosen Tailwind `@custom-variant` selector doesn't match the attribute/class the inline script sets

**Phase to address:**
Theme switcher phase. Verify by loading the page with light theme stored and confirming no visible dark flash.

---

### Pitfall 7: highlight.js CSS Theme Mismatch After Theme Switch

**What goes wrong:**
The current frontend imports `highlight.js/styles/github-dark.css` statically at the top of `App.tsx`. When light mode is added, code blocks will continue to use dark syntax highlighting regardless of the selected theme. Users with light mode enabled will see dark code blocks on a light background — a jarring visual inconsistency.

**Why it happens:**
highlight.js does not bundle paired light/dark themes. Each theme is a separate CSS file. The current static import hardcodes dark mode. Switching themes at runtime requires either swapping the stylesheet link or bundling both themes and toggling via CSS media query or class selector.

**How to avoid:**
Import both `github-dark.css` and `github.css` and use CSS class or data-attribute scoping to activate only one at a time. Move both imports into `index.css` wrapped in the appropriate variant selectors so the Tailwind build handles the scoping. Keep both theme imports from applying simultaneously — last-import-wins without scoping produces broken colors.

**Warning signs:**
- `import 'highlight.js/styles/github-dark.css'` remains as a static top-level import with no light equivalent
- Light mode added to Tailwind but code blocks remain dark
- Both themes imported with no scoping — both apply simultaneously, last-import wins

**Phase to address:**
Theme switcher phase. Verify by toggling theme and checking code block colors match the selected mode.

---

### Pitfall 8: Annotation Type Exhaustiveness — Switch Statements Without Compile-Time Guarantees

**What goes wrong:**
The annotation type system uses a TypeScript union `type AnnotationType = 'comment' | 'delete' | 'replace'`. Multiple switch statements across `AnnotationSidebar.tsx`, `serializeAnnotations.ts`, `App.tsx`, and `types.ts` handle these cases. When new predefined action types are added (e.g., `'clarify' | 'needs-test' | 'out-of-scope'`), each switch must be updated. Missing one silently: `getTypeColor()` falls through to undefined, `getBadgeLabel()` returns undefined, `serializeAnnotations()` silently skips the new type.

**Why it happens:**
TypeScript's union type provides compile-time checking inside switch statements only when `noImplicitReturns` and `strict` are enabled and the switch has a proper default/exhaustive check. The current switches (in `getTypeColor`, `getBadgeLabel`, `getTypeBadgeBackground`, `typeLabel`) have no exhaustive check — they rely on all cases being covered manually.

**How to avoid:**
Add an exhaustive check helper: `function assertNever(x: never): never { throw new Error('Unhandled case: ' + x); }` and add a `default: return assertNever(type)` to each switch on `AnnotationType`. This turns a silent runtime bug into a compile-time error when a new type is added. Alternatively, move all type-specific metadata (color, label, background) into a lookup object keyed by `AnnotationType` so there is a single source of truth.

**Warning signs:**
- New type added to the union in `types.ts` but `serializeAnnotations.ts` compiles without error (means the switch is missing a default: assertNever guard)
- `getTypeColor` returns `undefined` for a new annotation type — the badge renders with no color
- `typeLabel` returns `undefined` in `serializeAnnotations` — the summary line reads `**undefined**: 1`

**Phase to address:**
Annotation type expansion phase. Add exhaustive check guards before adding any new annotation types.

---

### Pitfall 9: Predefined Action Types Must Serialize Meaningfully to the Hook Protocol

**What goes wrong:**
New predefined annotation types like `clarify this`, `needs test`, `search internet`, `out of scope` must produce meaningful text in the `deny` message sent to Claude Code (the `message` field in `HookOutput::deny()`). If a new type serializes as `[SEARCH_INTERNET] on: "some text"` with no further instruction, the AI receiving it may not know what action to take.

**Why it happens:**
The current types (`comment`, `delete`, `replace`) are action-oriented: they tell the AI what to do with the selected text. The new predefined types are more intent-oriented: they tell the AI *why* the reviewer flagged something, not what to do with it. The `serializeAnnotations` function (and its test suite) needs to produce readable, actionable text for these new types that the downstream AI can follow.

**How to avoid:**
Define the serialized text output for each new annotation type before implementing the UI. Each type needs: a human-readable label, a serialization template (what appears in the deny message), and a description of how the AI should respond. Write the serialization spec as a test in `serializeAnnotations.test.ts` before implementing it.

**Warning signs:**
- A new type added to `AnnotationType` union but `serializeAnnotations.test.ts` has no test for it
- The serialized output for `'search-internet'` type is just `[SEARCH_INTERNET] on: "selected text"` with no instruction
- `typeLabel` function not updated for the new type (produces `undefined` in summary)

**Phase to address:**
Annotation type expansion phase. Tests first, implementation second.

---

### Pitfall 10: Tailwind v4 `@custom-variant dark` Completely Replaces `prefers-color-scheme`

**What goes wrong:**
Adding `@custom-variant dark (&:where(.dark, .dark *));` to `index.css` disables the default `prefers-color-scheme: dark` media query behavior. Users who have OS-level dark mode set will no longer get automatic dark mode — they must explicitly set the preference in the UI. On first load (before any localStorage preference is set), the app defaults to whatever the CSS fallback is (likely light), ignoring the OS setting.

**Why it happens:**
Tailwind v4's `@custom-variant dark` completely overrides the default dark variant definition. The default variant uses `@media (prefers-color-scheme: dark)`. Overriding it with a class-only strategy removes the media query behavior entirely.

**How to avoid:**
Use a combined variant that respects both the class/data-attribute and the OS preference when no explicit preference is stored. The variant should: apply dark styles when `[data-theme='dark']` is set explicitly, and fall back to `@media (prefers-color-scheme: dark)` when no `data-theme` is present. The inline `<head>` script should not set `data-theme` when no localStorage value is found — leave the OS preference to take effect naturally.

**Warning signs:**
- After implementing the theme switcher, OS dark mode is ignored on first load
- Users who never opened the theme switcher see the wrong default theme
- `@custom-variant dark` definition uses class-only selector with no media query fallback

**Phase to address:**
Theme switcher phase. Verify by clearing localStorage and checking that OS dark mode preference is honored.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Flipping `supported: true` for opencode/codestral before spec is confirmed | Unblocks UI work | Ships a broken integration that errors on install | Never — keep `supported: false` until the config path and hook format are verified |
| Using `claude_is_installed` logic for opencode idempotency | Reuses existing code | False positives/negatives if config schemas overlap | Never — each integration needs its own idempotency key |
| Static `github-dark.css` import with a TODO comment for light mode | Fast to ship dark-only | Light mode PR forces a CSS refactor | Acceptable in v0.1.0 scope, not acceptable in v0.3.0 theme phase |
| AnnotationType switch without exhaustive guard | Works for current 3 types | Silent runtime failure when 4th type is added | Never for switch statements on a union type that will expand |
| Storing theme in localStorage without inline `<head>` script | Simple implementation | Visible FOUC on every page load for light-mode users | Never — the fix is 5 lines of inline JS |
| Writing opencode config to project-local `opencode.json` | Avoids global config mutation | Hook only works per-project, confuses users | Never — global install is the expected behavior |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| opencode install | Writing a `hooks.ExitPlanMode` key to `~/.config/opencode/opencode.json` by analogy with Claude Code | opencode uses a plugin file (TypeScript in `~/.config/opencode/plugin/`), not a config key; find the correct event hook and plugin path first |
| opencode idempotency | Checking if "the hook is installed" by reading the config JSON for a marker | The hook likely lives in a plugin file, not the main JSON config; idempotency check must look for the plugin file's existence and content |
| codestral | Treating it as an agent runtime with a settings.json | Codestral is a model; the correct target is an agent runtime that uses Codestral (Mistral Code CLI, Continue.dev, etc.) |
| highlight.js theme | Importing only `github-dark.css` and toggling the theme class | Must import both light and dark themes and use CSS scoping to activate only one at a time |
| Tailwind dark variant | Adding `@custom-variant dark (&:where(.dark, .dark *))` and calling it done | Must also handle the OS-preference fallback case for users without a stored preference |
| opencode config layers | Writing only to global config | Warn users if a project config might override the global hook registration |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Writing user-supplied strings into integration config files | Config injection — a malicious binary path could embed shell metacharacters | The binary path comes from `current_exe()`, not user input; validate it is an absolute path before writing |
| Reading `HOME` silently as empty string (WR-02 debt) | Hook wiring writes to relative path `.claude/settings.json` instead of absolute path, installing into cwd | Fix WR-02: hard-exit when `HOME` is empty, never fall back to empty string |
| opencode plugin file execution | A plugin file in `.opencode/plugin/` runs arbitrary JS — a malicious project config could redirect the hook | Document that the global plugin path should be used; warn users about project-level plugin overrides |
| Stdout write in hook path outside of the single `serde_json::to_writer` call | Any stray stdout write corrupts the hook protocol; could enable injection of fake JSON structures | Test harness that asserts stdout is exactly one valid JSON object |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Theme toggle that causes FOUC on every load | Jarring flash; makes the tool feel broken | Inline `<head>` script sets theme before first paint |
| New annotation types with no explanation in the UI | User clicks "out of scope" not knowing what it sends to Claude | Each predefined type should have a tooltip/description explaining what the AI receives |
| opencode install succeeds silently but hook never fires | User thinks integration is working; it is not | After install, print a verification hint pointing to the docs |
| Light theme breaking code block readability (dark hljs on light bg) | Code is unreadable; user blames the tool | Swap hljs theme atomically with the Tailwind dark variant |
| Predefined annotation types mixed in the floating affordance with structural types | Too many options (3 structural + 6 predefined = 9 buttons) cause decision paralysis | Separate structural types (comment/delete/replace) from predefined action tags in the UI |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **opencode install:** Flipping `supported: true` in integration.rs — verify the config path, hook format, and idempotency check are all implemented and tested
- [ ] **opencode install:** Install success message — verify the hook actually fires by running a test plan in opencode
- [ ] **codestral install:** Defined scope — verify which agent runtime is targeted before any code is written
- [ ] **Theme switcher:** Light/dark toggle works in dev — verify no FOUC on hard reload with light theme stored in localStorage
- [ ] **Theme switcher:** Tailwind dark classes apply — verify code blocks also switch highlight.js theme (not just Tailwind colors)
- [ ] **Theme switcher:** OS preference honored — verify fresh load (no localStorage) respects OS dark mode setting
- [ ] **Annotation new types:** New union member added — verify every switch in the codebase has an exhaustive check that fails at compile time
- [ ] **Annotation new types:** serializeAnnotations updated — verify new types produce readable, actionable text in the deny message
- [ ] **Annotation new types:** Test suite updated — verify `serializeAnnotations.test.ts` covers every new type
- [ ] **WR-01 (unwrap on malformed settings.json):** Now addressed for Claude — verify opencode config parsing also uses safe error handling (no `.unwrap()` on config reads)
- [ ] **WR-02 ($HOME empty string):** Fix applied — verify HOME empty causes hard exit, not silent empty-path writes, for ALL integrations not just Claude Code

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| opencode install wired to wrong config path | MEDIUM | Uninstall (removes wrong file entry), re-spec the correct path, reinstall |
| stdout pollution breaks Claude Code hook | HIGH | Every plan review session fails silently; requires a binary update + redistribution |
| Annotation exhaustiveness failure (new type returns undefined) | LOW | Add missing case to switch, rebuild frontend, rust-embed picks up new assets |
| FOUC on theme load | LOW | Add inline `<head>` script, rebuild frontend |
| highlight.js dark/light mismatch | LOW | Import both themes with correct scoping, rebuild frontend |
| opencode config merge issue (project overrides global) | MEDIUM | Document the limitation; add a warning to the install output |
| Codestral scope remains unresolved at end of milestone | LOW | Keep `supported: false`, update the stub's reason string, document in release notes |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| opencode has no ExitPlanMode equivalent (P1) | Integration spec phase (before coding) | Confirmed hook API documented; stub remains `supported: false` until spec complete |
| Codestral is a model not an agent (P2) | Milestone scope definition | Scope document identifies which agent runtime is targeted |
| stdout pollution kills hook protocol (P3) | Hook flow phase | Integration test: pipe binary in hook mode, assert stdout is valid single-line JSON |
| Config path collision across integrations (P4) | Integration install/uninstall phase | Unit tests: each integration's `is_installed` function tested with the other's config |
| opencode config merge breaks naive writes (P5) | opencode integration phase | Manual test: global install works for project without local opencode.json |
| FOUC on theme load (P6) | Theme switcher phase | Visual test: hard reload with light theme in localStorage, no dark flash |
| highlight.js CSS mismatch (P7) | Theme switcher phase | Visual test: toggle to light, verify code blocks use light hljs theme |
| Annotation exhaustiveness (P8) | Annotation type expansion phase | Compile-time: TypeScript error when adding type without updating all switches |
| Annotation serialization for action types (P9) | Annotation type expansion phase | Test: `serializeAnnotations.test.ts` covers every new type with expected output |
| Tailwind v4 dark variant removes OS preference (P10) | Theme switcher phase | Test: clear localStorage, verify OS dark mode preference honored |

---

## Sources

- opencode config format: https://opencode.ai/docs/config/ — global path `~/.config/opencode/opencode.json`, JSONC format, multi-layer merge
- opencode plugin hook system: https://opencode.ai/docs/plugins/ — TypeScript plugin files, `tool.execute.before` / `tool.execute.after` hooks
- `permission.ask` hook not triggered (known bug as of early 2026): https://github.com/sst/opencode/issues/7006
- opencode hooks support issue (shows plugin model, not CLI hooks): https://github.com/sst/opencode/issues/1473
- opencode tool.execute.before subagent bypass (security limitation): https://github.com/sst/opencode/issues/5894
- Tailwind CSS v4 dark mode: https://tailwindcss.com/docs/dark-mode — `@custom-variant` replaces v3 `darkMode: 'class'` config
- Tailwind v4 dark mode conflict with prefers-color-scheme: https://github.com/tailwindlabs/tailwindcss/discussions/17810
- highlight.js theme switching (maintainers declined auto-pairing): https://github.com/highlightjs/highlight.js/issues/3652
- FOUC prevention with Vite + React Tailwind v4: https://medium.com/@balpetekserhat/how-i-fixed-tailwind-css-v4-dark-mode-not-working-in-a-vite-react-project-d7f0b3a31184
- Current hook.rs / install.rs / uninstall.rs / integration.rs / types.ts / serializeAnnotations.ts: examined directly from codebase (v0.1.0)
- Known tech debt items WR-01–WR-04: .planning/PROJECT.md

---
*Pitfalls research for: Multi-tool AI coding agent hook manager (opencode/codestral integrations, annotation types, theme switching)*
*Researched: 2026-04-10*
