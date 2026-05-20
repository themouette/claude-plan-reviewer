import { useEffect, useRef, useState } from 'react'
import { useTextSelection } from './hooks/useTextSelection'
import { renderMarkdown } from './utils/markdownRenderer'
import PlanContent from './PlanContent'
import SelectionToolbar from './SelectionToolbar'
import type { AnnotationType, Section } from './types'

export default function ContentPane({
  onSectionsFound,
}: {
  onSectionsFound?: (sections: Section[]) => void
} = {}) {
  const planRef = useRef<HTMLDivElement>(null)
  const [planHtml, setPlanHtml] = useState<string>('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [selectedText, resetTextSelection, getOffsets] = useTextSelection(planRef)

  useEffect(() => {
    fetch('/api/plan')
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status)
        return res.json()
      })
      .then((data: { plan_md: string }) => {
        setPlanHtml(renderMarkdown(data.plan_md))
        setStatus('ready')
      })
      .catch((err: unknown) => {
        console.error('[ContentPane] Failed to load /api/plan:', err)
        setStatus('error')
      })
  }, [])

  // After planHtml loads and React commits the DOM, walk headings to build Section[]
  // and notify the shell via the optional onSectionsFound callback.
  useEffect(() => {
    if (!planRef.current || !onSectionsFound) return
    const headings = planRef.current.querySelectorAll('h1,h2,h3,h4,h5,h6')
    const sections: Section[] = Array.from(headings).map((el) => ({
      id: el.id,
      text: el.textContent ?? '',
      depth: parseInt(el.tagName[1], 10),
    }))
    onSectionsFound(sections)
  }, [planHtml, onSectionsFound])

  // Inline getOffsets() call — synchronous snapshot of stored offsets.
  // The inline form is intentionally simpler for v2: getOffsets() is a synchronous
  // snapshot of the hook's stored offsets and runs on every render, so the toolbar
  // always reads the latest selection. useLayoutEffect is not needed for the v2
  // position: fixed toolbar (unlike App.tsx's scroll-relative positioning).
  const offsets = selectedText ? getOffsets() : null

  // Phase 18 stub — clears selection after toolbar action. Phase 21 replaces this
  // with the real annotation dispatch to the useAnnotations reducer.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleAction(_type: AnnotationType, _anchorText: string, _prefill?: string) {
    resetTextSelection()
  }

  // Phase 18 stub — clears selection after gutter-icon click (idempotent). Phase 21
  // will wire this to an annotation creation flow.
  function handleAdd() {
    resetTextSelection()
  }

  return (
    <div style={{ position: 'relative', padding: 32 }}>
      {status === 'loading' && (
        <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>Loading…</span>
      )}
      {status === 'error' && (
        <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
          Could not render plan — The markdown content is unavailable. Reload the page to retry.
        </span>
      )}
      {status === 'ready' && (
        <>
          <PlanContent
            planHtml={planHtml}
            planRef={planRef}
            selectedText={selectedText}
            onAdd={handleAdd}
          />
          {selectedText && offsets && (
            <SelectionToolbar
              offsets={offsets}
              selectedText={selectedText}
              containerRef={planRef}
              onAction={handleAction}
            />
          )}
        </>
      )}
    </div>
  )
}
