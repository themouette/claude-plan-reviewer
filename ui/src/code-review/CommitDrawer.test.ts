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

  it('D-01: drawer has width: 296 and flexShrink: 0 (flex sibling, not overlay)', () => {
    expect(source).toContain('width: 296')
    expect(source).toContain('flexShrink: 0')
  })

  it('D-01: drawer does NOT have position: absolute (no longer an overlay)', () => {
    expect(source).not.toContain("position: 'absolute'")
  })

  it('D-01: drawer does NOT have zIndex: 10', () => {
    expect(source).not.toContain('zIndex: 10')
  })

  it('D-06: drawer has NO checkbox input element', () => {
    expect(source).not.toContain('type="checkbox"')
  })

  it('D-06: drawer does NOT have onCheckChange prop', () => {
    expect(source).not.toContain('onCheckChange')
  })

  it('D-02: drawer does NOT have checkedCommitShas prop', () => {
    expect(source).not.toContain('checkedCommitShas')
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

  it('D-02: uses selectedCommitShas prop for selection state', () => {
    expect(source).toContain('selectedCommitShas')
  })

  it('D-02: uses selectedCommitShas.includes( for row highlight', () => {
    expect(source).toContain('selectedCommitShas.includes(')
  })

  it('D-11: renders commit.branches.map for branch pills', () => {
    expect(source).toContain('commit.branches.map')
  })

  it('D-11: renders commit.tags.map for tag pills', () => {
    expect(source).toContain('commit.tags.map')
  })

  it("D-11: branch pills use 'branch:' prefix format", () => {
    expect(source).toContain('branch:')
  })

  it("D-11: tag pills use 'tag:' prefix format", () => {
    expect(source).toContain('tag:')
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

  it('synthetic entries: detected by full SHA sentinel strings', () => {
    expect(source).toContain("'0000000000000000000000000000000000000000'")
    expect(source).toContain("'0000000000000000000000000000000000000001'")
  })

  it('uncommitted entry: SHA chip uses amber color token (--color-annotation-replace)', () => {
    expect(source).toContain('var(--color-annotation-replace)')
  })

  it('uncommitted entry: SHA chip uses amber background rgba(245,158,11,0.12)', () => {
    expect(source).toContain('rgba(245,158,11,0.12)')
  })

  it('untracked entry: SHA chip uses green color token (--color-accent-approve)', () => {
    expect(source).toContain('var(--color-accent-approve)')
  })

  it('untracked entry: SHA chip uses green background rgba(34,197,94,0.12)', () => {
    expect(source).toContain('rgba(34,197,94,0.12)')
  })

  it('synthetic entries: bottom border separator uses --color-border token', () => {
    expect(source).toContain('borderBottom:')
    expect(source).toContain("'1px solid var(--color-border)'")
  })

  it('synthetic entries: message text uses fontStyle italic', () => {
    expect(source).toContain("fontStyle: isSynthetic ? 'italic' : undefined")
  })

  it('synthetic entries: author/date line is conditional on author or date being non-empty', () => {
    expect(source).toContain('(commit.author || commit.date)')
  })

  it('calls onCommitClick handler with sha and event', () => {
    expect(source).toContain('onCommitClick(commit.sha,')
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
