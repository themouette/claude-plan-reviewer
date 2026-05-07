// ui/src/utils/offlineLabels.test.ts
// Source: codebase pattern (ui/src/utils/connectivity.test.ts)
import { describe, it, expect } from 'vitest'
import {
  OFFLINE_BANNER_LINE_1,
  OFFLINE_BANNER_LINE_2,
  OFFLINE_APPROVE_LABEL,
  OFFLINE_DENY_LABEL,
  OFFLINE_SUBMIT_DENIAL_LABEL,
  approveButtonLabel,
  denyButtonLabel,
  submitDenialButtonLabel,
  buildClipboardPayload,
  shouldUseClipboard,
} from './offlineLabels'
import type { Annotation } from '../types'

describe('offlineLabels constants', () => {
  it('Test 1: banner line 1 ships byte-for-byte', () => {
    expect(OFFLINE_BANNER_LINE_1).toBe(
      'Server connection lost — working offline.',
    )
  })

  it('Test 2: banner line 2 ships byte-for-byte', () => {
    expect(OFFLINE_BANNER_LINE_2).toBe(
      "When you're done, copy your decision to the clipboard and paste it back into Claude.",
    )
  })

  it('Test 3: approve offline label uses em dash', () => {
    expect(OFFLINE_APPROVE_LABEL).toBe('Copy to clipboard — approve')
  })

  it('Test 4: deny offline label uses em dash', () => {
    expect(OFFLINE_DENY_LABEL).toBe('Copy to clipboard — deny')
  })

  it('Test 5: submit-denial offline label is the bare phrase', () => {
    expect(OFFLINE_SUBMIT_DENIAL_LABEL).toBe('Copy to clipboard')
  })
})

describe('approveButtonLabel', () => {
  it('Test 6: returns default when online', () => {
    expect(approveButtonLabel('online', 'Approve')).toBe('Approve')
  })

  it('Test 7: preserves a custom default (Phase 11.1) when online', () => {
    expect(approveButtonLabel('online', 'No issues')).toBe('No issues')
  })

  it('Test 8: returns offline label when offline (default Approve)', () => {
    expect(approveButtonLabel('offline', 'Approve')).toBe(OFFLINE_APPROVE_LABEL)
  })

  it('Test 9: offline label overrides any custom default', () => {
    expect(approveButtonLabel('offline', 'No issues')).toBe(OFFLINE_APPROVE_LABEL)
  })
})

describe('denyButtonLabel', () => {
  it('Test 10: returns default when online', () => {
    expect(denyButtonLabel('online', 'Deny')).toBe('Deny')
  })

  it('Test 11: preserves a custom default (Phase 11.1) when online', () => {
    expect(denyButtonLabel('online', 'Leave feedback')).toBe('Leave feedback')
  })

  it('Test 12: returns offline label when offline (default Deny)', () => {
    expect(denyButtonLabel('offline', 'Deny')).toBe(OFFLINE_DENY_LABEL)
  })

  it('Test 13: offline label overrides any custom default', () => {
    expect(denyButtonLabel('offline', 'Leave feedback')).toBe(OFFLINE_DENY_LABEL)
  })
})

describe('submitDenialButtonLabel', () => {
  it('Test 14: returns default when online', () => {
    expect(submitDenialButtonLabel('online')).toBe('Submit Denial')
  })

  it('Test 15: returns offline label when offline', () => {
    expect(submitDenialButtonLabel('offline')).toBe(OFFLINE_SUBMIT_DENIAL_LABEL)
  })
})

describe('buildClipboardPayload', () => {
  it('Test 16: allow with no annotations returns compact allow JSON', () => {
    expect(buildClipboardPayload('allow', '', '', [])).toBe('{"behavior":"allow"}')
  })

  it('Test 17: deny with denyText returns JSON with behavior=deny and message key', () => {
    const result = buildClipboardPayload('deny', 'needs work', '', [])
    const parsed = JSON.parse(result) as { behavior: string; message: string }
    expect(parsed.behavior).toBe('deny')
    expect(typeof parsed.message).toBe('string')
    expect(parsed.message.length).toBeGreaterThan(0)
  })

  it('Test 18: allow with annotations includes reviewer notes in payload', () => {
    const mockAnnotation: Annotation = {
      id: 'a1',
      type: 'comment',
      anchorText: 'some text',
      comment: 'some comment',
      replacement: '',
    }
    const result = buildClipboardPayload('allow', 'some text', 'overall', [mockAnnotation])
    const parsed = JSON.parse(result) as { behavior: string; notes?: string }
    expect(parsed.behavior).toBe('allow')
    // Reviewer notes are preserved so the recipient has full context.
    expect(typeof parsed.notes).toBe('string')
    expect(parsed.notes!.length).toBeGreaterThan(0)
  })

  it('Test 19: deny with feedback returns JSON.parse-able object with message containing feedback', () => {
    const result = buildClipboardPayload('deny', 'my feedback', '', [])
    const parsed = JSON.parse(result) as { behavior: string; message: string }
    expect(parsed).toEqual(
      expect.objectContaining({
        behavior: 'deny',
        message: expect.stringContaining('my feedback') as string,
      }),
    )
  })

  it('Test 20: deny with all empty inputs returns valid JSON with empty string message', () => {
    // Note: the App-level deny() empty-message guard only applies to the
    // online path. The clipboard path (offline) calls buildClipboardPayload
    // unconditionally so that offline users always receive a confirmable
    // payload even if they submitted with no text.
    const result = buildClipboardPayload('deny', '', '', [])
    const parsed = JSON.parse(result) as { behavior: string; message: string }
    expect(parsed.behavior).toBe('deny')
    expect(parsed.message).toBe('')
  })
})

describe('shouldUseClipboard', () => {
  it('Test 21: returns true when status is offline', () => {
    expect(shouldUseClipboard('offline')).toBe(true)
  })
  it('Test 22: returns false when status is online', () => {
    expect(shouldUseClipboard('online')).toBe(false)
  })
})
