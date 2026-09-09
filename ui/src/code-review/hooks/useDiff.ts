import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileDiff } from '../types'

// Test-only injection seam — tests call fetchDiffOnce directly with a fake doFetch,
// following the same pattern as useHeartbeat's HeartbeatTickContext (no @testing-library/react).
export type DoFetch = (url: string) => Promise<Response>

export interface FetchDiffResult {
  files: FileDiff[]
  error: string | null
}

// SHA validation regex — accepts 7–40 hex characters (case-insensitive).
// Used by fetchCommitDiffOnce to reject path-traversal and non-SHA strings before URL construction.
const SHA_RE = /^[0-9a-f]{7,40}$/i

/**
 * Discriminated union selector for useDiff — controls which endpoint to fetch from.
 *   { mode: 'branch' }              → GET /api/diff/branch
 *   { mode: 'commit', sha: string } → GET /api/diff/commit/{sha}
 *   { mode: 'range', shas: string[] } → GET /api/diff/range?shas=..., one entry per file
 */
export type DiffFetchSelector =
  | { mode: 'branch' }
  | { mode: 'commit'; sha: string }
  | { mode: 'range'; shas: string[] }

/**
 * Pure function: fetches FileDiff[] from /api/diff/branch.
 * Injectable doFetch makes this testable without a React renderer.
 * Uses strict !== undefined check for contextLines so that 0 is treated as
 * a real value (not absent) — per plan 25-01 behavior spec.
 */
export async function fetchDiffOnce(
  doFetch: DoFetch,
  contextLines?: number,
): Promise<FetchDiffResult> {
  // Strict !== undefined: contextLines=0 still includes the ?context param
  const url =
    contextLines !== undefined
      ? `/api/diff/branch?context=${contextLines}`
      : '/api/diff/branch'
  try {
    const res = await doFetch(url)
    if (!res.ok) {
      return { files: [], error: 'fetch failed' }
    }
    const data = (await res.json()) as FileDiff[]
    return { files: data, error: null }
  } catch {
    return { files: [], error: 'network error' }
  }
}

/**
 * Pure function: fetches FileDiff[] from /api/diff/commit/{sha}.
 * Injectable doFetch makes this testable without a React renderer.
 * Uses strict !== undefined for contextLines so 0 is treated as a real value.
 */
export async function fetchCommitDiffOnce(
  sha: string,
  doFetch: DoFetch,
  contextLines?: number,
): Promise<FetchDiffResult> {
  if (!SHA_RE.test(sha)) {
    return { files: [], error: 'invalid sha' }
  }
  const url =
    contextLines !== undefined
      ? `/api/diff/commit/${sha}?context=${contextLines}`
      : `/api/diff/commit/${sha}`
  try {
    const res = await doFetch(url)
    if (!res.ok) {
      return { files: [], error: 'fetch failed' }
    }
    const data = (await res.json()) as FileDiff[]
    return { files: data, error: null }
  } catch {
    return { files: [], error: 'network error' }
  }
}

/**
 * Pure function: fetches FileDiff[] from /api/diff/range for a set of selected commits.
 * The backend reconciles files touched by more than one of the given commits into a
 * single FileDiff entry, so callers get one row per file, not one per (commit, file).
 * Injectable doFetch makes this testable without a React renderer.
 */
export async function fetchRangeDiff(
  shas: string[],
  doFetch: DoFetch,
  contextLines?: number,
): Promise<FetchDiffResult> {
  if (shas.length === 0) return { files: [], error: null }
  if (shas.some((sha) => !SHA_RE.test(sha))) {
    return { files: [], error: 'invalid sha' }
  }
  const shasParam = shas.join(',')
  const url =
    contextLines !== undefined
      ? `/api/diff/range?shas=${shasParam}&context=${contextLines}`
      : `/api/diff/range?shas=${shasParam}`
  try {
    const res = await doFetch(url)
    if (!res.ok) {
      return { files: [], error: 'fetch failed' }
    }
    const data = (await res.json()) as FileDiff[]
    return { files: data, error: null }
  } catch {
    return { files: [], error: 'network error' }
  }
}

export interface UseDiffResult {
  files: FileDiff[]
  loading: boolean
  error: string | null
  refetch: (contextLines?: number) => void
}

/**
 * React hook: fetches FileDiff[] on mount, exposes { files, loading, error, refetch }.
 * Accepts an optional { selector } to control which endpoint to fetch from (branch / commit / range).
 * refetch(contextLines?) re-fetches with ?context=N using the current selector.
 * Uses a cancelledRef to prevent setState after unmount (avoids React 19 strict-mode warnings).
 *
 * Note: loading is initialized to true so the effect body does not call setLoading(true)
 * synchronously (which would violate react-hooks/set-state-in-effect). The initial fetch
 * resolves asynchronously and sets loading=false in the Promise callback.
 */
export function useDiff(opts?: { selector: DiffFetchSelector }): UseDiffResult {
  const [files, setFiles] = useState<FileDiff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  // Compute a stable string key from the selector so we can track changes in useEffect deps.
  // This avoids deep equality checks while still re-triggering on selector changes.
  const selector = opts?.selector ?? { mode: 'branch' as const }
  const selectorKey =
    selector.mode === 'commit'
      ? `commit:${selector.sha}`
      : selector.mode === 'range'
        ? `range:${[...selector.shas].sort().join(',')}`
        : 'branch:'

  // WR-01: keep a ref to the latest selector so memoised callbacks always
  // read the current selector, not the one captured when refetch was last rebuilt.
  const selectorRef = useRef(selector)
  selectorRef.current = selector

  // Dispatch: call the appropriate pure function based on selector mode.
  // Returns a FetchDiffResult-shaped promise for all modes.
  // Reads selectorRef.current so it is not stale inside the memoised refetch callback.
  async function dispatch(contextLines?: number): Promise<FetchDiffResult> {
    const doFetch = globalThis.fetch.bind(globalThis)
    const sel = selectorRef.current
    if (sel.mode === 'commit') {
      return fetchCommitDiffOnce(sel.sha, doFetch, contextLines)
    }
    if (sel.mode === 'range') {
      return fetchRangeDiff(sel.shas, doFetch, contextLines)
    }
    // Default: branch mode
    return fetchDiffOnce(doFetch, contextLines)
  }

  // refetch is the public API — called by event handlers (Expand All, etc.).
  // Calling setLoading(true) here is fine: it is triggered by user interaction,
  // not synchronously inside an effect body.
  const refetch = useCallback(
    (contextLines?: number) => {
      setLoading(true)
      void dispatch(contextLines).then((result) => {
        if (cancelledRef.current) return
        setFiles(result.files)
        setError(result.error)
        setLoading(false)
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectorKey],
  )

  // On mount AND on selector-key change: perform the fetch without calling setLoading(true)
  // synchronously inside the effect body. Loading is already true from initialization.
  useEffect(() => {
    cancelledRef.current = false
    setLoading(true)
    void dispatch().then((result) => {
      if (cancelledRef.current) return
      setFiles(result.files)
      setError(result.error)
      setLoading(false)
    })
    return () => {
      cancelledRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectorKey])

  return { files, loading, error, refetch }
}
