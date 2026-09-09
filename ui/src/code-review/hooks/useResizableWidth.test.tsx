/**
 * Tests for useResizableWidth — drag-based session-scoped pane resizing.
 * Uses a harness component so pointer events can be fired through React's
 * synthetic event system, matching how the handle is used in CodeReviewApp.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import {
  clampWidth,
  useResizableWidth,
  type UseResizableWidthOptions,
} from './useResizableWidth'

afterEach(() => { cleanup() })

const OPTS: UseResizableWidthOptions = { initialWidth: 240, minWidth: 180, maxWidth: 480 }

/** Renders the hook and exposes its state via data attributes on a handle div. */
function Harness(props: UseResizableWidthOptions) {
  const { width, isResizing, handleProps } = useResizableWidth(props)
  return (
    <div
      data-testid="handle"
      data-width={width}
      data-resizing={isResizing ? 'true' : 'false'}
      {...handleProps}
    />
  )
}

function renderHarness() {
  render(<Harness {...OPTS} />)
  return screen.getByTestId('handle')
}

describe('clampWidth', () => {
  it('returns the value unchanged when within [min, max]', () => {
    expect(clampWidth(240, 180, 480)).toBe(240)
  })

  it('clamps below minWidth', () => {
    expect(clampWidth(50, 180, 480)).toBe(180)
  })

  it('clamps above maxWidth', () => {
    expect(clampWidth(9999, 180, 480)).toBe(480)
  })
})

describe('useResizableWidth drag', () => {
  it('starts at initialWidth and not resizing', () => {
    const handle = renderHarness()
    expect(handle.getAttribute('data-width')).toBe('240')
    expect(handle.getAttribute('data-resizing')).toBe('false')
  })

  it('pointerdown then pointermove to the right increases width by the drag delta', () => {
    const handle = renderHarness()
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 300 })
    expect(handle.getAttribute('data-resizing')).toBe('true')
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 400 })
    expect(handle.getAttribute('data-width')).toBe('340')
  })

  it('pointerup ends the resize; subsequent moves are ignored', () => {
    const handle = renderHarness()
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 300 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 400 })
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 400 })
    expect(handle.getAttribute('data-resizing')).toBe('false')
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 500 })
    expect(handle.getAttribute('data-width')).toBe('340')
  })

  it('clamps at maxWidth on a far-right drag', () => {
    const handle = renderHarness()
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 300 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 5000 })
    expect(handle.getAttribute('data-width')).toBe('480')
  })

  it('clamps at minWidth on a far-left drag', () => {
    const handle = renderHarness()
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 300 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: -5000 })
    expect(handle.getAttribute('data-width')).toBe('180')
  })

  it('pointermove without an active drag does not change width', () => {
    const handle = renderHarness()
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 900 })
    expect(handle.getAttribute('data-width')).toBe('240')
  })

  it('double-click resets width to initialWidth', () => {
    const handle = renderHarness()
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 300 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 380 })
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 380 })
    expect(handle.getAttribute('data-width')).toBe('320')
    fireEvent.dblClick(handle)
    expect(handle.getAttribute('data-width')).toBe('240')
  })
})
