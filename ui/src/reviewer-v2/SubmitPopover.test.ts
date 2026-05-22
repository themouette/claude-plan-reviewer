/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import SubmitPopover from './SubmitPopover'

const source = readFileSync(
  resolve(__dirname, './SubmitPopover.tsx'),
  'utf-8',
)

describe('SubmitPopover', () => {
  it('default export is a function', () => {
    expect(typeof SubmitPopover).toBe('function')
  })

  it('source contains role="dialog"', () => {
    expect(source).toContain('role="dialog"')
  })

  it('source contains aria-label="Send feedback"', () => {
    expect(source).toContain('aria-label="Send feedback"')
  })

  it('source uses autoFocus on the textarea', () => {
    expect(source).toContain('autoFocus')
  })

  it("source contains the placeholder 'Leave a message (optional)'", () => {
    expect(source).toContain('Leave a message (optional)')
  })

  it('source registers an Escape key handler', () => {
    expect(source).toMatch(/e\.key\s*===\s*['"']Escape['"]/)
  })

  it('source registers a Cmd/Ctrl+Enter submit shortcut', () => {
    expect(source).toMatch(/(metaKey|ctrlKey)[\s\S]*?key\s*===\s*['"]Enter['"]/)
  })

  it("source registers an outside-click dismiss handler", () => {
    expect(source).toContain("document.addEventListener('mousedown'")
  })

  it('source registers a global keydown handler', () => {
    expect(source).toContain("document.addEventListener('keydown'")
  })

  it('source calls onSubmit at least twice (button click + Cmd+Enter)', () => {
    const matches = source.match(/onSubmit\(/g)
    expect(matches).toBeTruthy()
    expect(matches!.length).toBeGreaterThanOrEqual(2)
  })

  it('source contains no clipboard or fetch logic', () => {
    expect(source).not.toContain('buildClipboardPayload')
    expect(source).not.toContain('shouldUseClipboard')
    expect(source).not.toContain('navigator.clipboard')
    expect(source.match(/\bfetch\(/) ?? []).toHaveLength(0)
  })

  it("popover button label is 'Send Feedback'", () => {
    expect(source).toContain('Send Feedback')
  })

  it('imports nothing from outside reviewer-v2 (ARCH-01)', () => {
    expect(source).not.toMatch(/from ['"]\.\.\/(?!reviewer-v2)/)
  })
})
