import { describe, it, expect } from 'vitest'
import SelectionToolbar, { QUICK_ACTIONS } from './SelectionToolbar'

describe('SelectionToolbar', () => {
  it('default export is a function', () => {
    expect(typeof SelectionToolbar).toBe('function')
  })
})

describe('QUICK_ACTIONS', () => {
  it('contains exactly 6 entries', () => {
    expect(QUICK_ACTIONS).toHaveLength(6)
  })

  it('first entry is "clarify this" (anchor against App.tsx line 194)', () => {
    expect(QUICK_ACTIONS[0]).toBe('clarify this')
  })

  it('last entry is "search codebase"', () => {
    expect(QUICK_ACTIONS[5]).toBe('search codebase')
  })

  it('equals the exact 6-label tuple from REQUIREMENTS.md COMMENT-04', () => {
    expect([...QUICK_ACTIONS]).toEqual([
      'clarify this',
      'needs test',
      'give me an example',
      'out of scope',
      'search internet',
      'search codebase',
    ])
  })
})
