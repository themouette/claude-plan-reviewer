/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import ContentPane from './ContentPane'

const source = readFileSync(
  resolve(__dirname, './ContentPane.tsx'),
  'utf-8',
)

describe('ContentPane', () => {
  it('exports a function as default', () => {
    expect(typeof ContentPane).toBe('function')
  })

  it('fetches /api/plan to load the plan markdown', () => {
    expect(source).toContain("fetch('/api/plan')")
  })

  it('uses renderMarkdown to convert markdown to HTML', () => {
    expect(source).toContain('renderMarkdown')
  })

  it('renders the error state copy matching UI-SPEC', () => {
    expect(source).toContain(
      'Could not render plan — The markdown content is unavailable. Reload the page to retry.',
    )
  })

  it('renders loading state with ellipsis copy', () => {
    expect(source).toContain('Loading…')
  })

  it('mounts PlanContent and SelectionToolbar JSX elements', () => {
    expect(source).toContain('<PlanContent')
    expect(source).toContain('<SelectionToolbar')
  })

  it('uses xl spacing token (padding: 32) as ContentPane-owned padding', () => {
    expect(source).toContain('padding: 32')
  })

  it('handleAction stub calls resetTextSelection to clear the selection', () => {
    const handleActionBody = source.match(/function handleAction[^{]*{[^}]*}/s)?.[0]
    expect(handleActionBody).toBeTruthy()
    expect(handleActionBody).toMatch(/resetTextSelection/)
  })
})
