export type AnnotationType = 'comment' | 'delete' | 'replace'

export interface Annotation {
  id: string
  anchorText: string
  comment: string
  type: AnnotationType
}

export type AnnotationAction =
  | { type: 'add'; annotation: Annotation }
  | { type: 'edit'; id: string; comment: string }
  | { type: 'remove'; id: string }
