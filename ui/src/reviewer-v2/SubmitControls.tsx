import { useState, useEffect } from 'react'
import type { Annotation } from './types'
import type { ConnectivityStatus } from '../shared/connectivity'
import { buildClipboardPayload, shouldUseClipboard } from './offlineLabels'
import { serializeAnnotations } from './serializeAnnotations'
import SubmitPopover from './SubmitPopover'

export interface SubmitControlsProps {
  annotations: Annotation[]
  connectivity: ConnectivityStatus
}

type SubmitState =
  | 'idle'
  | 'popover_open'
  | 'confirmed_allow'
  | 'confirmed_deny'
  | 'clipboard_confirmed'
  | 'clipboard_error'

export default function SubmitControls({ annotations, connectivity }: SubmitControlsProps): React.JSX.Element {
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [clipboardJson, setClipboardJson] = useState('')

  const canApprove = annotations.length === 0
  const messageRequired = annotations.length === 0

  // Auto-close tab after online submission
  useEffect(() => {
    if (submitState === 'confirmed_allow' || submitState === 'confirmed_deny') {
      const id = window.setTimeout(() => {
        try { window.close() } catch { /* browser may block window.close() — ignore */ }
      }, 500)
      return () => clearTimeout(id)
    }
  }, [submitState])

  // Reset to idle after clipboard copy so buttons reappear
  useEffect(() => {
    if (submitState === 'clipboard_confirmed') {
      const id = window.setTimeout(() => setSubmitState('idle'), 3000)
      return () => clearTimeout(id)
    }
  }, [submitState])

  async function handleApprove() {
    if (shouldUseClipboard(connectivity)) {
      const json = buildClipboardPayload('allow', '', '', annotations)
      navigator.clipboard.writeText(json)
        .then(() => setSubmitState('clipboard_confirmed'))
        .catch(() => { setClipboardJson(json); setSubmitState('clipboard_error') })
      return
    }
    try {
      const res = await fetch('/api/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ behavior: 'allow' }),
      })
      if (res.ok || res.status === 409) {
        setSubmitState('confirmed_allow')
      } else {
        const json = buildClipboardPayload('allow', '', '', annotations)
        setClipboardJson(json)
        setSubmitState('clipboard_error')
      }
    } catch {
      const json = buildClipboardPayload('allow', '', '', annotations)
      setClipboardJson(json)
      setSubmitState('clipboard_error')
    }
  }

  async function handleAskForChanges(overallMessage: string) {
    if (shouldUseClipboard(connectivity)) {
      const json = buildClipboardPayload('deny', overallMessage, '', annotations)
      navigator.clipboard.writeText(json)
        .then(() => setSubmitState('clipboard_confirmed'))
        .catch(() => { setClipboardJson(json); setSubmitState('clipboard_error') })
      return
    }
    const message = serializeAnnotations(overallMessage, '', annotations)
    try {
      const res = await fetch('/api/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ behavior: 'deny', message }),
      })
      if (res.ok || res.status === 409) {
        setSubmitState('confirmed_deny')
      } else {
        const json = buildClipboardPayload('deny', overallMessage, '', annotations)
        setClipboardJson(json)
        setSubmitState('clipboard_error')
      }
    } catch {
      const json = buildClipboardPayload('deny', overallMessage, '', annotations)
      setClipboardJson(json)
      setSubmitState('clipboard_error')
    }
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
      {(submitState === 'idle' || submitState === 'popover_open') ? (
        <>
          <button
            type="button"
            className="submit-btn"
            disabled={!canApprove}
            title={!canApprove ? 'Cannot approve while comments exist' : undefined}
            onClick={handleApprove}
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
              cursor: canApprove ? 'pointer' : 'default',
              opacity: canApprove ? 1 : 0.4,
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid var(--color-focus)'
              e.currentTarget.style.outlineOffset = '2px'
            }}
            onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
            onMouseOver={(e) => {
              if (canApprove) e.currentTarget.style.background = 'var(--color-accent-approve-hover)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'var(--color-accent-approve)'
            }}
          >
            Approve
          </button>
          <button
            type="button"
            className="submit-btn"
            aria-haspopup="true"
            aria-expanded={submitState === 'popover_open'}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setSubmitState((s) => s === 'popover_open' ? 'idle' : 'popover_open')}
            style={{
              height: 32,
              paddingLeft: 12,
              paddingRight: 12,
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              opacity: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid var(--color-focus)'
              e.currentTarget.style.outlineOffset = '2px'
            }}
            onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
          >
            Send Feedback
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{'▾'}</span>
          </button>
          <SubmitPopover
            open={submitState === 'popover_open'}
            messageRequired={messageRequired}
            onDismiss={() => setSubmitState('idle')}
            onSubmit={(message) => { void handleAskForChanges(message) }}
          />
        </>
      ) : null}

      {submitState === 'confirmed_allow' && (
        <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-accent-approve)' }}>Approved</span>
          <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>You can close this tab.</span>
        </div>
      )}
      {submitState === 'confirmed_deny' && (
        <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-accent-deny)' }}>Feedback sent</span>
          <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>You can close this tab.</span>
        </div>
      )}
      {submitState === 'clipboard_confirmed' && (
        <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-accent-approve)' }}>Copied to clipboard</span>
          <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>Paste into your Claude conversation.</span>
        </div>
      )}
      {submitState === 'clipboard_error' && (
        <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-accent-deny)' }}>Clipboard write failed</span>
            <button
              type="button"
              onClick={() => setSubmitState('idle')}
              style={{
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
          <textarea
            readOnly
            value={clipboardJson}
            aria-label="JSON payload — copy and paste into Claude"
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            style={{
              width: 320,
              height: 80,
              fontFamily: 'monospace',
              fontSize: 12,
              padding: 8,
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-text-primary)',
              resize: 'vertical',
              cursor: 'text',
            }}
          />
        </div>
      )}
    </div>
  )
}
