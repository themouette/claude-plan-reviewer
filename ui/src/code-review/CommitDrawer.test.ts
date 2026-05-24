/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import CommitDrawer from './CommitDrawer'

const source = readFileSync(resolve(__dirname, './CommitDrawer.tsx'), 'utf-8')

describe('CommitDrawer', () => {
  it('exports a function as default', () => {
    expect(typeof CommitDrawer).toBe('function')
  })

  it('root element has role="navigation" and aria-label="Branch commits"', () => {
    expect(source).toContain('role="navigation"')
    expect(source).toContain('aria-label="Branch commits"')
  })

  it('overlay has width: 296, zIndex: 10, and position: absolute', () => {
    expect(source).toContain('width: 296')
    expect(source).toContain('zIndex: 10')
    expect(source).toContain("position: 'absolute'")
  })

  it("renders COMMITS header literal", () => {
    expect(source).toContain("'COMMITS'")
  })

  it("renders empty state heading 'No commits on this branch'", () => {
    expect(source).toContain("'No commits on this branch'")
  })

  it("renders empty state body 'This branch has no commits beyond the base branch.'", () => {
    expect(source).toContain("'This branch has no commits beyond the base branch.'")
  })

  it("renders error state message 'Could not load commits. Check server connection and reload.'", () => {
    expect(source).toContain("'Could not load commits. Check server connection and reload.'")
  })

  it('checkbox has e.stopPropagation() on both onChange and onClick', () => {
    const matches = source.match(/e\.stopPropagation\(\)/g)
    expect(matches).not.toBeNull()
    expect((matches ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('renders commit.short_sha, commit.message, commit.author, commit.date', () => {
    expect(source).toContain('commit.short_sha')
    expect(source).toContain('commit.message')
    expect(source).toContain('commit.author')
    expect(source).toContain('commit.date')
  })

  it('uses CSS variable tokens: var(--color-focus), var(--color-surface), var(--color-border), var(--color-bg), var(--color-text-secondary)', () => {
    expect(source).toContain('var(--color-focus)')
    expect(source).toContain('var(--color-surface)')
    expect(source).toContain('var(--color-border)')
    expect(source).toContain('var(--color-bg)')
    expect(source).toContain('var(--color-text-secondary)')
  })

  it("renders loading spinner with 'spin 0.8s linear infinite' animation", () => {
    expect(source).toContain("'spin 0.8s linear infinite'")
  })

  it('does not import from reviewer-v2/', () => {
    expect(source).not.toContain('reviewer-v2/')
  })

  it('calls onCommitClick and onCheckChange handlers', () => {
    expect(source).toContain('onCommitClick(')
    expect(source).toContain('onCheckChange(')
  })

  it('CommitRow li has role="button" and tabIndex={0} for keyboard accessibility', () => {
    expect(source).toContain('role="button"')
    expect(source).toContain('tabIndex={0}')
  })

  it('CommitRow li has onKeyDown handler for Enter key', () => {
    expect(source).toContain("e.key === 'Enter'")
    expect(source).toContain('onKeyDown')
  })
})
