/**
 * Behavioral tests for DiffPane (Phase 30 WR-03)
 *
 * These tests render the component and verify runtime behaviour — not just
 * source-text literals.  They complement the source-text snapshot tests in
 * DiffPane.test.ts.
 *
 * Note: parseDiffFromFile is library-controlled (not mocked here). The DiffPane
 * rendering with files requires old_content + new_content to trigger the
 * FileDiff path; without them, PatchDiff is used and requires a valid unified diff
 * with filename headers. The tests below focus on the loading / empty states
 * which are fully DiffPane-owned and always safe to render.
 */
import React, { createRef } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import DiffPane from './DiffPane'

afterEach(() => { cleanup() })

describe('DiffPane behavioral (Phase 30)', () => {
  it('renders without error when hideWhitespace is false (loading state)', () => {
    const ref = createRef<HTMLDivElement | null>()
    const { container } = render(
      <DiffPane
        files={[]}
        loading={true}
        error={null}
        diffStyle="unified"
        diffPaneRef={ref}
        onReload={() => {}}
        hideWhitespace={false}
      />
    )
    // Loading spinner is in the document — the component did not throw
    expect(container.firstChild).toBeTruthy()
  })

  it('renders empty state copy when hideWhitespace is true and there are no files', () => {
    const ref = createRef<HTMLDivElement | null>()
    render(
      <DiffPane
        files={[]}
        loading={false}
        error={null}
        diffStyle="unified"
        diffPaneRef={ref}
        onReload={() => {}}
        hideWhitespace={true}
      />
    )
    // Empty-state copy is rendered — the component did not throw even with hideWhitespace=true
    expect(screen.getByText('No changes on this branch')).toBeTruthy()
  })

  it('renders error state without throwing (hideWhitespace is not relevant to error path)', () => {
    const ref = createRef<HTMLDivElement | null>()
    render(
      <DiffPane
        files={[]}
        loading={false}
        error="Server error"
        diffStyle="unified"
        diffPaneRef={ref}
        onReload={() => {}}
        hideWhitespace={true}
      />
    )
    expect(screen.getByText('Could not load diff')).toBeTruthy()
    expect(screen.getByText('Reload Diff')).toBeTruthy()
  })
})
