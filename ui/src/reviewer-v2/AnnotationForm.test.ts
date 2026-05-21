/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import AnnotationForm from './AnnotationForm'

const source = readFileSync(resolve(__dirname, './AnnotationForm.tsx'), 'utf-8')

describe('AnnotationForm', () => {
  it('default export is a function', () => {
    expect(typeof AnnotationForm).toBe('function')
  })

  it("uses position: 'fixed' for fixed viewport placement", () => {
    expect(source).toContain("position: 'fixed'")
  })

  it('sets width to 280', () => {
    expect(source).toContain('width: 280')
  })

  it('sets zIndex to 20', () => {
    expect(source).toContain('zIndex: 20')
  })

  it('uses aria-label="Add annotation" on the container', () => {
    expect(source).toContain('aria-label="Add annotation"')
  })

  it('uses aria-label="Comment text" on the textarea', () => {
    expect(source).toContain('aria-label="Comment text"')
  })

  it('has autoFocus on the textarea', () => {
    expect(source).toContain('autoFocus')
  })

  it('uses formState.prefill as defaultValue', () => {
    expect(source).toContain('formState.prefill')
  })

  it('has a placeholder prop referencing prefill', () => {
    expect(source).toContain('placeholder=')
  })

  it('handles Cmd+Enter / Ctrl+Enter via metaKey and ctrlKey', () => {
    expect(source).toContain('e.metaKey || e.ctrlKey')
  })

  it("triggers submit on key 'Enter'", () => {
    expect(source).toContain("=== 'Enter'")
  })

  it("cancels on key 'Escape'", () => {
    expect(source).toContain("=== 'Escape'")
  })

  it('calls stopPropagation on the outer container mousedown (Pitfall 3)', () => {
    expect(source).toContain('stopPropagation()')
  })

  it('registers a document mousedown listener for click-outside cancel', () => {
    expect(source).toContain("document.addEventListener('mousedown'")
  })

  it('uses var(--color-focus) for the primary button background', () => {
    expect(source).toContain('var(--color-focus)')
  })

  it('uses var(--color-text-secondary) for the dismiss button color', () => {
    expect(source).toContain('var(--color-text-secondary)')
  })

  it('renders a Post Comment button', () => {
    expect(source).toContain('Post Comment')
  })

  it('renders a Dismiss button', () => {
    expect(source).toContain('Dismiss')
  })

  it('renders the Add a comment placeholder text', () => {
    expect(source).toContain('Add a comment…')
  })

  it('positions the form using formState.rect.top and formState.rect.left', () => {
    expect(source).toContain('formState.rect.top')
    expect(source).toContain('formState.rect.left')
  })

  it('does not import from @testing-library/react', () => {
    expect(source).not.toContain('@testing-library/react')
  })

  it('accepts optional onTextareaChange prop for D-03 auto-submit tracking (Phase 21)', () => {
    expect(source).toContain('onTextareaChange')
  })

  it('textarea has onChange= handler wired to onTextareaChange (Phase 21)', () => {
    expect(source).toContain('onChange=')
  })
})
