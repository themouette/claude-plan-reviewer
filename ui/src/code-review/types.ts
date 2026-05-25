export interface FileDiff {
  filename: string
  previous_filename?: string // snake_case matches Rust JSON output (no rename_all on struct)
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied'
  additions: number
  deletions: number
  changes: number
  patch: string // raw unified diff text, or "[binary file]"
  old_content?: string // full file text before change; absent for binary files
  new_content?: string // full file text after change; absent for binary files
}

// snake_case matches Rust JSON output (no rename_all on struct)
export interface Commit {
  sha: string
  short_sha: string // 7 chars
  message: string
  author: string
  email: string
  date: string // ISO 8601 / RFC 3339
  branches: string[]
  tags: string[]
}

export type CodeReviewComment =
  | {
      id: string
      type: 'line'
      file: string
      side: 'additions' | 'deletions'
      lineNumber: number
      text: string
      createdAt: string
    }
  | {
      id: string
      type: 'file'
      file: string
      text: string
      createdAt: string
    }
