/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import GutterIcon from './GutterIcon'

const source = readFileSync('src/reviewer-v2/GutterIcon.tsx', 'utf8')

describe('GutterIcon source contract', () => {
  it('default export is a function', () => {
    expect(typeof GutterIcon).toBe('function')
  })

  it('positioning math uses scroll-independent offsetTop (Pitfall 3)', () => {
    expect(source).toContain('paragraph.offsetTop + paragraph.offsetHeight / 2')
  })

  it('onMouseDown calls e.preventDefault() to guard selection clearing (Pitfall 1)', () => {
    expect(source).toContain('onMouseDown={(e) => e.preventDefault()}')
  })

  it('aria-label is "Add comment to paragraph" (accessibility)', () => {
    expect(source).toContain('aria-label="Add comment to paragraph"')
  })

  it('right edge anchored at -8 (UI-SPEC column overlap)', () => {
    expect(source).toContain('right: -8')
  })

  it('has data-gutter-icon attribute (used by AnnotationForm click-outside exemption)', () => {
    expect(source).toContain('data-gutter-icon')
  })
})
