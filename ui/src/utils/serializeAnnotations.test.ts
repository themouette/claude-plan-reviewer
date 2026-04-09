import { describe, it, expect } from 'vitest'
import { serializeAnnotations } from './serializeAnnotations'
import type { Annotation } from '../types'

describe('serializeAnnotations', () => {
  it('Test 1: returns empty string when everything is empty', () => {
    expect(serializeAnnotations('', '', [])).toBe('')
  })

  it('Test 2: returns denyText only when no overallComment and no annotations', () => {
    expect(serializeAnnotations('Please revise this.', '', [])).toBe('Please revise this.')
  })

  it('Test 3: returns overall comment section when overallComment is set and no annotations', () => {
    const result = serializeAnnotations('', 'This looks risky.', [])
    expect(result).toBe('## Overall Comment\nThis looks risky.')
  })

  it('Test 4: produces comment annotation section', () => {
    const annotations: Annotation[] = [
      { id: '1', type: 'comment', anchorText: 'some text', comment: 'This is wrong', replacement: '' },
    ]
    const result = serializeAnnotations('', '', annotations)
    expect(result).toBe('## Annotations\n\n### Comment on: "some text"\nThis is wrong')
  })

  it('Test 5: produces delete annotation section', () => {
    const annotations: Annotation[] = [
      { id: '2', type: 'delete', anchorText: 'remove this', comment: '', replacement: '' },
    ]
    const result = serializeAnnotations('', '', annotations)
    expect(result).toBe('## Annotations\n\n### Delete: "remove this"')
  })

  it('Test 6: produces replace annotation section', () => {
    const annotations: Annotation[] = [
      { id: '3', type: 'replace', anchorText: 'old text', comment: '', replacement: 'new text' },
    ]
    const result = serializeAnnotations('', '', annotations)
    expect(result).toBe('## Annotations\n\n### Replace: "old text"\nWith: new text')
  })

  it('Test 7: produces all sections when denyText + overallComment + mixed annotations present', () => {
    const annotations: Annotation[] = [
      { id: '1', type: 'comment', anchorText: 'anchor A', comment: 'Note A', replacement: '' },
      { id: '2', type: 'delete', anchorText: 'anchor B', comment: '', replacement: '' },
      { id: '3', type: 'replace', anchorText: 'anchor C', comment: '', replacement: 'new C' },
    ]
    const result = serializeAnnotations('Main feedback.', 'Overall note.', annotations)
    const expected = [
      'Main feedback.',
      '## Overall Comment\nOverall note.',
      '## Annotations\n\n### Comment on: "anchor A"\nNote A\n\n### Delete: "anchor B"\n\n### Replace: "anchor C"\nWith: new C',
    ].join('\n\n')
    expect(result).toBe(expected)
  })

  it('Test 8: empty denyText with annotations produces no leading blank line before sections', () => {
    const annotations: Annotation[] = [
      { id: '1', type: 'delete', anchorText: 'x', comment: '', replacement: '' },
    ]
    const result = serializeAnnotations('', '', annotations)
    expect(result.startsWith('\n')).toBe(false)
    expect(result).toBe('## Annotations\n\n### Delete: "x"')
  })
})
