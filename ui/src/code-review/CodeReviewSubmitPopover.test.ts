/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import CodeReviewSubmitPopover from './CodeReviewSubmitPopover'

const source = readFileSync(resolve(__dirname, './CodeReviewSubmitPopover.tsx'), 'utf-8')

describe('CodeReviewSubmitPopover', () => {
  it('Test 1: Component default export is a function', () => {
    expect(typeof CodeReviewSubmitPopover).toBe('function')
  })

  it('Test 2: Source contains aria-label="Send review"', () => {
    expect(source).toContain('aria-label="Send review"')
  })

  it("Test 3: Source contains the textarea label string 'Message (optional)'", () => {
    expect(source).toContain('Message (optional)')
  })

  it("Test 4: Source contains the textarea placeholder 'Leave a message for the agent (optional)'", () => {
    expect(source).toContain('Leave a message for the agent (optional)')
  })

  it("Test 5: Source contains the submit button label 'Send Review'", () => {
    expect(source).toContain('Send Review')
  })

  it('Test 6: Source contains var(--color-accent-approve) (the submit button background — green, NOT red)', () => {
    expect(source).toContain('var(--color-accent-approve)')
  })

  it('Test 7: Source does NOT contain messageRequired (prop removed — message is always optional)', () => {
    expect(source).not.toContain('messageRequired')
  })

  it("Test 8: Source contains position: 'absolute' and top: 40 and right: 0 and minWidth: 320", () => {
    expect(source).toContain("position: 'absolute'")
    expect(source).toContain('top: 40')
    expect(source).toContain('right: 0')
    expect(source).toContain('minWidth: 320')
  })

  it("Test 9: Source contains Escape-key + outside-click handlers (both 'Escape' and rootRef.current)", () => {
    expect(source).toContain("'Escape'")
    expect(source).toContain('rootRef.current')
  })

  it("Test 10: Source contains Cmd+Enter shortcut — (e.metaKey || e.ctrlKey) && e.key === 'Enter'", () => {
    expect(source).toContain('(e.metaKey || e.ctrlKey) && e.key === \'Enter\'')
  })

  it('Test 11: Source contains autoFocus on the textarea', () => {
    expect(source).toContain('autoFocus')
  })

  it('Test 12: Source does not import from reviewer-v2/', () => {
    expect(source).not.toContain('reviewer-v2/')
  })
})
