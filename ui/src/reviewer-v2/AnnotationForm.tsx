import { useEffect, useRef } from 'react'
import type { AnnotationType } from './types'

export interface FormState {
  type: AnnotationType
  anchorText: string
  anchorStart: number
  anchorEnd: number
  prefill: string
  rect: { top: number; left: number }
}

export default function AnnotationForm({
  formState,
  onSubmit,
  onCancel,
}: {
  formState: FormState
  onSubmit: (comment: string) => void
  onCancel: () => void
}): React.JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCancel()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onCancel])

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
      ref={containerRef}
      role="group"
      aria-label="Add annotation"
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: formState.rect.top,
        left: formState.rect.left,
        zIndex: 20,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        padding: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        width: 280,
      }}
    >
      <textarea
        ref={textareaRef}
        autoFocus
        defaultValue={formState.prefill}
        placeholder={formState.prefill === '' ? 'Add a comment…' : undefined}
        aria-label="Comment text"
        onKeyDown={handleKeyDown}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          minHeight: 64,
          fontSize: 14,
          fontFamily: 'inherit',
          background: 'transparent',
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
            fontSize: 13,
            fontWeight: 400,
            borderRadius: 4,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Dismiss
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
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 4,
            border: 'none',
            cursor: 'pointer',
            minWidth: 44,
          }}
        >
          Post Comment
        </button>
      </div>
    </div>
  )
}
