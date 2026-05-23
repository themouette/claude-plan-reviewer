export type AnnotationType = 'comment' | 'delete' | 'replace'

export interface Annotation {
  id: string
  anchorText: string
  comment: string
  type: AnnotationType
  anchorStart: number
  anchorEnd: number
}

export type AnnotationAction =
  | { type: 'add'; annotation: Annotation }
  | { type: 'edit'; id: string; comment: string }
  | { type: 'remove'; id: string }

export interface Section {
  id: string
  text: string
  depth: number
}
