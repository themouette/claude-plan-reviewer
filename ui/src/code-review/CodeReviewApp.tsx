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
  // Phase 26 commit navigation state (D-11: all owned here)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'branch' | 'commit'>('branch')
  const [activeCommitSha, setActiveCommitSha] = useState<string | null>(null)
  const [checkedCommitShas, setCheckedCommitShas] = useState<string[]>([])

  const diffPaneRef = useRef<HTMLDivElement>(null)
  const seededRef = useRef(false)
  const { commits, loading: commitsLoading, error: commitsError } = useCommits()

  // Compute useDiff selector from current state (D-11)
  const selector: DiffFetchSelector =
    viewMode === 'commit' && activeCommitSha !== null
      ? { mode: 'commit', sha: activeCommitSha }
      : viewMode === 'branch' && commits.length > 0 && checkedCommitShas.length < commits.length
        ? { mode: 'branch-union', shas: checkedCommitShas }
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

  // D-07: closing the drawer returns to branch view and clears active commit
  function handleCommitsToggle() {
    if (drawerOpen) {
      setDrawerOpen(false)
      setViewMode('branch')
      setActiveCommitSha(null)
    } else {
      setDrawerOpen(true)
    }
  }

  // Reset active index when files change (e.g., after refetch).
  // setState is deferred to avoid triggering the react-hooks/set-state-in-effect rule.
  useEffect(() => {
    const id = setTimeout(() => setActiveIndex(files.length > 0 ? 0 : null), 0)
    return () => clearTimeout(id)
  }, [files.length])

  // D-08: seed checkedCommitShas to all commit shas when commits first load (opt-out model).
  // seededRef sentinel (CR-02): one-shot guard — never re-seeds after user deselects all commits.
  // Deferred via setTimeout(0) to avoid react-hooks/set-state-in-effect violation.
  useEffect(() => {
    if (seededRef.current || commits.length === 0) return
    seededRef.current = true
    const id = setTimeout(() => setCheckedCommitShas(commits.map((c) => c.sha)), 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commits.length])

  // D-09 / D-10: keyboard navigation — left/right only in per-commit mode, stop at boundaries
  // Deps array includes viewMode, activeCommitSha, commits to avoid stale closures (Pitfall 2)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (viewMode !== 'commit' || commits.length === 0 || activeCommitSha === null) return
      const idx = commits.findIndex((c) => c.sha === activeCommitSha)
      if (idx === -1) return
      if (e.key === 'ArrowLeft' && idx > 0) setActiveCommitSha(commits[idx - 1].sha)
      else if (e.key === 'ArrowRight' && idx < commits.length - 1) setActiveCommitSha(commits[idx + 1].sha)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewMode, activeCommitSha, commits])

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
            activeCommitSha={activeCommitSha}
            checkedCommitShas={checkedCommitShas}
            onCommitClick={(sha) => {
              setActiveCommitSha(sha)
              setViewMode('commit')
            }}
            onCheckChange={(sha, checked) =>
              setCheckedCommitShas((prev) =>
                checked ? [...prev, sha] : prev.filter((s) => s !== sha),
              )
            }
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
          viewMode={viewMode}
          activeCommitSha={activeCommitSha}
          commits={commits}
        />
      </div>
    </div>
  )
}
