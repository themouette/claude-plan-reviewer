import { useEffect, useRef, useState } from 'react'
import type { Commit } from '../types'

// Test-only injection seam — tests call fetchCommitsOnce directly with a fake doFetch,
// following the same pattern as useDiff's DoFetch (no @testing-library/react).
export type DoFetch = (url: string) => Promise<Response>

export interface FetchCommitsResult {
  commits: Commit[]
  truncated: boolean
  error: string | null
}

/**
 * Pure function: fetches Commit[] from /api/commits.
 * Injectable doFetch makes this testable without a React renderer.
 */
export async function fetchCommitsOnce(doFetch: DoFetch): Promise<FetchCommitsResult> {
  try {
    const res = await doFetch('/api/commits')
    if (!res.ok) {
      return { commits: [], truncated: false, error: 'fetch failed' }
    }
    const data = (await res.json()) as { commits: Commit[]; truncated: boolean }
    return { commits: data.commits, truncated: data.truncated, error: null }
  } catch {
    return { commits: [], truncated: false, error: 'network error' }
  }
}

export interface UseCommitsResult {
  commits: Commit[]
  loading: boolean
  error: string | null
  truncated: boolean
}

/**
 * React hook: fetches Commit[] on mount, exposes { commits, loading, error, truncated }.
 * No reload method — commits don't change during a session (D-12).
 * Uses a cancelledRef to prevent setState after unmount (avoids React 19 strict-mode warnings).
 *
 * Note: loading is initialized to true so the effect body does not call setLoading(true)
 * synchronously (which would violate react-hooks/set-state-in-effect). The initial fetch
 * resolves asynchronously and sets loading=false in the Promise callback.
 */
export function useCommits(): UseCommitsResult {
  const [commits, setCommits] = useState<Commit[]>([])
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  // On mount: perform the initial fetch without calling setLoading(true) synchronously
  // inside the effect body. Loading is already true from initialization.
  useEffect(() => {
    cancelledRef.current = false
    void fetchCommitsOnce(globalThis.fetch.bind(globalThis)).then((result) => {
      if (cancelledRef.current) return
      setCommits(result.commits)
      setTruncated(result.truncated)
      setError(result.error)
      setLoading(false)
    })
    return () => {
      cancelledRef.current = true
    }
  }, [])

  return { commits, truncated, loading, error }
}
