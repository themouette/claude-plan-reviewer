import { useEffect, useState } from 'react'
import type { Annotation } from './types'
import { rangeFromOffsets } from './hooks/useTextSelection'
import { computeCommentLayout, COMPACT_HEIGHT } from './hooks/useCommentLayout'
import CommentBubble from './CommentBubble'

export default function CommentPane({
  annotations,
  hoveredCommentId,
  focusedCommentId,
  editingId,
  mainRef,
  planRef,
  onHover,
  onFocus,
  onEdit,
  onRemove,
  onCancelEdit,
}: {
  annotations: Annotation[]
  hoveredCommentId: string | null
  focusedCommentId: string | null
  editingId: string | null
  mainRef: React.RefObject<HTMLDivElement | null>
  planRef: React.RefObject<HTMLDivElement | null>
  onHover: (id: string | null) => void
  onFocus: (id: string | null) => void
  onEdit: (id: string, newComment?: string) => void
  onRemove: (id: string) => void
  onCancelEdit: () => void
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
        // rangeRect.top - containerRect.top is scroll-invariant (both rects shift
        // together when <main> scrolls), giving the anchor's fixed offset within
        // the plan content. Adding scrollTop here would double-count the scroll.
        const anchorY = rangeRect.top - containerRect.top
        map.set(ann.id, anchorY)
      }
      setAnchorYMap(map)
    }

    const ro = new ResizeObserver(recompute)
    ro.observe(content)
    recompute()

    const scroller = el
    scroller.addEventListener('scroll', recompute, { passive: true })

    return () => {
      ro.disconnect()
      scroller.removeEventListener('scroll', recompute)
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
        const wrapperStyle: React.CSSProperties = {
          position: 'absolute',
          top: layoutItem.top,
          left: 0,
          right: 0,
        }
        return (
          <div key={ann.id} style={wrapperStyle}>
            <CommentBubble
              annotation={ann}
              top={0}
              isCompact={layoutItem.isCompact}
              isHovered={hoveredCommentId === ann.id}
              isFocused={focusedCommentId === ann.id}
              isEditing={editingId === ann.id}
              onMouseEnter={() => onHover(ann.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onFocus(focusedCommentId === ann.id ? null : ann.id)}
              onEdit={(newComment) => onEdit(ann.id, newComment)}
              onRemove={() => onRemove(ann.id)}
              onCancelEdit={onCancelEdit}
            />
          </div>
        )
      })}
    </div>
  )
}
