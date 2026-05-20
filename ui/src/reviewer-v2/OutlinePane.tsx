import { useEffect, useRef } from 'react'
import type { Section } from './types'

export default function OutlinePane({
  sections,
  activeId,
  mainRef,
  onActiveIdChange,
}: {
  sections: Section[]
  activeId: string | null
  mainRef: React.RefObject<HTMLElement | null>
  onActiveIdChange: (id: string) => void
}): React.JSX.Element {
  const activeItemRef = useRef<HTMLLIElement>(null)

  // IntersectionObserver: watch heading elements within mainRef scroll container
  useEffect(() => {
    if (!mainRef.current || sections.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onActiveIdChange(entry.target.id)
            break // first intersecting entry wins
          }
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
        {sections.map((section) => (
          <li
            key={section.id}
            ref={section.id === activeId ? activeItemRef : undefined}
          >
            <button
              aria-label={section.text}
              aria-current={section.id === activeId ? 'true' : undefined}
              onClick={() =>
                document
                  .getElementById(section.id)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              onMouseEnter={(e) => {
                if (section.id !== activeId) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  e.currentTarget.style.color = 'var(--color-text-primary)'
                }
              }}
              onMouseLeave={(e) => {
                if (section.id !== activeId) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--color-text-secondary)'
                }
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--color-focus)'
                e.currentTarget.style.outlineOffset = '2px'
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none'
              }}
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
                outline: 'none',
              }}
            >
              {section.text}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
