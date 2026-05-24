---
phase: 26-commit-navigation
reviewed: 2026-05-24T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - ui/src/code-review/types.ts
  - ui/src/code-review/hooks/useCommits.ts
  - ui/src/code-review/hooks/useCommits.test.ts
  - ui/src/code-review/CommitDrawer.tsx
  - ui/src/code-review/CommitDrawer.test.ts
  - ui/src/code-review/DiffPane.tsx
  - ui/src/code-review/DiffPane.test.ts
  - ui/src/code-review/AppToolbar.tsx
  - ui/src/code-review/AppToolbar.test.ts
  - ui/src/code-review/CodeReviewApp.tsx
  - ui/src/code-review/CodeReviewApp.test.ts
  - ui/src/code-review/hooks/useDiff.ts
  - ui/src/code-review/hooks/useDiff.test.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 26: Code Review Report

**Reviewed:** 2026-05-24
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

This phase adds commit-navigation to the code-review UI: a `CommitDrawer` sidebar, `useCommits` hook, extensions to `useDiff` (commit and branch-union modes), and wiring in `CodeReviewApp`. The architecture is clean and the injection-seam test pattern is consistent.

Two correctness blockers were found. The first is a URL injection vulnerability in `fetchCommitDiffOnce`: the SHA comes from server-supplied JSON and is interpolated directly into a fetch URL without sanitisation. The second is a logic error in the `checkedCommitShas` seeding effect that produces incorrect behaviour on the second and subsequent loads when commits change mid-session. Several warnings cover real-world edge cases that will surface in use: unchecked array access after `findIndex`, silent loss of error state in the branch-union path, the `fetchFilteredBranchDiff` failure-swallowing catch, and the missing `aria-label` / `role` on the commit list items.

---

## Critical Issues

### CR-01: Path-segment injection via unsanitised SHA in fetch URL

**File:** `ui/src/code-review/hooks/useDiff.ts:63-64`
**Issue:** `fetchCommitDiffOnce` interpolates `sha` directly into the fetch URL:

```ts
const url =
  contextLines !== undefined
    ? `/api/diff/commit/${sha}?context=${contextLines}`
    : `/api/diff/commit/${sha}`
```

`sha` is taken verbatim from the server JSON response (`Commit.sha` in `types.ts`). A malicious or corrupted server response could supply a SHA such as `../branch` or `abc?injected=1`, causing the client to fetch an unintended endpoint. While this is a local tool, the hook is a pure function callable with any `sha` string, and the `DiffFetchSelector` type places no constraint on the value.

**Fix:** Validate the SHA before building the URL. A 7-40 hex character check is sufficient:

```ts
const SHA_RE = /^[0-9a-f]{7,40}$/i
if (!SHA_RE.test(sha)) {
  return { files: [], error: 'invalid sha' }
}
const url =
  contextLines !== undefined
    ? `/api/diff/commit/${sha}?context=${contextLines}`
    : `/api/diff/commit/${sha}`
```

---

### CR-02: `checkedCommitShas` seeding condition is permanently broken after first load

**File:** `ui/src/code-review/CodeReviewApp.tsx:67-74`
**Issue:** The seeding effect guards on `checkedCommitShas.length === 0`:

```ts
useEffect(() => {
  if (commits.length > 0 && checkedCommitShas.length === 0) {
    const id = setTimeout(() => setCheckedCommitShas(commits.map((c) => c.sha)), 0)
    return () => clearTimeout(id)
  }
  return undefined
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [commits.length])
```

Once the user unchecks every commit (making `checkedCommitShas.length === 0`), the effect re-seeds all commits on the _next_ render that sees `commits.length > 0`. That re-seed is the intended "opt-out resets on drawer close" model only if `checkedCommitShas` being empty is an unrecoverable user error — but the checkbox `onChange` handler in `CommitDrawer` explicitly allows unchecking all commits. Concretely:

1. User opens drawer (all N commits seeded).
2. User unchecks all N commits — `checkedCommitShas` becomes `[]`.
3. Any re-render that triggers the `commits.length` dep fires the seeding again, silently re-checking everything.

The `eslint-disable-next-line` suppression hides the real problem: `checkedCommitShas` is a missing dependency, meaning the effect captures a stale snapshot of the array.

**Fix:** Use a `seededRef` sentinel instead of inspecting the live array:

```ts
const seededRef = useRef(false)

useEffect(() => {
  if (commits.length > 0 && !seededRef.current) {
    seededRef.current = true
    const id = setTimeout(() => setCheckedCommitShas(commits.map((c) => c.sha)), 0)
    return () => clearTimeout(id)
  }
  return undefined
}, [commits.length])
```

If re-seeding on drawer close is desired, reset `seededRef.current = false` inside `handleCommitsToggle` when `drawerOpen` is `true`.

---

## Warnings

### WR-01: Unchecked array access after `findIndex` in keyboard handler

**File:** `ui/src/code-review/CodeReviewApp.tsx:82-83`
**Issue:** `commits[idx - 1]` and `commits[idx + 1]` are accessed after a guard that checks `idx > 0` and `idx < commits.length - 1`, but `idx` could be `-1` if `activeCommitSha` is set to a SHA that no longer exists in the `commits` array. When `idx === -1`, the guard `idx > 0` is false and `idx < commits.length - 1` is also false (for any non-empty array), so neither branch fires — but if `commits` changes between renders (theoretically possible if the hook ever reloads), `idx` could be `-1` and the checks would still pass for certain array sizes.

More immediately: if `activeCommitSha` is a valid SHA but `findIndex` returns `-1` (e.g., after an unmount/remount), no navigation fires and the stale SHA is silently retained. There is no defensive reset.

**Fix:** Add an explicit `-1` guard:

```ts
if (idx === -1) return
if (e.key === 'ArrowLeft' && idx > 0) setActiveCommitSha(commits[idx - 1].sha)
else if (e.key === 'ArrowRight' && idx < commits.length - 1) setActiveCommitSha(commits[idx + 1].sha)
```

---

### WR-02: `fetchFilteredBranchDiff` silently swallows per-SHA fetch errors, losing `error` state entirely

**File:** `ui/src/code-review/hooks/useDiff.ts:87-95`
**Issue:** The `.catch(() => [] as FileDiff[])` in `fetchFilteredBranchDiff` converts every per-SHA failure into an empty file list. The caller in `dispatch` wraps the result as `{ files: unionFiles, error: null }` unconditionally:

```ts
const unionFiles = await fetchFilteredBranchDiff(selector.shas, doFetch, contextLines)
return { files: unionFiles, error: null }
```

If every SHA fails (network down, server restarting), `useDiff` surfaces `error: null` with an empty file list. The user sees the "No changes on this branch" empty state instead of the error state with a "Reload Diff" button. This is a silent data loss: the user cannot distinguish "the branch genuinely has no files" from "every fetch failed".

**Fix:** Track whether any partial failure occurred and surface it:

```ts
async function fetchFilteredBranchDiff(
  shas: string[],
  doFetch: DoFetch,
  contextLines?: number,
): Promise<{ files: FileDiff[]; partialError: boolean }> {
  const results = await Promise.all(
    shas.map((sha) =>
      fetchCommitDiffOnce(sha, doFetch, contextLines)
        .then((r) => ({ files: r.files, failed: r.error !== null }))
        .catch(() => ({ files: [] as FileDiff[], failed: true })),
    ),
  )
  return {
    files: results.flatMap((r) => r.files),
    partialError: results.some((r) => r.failed),
  }
}
```

Then in `dispatch`, propagate the error when all SHAs fail or when `partialError` is true and the result is empty.

---

### WR-03: `CommitDrawer` renders inside an `<aside>` with `role="navigation"` — incorrect ARIA landmark

**File:** `ui/src/code-review/CommitDrawer.tsx:174-175`
**Issue:** The root element is:

```tsx
<aside role="navigation" aria-label="Branch commits">
```

`role="navigation"` overrides the implicit `<aside>` role (`complementary`). While not technically invalid, a commit list is not navigation in the ARIA sense (it is not a set of links for site-wide navigation). More importantly, the individual `<li>` items inside the `<ol>` have `onClick` handlers but no `role="button"`, `tabIndex`, or keyboard handler (`onKeyDown`). Screen-reader users cannot interact with the commit list items at all — clicking requires a pointer device.

**Fix:** Either drop `role="navigation"` and keep the complementary landmark, or keep it but add keyboard accessibility to each list item:

```tsx
<li
  key={commit.sha}
  role="button"
  tabIndex={0}
  onClick={() => onCommitClick(commit.sha)}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onCommitClick(commit.sha) }}
  ...
>
```

---

### WR-04: `DiffPane` renders the per-commit title strip even when `activeCommitSha` matches no commit in the list

**File:** `ui/src/code-review/DiffPane.tsx:76-79`
**Issue:**

```ts
const activeCommit =
  viewMode === 'commit' && activeCommitSha !== null
    ? (commits.find((c) => c.sha === activeCommitSha) ?? null)
    : null
```

If `commits` is still loading (empty array) when `viewMode` is already `'commit'` and `activeCommitSha` is set, `activeCommit` will be `null`. The title strip is hidden, which is the correct fallback. However, if `commits` has loaded but the provided `activeCommitSha` simply does not exist in the list (e.g., SHA from a prior state snapshot), `activeCommit` is also silently `null` and the pane title strip disappears with no diagnostic. The user sees commit-mode diff content with no title. This is a subtle UX hole rather than a crash, but it indicates a state invariant that is never enforced.

**Fix:** In `CodeReviewApp`, assert that `activeCommitSha` is always cleared when `commits` updates and the SHA is no longer present — or add a visible fallback in `DiffPane` when `viewMode === 'commit'` but `activeCommit` is null:

```tsx
{viewMode === 'commit' && activeCommit === null && (
  <div style={{ padding: '8px 16px', color: 'var(--color-text-secondary)', fontSize: 12 }}>
    Commit not found
  </div>
)}
```

---

### WR-05: `useDiff` effect calls `setLoading(true)` synchronously inside an effect body — contradicts the hook's own documentation

**File:** `ui/src/code-review/hooks/useDiff.ts:164-177`
**Issue:** The `useEffect` body explicitly calls `setLoading(true)` on line 166:

```ts
useEffect(() => {
  cancelledRef.current = false
  setLoading(true)          // <-- synchronous setState inside effect body
  void dispatch().then(...)
  ...
}, [selectorKey])
```

The hook's own JSDoc comment (lines 111-113) states:

> Note: loading is initialized to true so the effect body does not call setLoading(true) synchronously (which would violate react-hooks/set-state-in-effect).

The initial mount is fine (`loading` starts `true`), but every subsequent selector change (switching from branch to commit mode, or selecting a different commit) will call `setLoading(true)` synchronously inside the effect — exactly what the comment says must not happen. This causes a double-render in React Strict Mode and can produce a visible loading flash between commit selections.

The `useCommits` hook avoids this correctly (no `setLoading(true)` in the effect body). `useDiff` is inconsistent.

**Fix:** Remove the `setLoading(true)` call from inside the effect and document that the loading state is driven by the `refetch` path for subsequent changes, or reset loading state before the selector key changes via a derived state pattern.

---

## Info

### IN-01: Snapshot-based tests in `CommitDrawer.test.ts` and `DiffPane.test.ts` are source-text assertions, not behaviour tests

**File:** `ui/src/code-review/CommitDrawer.test.ts:7`, `ui/src/code-review/DiffPane.test.ts:7`
**Issue:** Both test files read the source file as a raw string and assert that specific string literals appear in it. For example:

```ts
const source = readFileSync(resolve(__dirname, './CommitDrawer.tsx'), 'utf-8')
expect(source).toContain("'spin 0.8s linear infinite'")
```

These tests verify that the source code contains certain string constants, not that the component renders or behaves correctly. They will pass even if the string is inside a comment or a dead code branch. They also tightly couple the tests to the exact formatting of the source, making routine refactors (moving inline styles to constants) break tests without changing behaviour.

**Fix:** This is an acknowledged trade-off (no `@testing-library/react` renderer is available in the pure Vitest environment). At minimum, annotate each test file with a comment explaining why source-text assertions are used rather than component rendering, and mark them as a known limitation to revisit when a JSDOM/happy-dom environment is configured.

---

### IN-02: `reloadFocused` state in `DiffPane` is tracked but never consumed — suppression via `void` is a smell

**File:** `ui/src/code-review/DiffPane.tsx:73, 82`
**Issue:**

```ts
const [reloadFocused, setReloadFocused] = useState(false)
// ...
void reloadFocused
```

The state is mutated (via `setReloadFocused`) but the value is immediately discarded. The `void reloadFocused` suppression was copied from `AppToolbar` where `focusedButton` has the same pattern. This causes an unnecessary extra re-render every time the Reload button gains or loses focus.

**Fix:** Remove the `reloadFocused` state and its setter. The focus ring is already applied imperatively via `e.currentTarget.style.outline`, so the React state is unused:

```ts
// Remove these two lines:
const [reloadFocused, setReloadFocused] = useState(false)
void reloadFocused
```

---

### IN-03: `fetchDiffOnce` still hardcodes `/api/diff/branch` despite the new `DiffFetchSelector` abstraction

**File:** `ui/src/code-review/hooks/useDiff.ts:36-38`
**Issue:** `fetchDiffOnce` is a public export that always fetches `/api/diff/branch` regardless of the selector. With the addition of `fetchCommitDiffOnce` and `fetchFilteredBranchDiff`, `fetchDiffOnce` is now used only inside `dispatch` for the `'branch'` mode. Its public export means external callers could invoke it thinking it handles the full selector logic.

**Fix:** Consider making `fetchDiffOnce` package-private (no export) and exposing only the `useDiff` hook and its types, or rename it to `fetchBranchDiffOnce` to make its scope explicit. The tests already call it by name, so a rename would require updating `useDiff.test.ts` line 2.

---

_Reviewed: 2026-05-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
