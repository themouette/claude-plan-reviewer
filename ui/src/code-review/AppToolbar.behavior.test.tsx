/**
 * Behavioral tests for AppToolbar (Phase 30 WR-03)
 *
 * These tests render the component and verify runtime behaviour — not just
 * source-text literals.  They complement the source-text snapshot tests in
 * AppToolbar.test.ts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppToolbar from './AppToolbar'
import type { AppToolbarProps } from './AppToolbar'

afterEach(() => { cleanup() })

function baseProps(overrides: Partial<AppToolbarProps> = {}): AppToolbarProps {
  return {
    diffStyle: 'unified',
    contextExpanded: false,
    contextLoading: false,
    onDiffStyleChange: vi.fn(),
    onExpandAll: vi.fn(),
    commitsOpen: false,
    onCommitsToggle: vi.fn(),
    allFilesExpanded: false,
    filesCount: 3,
    onToggleAllFiles: vi.fn(),
    comments: [],
    connectivity: 'online',
    onReviewSent: vi.fn(),
    hideWhitespace: false,
    onHideWhitespaceToggle: vi.fn(),
    ...overrides,
  }
}

describe('AppToolbar behavioral (Phase 30)', () => {
  it('renders "Hide Whitespace" button label when hideWhitespace is false', () => {
    render(<AppToolbar {...baseProps({ hideWhitespace: false })} />)
    expect(screen.getByText('Hide Whitespace')).toBeTruthy()
  })

  it('renders "Show Whitespace" button label when hideWhitespace is true', () => {
    render(<AppToolbar {...baseProps({ hideWhitespace: true })} />)
    expect(screen.getByText('Show Whitespace')).toBeTruthy()
  })

  it('calls onHideWhitespaceToggle when the Hide Whitespace button is clicked', async () => {
    const onHideWhitespaceToggle = vi.fn()
    render(<AppToolbar {...baseProps({ hideWhitespace: false, onHideWhitespaceToggle })} />)
    const user = userEvent.setup()
    await user.click(screen.getByText('Hide Whitespace'))
    expect(onHideWhitespaceToggle).toHaveBeenCalledTimes(1)
  })

  it('calls onHideWhitespaceToggle when the Show Whitespace button is clicked', async () => {
    const onHideWhitespaceToggle = vi.fn()
    render(<AppToolbar {...baseProps({ hideWhitespace: true, onHideWhitespaceToggle })} />)
    const user = userEvent.setup()
    await user.click(screen.getByText('Show Whitespace'))
    expect(onHideWhitespaceToggle).toHaveBeenCalledTimes(1)
  })
})
