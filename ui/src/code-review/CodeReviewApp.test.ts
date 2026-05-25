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
    expect(source).toContain('useDiff(')
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

  // Phase 26 additions
  it("imports CommitDrawer", () => {
    expect(source).toContain("import CommitDrawer from './CommitDrawer'")
  })

  it("imports useCommits", () => {
    expect(source).toContain("from './hooks/useCommits'")
    expect(source).toContain('useCommits()')
  })

  it('declares drawerOpen and selectedCommitShas state (D-02: single selection state)', () => {
    expect(source).toContain('drawerOpen')
    expect(source).toContain('selectedCommitShas')
  })

  it('declares selectedCommitShas as useState<string[]>([])', () => {
    expect(source).toContain('useState<string[]>([])')
  })

  it('does NOT have checkedCommitShas state variable (D-02: removed)', () => {
    expect(source).not.toContain('checkedCommitShas')
  })

  it('does NOT have seededRef (D-02: seeding logic removed)', () => {
    expect(source).not.toContain('seededRef')
  })

  it('does NOT have setViewMode calls (D-02: viewMode state removed)', () => {
    expect(source).not.toContain('setViewMode(')
  })

  it('passes commitsOpen and onCommitsToggle to AppToolbar', () => {
    expect(source).toContain('commitsOpen={drawerOpen}')
    expect(source).toContain('onCommitsToggle={')
  })

  it('passes viewMode, activeCommitSha, commits to DiffPane', () => {
    expect(source).toContain('viewMode={')
    expect(source).toContain('activeCommitSha={activeCommitSha}')
    expect(source).toContain('commits={commits}')
  })

  it('conditionally renders CommitDrawer when drawerOpen', () => {
    expect(source).toContain('{drawerOpen &&')
    expect(source).toContain('<CommitDrawer')
  })

  it('handleCommitClick implements click/CMD/Shift semantics (D-03)', () => {
    expect(source).toContain('handleCommitClick')
    expect(source).toContain('event.metaKey')
    expect(source).toContain('event.ctrlKey')
    expect(source).toContain('event.shiftKey')
  })

  it('selector derived from selectedCommitShas.length (D-04)', () => {
    expect(source).toContain('selectedCommitShas.length === 1')
  })

  it('computes allSelected and branchName for DiffPane (D-05)', () => {
    expect(source).toContain('allSelected')
    expect(source).toContain('branchName')
  })

  it('passes allSelected and branchName to DiffPane (D-05)', () => {
    expect(source).toContain('allSelected={allSelected}')
    expect(source).toContain('branchName={branchName}')
  })

  it('keyboard handler listens for ArrowLeft and ArrowRight only', () => {
    expect(source).toContain("'ArrowLeft'")
    expect(source).toContain("'ArrowRight'")
    expect(source).not.toContain("'ArrowUp'")
    expect(source).not.toContain("'ArrowDown'")
  })

  it('keyboard handler is gated on selectedCommitShas.length === 1 (D-04)', () => {
    expect(source).toContain('selectedCommitShas.length !== 1')
  })

  it('keyboard handler stops at boundaries (no wrap)', () => {
    expect(source).toContain('idx > 0')
    expect(source).toContain('idx < commits.length - 1')
  })

  it('still does not import from reviewer-v2/', () => {
    expect(source).not.toContain('reviewer-v2/')
  })

  // Phase 26.2 D-07/D-08: collapsedFiles state and handlers
  it('D-07: declares collapsedFiles state with useState<Set<string>>(new Set())', () => {
    expect(source).toContain('collapsedFiles')
    expect(source).toContain('useState<Set<string>>')
  })

  it('D-07: declares handleToggleFile function', () => {
    expect(source).toContain('handleToggleFile')
  })

  it('D-08: declares handleToggleAllFiles function', () => {
    expect(source).toContain('handleToggleAllFiles')
  })

  it('D-08: derives allFilesExpanded from collapsedFiles.size === 0', () => {
    expect(source).toContain('allFilesExpanded')
    expect(source).toContain('collapsedFiles.size === 0')
  })

  it('D-08: passes allFilesExpanded and onToggleAllFiles to AppToolbar', () => {
    expect(source).toContain('allFilesExpanded={allFilesExpanded}')
    expect(source).toContain('onToggleAllFiles={handleToggleAllFiles}')
  })

  it('D-07: passes collapsedFiles and onToggleFile to DiffPane', () => {
    expect(source).toContain('collapsedFiles={collapsedFiles}')
    expect(source).toContain('onToggleFile={handleToggleFile}')
  })

  // Phase 27: comments state ownership + commentCounts + wiring (D-08/D-09/D-10)
  it('Phase 27: imports useCodeReviewAnnotations hook', () => {
    expect(source).toContain('useCodeReviewAnnotations')
    expect(source).toContain("from './hooks/useCodeReviewAnnotations'")
  })

  it('Phase 27: calls useCodeReviewAnnotations and destructures addComment, editComment, deleteComment', () => {
    expect(source).toContain('addComment')
    expect(source).toContain('editComment')
    expect(source).toContain('deleteComment')
  })

  it('Phase 27: handleAddLineComment uses crypto.randomUUID() for id generation', () => {
    expect(source).toContain('crypto.randomUUID()')
  })

  it('Phase 27: handleAddLineComment uses new Date().toISOString() for createdAt', () => {
    expect(source).toContain('new Date().toISOString()')
  })

  it('Phase 27: derives commentCounts with useMemo (D-10)', () => {
    expect(source).toContain('commentCounts')
    expect(source).toContain('useMemo')
  })

  it('Phase 27: commentCounts loop body uses counts[c.file]', () => {
    expect(source).toContain('counts[c.file]')
  })

  it('Phase 27: passes commentCounts to FileListPane (D-10)', () => {
    expect(source).toContain('commentCounts={commentCounts}')
  })

  it('Phase 27: passes comments to DiffPane', () => {
    expect(source).toContain('comments={comments}')
  })

  it('Phase 27: passes onAddLineComment={handleAddLineComment} to DiffPane', () => {
    expect(source).toContain('onAddLineComment={handleAddLineComment}')
  })

  it('Phase 27: passes onAddFileComment={handleAddFileComment} to DiffPane', () => {
    expect(source).toContain('onAddFileComment={handleAddFileComment}')
  })

  it('Phase 27: passes onEditComment={editComment} to DiffPane', () => {
    expect(source).toContain('onEditComment={editComment}')
  })

  it('Phase 27: passes onDeleteComment={deleteComment} to DiffPane', () => {
    expect(source).toContain('onDeleteComment={deleteComment}')
  })

  it('Phase 27: does not reset comments to empty array (D-09: persistence across commit nav)', () => {
    expect(source).not.toMatch(/(setComments|setComment)\s*\(\s*\[\s*\]\s*\)/)
  })

  it('Phase 27: does not import from reviewer-v2/ (preserved)', () => {
    expect(source).not.toContain('reviewer-v2')
  })
})
