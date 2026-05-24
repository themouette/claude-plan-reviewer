/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import DiffPane from './DiffPane'

const source = readFileSync(resolve(__dirname, './DiffPane.tsx'), 'utf-8')

describe('DiffPane', () => {
  it('exports a function as default', () => {
    expect(typeof DiffPane).toBe('function')
  })

  it("imports PatchDiff from '@pierre/diffs/react'", () => {
    expect(source).toContain("from '@pierre/diffs/react'")
  })

  it('passes disableWorkerPool={true} to PatchDiff (D-11)', () => {
    expect(source).toContain('disableWorkerPool={true}')
  })

  it('passes expansionLineCount and collapsedContextThreshold in options (D-04, UI-SPEC)', () => {
    expect(source).toContain('expansionLineCount: 10')
    expect(source).toContain('collapsedContextThreshold: 3')
  })

  it('reads theme once at module scope via window.matchMedia (D-12)', () => {
    expect(source).toContain("window.matchMedia('(prefers-color-scheme: dark)')")
    // The matchMedia call should appear exactly once
    expect(source.match(/window\.matchMedia/g)?.length).toBe(1)
    // It must be BEFORE the export default function DiffPane
    expect(source.indexOf('window.matchMedia')).toBeLessThan(
      source.indexOf('export default function DiffPane'),
    )
  })

  it('declares DIFF_THEME constant with both github-dark and github-light values', () => {
    expect(source).toContain("'github-dark'")
    expect(source).toContain("'github-light'")
  })

  it("renders binary file placeholder for patch === '[binary file]' (Pitfall 5)", () => {
    expect(source).toContain("'[binary file]'")
    expect(source).toContain('Binary file')
  })

  it("renders id=`file-${index}` anchor div for scroll targets (D-09)", () => {
    // The template literal in source
    expect(source).toContain('`file-${index}`')
  })

  it('renders loading state with @keyframes spin animation', () => {
    expect(source).toContain('animation:')
    expect(source).toContain("'spin 0.8s linear infinite'")
  })

  it("renders empty state copy 'No changes on this branch'", () => {
    expect(source).toContain('No changes on this branch')
  })

  it("renders error state copy 'Could not load diff' and Reload Diff button", () => {
    expect(source).toContain('Could not load diff')
    expect(source).toContain('Reload Diff')
  })

  it('attaches diffPaneRef to the outer scroll container', () => {
    expect(source).toContain('ref={diffPaneRef}')
  })

  it('does not import from reviewer-v2/', () => {
    expect(source).not.toContain('reviewer-v2/')
  })

  it('uses var(--color-bg) background on the outer container', () => {
    expect(source).toContain('var(--color-bg)')
  })

  it('uses var(--color-accent-deny) for the error heading color', () => {
    expect(source).toContain('var(--color-accent-deny)')
  })

  it('extends DiffPaneProps with viewMode, activeCommitSha, and commits optional props', () => {
    expect(source).toContain('viewMode')
    expect(source).toContain('activeCommitSha')
    expect(source).toContain('commits')
    expect(source).toContain("'branch' | 'commit'")
  })

  it("imports Commit type from './types'", () => {
    expect(source).toContain('Commit')
    expect(source).toContain("from './types'")
  })

  it('renders commit title strip when viewMode === commit (activeCommit fields)', () => {
    expect(source).toContain('activeCommit.short_sha')
    expect(source).toContain('activeCommit.message')
    expect(source).toContain('activeCommit.author')
    expect(source).toContain('activeCommit.date')
  })

  it('still does not import from reviewer-v2/', () => {
    expect(source).not.toContain('reviewer-v2/')
  })

  it('renders fallback short SHA when activeCommit lookup returns null (WR-04)', () => {
    expect(source).toContain('activeCommitSha.slice(0, 7)')
  })
})
