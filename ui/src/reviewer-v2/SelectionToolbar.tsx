import { useEffect, useRef } from 'react'
import { rangeFromOffsets } from './hooks/useTextSelection'
import type { AnnotationType } from './types'

// Approximate toolbar width used for the right-edge clamp (Pitfall 5 mitigation)
const TOOLBAR_WIDTH = 280

// Exact 6-label tuple from REQUIREMENTS.md COMMENT-04, matches App.tsx line 193
// eslint-disable-next-line react-refresh/only-export-components
export const QUICK_ACTIONS = [
  'clarify this',
  'needs test',
  'give me an example',
  'out of scope',
  'Search the web',
  'search codebase',
] as const

const pills: { type: AnnotationType; label: string; bg: string; hoverBg: string; color: string }[] = [
  { type: 'comment', label: 'Comment', bg: 'rgba(59, 130, 246, 0.2)', hoverBg: 'rgba(59, 130, 246, 0.38)', color: '#3b82f6' },
  { type: 'delete',  label: 'Delete',  bg: 'rgba(239, 68, 68, 0.2)',  hoverBg: 'rgba(239, 68, 68, 0.38)',  color: '#ef4444' },
  { type: 'replace', label: 'Replace', bg: 'rgba(245, 158, 11, 0.2)', hoverBg: 'rgba(245, 158, 11, 0.38)', color: '#f59e0b' },
]

export default function SelectionToolbar({
  offsets,
  selectedText,
  containerRef,
  onAction,
}: {
  offsets: { start: number; end: number }
  selectedText: string
  containerRef: React.RefObject<HTMLDivElement | null>
  onAction: (type: AnnotationType, anchorText: string, prefillComment?: string) => void
}): React.JSX.Element | null {
  const detailsRef = useRef<HTMLDetailsElement>(null)

  // Close the expander when clicking outside it (mirrors App.tsx lines 206-214)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(e.target as Node)) {
        detailsRef.current.open = false
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* eslint-disable react-hooks/refs */
  if (!containerRef.current) return null

  const range = rangeFromOffsets(containerRef.current, offsets.start, offsets.end)
  if (!range) return null
  /* eslint-enable react-hooks/refs */

  // Use the last client rect so the toolbar anchors to the actual end of the
  // selection rather than the right edge of the overall bounding box (which, for
  // multi-line selections, is the widest line — not where the drag ended).
  const rects = range.getClientRects()
  const lastRect = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect()
  // position: fixed — avoids all scroll-offset math
  const TOOLBAR_HEIGHT_ESTIMATE = 44 // pill buttons ~32 + padding ~12
  // Clamp top against viewport bottom edge so toolbar is always visible
  const top = Math.min(lastRect.bottom + 6, window.innerHeight - TOOLBAR_HEIGHT_ESTIMATE - 8)
  // Clamp left against viewport right edge (Pitfall 5 mitigation)
  const left = Math.min(lastRect.right, window.innerWidth - TOOLBAR_WIDTH)

  return (
    <div
      role="group"
      aria-label="Annotation actions"
      style={{
        position: 'fixed',
        top,
        left,
        zIndex: 20,
        display: 'flex',
        gap: '6px',
        background: 'var(--color-surface)',
        borderRadius: '6px',
        padding: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      {pills.map((pill) => (
        <button
          key={pill.type}
          aria-label={`Add ${pill.label} annotation`}
          // CRITICAL (Pitfall 1): prevent mousedown from clearing selection before click fires
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { onAction(pill.type, selectedText); window.getSelection()?.removeAllRanges() }}
          onMouseOver={(e) => { e.currentTarget.style.background = pill.hoverBg }}
          onMouseOut={(e) => { e.currentTarget.style.background = pill.bg }}
          style={{
            fontSize: '13px',
            fontWeight: 600,
            height: '28px',
            padding: '0 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            border: 'none',
            background: pill.bg,
            color: pill.color,
            outline: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = `2px solid ${pill.color}`
            e.currentTarget.style.outlineOffset = '2px'
          }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
        >
          {pill.label}
        </button>
      ))}
      <details ref={detailsRef} style={{ position: 'relative' }}>
        <summary
          onMouseDown={(e) => e.preventDefault()}
          style={{
            fontSize: '14px',
            fontWeight: 600,
            height: '28px',
            padding: '0 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            border: 'none',
            background: 'rgba(148, 163, 184, 0.15)',
            color: 'var(--color-text-secondary)',
            outline: 'none',
            listStyle: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.25)' }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.15)' }}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid var(--color-focus)'
            e.currentTarget.style.outlineOffset = '2px'
          }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
        >
          &#9662; more
        </summary>
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 21,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            padding: '4px',
            marginTop: '4px',
          }}
        >
          {QUICK_ACTIONS.map((label) => (
            <button
              key={label}
              role="menuitem"
              aria-label={label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onAction('comment', selectedText, label)
                window.getSelection()?.removeAllRanges()
                if (detailsRef.current) detailsRef.current.open = false
              }}
              style={{
                display: 'block',
                width: '100%',
                height: '32px',
                padding: '0 12px',
                textAlign: 'left' as const,
                fontSize: '14px',
                fontWeight: 400,
                color: 'var(--color-text-primary)',
                background: 'none',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                outline: 'none',
                whiteSpace: 'nowrap' as const,
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.1)' }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'none' }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--color-focus)'
                e.currentTarget.style.outlineOffset = '2px'
              }}
              onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
            >
              {label}
            </button>
          ))}
        </div>
      </details>
    </div>
  )
}
