import { describe, it, expect } from 'vitest'
import { reduceAnnotations } from './useCodeReviewAnnotations'
import type { CodeReviewComment } from '../types'

const lineFixture: CodeReviewComment = {
  id: 'c1',
  type: 'line',
  file: 'src/main.ts',
  side: 'additions',
  lineNumber: 42,
  text: 'original line comment',
  createdAt: '2026-05-25T10:00:00Z',
}

const fileFixture: CodeReviewComment = {
  id: 'c2',
  type: 'file',
  file: 'src/main.ts',
  text: 'original file comment',
  createdAt: '2026-05-25T10:01:00Z',
}

describe('reduceAnnotations', () => {
  it('Test A: ADD_COMMENT appends line fixture to empty state', () => {
    const next = reduceAnnotations([], { type: 'ADD_COMMENT', comment: lineFixture })
    expect(next).toHaveLength(1)
    expect(next[0]).toBe(lineFixture)
  })

  it('Test B: EDIT_COMMENT updates text only; id, file, type, side, lineNumber, createdAt unchanged', () => {
    const after_add = reduceAnnotations([], { type: 'ADD_COMMENT', comment: lineFixture })
    const after_edit = reduceAnnotations(after_add, {
      type: 'EDIT_COMMENT',
      id: 'c1',
      text: 'updated comment text',
    })
    expect(after_edit).toHaveLength(1)
    expect(after_edit[0].text).toBe('updated comment text')
    expect(after_edit[0].id).toBe('c1')
    expect(after_edit[0].type).toBe('line')
    expect(after_edit[0].file).toBe('src/main.ts')
    // Narrow to line variant to access side/lineNumber
    const c = after_edit[0]
    if (c.type === 'line') {
      expect(c.side).toBe('additions')
      expect(c.lineNumber).toBe(42)
    }
    expect(after_edit[0].createdAt).toBe('2026-05-25T10:00:00Z')
  })

  it('Test C: DELETE_COMMENT removes matching id; result has length 0', () => {
    const after_add = reduceAnnotations([], { type: 'ADD_COMMENT', comment: lineFixture })
    const after_delete = reduceAnnotations(after_add, { type: 'DELETE_COMMENT', id: 'c1' })
    expect(after_delete).toHaveLength(0)
  })

  it('Test D: EDIT_COMMENT with unknown id is a no-op (length unchanged, text unchanged)', () => {
    const after_add = reduceAnnotations([], { type: 'ADD_COMMENT', comment: lineFixture })
    const after_edit = reduceAnnotations(after_add, {
      type: 'EDIT_COMMENT',
      id: 'does-not-exist',
      text: 'this changes nothing',
    })
    expect(after_edit).toHaveLength(1)
    expect(after_edit[0].text).toBe('original line comment')
  })

  it('Test E: DELETE_COMMENT with unknown id is a no-op (length unchanged, original id present)', () => {
    const after_add = reduceAnnotations([], { type: 'ADD_COMMENT', comment: lineFixture })
    const after_delete = reduceAnnotations(after_add, {
      type: 'DELETE_COMMENT',
      id: 'does-not-exist',
    })
    expect(after_delete).toHaveLength(1)
    expect(after_delete[0].id).toBe('c1')
  })

  it('Test F: discriminated union — adding line and file comments both work; distinguishable by type', () => {
    const after_line = reduceAnnotations([], { type: 'ADD_COMMENT', comment: lineFixture })
    const after_both = reduceAnnotations(after_line, {
      type: 'ADD_COMMENT',
      comment: fileFixture,
    })
    expect(after_both).toHaveLength(2)
    const lineComment = after_both.find((c) => c.type === 'line')
    const fileComment = after_both.find((c) => c.type === 'file')
    expect(lineComment).toBeDefined()
    expect(fileComment).toBeDefined()
    expect(lineComment?.id).toBe('c1')
    expect(fileComment?.id).toBe('c2')
    // File variant does not have side or lineNumber
    if (fileComment?.type === 'file') {
      expect('side' in fileComment).toBe(false)
      expect('lineNumber' in fileComment).toBe(false)
    }
  })

  it('Test G: reducer is pure — does NOT mutate input (Object.freeze assertion)', () => {
    const frozen = Object.freeze([{ ...lineFixture }] as CodeReviewComment[])
    // If the reducer mutates, this will throw a TypeError in strict mode
    expect(() => {
      reduceAnnotations(frozen, {
        type: 'EDIT_COMMENT',
        id: 'c1',
        text: 'mutate attempt',
      })
    }).not.toThrow()
    // Input unchanged
    expect(frozen[0].text).toBe('original line comment')
  })
})
