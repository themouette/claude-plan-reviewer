import React from 'react'
import type { Annotation, AnnotationType, Tab } from '../types'

// --- Sub-component: OverallCommentField ---

interface OverallCommentFieldProps {
  value: string
  onChange: (value: string) => void
}

function OverallCommentField({ value, onChange }: OverallCommentFieldProps) {
  return (
    <div>
      <label
        htmlFor="overall-comment"
        style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: 400,
          color: 'var(--color-text-secondary)',
          marginBottom: '8px',
        }}
      >
        Overall Comment
      </label>
      <textarea
        id="overall-comment"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Add an overall note for Claude..."
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
  )
}

// --- Sub-component: AnnotationCard ---

interface AnnotationCardProps {
  annotation: Annotation
  onRemove: (id: string) => void
  onUpdate: (id: string, field: 'comment' | 'replacement', value: string) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
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

function AnnotationCard({ annotation, onRemove, onUpdate, onMouseEnter, onMouseLeave }: AnnotationCardProps) {
  const typeColor = getTypeColor(annotation.type)
  const badgeBg = getTypeBadgeBackground(annotation.type)
  const badgeLabel = getBadgeLabel(annotation.type)

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '6px',
        borderLeft: `3px solid ${typeColor}`,
        padding: '8px',
        position: 'relative',
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

// --- Sub-component: AddAnnotationAffordance ---

interface AddAnnotationAffordanceProps {
  selectedText: string
  onAddAnnotation: (type: AnnotationType, anchorText: string) => void
}

function AddAnnotationAffordance({ selectedText, onAddAnnotation }: AddAnnotationAffordanceProps) {
  const pills: { type: AnnotationType; label: string; bg: string; color: string; ariaLabel: string }[] = [
    {
      type: 'comment',
      label: 'Comment',
      bg: 'rgba(59, 130, 246, 0.2)',
      color: '#3b82f6',
      ariaLabel: 'Add Comment annotation',
    },
    {
      type: 'delete',
      label: 'Delete',
      bg: 'rgba(239, 68, 68, 0.2)',
      color: '#ef4444',
      ariaLabel: 'Add Delete annotation',
    },
    {
      type: 'replace',
      label: 'Replace',
      bg: 'rgba(245, 158, 11, 0.2)',
      color: '#f59e0b',
      ariaLabel: 'Add Replace annotation',
    },
  ]

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {pills.map((pill) => (
          <button
            key={pill.type}
            aria-label={pill.ariaLabel}
            // CRITICAL (Pitfall 1): prevent mousedown from clearing selection before click fires
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onAddAnnotation(pill.type, selectedText)}
            style={{
              fontSize: '14px',
              fontWeight: 600,
              height: '32px',
              padding: '0 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              border: 'none',
              background: pill.bg,
              color: pill.color,
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid var(--color-focus)'
              e.currentTarget.style.outlineOffset = '2px'
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none'
            }}
          >
            {pill.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// --- Main component: AnnotationSidebar ---

interface AnnotationSidebarProps {
  annotations: Annotation[]
  overallComment: string
  onOverallCommentChange: (value: string) => void
  onAddAnnotation: (type: AnnotationType, anchorText: string) => void
  onRemoveAnnotation: (id: string) => void
  onUpdateAnnotation: (id: string, field: 'comment' | 'replacement', value: string) => void
  selectedText: string
  activeTab: Tab
  sidebarRef: React.RefObject<HTMLDivElement | null>
}

export function AnnotationSidebar({
  annotations,
  overallComment,
  onOverallCommentChange,
  onAddAnnotation,
  onRemoveAnnotation,
  onUpdateAnnotation,
  selectedText,
  activeTab,
  sidebarRef,
}: AnnotationSidebarProps) {
  return (
    <div
      ref={sidebarRef}
      style={{
        width: '320px',
        flexShrink: 0,
        overflowY: 'auto',
        background: 'var(--color-surface)',
        borderLeft: '1px solid var(--color-border)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
      }}
    >
      <OverallCommentField value={overallComment} onChange={onOverallCommentChange} />

      <div style={{ height: '1px', background: 'var(--color-border)', margin: '16px 0' }} />

      {activeTab === 'plan' && (
        <>
          {/* Add annotation affordance — shown when text is selected */}
          {selectedText && (
            <AddAnnotationAffordance
              selectedText={selectedText}
              onAddAnnotation={onAddAnnotation}
            />
          )}

          {/* Annotation list */}
          {annotations.length > 0 ? (
            <div
              role="list"
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              {annotations.map((a) => (
                <div role="listitem" key={a.id}>
                  <AnnotationCard
                    annotation={a}
                    onRemove={onRemoveAnnotation}
                    onUpdate={onUpdateAnnotation}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p
              style={{
                fontSize: '14px',
                color: 'var(--color-text-secondary)',
                textAlign: 'center',
                padding: '16px 0',
              }}
            >
              Select text in the plan to add an annotation.
            </p>
          )}
        </>
      )}
    </div>
  )
}
