import { useCallback, useEffect, useRef, useState } from 'react'
import { useTextSelection, rangeFromOffsets } from './hooks/useTextSelection'
import { offsetFromPoint } from './hooks/offsetFromPoint'
import { renderMarkdown } from './utils/markdownRenderer'
import PlanContent from './PlanContent'
import SelectionToolbar from './SelectionToolbar'
import AnnotationForm, { type FormState } from './AnnotationForm'
import type { Annotation, AnnotationType, Section } from './types'

const COMMENT_HOVER_HIGHLIGHT = 'comment-hover'
const supportsHighlights =
  typeof CSS !== 'undefined' && typeof CSS.highlights !== 'undefined'

const ANNOTATION_HIGHLIGHT_NAMES: Record<string, string> = {
  comment: 'annotation-comment',
  delete: 'annotation-delete',
  replace: 'annotation-replace',
}

export default function ContentPane({
  onSectionsFound,
  onAddAnnotation,
  hoveredCommentId,
  annotations,
  planRef: planRefProp,
  onHoverCommentId,
}: {
  onSectionsFound?: (sections: Section[]) => void
  onAddAnnotation?: (annotation: Annotation) => void
  hoveredCommentId?: string | null
  annotations?: Annotation[]
  planRef?: React.RefObject<HTMLDivElement | null>
  onHoverCommentId?: (id: string | null) => void
} = {}) {
  const localPlanRef = useRef<HTMLDivElement>(null)
  const planRef = planRefProp ?? localPlanRef
  const [planHtml, setPlanHtml] = useState<string>('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [selectedText, resetTextSelection, getOffsets] = useTextSelection(planRef)
  const [formState, setFormState] = useState<FormState | null>(null)
  const latestFormValueRef = useRef<string>('')

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
  }, [planHtml, onSectionsFound, planRef])

  // Persistent annotation highlights — always-on colored underlays by type.
  // Re-runs when annotations change or when planHtml changes (new DOM after markdown render).
  useEffect(() => {
    if (!supportsHighlights || !planRef.current) return
    const container = planRef.current
    for (const [type, name] of Object.entries(ANNOTATION_HIGHLIGHT_NAMES)) {
      const ranges = (annotations ?? [])
        .filter((a) => a.type === type)
        .map((a) => rangeFromOffsets(container, a.anchorStart, a.anchorEnd))
        .filter((r): r is Range => r !== null)
      if (ranges.length > 0) {
        CSS.highlights.set(name, new Highlight(...ranges))
      } else {
        CSS.highlights.delete(name)
      }
    }
    return () => {
      CSS.highlights.delete('annotation-comment')
      CSS.highlights.delete('annotation-delete')
      CSS.highlights.delete('annotation-replace')
    }
  }, [annotations, planHtml, planRef])

  // When hoveredCommentId changes, set/clear the CSS comment-hover highlight
  // on the corresponding anchor text (COMMENT-02 direction 1: bubble -> anchor).
  useEffect(() => {
    if (!supportsHighlights) return
    if (!hoveredCommentId || !planRef.current) {
      CSS.highlights.delete(COMMENT_HOVER_HIGHLIGHT)
      return () => { CSS.highlights.delete(COMMENT_HOVER_HIGHLIGHT) }
    }
    const annotation = annotations?.find((a) => a.id === hoveredCommentId)
    if (!annotation) {
      CSS.highlights.delete(COMMENT_HOVER_HIGHLIGHT)
      return () => { CSS.highlights.delete(COMMENT_HOVER_HIGHLIGHT) }
    }
    const range = rangeFromOffsets(planRef.current, annotation.anchorStart, annotation.anchorEnd)
    if (range) {
      CSS.highlights.set(COMMENT_HOVER_HIGHLIGHT, new Highlight(range))
    } else {
      CSS.highlights.delete(COMMENT_HOVER_HIGHLIGHT)
    }
    return () => { CSS.highlights.delete(COMMENT_HOVER_HIGHLIGHT) }
  }, [hoveredCommentId, annotations, planRef])

  // Inline getOffsets() call — synchronous snapshot of stored offsets.
  // The inline form is intentionally simpler for v2: getOffsets() is a synchronous
  // snapshot of the hook's stored offsets and runs on every render, so the toolbar
  // always reads the latest selection. useLayoutEffect is not needed for the v2
  // position: fixed toolbar (unlike App.tsx's scroll-relative positioning).
  const offsets = selectedText ? getOffsets() : null

  // Replace toolbar with AnnotationForm — getOffsets() is called from stored offsets
  // (not the live DOM selection) per RESEARCH.md Pitfall 1.
  function handleAction(type: AnnotationType, anchorText: string, prefillComment?: string) {
    const offsets = getOffsets()
    if (!offsets || !planRef.current) return

    // D-03: auto-submit any pending form before opening a new one or bypassing to direct create.
    // Use latestFormValueRef.current (typed value) or formState.prefill (initial value) as fallback.
    if (formState !== null && onAddAnnotation) {
      onAddAnnotation({
        id: crypto.randomUUID(),
        anchorText: formState.anchorText,
        comment: latestFormValueRef.current || formState.prefill,
        type: formState.type,
        anchorStart: formState.anchorStart,
        anchorEnd: formState.anchorEnd,
      })
      latestFormValueRef.current = ''
    }

    // Bypass path: delete type and predefined quick actions skip the form entirely —
    // they directly create a comment bubble with the known comment text.
    if (type === 'delete' || prefillComment !== undefined) {
      if (onAddAnnotation) {
        onAddAnnotation({
          id: crypto.randomUUID(),
          anchorText,
          comment: type === 'delete' ? 'Delete' : prefillComment!,
          type,
          anchorStart: offsets.start,
          anchorEnd: offsets.end,
        })
      }
      setFormState(null)
      latestFormValueRef.current = ''
      resetTextSelection()
      return
    }

    // Form path (comment and replace types): reconstruct range for popup positioning,
    // then open the form. D-04 still applies here — do NOT call resetTextSelection()
    // in this path so the selection-lock highlight stays active while the form is open.
    const range = rangeFromOffsets(planRef.current, offsets.start, offsets.end)
    const rects = range?.getClientRects() ?? []
    const lastRect = rects.length > 0 ? rects[rects.length - 1] : range?.getBoundingClientRect()
    const FORM_HEIGHT_ESTIMATE = 140 // textarea 64 + buttons 36 + padding ~40
    const formTop = Math.min(
      (lastRect?.bottom ?? 0) + 6,
      window.innerHeight - FORM_HEIGHT_ESTIMATE - 8,
    )
    const formLeft = Math.min(lastRect?.right ?? 0, window.innerWidth - 280)

    setFormState({
      type,
      anchorText,
      anchorStart: offsets.start,
      anchorEnd: offsets.end,
      prefill: type === 'replace' ? 'Replace' : '',
      rect: { top: formTop, left: formLeft },
    })
  }

  function handleFormSubmit(comment: string) {
    if (formState !== null && onAddAnnotation) {
      onAddAnnotation({
        id: crypto.randomUUID(),
        anchorText: formState.anchorText,
        comment,
        type: formState.type,
        anchorStart: formState.anchorStart,
        anchorEnd: formState.anchorEnd,
      })
    }
    setFormState(null)
    latestFormValueRef.current = ''
    resetTextSelection()
  }

  const handleFormCancel = useCallback(() => {
    setFormState(null)
    latestFormValueRef.current = ''
    resetTextSelection()
  }, [resetTextSelection])

  // D-06: Programmatic paragraph selection — fires selectionchange which useTextSelection
  // picks up via its captureKeyboard listener, causing SelectionToolbar to appear.
  // Uses a text-node-anchored range so getRangeOffsets can match boundary containers
  // and return non-null offsets (root cause fix for UAT failure 4).
  function handleAdd(paragraphElement: HTMLElement) {
    // Auto-submit any open form before selecting the new paragraph (D-03 pattern).
    if (formState !== null && onAddAnnotation) {
      onAddAnnotation({
        id: crypto.randomUUID(),
        anchorText: formState.anchorText,
        comment: latestFormValueRef.current || formState.prefill,
        type: formState.type,
        anchorStart: formState.anchorStart,
        anchorEnd: formState.anchorEnd,
      })
      latestFormValueRef.current = ''
      setFormState(null)
    }

    // Build a text-node-anchored range so getRangeOffsets can match boundary nodes.
    const walker = document.createTreeWalker(paragraphElement, NodeFilter.SHOW_TEXT)
    let firstNode: Text | null = null
    let lastNode: Text | null = null
    let node: Node | null
    while ((node = walker.nextNode())) {
      if (firstNode === null) firstNode = node as Text
      lastNode = node as Text
    }
    if (!firstNode || !lastNode) return

    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    range.setStart(firstNode, 0)
    range.setEnd(lastNode, (lastNode.textContent ?? '').length)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  // COMMENT-02 direction 2 (anchor -> bubble): resolve cursor position to a character
  // offset within planRef, match against annotation [anchorStart, anchorEnd) intervals,
  // and call onHoverCommentId with the matching annotation id (or null).
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!onHoverCommentId || !annotations || annotations.length === 0 || !planRef.current) return
    const offset = offsetFromPoint(planRef.current, e.clientX, e.clientY)
    if (offset === null) {
      onHoverCommentId(null)
      return
    }
    const hit = annotations.find((a) => offset >= a.anchorStart && offset < a.anchorEnd)
    onHoverCommentId(hit ? hit.id : null)
  }

  return (
    <div
      style={{ position: 'relative', padding: 32 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onHoverCommentId?.(null)}
    >
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
            formOpen={formState !== null}
          />
          {selectedText && offsets && !formState && (
            <SelectionToolbar
              offsets={offsets}
              selectedText={selectedText}
              containerRef={planRef}
              onAction={handleAction}
            />
          )}
          {formState && (
            <AnnotationForm
              formState={formState}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
              onTextareaChange={(v) => { latestFormValueRef.current = v }}
            />
          )}
        </>
      )}
    </div>
  )
}
