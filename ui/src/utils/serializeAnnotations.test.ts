import { describe, it, expect } from 'vitest'
import { serializeAnnotations } from './serializeAnnotations'
import type { Annotation } from '../types'

describe('serializeAnnotations', () => {
  it('Test 1: returns empty string when everything is empty', () => {
    expect(serializeAnnotations('', '', [])).toBe('')
  })

  it('Test 2: single denyText produces numbered header', () => {
    const result = serializeAnnotations('Please revise this.', '', [])
    expect(result).toContain('# Plan Feedback')
    expect(result).toContain('1 piece of feedback')
    expect(result).toContain('## 1. Please revise this.')
  })

  it('Test 3: overallComment appears as OVERALL numbered item with quoted text', () => {
    const result = serializeAnnotations('', 'This looks risky.', [])
    expect(result).toContain('# Plan Feedback')
    expect(result).toContain('1 piece of feedback')
    expect(result).toContain('[OVERALL]')
    expect(result).toContain('> This looks risky.')
    expect(result).toContain('**OVERALL**: 1')
  })

  it('Test 4: comment annotation produces numbered COMMENT item', () => {
    const annotations: Annotation[] = [
      { id: '1', type: 'comment', anchorText: 'some text', comment: 'This is wrong', replacement: '' },
    ]
    const result = serializeAnnotations('', '', annotations)
    expect(result).toContain('# Plan Feedback')
    expect(result).toContain('1 piece of feedback')
    expect(result).toContain('## 1. [COMMENT] Feedback on: "some text"')
    expect(result).toContain('> This is wrong')
    expect(result).toContain('**COMMENT**: 1')
  })

  it('Test 5: delete annotation produces numbered DELETE item', () => {
    const annotations: Annotation[] = [
      { id: '2', type: 'delete', anchorText: 'remove this', comment: '', replacement: '' },
    ]
    const result = serializeAnnotations('', '', annotations)
    expect(result).toContain('## 1. [DELETE] Remove: "remove this"')
    expect(result).toContain('**DELETE**: 1')
  })

  it('Test 6: replace annotation produces numbered REPLACE item', () => {
    const annotations: Annotation[] = [
      { id: '3', type: 'replace', anchorText: 'old text', comment: '', replacement: 'new text' },
    ]
    const result = serializeAnnotations('', '', annotations)
    expect(result).toContain('## 1. [REPLACE] Replace: "old text"')
    expect(result).toContain('> With: new text')
    expect(result).toContain('**REPLACE**: 1')
  })

  it('Test 7: all inputs combined produce numbered items in order and summary', () => {
    const annotations: Annotation[] = [
      { id: '1', type: 'comment', anchorText: 'anchor A', comment: 'Note A', replacement: '' },
      { id: '2', type: 'delete', anchorText: 'anchor B', comment: '', replacement: '' },
      { id: '3', type: 'replace', anchorText: 'anchor C', comment: '', replacement: 'new C' },
    ]
    const result = serializeAnnotations('Main feedback.', 'Overall note.', annotations)
    expect(result).toContain('5 pieces of feedback')
    expect(result).toContain('## 1. Main feedback.')
    expect(result).toContain('## 2. [OVERALL]')
    expect(result).toContain('## 3. [COMMENT]')
    expect(result).toContain('## 4. [DELETE]')
    expect(result).toContain('## 5. [REPLACE]')
    expect(result).toContain('---')
    expect(result).toContain('## Summary')
  })

  it('Test 8: result never starts with a newline', () => {
    const annotations: Annotation[] = [
      { id: '1', type: 'delete', anchorText: 'x', comment: '', replacement: '' },
    ]
    const result = serializeAnnotations('', '', annotations)
    expect(result.startsWith('\n')).toBe(false)
    expect(result.startsWith('# Plan Feedback')).toBe(true)
  })

  it('Test 9: plural vs singular piece wording', () => {
    const single = serializeAnnotations('one thing', '', [])
    expect(single).toContain('1 piece of feedback')

    const multi: Annotation[] = [
      { id: '1', type: 'delete', anchorText: 'a', comment: '', replacement: '' },
    ]
    const plural = serializeAnnotations('first', '', multi)
    expect(plural).toContain('2 pieces of feedback')
  })

  it('Test 10: multiline comment lines are quoted with >', () => {
    const annotations: Annotation[] = [
      { id: '1', type: 'comment', anchorText: 'x', comment: 'line one\nline two', replacement: '' },
    ]
    const result = serializeAnnotations('', '', annotations)
    expect(result).toContain('> line one\n> line two')
  })
})
