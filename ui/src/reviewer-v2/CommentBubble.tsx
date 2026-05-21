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
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  annotation: Annotation
  top: number
  isCompact: boolean
  isHovered: boolean
  isFocused: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
}): React.JSX.Element {
  const borderColor = borderColorByType[annotation.type]

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
      {isFocused && (
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
      )}
    </article>
  )
}
