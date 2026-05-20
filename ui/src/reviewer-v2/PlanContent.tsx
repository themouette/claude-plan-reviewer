import { useState, useEffect, type RefObject } from 'react'
import GutterIcon from './GutterIcon'

export default function PlanContent({
  planHtml,
  planRef,
  selectedText,
  onAdd,
}: {
  planHtml: string
  planRef: RefObject<HTMLDivElement | null>
  selectedText: string
  onAdd: () => void
}) {
  const [hoveredParagraph, setHoveredParagraph] = useState<HTMLElement | null>(null)

  // Apply hover background imperatively to the hovered paragraph element.
  // Cleanup clears the inline styles when the hovered element changes or unmounts.
  /* eslint-disable react-hooks/immutability -- intentional DOM style mutation; hoveredParagraph is a live HTMLElement, not React state */
  useEffect(() => {
    if (!hoveredParagraph) return
    hoveredParagraph.style.background = 'rgba(255,255,255,0.04)'
    hoveredParagraph.style.borderRadius = '4px'
    hoveredParagraph.style.transition = 'background 0.1s ease'
    return () => {
      hoveredParagraph.style.background = ''
      hoveredParagraph.style.borderRadius = ''
      hoveredParagraph.style.transition = ''
    }
  }, [hoveredParagraph])
  /* eslint-enable react-hooks/immutability */

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    // Selection supersedes hover — suppress hover state when text is selected
    if (selectedText) return
    const target = e.target as Element
    const para = target.closest('p, li, blockquote, h1, h2, h3, h4, h5, h6')
    if (para && planRef.current?.contains(para)) {
      setHoveredParagraph(para as HTMLElement)
    } else {
      setHoveredParagraph(null)
    }
  }

  function handleMouseLeave() {
    setHoveredParagraph(null)
  }

  return (
    <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
      <div
        ref={planRef}
        className="plan-prose"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        dangerouslySetInnerHTML={{ __html: planHtml }}
      />
      {hoveredParagraph && !selectedText && (
        <GutterIcon paragraph={hoveredParagraph} containerRef={planRef} onAdd={onAdd} />
      )}
    </div>
  )
}
