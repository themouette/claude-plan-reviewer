import { describe, it, expect } from 'vitest'
import { rangeFromOffsets, useTextSelection } from './useTextSelection'

// ─── helpers ────────────────────────────────────────────────────────────────

/** Build a single-text-node container: <div>text</div> */
function singleTextContainer(text: string): HTMLElement {
  const div = document.createElement('div')
  div.appendChild(document.createTextNode(text))
  document.body.appendChild(div)
  return div
}

/** Build a multi-text-node container: <div><span>foo</span><span>bar</span></div> */
function multiNodeContainer(parts: string[]): HTMLElement {
  const div = document.createElement('div')
  for (const part of parts) {
    const span = document.createElement('span')
    span.appendChild(document.createTextNode(part))
    div.appendChild(span)
  }
  document.body.appendChild(div)
  return div
}

// ─── rangeFromOffsets ────────────────────────────────────────────────────────

describe('rangeFromOffsets', () => {
  it('returns a Range whose toString() equals the expected slice for a single-text-node container', () => {
    const container = singleTextContainer('hello world')
    const range = rangeFromOffsets(container, 6, 11)
    expect(range).not.toBeNull()
    expect(range!.toString()).toBe('world')
  })

  it('returns null when start exceeds total text length', () => {
    const container = singleTextContainer('hi')
    const range = rangeFromOffsets(container, 100, 102)
    expect(range).toBeNull()
  })

  it('correctly resolves offsets spanning across multiple text nodes', () => {
    // "foobar" — foo is in first span (0-2), bar is in second span (3-5)
    const container = multiNodeContainer(['foo', 'bar'])
    // offsets 2→5 should yield "ob" ... wait: 0-indexed
    // "foo" = indices 0,1,2; "bar" = 3,4,5
    // offset 1→4 yields "ooba" — but let's use a clean cross-node range
    // offsets 2→5: from last char of "foo" to last char of "bar"
    const range = rangeFromOffsets(container, 0, 6)
    expect(range).not.toBeNull()
    expect(range!.toString()).toBe('foobar')
  })

  it('resolves a cross-node range selecting chars from both text nodes', () => {
    const container = multiNodeContainer(['hello', ' world'])
    // offsets 3→8: "lo wo"
    const range = rangeFromOffsets(container, 3, 8)
    expect(range).not.toBeNull()
    expect(range!.toString()).toBe('lo wo')
  })
})

// ─── useTextSelection ────────────────────────────────────────────────────────

describe('useTextSelection', () => {
  it('is a function (export shape check)', () => {
    expect(typeof useTextSelection).toBe('function')
  })
})

// ─── CSS.highlights mock (indirect HIGHLIGHT_NAME verification) ───────────────

describe('CSS.highlights mock + selection-lock', () => {
  it('CSS.highlights.set with selection-lock key works via the global mock', () => {
    const div = document.createElement('div')
    div.appendChild(document.createTextNode('test'))
    document.body.appendChild(div)
    const range = rangeFromOffsets(div, 0, 4)
    expect(range).not.toBeNull()
    CSS.highlights.set('selection-lock', new Highlight(range!))
    expect(CSS.highlights.has('selection-lock')).toBe(true)
    CSS.highlights.delete('selection-lock')
  })
})
