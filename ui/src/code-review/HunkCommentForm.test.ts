/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import HunkCommentForm from './HunkCommentForm'

const source = readFileSync(resolve(__dirname, './HunkCommentForm.tsx'), 'utf-8')

describe('HunkCommentForm', () => {
  it('default export is a function', () => {
    expect(typeof HunkCommentForm).toBe('function')
  })

  it('uses aria-label="Comment text" on the textarea', () => {
    expect(source).toContain('aria-label="Comment text"')
  })

  it('uses aria-label="Add a comment" on the group container', () => {
    expect(source).toContain('aria-label="Add a comment"')
  })

  it('has autoFocus on the textarea', () => {
    expect(source).toContain('autoFocus')
  })

  it('handles Cmd+Enter / Ctrl+Enter via e.metaKey || e.ctrlKey', () => {
    expect(source).toContain('e.metaKey || e.ctrlKey')
  })

  it("cancels on Escape key", () => {
    expect(source).toContain("=== 'Escape'")
  })

  it('renders the Add a comment… placeholder text', () => {
    expect(source).toContain('Add a comment…')
  })

  it("does NOT use position: 'fixed' (inline, not fixed)", () => {
    expect(source).not.toContain("position: 'fixed'")
  })

  it('does NOT register a document addEventListener (no click-outside listener)', () => {
    expect(source).not.toContain('addEventListener')
  })

  it('does not import from @testing-library/react', () => {
    expect(source).not.toContain('@testing-library/react')
  })

  it('does not import from reviewer-v2', () => {
    expect(source).not.toContain('reviewer-v2')
  })

  it('uses var(--color-focus) for submit button background', () => {
    expect(source).toContain('var(--color-focus)')
  })

  it('uses var(--color-surface) for form background', () => {
    expect(source).toContain('var(--color-surface)')
  })

  it('uses var(--color-text-secondary) for dismiss button color', () => {
    expect(source).toContain('var(--color-text-secondary)')
  })

  it('renders a Dismiss button (default cancelLabel)', () => {
    expect(source).toContain('Dismiss')
  })

  it('renders an Add Comment button (default submitLabel)', () => {
    expect(source).toContain('Add Comment')
  })

  it('sets minHeight: 64 on the textarea', () => {
    expect(source).toContain('minHeight: 64')
  })

  it('uses onMouseDown to prevent textarea blur on button click', () => {
    expect(source).toContain('onMouseDown')
  })
})
