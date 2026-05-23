/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import OutlinePane from './OutlinePane'

const source = readFileSync(
  resolve(__dirname, './OutlinePane.tsx'),
  'utf-8',
)

describe('OutlinePane', () => {
  it('exports a function as default', () => {
    expect(typeof OutlinePane).toBe('function')
  })

  it('uses <button> not <a href=> for outline items (OUTLINE-02)', () => {
    expect(source).toContain('<button')
    expect(source).not.toContain('<a href=')
  })

  it('uses scrollIntoView for navigation (click-to-scroll and outline auto-scroll)', () => {
    expect(source).toContain('scrollIntoView')
  })

  it('uses IntersectionObserver for active section tracking (OUTLINE-03)', () => {
    expect(source).toContain('IntersectionObserver')
  })

  it('has aria-label="Document outline" on the nav element (accessibility contract)', () => {
    expect(source).toContain('aria-label="Document outline"')
  })

  it('uses aria-current for active item accessibility marker', () => {
    expect(source).toContain('aria-current')
  })

  it('computes paddingLeft using depth for depth-driven indentation (OUTLINE-01)', () => {
    expect(source).toContain('paddingLeft')
    expect(source).toContain('depth')
  })

  it('uses block: nearest for outline auto-scroll (D-05 — no jarring scroll)', () => {
    expect(source).toContain("block: 'nearest'")
  })

  it('uses block: start for click-to-scroll (D-02)', () => {
    expect(source).toContain("block: 'start'")
  })

  it('does NOT use window.location or history.push (OUTLINE-02 — no URL change)', () => {
    expect(source).not.toContain('window.location')
    expect(source).not.toContain('history.push')
  })
})

describe('OutlinePane annotation count badge (Phase 21)', () => {
  it('source contains annotationCounts prop', () => {
    expect(source).toContain('annotationCounts')
  })

  it('source contains annotationCounts?.get(section.id) count lookup', () => {
    expect(source).toContain('annotationCounts?.get(section.id)')
  })

  it('source contains aria-label with "comments" text', () => {
    expect(source).toMatch(/aria-label=.*comments/)
  })

  it('source contains var(--color-focus) for badge active background', () => {
    expect(source).toContain('var(--color-focus)')
  })

  it('source contains rgba(59, 130, 246, 0.25) for badge inactive background', () => {
    expect(source).toContain('rgba(59, 130, 246, 0.25)')
  })

  it('source contains borderRadius: 8 for badge pill radius', () => {
    expect(source).toContain('borderRadius: 8')
  })

  it('source contains minWidth: 16 for badge min size', () => {
    expect(source).toContain('minWidth: 16')
  })

  it('source contains marginLeft: 8 for badge spacing from section text', () => {
    expect(source).toContain('marginLeft: 8')
  })
})
