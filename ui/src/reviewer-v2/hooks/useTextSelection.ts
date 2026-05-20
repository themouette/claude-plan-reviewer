import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

const HIGHLIGHT_NAME = 'selection-lock'

const supportsHighlights =
  typeof CSS !== 'undefined' && typeof CSS.highlights !== 'undefined'

function applyHighlight(range: Range): void {
  if (!supportsHighlights) return
  CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(range))
}

function removeHighlight(): void {
  if (!supportsHighlights) return
  CSS.highlights.delete(HIGHLIGHT_NAME)
}

/**
 * Convert a Range's boundary points to absolute character offsets within container.
 * Returns null if the boundary nodes cannot be found in the text node walk.
 */
function getRangeOffsets(
  container: HTMLElement,
  range: Range,
): { start: number; end: number } | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let charCount = 0
  let start: number | null = null
  let end: number | null = null
  let node: Node | null
  while ((node = walker.nextNode())) {
    const len = (node.textContent ?? '').length
    if (start === null && node === range.startContainer) {
      start = charCount + range.startOffset
    }
    if (end === null && node === range.endContainer) {
      end = charCount + range.endOffset
    }
    if (start !== null && end !== null) break
    charCount += len
  }
  if (start === null || end === null) return null
  return { start, end }
}

/**
 * Reconstruct a fresh Range from absolute character offsets by walking text nodes.
 * Returns null if the offsets exceed the available text (e.g. plan not yet loaded).
 *
 * This is the inverse of getRangeOffsets. Because it walks the current live DOM,
 * the returned Range is always anchored to existing text nodes — it cannot be
 * collapsed by prior DOM mutations.
 *
 * Exported so callers (App.tsx) can re-create annotation Ranges on every render
 * without storing live Range objects that React reconciliation would collapse.
 */
export function rangeFromOffsets(
  container: HTMLElement,
  start: number,
  end: number,
): Range | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let charCount = 0
  let startNode: Node | null = null
  let startNodeOffset = 0
  let endNode: Node | null = null
  let endNodeOffset = 0
  let node: Node | null
  while ((node = walker.nextNode())) {
    const len = (node.textContent ?? '').length
    if (startNode === null && charCount + len > start) {
      startNode = node
      startNodeOffset = start - charCount
    }
    if (endNode === null && charCount + len >= end) {
      endNode = node
      endNodeOffset = end - charCount
    }
    if (startNode !== null && endNode !== null) break
    charCount += len
  }
  if (!startNode || !endNode) return null
  const r = document.createRange()
  r.setStart(startNode, startNodeOffset)
  r.setEnd(endNode, endNodeOffset)
  return r
}

export function useTextSelection(
  containerRef: RefObject<HTMLDivElement | null>,
): [string, () => void, () => { start: number; end: number } | null] {
  const [selectedText, setSelectedText] = useState<string>('')
  const currentRange = useRef<Range | null>(null)
  // Selection stored as character offsets so DOM mutations (React reconciliation)
  // cannot collapse it. The live Range is re-created from these on every render.
  const storedOffsets = useRef<{ start: number; end: number } | null>(null)

  useEffect(() => {
    // Capture selection on mouseup (after drag completes).
    // Only clear selectedText when the click was inside the plan container —
    // clicks in the sidebar must not dismiss the annotation pills.
    const capture = (e: MouseEvent) => {
      const selection = document.getSelection()

      if (!selection || selection.isCollapsed) {
        // Intentional deselect only when the user clicked inside the container.
        if (containerRef.current?.contains(e.target as Node)) {
          removeHighlight()
          currentRange.current = null
          storedOffsets.current = null
          setSelectedText('')
        }
        return
      }

      // Guard: only track selections within the plan content container
      const range = selection.getRangeAt(0)
      if (!containerRef.current?.contains(range.commonAncestorContainer)) {
        return
      }

      const text = selection.toString().trim()
      if (!text) {
        removeHighlight()
        currentRange.current = null
        storedOffsets.current = null
        setSelectedText('')
        return
      }

      // Convert to character offsets immediately (while DOM is untouched).
      // Do NOT store the live Range — React reconciliation will collapse it.
      const offsets = getRangeOffsets(containerRef.current, range)
      storedOffsets.current = offsets

      if (offsets) {
        // Reconstruct a fresh Range from the offsets (independent of the selection
        // object) and apply the CSS highlight before clearing native selection.
        const freshRange = rangeFromOffsets(
          containerRef.current,
          offsets.start,
          offsets.end,
        )
        if (freshRange) {
          currentRange.current = freshRange
          applyHighlight(freshRange)
        }
      }

      // Clear native selection so the focus-dependent blue highlight doesn't
      // compete with our focus-independent CSS custom highlight.
      if (supportsHighlights) {
        selection.removeAllRanges()
      }

      setSelectedText(text)
    }

    document.addEventListener('mouseup', capture)
    return () => {
      document.removeEventListener('mouseup', capture)
    }
  }, [containerRef])

  // After every render: re-create the Range from stored character offsets and
  // re-apply the CSS highlight. Because we walk live DOM text nodes each time,
  // the reconstructed Range is always valid — even if prior DOM reconciliation
  // had collapsed the previous Range object.
  useLayoutEffect(() => {
    if (!storedOffsets.current || !containerRef.current) return
    const range = rangeFromOffsets(
      containerRef.current,
      storedOffsets.current.start,
      storedOffsets.current.end,
    )
    if (range) {
      currentRange.current = range
      applyHighlight(range)
    }
  })

  // Programmatic reset — call after onAddAnnotation to clear highlight + state.
  const reset = useCallback(() => {
    removeHighlight()
    currentRange.current = null
    storedOffsets.current = null
    setSelectedText('')
  }, [])

  // Returns current character offsets so callers can store them for persistent
  // annotation highlights. Offsets survive DOM mutations; live Range objects don't.
  const getOffsets = useCallback(() => storedOffsets.current, [])

  return [selectedText, reset, getOffsets]
}
