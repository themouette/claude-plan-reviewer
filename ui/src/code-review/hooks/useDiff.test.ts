import { describe, it, expect } from 'vitest'
import { fetchDiffOnce, fetchCommitDiffOnce, fetchFilteredBranchDiff } from './useDiff'
import type { FileDiff } from '../types'

// Minimal valid FileDiff fixture for success cases
const sampleFile: FileDiff = {
  filename: 'a',
  status: 'added',
  additions: 1,
  deletions: 0,
  changes: 1,
  patch: '+x',
  // previous_filename intentionally absent (optional field)
}

describe('fetchDiffOnce', () => {
  it('resolves to { files, error: null } on a 200 response', async () => {
    const doFetch = () =>
      Promise.resolve(new Response(JSON.stringify([sampleFile]), { status: 200 }))
    const result = await fetchDiffOnce(doFetch)
    expect(result.error).toBeNull()
    expect(result.files).toHaveLength(1)
    expect(result.files[0].filename).toBe('a')
    expect(result.files[0].status).toBe('added')
    expect(result.files[0].additions).toBe(1)
    expect(result.files[0].deletions).toBe(0)
    expect(result.files[0].changes).toBe(1)
    expect(result.files[0].patch).toBe('+x')
  })

  it('resolves to { files: [], error: "fetch failed" } on a non-ok response', async () => {
    const doFetch = () => Promise.resolve(new Response(null, { status: 500 }))
    const result = await fetchDiffOnce(doFetch)
    expect(result.files).toHaveLength(0)
    expect(result.error).toBe('fetch failed')
  })

  it('resolves to { files: [], error: "network error" } when doFetch throws', async () => {
    const doFetch = (): Promise<Response> => Promise.reject(new Error('network failure'))
    const result = await fetchDiffOnce(doFetch)
    expect(result.files).toHaveLength(0)
    expect(result.error).toBe('network error')
  })

  it('calls doFetch with a URL containing ?context=999 when contextLines=999', async () => {
    let capturedUrl = ''
    const doFetch = (url: string) => {
      capturedUrl = url
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
    }
    await fetchDiffOnce(doFetch, 999)
    expect(capturedUrl).toContain('?context=999')
  })

  it('calls doFetch with a URL NOT containing ?context= when contextLines is undefined', async () => {
    let capturedUrl = ''
    const doFetch = (url: string) => {
      capturedUrl = url
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
    }
    await fetchDiffOnce(doFetch, undefined)
    expect(capturedUrl).not.toContain('?context=')
  })

  it('calls doFetch with ?context=0 in the URL when contextLines=0 (zero is a real value)', async () => {
    let capturedUrl = ''
    const doFetch = (url: string) => {
      capturedUrl = url
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
    }
    await fetchDiffOnce(doFetch, 0)
    expect(capturedUrl).toContain('?context=0')
  })
})

describe('fetchCommitDiffOnce', () => {
  it('calls /api/diff/commit/{sha} and returns files on 200', async () => {
    const file: FileDiff = { filename: 'b', status: 'modified', additions: 1, deletions: 1, changes: 2, patch: '-x\n+y' }
    const doFetch = (url: string) => {
      expect(url).toContain('/api/diff/commit/abc1234')
      return Promise.resolve(new Response(JSON.stringify([file]), { status: 200 }))
    }
    const result = await fetchCommitDiffOnce('abc1234', doFetch)
    expect(result.error).toBeNull()
    expect(result.files).toHaveLength(1)
    expect(result.files[0].filename).toBe('b')
  })

  it("returns { files: [], error: 'fetch failed' } on non-ok", async () => {
    const doFetch = () => Promise.resolve(new Response(null, { status: 500 }))
    const result = await fetchCommitDiffOnce('abc1234', doFetch)
    expect(result.files).toHaveLength(0)
    expect(result.error).toBe('fetch failed')
  })

  it("returns { files: [], error: 'network error' } when fetch throws", async () => {
    const doFetch = (): Promise<Response> => Promise.reject(new Error('network failure'))
    const result = await fetchCommitDiffOnce('abc1234', doFetch)
    expect(result.files).toHaveLength(0)
    expect(result.error).toBe('network error')
  })

  it('appends ?context=999 when contextLines is 999', async () => {
    let capturedUrl = ''
    const doFetch = (url: string) => {
      capturedUrl = url
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
    }
    await fetchCommitDiffOnce('abc1234', doFetch, 999)
    expect(capturedUrl).toContain('?context=999')
  })

  it('rejects an invalid SHA without calling doFetch', async () => {
    let called = false
    const doFetch = (url: string) => {
      called = true
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { url } }))
    }
    const result = await fetchCommitDiffOnce('../branch', doFetch)
    expect(called).toBe(false)
    expect(result.files).toHaveLength(0)
    expect(result.error).toBe('invalid sha')
  })
})

describe('fetchFilteredBranchDiff', () => {
  it('returns flat union of files from each sha when all 200', async () => {
    const fileA: FileDiff = { filename: 'a', status: 'added', additions: 1, deletions: 0, changes: 1, patch: '+a' }
    const fileB: FileDiff = { filename: 'b', status: 'modified', additions: 1, deletions: 1, changes: 2, patch: '-x\n+y' }
    const doFetch = (url: string) => {
      if (url.includes('aa11111')) return Promise.resolve(new Response(JSON.stringify([fileA]), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify([fileB]), { status: 200 }))
    }
    const result = await fetchFilteredBranchDiff(['aa11111', 'bb22222'], doFetch)
    expect(result.files).toHaveLength(2)
    expect(result.error).toBeNull()
  })

  it('returns [] for a single failing sha without throwing', async () => {
    const fileA: FileDiff = { filename: 'a', status: 'added', additions: 1, deletions: 0, changes: 1, patch: '+a' }
    const doFetch = (url: string) => {
      if (url.includes('aa11111')) return Promise.resolve(new Response(JSON.stringify([fileA]), { status: 200 }))
      return Promise.resolve(new Response(null, { status: 500 }))
    }
    const result = await fetchFilteredBranchDiff(['aa11111', 'bb22222'], doFetch)
    expect(result.files).toHaveLength(1)
    expect(result.error).toBeNull()
  })

  it('appends ?context=N to every per-sha URL when contextLines is set', async () => {
    const capturedUrls: string[] = []
    const doFetch = (url: string) => {
      capturedUrls.push(url)
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
    }
    await fetchFilteredBranchDiff(['aa11111', 'bb22222'], doFetch, 5)
    expect(capturedUrls.every((u) => u.includes('?context='))).toBe(true)
  })

  it("returns { files: [], error: 'all fetches failed' } when all SHAs return 500", async () => {
    const doFetch = () => Promise.resolve(new Response(null, { status: 500 }))
    const result = await fetchFilteredBranchDiff(['aa11111', 'bb22222'], doFetch)
    expect(result.files).toHaveLength(0)
    expect(result.error).toBe('all fetches failed')
  })
})
