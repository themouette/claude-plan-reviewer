import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileDiff } from '../types'

// Test-only injection seam — tests call fetchDiffOnce directly with a fake doFetch,
// following the same pattern as useHeartbeat's HeartbeatTickContext (no @testing-library/react).
export type DoFetch = (url: string) => Promise<Response>

export interface FetchDiffResult {
  files: FileDiff[]
  error: string | null
}

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

export interface UseDiffResult {
  files: FileDiff[]
  loading: boolean
  error: string | null
  refetch: (contextLines?: number) => void
}

/**
 * React hook: fetches FileDiff[] on mount, exposes { files, loading, error, refetch }.
 * refetch(contextLines?) re-fetches with ?context=N.
 * Uses a cancelledRef to prevent setState after unmount (avoids React 19 strict-mode warnings).
 */
export function useDiff(): UseDiffResult {
  const [files, setFiles] = useState<FileDiff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  const refetch = useCallback((contextLines?: number) => {
    setLoading(true)
    void fetchDiffOnce(globalThis.fetch.bind(globalThis), contextLines).then((result) => {
      if (cancelledRef.current) return
      setFiles(result.files)
      setError(result.error)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    cancelledRef.current = false
    refetch()
    return () => {
      cancelledRef.current = true
    }
  }, [refetch])

  return { files, loading, error, refetch }
}
