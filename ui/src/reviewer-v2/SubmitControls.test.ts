/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import SubmitControls from './SubmitControls'

const source = readFileSync(
  resolve(__dirname, './SubmitControls.tsx'),
  'utf-8',
)

describe('SubmitControls — exports + imports', () => {
  it('default export is a function', () => {
    expect(typeof SubmitControls).toBe('function')
  })

  it("imports buildClipboardPayload from './offlineLabels'", () => {
    expect(source).toMatch(/import\s*{[^}]*buildClipboardPayload[^}]*}\s*from\s*['"]\.\/offlineLabels['"]/)
  })

  it("imports shouldUseClipboard from './offlineLabels'", () => {
    expect(source).toContain('shouldUseClipboard')
    expect(source).toMatch(/from ['"]\.\/offlineLabels['"]/)
  })

  it("imports serializeAnnotations from './serializeAnnotations'", () => {
    expect(source).toMatch(/from ['"]\.\/serializeAnnotations['"]/)
  })

  it("imports SubmitPopover from './SubmitPopover'", () => {
    expect(source).toMatch(/from ['"]\.\/SubmitPopover['"]/)
  })

  it("imports nothing from outside reviewer-v2 (ARCH-01)", () => {
    expect(source).not.toMatch(/from ['"]\.\.\//);
  })
})

describe('SubmitControls — gate logic (SUBMIT-01)', () => {
  it('Approve is HTML-disabled when comments exist', () => {
    expect(source).toContain('disabled={!canApprove}')
  })

  it('Approve gate uses annotations.length === 0', () => {
    expect(source).toContain('annotations.length === 0')
  })

  it('canAskChange gate uses annotations.length > 0', () => {
    expect(source).toContain('annotations.length > 0')
  })

  it('Send Feedback is HTML-disabled when no comments exist (SUBMIT-01)', () => {
    expect(source).toContain('disabled={!canAskChange}')
  })

  it('Send Feedback disabled binding appears exactly once', () => {
    expect((source.match(/disabled=\{!canAskChange\}/g) ?? []).length).toBe(1)
  })

  it('Approve disabled binding appears exactly once', () => {
    expect((source.match(/disabled=\{!canApprove\}/g) ?? []).length).toBe(1)
  })
})

describe('SubmitControls — submission paths (SUBMIT-02)', () => {
  it('both handlers branch on shouldUseClipboard(connectivity)', () => {
    expect((source.match(/shouldUseClipboard\(connectivity\)/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it("approve clipboard call uses ('allow', '', '', annotations)", () => {
    expect(source).toContain("buildClipboardPayload('allow', '', ''")
  })

  it("ask-for-changes clipboard call uses ('deny', overallMessage, '', annotations) — overallMessage goes in slot 2 (denyText), NOT slot 3 (overallComment) (Pitfall 3)", () => {
    expect(source).toMatch(/buildClipboardPayload\(['"]deny['"]\s*,\s*overallMessage\s*,\s*['"]{2}\s*,/)
  })

  it("online ask-for-changes uses serializeAnnotations(overallMessage, '', annotations)", () => {
    expect(source).toMatch(/serializeAnnotations\(\s*overallMessage\s*,\s*['"]{2}\s*,/)
  })

  it('both handlers POST to /api/decide', () => {
    expect((source.match(/fetch\(['"]\/api\/decide['"]/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it("approve online body is { behavior: 'allow' }", () => {
    expect(source).toContain("behavior: 'allow'")
  })

  it("ask-for-changes online body is { behavior: 'deny', message }", () => {
    expect(source).toContain("behavior: 'deny'")
    expect(source).toMatch(/JSON\.stringify\(\s*\{\s*behavior:\s*['"]deny['"]\s*,\s*message\s*\}/)
  })

  it('treats res.ok || res.status === 409 as success', () => {
    expect((source.match(/res\.ok\s*\|\|\s*res\.status\s*===\s*409/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})

describe('SubmitControls — transient activation (Pitfall 4)', () => {
  it('offline branch calls navigator.clipboard.writeText synchronously (no await before the call)', () => {
    // Slice from first shouldUseClipboard(connectivity) to first subsequent return
    const startIdx = source.indexOf('shouldUseClipboard(connectivity)')
    expect(startIdx).toBeGreaterThan(-1)
    const returnIdx = source.indexOf('return', startIdx)
    expect(returnIdx).toBeGreaterThan(startIdx)
    const slice = source.slice(startIdx, returnIdx)
    expect(slice).toContain('navigator.clipboard.writeText')
    expect(slice).not.toMatch(/\bawait\s+/)
  })
})

describe('SubmitControls — state machine + inline confirmations (UI-SPEC)', () => {
  it("contains state literal 'idle'", () => {
    expect(source).toContain("'idle'")
  })

  it("contains state literal 'popover_open'", () => {
    expect(source).toContain("'popover_open'")
  })

  it("contains state literal 'confirmed_allow'", () => {
    expect(source).toContain("'confirmed_allow'")
  })

  it("contains state literal 'confirmed_deny'", () => {
    expect(source).toContain("'confirmed_deny'")
  })

  it("contains state literal 'clipboard_confirmed'", () => {
    expect(source).toContain("'clipboard_confirmed'")
  })

  it("contains state literal 'clipboard_error'", () => {
    expect(source).toContain("'clipboard_error'")
  })

  it("confirmation state 'Approved' is rendered", () => {
    expect(source).toContain('Approved')
  })

  it("confirmation state 'Feedback sent' is rendered", () => {
    expect(source).toContain('Feedback sent')
  })

  it("confirmation state 'Copied to clipboard' is rendered", () => {
    expect(source).toContain('Copied to clipboard')
  })

  it("confirmation state 'Clipboard write failed' is rendered", () => {
    expect(source).toContain('Clipboard write failed')
  })

  it('clipboard_error renders a readOnly textarea with the JSON', () => {
    expect(source).toContain('readOnly')
    expect(source).toMatch(/value=\{clipboardJson\}/)
  })
})

describe('SubmitControls — accessibility', () => {
  it('Send Feedback button declares aria-haspopup=true', () => {
    expect(source).toContain('aria-haspopup="true"')
  })

  it('Send Feedback button declares aria-expanded tied to popover state', () => {
    expect(source).toMatch(/aria-expanded=\{[^}]*popover_open[^}]*\}/)
  })

  it('disabled tooltip explains why Approve is blocked', () => {
    expect(source).toContain('Cannot approve while comments exist')
  })

  it('disabled tooltip explains why Send Feedback is blocked', () => {
    expect(source).toContain('Add at least one comment to send feedback')
  })
})

describe('SubmitControls — auto-close and clipboard reset', () => {
  it('schedules window.close() after online confirmation states', () => {
    expect(source).toContain('window.setTimeout')
    expect(source).toContain('window.close()')
  })

  it('confirmed_allow and confirmed_deny are guarded by the auto-close effect', () => {
    expect(source).toContain("submitState === 'confirmed_allow' || submitState === 'confirmed_deny'")
  })

  it('clipboard_confirmed is NOT included in the auto-close effect (it resets to idle instead)', () => {
    // The auto-close block must not contain clipboard_confirmed
    const closeIdx = source.indexOf("window.close()")
    expect(closeIdx).toBeGreaterThan(-1)
    // Find the enclosing if condition before window.close()
    const nearbySource = source.slice(Math.max(0, closeIdx - 300), closeIdx)
    expect(nearbySource).not.toContain("clipboard_confirmed")
  })

  it("clipboard_confirmed resets to 'idle' after a timeout", () => {
    expect(source).toMatch(/clipboard_confirmed[\s\S]{0,100}setSubmitState\(['"]idle['"]\)/)
  })
})
