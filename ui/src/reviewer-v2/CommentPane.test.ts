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

describe('CommentPane editingId + sticky wrapper (Phase 21)', () => {
  it('accepts editingId prop', () => {
    expect(source).toContain('editingId')
  })

  it('uses editingId === ann.id to determine editing state', () => {
    expect(source).toContain('editingId === ann.id')
  })

  it("uses position: 'sticky' for the editing bubble wrapper", () => {
    expect(source).toContain("position: 'sticky'")
  })

  it('uses top: 16 for sticky pinning', () => {
    expect(source).toContain('top: 16')
  })

  it("uses position: 'absolute' for non-editing bubble wrappers", () => {
    expect(source).toContain("position: 'absolute'")
  })

  it('passes isEditing={editingId === ann.id} to CommentBubble', () => {
    expect(source).toContain('isEditing={editingId === ann.id}')
  })

  it('binds id in onEdit closure: onEdit={(newComment) => onEdit(ann.id, newComment)}', () => {
    expect(source).toContain('onEdit={(newComment) => onEdit(ann.id, newComment)}')
  })

  it('binds id in onRemove closure: onRemove={() => onRemove(ann.id)}', () => {
    expect(source).toContain('onRemove={() => onRemove(ann.id)}')
  })

  it('passes onCancelEdit={onCancelEdit} directly (no id binding needed)', () => {
    expect(source).toContain('onCancelEdit={onCancelEdit}')
  })
})
