/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import AppToolbar from './AppToolbar'

const source = readFileSync(resolve(__dirname, './AppToolbar.tsx'), 'utf-8')

describe('AppToolbar', () => {
  it('exports a function as default', () => {
    expect(typeof AppToolbar).toBe('function')
  })

  it('header strip has height: 48 (matches ReviewerV2Shell)', () => {
    expect(source).toContain('height: 48')
  })

  it('declares flexShrink: 0 on the header to keep it from collapsing', () => {
    expect(source).toContain('flexShrink: 0')
  })

  it("uses 'Code Review' as the title", () => {
    expect(source).toContain('Code Review')
  })

  it('renders the Unified label literally', () => {
    expect(source).toContain("'Unified'")
    expect(source).toContain("'Side-by-side'")
  })

  it('renders all three Expand All labels: Expand All, Collapse, Loading...', () => {
    expect(source).toContain("'Loading...'")
    expect(source).toContain("'Collapse'")
    expect(source).toContain("'Expand All'")
  })

  it('disables the Expand button while contextLoading', () => {
    expect(source).toContain('disabled={contextLoading}')
  })

  it('uses var(--color-surface) for active and inactive backgrounds correctly', () => {
    expect(source).toContain('var(--color-surface)')
    expect(source).toContain('transparent')
  })

  it('renders the reserved slot comment for D-03 future stubs', () => {
    // The comment should mention either Reserved or D-03
    expect(source).toMatch(/Reserved|D-03/)
  })

  it('attaches onFocus and onBlur handlers for focus ring', () => {
    expect(source).toContain('onFocus')
    expect(source).toContain('onBlur')
  })

  it('does not import from reviewer-v2/', () => {
    expect(source).not.toContain('reviewer-v2/')
  })
})
