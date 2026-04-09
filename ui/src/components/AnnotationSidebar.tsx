import React from 'react'
import type { Annotation, AnnotationType, Tab } from '../types'

// --- Sub-component: AnnotationCard ---

interface AnnotationCardProps {
  annotation: Annotation
  onRemove: (id: string) => void
  onUpdate: (id: string, field: 'comment' | 'replacement', value: string) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  isHovered?: boolean
}

function getTypeColor(type: AnnotationType): string {
  switch (type) {
    case 'comment':
      return 'var(--color-annotation-comment, #3b82f6)'
    case 'delete':
      return 'var(--color-annotation-delete, #ef4444)'
    case 'replace':
      return 'var(--color-annotation-replace, #f59e0b)'
  }
}

function getTypeBadgeBackground(type: AnnotationType): string {
  switch (type) {
    case 'comment':
      return 'rgba(59, 130, 246, 0.15)'
    case 'delete':
      return 'rgba(239, 68, 68, 0.15)'
    case 'replace':
      return 'rgba(245, 158, 11, 0.15)'
  }
}

function getBadgeLabel(type: AnnotationType): string {
  switch (type) {
    case 'comment':
      return 'COMMENT'
    case 'delete':
      return 'DELETE'
    case 'replace':
      return 'REPLACE'
  }
}

function AnnotationCard({ annotation, onRemove, onUpdate, onMouseEnter, onMouseLeave, isHovered }: AnnotationCardProps) {
  const typeColor = getTypeColor(annotation.type)
  const badgeBg = getTypeBadgeBackground(annotation.type)
  const badgeLabel = getBadgeLabel(annotation.type)

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        background: isHovered ? badgeBg : 'var(--color-surface)',
        border: `1px solid ${isHovered ? typeColor : 'var(--color-border)'}`,
        borderRadius: '6px',
        borderLeft: `3px solid ${typeColor}`,
        padding: '8px',
        position: 'relative',
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* Type badge */}
        <span
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: typeColor,
            background: badgeBg,
            borderRadius: '4px',
            padding: '4px 8px',
            textTransform: 'uppercase',
          }}
        >
          {badgeLabel}
        </span>

        {/* Remove button */}
        <button
          aria-label="Remove annotation"
          onClick={() => onRemove(annotation.id)}
          style={{
            fontSize: '16px',
            color: 'var(--color-text-secondary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 4px',
            lineHeight: 1,
            outline: 'none',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)'
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid var(--color-focus)'
            e.currentTarget.style.outlineOffset = '2px'
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none'
          }}
        >
          ×
        </button>
      </div>

      {/* Quoted anchor text */}
      <div
        style={{
          marginTop: '8px',
          fontSize: '14px',
          fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
          color: 'var(--color-text-secondary)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        &ldquo;{annotation.anchorText}&rdquo;
      </div>

      {/* Comment textarea */}
      {annotation.type === 'comment' && (
        <div style={{ marginTop: '8px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 400,
              color: 'var(--color-text-secondary)',
              marginBottom: '4px',
            }}
          >
            Note for Claude
          </label>
          <textarea
            value={annotation.comment}
            onChange={(e) => onUpdate(annotation.id, 'comment', e.target.value)}
            placeholder="What's wrong with this section?"
            style={{
              display: 'block',
              width: '100%',
              minHeight: '80px',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              color: 'var(--color-text-primary)',
              padding: '8px',
              fontSize: '16px',
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid var(--color-focus)'
              e.currentTarget.style.outlineOffset = '2px'
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none'
            }}
          />
        </div>
      )}

      {/* Replace textarea */}
      {annotation.type === 'replace' && (
        <div style={{ marginTop: '8px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 400,
              color: 'var(--color-text-secondary)',
              marginBottom: '4px',
            }}
          >
            Replace with
          </label>
          <textarea
            value={annotation.replacement}
            onChange={(e) => onUpdate(annotation.id, 'replacement', e.target.value)}
            placeholder="What should this be changed to?"
            style={{
              display: 'block',
              width: '100%',
              minHeight: '80px',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              color: 'var(--color-text-primary)',
              padding: '8px',
              fontSize: '16px',
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid var(--color-focus)'
              e.currentTarget.style.outlineOffset = '2px'
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none'
            }}
          />
        </div>
      )}

      {/* Delete type: no textarea — auto-save */}
    </div>
  )
}

// --- Main component: AnnotationSidebar ---

interface AnnotationSidebarProps {
  annotations: Annotation[]
  onRemoveAnnotation: (id: string) => void
  onUpdateAnnotation: (id: string, field: 'comment' | 'replacement', value: string) => void
  activeTab: Tab
  sidebarRef: React.RefObject<HTMLDivElement | null>
  hoveredAnnotationId?: string | null
  onAnnotationHover?: (anchorText: string) => void
  onAnnotationLeave?: () => void
}

export function AnnotationSidebar({
  annotations,
  onRemoveAnnotation,
  onUpdateAnnotation,
  activeTab,
  sidebarRef,
  hoveredAnnotationId,
  onAnnotationHover,
  onAnnotationLeave,
}: AnnotationSidebarProps) {
  return (
    <div
      ref={sidebarRef}
      style={{
        width: '320px',
        flexShrink: 0,
        overflow: 'hidden',
        background: 'var(--color-surface)',
        borderLeft: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >

      {/* Cards scroll area — overflow hidden, scrollTop synced to plan by App.tsx */}
      {activeTab === 'plan' && (
        <div
          data-cards-scroll
          style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
        >
          <div
            data-cards-inner
            style={{ position: 'relative', width: '100%' }}
          >
            {annotations.length === 0 && (
              <p
                style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  right: '16px',
                  fontSize: '14px',
                  color: 'var(--color-text-secondary)',
                  textAlign: 'center',
                  margin: 0,
                }}
              >
                Select text in the plan to add an annotation.
              </p>
            )}
            {annotations.map((a) => (
              <div
                key={a.id}
                data-annotation-id={a.id}
                style={{ position: 'absolute', top: 0, left: '16px', right: '16px' }}
              >
                <AnnotationCard
                  annotation={a}
                  onRemove={onRemoveAnnotation}
                  onUpdate={onUpdateAnnotation}
                  onMouseEnter={() => onAnnotationHover?.(a.anchorText)}
                  onMouseLeave={() => onAnnotationLeave?.()}
                  isHovered={hoveredAnnotationId === a.id}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
