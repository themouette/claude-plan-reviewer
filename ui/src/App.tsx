import { useEffect, useRef, useState } from 'react'
import type { Annotation, AnnotationType, Tab } from './types'
import { serializeAnnotations } from './utils/serializeAnnotations'
import { useTextSelection } from './hooks/useTextSelection'
import { TabBar } from './components/TabBar'
import { DiffView } from './components/DiffView'
import { AnnotationSidebar } from './components/AnnotationSidebar'

// --- Types ---

type AppState = 'loading' | 'error' | 'reviewing' | 'confirmed'

type Decision = 'allow' | 'deny'

// --- Sub-components ---

function PageHeader({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }) {
  return (
    <header
      style={{
        height: '48px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
        Plan Review
      </span>
      <TabBar activeTab={activeTab} onTabChange={onTabChange} />
    </header>
  )
}

function LoadingSpinner() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexGrow: 1,
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          border: '3px solid var(--color-text-secondary)',
          borderTopColor: 'var(--color-accent-approve)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
    </div>
  )
}

function ErrorView() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flexGrow: 1,
        padding: '32px',
        textAlign: 'center',
      }}
    >
      <h2
        style={{
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          marginBottom: '12px',
        }}
      >
        Could not load plan
      </h2>
      <p
        style={{
          fontSize: '16px',
          fontWeight: 400,
          color: 'var(--color-text-secondary)',
          maxWidth: '480px',
          lineHeight: 1.6,
        }}
      >
        The plan reviewer failed to connect to the local server. Check that the binary is still
        running, then reload this page.
      </p>
    </div>
  )
}

function ConfirmationView({ decision }: { decision: Decision }) {
  const approved = decision === 'allow'

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        window.close()
      } catch {
        // Expected: browsers block window.close() for tabs not opened via window.open()
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flexGrow: 1,
        padding: '32px',
        textAlign: 'center',
      }}
    >
      <h2
        style={{
          fontSize: '28px',
          fontWeight: 600,
          color: approved ? 'var(--color-accent-approve)' : 'var(--color-accent-deny)',
          marginBottom: '12px',
        }}
      >
        {approved ? 'Plan approved' : 'Plan denied'}
      </h2>
      <p
        style={{
          fontSize: '14px',
          fontWeight: 400,
          color: 'var(--color-text-secondary)',
        }}
      >
        {approved
          ? 'You can close this tab.'
          : 'Your feedback has been sent. You can close this tab.'}
      </p>
    </div>
  )
}

// --- Main App ---

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading')
  const [planHtml, setPlanHtml] = useState<string>('')
  const [decision, setDecision] = useState<Decision | null>(null)
  const [denyOpen, setDenyOpen] = useState(false)
  const [denyMessage, setDenyMessage] = useState('')
  const denyTextareaRef = useRef<HTMLTextAreaElement>(null)
  const denyButtonRef = useRef<HTMLButtonElement>(null)

  // Phase 2 state
  const [activeTab, setActiveTab] = useState<Tab>('plan')
  const [diff, setDiff] = useState<string>('')
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [overallComment, setOverallComment] = useState<string>('')
  const planRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const selectedText = useTextSelection(planRef)

  // Fetch plan HTML on mount
  useEffect(() => {
    fetch('/api/plan')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: { plan_html: string }) => {
        setPlanHtml(data.plan_html)
        setAppState('reviewing')
      })
      .catch(() => {
        setAppState('error')
      })
  }, [])

  // Fetch diff on mount
  useEffect(() => {
    fetch('/api/diff')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: { diff: string }) => setDiff(data.diff))
      .catch(() => setDiff(''))
  }, [])

  // Global Enter key handler for approve shortcut
  useEffect(() => {
    if (appState !== 'reviewing') return

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      if ((document.activeElement as HTMLElement)?.tagName === 'TEXTAREA') return
      if (denyOpen) return
      // Suppress Enter when focus is inside the annotation sidebar
      if (sidebarRef.current?.contains(document.activeElement)) return
      approve()
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [appState, denyOpen])

  // Escape key handler to close deny form
  useEffect(() => {
    if (!denyOpen) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDenyOpen(false)
        denyButtonRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [denyOpen])

  // Focus textarea when deny form opens
  useEffect(() => {
    if (denyOpen) {
      denyTextareaRef.current?.focus()
    }
  }, [denyOpen])

  // --- Anchor highlight helpers (D-03) ---

  /**
   * Walk all text nodes under planRef.current and return the character offset
   * where `anchorText` first appears in the concatenated text content.
   * Returns Infinity if not found (appends to end).
   */
  function getAnchorOffset(anchorText: string): number {
    if (!planRef.current) return Infinity
    const walker = document.createTreeWalker(planRef.current, NodeFilter.SHOW_TEXT)
    let charOffset = 0
    let node: Text | null
    while ((node = walker.nextNode() as Text | null)) {
      const text = node.textContent ?? ''
      const idx = text.indexOf(anchorText)
      if (idx >= 0) {
        return charOffset + idx
      }
      charOffset += text.length
    }
    return Infinity
  }

  function highlightAnchor(anchorText: string) {
    if (!planRef.current) return
    const walker = document.createTreeWalker(planRef.current, NodeFilter.SHOW_TEXT)
    let node: Text | null
    while ((node = walker.nextNode() as Text | null)) {
      const idx = node.textContent?.indexOf(anchorText) ?? -1
      if (idx >= 0) {
        try {
          const range = document.createRange()
          range.setStart(node, idx)
          range.setEnd(node, idx + anchorText.length)
          const mark = document.createElement('mark')
          mark.className = 'annotation-highlighted'
          mark.setAttribute('aria-label', 'Annotated text')
          range.surroundContents(mark)
        } catch {
          // surroundContents throws if range crosses element boundaries -- skip highlight
        }
        break
      }
    }
  }

  function clearHighlights() {
    if (!planRef.current) return
    const marks = planRef.current.querySelectorAll('mark.annotation-highlighted')
    marks.forEach((mark) => {
      const parent = mark.parentNode
      if (parent) {
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark)
        }
        parent.removeChild(mark)
      }
    })
  }

  // --- Annotation handlers ---

  function handleAddAnnotation(type: AnnotationType, anchorText: string) {
    const newAnnotation: Annotation = {
      id: crypto.randomUUID(),
      type,
      anchorText,
      comment: '',
      replacement: '',
    }
    // D-03: Insert in positional order (top-to-bottom as anchor text appears in the plan).
    // Compute the character offset of the new annotation's anchorText in the plan DOM,
    // then find the correct insertion index in the sorted annotations array.
    const newOffset = getAnchorOffset(anchorText)
    setAnnotations((prev) => {
      // Find insertion index: first annotation whose offset is greater than newOffset
      const offsets = prev.map((a) => getAnchorOffset(a.anchorText))
      let insertIdx = prev.length
      for (let i = 0; i < offsets.length; i++) {
        if (offsets[i] > newOffset) {
          insertIdx = i
          break
        }
      }
      const next = [...prev]
      next.splice(insertIdx, 0, newAnnotation)
      return next
    })
    // Clear browser selection after adding annotation
    document.getSelection()?.removeAllRanges()
  }

  function handleRemoveAnnotation(id: string) {
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
  }

  function handleUpdateAnnotation(id: string, field: 'comment' | 'replacement', value: string) {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    )
  }

  // --- Decision handlers ---

  async function approve() {
    if (appState !== 'reviewing') return
    try {
      const res = await fetch('/api/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ behavior: 'allow' }),
      })
      if (res.ok || res.status === 409) {
        setDecision('allow')
        setAppState('confirmed')
      } else {
        setAppState('error')
      }
    } catch {
      setAppState('error')
    }
  }

  async function deny() {
    if (appState !== 'reviewing') return
    const message = serializeAnnotations(denyMessage, overallComment, annotations)
    if (!message.trim()) return
    try {
      const res = await fetch('/api/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ behavior: 'deny', message }),
      })
      if (res.ok || res.status === 409) {
        setDecision('deny')
        setAppState('confirmed')
      } else {
        setAppState('error')
      }
    } catch {
      setAppState('error')
    }
  }

  const hasAnnotations = annotations.length > 0 || overallComment.trim().length > 0
  const denyMessageValid = denyMessage.trim().length > 0 || hasAnnotations

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      <PageHeader activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Non-reviewing states: loading, error, confirmed */}
      <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {appState === 'loading' && <LoadingSpinner />}
        {appState === 'error' && <ErrorView />}
        {appState === 'confirmed' && decision && <ConfirmationView decision={decision} />}
      </div>

      {/* Two-column layout — only shown during review */}
      {appState === 'reviewing' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexGrow: 1,
            overflow: 'hidden',
          }}
        >
          {/* Left column: plan tab panel */}
          <div
            id="tabpanel-plan"
            role="tabpanel"
            aria-labelledby="tab-plan"
            style={{
              flexGrow: 1,
              overflowY: 'auto',
              padding: '32px',
              display: activeTab === 'plan' ? 'block' : 'none',
            }}
          >
            <div ref={planRef} className="plan-prose" dangerouslySetInnerHTML={{ __html: planHtml }} />
          </div>

          {/* Left column: diff tab panel */}
          <div
            id="tabpanel-diff"
            role="tabpanel"
            aria-labelledby="tab-diff"
            style={{
              flexGrow: 1,
              overflowY: 'auto',
              padding: '32px',
              display: activeTab === 'diff' ? 'flex' : 'none',
              alignItems: 'flex-start',
            }}
          >
            <DiffView diff={diff} />
          </div>

          {/* Right column: annotation sidebar */}
          <AnnotationSidebar
            annotations={annotations}
            overallComment={overallComment}
            onOverallCommentChange={setOverallComment}
            onAddAnnotation={handleAddAnnotation}
            onRemoveAnnotation={handleRemoveAnnotation}
            onUpdateAnnotation={handleUpdateAnnotation}
            selectedText={selectedText}
            activeTab={activeTab}
            sidebarRef={sidebarRef}
            onAnnotationHover={(anchorText) => { clearHighlights(); highlightAnchor(anchorText); }}
            onAnnotationLeave={() => clearHighlights()}
          />
        </div>
      )}

      {/* Action bar — only shown during review */}
      {appState === 'reviewing' && (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: 'var(--color-surface)',
            borderTop: '1px solid var(--color-border)',
            padding: '16px 32px',
          }}
        >
          {/* Approve + Deny buttons row */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            {/* Approve button */}
            <button
              autoFocus
              onClick={approve}
              style={{
                background: 'var(--color-accent-approve)',
                color: 'var(--color-text-primary)',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                minHeight: '44px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                outline: 'none',
              }}
              onMouseOver={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  'var(--color-accent-approve-hover)')
              }
              onMouseOut={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  'var(--color-accent-approve)')
              }
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--color-focus)'
                e.currentTarget.style.outlineOffset = '2px'
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none'
              }}
            >
              Approve
              <span
                style={{
                  fontSize: '14px',
                  color: 'rgba(241, 245, 249, 0.6)',
                  fontWeight: 400,
                }}
              >
                ↵ Enter
              </span>
            </button>

            {/* Deny toggle button */}
            <button
              ref={denyButtonRef}
              onClick={() => {
                setDenyOpen((prev) => !prev)
              }}
              style={{
                background: 'transparent',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '8px 16px',
                minHeight: '44px',
                fontSize: '16px',
                fontWeight: 400,
                cursor: 'pointer',
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
              Deny
            </button>
          </div>

          {/* Deny form — expanded inline */}
          {denyOpen && (
            <div style={{ marginTop: '16px' }}>
              <label
                htmlFor="deny-message"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 400,
                  color: 'var(--color-text-secondary)',
                  marginBottom: '8px',
                }}
              >
                What needs to change?
              </label>
              <textarea
                id="deny-message"
                ref={denyTextareaRef}
                value={denyMessage}
                onChange={(e) => setDenyMessage(e.target.value)}
                placeholder="Describe what Claude should revise before proceeding..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && denyMessageValid) {
                    e.preventDefault()
                    deny()
                  }
                }}
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
              <button
                onClick={() => {
                  if (denyMessageValid) deny()
                }}
                style={{
                  marginTop: '8px',
                  background: 'var(--color-accent-deny)',
                  color: 'var(--color-text-primary)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  minHeight: '44px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: denyMessageValid ? 'pointer' : 'default',
                  opacity: denyMessageValid ? 1 : 0.4,
                  pointerEvents: denyMessageValid ? 'auto' : 'none',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  if (denyMessageValid) {
                    e.currentTarget.style.outline = '2px solid var(--color-focus)'
                    e.currentTarget.style.outlineOffset = '2px'
                  }
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = 'none'
                }}
              >
                Submit Denial
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
