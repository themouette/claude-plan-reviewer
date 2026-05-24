import { describe, it, expect } from 'vitest'
import { fetchCommitsOnce } from './useCommits'
import type { Commit } from '../types'

// Minimal valid Commit fixture for success cases
const sampleCommit: Commit = {
  sha: 'abc1234567890abcdef',
  short_sha: 'abc1234',
  message: 'Fix login bug',
  author: 'Alice',
  email: 'alice@example.com',
  date: '2026-05-24T10:00:00Z',
}

describe('fetchCommitsOnce', () => {
  it('resolves to { commits, error: null } on a 200 response', async () => {
    const doFetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ commits: [sampleCommit], truncated: false }), {
          status: 200,
        }),
      )
    const result = await fetchCommitsOnce(doFetch)
    expect(result.error).toBeNull()
    expect(result.commits).toHaveLength(1)
    expect(result.truncated).toBe(false)
  })

  it('resolves to { commits: [], error: "fetch failed" } on non-ok response', async () => {
    const doFetch = () => Promise.resolve(new Response(null, { status: 500 }))
    const result = await fetchCommitsOnce(doFetch)
    expect(result.commits).toHaveLength(0)
    expect(result.error).toBe('fetch failed')
  })

  it('resolves to { commits: [], error: "network error" } when doFetch throws', async () => {
    const doFetch = (): Promise<Response> => Promise.reject(new Error('network failure'))
    const result = await fetchCommitsOnce(doFetch)
    expect(result.commits).toHaveLength(0)
    expect(result.error).toBe('network error')
  })
})
