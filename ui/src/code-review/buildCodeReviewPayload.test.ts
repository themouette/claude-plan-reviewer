import { describe, it, expect } from 'vitest'
import { buildReviewPayload, shouldUseClipboard } from './buildCodeReviewPayload'
import type { CodeReviewComment } from './types'

const lineComment: CodeReviewComment = {
  id: 'c1',
  type: 'line',
  file: 'src/foo.ts',
  lineNumber: 10,
  side: 'additions',
  text: 'nit: rename this',
  createdAt: '2026-01-01T00:00:00Z',
}

const fileComment: CodeReviewComment = {
  id: 'c2',
  type: 'file',
  file: 'src/bar.ts',
  text: 'missing tests',
  createdAt: '2026-01-01T00:00:00Z',
}

const lineCommentWithEnd: CodeReviewComment = {
  id: 'c3',
  type: 'line',
  file: 'src/baz.ts',
  lineNumber: 5,
  endLineNumber: 8,
  side: 'deletions',
  text: 'remove this block',
  createdAt: '2026-01-01T00:00:00Z',
}

describe('buildReviewPayload', () => {
  it('returns {} when message is blank and no comments', () => {
    expect(buildReviewPayload(undefined, [])).toBe('{}')
  })

  it('returns message only when no comments', () => {
    expect(buildReviewPayload('looks good', [])).toBe('{"message":"looks good"}')
  })

  it('omits message when whitespace-only', () => {
    expect(buildReviewPayload('   ', [])).toBe('{}')
  })

  it('trims whitespace from message', () => {
    expect(buildReviewPayload('  nice  ', [])).toBe('{"message":"nice"}')
  })

  it('returns comments only when no message', () => {
    const result = JSON.parse(buildReviewPayload(undefined, [lineComment]))
    expect(result).not.toHaveProperty('message')
    expect(result.comments).toHaveLength(1)
  })

  it('includes both message and comments when both provided', () => {
    const result = JSON.parse(buildReviewPayload('overall lgtm', [lineComment]))
    expect(result.message).toBe('overall lgtm')
    expect(result.comments).toHaveLength(1)
  })

  it('strips internal fields from a line comment', () => {
    const result = JSON.parse(buildReviewPayload(undefined, [lineComment]))
    const c = result.comments[0]
    expect(c).toEqual({ file: 'src/foo.ts', line: 10, side: 'additions', text: 'nit: rename this' })
    expect(c).not.toHaveProperty('id')
    expect(c).not.toHaveProperty('type')
    expect(c).not.toHaveProperty('createdAt')
    expect(c).not.toHaveProperty('lineNumber')
  })

  it('strips internal fields from a file comment', () => {
    const result = JSON.parse(buildReviewPayload(undefined, [fileComment]))
    const c = result.comments[0]
    expect(c).toEqual({ file: 'src/bar.ts', text: 'missing tests' })
    expect(c).not.toHaveProperty('line')
    expect(c).not.toHaveProperty('side')
  })

  it('emits endLine when endLineNumber is set', () => {
    const result = JSON.parse(buildReviewPayload(undefined, [lineCommentWithEnd]))
    expect(result.comments[0].endLine).toBe(8)
  })

  it('omits endLine when endLineNumber is absent', () => {
    const result = JSON.parse(buildReviewPayload(undefined, [lineComment]))
    expect(result.comments[0]).not.toHaveProperty('endLine')
  })
})

describe('shouldUseClipboard', () => {
  it('returns true when offline', () => {
    expect(shouldUseClipboard('offline')).toBe(true)
  })

  it('returns false when online', () => {
    expect(shouldUseClipboard('online')).toBe(false)
  })
})
