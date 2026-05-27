import type { CodeReviewComment } from './types'
import type { ConnectivityStatus } from '../shared/connectivity'

interface LineCommentOutput {
  file: string
  line: number
  side: 'additions' | 'deletions'
  text: string
  endLine?: number
}

interface FileCommentOutput {
  file: string
  text: string
}

type CommentOutput = LineCommentOutput | FileCommentOutput

interface ReviewPayload {
  message?: string
  comments?: CommentOutput[]
}

/**
 * Pure serializer for the code review submission payload.
 *
 * Contract:
 * - `message` is OMITTED when blank or whitespace-only.
 * - `comments` is OMITTED when the array is empty.
 * - Internal fields (id, type, createdAt, lineNumber) are stripped from each comment.
 * - For line comments, lineNumber maps to `line` and endLineNumber (if present) maps to `endLine`.
 * - At least one of message or comments must be present for a meaningful payload.
 */
export function buildReviewPayload(
  message: string | undefined,
  comments: CodeReviewComment[],
): string {
  const payload: ReviewPayload = {}

  const trimmedMessage = message?.trim()
  if (trimmedMessage) {
    payload.message = trimmedMessage
  }

  if (comments.length > 0) {
    payload.comments = comments.map(serializeComment)
  }

  return JSON.stringify(payload)
}

function serializeComment(c: CodeReviewComment): CommentOutput {
  if (c.type === 'file') {
    return { file: c.file, text: c.text }
  }
  const output: LineCommentOutput = {
    file: c.file,
    line: c.lineNumber,
    side: c.side,
    text: c.text,
  }
  if (c.endLineNumber !== undefined) {
    output.endLine = c.endLineNumber
  }
  return output
}

/**
 * Returns true when the submission should use the clipboard fallback path
 * instead of the online POST endpoint.
 */
export function shouldUseClipboard(status: ConnectivityStatus): boolean {
  return status === 'offline'
}
