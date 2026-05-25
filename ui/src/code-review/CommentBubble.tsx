import { useState } from 'react'
import type { CodeReviewComment } from './types'
import HunkCommentForm from './HunkCommentForm'

export default function CommentBubble({
  comment,
  onEdit,
  onDelete,
}: {
  comment: CodeReviewComment
  onEdit: (text: string) => void
  onDelete: () => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)

  const ariaLabel =
    comment.type === 'line'
      ? `Comment on line ${comment.lineNumber}`
      : 'Comment on file'

  return (
    <article
      aria-label={ariaLabel}
      style={{
        border: '1px solid var(--color-border)',
        borderLeft: '3px solid var(--color-focus)',
        borderRadius: 6,
        padding: '8px 12px',
        background: 'var(--color-surface)',
        marginBottom: 4,
      }}
    >
      {editing ? (
        <HunkCommentForm
          initialText={comment.text}
          submitLabel="Save Changes"
          cancelLabel="Discard Changes"
          onSubmit={(text) => {
            setEditing(false)
            onEdit(text)
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 400,
              lineHeight: 1.5,
              color: 'var(--color-text-primary)',
            }}
          >
            {comment.text}
          </p>
          <span
            style={{
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              marginTop: 4,
              display: 'block',
            }}
          >
            {new Date(comment.createdAt).toLocaleString()}
          </span>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 8 }}>
            <button
              type="button"
              className="bubble-icon-btn"
              aria-label="Edit comment"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.stopPropagation(); setEditing(true) }}
              onMouseOver={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)' }}
              onMouseOut={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)' }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--color-focus)'
                e.currentTarget.style.outlineOffset = '2px'
              }}
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
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              onMouseOver={(e) => { e.currentTarget.style.color = 'var(--color-accent-deny)' }}
              onMouseOut={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)' }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--color-focus)'
                e.currentTarget.style.outlineOffset = '2px'
              }}
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
    </article>
  )
}
