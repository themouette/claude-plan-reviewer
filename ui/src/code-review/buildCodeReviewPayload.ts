import type { CodeReviewComment } from './types'
import type { ConnectivityStatus } from '../shared/connectivity'

// The D-01 submission schema decision type
export type ReviewDecision = 'approved' | 'changes_requested'

// Internal output shapes for the D-01 JSON schema
interface LineCommentOutput {
  file: string
  line: number
  side: 'additions' | 'deletions'
  text: string
  // Field name chosen: endLine (not endLineNumber) — matches D-01 "Claude's-discretion" note in CONTEXT.md
  endLine?: number
}

interface FileCommentOutput {
  file: string
  text: string
}

type CommentOutput = LineCommentOutput | FileCommentOutput

interface CodeReviewPayload {
  decision: ReviewDecision
  global_instruction?: string
  comments?: CommentOutput[]
}

/**
 * Pure serializer for the D-01 code review submission schema.
 *
 * Contract:
 * - `global_instruction` is OMITTED (not null) when blank or whitespace-only.
 * - `comments` is OMITTED (not []) when the decision is 'approved' and the list is empty.
 * - Internal fields (id, type, createdAt, lineNumber) are stripped from each comment.
 * - For line comments, lineNumber maps to `line` and endLineNumber (if present) maps to `endLine`.
 */
export function buildCodeReviewPayload(
  decision: ReviewDecision,
  comments: CodeReviewComment[],
  globalInstruction?: string,
): string {
  const payload: CodeReviewPayload = { decision }

  // Conditionally assign global_instruction — omit when blank or whitespace-only
  const trimmedInstruction = globalInstruction?.trim()
  if (trimmedInstruction) {
    payload.global_instruction = trimmedInstruction
  }

  // Conditionally assign comments — omit when empty
  if (comments.length > 0) {
    payload.comments = comments.map(serializeComment)
  }

  return JSON.stringify(payload)
}

function serializeComment(c: CodeReviewComment): CommentOutput {
  if (c.type === 'file') {
    return { file: c.file, text: c.text }
  }
  // type === 'line': map lineNumber -> line, endLineNumber -> endLine (when present)
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
