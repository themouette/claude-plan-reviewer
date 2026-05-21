import { useMemo, type RefObject } from 'react'
import type { Annotation, Section } from '../types'
import { getElementCharOffset } from './useTextSelection'

/**
 * Pure helper extracted from the hook so it is unit-testable with synthetic DOM.
 *
 * Returns a Map<sectionId, count> where count is the number of annotations whose
 * anchorStart falls in [headingStart, nextHeadingStart). Annotations that appear
 * before the first heading are not counted under any section (per D-14/OUTLINE-04).
 *
 * Sections whose heading element is absent from the container are silently skipped.
 */
export function computeSectionAnnotationCounts(
  container: HTMLElement,
  sections: Section[],
  annotations: Annotation[],
): Map<string, number> {
  const counts = new Map<string, number>()

  if (sections.length === 0 || annotations.length === 0) return counts

  // Build boundaries: [{id, start}] for sections whose heading is in the container.
  const boundaries: { id: string; start: number }[] = []
  for (const section of sections) {
    const headingEl = document.getElementById(section.id)
    if (!headingEl || !container.contains(headingEl)) continue
    boundaries.push({ id: section.id, start: getElementCharOffset(container, headingEl) })
  }

  if (boundaries.length === 0) return counts

  // Sort ascending by start (defensive — headings should already be in document order).
  boundaries.sort((a, b) => a.start - b.start)

  for (const annotation of annotations) {
    // Find the last boundary whose start <= annotation.anchorStart.
    let owningId: string | null = null
    for (let i = boundaries.length - 1; i >= 0; i--) {
      if (boundaries[i].start <= annotation.anchorStart) {
        owningId = boundaries[i].id
        break
      }
    }
    if (owningId === null) continue // annotation is before the first heading — skip
    counts.set(owningId, (counts.get(owningId) ?? 0) + 1)
  }

  return counts
}

export function useSectionAnnotationCounts(
  sections: Section[],
  annotations: Annotation[],
  planRef: RefObject<HTMLDivElement | null>,
): Map<string, number> {
  return useMemo(() => {
    const container = planRef.current
    if (!container || sections.length === 0) return new Map()
    return computeSectionAnnotationCounts(container, sections, annotations)
  }, [sections, annotations, planRef])
}
