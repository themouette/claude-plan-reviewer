/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import PlanContent from './PlanContent'

const source = readFileSync(
  resolve(__dirname, './PlanContent.tsx'),
  'utf-8',
)

describe('PlanContent', () => {
  it('exports a function as default', () => {
    expect(typeof PlanContent).toBe('function')
  })

  it('short-circuits hover state when selectedText is non-empty', () => {
    expect(source).toMatch(/if \(selectedText\) return/)
  })

  it('delegates hover detection to the correct element selector', () => {
    expect(source).toContain("target.closest('p, pre, li, blockquote, h1, h2, h3, h4, h5, h6')")
  })

  it('suppresses GutterIcon when text is selected', () => {
    expect(source).toContain('hoveredParagraph && !selectedText')
  })

  it('injects markdown HTML via dangerouslySetInnerHTML', () => {
    expect(source).toContain('dangerouslySetInnerHTML')
  })

  it('applies existing .plan-prose styles', () => {
    expect(source).toContain('className="plan-prose"')
  })

  it('uses CSS class toggle for hover background (not inline style)', () => {
    expect(source).toContain("classList.add('paragraph-hovered')")
    expect(source).toContain("classList.remove('paragraph-hovered')")
    expect(source).not.toContain('style.background')
  })
})
