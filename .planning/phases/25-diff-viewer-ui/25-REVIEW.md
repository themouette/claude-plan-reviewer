---
phase: 25-diff-viewer-ui
reviewed: 2026-05-24T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - src/diff_api.rs
  - src/hook.rs
  - src/main.rs
  - src/plan_review.rs
  - src/server.rs
  - ui/eslint.config.js
  - ui/src/code-review/AppToolbar.test.ts
  - ui/src/code-review/AppToolbar.tsx
  - ui/src/code-review/CodeReviewApp.test.ts
  - ui/src/code-review/CodeReviewApp.tsx
  - ui/src/code-review/DiffPane.test.ts
  - ui/src/code-review/DiffPane.tsx
  - ui/src/code-review/FileListPane.test.ts
  - ui/src/code-review/FileListPane.tsx
  - ui/src/code-review/hooks/useDiff.test.ts
  - ui/src/code-review/hooks/useDiff.ts
  - ui/src/code-review/types.ts
  - ui/src/main.tsx
  - ui/vitest.setup.ts
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-05-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

This phase delivers the code-review diff viewer UI: a new React subtree (`ui/src/code-review/`) with a Rust backend module (`src/diff_api.rs`) serving git diff data. The implementation is broadly correct and the test patterns are reasonable. One blocker was found in `useDiff.ts` — the `refetch` useCallback silently drops in-flight updates after component unmount because it captures `cancelledRef` but never resets it, making the guard permanently armed after the component first unmounts in React Strict Mode. Beyond that, five warnings cover an integer-overflow risk in the Rust timezone conversion, a stale-closure bug in the Expand-All flow, a routing mismatch between the SPA path guard and the server fallback, two dead-state variables needlessly allocated on every render, and an IntersectionObserver that is recreated on every render due to an unstable dependency. Three informational items round out style and naming patterns.

## Critical Issues

### CR-01: `refetch` useCallback captures `cancelledRef` but never resets it — after React Strict Mode double-mount, all `refetch` calls silently drop their result

**File:** `ui/src/code-review/hooks/useDiff.ts:65-72`

**Issue:** `cancelledRef` is only reset inside the `useEffect` cleanup / setup cycle at lines 78 and 86. The `refetch` useCallback (line 65) captures `cancelledRef.current` via the shared ref object, which is correct for the guard check at line 68. However, the `refetch` callback never resets `cancelledRef.current = false` before starting its own fetch. In React 18/19 Strict Mode the component mounts, unmounts (setting `cancelledRef.current = true`), then remounts — but the `useEffect` at line 77 resets the ref to `false` on the second mount, so the initial fetch works fine. The problem occurs when `refetch` is called while the component is still mounted but a preceding in-flight fetch triggered by `refetch` itself happened to resolve after the Strict Mode unmount/remount cycle: the ref remains `true` from the cleanup and the `refetch` callback at line 68 will immediately return without updating state, silently showing stale diff data. More broadly, if `refetch` is called multiple times in rapid succession (Expand All, then immediately Collapse), the second call fires while the first is still in flight. Because `refetch` never sets `cancelledRef.current = true` on a superseded in-flight fetch, there is no race-condition cancellation — the last fetch to resolve wins. While this is a separate (lower-severity) issue, the missing reset of the ref in `refetch` is the root cause that could lead to permanently-dead state updates in long-lived sessions.

**Fix:**
```typescript
const refetch = useCallback((contextLines?: number) => {
  cancelledRef.current = false  // reset before starting a new fetch
  setLoading(true)
  void fetchDiffOnce(globalThis.fetch.bind(globalThis), contextLines).then((result) => {
    if (cancelledRef.current) return
    setFiles(result.files)
    setError(result.error)
    setLoading(false)
  })
}, [])
```

---

## Warnings

### WR-01: Integer overflow in timezone offset computation — `t.offset_minutes() * 60` is `i32 * i32` with no overflow guard

**File:** `src/diff_api.rs:90`

**Issue:** `git2::Time::offset_minutes()` returns `i32`. The valid UTC offset range git supports is −1439 to +1439 minutes. Multiplying by 60 gives a maximum of 86340 seconds, which fits in `i32` (max ~2.1 billion). However, a corrupt or adversarial git object could store any `i32` value in the offset field. If `offset_minutes()` returns a value outside −35791 to +35791 (i.e., `|v| * 60 > i32::MAX`), the multiplication wraps in debug builds with a panic and silently wraps in release builds, producing a garbage `east_opt` argument that returns `None` — the `unwrap_or_else` fallback kicks in, masking the corruption silently. For production data this is low probability, but a panic in a hook binary denies the plan approval entirely.

**Fix:**
```rust
let offset_secs = t.offset_minutes().saturating_mul(60);
let offset = FixedOffset::east_opt(offset_secs)
    .unwrap_or_else(|| FixedOffset::east_opt(0).unwrap());
```

---

### WR-02: Stale closure in `handleExpandAll` — `refetch()` call on collapse uses post-`setState` value but the collapse path relies on the pre-toggle `contextExpanded`

**File:** `ui/src/code-review/CodeReviewApp.tsx:14-21`

**Issue:** `handleExpandAll` calls `setContextExpanded(false)` then immediately calls `refetch()` (no context argument). `refetch()` with no argument fetches with the server default (3 lines of context). This is logically correct for collapse. However, `handleReload` at line 25 uses `refetch(contextExpanded ? 999 : undefined)` — this reads `contextExpanded` from the closure at the time the render created `handleReload`. If `handleReload` is called during the brief window between `setContextExpanded(false)` in `handleExpandAll` and the next render completing, the stale `contextExpanded === true` causes `handleReload` to pass `999` to `refetch` even though the user just collapsed. This is a race that is difficult to hit in normal usage but represents a logic error: `handleReload` should read the state it will actually use, not the captured snapshot. The recommended fix is to move context selection into the reload handler using the functional setter pattern or a ref.

**Fix:**
```typescript
// Store intended context in a ref so handleReload always reads the current value
const contextExpandedRef = useRef(false)

function handleExpandAll() {
  if (contextExpanded) {
    contextExpandedRef.current = false
    setContextExpanded(false)
    refetch()
  } else {
    contextExpandedRef.current = true
    setContextExpanded(true)
    refetch(999)
  }
}

function handleReload() {
  refetch(contextExpandedRef.current ? 999 : undefined)
}
```

---

### WR-03: SPA routing mismatch — `main.tsx` gates on `/code-review` path prefix but the server serves `index.html` for all unknown paths, so a direct GET to `/code-review` returns the plan-review UI, not the code-review UI

**File:** `ui/src/main.tsx:7`

**Issue:** The frontend path guard is:
```typescript
const isCodeReview = window.location.pathname.startsWith('/code-review')
```
`FallbackBehavior::Ok` in `server.rs:64` causes every non-API path to return `index.html`. There is no server-side route registered for `/code-review`. When a user navigates directly to `http://127.0.0.1:<port>/code-review`, the axum SPA fallback serves `index.html`, the client JS runs, `pathname` is `/code-review`, `isCodeReview` is `true`, and `CodeReviewApp` renders. So far so good. But the server never routes anything to `/code-review` — it falls through the API routes and then hits the SPA fallback. This works at runtime only because the fallback returns `index.html` unconditionally. The risk is that adding a new axum route whose path starts with `/code-review` would silently shadow the SPA rendering. More concretely: the Rust API for the code-review diff viewer is registered at `/api/diff/branch`, `/api/commits`, and `/api/diff/commit/{sha}` — not under `/code-review`. If the intent is that the code-review UI only renders when the browser is at `/code-review`, the server should explicitly redirect `/` to either `/plan-review` or `/code-review` based on the mode, rather than relying on a single-page pathname check against a route that the server has no knowledge of.

This is architecturally fragile rather than immediately broken, but a future developer adding a route like `.route("/code-review/api/...", ...)` would inadvertently break navigation. Flag as WARNING given no current test covers direct navigation to `/code-review`.

**Fix:** Register an explicit server route or document the invariant clearly with a comment in both `server.rs` and `main.tsx` that the `/code-review` prefix must remain free of axum routes.

---

### WR-04: `focusedButton` and `reloadFocused` state — dead write pattern causes unnecessary re-renders

**File:** `ui/src/code-review/AppToolbar.tsx:18,35` and `ui/src/code-review/DiffPane.tsx:30,33`

**Issue:** Both components declare a boolean/string state variable solely to track focus, then immediately suppress the compiler warning with `void <variable>`. The state is written (`setFocusedButton`, `setReloadFocused`) but never read to produce any different rendered output — the focus ring is applied imperatively via `e.currentTarget.style.outline`. Each `onFocus` and `onBlur` event therefore triggers a full component re-render (because React sees state change) that produces identical JSX output. For `AppToolbar` this means 4 unnecessary re-renders per keyboard navigation event (2 layout buttons + 1 expand button × focus + blur). This pattern indicates the state variable serves no purpose and should be removed entirely.

**Fix:**
```typescript
// Remove the useState declaration and the void suppression entirely.
// The outline is already applied imperatively via e.currentTarget.style — no state needed.
```
Remove `const [focusedButton, setFocusedButton] = useState<string | null>(null)` and `void focusedButton` from `AppToolbar.tsx`, and remove `const [reloadFocused, setReloadFocused] = useState(false)` and `void reloadFocused` from `DiffPane.tsx`. Remove `setFocusedButton` / `setReloadFocused` calls from the focus handlers.

---

### WR-05: `IntersectionObserver` in `FileListPane` is recreated on every `files` or `onActiveIndexChange` reference change — including the render triggered by active-index updates

**File:** `ui/src/code-review/FileListPane.tsx:20-51`

**Issue:** The `useEffect` dependency array at line 51 includes `[files, diffPaneRef, onActiveIndexChange]`. `onActiveIndexChange` is `setActiveIndex` passed directly from `CodeReviewApp` — a stable reference from `useState`. However, `files` is the state array from `useDiff`, and every `refetch` call replaces the array reference even when file contents are identical (because `setFiles(result.files)` always creates a new array). This means every Expand All / Collapse action recreates the `IntersectionObserver`, momentarily disconnecting and reconnecting all file anchor observations. During the reconnection window (next microtask boundary), rapid scrolling could fail to fire any intersection events, leaving the active highlight stuck on a stale entry.

More importantly: the `onActiveIndexChange` prop is `setActiveIndex` — React guarantees this is stable, but it is typed as `(index: number) => void`. If a parent ever passes a non-memoized callback here, it will cause continuous observer churn. The pattern is fragile; the dependency should be stabilized.

**Fix:**
```typescript
// Wrap onActiveIndexChange in useCallback at the call site (CodeReviewApp):
// <FileListPane onActiveIndexChange={useCallback(setActiveIndex, [])} ... />
//
// Or in FileListPane, use a ref for the callback to break the dependency:
const onActiveIndexChangeRef = useRef(onActiveIndexChange)
useEffect(() => { onActiveIndexChangeRef.current = onActiveIndexChange }, [onActiveIndexChange])

useEffect(() => {
  // ...same observer setup but callback uses onActiveIndexChangeRef.current
}, [files, diffPaneRef]) // onActiveIndexChange removed from deps
```

---

## Info

### IN-01: `src/server.rs:90` — CancellationToken is dropped immediately after being cloned; graceful shutdown is non-functional

**File:** `src/server.rs:90`

**Issue:** `token` is created at line 45, cloned into `token_clone` at line 46, moved into the shutdown future at line 83, and then explicitly `drop(token)` at line 90 with the comment "process::exit handles termination." This means the shutdown future `token_clone.cancelled()` can never complete — `token` is the only holder that could call `.cancel()` and it is immediately dropped. The graceful shutdown path is permanently inaccessible. In practice the process exits via `std::process::exit(0)` in the 3-second watchdog spawned in `async_main`, so this causes no visible bug today. However the intent to have a clean shutdown path is defeated, and any future code that tries to trigger a graceful shutdown via the token will not work.

**Fix:** Either keep the token and expose a cancellation path, or remove the `CancellationToken` machinery entirely and document that exit is handled by `process::exit`.

---

### IN-02: `DiffPane.tsx` — `@keyframes spin` is defined in `index.css` (not imported by `DiffPane`); silent reliance on global CSS load order

**File:** `ui/src/code-review/DiffPane.tsx:55`

**Issue:** The spinner animation at line 55 references `animation: 'spin 0.8s linear infinite'`. The `@keyframes spin` rule lives in `ui/src/index.css`, which is only imported by `ui/src/main.tsx`. This is an invisible coupling: if `DiffPane` were ever tested in isolation with a render (via jsdom + a component test), the spinner would silently render as a static element rather than animating. The current source-read tests do not catch this at runtime. This is not a bug in production (since `main.tsx` always loads before any component renders) but is a maintainability smell.

**Fix:** Either inline the `@keyframes` rule as a `<style>` element rendered alongside the spinner, or document the dependency with a comment in `DiffPane.tsx`.

---

### IN-03: `AppToolbar.tsx` — active layout button uses `background: 'var(--color-surface)'` for both active and the container border, making active vs. inactive indistinguishable to users who cannot rely on font-weight alone

**File:** `ui/src/code-review/AppToolbar.tsx:88-89`

**Issue:** The active toggle button background is `var(--color-surface)` (line 88), and the inactive button background is `transparent` (line 89). The container `div` also uses `background: var(--color-surface)` (inherited from the header). The only visual distinction between the active and inactive layout buttons is `fontWeight: 600` vs `400` and text color — there is no fill or border change. This may be intentional per the design spec, but it creates a low-contrast active indicator that fails WCAG AA for users who rely on color/contrast rather than font-weight changes.

**Fix:** Consider using `var(--color-bg)` for the active button background (matching the active file entry pattern in `FileListPane.tsx:108`) to provide a visible inset/raised effect.
