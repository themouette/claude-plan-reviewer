import { useEffect, useState } from 'react'
import type { Annotation } from './types'
import { rangeFromOffsets } from './hooks/useTextSelection'
import { computeCommentLayout, COMPACT_HEIGHT } from './hooks/useCommentLayout'
import CommentBubble from './CommentBubble'

export default function CommentPane({
  annotations,
  hoveredCommentId,
  focusedCommentId,
  mainRef,
  planRef,
  onHover,
  onFocus,
}: {
  annotations: Annotation[]
  hoveredCommentId: string | null
  focusedCommentId: string | null
  mainRef: React.RefObject<HTMLElement | null>
  planRef: React.RefObject<HTMLDivElement | null>
  onHover: (id: string | null) => void
  onFocus: (id: string | null) => void
}): React.JSX.Element {
  const [anchorYMap, setAnchorYMap] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    // Capture at effect entry (Pitfall 6 — never close over .current lazily)
    const el = mainRef.current
    const content = planRef.current
    if (!el || !content) return

    function recompute() {
      if (!el || !content) return
      const containerRect = content.getBoundingClientRect()
      const map = new Map<string, number>()
      for (const ann of annotations) {
        const range = rangeFromOffsets(content, ann.anchorStart, ann.anchorEnd)
        if (!range) continue
        const rangeRect = range.getBoundingClientRect()
        const anchorY = rangeRect.top - containerRect.top + el.scrollTop
        map.set(ann.id, anchorY)
      }
      setAnchorYMap(map)
    }

    el.addEventListener('scroll', recompute, { passive: true })
    const ro = new ResizeObserver(recompute)
    ro.observe(content)
    recompute()

    return () => {
      el.removeEventListener('scroll', recompute)
      ro.disconnect()
    }
  }, [mainRef, planRef, annotations])

  if (annotations.length === 0) {
    return (
      <div style={{ position: 'relative', minHeight: '100%' }}>
        <p
          style={{
            margin: 0,
            marginBottom: 4,
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
          }}
        >
          No comments yet
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: 'var(--color-text-secondary)',
          }}
        >
          Select text or hover a paragraph to add a comment.
        </p>
      </div>
    )
  }

  const EXPANDED_HEIGHT_ESTIMATE = 160 // temporary until Phase 21 layout measurement

  const layoutItems = annotations
    .filter((ann) => anchorYMap.has(ann.id))
    .map((ann) => {
      const isExpanded = focusedCommentId === ann.id
      return {
        id: ann.id,
        anchorY: anchorYMap.get(ann.id)!,
        isExpanded,
        height: isExpanded ? EXPANDED_HEIGHT_ESTIMATE : COMPACT_HEIGHT,
      }
    })

  const layout = computeCommentLayout(layoutItems)

  return (
    <div style={{ position: 'relative', minHeight: '100%' }}>
      {annotations.map((ann) => {
        const layoutItem = layout.find((l) => l.id === ann.id)
        if (!layoutItem) return null
        return (
          <CommentBubble
            key={ann.id}
            annotation={ann}
            top={layoutItem.top}
            isCompact={layoutItem.isCompact}
            isHovered={hoveredCommentId === ann.id}
            isFocused={focusedCommentId === ann.id}
            onMouseEnter={() => onHover(ann.id)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onFocus(ann.id)}
          />
        )
      })}
    </div>
  )
}
