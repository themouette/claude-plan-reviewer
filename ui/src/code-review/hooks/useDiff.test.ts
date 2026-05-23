import { describe, it, expect } from 'vitest'
import { fetchDiffOnce } from './useDiff'
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
