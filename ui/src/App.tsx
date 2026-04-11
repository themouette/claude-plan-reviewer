import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Annotation, AnnotationType, OutlineItem, Tab, ViewMode } from './types'
import { serializeAnnotations } from './utils/serializeAnnotations'
import { useTextSelection, rangeFromOffsets } from './hooks/useTextSelection'
import { TabBar } from './components/TabBar'
import { DiffView } from './components/DiffView'
import { AnnotationSidebar } from './components/AnnotationSidebar'
import { PlanOutline } from './components/PlanOutline'
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

// Configure marked with GFM and syntax highlighting (module-level, runs once)
marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext'
    return hljs.highlight(code, { language }).value
  },
}))
marked.use({ gfm: true })

// --- Types ---

type AppState = 'loading' | 'error' | 'reviewing' | 'confirmed'

type Decision = 'allow' | 'deny'

// --- Sub-components ---

function PageHeader({ activeTab, onTabChange, theme, onThemeToggle }: {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  theme: 'dark' | 'light'
  onThemeToggle: () => void
}) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <TabBar activeTab={activeTab} onTabChange={onTabChange} />
        <button
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={onThemeToggle}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            fontSize: '18px',
            outline: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.15)' }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'none' }}
          onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-focus)'; e.currentTarget.style.outlineOffset = '2px' }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
        >
          {theme === 'dark' ? '\u2600' : '\u263D'}
        </button>
      </div>
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

interface FloatingAnnotationAffordanceProps {
  top: number
  left: number
  selectedText: string
  onAddAnnotation: (type: AnnotationType, anchorText: string, prefillComment?: string) => void
}

const QUICK_ACTIONS = [
  'clarify this',
  'needs test',
  'give me an example',
  'out of scope',
  'search internet',
  'search codebase',
] as const

const inlineChips = QUICK_ACTIONS.slice(0, 0)
const overflowChips = QUICK_ACTIONS.slice(0)

function FloatingAnnotationAffordance({ top, left, selectedText, onAddAnnotation }: FloatingAnnotationAffordanceProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const pills: { type: AnnotationType; label: string; bg: string; color: string }[] = [
    { type: 'comment', label: 'Comment', bg: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' },
    { type: 'delete',  label: 'Delete',  bg: 'rgba(239, 68, 68, 0.2)',  color: '#ef4444' },
    { type: 'replace', label: 'Replace', bg: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' },
  ]
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        zIndex: 20,
        display: 'flex',
        gap: '6px',
        background: 'var(--color-surface)',
        borderRadius: '6px',
        padding: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      {pills.map((pill) => (
        <button
          key={pill.type}
          aria-label={`Add ${pill.label} annotation`}
          // CRITICAL (Pitfall 1): prevent mousedown from clearing selection before click fires
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAddAnnotation(pill.type, selectedText)}
          style={{
            fontSize: '13px',
            fontWeight: 600,
            height: '28px',
            padding: '0 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            border: 'none',
            background: pill.bg,
            color: pill.color,
            outline: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid var(--color-focus)'
            e.currentTarget.style.outlineOffset = '2px'
          }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
        >
          {pill.label}
        </button>
      ))}
      {inlineChips.map((label) => (
        <button
          key={label}
          aria-label={label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAddAnnotation('comment', selectedText, label)}
          style={{
            fontSize: '14px',
            fontWeight: 600,
            height: '28px',
            padding: '0 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            border: 'none',
            background: 'rgba(148, 163, 184, 0.15)',
            color: 'var(--color-text-secondary)',
            outline: 'none',
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.25)' }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.15)' }}
          onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-focus)'; e.currentTarget.style.outlineOffset = '2px' }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
        >
          {label}
        </button>
      ))}
      <details ref={detailsRef} style={{ position: 'relative' }}>
        <summary
          onMouseDown={(e) => e.preventDefault()}
          style={{
            fontSize: '14px',
            fontWeight: 600,
            height: '28px',
            padding: '0 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            border: 'none',
            background: 'rgba(148, 163, 184, 0.15)',
            color: 'var(--color-text-secondary)',
            outline: 'none',
            listStyle: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.25)' }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.15)' }}
          onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-focus)'; e.currentTarget.style.outlineOffset = '2px' }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
        >
          &#9662; more
        </summary>
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          zIndex: 21,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          padding: '4px',
          marginTop: '4px',
        }}>
          {overflowChips.map((label) => (
            <button
              key={label}
              role="menuitem"
              aria-label={label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onAddAnnotation('comment', selectedText, label)
                if (detailsRef.current) detailsRef.current.open = false
              }}
              style={{
                display: 'block',
                width: '100%',
                height: '32px',
                padding: '0 12px',
                textAlign: 'left' as const,
                fontSize: '14px',
                fontWeight: 400,
                color: 'var(--color-text-primary)',
                background: 'none',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                outline: 'none',
                whiteSpace: 'nowrap' as const,
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.1)' }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'none' }}
              onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-focus)'; e.currentTarget.style.outlineOffset = '2px' }}
              onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
            >
              {label}
            </button>
          ))}
        </div>
      </details>
    </div>
  )
}

function HelpView() {
  const codeStyle: React.CSSProperties = {
    fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
    fontSize: '13px',
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '4px',
    padding: '12px 16px',
    display: 'block',
    overflowX: 'auto',
    whiteSpace: 'pre',
    color: 'var(--color-text-primary)',
    margin: '8px 0',
  }
  const inlineCode: React.CSSProperties = {
    fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
    fontSize: '13px',
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '3px',
    padding: '1px 5px',
    color: 'var(--color-text-primary)',
  }
  const h2Style: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    marginTop: '32px',
    marginBottom: '8px',
  }
  const pStyle: React.CSSProperties = {
    fontSize: '15px',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.6,
    margin: '8px 0',
  }

  return (
    <div style={{ maxWidth: '640px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
        plan-reviewer
      </h1>
      <p style={{ ...pStyle, marginTop: 0 }}>
        Intercepts plan approval hooks for Claude Code, Gemini CLI, and OpenCode. Opens a local
        browser tab to review the plan and returns approve/deny + annotations as JSON on stdout.
      </p>

      <h2 style={h2Style}>Installing</h2>
      <p style={pStyle}>
        Use the <code style={inlineCode}>install</code> subcommand to wire <code style={inlineCode}>plan-reviewer</code> into your AI coding tool:
      </p>
      <code style={codeStyle}>{`plan-reviewer install claude
plan-reviewer install gemini
plan-reviewer install opencode`}</code>
      <p style={pStyle}>What each integration installs:</p>
      <p style={pStyle}>
        <strong>claude</strong> — Creates a plugin directory at{' '}
        <code style={inlineCode}>~/.local/share/plan-reviewer/claude-plugin/</code> and registers
        it in <code style={inlineCode}>~/.claude/settings.json</code>.
      </p>
      <p style={pStyle}>
        <strong>gemini</strong> — Writes an extension directory at{' '}
        <code style={inlineCode}>~/.gemini/extensions/plan-reviewer/</code>. Gemini CLI
        auto-discovers extensions in this location — no settings file editing needed.
      </p>
      <p style={pStyle}>
        <strong>opencode</strong> — Installs a plugin file at{' '}
        <code style={inlineCode}>~/.config/opencode/plugins/plan-reviewer-opencode.mjs</code>.
      </p>

      <h2 style={h2Style}>Uninstalling</h2>
      <p style={pStyle}>
        Use the <code style={inlineCode}>uninstall</code> subcommand to remove the integration:
      </p>
      <code style={codeStyle}>{`plan-reviewer uninstall claude
plan-reviewer uninstall gemini
plan-reviewer uninstall opencode`}</code>

      <h2 style={h2Style}>Skipping the browser</h2>
      <p style={pStyle}>
        Run with <code style={inlineCode}>--no-browser</code> to start the server and print the
        review URL to stderr without auto-opening a tab:
      </p>
      <code style={codeStyle}>plan-reviewer --no-browser</code>
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

// --- PlanViewToggle ---

function PlanViewToggle({ viewMode, onViewModeChange }: { viewMode: ViewMode; onViewModeChange: (m: ViewMode) => void }) {
  const options: { id: ViewMode; label: string }[] = [
    { id: 'preview', label: 'Preview' },
    { id: 'markdown', label: 'Markdown' },
  ]
  return (
    <div
      role="group"
      aria-label="Plan view mode"
      style={{
        display: 'inline-flex',
        gap: '2px',
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: '6px',
        padding: '2px',
        marginBottom: '24px',
      }}
    >
      {options.map(({ id, label }) => {
        const isActive = viewMode === id
        return (
          <button
            key={id}
            onClick={() => onViewModeChange(id)}
            aria-pressed={isActive}
            style={{
              height: '28px',
              padding: '0 12px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 400,
              background: isActive ? 'var(--color-surface)' : 'transparent',
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              outline: 'none',
              transition: 'background 0.1s ease, color 0.1s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid var(--color-focus)'
              e.currentTarget.style.outlineOffset = '2px'
            }}
            onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// --- Main App ---

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem('plan-reviewer-theme')
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  function handleThemeToggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('plan-reviewer-theme', next)
  }

  const [appState, setAppState] = useState<AppState>('loading')
  const [planMd, setPlanMd] = useState<string>('')
  const [planHtml, setPlanHtml] = useState<string>('')
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
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
  const [selectionPosition, setSelectionPosition] = useState<{ top: number; left: number } | null>(null)
  const annotationOffsetsRef = useRef<Map<string, { start: number; end: number }>>(new Map())
  // Ref copy of annotations so scroll handlers see fresh data without stale closure.
  const annotationsRef = useRef(annotations)
  useEffect(() => { annotationsRef.current = annotations }, [annotations])

  // Outline state
  const [outlineItems, setOutlineItems] = useState<OutlineItem[]>([])
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null)
  const headingElementsRef = useRef<Map<string, HTMLHeadingElement>>(new Map())
  const headingCharOffsetsRef = useRef<Map<string, number>>(new Map())
  const outlineItemsRef = useRef<OutlineItem[]>([])
  useEffect(() => { outlineItemsRef.current = outlineItems }, [outlineItems])

  // Fetch plan markdown on mount, render to HTML client-side
  useEffect(() => {
    fetch('/api/plan')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: { plan_md: string }) => {
        setPlanMd(data.plan_md)
        setPlanHtml(marked.parse(data.plan_md) as string)
        setAppState('reviewing')
      })
      .catch(() => {
        setAppState('error')
      })
  }, [])

  // Extract headings from rendered plan HTML, inject id attributes, build outline.
  useLayoutEffect(() => {
    if (!planRef.current) return
    const container = planRef.current
    const headings = Array.from(container.querySelectorAll<HTMLHeadingElement>('h1, h2, h3'))
    const slugCounts = new Map<string, number>()
    const elementsMap = new Map<string, HTMLHeadingElement>()
    const charOffsetsMap = new Map<string, number>()
    const items: OutlineItem[] = []

    // Helper: character offset of an element's start within planRef text content.
    function getCharOffset(target: HTMLElement): number {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
      let count = 0
      let node: Node | null
      while ((node = walker.nextNode())) {
        if (target.contains(node)) return count
        count += (node.textContent ?? '').length
      }
      return count
    }

    headings.forEach((el, index) => {
      const text = el.textContent?.trim() || ''
      const base = text
        ? text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
        : `heading-${index}`
      const count = slugCounts.get(base) ?? 0
      const id = count === 0 ? base : `${base}-${count + 1}`
      slugCounts.set(base, count + 1)
      el.id = id
      elementsMap.set(id, el)
      charOffsetsMap.set(id, getCharOffset(el))
      items.push({ id, level: parseInt(el.tagName[1]) as 1 | 2 | 3, text: text || `Heading ${index + 1}` })
    })

    headingElementsRef.current = elementsMap
    headingCharOffsetsRef.current = charOffsetsMap
    setOutlineItems(items)
    // Set initial active heading: default to first, then find the deepest one scrolled past.
    if (items.length > 0) setActiveHeadingId(items[0].id)
  }, [planHtml])

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

  // --- Decision handlers ---

  const approve = useCallback(async () => {
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
  }, [appState])

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
  }, [appState, denyOpen, approve])

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

  // Compute floating affordance position when selection changes.
  useLayoutEffect(() => {
    if (!selectedText || !planRef.current || !planTabRef.current) {
      setSelectionPosition(null)
      return
    }
    const offsets = getSelectionOffsets()
    if (!offsets) { setSelectionPosition(null); return }
    const range = rangeFromOffsets(planRef.current, offsets.start, offsets.end)
    if (!range) { setSelectionPosition(null); return }
    const rangeRect = range.getBoundingClientRect()
    const containerRect = planTabRef.current.getBoundingClientRect()
    setSelectionPosition({
      top: rangeRect.bottom - containerRect.top + planTabRef.current.scrollTop + 6,
      left: Math.max(0, rangeRect.left - containerRect.left),
    })
  }, [selectedText, getSelectionOffsets])

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
    if (comment.length > 0) {
      CSS.highlights.set('annotation-comment', new Highlight(...comment))
    } else {
      CSS.highlights.delete('annotation-comment')
    }
    if (del.length > 0) {
      CSS.highlights.set('annotation-delete', new Highlight(...del))
    } else {
      CSS.highlights.delete('annotation-delete')
    }
    if (replace.length > 0) {
      CSS.highlights.set('annotation-replace', new Highlight(...replace))
    } else {
      CSS.highlights.delete('annotation-replace')
    }
  })

  // --- Aligned card layout ---

  function updateActiveHeading() {
    const container = planTabRef.current
    const items = outlineItemsRef.current
    if (!container || items.length === 0) return
    // Default to first heading so something is always active at the top of the page.
    let active = items[0].id
    const scrollTop = container.scrollTop
    for (const item of items) {
      const el = headingElementsRef.current.get(item.id)
      if (el && el.offsetTop <= scrollTop + 1) active = item.id
      else break
    }
    setActiveHeadingId((prev) => (prev === active ? prev : active))
  }

  // Count annotations per outline section using character offsets.
  // annotationOffsetsRef and headingCharOffsetsRef are always updated alongside
  // their corresponding state deps (annotations, outlineItems), so reading them
  // here is safe even though the refs themselves don't trigger re-computation.
  /* eslint-disable react-hooks/refs */
  const annotationCountsBySection = useMemo(() => {
    const counts = new Map<string, number>()
    if (outlineItems.length === 0) return counts
    const offsetsSnapshot = annotationOffsetsRef.current
    const headingOffsets = headingCharOffsetsRef.current
    for (const ann of annotations) {
      const annStart = offsetsSnapshot.get(ann.id)?.start
      if (annStart === undefined) continue
      let sectionId: string | null = null
      for (const item of outlineItems) {
        if ((headingOffsets.get(item.id) ?? 0) <= annStart) sectionId = item.id
        else break
      }
      if (sectionId !== null) counts.set(sectionId, (counts.get(sectionId) ?? 0) + 1)
    }
    return counts
  }, [annotations, outlineItems])
  /* eslint-enable react-hooks/refs */

  function handleOutlineClick(id: string) {
    const container = planTabRef.current
    const el = headingElementsRef.current.get(id)
    if (!container || !el) return
    container.scrollTop = el.offsetTop - 32
  }

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
    const onScroll = () => { computeAndApplyLayout(); updateActiveHeading() }
    planTab.addEventListener('scroll', onScroll)
    return () => planTab.removeEventListener('scroll', onScroll)
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

  function handleAddAnnotation(type: AnnotationType, anchorText: string, prefillComment?: string) {
    const id = crypto.randomUUID()

    // Capture character offsets before resetTextSelection clears them.
    // Offsets survive React reconciliation; live Range objects don't.
    const offsets = getSelectionOffsets()
    if (offsets) annotationOffsetsRef.current.set(id, offsets)

    const newAnnotation: Annotation = {
      id,
      type,
      anchorText,
      comment: prefillComment ?? '',
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
      <PageHeader activeTab={activeTab} onTabChange={setActiveTab} theme={theme} onThemeToggle={handleThemeToggle} />

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
          {/* Outline panel — only on plan tab in preview mode when headings exist */}
          {activeTab === 'plan' && viewMode === 'preview' && outlineItems.length > 0 && (
            <PlanOutline
              items={outlineItems}
              activeId={activeHeadingId}
              onItemClick={handleOutlineClick}
              annotationCounts={annotationCountsBySection}
            />
          )}

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
              position: 'relative',
            }}
          >
            <PlanViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />

            {viewMode === 'preview' && (
              <>
                <div ref={planRef} className="plan-prose" dangerouslySetInnerHTML={{ __html: planHtml }} />
                {selectionPosition && selectedText && (
                  <FloatingAnnotationAffordance
                    top={selectionPosition.top}
                    left={selectionPosition.left}
                    selectedText={selectedText}
                    onAddAnnotation={handleAddAnnotation}
                  />
                )}
              </>
            )}

            {viewMode === 'markdown' && (
              <pre
                style={{
                  fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
                  fontSize: '14px',
                  lineHeight: 1.6,
                  color: 'var(--color-text-primary)',
                  background: 'var(--color-code-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '24px',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                }}
              >
                {planMd}
              </pre>
            )}
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

          {/* Left column: help tab panel */}
          <div
            id="tabpanel-help"
            role="tabpanel"
            aria-labelledby="tab-help"
            style={{
              flexGrow: 1,
              overflowY: 'auto',
              padding: '32px',
              display: activeTab === 'help' ? 'block' : 'none',
            }}
          >
            <HelpView />
          </div>

          {/* Right column: annotation sidebar — hidden on help tab */}
          {activeTab !== 'help' && <AnnotationSidebar
            annotations={annotations}
            onRemoveAnnotation={handleRemoveAnnotation}
            onUpdateAnnotation={handleUpdateAnnotation}
            activeTab={activeTab}
            sidebarRef={sidebarRef}
            hoveredAnnotationId={hoveredAnnotationId}
            onAnnotationHover={(anchorText) => { clearHighlights(); highlightAnchor(anchorText); }}
            onAnnotationLeave={() => clearHighlights()}
          />}
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
