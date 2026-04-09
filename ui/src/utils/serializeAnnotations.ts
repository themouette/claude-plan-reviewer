import type { Annotation } from '../types'

export function serializeAnnotations(
  denyText: string,
  overallComment: string,
  annotations: Annotation[]
): string {
  const parts: string[] = []

  if (denyText.trim()) {
    parts.push(denyText.trim())
  }

  if (overallComment.trim()) {
    parts.push(`## Overall Comment\n${overallComment.trim()}`)
  }

  if (annotations.length > 0) {
    const annParts = annotations.map((a) => {
      switch (a.type) {
        case 'comment':
          return `### Comment on: "${a.anchorText}"\n${a.comment}`
        case 'delete':
          return `### Delete: "${a.anchorText}"`
        case 'replace':
          return `### Replace: "${a.anchorText}"\nWith: ${a.replacement}`
      }
    })
    parts.push(`## Annotations\n\n${annParts.join('\n\n')}`)
  }

  return parts.join('\n\n')
}
