# Phase 2: Annotations & Diff - Research

**Researched:** 2026-04-09
**Domain:** React text selection, diff rendering (@pierre/diffs), git2 Rust crate, annotation serialization
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Two-column layout: plan content on the left, annotations sidebar on the right. No split pane for plan+diff (those use tabs — see D-05).
- **D-02:** To annotate: user selects text in the plan → a "+" button / "Add annotation" affordance appears in the sidebar for that selection → a type picker appears (Comment / Delete / Replace) → then the relevant form (textarea for Comment, replacement textarea for Replace, auto-save for Delete).
- **D-03:** Annotations listed in positional order (top-to-bottom as their anchor text appears in the plan). Hovering an annotation highlights the anchored text in the plan.
- **D-04:** Global comment (ANN-04 — not anchored to specific text) is a dedicated "Overall Comment" field pinned at the **top** of the sidebar, always visible, no text selection required.
- **D-05:** Tab bar in the header: **Plan** (default, active on load) | **Diff**. Tab switching is pure React state — no router, no URL change.
- **D-06:** If no working-tree diff is available (clean working directory, not a git repo, or git2 error), the Diff tab shows a clear empty-state message. No crash, no hidden tab.
- **D-07:** Use `@pierre/diffs` (https://diffs.com/) for diff display.
- **D-08:** Structured sections format for deny message (see CONTEXT.md for exact format).
- **D-09:** The deny textarea is **optional** when annotations exist. Textarea remains required when zero annotations exist.

### Claude's Discretion
- Exact sidebar width and visual split ratio
- Annotation card styling (highlight color for anchored text, card border, etc.)
- How "Add annotation" affordance appears
- Error handling for git2 failures beyond "no diff available"
- Exact wording of empty-state messages in Diff tab

### Deferred Ideas (OUT OF SCOPE)
- Approve-with-comments (attach notes to an approval) — v2, UX-02
- Line-level diff annotations — explicitly Out of Scope in REQUIREMENTS.md
- Annotation persistence across sessions — Out of Scope (in-memory per session only)
- Countdown timer in review UI — v2, UX-01
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANN-01 | User can add a comment annotation (select text → attach note) | Text selection via `document.getSelection()` + `selectionchange` event; annotation stored as `{ anchorText, startOffset, endOffset }` |
| ANN-02 | User can add a delete annotation (mark plan text for removal) | Same selection mechanism; Delete type creates annotation card with no textarea |
| ANN-03 | User can add a replace annotation (select text → provide replacement) | Same selection mechanism; Replace type adds second textarea for replacement text |
| ANN-04 | User can add a global comment (overall note not anchored to specific text) | Dedicated Overall Comment field pinned at top of sidebar; no text selection required |
| ANN-05 | Annotations are serialized as structured markdown in the deny `message` field | Client-side serialization before `POST /api/decide`; format defined in D-08/D-09 |
| DIFF-01 | Binary reads the git diff of the working tree from the `cwd` field in hook stdin | `HookInput.cwd` already parsed; `git2::Repository::open(cwd)?.diff_index_to_workdir()` then `.print(DiffFormat::Patch, ...)` produces unified text |
| DIFF-02 | Diff is displayed alongside the plan in the review UI | Tab bar (D-05); new `GET /api/diff` route; `AppState.diff_content` field; `PatchDiff` React component |
| DIFF-03 | Diff view supports unified format with syntax highlighting | `@pierre/diffs` `PatchDiff` component accepts raw unified diff string via `patch` prop; renders with Shiki syntax highlighting |
</phase_requirements>

---

## Summary

Phase 2 adds two orthogonal capabilities to the existing Phase 1 binary: (1) a text annotation system where users can select plan text and attach structured feedback, and (2) a git diff view. Both are added to the React frontend with minimal Rust changes.

The Rust side requires one new dependency (`git2` with `vendored` feature) and two changes: adding `diff_content: String` to `AppState` and a new `GET /api/diff` route. The `HookInput.cwd` field is already parsed in `hook.rs`. The git2 `diff_index_to_workdir` + `Diff::print(DiffFormat::Patch, ...)` produces standard unified diff text that `@pierre/diffs` `PatchDiff` consumes directly.

The React side requires: a layout refactor (remove 900px `maxWidth`, add two-column flex), a `TabBar` component, an `AnnotationSidebar` with `OverallCommentField` + `AnnotationCard` components, text selection tracking via the `selectionchange` DOM event, `<mark>` element injection for anchor highlighting, and a `DiffView` wrapping `@pierre/diffs` `PatchDiff`. Annotation serialization happens entirely client-side before `POST /api/decide`.

**Primary recommendation:** Start with the Rust changes (git2 diff extraction + API route), then tackle the React layout refactor, sidebar, and finally the `@pierre/diffs` integration.

---

## Standard Stack

### Core (Phase 2 additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| git2 | 0.20.4 | Extract working-tree git diff as unified text | Safe libgit2 bindings; `vendored` feature avoids system lib dependency; stable diff API |
| @pierre/diffs | 1.1.12 | Unified diff rendering with syntax highlighting | User decision D-07; ships `PatchDiff` React component accepting raw unified diff string; Shiki-based syntax highlighting |

[VERIFIED: crates.io registry — git2 0.20.4 published 2026-02-02]
[VERIFIED: npm registry — @pierre/diffs 1.1.12 published 3 days ago (2026-04-06), Apache-2.0]

### Existing stack unchanged

| Library | Version | Purpose |
|---------|---------|---------|
| React | ^19.2.4 | UI framework (Phase 1) |
| axum | 0.8 | HTTP server (Phase 1) |
| rust-embed / axum-embed | 8 / 0.1 | Embedded SPA assets (Phase 1) |
| serde / serde_json | 1 | JSON I/O (Phase 1) |
| comrak | 0.52 | Markdown to HTML (Phase 1) |

### Installation

**Rust (add to Cargo.toml):**
```toml
git2 = { version = "0.20", features = ["vendored"] }
```

**Frontend:**
```bash
cd ui && npm install @pierre/diffs
```

**Version verification:**
```bash
# npm:
npm view @pierre/diffs version   # → 1.1.12
# crates.io:
cargo search git2 | head -3      # → git2 = "0.20.4"
```

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
src/
├── hook.rs         # Unchanged — HookInput.cwd already present
├── render.rs       # Unchanged — diff is raw text, not rendered server-side
├── server.rs       # Modified: AppState + diff_content, GET /api/diff route
└── main.rs         # Modified: extract diff before starting server

ui/src/
├── App.tsx         # Modified: two-column layout, tab state, annotation state
├── components/     # New directory
│   ├── TabBar.tsx
│   ├── AnnotationSidebar.tsx
│   ├── AnnotationCard.tsx
│   ├── OverallCommentField.tsx
│   ├── AddAnnotationAffordance.tsx
│   └── DiffView.tsx
├── hooks/          # New directory
│   └── useTextSelection.ts   # selectionchange listener logic
├── types.ts        # New: Annotation type, Tab type
└── utils/
    └── serializeAnnotations.ts  # deny message serialization
```

### Pattern 1: Git Diff Extraction (Rust)

**What:** Extract working-tree diff from `HookInput.cwd` using git2 and store as a raw unified diff string in `AppState`.

**When to use:** Before starting the HTTP server in `main.rs`.

**How it works:**

`diff_index_to_workdir` compares the index (staging area) against the working directory — i.e., it shows **unstaged changes**. For a tool whose audience is developers looking at "what changed since my last commit", `diff_tree_to_workdir_with_index` is more useful: it takes the HEAD tree and compares against the working directory, capturing both staged and unstaged changes as one unified view.

However, `diff_tree_to_workdir_with_index` requires a HEAD commit to exist. On empty repos (no commits), this call will fail. The implementation should:
1. Try `diff_tree_to_workdir_with_index` with HEAD tree
2. Fall back to `diff_index_to_workdir` if no HEAD exists
3. Fall back to empty string on any error (non-git dir, permissions, etc.)

**Example:**
```rust
// Source: git2 0.20.4 docs — docs.rs/git2/0.20.4
fn extract_diff(cwd: &str) -> String {
    let repo = match git2::Repository::open(cwd) {
        Ok(r) => r,
        Err(_) => return String::new(),
    };

    // Prefer full working-tree diff vs HEAD (staged + unstaged)
    let diff = if let Ok(head) = repo.head() {
        if let Ok(commit) = head.peel_to_commit() {
            if let Ok(tree) = commit.tree() {
                repo.diff_tree_to_workdir_with_index(
                    &tree,
                    None,
                ).ok()
            } else { None }
        } else { None }
    } else { None };

    // Fallback: unstaged changes only (index vs workdir)
    let diff = diff.or_else(|| repo.diff_index_to_workdir(None, None).ok());

    let diff = match diff {
        Some(d) => d,
        None => return String::new(),
    };

    let mut output = String::new();
    let _ = diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        use git2::DiffLineType::*;
        let prefix = match line.origin_value() {
            Addition => '+',
            Deletion => '-',
            Context => ' ',
            _ => ' ',
        };
        if let Ok(s) = std::str::from_utf8(line.content()) {
            // For header lines (FileHeader, HunkHeader), origin_value() is not +/-/ 
            // git2 gives us the header lines already correctly formatted
            match line.origin_value() {
                FileHeader | HunkHeader | Binary => {
                    output.push_str(s);
                }
                _ => {
                    output.push(prefix);
                    output.push_str(s);
                }
            }
        }
        true
    });

    output
}
```

[CITED: docs.rs/git2/0.20.4/git2/struct.Repository.html — `diff_tree_to_workdir_with_index`, `diff_index_to_workdir`]
[CITED: docs.rs/git2/0.20.4/git2/enum.DiffFormat.html — `DiffFormat::Patch` produces "full git diff" unified format]

**Note on `diff.print()` line origin:** The `Diff::print` callback receives a `DiffLine`. For header and hunk-header lines, `origin_value()` returns `FileHeader`, `HunkHeader`, or `Binary`. For content lines it returns `Addition`, `Deletion`, or `Context`. The prefix character (`+`, `-`, ` `) must be prepended manually for content lines; header lines are already properly formatted by git2.

[ASSUMED: The exact match on `origin_value()` variants — verify against git2 DiffLineType enum at docs.rs if the pattern above produces malformed output.]

### Pattern 2: AppState Extension (Rust)

**What:** Add `diff_content: String` to `AppState`, pass from `main.rs` through `start_server()`.

**When to use:** Straightforward struct field addition.

```rust
// src/server.rs
pub struct AppState {
    pub plan_html: String,
    pub diff_content: String,  // raw unified diff text, empty if unavailable
    pub decision_tx: Mutex<Option<oneshot::Sender<Decision>>>,
}

// New route handler
async fn get_diff(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::json!({ "diff": state.diff_content }))
}

// Updated start_server signature
pub async fn start_server(
    plan_html: String,
    diff_content: String,
) -> Result<(u16, oneshot::Receiver<Decision>), Box<dyn std::error::Error + Send + Sync>>
```

[VERIFIED: existing AppState pattern in src/server.rs — `Arc<AppState>` with `Mutex`-wrapped channel]

### Pattern 3: PatchDiff React Component

**What:** `@pierre/diffs` exports a `PatchDiff` React component from `@pierre/diffs/react` that accepts a raw unified diff string and renders it with Shiki syntax highlighting.

**Key facts verified from package inspection:**
- Import path: `import { PatchDiff } from '@pierre/diffs/react'`
- Required prop: `patch: string` (raw unified diff text, e.g., the output of `git diff`)
- Optional prop: `disableWorkerPool?: boolean` — set to `true` to avoid Web Worker creation (no `WorkerPoolContextProvider` wrapper needed; rendering happens on the main thread)
- Optional prop: `options?: FileDiffOptions` — includes `theme`, `disableLineNumbers`, `disableFileHeader`, etc.
- Theme: `'pierre-dark'` is a built-in Shiki theme that works without additional setup
- The component renders a `<diffs-container>` custom element using Shadow DOM internally — CSS custom properties from the outer document do NOT penetrate the Shadow DOM (the UI-SPEC acknowledges this: "do not attempt to style internals via global CSS")
- The custom element (`diffs-container`) is auto-registered when `FileDiff.js` is imported (imports `web-components.js` which calls `customElements.define` on load)

**Example:**
```tsx
// Source: @pierre/diffs 1.1.12 package inspection — dist/react/PatchDiff.d.ts
import { PatchDiff } from '@pierre/diffs/react'

function DiffView({ diff }: { diff: string }) {
  if (!diff) {
    return <DiffEmptyState />
  }
  return (
    <div style={{ width: '100%', overflowX: 'auto', background: 'var(--color-code-bg)', borderRadius: '8px' }}>
      <PatchDiff
        patch={diff}
        disableWorkerPool={true}
        options={{ theme: 'pierre-dark' }}
      />
    </div>
  )
}
```

[VERIFIED: npm registry + package inspection — PatchDiff.d.ts, WorkerPoolContext.js, constants.js, web-components.js]

### Pattern 4: Text Selection Tracking (React)

**What:** Listen to the `selectionchange` event on `document` to detect when user has selected text inside the `.plan-prose` container. Store the selection as `{ anchorText: string }` — the selected text string is the anchor identifier.

**Key browser API facts:**
- `document.addEventListener('selectionchange', handler)` — fires whenever selection changes
- `document.getSelection()` — returns a `Selection` object
- `selection.toString()` — gives the selected text as a string
- `selection.isCollapsed` — `true` when no text is selected (caret only)
- `selection.anchorNode` — the DOM node where selection starts
- `selection.getRangeAt(0).startContainer` — useful for checking if selection is within `.plan-prose`

**Pitfall: selectionchange fires on every cursor movement.** Guard the handler to only activate when `selection.toString().trim().length > 0` and the selection is contained within the plan content area.

**Pitfall: selection is lost on button click.** When the user clicks an annotation type button, `mousedown` on the button triggers a new `selectionchange` event clearing the selection before `click` fires. Prevent this by calling `e.preventDefault()` on the `mousedown` event of the type pills.

**Pitfall: selections crossing HTML element boundaries.** `selection.toString()` always returns the plain text of the selected region regardless of DOM structure. Use this string as `anchorText`. Do not attempt to track byte offsets into the HTML — track against the rendered text content.

**Example:**
```tsx
// Source: MDN Web Docs — Selection API (standard browser API, no verification needed)
function useTextSelection(planRef: React.RefObject<HTMLDivElement>) {
  const [selectedText, setSelectedText] = useState<string>('')

  useEffect(() => {
    const handler = () => {
      const selection = document.getSelection()
      if (!selection || selection.isCollapsed) {
        setSelectedText('')
        return
      }
      // Guard: check selection is within the plan content
      const range = selection.getRangeAt(0)
      if (!planRef.current?.contains(range.commonAncestorContainer)) {
        setSelectedText('')
        return
      }
      const text = selection.toString().trim()
      setSelectedText(text)
    }

    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [planRef])

  return selectedText
}
```

[ASSUMED: The `planRef.current?.contains(range.commonAncestorContainer)` guard works correctly when the selection spans multiple DOM nodes within the plan div. This is standard browser behavior but not verified in a running browser for this specific HTML structure.]

### Pattern 5: Anchor Highlight via `<mark>` Elements

**What:** When a user hovers an annotation card, the corresponding anchor text in the plan HTML should be highlighted. The plan HTML is rendered via `dangerouslySetInnerHTML`.

**Approach:** After injecting the plan HTML, use the DOM to find text nodes containing the anchor text and wrap them with `<mark>` elements with `class="annotation-highlighted"` and `aria-label="Annotated text"`. On hover-out, unwrap them.

**Pitfall: Finding text in rendered HTML.** A simple `innerHTML.indexOf(anchorText)` won't work because the anchor text may span multiple elements (e.g., `<strong>` inside a list item). Use a `TreeWalker` to iterate text nodes:

```typescript
// Source: MDN TreeWalker API (standard browser API)
function findAndWrapText(container: HTMLElement, text: string): HTMLElement[] {
  const marks: HTMLElement[] = []
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    const idx = node.textContent?.indexOf(text) ?? -1
    if (idx >= 0) {
      const range = document.createRange()
      range.setStart(node, idx)
      range.setEnd(node, idx + text.length)
      const mark = document.createElement('mark')
      mark.className = 'annotation-highlighted'
      mark.setAttribute('aria-label', 'Annotated text')
      range.surroundContents(mark)
      marks.push(mark)
      break  // highlight first occurrence only
    }
  }
  return marks
}
```

**Pitfall: `surroundContents` throws if the range crosses element boundaries.** Anchor text selected by the user may span a DOM element boundary (e.g., bold text at the start of a paragraph). Guard with try/catch. If `surroundContents` fails, skip highlighting for that annotation — it does not affect functionality, only the hover-highlight UX.

[ASSUMED: Single-occurrence anchor text is sufficient for v1. If the same text appears multiple times in the plan, only the first occurrence is highlighted.]

### Pattern 6: Annotation Serialization

**What:** Before `POST /api/decide`, construct the structured deny message string client-side.

**Logic (from D-08 / D-09):**

```typescript
// Source: CONTEXT.md D-08/D-09
function serializeAnnotations(
  denyText: string,
  overallComment: string,
  annotations: Annotation[]
): string {
  const parts: string[] = []

  if (denyText.trim()) parts.push(denyText.trim())

  if (overallComment.trim()) {
    parts.push(`## Overall Comment\n${overallComment.trim()}`)
  }

  const anchored = annotations.filter(a => !a.removed)
  if (anchored.length > 0) {
    const annParts = anchored.map(a => {
      if (a.type === 'comment') {
        return `### Comment on: "${a.anchorText}"\n${a.comment}`
      } else if (a.type === 'delete') {
        return `### Delete: "${a.anchorText}"`
      } else {
        return `### Replace: "${a.anchorText}"\nWith: ${a.replacement}`
      }
    })
    parts.push(`## Annotations\n\n${annParts.join('\n\n')}`)
  }

  return parts.join('\n\n')
}
```

**When textarea is required:** `denyMessageValid = denyMessage.trim().length > 0 || annotations.length > 0`. If false, "Submit Denial" button is disabled (existing Phase 1 opacity/pointerEvents pattern).

[VERIFIED: CONTEXT.md D-08/D-09 and UI-SPEC.md Annotation Serialization Contract section]

### Anti-Patterns to Avoid

- **Using a router for tab switching:** D-05 locks this as pure `useState<'plan' | 'diff'>`. Do not add `react-router`.
- **Server-side diff rendering:** Do NOT run the diff through `comrak` or `ammonia`. The `PatchDiff` component expects raw unified diff text, not HTML.
- **Using `innerHTML` for anchor search:** Will miss text that spans element boundaries. Use `TreeWalker` instead.
- **Wrapping `WorkerPoolContextProvider`:** Not needed since `disableWorkerPool={true}` is used. Adding the provider unnecessarily pulls in worker initialization code.
- **Using `git diff` subprocess:** Fragile; PATH-dependent; the `git2` crate is vendored and self-contained.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Diff rendering with syntax highlighting | Custom diff renderer | `@pierre/diffs` `PatchDiff` | Shiki-based; handles multi-file patches, hunk separators, line numbers; Shadow DOM isolation |
| Git diff extraction | Shell out to `git diff` | `git2` with `vendored` feature | Avoids PATH dependency; handles edge cases (empty repo, submodules, binary files); consistent across platforms |

**Key insight:** Diff rendering with correct syntax highlighting is deceptively complex — language detection, hunk parsing, line numbering, binary file handling. `@pierre/diffs` encapsulates all of this.

---

## Common Pitfalls

### Pitfall 1: `selectionchange` Fired by Button Mousedown

**What goes wrong:** When the user clicks an annotation type pill, `mousedown` on the button clears the text selection before the `click` handler fires. The annotation handler reads an empty selection.

**Why it happens:** Browser clears selection on any `mousedown` outside a text node.

**How to avoid:** Add `onMouseDown={(e) => e.preventDefault()}` to the annotation type pills. This prevents the browser from clearing the selection while still allowing the `click` event to fire.

**Warning signs:** Annotation cards are created with empty `anchorText`.

### Pitfall 2: `diff_tree_to_workdir_with_index` on Empty Repository

**What goes wrong:** The function requires a HEAD commit. On a freshly initialized git repository with no commits, `repo.head()` returns an error. The diff extraction panics or crashes.

**Why it happens:** No HEAD reference exists until the first commit.

**How to avoid:** Wrap the HEAD-based diff path in `if let Ok(head) = repo.head()` and fall back to `diff_index_to_workdir(None, None)`. If both fail, return empty string. Never unwrap or `?` on git2 calls in the diff extraction function.

**Warning signs:** The binary crashes when invoked from a freshly initialized (empty) git repository.

### Pitfall 3: `surroundContents` Throws for Cross-Element Selections

**What goes wrong:** `Range.surroundContents()` throws `HierarchyRequestError` if the selected range partially contains an element (e.g., user selects from the middle of a `<strong>` tag to the next paragraph).

**Why it happens:** `surroundContents` requires the range to be "well-nested" — cannot partially overlap an element boundary.

**How to avoid:** Wrap in try/catch. On error, skip the highlight but keep the annotation. The annotation is still serialized correctly even without visual highlight.

**Warning signs:** Console errors on hover for certain annotations; hover highlight does not appear.

### Pitfall 4: `@pierre/diffs` Shadow DOM CSS Isolation

**What goes wrong:** Styles applied via `index.css` or inline styles on the wrapper do not affect the diff rendering inside the Shadow DOM. The diff may render with wrong background color or font.

**Why it happens:** Shadow DOM is a hard CSS boundary — global styles do not penetrate.

**How to avoid:** Use the `options.theme` prop to control appearance. Use `'pierre-dark'` theme which has a dark background matching the app's dark palette. Do not attempt to patch internals. Wrap the component in a `<div>` with `background: var(--color-code-bg)` to ensure the area around the diff matches.

**Warning signs:** Diff renders with white background inside the dark app.

### Pitfall 5: `@pierre/diffs` Bundle Size

**What goes wrong:** `@pierre/diffs` bundles Shiki (a comprehensive syntax highlighter with language grammars). The unzipped dist directory is 6.3 MB. This will significantly increase the Vite build output.

**Why it happens:** Shiki includes language grammars as JSON. `@pierre/diffs` does not tree-shake these aggressively.

**How to avoid:** The package is a user-locked choice (D-07). Accept the bundle size. Users download the binary once; the assets are embedded. Not a runtime performance issue for a local tool — initial load time may increase but the tool is used interactively.

**Warning signs:** `ui/dist/` grows to 5-10 MB instead of <500 KB. This is expected.

### Pitfall 6: `deny` Button State When Annotations Exist

**What goes wrong:** In Phase 1, `denyMessageValid = denyMessage.trim().length > 0`. With D-09, when annotations exist, the deny message textarea becomes optional — the Submit Denial button must be enabled even when the textarea is empty.

**Why it happens:** Phase 1 logic only checks textarea content, not annotation presence.

**How to avoid:** Update the validation: `denyMessageValid = denyMessage.trim().length > 0 || annotations.length > 0`.

**Warning signs:** User adds 3 annotations, clicks Deny, opens deny form — but Submit Denial button remains disabled even though annotations are present.

### Pitfall 7: Tab Bar in Header Breaks `Enter` Shortcut

**What goes wrong:** The `Enter` key handler in Phase 1 uses `document.activeElement?.tagName === 'TEXTAREA'` to suppress approval when a textarea is focused. With the sidebar now containing textareas for annotation text, the `Enter` key may not approve from the sidebar.

**Why it happens:** The existing guard only checks `TEXTAREA` tag, which already covers annotation textareas. But keyboard focus might be in a sidebar button.

**How to avoid:** The existing guard (`if activeElement.tagName === 'TEXTAREA'`) already handles this. Additionally suppress Enter when `denyOpen` is true. The UI-SPEC accessibility contract adds: "Keyboard shortcut: Enter to approve is suppressed when focus is inside the annotation sidebar" — extend the guard to check `sidebarRef.current?.contains(document.activeElement)`.

---

## Code Examples

### GET /api/diff Axum Route

```rust
// Source: existing pattern from src/server.rs get_plan handler
async fn get_diff(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::json!({ "diff": state.diff_content }))
}

// In router setup:
let app = Router::new()
    .route("/api/plan", get(get_plan))
    .route("/api/diff", get(get_diff))
    .route("/api/decide", post(post_decide))
    .fallback_service(spa)
    .with_state(state);
```

[VERIFIED: existing get_plan pattern in src/server.rs]

### Annotation Type Definition (TypeScript)

```typescript
// Source: CONTEXT.md D-02/D-08 + UI-SPEC.md component inventory
type AnnotationType = 'comment' | 'delete' | 'replace'

interface Annotation {
  id: string           // crypto.randomUUID() or Date.now().toString()
  type: AnnotationType
  anchorText: string   // selected text used as identifier
  comment?: string     // for type='comment'
  replacement?: string // for type='replace'
}
```

### Fetching Diff in React

```tsx
// Source: existing fetch pattern from App.tsx (plan fetch)
const [diff, setDiff] = useState<string>('')

useEffect(() => {
  fetch('/api/diff')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })
    .then((data: { diff: string }) => setDiff(data.diff))
    .catch(() => setDiff(''))  // empty string triggers empty state
}, [])
```

### PatchDiff Usage

```tsx
// Source: @pierre/diffs 1.1.12 dist/react/PatchDiff.d.ts
import { PatchDiff } from '@pierre/diffs/react'

// Minimal usage for this project:
<PatchDiff
  patch={diff}
  disableWorkerPool={true}
  options={{
    theme: 'pierre-dark',
    disableFileHeader: false,
  }}
/>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@pierre/diffs` used Web Workers by default | `disableWorkerPool={true}` renders on main thread | Exists since the library was released | No `WorkerPoolContextProvider` needed; simpler setup; rendering is sync on main thread |
| git2 < 0.20 required system libgit2 | git2 0.20+ with `vendored` feature bundles libgit2 | git2 0.20.x | No system dependency; simpler cross-compilation |

**Deprecated/outdated:**
- `renderHoverUtility` prop on `PatchDiff` — marked `@deprecated` in types, use `renderGutterUtility` instead (not needed for this phase, but avoid if implementing hover utilities later).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `planRef.current?.contains(range.commonAncestorContainer)` correctly identifies selections within the plan div even for multi-node selections | Pattern 4 | Selection affordance appears outside the plan area; false positives |
| A2 | `git2::DiffLineType` variant names are `FileHeader`, `HunkHeader`, `Addition`, `Deletion`, `Context`, `Binary` — used to prefix diff lines correctly | Pattern 1 | Unified diff output malformed; `PatchDiff` fails to parse |
| A3 | Single-occurrence anchor highlight (first match only) is sufficient for v1 | Pattern 5 | Duplicate text in plan highlights wrong location |
| A4 | `@pierre/diffs` `PatchDiff` correctly parses the output of `git2::Diff::print(DiffFormat::Patch, ...)` as valid unified diff | Standard Stack | Diff renders blank or with parse errors |

**If this table is empty:** It is not — four assumptions listed above.

---

## Open Questions (RESOLVED)

1. **git2 `DiffLineType` exact variant names** — RESOLVED: deferred to executor verification
   - What we know: The enum exists and provides per-line metadata
   - What's unclear: Whether variant names are `FileHeader`/`HunkHeader` or something else (e.g., `Header`/`Context`)
   - Recommendation: `cargo doc --open` on git2 0.20.4 before implementing the diff extraction function; alternatively inspect `git2::DiffLineType` with `grep -r DiffLineType ~/.cargo/registry/src/`
   - Resolution: Plan 02-01 Task 1 instructs the executor to verify via `cargo doc -p git2 --no-deps --open` and provides two alternative implementations to handle either variant naming convention.

2. **`@pierre/diffs` empty patch behavior** — RESOLVED: guarded in DiffView component
   - What we know: `PatchDiff` accepts `patch: string`
   - What's unclear: What happens when `patch` is `""` — does it render an empty state, throw, or render blank?
   - Recommendation: In the `DiffView` component, guard with `if (!diff) return <DiffEmptyState />` before rendering `PatchDiff`. Do not pass empty string to the component.
   - Resolution: Plan 02-02 Task 2 implements `DiffView` with an explicit empty-diff guard before rendering `PatchDiff`.

3. **`@pierre/diffs` + Vite tree-shaking of language grammars** — RESOLVED: accepted
   - What we know: The package is 6.3 MB unzipped
   - What's unclear: Whether Vite can tree-shake the language grammar JSON files
   - Recommendation: Accept the bundle size; the tool is local-only and binary-distributed — users download once.
   - Resolution: Bundle size accepted. No action needed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite build (build.rs) | Yes | 25.8.1 | — |
| npm | Frontend deps | Yes | 11.11.0 | — |
| Rust / cargo | Binary compilation | Yes | 1.94.1 | — |
| git (for testing) | Manual verification | Assumed present | — | — |

**Missing dependencies with no fallback:** None detected.

---

## Security Domain

`security_enforcement` is not set to `false` in config.json — security section applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Local-only tool, no auth |
| V3 Session Management | No | Single-session, no cookies |
| V4 Access Control | No | Local-only tool |
| V5 Input Validation | Yes | Annotation text is user-generated; serialized into deny message that Claude reads |
| V6 Cryptography | No | No secrets or crypto in this phase |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via annotation text rendered in browser | Tampering | Annotation text is displayed via React state (no `dangerouslySetInnerHTML`); React escapes by default |
| Injection via annotation text into deny message | Tampering | The deny message is plain text sent to Claude via JSON. No SQL, shell, or HTML injection surface — Claude reads it as natural language |
| Path traversal via `cwd` from hook stdin | Tampering | `git2::Repository::open(cwd)` is safe — it opens a git repo, not arbitrary file paths; git2 does not execute code from the repo |
| Unified diff containing malicious content rendered in browser | Information Disclosure | `@pierre/diffs` uses Shadow DOM; diff is rendered as code, not executed; Shiki does not eval code |

**No new security risks introduced vs Phase 1.** The diff content is read-only display; annotation text stays client-side until included in the deny message as plain text.

---

## Sources

### Primary (HIGH confidence)
- `dist/react/PatchDiff.d.ts` in `@pierre/diffs` 1.1.12 (npm pack inspection) — component API
- `dist/components/web-components.js` in `@pierre/diffs` 1.1.12 — Shadow DOM / custom element registration
- `dist/react/WorkerPoolContext.js` in `@pierre/diffs` 1.1.12 — worker pool initialization flow
- `dist/constants.js` in `@pierre/diffs` 1.1.12 — `DIFFS_TAG_NAME = "diffs-container"`
- `dist/react/index.js` in `@pierre/diffs` 1.1.12 — confirmed `PatchDiff` is re-exported
- crates.io API — git2 0.20.4 confirmed as latest stable (2026-02-02)
- npm registry — @pierre/diffs 1.1.12 confirmed as latest, Apache-2.0 license
- `src/server.rs`, `src/hook.rs`, `src/main.rs`, `src/render.rs` — Phase 1 existing patterns
- `ui/src/App.tsx` — Phase 1 React patterns (state machine, fetch, keyboard handlers)
- `.planning/phases/02-annotations-diff/02-CONTEXT.md` — locked decisions D-01 through D-09
- `.planning/phases/02-annotations-diff/02-UI-SPEC.md` — component inventory, layout contract, accessibility

### Secondary (MEDIUM confidence)
- docs.rs/git2/0.20.4 via WebFetch — `diff_index_to_workdir`, `diff_tree_to_workdir_with_index`, `DiffFormat::Patch` semantics
- diffs.com (WebFetch) — library overview, Shadow DOM usage confirmed

### Tertiary (LOW confidence)
- git2 `DiffLineType` variant exact names — assumed from common usage patterns [ASSUMED: A2]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — npm and crates.io versions verified directly
- Architecture (Rust side): HIGH — existing patterns confirmed in source files; git2 API verified via docs.rs
- Architecture (React side): HIGH — @pierre/diffs API verified by package inspection; browser Selection API is standard
- Pitfalls: HIGH for git2 edge cases (empty repo, cross-element selection); MEDIUM for bundle size impact
- Diff line prefix handling: LOW — exact DiffLineType variants assumed, must verify before implementing

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable libraries; @pierre/diffs updates frequently but patch version changes unlikely to break API)
