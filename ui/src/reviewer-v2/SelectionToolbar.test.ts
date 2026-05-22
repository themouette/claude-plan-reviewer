/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import SelectionToolbar, { QUICK_ACTIONS } from './SelectionToolbar'

const source = readFileSync(resolve(__dirname, './SelectionToolbar.tsx'), 'utf-8')

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
      'Search the web',
      'search codebase',
    ])
  })
})

// ─── Toolbar positioning ──────────────────────────────────────────────────────
//
// The toolbar must anchor to the actual end of the selection, not the right edge
// of the overall bounding box. For multi-line selections getBoundingClientRect()
// returns the widest-line right edge, which can be far from where the drag ended.
// getClientRects() returns one rect per line fragment; the last is the end position.

describe('SelectionToolbar positioning', () => {
  it('uses getClientRects() to get per-line rects (not just getBoundingClientRect)', () => {
    expect(source).toContain('range.getClientRects()')
  })

  it('falls back to getBoundingClientRect() when getClientRects returns no rects', () => {
    expect(source).toContain('range.getBoundingClientRect()')
    expect(source).toContain('rects.length > 0')
  })

  it('anchors top and left to the LAST rect (end of selection)', () => {
    expect(source).toContain('rects[rects.length - 1]')
    expect(source).toContain('lastRect.bottom')
    expect(source).toContain('lastRect.right')
  })
})

// ─── Native selection clearing ────────────────────────────────────────────────
//
// Pill buttons and quick-action menu items use onMouseDown e.preventDefault() to
// keep the browser selection alive until click fires. After the action is dispatched
// we must call window.getSelection().removeAllRanges() ourselves — otherwise the
// blue text highlight stays visible after the toolbar disappears.

describe('SelectionToolbar selection clearing', () => {
  it('removeAllRanges is called at least twice — once per click site (pills + quick-actions)', () => {
    const occurrences = (source.match(/removeAllRanges/g) ?? []).length
    expect(occurrences).toBeGreaterThanOrEqual(2)
  })

  it('pill onClick clears native selection after dispatching onAction', () => {
    // The pill handler must call removeAllRanges AFTER onAction (order matters:
    // onAction closes the toolbar, removeAllRanges clears the highlight).
    const pillHandler = source.match(/onClick=\{.*?onAction\(pill\.type.*?\}.*?\}/s)?.[0] ?? ''
    expect(pillHandler).toContain('removeAllRanges')
  })

  it('quick-action menu item onClick clears native selection', () => {
    const quickActionBlock = source.match(/onAction\('comment', selectedText, label\)[\s\S]*?removeAllRanges/)?.[0] ?? ''
    expect(quickActionBlock).toBeTruthy()
  })
})
