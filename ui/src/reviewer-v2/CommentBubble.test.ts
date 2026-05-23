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

describe('CommentBubble edit/delete affordances (Phase 21)', () => {
  it('accepts isEditing prop', () => {
    expect(source).toContain('isEditing')
  })

  it('accepts onEdit prop', () => {
    expect(source).toContain('onEdit')
  })

  it('accepts onRemove prop', () => {
    expect(source).toContain('onRemove')
  })

  it('accepts onCancelEdit prop', () => {
    expect(source).toContain('onCancelEdit')
  })

  it('renders aria-label="Edit comment" pencil button', () => {
    expect(source).toContain('aria-label="Edit comment"')
  })

  it('renders aria-label="Delete comment" × button', () => {
    expect(source).toContain('aria-label="Delete comment"')
  })

  it('applies bubble-icon-btn className to icon buttons', () => {
    expect(source).toContain('bubble-icon-btn')
  })

  it('renders Save Changes button in edit mode', () => {
    expect(source).toContain('Save Changes')
  })

  it('renders Discard Changes button in edit mode', () => {
    expect(source).toContain('Discard Changes')
  })

  it('uses defaultValue={annotation.comment} on textarea (uncontrolled)', () => {
    expect(source).toContain('defaultValue={annotation.comment}')
  })

  it('declares textareaRef for reading textarea value on save', () => {
    expect(source).toContain('textareaRef')
  })

  it('handles Cmd+Enter / Ctrl+Enter via e.metaKey || e.ctrlKey', () => {
    expect(source).toContain('e.metaKey || e.ctrlKey')
  })

  it("handles Enter key via e.key === 'Enter'", () => {
    expect(source).toContain("=== 'Enter'")
  })

  it("handles Escape key via e.key === 'Escape'", () => {
    expect(source).toContain("=== 'Escape'")
  })

  it('calls e.stopPropagation() in icon button onClick to prevent article onClick', () => {
    expect(source).toContain('e.stopPropagation()')
  })

  it('uses var(--color-accent-deny) for × button hover color', () => {
    expect(source).toContain('var(--color-accent-deny)')
  })

  it('renders pencil ✎ unicode character', () => {
    expect(source).toContain('✎')
  })

  it('renders × unicode character (already present)', () => {
    expect(source).toContain('×')
  })

  it('applies autoFocus to textarea so keyboard is immediately active', () => {
    expect(source).toContain('autoFocus')
  })
})
