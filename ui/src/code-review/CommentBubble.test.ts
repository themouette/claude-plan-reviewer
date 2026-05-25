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

  it('renders aria-label="Edit comment" on pencil button', () => {
    expect(source).toContain('aria-label="Edit comment"')
  })

  it('renders aria-label="Delete comment" on × button', () => {
    expect(source).toContain('aria-label="Delete comment"')
  })

  it('renders pencil ✎ unicode character', () => {
    expect(source).toContain('✎')
  })

  it('renders × unicode character for delete', () => {
    expect(source).toContain('×')
  })

  it('references createdAt for timestamp display', () => {
    expect(source).toContain('createdAt')
  })

  it('formats timestamp with toLocaleString()', () => {
    expect(source).toContain('toLocaleString()')
  })

  it('uses borderLeft for the accent border', () => {
    expect(source).toContain('borderLeft')
  })

  it('uses var(--color-focus) for accent border and focus ring', () => {
    expect(source).toContain('var(--color-focus)')
  })

  it('uses var(--color-accent-deny) for delete button hover color', () => {
    expect(source).toContain('var(--color-accent-deny)')
  })

  it('uses var(--color-surface) for card background', () => {
    expect(source).toContain('var(--color-surface)')
  })

  it('uses var(--color-text-secondary) for timestamp and icon button default color', () => {
    expect(source).toContain('var(--color-text-secondary)')
  })

  it('applies bubble-icon-btn className to icon buttons', () => {
    expect(source).toContain('bubble-icon-btn')
  })

  it('uses HunkCommentForm for edit mode', () => {
    expect(source).toContain('HunkCommentForm')
  })

  it('uses Save Changes submitLabel when editing', () => {
    expect(source).toContain('Save Changes')
  })

  it('uses Discard Changes cancelLabel when editing', () => {
    expect(source).toContain('Discard Changes')
  })

  it("does NOT use position: 'absolute' (inline, not absolute)", () => {
    expect(source).not.toContain("position: 'absolute'")
  })

  it('does not import from reviewer-v2', () => {
    expect(source).not.toContain('reviewer-v2')
  })

  it('does not import from @testing-library/react', () => {
    expect(source).not.toContain('@testing-library/react')
  })

  it('does not use isCompact prop (no compact/expanded collapse states)', () => {
    expect(source).not.toContain('isCompact')
  })

  it('does not use isFocused prop (no compact/expanded collapse states)', () => {
    expect(source).not.toContain('isFocused')
  })
})
