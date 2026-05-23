/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import FileListPane from './FileListPane'

const source = readFileSync(resolve(__dirname, './FileListPane.tsx'), 'utf-8')

describe('FileListPane', () => {
  it('exports a function as default', () => {
    expect(typeof FileListPane).toBe('function')
  })

  it('uses <button> not <a href=> (DIFF-04 — D-01 no router)', () => {
    expect(source).toContain('<button')
    expect(source).not.toContain('<a href=')
  })

  it('uses IntersectionObserver for active file tracking', () => {
    expect(source).toContain('IntersectionObserver')
  })

  it('uses scrollIntoView for click-to-jump (D-09)', () => {
    expect(source).toContain('scrollIntoView')
  })

  it("uses rootMargin '-10px 0px -85% 0px' (OutlinePane parity)", () => {
    expect(source).toContain("'-10px 0px -85% 0px'")
  })

  it('has aria-label="Changed files" on the nav element', () => {
    expect(source).toContain('aria-label="Changed files"')
  })

  it('uses aria-current for the active entry', () => {
    expect(source).toContain('aria-current')
  })

  it("renders status dots with color #22c55e for added", () => {
    expect(source).toContain("'#22c55e'")
  })

  it("renders status dots with color #ef4444 for removed", () => {
    expect(source).toContain("'#ef4444'")
  })

  it('uses var(--color-focus) for modified status dot color and active left border', () => {
    expect(source).toContain('var(--color-focus)')
  })

  it('uses var(--color-text-secondary) for renamed/copied status dots', () => {
    expect(source).toContain('var(--color-text-secondary)')
  })

  it("renders the rename icon ↳ when status === 'renamed'", () => {
    expect(source).toContain('↳')
  })

  it('omits change counts when additions + deletions equals 0 (binary/pure rename)', () => {
    // The source must have the guard condition
    expect(source).toMatch(/additions \+ deletions(?: !==|===) 0|additions \+ deletions !== 0|additions \+ deletions === 0/)
  })

  it("uses file.filename.split('/').pop() for basename computation", () => {
    expect(source).toContain(".split('/').pop()")
  })

  it('attaches tooltip title attribute with full path or rename mapping', () => {
    expect(source).toContain('title=')
  })

  it('does not import from reviewer-v2/', () => {
    expect(source).not.toContain('reviewer-v2/')
  })

  it('does not use window.location or history.push (no router lib)', () => {
    expect(source).not.toContain('window.location')
    expect(source).not.toContain('history.push')
  })
})
