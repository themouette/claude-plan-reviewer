/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { rangeFromOffsets, useTextSelection, getElementCharOffset } from './useTextSelection'

const source = readFileSync(resolve(__dirname, './useTextSelection.ts'), 'utf-8')

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

  it('returns a collapsed range when start === end (zero-length selection)', () => {
    const container = singleTextContainer('hello')
    const range = rangeFromOffsets(container, 2, 2)
    expect(range).not.toBeNull()
    expect(range!.collapsed).toBe(true)
    expect(range!.toString()).toBe('')
  })

  it('returns null when end exceeds total text length', () => {
    const container = singleTextContainer('hi')
    const range = rangeFromOffsets(container, 0, 100)
    expect(range).toBeNull()
  })

  it('handles a single-character selection', () => {
    const container = singleTextContainer('abc')
    const range = rangeFromOffsets(container, 1, 2)
    expect(range).not.toBeNull()
    expect(range!.toString()).toBe('b')
  })
})

// ─── useTextSelection ────────────────────────────────────────────────────────

describe('useTextSelection', () => {
  it('is a function (export shape check)', () => {
    expect(typeof useTextSelection).toBe('function')
  })
})

// ─── reset() contract (source assertions) ────────────────────────────────────
//
// reset() is the programmatic clear path called after annotation creation. It must
// remove the CSS highlight, null out stored offsets, and clear selectedText state.
// If any of these are missing, the toolbar or highlight can linger after an action.

describe('useTextSelection reset contract', () => {
  it('reset calls removeHighlight() to clear the CSS custom highlight', () => {
    const resetBody = source.match(/const reset = useCallback\(\(\) => \{[\s\S]*?\}, \[\]\)/)?.[0] ?? ''
    expect(resetBody).toContain('removeHighlight()')
  })

  it('reset nulls storedOffsets.current so getOffsets() returns null afterwards', () => {
    const resetBody = source.match(/const reset = useCallback\(\(\) => \{[\s\S]*?\}, \[\]\)/)?.[0] ?? ''
    expect(resetBody).toContain('storedOffsets.current = null')
  })

  it('reset calls setSelectedText(\'\') to collapse the toolbar', () => {
    const resetBody = source.match(/const reset = useCallback\(\(\) => \{[\s\S]*?\}, \[\]\)/)?.[0] ?? ''
    expect(resetBody).toContain("setSelectedText('')")
  })
})

// ─── mousedown drag guard (source assertions) ────────────────────────────────
//
// Calling setSelectedText during a drag resets the browser selection anchor.
// The mousedown handler must clear the CSS highlight (no re-render) but must NOT
// call setSelectedText — mouseup handles the final state update.

describe('useTextSelection drag guard', () => {
  it('mousedown handler calls removeHighlight but not setSelectedText()', () => {
    const onMouseDownBody = source.match(/const onMouseDown = \(e: MouseEvent\) => \{[\s\S]*?\n    \}/)?.[0] ?? ''
    expect(onMouseDownBody).toContain('removeHighlight()')
    // The comment explains WHY setSelectedText is absent — the call must not be there.
    expect(onMouseDownBody).not.toMatch(/setSelectedText\(/)
  })

  it('capture parameter is prefixed with _ (intentionally unused — only side effects matter)', () => {
    expect(source).toContain('const capture = (_e: MouseEvent)')
  })
})

// ─── getElementCharOffset ────────────────────────────────────────────────────

describe('getElementCharOffset', () => {
  it('returns 0 when target is the container itself', () => {
    const container = singleTextContainer('hello')
    expect(getElementCharOffset(container, container)).toBe(0)
  })

  it('returns the cumulative length of text nodes before the target child span', () => {
    // container: <div><span>foo</span><span>bar</span></div>
    // offset of second span = length of "foo" = 3
    const container = multiNodeContainer(['foo', 'bar'])
    const secondSpan = container.children[1] as HTMLElement
    expect(getElementCharOffset(container, secondSpan)).toBe(3)
  })

  it('handles inline children in headings correctly (Pitfall 6 — uses .contains not ===)', () => {
    // container: <div>text before<h2><code>code</code> heading</h2></div>
    // offset of h2 = length of "text before" = 11
    const container = document.createElement('div')
    container.appendChild(document.createTextNode('text before'))
    const h2 = document.createElement('h2')
    const code = document.createElement('code')
    code.appendChild(document.createTextNode('code'))
    h2.appendChild(code)
    h2.appendChild(document.createTextNode(' heading'))
    container.appendChild(h2)
    document.body.appendChild(container)
    expect(getElementCharOffset(container, h2)).toBe(11)
  })

  it('returns total container text length when target is not a descendant', () => {
    // container has "hello" (5 chars); detached element is not a descendant
    const container = singleTextContainer('hello')
    const detached = document.createElement('span')
    detached.appendChild(document.createTextNode('other'))
    expect(getElementCharOffset(container, detached)).toBe(5)
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

  it('CSS.highlights.delete removes the key (simulates removeHighlight)', () => {
    const div = document.createElement('div')
    div.appendChild(document.createTextNode('abc'))
    document.body.appendChild(div)
    const range = rangeFromOffsets(div, 0, 3)!
    CSS.highlights.set('selection-lock', new Highlight(range))
    CSS.highlights.delete('selection-lock')
    expect(CSS.highlights.has('selection-lock')).toBe(false)
  })
})
