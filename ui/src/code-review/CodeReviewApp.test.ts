/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import CodeReviewApp from './CodeReviewApp'

const source = readFileSync(resolve(__dirname, './CodeReviewApp.tsx'), 'utf-8')

describe('CodeReviewApp', () => {
  it('exports a function as default', () => {
    expect(typeof CodeReviewApp).toBe('function')
  })

  it("imports useDiff from './hooks/useDiff'", () => {
    expect(source).toContain("from './hooks/useDiff'")
    expect(source).toContain('useDiff')
  })

  it('imports AppToolbar, FileListPane, and DiffPane', () => {
    expect(source).toContain('AppToolbar')
    expect(source).toContain('FileListPane')
    expect(source).toContain('DiffPane')
  })

  it("declares diffStyle state with useState<'unified' | 'split'>('unified')", () => {
    expect(source).toContain("useState<'unified' | 'split'>")
    expect(source).toContain("'unified'")
  })

  it('declares contextExpanded state with default false', () => {
    expect(source).toContain('contextExpanded')
    expect(source).toContain('useState(false)')
  })

  it('declares activeIndex state with type number | null', () => {
    expect(source).toContain('activeIndex')
    expect(source).toContain('number | null')
  })

  it('declares diffPaneRef as useRef<HTMLDivElement>(null)', () => {
    expect(source).toContain('useRef<HTMLDivElement>(null)')
  })

  it('calls useDiff() and destructures files, loading, error, refetch', () => {
    expect(source).toContain('useDiff()')
    expect(source).toContain('files')
    expect(source).toContain('loading')
    expect(source).toContain('error')
    expect(source).toContain('refetch')
  })

  it('passes diffStyle and onDiffStyleChange to AppToolbar', () => {
    expect(source).toContain('diffStyle={diffStyle}')
    expect(source).toContain('onDiffStyleChange={setDiffStyle}')
  })

  it('passes contextLoading={loading && contextExpanded} to AppToolbar (loading shown only during Expand All re-fetch)', () => {
    expect(source).toContain('contextLoading={loading && contextExpanded}')
  })

  it('handleExpandAll toggles contextExpanded and refetches with 999 or no arg', () => {
    expect(source).toContain('refetch(999)')
    expect(source).toContain('refetch()')
  })

  it('handleReload preserves contextExpanded state by passing 999 or undefined', () => {
    expect(source).toContain('refetch(contextExpanded ? 999 : undefined)')
  })

  it('passes diffPaneRef to BOTH FileListPane and DiffPane', () => {
    const matches = source.match(/diffPaneRef={diffPaneRef}/g)
    expect(matches).not.toBeNull()
    expect((matches ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('outer body row uses flex layout with minHeight: 0 (mirrors ReviewerV2Shell)', () => {
    expect(source).toContain('minHeight: 0')
    expect(source).toContain('display: \'flex\'')
  })

  it("file list sidebar is 240px wide (UI-SPEC override of ReviewerV2 200px)", () => {
    expect(source).toContain('width: 240')
  })

  it('does NOT call useHeartbeat (RESEARCH Open Question 1)', () => {
    expect(source).not.toContain('useHeartbeat')
  })

  it('does NOT import from reviewer-v2/', () => {
    expect(source).not.toContain('reviewer-v2/')
  })

  it('resets activeIndex when files.length changes', () => {
    expect(source).toContain('[files.length]')
  })
})
