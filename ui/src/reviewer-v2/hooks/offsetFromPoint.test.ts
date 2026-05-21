import { describe, it, expect, vi, afterEach } from 'vitest'
import { offsetFromPoint } from './offsetFromPoint'

describe('offsetFromPoint', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the character offset using caretRangeFromPoint (WebKit/Blink path)', () => {
    const container = document.createElement('div')
    const textNode = document.createTextNode('hello world')
    container.appendChild(textNode)
    document.body.appendChild(container)

    const range = document.createRange()
    range.setStart(textNode, 5)
    range.setEnd(textNode, 5)

    vi.spyOn(document, 'caretRangeFromPoint').mockReturnValue(range)

    const result = offsetFromPoint(container, 10, 10)
    expect(result).toBe(5)

    document.body.removeChild(container)
  })

  it('falls back to caretPositionFromPoint when caretRangeFromPoint is undefined', () => {
    const container = document.createElement('div')
    const textNode = document.createTextNode('hello world')
    container.appendChild(textNode)
    document.body.appendChild(container)

    vi.spyOn(document, 'caretRangeFromPoint').mockImplementation(undefined as unknown as typeof document.caretRangeFromPoint)
    // @ts-expect-error caretPositionFromPoint is not in jsdom typings but we stub it
    vi.spyOn(document, 'caretPositionFromPoint').mockReturnValue({
      offsetNode: textNode,
      offset: 3,
    })

    const result = offsetFromPoint(container, 10, 10)
    expect(result).toBe(3)

    document.body.removeChild(container)
  })

  it('returns null when the caret node is outside the container', () => {
    const container = document.createElement('div')
    container.appendChild(document.createTextNode('inside'))
    document.body.appendChild(container)

    const outsideDiv = document.createElement('div')
    const outsideText = document.createTextNode('outside')
    outsideDiv.appendChild(outsideText)
    document.body.appendChild(outsideDiv)

    const range = document.createRange()
    range.setStart(outsideText, 2)
    range.setEnd(outsideText, 2)

    vi.spyOn(document, 'caretRangeFromPoint').mockReturnValue(range)

    const result = offsetFromPoint(container, 10, 10)
    expect(result).toBeNull()

    document.body.removeChild(container)
    document.body.removeChild(outsideDiv)
  })

  it('correctly walks multiple text nodes to compute the cumulative offset', () => {
    const container = document.createElement('div')
    const textNode1 = document.createTextNode('foo')
    const textNode2 = document.createTextNode('bar')
    container.appendChild(textNode1)
    container.appendChild(textNode2)
    document.body.appendChild(container)

    const range = document.createRange()
    range.setStart(textNode2, 2)
    range.setEnd(textNode2, 2)

    vi.spyOn(document, 'caretRangeFromPoint').mockReturnValue(range)

    // 3 chars from 'foo' + 2 chars into 'bar' = offset 5
    const result = offsetFromPoint(container, 10, 10)
    expect(result).toBe(5)

    document.body.removeChild(container)
  })

  it('returns null when neither caretRangeFromPoint nor caretPositionFromPoint is available', () => {
    const container = document.createElement('div')
    container.appendChild(document.createTextNode('text'))
    document.body.appendChild(container)

    vi.spyOn(document, 'caretRangeFromPoint').mockImplementation(undefined as unknown as typeof document.caretRangeFromPoint)
    // @ts-expect-error caretPositionFromPoint stub
    document.caretPositionFromPoint = undefined

    const result = offsetFromPoint(container, 10, 10)
    expect(result).toBeNull()

    document.body.removeChild(container)
  })
})
