import { useEffect, useRef, useState } from 'react'
import AppToolbar from './AppToolbar'
import FileListPane from './FileListPane'
import DiffPane from './DiffPane'
import { useDiff } from './hooks/useDiff'

export default function CodeReviewApp(): React.JSX.Element {
  const [diffStyle, setDiffStyle] = useState<'unified' | 'split'>('unified')
  const [contextExpanded, setContextExpanded] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const diffPaneRef = useRef<HTMLDivElement>(null)
  const { files, loading, error, refetch } = useDiff()

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

  // Reset active index when files change (e.g., after refetch).
  // setState is deferred to avoid triggering the react-hooks/set-state-in-effect rule.
  useEffect(() => {
    const id = setTimeout(() => setActiveIndex(files.length > 0 ? 0 : null), 0)
    return () => clearTimeout(id)
  }, [files.length])

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <AppToolbar
        diffStyle={diffStyle}
        contextExpanded={contextExpanded}
        contextLoading={loading && contextExpanded}
        onDiffStyleChange={setDiffStyle}
        onExpandAll={handleExpandAll}
      />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>
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
        />
      </div>
    </div>
  )
}
