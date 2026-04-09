import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Annotation, AnnotationType, Tab } from './types'
import { serializeAnnotations } from './utils/serializeAnnotations'
import { useTextSelection, rangeFromOffsets } from './hooks/useTextSelection'
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
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null)
  const [focusAnnotationId, setFocusAnnotationId] = useState<string | null>(null)
  const planRef = useRef<HTMLDivElement>(null)
  const planTabRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const [selectedText, resetTextSelection, getSelectionOffsets] = useTextSelection(planRef)
  const annotationOffsetsRef = useRef<Map<string, { start: number; end: number }>>(new Map())
  // Ref copy of annotations so scroll handlers see fresh data without stale closure.
  const annotationsRef = useRef(annotations)
  useEffect(() => { annotationsRef.current = annotations }, [annotations])

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

  // Escape key handler to dismiss active text selection
  useEffect(() => {
    if (denyOpen || !selectedText) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resetTextSelection()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [denyOpen, selectedText, resetTextSelection])

  // Hover over annotated text → highlight matching sidebar card.
  // Attached to document (not planRef) so it works regardless of when the plan
  // div mounts. planRef.current is read fresh on each event, not at setup time.
  useEffect(() => {
    type CaretPos = { offsetNode: Node; offset: number }
    type DocWithCaret = Document & { caretPositionFromPoint?: (x: number, y: number) => CaretPos | null }

    function getCaretOffset(x: number, y: number): number | null {
      const container = planRef.current
      if (!container) return null

      let range: Range | null = null
      if (typeof document.caretRangeFromPoint === 'function') {
        range = document.caretRangeFromPoint(x, y)
      } else {
        const pos = (document as DocWithCaret).caretPositionFromPoint?.(x, y)
        if (pos) {
          range = document.createRange()
          range.setStart(pos.offsetNode, pos.offset)
        }
      }
      if (!range || !container.contains(range.startContainer)) return null

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
      let count = 0
      let node: Node | null
      while ((node = walker.nextNode())) {
        if (node === range.startContainer) return count + range.startOffset
        count += (node.textContent ?? '').length
      }
      return null
    }

    const onMove = (e: MouseEvent) => {
      // Skip if the pointer is outside the plan content area.
      if (!planRef.current?.contains(e.target as Node)) {
        setHoveredAnnotationId((prev) => (prev !== null ? null : prev))
        return
      }
      const offset = getCaretOffset(e.clientX, e.clientY)
      if (offset === null) {
        setHoveredAnnotationId((prev) => (prev !== null ? null : prev))
        return
      }
      for (const [id, ann] of annotationOffsetsRef.current) {
        if (offset >= ann.start && offset < ann.end) {
          setHoveredAnnotationId((prev) => (prev !== id ? id : prev))
          return
        }
      }
      setHoveredAnnotationId((prev) => (prev !== null ? null : prev))
    }

    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [])

  // Focus the comment/replace textarea of a newly added annotation.
  useLayoutEffect(() => {
    if (!focusAnnotationId || !sidebarRef.current) return
    const textarea = sidebarRef.current.querySelector<HTMLTextAreaElement>(
      `[data-annotation-id="${focusAnnotationId}"] textarea`
    )
    if (textarea) {
      textarea.focus()
      setFocusAnnotationId(null)
    }
  }, [focusAnnotationId, annotations])

  // Rebuild CSS annotation highlights after every render using fresh Ranges from
  // stored offsets. useLayoutEffect (no deps) ensures the highlights are valid
  // even after React reconciliation touches plan-prose and collapses stored Ranges.
  useLayoutEffect(() => {
    if (!planRef.current || typeof CSS === 'undefined' || !CSS.highlights) return
    const comment: Range[] = []
    const del: Range[] = []
    const replace: Range[] = []
    for (const a of annotations) {
      const offsets = annotationOffsetsRef.current.get(a.id)
      if (!offsets) continue
      const range = rangeFromOffsets(planRef.current, offsets.start, offsets.end)
      if (!range) continue
      if (a.type === 'comment') comment.push(range)
      else if (a.type === 'delete') del.push(range)
      else replace.push(range)
    }
    comment.length > 0
      ? CSS.highlights.set('annotation-comment', new Highlight(...comment))
      : CSS.highlights.delete('annotation-comment')
    del.length > 0
      ? CSS.highlights.set('annotation-delete', new Highlight(...del))
      : CSS.highlights.delete('annotation-delete')
    replace.length > 0
      ? CSS.highlights.set('annotation-replace', new Highlight(...replace))
      : CSS.highlights.delete('annotation-replace')
  })

  // --- Aligned card layout ---

  function computeAndApplyLayout() {
    const planTab = planTabRef.current
    const sidebar = sidebarRef.current
    if (!planTab || !sidebar || !planRef.current) return

    const planRect = planTab.getBoundingClientRect()
    const planScrollTop = planTab.scrollTop
    const CARD_GAP = 8

    // Compute document-relative desired Y for each annotation.
    const entries = annotationsRef.current.map((a) => {
      const offsets = annotationOffsetsRef.current.get(a.id)
      if (!offsets || !planRef.current) return { id: a.id, type: a.type, desired: 0 }
      const range = rangeFromOffsets(planRef.current, offsets.start, offsets.end)
      if (!range) return { id: a.id, type: a.type, desired: 0 }
      const rect = range.getBoundingClientRect()
      // Convert viewport-relative Y to document-relative (scroll-independent).
      const docY = rect.top - planRect.top + planScrollTop
      return { id: a.id, type: a.type, desired: Math.max(0, docY) }
    })

    // Greedy forward-pass: push cards down so they never overlap.
    // Estimated heights: delete ≈ 100px, comment/replace ≈ 212px.
    let cursor = 0
    for (const { id, type, desired } of entries) {
      const top = Math.max(desired, cursor)
      const wrapper = sidebar.querySelector<HTMLElement>(`[data-annotation-id="${id}"]`)
      if (wrapper) wrapper.style.top = `${top}px`
      cursor = top + (type === 'delete' ? 100 : 212) + CARD_GAP
    }

    // Size the inner container to match plan scroll height so the synced
    // scroll area can reach every position the plan can reach.
    const cardsInner = sidebar.querySelector<HTMLElement>('[data-cards-inner]')
    if (cardsInner) cardsInner.style.height = `${planTab.scrollHeight}px`

    // Sync scroll so cards move with the plan text.
    const cardsScroll = sidebar.querySelector<HTMLElement>('[data-cards-scroll]')
    if (cardsScroll) cardsScroll.scrollTop = planScrollTop
  }

  // Recompute after every render (catches annotation add/remove and initial mount).
  useLayoutEffect(() => { computeAndApplyLayout() })

  // Recompute on plan scroll — attach after plan tab mounts (appState → 'reviewing').
  useEffect(() => {
    const planTab = planTabRef.current
    if (!planTab) return
    planTab.addEventListener('scroll', computeAndApplyLayout)
    return () => planTab.removeEventListener('scroll', computeAndApplyLayout)
  }, [appState])

  // Recompute on window resize.
  useEffect(() => {
    window.addEventListener('resize', computeAndApplyLayout)
    return () => window.removeEventListener('resize', computeAndApplyLayout)
  }, [])

  // --- Anchor highlight helpers ---

  function highlightAnchor(anchorText: string) {
    if (!planRef.current || typeof CSS === 'undefined' || !CSS.highlights) return
    const annotation = annotations.find((a) => a.anchorText === anchorText)
    if (!annotation) return
    const offsets = annotationOffsetsRef.current.get(annotation.id)
    if (!offsets) return
    const range = rangeFromOffsets(planRef.current, offsets.start, offsets.end)
    if (!range) return
    CSS.highlights.set('annotation-hover', new Highlight(range))
  }

  function clearHighlights() {
    if (typeof CSS === 'undefined' || !CSS.highlights) return
    CSS.highlights.delete('annotation-hover')
  }

  // --- Annotation handlers ---

  function handleAddAnnotation(type: AnnotationType, anchorText: string) {
    const id = crypto.randomUUID()

    // Capture character offsets before resetTextSelection clears them.
    // Offsets survive React reconciliation; live Range objects don't.
    const offsets = getSelectionOffsets()
    if (offsets) annotationOffsetsRef.current.set(id, offsets)

    const newAnnotation: Annotation = {
      id,
      type,
      anchorText,
      comment: '',
      replacement: '',
    }
    // Insert in positional order using the stored start offset.
    const newStart = offsets?.start ?? Infinity
    setAnnotations((prev) => {
      let insertIdx = prev.length
      for (let i = 0; i < prev.length; i++) {
        const prevStart = annotationOffsetsRef.current.get(prev[i].id)?.start ?? Infinity
        if (prevStart > newStart) {
          insertIdx = i
          break
        }
      }
      const next = [...prev]
      next.splice(insertIdx, 0, newAnnotation)
      return next
    })
    // Auto-focus the textarea for comment and replace annotations.
    if (type === 'comment' || type === 'replace') {
      setFocusAnnotationId(id)
    }
    resetTextSelection()
  }

  function handleRemoveAnnotation(id: string) {
    annotationOffsetsRef.current.delete(id)
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
      {appState !== 'reviewing' && (
        <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {appState === 'loading' && <LoadingSpinner />}
          {appState === 'error' && <ErrorView />}
          {appState === 'confirmed' && decision && <ConfirmationView decision={decision} />}
        </div>
      )}

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
            ref={planTabRef}
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
            onAddAnnotation={handleAddAnnotation}
            onRemoveAnnotation={handleRemoveAnnotation}
            onUpdateAnnotation={handleUpdateAnnotation}
            selectedText={selectedText}
            activeTab={activeTab}
            sidebarRef={sidebarRef}
            hoveredAnnotationId={hoveredAnnotationId}
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
          {/* Overall comment */}
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="overall-comment"
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 400,
                color: 'var(--color-text-secondary)',
                marginBottom: '8px',
              }}
            >
              Overall comment
            </label>
            <textarea
              id="overall-comment"
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              placeholder="Add an overall note for Claude..."
              rows={2}
              style={{
                display: 'block',
                width: '100%',
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
          </div>

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
