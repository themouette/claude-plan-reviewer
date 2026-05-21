/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import CommentBubble from './CommentBubble'

const source = readFileSync(
  resolve(__dirname, './CommentBubble.tsx'),
  'utf-8',
)

describe('CommentBubble', () => {
  it('default export is a function', () => {
    expect(typeof CommentBubble).toBe('function')
  })

  it("uses position: 'absolute' for absolute bubble placement", () => {
    expect(source).toContain("position: 'absolute'")
  })

  it('uses var(--color-annotation-comment) for comment type border', () => {
    expect(source).toContain('var(--color-annotation-comment)')
  })

  it('uses var(--color-annotation-delete) for delete type border', () => {
    expect(source).toContain('var(--color-annotation-delete)')
  })

  it('uses var(--color-annotation-replace) for replace type border', () => {
    expect(source).toContain('var(--color-annotation-replace)')
  })

  it('uses aria-expanded for accessibility contract', () => {
    expect(source).toContain('aria-expanded')
  })

  it('uses aria-label for accessibility contract', () => {
    expect(source).toContain('aria-label')
  })

  it('uses WebkitLineClamp for 2-line compact preview', () => {
    expect(source).toContain('WebkitLineClamp')
  })

  it('wires onMouseEnter callback to root article', () => {
    expect(source).toContain('onMouseEnter')
  })

  it('wires onMouseLeave callback to root article', () => {
    expect(source).toContain('onMouseLeave')
  })

  it('wires onClick callback to root article', () => {
    expect(source).toContain('onClick')
  })
})
