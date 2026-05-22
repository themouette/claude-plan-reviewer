import { useEffect, useRef } from 'react'

export interface SubmitPopoverProps {
  open: boolean
  onDismiss: () => void
  onSubmit: (message: string) => void
}

export default function SubmitPopover({ open, onDismiss, onSubmit }: SubmitPopoverProps): React.JSX.Element | null {
  const rootRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
      aria-label="Send feedback"
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
        ref={textareaRef}
        aria-label="Overall message (optional)"
        placeholder="Leave a message (optional)"
        autoFocus
        defaultValue=""
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
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--color-focus)'
          e.currentTarget.style.outlineOffset = '2px'
        }}
        onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            onSubmit(textareaRef.current?.value ?? '')
            e.preventDefault()
          }
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button
          type="button"
          onClick={() => onSubmit(textareaRef.current?.value ?? '')}
          style={{
            height: 32,
            paddingLeft: 16,
            paddingRight: 16,
            borderRadius: 6,
            border: 'none',
            background: 'var(--color-accent-deny)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid var(--color-focus)'
            e.currentTarget.style.outlineOffset = '2px'
          }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
        >
          Send Feedback
        </button>
      </div>
    </div>
  )
}
