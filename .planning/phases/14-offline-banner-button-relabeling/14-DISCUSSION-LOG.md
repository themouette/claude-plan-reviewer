# Phase 14: Offline Banner & Button Relabeling - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 14-Offline Banner & Button Relabeling
**Areas discussed:** Button strategy, Banner copy + visual style, Deny-message access, Banner visibility across app states

---

## Button Strategy (single vs paired)

| Option | Description | Selected |
|--------|-------------|----------|
| Single 'Copy to clipboard' button | Approve and Deny disappear; one button replaces them. User intent inferred from deny-textarea content. Matches OFX-02's literal wording. | |
| Two relabeled buttons | Approve becomes 'Copy approval', Deny becomes 'Copy denial'. Both visible. Matches ROADMAP success criterion 3 ("submit buttons are relabeled" — plural). | ✓ |
| Single button + intent toggle | One button + a small Approve/Deny toggle nearby. | |

**User's choice:** Two relabeled buttons.
**Notes:** Resolves the OFX-02 vs ROADMAP wording conflict in favor of ROADMAP. Avoids the UX puzzle of inferring intent from textarea contents.

---

## Exact Button Labels (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| 'Copy approval' / 'Copy denial' | Differentiated short labels. Slight deviation from spec's literal 'Copy to clipboard' string. | |
| 'Copy to clipboard' on both | Spec text byte-for-byte; ambiguous, relies on color to differentiate. | |
| 'Copy to clipboard — approve' / 'Copy to clipboard — deny' | Spec text literally present, plus an em-dash suffix to disambiguate. | ✓ |

**User's choice:** `Copy to clipboard — approve` / `Copy to clipboard — deny`.
**Notes:** Inner Submit Denial button stays simply `Copy to clipboard` (decided in the deny-flow question below).

---

## Banner Copy

| Option | Description | Selected |
|--------|-------------|----------|
| 'Server connection lost — working offline' | One-line, factual, terse. Matches ROADMAP "or equivalent" wording. | |
| Two-line: status + what-happens-next | Top: server-lost message. Bottom: 'When you're done, copy your decision to the clipboard and paste it back into Claude.' | ✓ |
| Reassuring framing | 'Working offline — your annotations are safe. Submit will copy your decision to the clipboard.' | |

**User's choice:** Two-line: status + what-happens-next.
**Notes:** Adds explicit instruction so users know what the relabeled button is going to do.

---

## Banner Visual Style

| Option | Description | Selected |
|--------|-------------|----------|
| Solid amber bar, no icon, full-width | Flat aesthetic, matches the rest of the app. Sits flush below header. | ✓ |
| Amber bar with warning icon (⚠) | Same with a small warning glyph at the start. | |
| Amber border + tinted background | Lighter amber tint with a 4px darker amber left border (callout style). | |

**User's choice:** Solid amber bar, no icon, full-width.
**Notes:** Stays consistent with the app's flat, no-iconography style.

---

## Banner ARIA + Theme Tokens

| Option | Description | Selected |
|--------|-------------|----------|
| role="status" + new --color-banner-* CSS vars | Polite live region; `--color-banner-bg` / `--color-banner-text` added to `:root` and `[data-theme="light"]` in index.css; amber-500 dark / amber-600 light for AA contrast. | ✓ |
| role="alert" + same CSS vars | Assertive live region (interrupts); same theme handling. | |
| No ARIA + inline color literals | No accessibility role; inline hex values; minimal scope but skips screen-reader users and breaks design-token convention. | |

**User's choice:** role="status" + new --color-banner-* CSS vars.

---

## Deny-Message Access (deny flow when offline)

| Option | Description | Selected |
|--------|-------------|----------|
| Outer relabels, inner relabels too | Outer Deny becomes 'Copy to clipboard — deny' (still a toggle); inner Submit Denial becomes 'Copy to clipboard'. Same two-step shape as today. | ✓ |
| Outer relabels, form auto-opens offline | Deny form is always open when offline; one-click copy from the relabeled button. | |
| Outer relabels only, inner keeps 'Submit Denial' | Inconsistent labels; outer relabels, inner does not. | |

**User's choice:** Outer relabels, inner relabels too.
**Notes:** Preserves today's interaction flow exactly — only the visible text changes. Lowest risk.

---

## Banner Visibility Across App States

| Option | Description | Selected |
|--------|-------------|----------|
| Always when offline | Banner shows whenever useHeartbeat returns 'offline', regardless of appState. Sits above LoadingSpinner / ErrorView / review columns / ConfirmationView. | ✓ |
| Only during 'reviewing' | Banner only when appState === 'reviewing'. Server dies during initial load → ErrorView with no banner. | |
| Reviewing + confirmed only | Banner shows during reviewing and confirmed; hides during loading/error. | |

**User's choice:** Always when offline.
**Notes:** Simplest mental model. Banner and ErrorView can coexist if both conditions are true — they answer different questions (load failed vs ping failed).

---

## Claude's Discretion

- Exact font-size, padding, line-height of the banner — match existing 16px body / 14px secondary scale.
- Whether the banner uses `position: sticky` vs normal flow — likely normal flow since `<PageHeader>` already handles sticky-top.
- Test approach: pure-helper unit test (preferred — aligns with no-`@testing-library/react` policy) vs component-level test.
- Whether to factor the label-selection logic into a helper or inline ternaries at the call sites.

## Deferred Ideas

- **CLB-01 / CLB-02** — clipboard submit logic + "Copied to clipboard — paste into Claude" confirmation screen → Phase 15.
- **OFX-03** — textarea fallback when `navigator.clipboard` is blocked → deferred per REQUIREMENTS.md line 112.
- **OFX-04** — "back online" toast / graceful online recovery UX polish → deferred per REQUIREMENTS.md line 113.
- **Animation / transitions** on banner appearance and label flips — not asked for; ship without animation.
- **Server-supplied banner copy via `/api/config`** — not requested; copy is hard-coded.
- **Per-integration banner text** (claude vs gemini vs opencode) — out of scope; v0.5.0 only ships the Claude Code annotate offline path.
