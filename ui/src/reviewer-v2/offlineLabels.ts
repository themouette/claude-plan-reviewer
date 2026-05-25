import type { ConnectivityStatus } from '../shared/connectivity'
import { serializeAnnotations } from './serializeAnnotations'
import type { Annotation } from './types'

export const OFFLINE_BANNER_LINE_1 = 'Server connection lost — working offline.'
export const OFFLINE_BANNER_LINE_2 = 'Clipboard submit is available.'

export type ClipboardDecision = 'allow' | 'deny'

export function buildClipboardPayload(
  decision: ClipboardDecision,
  denyText: string,
  overallComment: string,
  annotations: Annotation[],
): string {
  if (decision === 'allow') {
    // Include reviewer notes even for approval so the recipient has full context.
    const notes = serializeAnnotations('', overallComment, annotations)
    if (notes.trim()) {
      return JSON.stringify({ behavior: 'allow', notes })
    }
    return JSON.stringify({ behavior: 'allow' })
  }
  const message = serializeAnnotations(denyText, overallComment, annotations)
  return JSON.stringify({ behavior: 'deny', message })
}

/**
 * Returns true when the submit action should write to the clipboard instead of
 * POSTing to /api/decide. This is a pure function so it can be tested without
 * any React context.
 */
export function shouldUseClipboard(status: ConnectivityStatus): boolean {
  return status === 'offline'
}
