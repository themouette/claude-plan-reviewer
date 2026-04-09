export type AnnotationType = 'comment' | 'delete' | 'replace'

export type Tab = 'plan' | 'diff' | 'help'

export type ViewMode = 'preview' | 'markdown'

export interface Annotation {
  id: string
  type: AnnotationType
  anchorText: string
  comment: string     // used for type='comment'; empty string for others
  replacement: string // used for type='replace'; empty string for others
}

export interface OutlineItem {
  id: string
  level: 1 | 2 | 3
  text: string
}
