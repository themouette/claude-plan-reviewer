import { describe, it, expect } from 'vitest'
import { annotationReducer, initialAnnotationState } from './useAnnotations'
import type { Annotation } from './types'

const sampleAnnotation: Annotation = {
  id: 'a1',
  anchorText: 'some text',
  comment: 'original comment',
  type: 'comment',
}

describe('annotationReducer', () => {
  it('add: appends annotation to empty state', () => {
    const next = annotationReducer(initialAnnotationState, {
      type: 'add',
      annotation: sampleAnnotation,
    })
    expect(next.annotations).toHaveLength(1)
    expect(next.annotations[0].id).toBe('a1')
  })

  it('add then edit: updates comment field while keeping other fields unchanged', () => {
    const after_add = annotationReducer(initialAnnotationState, {
      type: 'add',
      annotation: sampleAnnotation,
    })
    const after_edit = annotationReducer(after_add, {
      type: 'edit',
      id: 'a1',
      comment: 'updated comment',
    })
    expect(after_edit.annotations[0].comment).toBe('updated comment')
    expect(after_edit.annotations[0].id).toBe('a1')
    expect(after_edit.annotations[0].anchorText).toBe('some text')
    expect(after_edit.annotations[0].type).toBe('comment')
  })

  it('add then remove: removes annotation by id', () => {
    const after_add = annotationReducer(initialAnnotationState, {
      type: 'add',
      annotation: sampleAnnotation,
    })
    const after_remove = annotationReducer(after_add, {
      type: 'remove',
      id: 'a1',
    })
    expect(after_remove.annotations).toHaveLength(0)
  })

  it('edit non-existent id: state is structurally equivalent (no error, no mutation)', () => {
    const after_add = annotationReducer(initialAnnotationState, {
      type: 'add',
      annotation: sampleAnnotation,
    })
    const after_edit = annotationReducer(after_add, {
      type: 'edit',
      id: 'does-not-exist',
      comment: 'this changes nothing',
    })
    expect(after_edit.annotations).toHaveLength(1)
    expect(after_edit.annotations[0].comment).toBe('original comment')
  })

  it('remove non-existent id: state is structurally equivalent (no error, no mutation)', () => {
    const after_add = annotationReducer(initialAnnotationState, {
      type: 'add',
      annotation: sampleAnnotation,
    })
    const after_remove = annotationReducer(after_add, {
      type: 'remove',
      id: 'does-not-exist',
    })
    expect(after_remove.annotations).toHaveLength(1)
    expect(after_remove.annotations[0].id).toBe('a1')
  })
})
