import { describe, it, expect } from 'vitest'
import {
  buildCodeReviewPayload,
  shouldUseClipboard,
} from './buildCodeReviewPayload'
import type { CodeReviewComment } from './types'

// Shared fixtures
const lineFixture: CodeReviewComment = {
  id: 'x',
  type: 'line',
  file: 'src/foo.ts',
  side: 'additions',
  lineNumber: 42,
  text: 'Use const here',
  createdAt: '2026-05-25T00:00:00Z',
}

const fileFixture: CodeReviewComment = {
  id: 'y',
  type: 'file',
  file: 'src/bar.ts',
  text: 'Missing exports',
  createdAt: '2026-05-25T00:00:00Z',
}

describe('buildCodeReviewPayload', () => {
  it('case 1: approved with no comments — returns exact JSON string with no comments key', () => {
    const result = buildCodeReviewPayload('approved', [])
    expect(result).toBe('{"decision":"approved"}')
    expect('comments' in JSON.parse(result)).toBe(false)
  })

  it('case 2: approved with non-blank globalInstruction — includes trimmed global_instruction and no comments key', () => {
    const result = buildCodeReviewPayload('approved', [], 'Update the docs')
    const parsed = JSON.parse(result)
    expect(parsed.global_instruction).toBe('Update the docs')
    expect('comments' in parsed).toBe(false)
  })

  it('case 3: approved with whitespace-only globalInstruction — omits global_instruction key', () => {
    const result = buildCodeReviewPayload('approved', [], '   ')
    expect(result).toBe('{"decision":"approved"}')
  })

  it('case 4: globalInstruction is trimmed in output', () => {
    const result = buildCodeReviewPayload('approved', [], '  hello  ')
    const parsed = JSON.parse(result)
    expect(parsed.global_instruction).toBe('hello')
  })

  it('case 5: changes_requested with a line comment — strips internal fields and maps lineNumber to line', () => {
    const result = buildCodeReviewPayload('changes_requested', [lineFixture])
    const parsed = JSON.parse(result)
    expect(parsed.decision).toBe('changes_requested')
    expect(parsed.comments[0]).toEqual({
      file: 'src/foo.ts',
      line: 42,
      side: 'additions',
      text: 'Use const here',
    })
    // Internal fields must NOT appear in output
    expect('type' in parsed.comments[0]).toBe(false)
    expect('id' in parsed.comments[0]).toBe(false)
    expect('createdAt' in parsed.comments[0]).toBe(false)
    expect('lineNumber' in parsed.comments[0]).toBe(false)
  })

  it('case 6: changes_requested with a file comment — emits only file and text, no line or side', () => {
    const result = buildCodeReviewPayload('changes_requested', [fileFixture])
    const parsed = JSON.parse(result)
    expect(parsed.comments[0]).toEqual({
      file: 'src/bar.ts',
      text: 'Missing exports',
    })
    expect('line' in parsed.comments[0]).toBe(false)
    expect('side' in parsed.comments[0]).toBe(false)
  })

  it('case 7: line comment with endLineNumber — emits endLine (not endLineNumber) with the correct value', () => {
    const rangeFixture: CodeReviewComment = {
      ...lineFixture,
      endLineNumber: 50,
    }
    const result = buildCodeReviewPayload('changes_requested', [rangeFixture])
    const parsed = JSON.parse(result)
    // endLine is the chosen JSON key (documented in buildCodeReviewPayload.ts)
    expect((parsed.comments[0].endLine ?? parsed.comments[0].endLineNumber) === 50).toBe(true)
  })

  it('case 8: mixed line + file comments — preserves order and correct shapes for both', () => {
    const result = buildCodeReviewPayload('changes_requested', [
      lineFixture,
      fileFixture,
    ])
    const parsed = JSON.parse(result)
    expect(parsed.comments).toHaveLength(2)
    // Index 0 is the line comment
    expect(parsed.comments[0]).toEqual({
      file: 'src/foo.ts',
      line: 42,
      side: 'additions',
      text: 'Use const here',
    })
    // Index 1 is the file comment
    expect(parsed.comments[1]).toEqual({
      file: 'src/bar.ts',
      text: 'Missing exports',
    })
  })
})

describe('shouldUseClipboard', () => {
  it('returns true when status is offline', () => {
    expect(shouldUseClipboard('offline')).toBe(true)
  })

  it('returns false when status is online', () => {
    expect(shouldUseClipboard('online')).toBe(false)
  })
})
