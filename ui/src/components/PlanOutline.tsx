import { useEffect, useRef } from 'react'
import type { OutlineItem } from '../types'

interface PlanOutlineProps {
  items: OutlineItem[]
  activeId: string | null
  onItemClick: (id: string) => void
  annotationCounts?: Map<string, number>
}

const INDENT: Record<1 | 2 | 3, number> = { 1: 12, 2: 20, 3: 28 }

export function PlanOutline({ items, activeId, onItemClick, annotationCounts }: PlanOutlineProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  return (
    <nav
      aria-label="Plan outline"
      style={{
        width: '220px',
        flexShrink: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: '16px',
      }}
    >
      <div
        style={{
          padding: '0 12px 8px',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-text-secondary)',
          flexShrink: 0,
        }}
      >
        Outline
      </div>

      {items.map((item) => {
        const isActive = item.id === activeId
        const indent = INDENT[item.level]
        const count = annotationCounts?.get(item.id) ?? 0

        return (
          <button
            key={item.id}
            ref={isActive ? activeRef : null}
            title={item.text}
            onClick={() => onItemClick(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              width: '100%',
              textAlign: 'left',
              background: isActive ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
              border: 'none',
              borderLeft: isActive
                ? '2px solid var(--color-accent-approve)'
                : '2px solid transparent',
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 400,
              lineHeight: 1.4,
              padding: `4px 8px 4px ${indent - 2}px`,
              cursor: 'pointer',
              transition: 'background 0.1s ease, color 0.1s ease',
              outline: 'none',
              flexShrink: 0,
              minWidth: 0,
            }}
            onMouseOver={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--color-text-primary)'
              e.currentTarget.style.background = isActive
                ? 'rgba(34, 197, 94, 0.12)'
                : 'rgba(255,255,255,0.04)'
            }}
            onMouseOut={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--color-text-secondary)'
              e.currentTarget.style.background = isActive
                ? 'rgba(34, 197, 94, 0.08)'
                : 'transparent'
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid var(--color-focus)'
              e.currentTarget.style.outlineOffset = '-2px'
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none'
            }}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.text}
            </span>
            {count > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  flexShrink: 0,
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: 'var(--color-annotation-comment)',
                  borderRadius: '10px',
                  padding: '1px 6px',
                }}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
