import { useEffect, useRef, useState } from 'react'

export interface CodeReviewSubmitPopoverProps {
  open: boolean
  onDismiss: () => void
  onConfirm: (message?: string) => void
  commentsCount: number
}

export default function CodeReviewSubmitPopover({
  open,
  onDismiss,
  onConfirm,
  commentsCount,
}: CodeReviewSubmitPopoverProps): React.JSX.Element | null {
  const rootRef = useRef<HTMLDivElement>(null)
  const [message, setMessage] = useState('')
  const [prevOpen, setPrevOpen] = useState(open)
  const canSend = commentsCount > 0 || message.trim().length > 0

  // Sync-during-render reset of message when popover closes
  if (prevOpen !== open) {
    setPrevOpen(open)
    if (!open) setMessage('')
  }

  // Escape key + outside-click dismiss handlers
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss()
      }
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onDismiss()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [open, onDismiss])

  if (!open) return null

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Send review"
      style={{
        position: 'absolute',
        top: 40,
        right: 0,
        minWidth: 320,
        zIndex: 50,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: 16,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
      }}
    >
      <textarea
        aria-label="Message (optional)"
        placeholder="Leave a message for the agent (optional)"
        autoFocus
        value={message}
        rows={4}
        style={{
          width: '100%',
          minHeight: 80,
          fontSize: 14,
          fontFamily: 'inherit',
          background: 'var(--color-bg)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)',
          borderRadius: 4,
          padding: 12,
          resize: 'vertical',
          boxSizing: 'border-box',
          outline: 'none',
        }}
        onChange={(e) => setMessage(e.target.value)}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--color-focus)'
          e.currentTarget.style.outlineOffset = '2px'
        }}
        onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            onConfirm(message.trim() || undefined)
            e.preventDefault()
          }
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button
          type="button"
          disabled={!canSend}
          onClick={() => { onConfirm(message.trim() || undefined) }}
          style={{
            height: 32,
            paddingLeft: 16,
            paddingRight: 16,
            borderRadius: 6,
            border: 'none',
            background: 'var(--color-accent-approve)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: canSend ? 'pointer' : 'default',
            opacity: canSend ? 1 : 0.4,
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid var(--color-focus)'
            e.currentTarget.style.outlineOffset = '2px'
          }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
        >
          Send Review
        </button>
      </div>
    </div>
  )
}
