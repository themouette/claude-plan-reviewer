/// <reference types="node" />
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { computeSectionAnnotationCounts } from './useSectionAnnotationCounts'
import type { Annotation, Section } from '../types'

const source = readFileSync(
  resolve(__dirname, './useSectionAnnotationCounts.ts'),
  'utf-8',
)

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeAnnotation(anchorStart: number, anchorEnd: number): Annotation {
  return {
    id: `a-${anchorStart}`,
    anchorText: 'text',
    comment: '',
    type: 'comment',
    anchorStart,
    anchorEnd,
  }
}

function makeSections(ids: string[]): Section[] {
  return ids.map((id) => ({ id, text: id, depth: 2 }))
}

/**
 * Build a container like:
 *   <div>
 *     intro text
 *     <h2 id="s1">Section One</h2>
 *     paragraph one
 *     <h2 id="s2">Section Two</h2>
 *     paragraph two
 *   </div>
 * attached to document.body so getElementById works.
 */
function buildContainer(specs: { id: string; prefix: string }[]): HTMLElement {
  const container = document.createElement('div')
  for (const spec of specs) {
    container.appendChild(document.createTextNode(spec.prefix))
    const h2 = document.createElement('h2')
    h2.id = spec.id
    h2.appendChild(document.createTextNode(spec.id))
    container.appendChild(h2)
  }
  document.body.appendChild(container)
  return container
}

let container: HTMLElement

beforeEach(() => {
  // Clean body before each test so getElementById returns the right element.
  document.body.innerHTML = ''
})

afterEach(() => {
  document.body.innerHTML = ''
})

// ─── computeSectionAnnotationCounts ──────────────────────────────────────────

describe('computeSectionAnnotationCounts', () => {
  it('returns empty map when sections array is empty', () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    const result = computeSectionAnnotationCounts(container, [], [makeAnnotation(0, 5)])
    expect(result.size).toBe(0)
  })

  it('returns empty map when annotations array is empty', () => {
    container = buildContainer([{ id: 's1', prefix: '' }])
    const result = computeSectionAnnotationCounts(container, makeSections(['s1']), [])
    expect(result.size).toBe(0)
  })

  it('counts annotation in first section', () => {
    // "s1" heading starts at offset 0 (no prefix text before it)
    // "s2" heading starts at offset 2 ("s1" = 2 chars)
    container = buildContainer([
      { id: 's1', prefix: '' },
      { id: 's2', prefix: 'X' },
    ])
    const sections = makeSections(['s1', 's2'])
    // anchorStart=0 → exactly at s1 heading start → owned by s1
    const result = computeSectionAnnotationCounts(container, sections, [makeAnnotation(0, 1)])
    expect(result.get('s1')).toBe(1)
    expect(result.get('s2')).toBeUndefined()
  })

  it('counts annotation in second section', () => {
    // prefix "" before s1, prefix "s1" (2 chars) before s2 heading, so s2 starts at 2
    container = buildContainer([
      { id: 's1', prefix: '' },
      { id: 's2', prefix: 's1' },
    ])
    const sections = makeSections(['s1', 's2'])
    // anchorStart beyond s1 heading text → lands in s2
    const result = computeSectionAnnotationCounts(container, sections, [makeAnnotation(5, 6)])
    expect(result.get('s2')).toBe(1)
    expect(result.get('s1')).toBeUndefined()
  })

  it('does not count annotation before the first heading', () => {
    // prefix "before" (6 chars) before s1 heading, so s1 starts at 6
    container = buildContainer([{ id: 's1', prefix: 'before' }])
    const sections = makeSections(['s1'])
    // anchorStart=0 → before the first heading → no section owns it
    const result = computeSectionAnnotationCounts(container, sections, [makeAnnotation(0, 3)])
    expect(result.size).toBe(0)
  })

  it('accumulates multiple annotations in the same section', () => {
    container = buildContainer([{ id: 's1', prefix: '' }])
    const sections = makeSections(['s1'])
    const annotations = [
      makeAnnotation(0, 1),
      makeAnnotation(1, 2),
      makeAnnotation(2, 3),
    ]
    const result = computeSectionAnnotationCounts(container, sections, annotations)
    expect(result.get('s1')).toBe(3)
  })

  it('assigns annotation to the section whose boundary is closest from below (inclusive)', () => {
    // buildContainer text walk for [{id:'s1',prefix:''},{id:'s2',prefix:'s1'}]:
    //   '' (0 chars) | 's1' heading text (2) | 's1' prefix (2) | 's2' heading text (2)
    // s1 heading offset: 0, s2 heading offset: 0+2+2 = 4
    container = buildContainer([
      { id: 's1', prefix: '' },
      { id: 's2', prefix: 's1' },
    ])
    const sections = makeSections(['s1', 's2'])
    // anchorStart exactly at s2 heading start (4) → owned by s2 (inclusive boundary)
    const s2Start = 4
    const result = computeSectionAnnotationCounts(container, sections, [
      makeAnnotation(s2Start, s2Start + 1),
    ])
    expect(result.get('s2')).toBe(1)
    expect(result.get('s1')).toBeUndefined()
  })

  it('silently skips a section whose id has no matching heading element', () => {
    container = buildContainer([{ id: 's1', prefix: '' }])
    // 'missing' has no heading in the DOM
    const sections = makeSections(['s1', 'missing'])
    const result = computeSectionAnnotationCounts(container, sections, [makeAnnotation(0, 1)])
    expect(result.get('s1')).toBe(1)
    expect(result.has('missing')).toBe(false)
  })

  it('distributes annotations across two sections correctly', () => {
    // buildContainer text walk for [{id:'s1',prefix:'prefix0'},{id:'s2',prefix:'s1'}]:
    //   'prefix0' (7) | 's1' heading text (2) | 's1' prefix (2) | 's2' heading text (2)
    // s1 heading offset: 7, s2 heading offset: 7+2+2 = 11
    container = buildContainer([
      { id: 's1', prefix: 'prefix0' },
      { id: 's2', prefix: 's1' },
    ])
    const sections = makeSections(['s1', 's2'])
    // annotation at 7 → owned by s1 (s1 starts at 7)
    // annotation at 11 → owned by s2 (s2 starts at 11, inclusive boundary)
    const result = computeSectionAnnotationCounts(container, sections, [
      makeAnnotation(7, 8),
      makeAnnotation(11, 12),
    ])
    expect(result.get('s1')).toBe(1)
    expect(result.get('s2')).toBe(1)
  })
})

// ─── useSectionAnnotationCounts source-as-text ───────────────────────────────

describe('useSectionAnnotationCounts hook', () => {
  it('uses useMemo', () => {
    expect(source).toContain('useMemo')
  })

  it('reads planRef.current', () => {
    expect(source).toContain('planRef.current')
  })

  it('delegates to computeSectionAnnotationCounts', () => {
    expect(source).toContain('computeSectionAnnotationCounts(')
  })

  it('does not import from @testing-library/react', () => {
    expect(source).not.toContain('@testing-library/react')
  })
})
