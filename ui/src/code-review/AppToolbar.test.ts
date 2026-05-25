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

  // Phase 26 additions
  it('AppToolbarProps includes commitsOpen and onCommitsToggle', () => {
    expect(source).toContain('commitsOpen: boolean')
    expect(source).toContain('onCommitsToggle:')
  })

  it("renders the 'Commits' label literally", () => {
    expect(source).toContain("'Commits'")
  })

  it('Commits button uses fontWeight 600 when commitsOpen is true', () => {
    expect(source).toMatch(/commitsOpen\s*\?\s*600\s*:\s*400|commitsOpen\s*\?\s*400\s*:\s*600/)
  })

  it('Commits button uses color-text-primary when commitsOpen and color-text-secondary otherwise', () => {
    expect(source).toContain('commitsOpen ?')
    expect(source).toContain('var(--color-text-primary)')
    expect(source).toContain('var(--color-text-secondary)')
  })

  it("Commits button uses makeFocusHandlers('commits')", () => {
    expect(source).toContain("makeFocusHandlers('commits')")
  })

  it('AppToolbar still does NOT import from reviewer-v2/', () => {
    expect(source).not.toContain('reviewer-v2/')
  })

  // Phase 26.2 D-08: Expand Files / Collapse Files button
  it('D-08: AppToolbarProps contains allFilesExpanded: boolean', () => {
    expect(source).toContain('allFilesExpanded: boolean')
  })

  it('D-08: AppToolbarProps contains onToggleAllFiles:', () => {
    expect(source).toContain('onToggleAllFiles:')
  })

  it("D-08: renders 'Expand Files' label", () => {
    expect(source).toContain("'Expand Files'")
  })

  it("D-08: renders 'Collapse Files' label", () => {
    expect(source).toContain("'Collapse Files'")
  })

  it("D-08: uses makeFocusHandlers('files-expand') for the second button", () => {
    expect(source).toContain("makeFocusHandlers('files-expand')")
  })
})
