import { useEffect, useRef, useState } from 'react'
import ContentPane from './ContentPane'
import OutlinePane from './OutlinePane'
import CommentPane from './CommentPane'
import { useAnnotations } from './useAnnotations'
import { useSectionAnnotationCounts } from './hooks/useSectionAnnotationCounts'
import type { Section } from './types'

export default function ReviewerV2Shell() {
  const mainRef = useRef<HTMLDivElement>(null)
  const planRef = useRef<HTMLDivElement>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const { annotations, addAnnotation, editAnnotation, removeAnnotation } = useAnnotations()
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null)
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const annotationCounts = useSectionAnnotationCounts(sections, annotations, planRef)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setFocusedCommentId(null)
        setEditingId(null)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header strip — 48px fixed height */}
      <header
        style={{
          height: 48,
          flexShrink: 0,
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 16,
          paddingRight: 16,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: 'var(--color-text-secondary)',
          }}
        >
          Reviewer v2
        </span>
      </header>

      {/* 3-column body row — occupies the remaining viewport height */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>
        {/* Left column: Outline */}
        <aside
          style={{
            width: 200,
            flexShrink: 0,
            borderRight: '1px solid var(--color-border)',
            background: 'var(--color-bg)',
            overflowY: 'auto',
            padding: 16,
          }}
        >
          <OutlinePane
            sections={sections}
            activeId={activeId}
            mainRef={mainRef}
            onActiveIdChange={setActiveId}
            annotationCounts={annotationCounts}
          />
        </aside>

        {/* Shared scroller: content + comments scroll as one unit */}
        <div
          ref={mainRef}
          style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex' }}
        >
          {/* Center column: Content */}
          <main style={{ flex: 1, minWidth: 0, background: 'var(--color-bg)', padding: 0 }}>
            <ContentPane
              onSectionsFound={setSections}
              onAddAnnotation={addAnnotation}
              hoveredCommentId={hoveredCommentId}
              annotations={annotations}
              planRef={planRef}
              onHoverCommentId={setHoveredCommentId}
            />
          </main>

          {/* Right column: Comments — scrolls with content, no independent scroll */}
          <aside
            aria-label="Comments"
            style={{
              width: 280,
              flexShrink: 0,
              borderLeft: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              padding: 16,
            }}
          >
            <CommentPane
              annotations={annotations}
              hoveredCommentId={hoveredCommentId}
              focusedCommentId={focusedCommentId}
              editingId={editingId}
              mainRef={mainRef}
              planRef={planRef}
              onHover={setHoveredCommentId}
              onFocus={setFocusedCommentId}
              onEdit={(id, newComment) => {
                if (newComment !== undefined) {
                  editAnnotation(id, newComment)
                  setEditingId(null)
                } else {
                  setEditingId(id)
                }
              }}
              onRemove={(id) => {
                if (editingId === id) setEditingId(null)
                if (focusedCommentId === id) setFocusedCommentId(null)
                removeAnnotation(id)
              }}
              onCancelEdit={() => setEditingId(null)}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}
