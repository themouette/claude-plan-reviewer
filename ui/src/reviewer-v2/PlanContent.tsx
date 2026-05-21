import { memo, useState, type RefObject } from 'react'
import GutterIcon from './GutterIcon'

const MarkdownView = memo(function MarkdownView({
  planHtml,
  planRef,
}: {
  planHtml: string
  planRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <div
      ref={planRef}
      className="plan-prose"
      dangerouslySetInnerHTML={{ __html: planHtml }}
    />
  )
})

export default function PlanContent({
  planHtml,
  planRef,
  selectedText,
  onAdd,
}: {
  planHtml: string
  planRef: RefObject<HTMLDivElement | null>
  selectedText: string
  onAdd: (el: HTMLElement) => void
}) {
  const [hoveredParagraph, setHoveredParagraph] = useState<HTMLElement | null>(null)

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (selectedText) return
    // No hover updates while a button is held — selection drag would jitter.
    if (e.buttons !== 0) return
    const target = e.target as Element
    if (target.closest('button[aria-label="Add comment to paragraph"]')) return
    const para = target.closest('p, pre, li, blockquote, h1, h2, h3, h4, h5, h6')
    if (para && planRef.current?.contains(para)) {
      setHoveredParagraph(para as HTMLElement)
    } else {
      setHoveredParagraph(null)
    }
  }

  function handleMouseOut(e: React.MouseEvent<HTMLDivElement>) {
    const relatedTarget = e.relatedTarget as Node | null
    if (relatedTarget && e.currentTarget.contains(relatedTarget)) return
    setHoveredParagraph(null)
  }

  return (
    <div
      style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}
      onMouseMove={handleMouseMove}
      onMouseOut={handleMouseOut}
    >
      <MarkdownView planHtml={planHtml} planRef={planRef} />
      {hoveredParagraph && !selectedText && (
        <>
          <div
            aria-hidden="true"
            className="paragraph-hover-overlay"
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              top: hoveredParagraph.offsetTop,
              left: 0,
              right: 0,
              height: hoveredParagraph.offsetHeight,
              borderRadius: 4,
              zIndex: 0,
            }}
          />
          <GutterIcon paragraph={hoveredParagraph} containerRef={planRef} onAdd={() => onAdd(hoveredParagraph)} />
        </>
      )}
    </div>
  )
}
