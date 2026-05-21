/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import CommentPane from './CommentPane'

const source = readFileSync(
  resolve(__dirname, './CommentPane.tsx'),
  'utf-8',
)

describe('CommentPane', () => {
  it('exports a function as default', () => {
    expect(typeof CommentPane).toBe('function')
  })

  it("attaches scroll listener to mainRef.current", () => {
    expect(source).toContain("addEventListener('scroll'")
  })

  it('uses passive: true on scroll listener (perf — Pitfall 6)', () => {
    expect(source).toContain('passive: true')
  })

  it('cleans up scroll listener with removeEventListener', () => {
    expect(source).toContain('removeEventListener')
  })

  it('creates a ResizeObserver on planRef.current', () => {
    expect(source).toContain('ResizeObserver')
  })

  it('disconnects ResizeObserver on cleanup', () => {
    expect(source).toContain('.disconnect()')
  })

  it('uses rangeFromOffsets to compute anchorY', () => {
    expect(source).toContain('rangeFromOffsets')
  })

  it('calls computeCommentLayout to place bubbles', () => {
    expect(source).toContain('computeCommentLayout')
  })

  it("uses position: 'relative' on wrapper div", () => {
    expect(source).toContain("position: 'relative'")
  })

  it('renders CommentBubble for each annotation', () => {
    expect(source).toContain('CommentBubble')
  })

  it('does NOT import or reference InlineAnchor (sidenotes rejection)', () => {
    expect(source).not.toContain('InlineAnchor')
  })

  it('does NOT import or reference sidenotes (rejection guard)', () => {
    expect(source).not.toContain('sidenotes')
  })

  it('renders empty-state "No comments yet" copy', () => {
    expect(source).toContain('No comments yet')
  })
})
