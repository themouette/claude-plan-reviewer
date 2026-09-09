import { useRef, useState } from 'react'

/**
 * Clamp a width value to [min, max]. Exported for unit testing the boundary math.
 */
export function clampWidth(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

export interface UseResizableWidthOptions {
  /** Default width, also used as the double-click reset target. */
  initialWidth: number
  /** Lower drag bound. */
  minWidth: number
  /** Upper drag bound. */
  maxWidth: number
}

export interface UseResizableWidthResult {
  /** Current width in px; feed directly into the pane's inline style. */
  width: number
  /** True between pointerdown and pointerup on the handle. */
  isResizing: boolean
  /** Spread onto the drag-handle element. Uses pointer capture so fast
   *  drags outside the handle still route move/up events back to it. */
  handleProps: {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
    onLostPointerCapture: (e: React.PointerEvent<HTMLDivElement>) => void
    onDoubleClick: (e: React.MouseEvent<HTMLDivElement>) => void
  }
}

/**
 * Session-scoped resizable width for a side pane (Option A: no persistence —
 * the review server binds an ephemeral port each run, so localStorage would be
 * stranded on an origin that is never reused).
 *
 * While dragging, body text selection is suppressed so the drag doesn't select
 * diff content under the cursor.
 */
export function useResizableWidth(opts: UseResizableWidthOptions): UseResizableWidthResult {
  const { initialWidth, minWidth, maxWidth } = opts
  const [width, setWidth] = useState(initialWidth)
  const [isResizing, setIsResizing] = useState(false)
  // Width at drag start, kept in a ref with the pointer's starting clientX.
  const drag = useRef<{ startX: number; startWidth: number } | null>(null)

  function beginResize(e: React.PointerEvent<HTMLDivElement>) {
    drag.current = { startX: e.clientX, startWidth: width }
    setIsResizing(true)
    // Pointer capture keeps move/up events on the handle during fast drags.
    // Guarded: setPointerCapture is not implemented in jsdom.
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      // ignore — drag still works via events landing on the handle
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }

  function moveResize(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    setWidth(clampWidth(d.startWidth + (e.clientX - d.startX), minWidth, maxWidth))
  }

  function endResize(e?: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    drag.current = null
    setIsResizing(false)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    if (e) {
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId)
      } catch {
        // ignore — pointerup implies capture release in browsers anyway
      }
    }
  }

  return {
    width,
    isResizing,
    handleProps: {
      onPointerDown: beginResize,
      onPointerMove: moveResize,
      onPointerUp: endResize,
      onLostPointerCapture: endResize,
      onDoubleClick: () => setWidth(initialWidth),
    },
  }
}
