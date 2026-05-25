import { useRef } from 'react'

export default function HunkCommentForm({
  initialText = '',
  onSubmit,
  onCancel,
  submitLabel = 'Add Comment',
  cancelLabel = 'Dismiss',
}: {
  initialText?: string
  onSubmit: (text: string) => void
  onCancel: () => void
  submitLabel?: string
  cancelLabel?: string
}): React.JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSubmit() {
    onSubmit(textareaRef.current?.value ?? '')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div
      role="group"
      aria-label="Add a comment"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        padding: 8,
      }}
    >
      <textarea
        ref={textareaRef}
        autoFocus
        defaultValue={initialText}
        placeholder="Add a comment…"
        aria-label="Comment text"
        onKeyDown={handleKeyDown}
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onCancel}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid var(--color-focus)'
            e.currentTarget.style.outlineOffset = '2px'
          }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
          style={{
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            height: 28,
            padding: '0 8px',
            fontSize: 12,
            fontWeight: 400,
            borderRadius: 4,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleSubmit}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid var(--color-focus)'
            e.currentTarget.style.outlineOffset = '2px'
          }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
          style={{
            background: 'var(--color-focus)',
            color: '#fff',
            height: 28,
            padding: '0 12px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 4,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
