export type AnnotationType = 'comment' | 'delete' | 'replace'

export type Tab = 'plan' | 'diff'

export interface Annotation {
  id: string
  type: AnnotationType
  anchorText: string
  comment: string     // used for type='comment'; empty string for others
  replacement: string // used for type='replace'; empty string for others
}
