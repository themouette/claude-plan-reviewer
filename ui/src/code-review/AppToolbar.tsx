import { useEffect, useState } from 'react'
import type { CodeReviewComment } from './types'
import type { ConnectivityStatus } from '../shared/connectivity'
import { buildCodeReviewPayload, shouldUseClipboard } from './buildCodeReviewPayload'
import CodeReviewSubmitPopover from './CodeReviewSubmitPopover'

export interface AppToolbarProps {
  diffStyle: 'unified' | 'split'
  contextExpanded: boolean
  contextLoading: boolean
  onDiffStyleChange: (style: 'unified' | 'split') => void
  onExpandAll: () => void
  commitsOpen: boolean
  onCommitsToggle: () => void
  // Phase 26.2 D-08 additions — file expand/collapse
  allFilesExpanded: boolean
  filesCount: number  // WR-02: disable toggle-all button when there are no files
  onToggleAllFiles: () => void
  // Phase 28 additions: submit controls
  comments: CodeReviewComment[]
  connectivity: ConnectivityStatus
  onApprove: (globalInstruction?: string) => void
  onRequestChanges: () => void
}

export default function AppToolbar({
  diffStyle,
  contextExpanded,
  contextLoading,
  onDiffStyleChange,
  onExpandAll,
  commitsOpen,
  onCommitsToggle,
  allFilesExpanded,
  filesCount,
  onToggleAllFiles,
  comments,
  connectivity,
}: AppToolbarProps): React.JSX.Element {
  type SubmitState =
    | 'idle'
    | 'popover_open'
    | 'confirmed_approve'
    | 'confirmed_request_changes'
    | 'clipboard_confirmed'
    | 'clipboard_error'

  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [clipboardJson, setClipboardJson] = useState('')

  const canApprove = comments.length === 0
  const canRequestChanges = comments.length > 0

  // Auto-close tab after confirmed states (500ms)
  useEffect(() => {
    if (submitState === 'confirmed_approve' || submitState === 'confirmed_request_changes') {
      const id = window.setTimeout(() => {
        try { window.close() } catch { /* browser may block window.close() — ignore */ }
      }, 500)
      return () => clearTimeout(id)
    }
  }, [submitState])

  // Auto-reset clipboard_confirmed to idle after 3000ms
  useEffect(() => {
    if (submitState === 'clipboard_confirmed') {
      const id = window.setTimeout(() => setSubmitState('idle'), 3000)
      return () => clearTimeout(id)
    }
  }, [submitState])
  async function handleApprove(globalInstruction?: string) {
    if (shouldUseClipboard(connectivity)) {
      const json = buildCodeReviewPayload('approved', comments, globalInstruction)
      navigator.clipboard.writeText(json)
        .then(() => setSubmitState('clipboard_confirmed'))
        .catch(() => { setClipboardJson(json); setSubmitState('clipboard_error') })
      return
    }
    try {
      const body = buildCodeReviewPayload('approved', comments, globalInstruction)
      const res = await fetch('/api/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (res.ok || res.status === 409) {
        setSubmitState('confirmed_approve')
      } else {
        setClipboardJson(body)
        setSubmitState('clipboard_error')
      }
    } catch {
      const json = buildCodeReviewPayload('approved', comments, globalInstruction)
      setClipboardJson(json)
      setSubmitState('clipboard_error')
    }
  }

  async function handleRequestChanges() {
    if (shouldUseClipboard(connectivity)) {
      const json = buildCodeReviewPayload('changes_requested', comments)
      navigator.clipboard.writeText(json)
        .then(() => setSubmitState('clipboard_confirmed'))
        .catch(() => { setClipboardJson(json); setSubmitState('clipboard_error') })
      return
    }
    try {
      const body = buildCodeReviewPayload('changes_requested', comments)
      const res = await fetch('/api/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (res.ok || res.status === 409) {
        setSubmitState('confirmed_request_changes')
      } else {
        setClipboardJson(body)
        setSubmitState('clipboard_error')
      }
    } catch {
      const json = buildCodeReviewPayload('changes_requested', comments)
      setClipboardJson(json)
      setSubmitState('clipboard_error')
    }
  }

  // WR-04: focusedButton state removed — it was never read in rendering (dead code).
  // The imperative e.currentTarget.style.outline approach already works without state.
  function makeFocusHandlers(_id: string) {
    return {
      onFocus: (e: React.FocusEvent<HTMLButtonElement>) => {
        e.currentTarget.style.outline = '2px solid var(--color-focus)'
        e.currentTarget.style.outlineOffset = '2px'
      },
      onBlur: (e: React.FocusEvent<HTMLButtonElement>) => {
        e.currentTarget.style.outline = 'none'
      },
    }
  }

  return (
    <header
      style={{
        height: 48,
        flexShrink: 0,
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      {/* Left: title */}
      <span
        style={{
          fontSize: 14,
          fontWeight: 400,
          color: 'var(--color-text-secondary)',
        }}
      >
        Code Review
      </span>

      {/* Right: controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Phase 28 submit controls (replaces D-03 Reserved slot) */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
          {(submitState === 'idle' || submitState === 'popover_open') && (
            <>
              <span title={!canApprove ? 'Cannot approve while comments exist' : undefined} style={{ display: 'inline-flex' }}>
                <button
                  type="button"
                  className="submit-btn"
                  disabled={!canApprove}
                  onClick={() => {
                    if (shouldUseClipboard(connectivity)) {
                      void handleApprove()
                    } else {
                      setSubmitState('popover_open')
                    }
                  }}
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
                  onMouseOver={(e) => {
                    if (canApprove) e.currentTarget.style.background = 'var(--color-accent-approve-hover)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'var(--color-accent-approve)'
                  }}
                  {...makeFocusHandlers('approve')}
                >
                  {'Approve'}
                </button>
              </span>

              <span title={!canRequestChanges ? 'Add at least one comment before requesting changes' : undefined} style={{ display: 'inline-flex' }}>
                <button
                  type="button"
                  className="submit-btn"
                  disabled={!canRequestChanges}
                  onClick={() => { void handleRequestChanges() }}
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
                    cursor: canRequestChanges ? 'pointer' : 'default',
                    opacity: canRequestChanges ? 1 : 0.4,
                    outline: 'none',
                  }}
                  {...makeFocusHandlers('request-changes')}
                >
                  {'Request Changes'}
                </button>
              </span>

              <CodeReviewSubmitPopover
                open={submitState === 'popover_open'}
                onDismiss={() => setSubmitState('idle')}
                onConfirm={(gi) => { void handleApprove(gi) }}
              />
            </>
          )}

          {submitState === 'confirmed_approve' && (
            <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-accent-approve)' }}>{'Approved'}</span>
              <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>{'You can close this tab.'}</span>
            </div>
          )}

          {submitState === 'confirmed_request_changes' && (
            <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-accent-deny)' }}>{'Review submitted'}</span>
              <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>{'You can close this tab.'}</span>
            </div>
          )}

          {submitState === 'clipboard_confirmed' && (
            <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-accent-approve)' }}>{'Copied to clipboard'}</span>
              <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>{'Paste into your Claude conversation.'}</span>
            </div>
          )}

          {submitState === 'clipboard_error' && (
            <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-accent-deny)' }}>{'Clipboard write failed'}</span>
                <button
                  type="button"
                  onClick={() => setSubmitState('idle')}
                  style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                >
                  {'Dismiss'}
                </button>
              </div>
              <textarea
                readOnly
                value={clipboardJson}
                aria-label="JSON payload — copy and paste into Claude"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                style={{ width: 320, height: 80, fontFamily: 'monospace', fontSize: 12, padding: 8, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', resize: 'vertical', cursor: 'text' }}
              />
            </div>
          )}
        </div>

        {/* Commits toggle button — Phase 26 */}
        <button
          type="button"
          onClick={onCommitsToggle}
          style={{
            height: 32,
            padding: '0 16px',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            fontSize: 14,
            cursor: 'pointer',
            outline: 'none',
            background: 'var(--color-surface)',
            color: commitsOpen ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            fontWeight: commitsOpen ? 600 : 400,
          }}
          {...makeFocusHandlers('commits')}
        >
          {'Commits'}
        </button>

        {/* Layout toggle: Unified | Side-by-side */}
        <div
          style={{
            display: 'flex',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
          }}
        >
          {(['unified', 'split'] as const).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => onDiffStyleChange(style)}
              style={{
                height: 32,
                padding: '0 12px',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                cursor: 'pointer',
                outline: 'none',
                background:
                  diffStyle === style ? 'var(--color-surface)' : 'transparent',
                color:
                  diffStyle === style
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-secondary)',
                fontWeight: diffStyle === style ? 600 : 400,
              }}
              {...makeFocusHandlers(`layout-${style}`)}
            >
              {style === 'unified' ? 'Unified' : 'Side-by-side'}
            </button>
          ))}
        </div>

        {/* Expand All / Collapse / Loading */}
        <button
          type="button"
          onClick={onExpandAll}
          disabled={contextLoading}
          style={{
            height: 32,
            padding: '0 16px',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            fontSize: 14,
            cursor: contextLoading ? 'default' : 'pointer',
            outline: 'none',
            background: 'var(--color-surface)',
            color: contextExpanded
              ? 'var(--color-text-primary)'
              : 'var(--color-text-secondary)',
            fontWeight: contextExpanded ? 600 : 400,
          }}
          {...makeFocusHandlers('expand')}
        >
          {contextLoading ? 'Loading...' : contextExpanded ? 'Collapse' : 'Expand All'}
        </button>

        {/* D-08: Expand Files / Collapse Files — toggles per-file collapse state */}
        <button
          type="button"
          onClick={onToggleAllFiles}
          disabled={filesCount === 0}
          style={{
            height: 32,
            padding: '0 16px',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            fontSize: 14,
            cursor: filesCount === 0 ? 'default' : 'pointer',
            outline: 'none',
            background: 'var(--color-surface)',
            color: allFilesExpanded ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            fontWeight: allFilesExpanded ? 600 : 400,
          }}
          {...makeFocusHandlers('files-expand')}
        >
          {allFilesExpanded ? 'Collapse Files' : 'Expand Files'}
        </button>
      </div>
    </header>
  )
}
