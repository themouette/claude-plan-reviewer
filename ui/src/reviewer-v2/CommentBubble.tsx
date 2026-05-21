import { useRef } from 'react'
import type { Annotation } from './types'

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
}

const borderColorByType: Record<Annotation['type'], string> = {
  comment: 'var(--color-annotation-comment)',
  delete: 'var(--color-annotation-delete)',
  replace: 'var(--color-annotation-replace)',
}

export default function CommentBubble({
  annotation,
  top,
  isCompact,
  isHovered,
  isFocused,
  isEditing,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onEdit,
  onRemove,
  onCancelEdit,
}: {
  annotation: Annotation
  top: number
  isCompact: boolean
  isHovered: boolean
  isFocused: boolean
  isEditing: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
  onEdit: (newComment?: string) => void
  onRemove: () => void
  onCancelEdit: () => void
}): React.JSX.Element {
  const borderColor = borderColorByType[annotation.type]
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    top,
    left: 0,
    right: 0,
    border: '1px solid var(--color-border)',
    borderLeft: `3px solid ${borderColor}`,
    borderRadius: 6,
    padding: '8px 12px',
    background: 'var(--color-surface)',
    cursor: 'pointer',
    zIndex: isFocused ? 2 : 1,
  }

  // Compact state: 2-line clamp, reduced opacity
  const compactStyle: React.CSSProperties =
    isCompact && !isFocused
      ? {
          height: 48,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
          opacity: isHovered ? 1 : 0.85,
          boxShadow: isHovered ? '0 0 0 1px var(--color-focus)' : undefined,
        }
      : {}

  // Focused/expanded state
  const expandedStyle: React.CSSProperties = isFocused
    ? {
        opacity: 1,
        boxShadow: '0 0 0 2px var(--color-focus)',
      }
    : {}

  // Hovered-but-not-focused
  const hoveredStyle: React.CSSProperties =
    isHovered && !isFocused && !(isCompact && !isFocused)
      ? {
          opacity: 1,
          boxShadow: '0 0 0 1px var(--color-focus)',
        }
      : {}

  const ariaLabel =
    isCompact && !isFocused
      ? `Comment by ${annotation.type}: ${truncate(annotation.anchorText, 40)}`
      : `Comment by ${annotation.type} on "${annotation.anchorText}"`

  return (
    <article
      aria-label={ariaLabel}
      aria-expanded={isFocused ? 'true' : 'false'}
      style={{ ...baseStyle, ...compactStyle, ...expandedStyle, ...hoveredStyle }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <header>
        <strong
          style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: isFocused ? undefined : 'nowrap',
          }}
        >
          {annotation.anchorText}
        </strong>
      </header>
      {isEditing ? (
        <textarea
          ref={textareaRef}
          autoFocus
          defaultValue={annotation.comment}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              onEdit(textareaRef.current?.value ?? '')
            }
            if (e.key === 'Escape') {
              onCancelEdit()
            }
          }}
          style={{
            width: '100%',
            minHeight: 64,
            fontSize: 14,
            fontFamily: 'inherit',
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            padding: 8,
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      ) : (
        <p
          style={{
            margin: 0,
            marginTop: 4,
            fontSize: 14,
            fontWeight: 400,
            color: 'var(--color-text-primary)',
            lineHeight: 1.5,
            overflow: isFocused ? undefined : 'hidden',
            textOverflow: isFocused ? undefined : 'ellipsis',
            whiteSpace: isFocused ? undefined : 'nowrap',
          }}
        >
          {annotation.comment}
        </p>
      )}
      {isFocused && !isEditing && (
        <>
          <span
            style={{
              display: 'inline-block',
              marginTop: 6,
              fontSize: 13,
              padding: '2px 8px',
              borderRadius: 10,
              background: `color-mix(in srgb, ${borderColor} 15%, transparent)`,
              color: borderColor,
            }}
          >
            {annotation.type}
          </span>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 8 }}>
            <button
              type="button"
              className="bubble-icon-btn"
              aria-label="Edit comment"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              onMouseOver={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)' }}
              onMouseOut={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)' }}
              onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-focus)'; e.currentTarget.style.outlineOffset = '2px' }}
              onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
              style={{
                width: 20,
                height: 20,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
                color: 'var(--color-text-secondary)',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 3,
              }}
            >
              ✎
            </button>
            <button
              type="button"
              className="bubble-icon-btn"
              aria-label="Delete comment"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              onMouseOver={(e) => { e.currentTarget.style.color = 'var(--color-accent-deny)' }}
              onMouseOut={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)' }}
              onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-focus)'; e.currentTarget.style.outlineOffset = '2px' }}
              onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
              style={{
                width: 20,
                height: 20,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
                color: 'var(--color-text-secondary)',
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 3,
              }}
            >
              ×
            </button>
          </div>
        </>
      )}
      {isEditing && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 8 }}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); onCancelEdit() }}
            style={{
              height: 28,
              padding: '0 8px',
              fontSize: 13,
              fontWeight: 400,
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              borderRadius: 4,
            }}
          >
            Discard Changes
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(textareaRef.current?.value ?? '') }}
            style={{
              height: 28,
              padding: '0 12px',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              background: 'var(--color-focus)',
              color: '#fff',
              cursor: 'pointer',
              borderRadius: 4,
            }}
          >
            Save Changes
          </button>
        </div>
      )}
    </article>
  )
}
