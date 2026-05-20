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

  // Toggle the .paragraph-hovered CSS class on the hovered element.
  // Class is defined in index.css — keeps style in CSS, not JavaScript.
  useEffect(() => {
    if (!hoveredParagraph) return
    hoveredParagraph.classList.add('paragraph-hovered')
    return () => {
      hoveredParagraph.classList.remove('paragraph-hovered')
    }
  }, [hoveredParagraph])

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    // Selection supersedes hover — suppress hover state when text is selected
    if (selectedText) return
    const target = e.target as Element
    // Stable hover: don't clear when the cursor slides onto the GutterIcon itself.
    // The icon lives outside .plan-prose so its presence would otherwise trigger a
    // spurious mouseleave → null → unmount → remount flicker loop.
    if (target.closest('button[aria-label="Add comment to paragraph"]')) return
    const para = target.closest('p, pre, li, blockquote, h1, h2, h3, h4, h5, h6')
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
    // Handlers on the outer wrapper so moving to the GutterIcon (right: -8, outside
    // .plan-prose) does NOT fire mouseleave on .plan-prose and kill the hover state.
    <div
      style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={planRef}
        className="plan-prose"
        dangerouslySetInnerHTML={{ __html: planHtml }}
      />
      {hoveredParagraph && !selectedText && (
        <GutterIcon paragraph={hoveredParagraph} containerRef={planRef} onAdd={onAdd} />
      )}
    </div>
  )
}
