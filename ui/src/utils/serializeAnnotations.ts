import type { Annotation } from '../types'

function typeLabel(type: Annotation['type']): string {
  switch (type) {
    case 'comment': return 'COMMENT'
    case 'delete':  return 'DELETE'
    case 'replace': return 'REPLACE'
  }
}

export function serializeAnnotations(
  denyText: string,
  overallComment: string,
  annotations: Annotation[]
): string {
  const feedbackItems: string[] = []

  if (denyText.trim()) {
    feedbackItems.push(denyText.trim())
  }

  if (overallComment.trim()) {
    feedbackItems.push(`[OVERALL]\n> ${overallComment.trim().replace(/\n/g, '\n> ')}`)
  }

  for (const a of annotations) {
    switch (a.type) {
      case 'comment':
        feedbackItems.push(`[COMMENT] Feedback on: "${a.anchorText}"\n> ${a.comment.replace(/\n/g, '\n> ')}`)
        break
      case 'delete':
        feedbackItems.push(`[DELETE] Remove: "${a.anchorText}"`)
        break
      case 'replace':
        feedbackItems.push(`[REPLACE] Replace: "${a.anchorText}"\n> With: ${a.replacement.replace(/\n/g, '\n> ')}`)
        break
    }
  }

  if (feedbackItems.length === 0) return ''

  const header = `# Plan Feedback\n\nI've reviewed this plan and have ${feedbackItems.length} piece${feedbackItems.length === 1 ? '' : 's'} of feedback:`
  const numbered = feedbackItems.map((item, i) => `## ${i + 1}. ${item}`).join('\n\n')

  const parts: string[] = [header, numbered]

  // Summary of annotation types
  const typeCounts = new Map<string, number>()
  for (const a of annotations) {
    const label = typeLabel(a.type)
    typeCounts.set(label, (typeCounts.get(label) ?? 0) + 1)
  }
  if (overallComment.trim()) typeCounts.set('OVERALL', 1)

  if (typeCounts.size > 0) {
    const lines = [...typeCounts.entries()].map(([label, count]) => `- **${label}**: ${count}`)
    parts.push(`---\n\n## Summary\n\n${lines.join('\n')}`)
  }

  return parts.join('\n\n')
}
