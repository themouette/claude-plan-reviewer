import { useRef, useState } from 'react'
import ContentPane from './ContentPane'
import OutlinePane from './OutlinePane'
import CommentPane from './CommentPane'
import { useAnnotations } from './useAnnotations'
import type { Section } from './types'

export default function ReviewerV2Shell() {
  const mainRef = useRef<HTMLElement>(null)
  const planRef = useRef<HTMLDivElement>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const { annotations, addAnnotation } = useAnnotations()
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null)
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null)

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
          />
        </aside>

        {/* Center column: Content */}
        <main
          ref={mainRef}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--color-bg)',
            overflowY: 'auto',
            padding: 0,
          }}
        >
          <ContentPane
            onSectionsFound={setSections}
            onAddAnnotation={addAnnotation}
            hoveredCommentId={hoveredCommentId}
            annotations={annotations}
            planRef={planRef}
            onHoverCommentId={setHoveredCommentId}
          />
        </main>

        {/* Right column: Comments */}
        <aside
          aria-label="Comments"
          style={{
            width: 280,
            flexShrink: 0,
            borderLeft: '1px solid var(--color-border)',
            background: 'var(--color-bg)',
            overflowY: 'auto',
            padding: 16,
          }}
        >
          <CommentPane
            annotations={annotations}
            hoveredCommentId={hoveredCommentId}
            focusedCommentId={focusedCommentId}
            mainRef={mainRef}
            planRef={planRef}
            onHover={setHoveredCommentId}
            onFocus={setFocusedCommentId}
          />
        </aside>
      </div>
    </div>
  )
}
