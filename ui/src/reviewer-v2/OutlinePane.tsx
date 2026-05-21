import { useEffect, useRef } from 'react'
import type { Section } from './types'

export default function OutlinePane({
  sections,
  activeId,
  mainRef,
  onActiveIdChange,
  annotationCounts,
}: {
  sections: Section[]
  activeId: string | null
  mainRef: React.RefObject<HTMLDivElement | null>
  onActiveIdChange: (id: string) => void
  annotationCounts?: Map<string, number>
}): React.JSX.Element {
  const activeItemRef = useRef<HTMLLIElement>(null)

  // IntersectionObserver: watch heading elements within mainRef scroll container
  useEffect(() => {
    if (!mainRef.current || sections.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const intersectingIds = new Set(
          entries.filter((e) => e.isIntersecting).map((e) => e.target.id),
        )
        if (intersectingIds.size > 0) {
          // Select the entry whose id appears earliest in sections (document order)
          // rather than relying on the spec-undefined order of entries[].
          const first = sections.find((s) => intersectingIds.has(s.id))
          if (first) onActiveIdChange(first.id)
        }
      },
      {
        root: mainRef.current, // CRITICAL: must be the scroll container, not null
        rootMargin: '-10px 0px -85% 0px',
        threshold: 0,
      },
    )
    sections.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [sections, mainRef, onActiveIdChange])

  // Outline auto-scroll: keep active item visible in outline panel
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeId])

  return (
    <nav aria-label="Document outline">
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {sections.map((section, i) => (
          <li
            key={section.id || `__section-${i}`}
            ref={section.id === activeId ? activeItemRef : undefined}
          >
            <button
              className="outline-button"
              aria-label={section.text}
              aria-current={section.id === activeId ? 'true' : undefined}
              onClick={() =>
                document
                  .getElementById(section.id)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              style={{
                width: '100%',
                textAlign: 'left',
                background: section.id === activeId ? 'var(--color-surface)' : 'transparent',
                color:
                  section.id === activeId
                    ? 'var(--color-focus)'
                    : 'var(--color-text-secondary)',
                border: 'none',
                borderLeft:
                  section.id === activeId
                    ? '2px solid var(--color-focus)'
                    : '2px solid transparent',
                paddingLeft: 16 + (section.depth - 1) * 8,
                paddingTop: 6,
                paddingBottom: 6,
                fontSize: 14,
                fontWeight: section.id === activeId ? 600 : 400,
                lineHeight: 1.4,
                cursor: 'pointer',
                display: 'block',
                minHeight: 28,
              }}
            >
              {section.text}
              {(annotationCounts?.get(section.id) ?? 0) > 0 && (
                <span
                  aria-label={`${annotationCounts!.get(section.id)} comments`}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    lineHeight: 1,
                    minWidth: 16,
                    height: 16,
                    padding: '0 4px',
                    borderRadius: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 8,
                    background:
                      section.id === activeId ? 'var(--color-focus)' : 'rgba(59, 130, 246, 0.25)',
                    color: section.id === activeId ? '#fff' : 'var(--color-focus)',
                  }}
                >
                  {annotationCounts!.get(section.id)}
                </span>
              )}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
