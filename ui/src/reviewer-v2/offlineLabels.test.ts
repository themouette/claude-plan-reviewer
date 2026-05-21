import { describe, it, expect } from 'vitest'
import { buildClipboardPayload, shouldUseClipboard } from './offlineLabels'
import type { Annotation } from './types'

describe('buildClipboardPayload (v2 copy)', () => {
  it('allow with no notes returns exactly {"behavior":"allow"}', () => {
    const result = buildClipboardPayload('allow', '', '', [])
    expect(result).toBe('{"behavior":"allow"}')
  })

  it('deny serializes message including denyText', () => {
    const annotation: Annotation = {
      id: '1',
      anchorText: 'foo',
      comment: 'fix this',
      type: 'comment',
      anchorStart: 0,
      anchorEnd: 3,
    }
    const result = buildClipboardPayload('deny', 'blocked', '', [annotation])
    const parsed = JSON.parse(result) as { behavior: string; message: string }
    expect(parsed.behavior).toBe('deny')
    expect(parsed.message.includes('blocked')).toBe(true)
    expect(parsed.message.includes('fix this')).toBe(true)
  })
})

describe('shouldUseClipboard (v2 copy)', () => {
  it('returns true when status is offline', () => {
    expect(shouldUseClipboard('offline')).toBe(true)
  })

  it('returns false when status is online', () => {
    expect(shouldUseClipboard('online')).toBe(false)
  })
})
