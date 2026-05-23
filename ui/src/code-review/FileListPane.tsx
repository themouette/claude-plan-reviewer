import { useEffect, useRef } from 'react'
import type { FileDiff } from './types'

export interface FileListPaneProps {
  files: FileDiff[]
  activeIndex: number | null
  diffPaneRef: React.RefObject<HTMLDivElement | null> // scroll container for IntersectionObserver
  onActiveIndexChange: (index: number) => void
}

export default function FileListPane({
  files,
  activeIndex,
  diffPaneRef,
  onActiveIndexChange,
}: FileListPaneProps): React.JSX.Element {
  const activeItemRef = useRef<HTMLLIElement>(null)

  // IntersectionObserver: watch file anchor elements within diffPaneRef scroll container
  useEffect(() => {
    if (!diffPaneRef.current || files.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const intersectingIndices: number[] = []
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idStr = entry.target.id.replace('file-', '')
            const idx = parseInt(idStr, 10)
            if (!isNaN(idx)) {
              intersectingIndices.push(idx)
            }
          }
        })
        if (intersectingIndices.length > 0) {
          // Pick the lowest index (first in document order)
          const first = Math.min(...intersectingIndices)
          onActiveIndexChange(first)
        }
      },
      {
        root: diffPaneRef.current, // CRITICAL: must be the scroll container, not null
        rootMargin: '-10px 0px -85% 0px',
        threshold: 0,
      },
    )
    files.forEach((_file, i) => {
      const el = document.getElementById(`file-${i}`)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [files, diffPaneRef, onActiveIndexChange])

  // Outline auto-scroll: keep active item visible in file list panel
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeIndex])

  function getStatusDotColor(status: FileDiff['status']): string {
    switch (status) {
      case 'added':
        return '#22c55e'
      case 'removed':
        return '#ef4444'
      case 'modified':
        return 'var(--color-focus)'
      case 'renamed':
      case 'copied':
        return 'var(--color-text-secondary)'
      default:
        return 'var(--color-text-secondary)'
    }
  }

  return (
    <nav aria-label="Changed files">
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {files.map((file, index) => {
          const isActive = index === activeIndex
          const basename = file.filename.split('/').pop() ?? file.filename
          const showCounts = file.additions + file.deletions !== 0

          return (
            <li
              key={`${file.filename}-${index}`}
              ref={isActive ? activeItemRef : undefined}
            >
              <button
                type="button"
                aria-current={isActive ? 'true' : undefined}
                title={
                  file.status === 'renamed' && file.previous_filename
                    ? `${file.previous_filename} → ${file.filename}`
                    : file.filename
                }
                onClick={() => {
                  onActiveIndexChange(index)
                  document
                    .getElementById(`file-${index}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  borderLeft: isActive
                    ? '2px solid var(--color-focus)'
                    : '2px solid transparent',
                  background: isActive ? 'var(--color-bg)' : 'transparent',
                  color: isActive
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-secondary)',
                  fontWeight: isActive ? 600 : 400,
                  padding: '8px 16px',
                  cursor: 'pointer',
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 14,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = '2px solid var(--color-focus)'
                  e.currentTarget.style.outlineOffset = '2px'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = 'none'
                }}
              >
                {/* Status dot */}
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: getStatusDotColor(file.status),
                    marginRight: 8,
                    flexShrink: 0,
                  }}
                />

                {/* Rename icon (before basename when status === 'renamed') */}
                {file.status === 'renamed' && (
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--color-text-secondary)',
                      marginRight: 4,
                    }}
                  >
                    ↳
                  </span>
                )}

                {/* Basename */}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {basename}
                </span>

                {/* Change counts — omitted when additions + deletions === 0 */}
                {showCounts && (
                  <span style={{ marginLeft: 'auto', fontSize: 12, paddingLeft: 8, flexShrink: 0 }}>
                    <span style={{ color: '#22c55e' }}>+{file.additions}</span>
                    <span style={{ color: '#ef4444', marginLeft: 4 }}>-{file.deletions}</span>
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
