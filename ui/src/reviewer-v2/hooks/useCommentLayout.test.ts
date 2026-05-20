import { describe, it, expect } from 'vitest'
import { computeCommentLayout } from './useCommentLayout'

describe('computeCommentLayout', () => {
  it('single item: returns top equal to anchorY, isCompact false', () => {
    const result = computeCommentLayout([
      { id: 'a', anchorY: 100, isExpanded: false, height: 48 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ id: 'a', top: 100, isCompact: false })
  })

  it('overlap: pushes second item down and marks it compact when push exceeds threshold', () => {
    // second item anchorY=115, pushed to 100+48+8=156, delta=156-115=41 > PUSH_THRESHOLD=40 => isCompact
    const result = computeCommentLayout([
      { id: 'a', anchorY: 100, isExpanded: false, height: 48 },
      { id: 'b', anchorY: 115, isExpanded: false, height: 48 },
    ])
    expect(result[0].top).toBe(100)
    expect(result[1].top).toBe(156)
    expect(result[1].isCompact).toBe(true)
  })

  it('focused item snaps to anchorY regardless of preceding placement', () => {
    // expanded item at anchorY=130 must receive top=130
    const result = computeCommentLayout([
      { id: 'a', anchorY: 100, isExpanded: false, height: 48 },
      { id: 'b', anchorY: 130, isExpanded: true, height: 120 },
    ])
    const focused = result.find((r) => r.id === 'b')
    expect(focused).toBeDefined()
    expect(focused!.top).toBe(130)
    expect(focused!.isCompact).toBe(false)
  })

  it('empty input returns empty array', () => {
    expect(computeCommentLayout([])).toEqual([])
  })

  it('result preserves all input ids exactly once', () => {
    const items = [
      { id: 'x', anchorY: 50, isExpanded: false, height: 48 },
      { id: 'y', anchorY: 200, isExpanded: false, height: 48 },
      { id: 'z', anchorY: 350, isExpanded: true, height: 120 },
    ]
    const result = computeCommentLayout(items)
    expect(result).toHaveLength(3)
    const ids = result.map((r) => r.id).sort()
    expect(ids).toEqual(['x', 'y', 'z'])
  })
})
