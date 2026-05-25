/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import AppToolbar from './AppToolbar'

const source = readFileSync(resolve(__dirname, './AppToolbar.tsx'), 'utf-8')

describe('AppToolbar', () => {
  it('exports a function as default', () => {
    expect(typeof AppToolbar).toBe('function')
  })

  it('header strip has height: 48 (matches ReviewerV2Shell)', () => {
    expect(source).toContain('height: 48')
  })

  it('declares flexShrink: 0 on the header to keep it from collapsing', () => {
    expect(source).toContain('flexShrink: 0')
  })

  it("uses 'Code Review' as the title", () => {
    expect(source).toContain('Code Review')
  })

  it('renders the Unified label literally', () => {
    expect(source).toContain("'Unified'")
    expect(source).toContain("'Side-by-side'")
  })

  it('renders all three Expand All labels: Expand All, Collapse, Loading...', () => {
    expect(source).toContain("'Loading...'")
    expect(source).toContain("'Collapse'")
    expect(source).toContain("'Expand All'")
  })

  it('disables the Expand button while contextLoading', () => {
    expect(source).toContain('disabled={contextLoading}')
  })

  it('uses var(--color-surface) for active and inactive backgrounds correctly', () => {
    expect(source).toContain('var(--color-surface)')
    expect(source).toContain('transparent')
  })

  it('renders the reserved slot comment for D-03 future stubs', () => {
    // The comment should mention either Reserved or D-03
    expect(source).toMatch(/Reserved|D-03/)
  })

  it('attaches onFocus and onBlur handlers for focus ring', () => {
    expect(source).toContain('onFocus')
    expect(source).toContain('onBlur')
  })

  it('does not import from reviewer-v2/', () => {
    expect(source).not.toContain('reviewer-v2/')
  })

  // Phase 26 additions
  it('AppToolbarProps includes commitsOpen and onCommitsToggle', () => {
    expect(source).toContain('commitsOpen: boolean')
    expect(source).toContain('onCommitsToggle:')
  })

  it("renders the 'Commits' label literally", () => {
    expect(source).toContain("'Commits'")
  })

  it('Commits button uses fontWeight 600 when commitsOpen is true', () => {
    expect(source).toMatch(/commitsOpen\s*\?\s*600\s*:\s*400|commitsOpen\s*\?\s*400\s*:\s*600/)
  })

  it('Commits button uses color-text-primary when commitsOpen and color-text-secondary otherwise', () => {
    expect(source).toContain('commitsOpen ?')
    expect(source).toContain('var(--color-text-primary)')
    expect(source).toContain('var(--color-text-secondary)')
  })

  it("Commits button uses makeFocusHandlers('commits')", () => {
    expect(source).toContain("makeFocusHandlers('commits')")
  })

  it('AppToolbar still does NOT import from reviewer-v2/', () => {
    expect(source).not.toContain('reviewer-v2/')
  })

  // Phase 26.2 D-08: Expand Files / Collapse Files button
  it('D-08: AppToolbarProps contains allFilesExpanded: boolean', () => {
    expect(source).toContain('allFilesExpanded: boolean')
  })

  it('D-08: AppToolbarProps contains onToggleAllFiles:', () => {
    expect(source).toContain('onToggleAllFiles:')
  })

  it("D-08: renders 'Expand Files' label", () => {
    expect(source).toContain("'Expand Files'")
  })

  it("D-08: renders 'Collapse Files' label", () => {
    expect(source).toContain("'Collapse Files'")
  })

  it("D-08: uses makeFocusHandlers('files-expand') for the second button", () => {
    expect(source).toContain("makeFocusHandlers('files-expand')")
  })

  // Phase 28 additions: submit controls
  it('Phase 28: Test A — AppToolbarProps includes comments: CodeReviewComment[]', () => {
    expect(source).toContain('comments: CodeReviewComment[]')
  })

  it('Phase 28: Test B — AppToolbarProps includes connectivity: ConnectivityStatus', () => {
    expect(source).toContain('connectivity: ConnectivityStatus')
  })

  it('Phase 28: Test C — AppToolbarProps includes onApprove: and onRequestChanges:', () => {
    expect(source).toContain('onApprove:')
    expect(source).toContain('onRequestChanges:')
  })

  it("Phase 28: Test D — source contains 'Approve' literal (button label)", () => {
    expect(source).toContain("'Approve'")
  })

  it("Phase 28: Test E — source contains 'Request Changes' literal (button label)", () => {
    expect(source).toContain("'Request Changes'")
  })

  it("Phase 28: Test F — source contains 'Cannot approve while comments exist' (disabled title D-06)", () => {
    expect(source).toContain("'Cannot approve while comments exist'")
  })

  it("Phase 28: Test G — source contains 'Add at least one comment before requesting changes' (disabled title D-06)", () => {
    expect(source).toContain("'Add at least one comment before requesting changes'")
  })

  it('Phase 28: Test H — source contains var(--color-accent-approve) (Approve background)', () => {
    expect(source).toContain('var(--color-accent-approve)')
  })

  it('Phase 28: Test I — source contains var(--color-accent-deny) (Request Changes background)', () => {
    expect(source).toContain('var(--color-accent-deny)')
  })

  it("Phase 28: Test J — source contains import from './buildCodeReviewPayload'", () => {
    expect(source).toContain("from './buildCodeReviewPayload'")
  })

  it("Phase 28: Test K — source contains import from '../shared/connectivity' for ConnectivityStatus", () => {
    expect(source).toContain("from '../shared/connectivity'")
  })

  it("Phase 28: Test L — source contains import for CodeReviewSubmitPopover from './CodeReviewSubmitPopover'", () => {
    expect(source).toContain("CodeReviewSubmitPopover from './CodeReviewSubmitPopover'")
  })

  it("Phase 28: Test M — source contains SubmitState union literal 'confirmed_approve'", () => {
    expect(source).toContain("'confirmed_approve'")
  })

  it("Phase 28: Test N — source contains SubmitState union literal 'confirmed_request_changes'", () => {
    expect(source).toContain("'confirmed_request_changes'")
  })

  it("Phase 28: Test O — source contains 'clipboard_confirmed' and 'clipboard_error'", () => {
    expect(source).toContain("'clipboard_confirmed'")
    expect(source).toContain("'clipboard_error'")
  })

  it('Phase 28: Test P — source contains window.close() (auto-close after confirmed)', () => {
    expect(source).toContain('window.close()')
  })

  it('Phase 28: Test Q — source contains 3000 (clipboard_confirmed auto-reset)', () => {
    expect(source).toContain('3000')
  })

  it('Phase 28: Test R — source contains 500 (confirmed auto-close delay)', () => {
    expect(source).toContain('500')
  })

  it('Phase 28: Test S — source contains comments.length === 0 (canApprove gate D-06)', () => {
    expect(source).toContain('comments.length === 0')
  })

  it('Phase 28: Test T — source contains comments.length > 0 (canRequestChanges gate D-06)', () => {
    expect(source).toContain('comments.length > 0')
  })

  it('Phase 28: Test U — source contains shouldUseClipboard(connectivity) (offline branch entry)', () => {
    expect(source).toContain('shouldUseClipboard(connectivity)')
  })

  it("Phase 28: Test V — source contains buildCodeReviewPayload('approved' AND buildCodeReviewPayload('changes_requested'", () => {
    expect(source).toContain("buildCodeReviewPayload('approved'")
    expect(source).toContain("buildCodeReviewPayload('changes_requested'")
  })

  it("Phase 28: Test W — source contains fetch('/api/decide' (the POST endpoint)", () => {
    expect(source).toContain("fetch('/api/decide'")
  })

  it("Phase 28: Test X — source contains 'Approved' literal AND 'Review submitted'", () => {
    expect(source).toContain("'Approved'")
    expect(source).toContain("'Review submitted'")
  })

  it("Phase 28: Test Y — source contains 'Copied to clipboard' AND 'Paste into your Claude conversation.'", () => {
    expect(source).toContain("'Copied to clipboard'")
    expect(source).toContain("'Paste into your Claude conversation.'")
  })

  it("Phase 28: Test Z — source contains 'Clipboard write failed' AND 'Dismiss' AND JSON payload aria-label", () => {
    expect(source).toContain("'Clipboard write failed'")
    expect(source).toContain("'Dismiss'")
    expect(source).toContain('JSON payload — copy and paste into Claude')
  })

  it("Phase 28: Test AA — source does NOT contain 'reviewer-v2/' (preserves ESLint boundary)", () => {
    expect(source).not.toContain('reviewer-v2/')
  })
})
