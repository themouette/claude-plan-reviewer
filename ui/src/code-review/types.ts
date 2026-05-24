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
