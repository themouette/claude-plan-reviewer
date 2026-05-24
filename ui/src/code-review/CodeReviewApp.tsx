import { useEffect, useRef, useState } from 'react'
import AppToolbar from './AppToolbar'
import CommitDrawer from './CommitDrawer'
import FileListPane from './FileListPane'
import DiffPane from './DiffPane'
import { useDiff } from './hooks/useDiff'
import type { DiffFetchSelector } from './hooks/useDiff'
import { useCommits } from './hooks/useCommits'

export default function CodeReviewApp(): React.JSX.Element {
  const [diffStyle, setDiffStyle] = useState<'unified' | 'split'>('unified')
  const [contextExpanded, setContextExpanded] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  // Phase 26.2 D-02: single selectedCommitShas replaces the old tri-state (viewMode + activeCommitSha + multi-select)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedCommitShas, setSelectedCommitShas] = useState<string[]>([])

  const diffPaneRef = useRef<HTMLDivElement>(null)
  const { commits, loading: commitsLoading, error: commitsError } = useCommits()

  // D-04: Compute useDiff selector from selectedCommitShas length
  const selector: DiffFetchSelector =
    selectedCommitShas.length === 1
      ? { mode: 'commit', sha: selectedCommitShas[0] }
      : selectedCommitShas.length >= 2 && commits.length > 0 && selectedCommitShas.length < commits.length
        ? { mode: 'branch-union', shas: selectedCommitShas }
        : { mode: 'branch' }

  const { files, loading, error, refetch } = useDiff({ selector })

  function handleExpandAll() {
    if (contextExpanded) {
      setContextExpanded(false)
      refetch()
    } else {
      setContextExpanded(true)
      refetch(999)
    }
  }

  function handleReload() {
    refetch(contextExpanded ? 999 : undefined)
  }

  // D-01: closing the drawer preserves selection (no viewMode/activeCommitSha to reset)
  function handleCommitsToggle() {
    setDrawerOpen(open => !open)
  }

  // D-03: handleCommitClick implements click / CMD+click / Shift+click selection
  function handleCommitClick(sha: string, event: React.MouseEvent) {
    if (event.shiftKey && selectedCommitShas.length > 0) {
      // Shift+click: range-select from last selected to clicked commit
      const anchor = selectedCommitShas[selectedCommitShas.length - 1]
      const anchorIdx = commits.findIndex((c) => c.sha === anchor)
      const clickIdx = commits.findIndex((c) => c.sha === sha)
      if (anchorIdx !== -1 && clickIdx !== -1) {
        const start = Math.min(anchorIdx, clickIdx)
        const end = Math.max(anchorIdx, clickIdx)
        const range = commits.slice(start, end + 1).map((c) => c.sha)
        setSelectedCommitShas((prev) => Array.from(new Set([...prev, ...range])))
        return
      }
    }
    if (event.metaKey || event.ctrlKey) {
      // CMD/Ctrl+click: toggle sha in selection
      setSelectedCommitShas((prev) =>
        prev.includes(sha) ? prev.filter((s) => s !== sha) : [...prev, sha],
      )
      return
    }
    // Plain click: replace selection with single commit
    setSelectedCommitShas([sha])
  }

  // Reset active index when files change (e.g., after refetch).
  // setState is deferred to avoid triggering the react-hooks/set-state-in-effect rule.
  useEffect(() => {
    const id = setTimeout(() => setActiveIndex(files.length > 0 ? 0 : null), 0)
    return () => clearTimeout(id)
  }, [files.length])

  // D-04: keyboard navigation — left/right only when exactly one commit is selected
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (selectedCommitShas.length !== 1 || commits.length === 0) return
      const idx = commits.findIndex((c) => c.sha === selectedCommitShas[0])
      if (idx === -1) return
      if (e.key === 'ArrowLeft' && idx > 0) setSelectedCommitShas([commits[idx - 1].sha])
      else if (e.key === 'ArrowRight' && idx < commits.length - 1) setSelectedCommitShas([commits[idx + 1].sha])
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedCommitShas, commits])

  // D-05: derive branchName and allSelected for DiffPane branch label
  const allSelected = commits.length > 0 && selectedCommitShas.length === commits.length
  const branchName = commits[0]?.branches?.[0] ?? 'HEAD'
  // Pass activeCommitSha for backwards compatibility with DiffPane's per-commit title strip
  const activeCommitSha = selectedCommitShas.length === 1 ? selectedCommitShas[0] : null

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <AppToolbar
        diffStyle={diffStyle}
        contextExpanded={contextExpanded}
        contextLoading={loading && contextExpanded}
        onDiffStyleChange={setDiffStyle}
        onExpandAll={handleExpandAll}
        commitsOpen={drawerOpen}
        onCommitsToggle={handleCommitsToggle}
      />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', position: 'relative' }}>
        {drawerOpen && (
          <CommitDrawer
            commits={commits}
            loading={commitsLoading}
            error={commitsError}
            selectedCommitShas={selectedCommitShas}
            onCommitClick={(sha, e) => handleCommitClick(sha, e)}
          />
        )}
        <aside
          style={{
            width: 240,
            flexShrink: 0,
            borderRight: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            overflowY: 'auto',
            padding: '8px 0',
          }}
        >
          <FileListPane
            files={files}
            activeIndex={activeIndex}
            diffPaneRef={diffPaneRef}
            onActiveIndexChange={setActiveIndex}
          />
        </aside>
        <DiffPane
          files={files}
          loading={loading}
          error={error}
          diffStyle={diffStyle}
          diffPaneRef={diffPaneRef}
          onReload={handleReload}
          viewMode={activeCommitSha !== null ? 'commit' : 'branch'}
          activeCommitSha={activeCommitSha}
          commits={commits}
          branchName={branchName}
          allSelected={allSelected}
        />
      </div>
    </div>
  )
}
