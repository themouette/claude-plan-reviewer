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

  it('short-circuits hover state when selectedText is non-empty AND form is not open', () => {
    expect(source).toMatch(/if \(selectedText && !formOpen\) return/)
  })

  it('delegates hover detection to the correct element selector', () => {
    expect(source).toContain("target.closest('p, pre, li, blockquote, h1, h2, h3, h4, h5, h6')")
  })

  it('shows GutterIcon when no text selected OR form is open', () => {
    expect(source).toContain('!selectedText || formOpen')
  })

  it('accepts formOpen prop to keep hover tracking active during form', () => {
    expect(source).toContain('formOpen')
  })

  it('injects markdown HTML via dangerouslySetInnerHTML', () => {
    expect(source).toContain('dangerouslySetInnerHTML')
  })

  it('applies existing .plan-prose styles', () => {
    expect(source).toContain('className="plan-prose"')
  })

  it('uses an absolutely-positioned overlay sibling for hover (no DOM mutation)', () => {
    expect(source).toContain('paragraph-hover-overlay')
    expect(source).toContain("pointerEvents: 'none'")
    expect(source).not.toContain("classList.add('paragraph-hovered')")
  })

  it('uses onMouseOut with relatedTarget guard (not onMouseLeave)', () => {
    expect(source).toContain('onMouseOut={handleMouseOut}')
    expect(source).toContain('e.currentTarget.contains(relatedTarget)')
    expect(source).not.toContain('onMouseLeave')
  })

  it('onAdd prop type accepts HTMLElement argument (Phase 21 Task 1)', () => {
    expect(source).toContain('(el: HTMLElement) => void')
  })

  it('GutterIcon receives a closure that passes hoveredParagraph (Phase 21 Task 1)', () => {
    expect(source).toContain('onAdd(hoveredParagraph)')
  })
})
