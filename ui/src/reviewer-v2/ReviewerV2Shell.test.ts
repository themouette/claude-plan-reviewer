/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import ReviewerV2Shell from './ReviewerV2Shell'

const source = readFileSync(
  resolve(__dirname, './ReviewerV2Shell.tsx'),
  'utf-8',
)

describe('ReviewerV2Shell', () => {
  it('exports a function as default', () => {
    expect(typeof ReviewerV2Shell).toBe('function')
  })

  it('source contains useAnnotations import and usage', () => {
    expect(source).toContain('useAnnotations')
  })

  it('source declares hoveredCommentId state', () => {
    expect(source).toContain('hoveredCommentId')
  })

  it('source declares focusedCommentId state', () => {
    expect(source).toContain('focusedCommentId')
  })

  it('source declares setHoveredCommentId setter', () => {
    expect(source).toContain('setHoveredCommentId')
  })

  it('source declares setFocusedCommentId setter', () => {
    expect(source).toContain('setFocusedCommentId')
  })

  it('source declares planRef as useRef<HTMLDivElement>', () => {
    expect(source).toContain('useRef<HTMLDivElement>')
  })

  it('source mounts <CommentPane', () => {
    expect(source).toContain('<CommentPane')
  })

  it('source has aria-label="Comments" on the right aside', () => {
    expect(source).toContain('aria-label="Comments"')
  })

  it('source passes onHover={setHoveredCommentId} to CommentPane', () => {
    expect(source).toContain('onHover={setHoveredCommentId}')
  })

  it('source passes onFocus={setFocusedCommentId} to CommentPane', () => {
    expect(source).toContain('onFocus={setFocusedCommentId}')
  })

  it('source passes onHoverCommentId={setHoveredCommentId} to ContentPane (COMMENT-02 reverse direction)', () => {
    expect(source).toContain('onHoverCommentId={setHoveredCommentId}')
  })

  it('source passes onAddAnnotation={addAnnotation} to ContentPane', () => {
    expect(source).toContain('onAddAnnotation={addAnnotation}')
  })

  it('source passes annotations={annotations} to at least one pane', () => {
    expect(source).toContain('annotations={annotations}')
  })

  it('source does NOT contain the placeholder >Comments</span>', () => {
    expect(source).not.toContain('>Comments</span>')
  })

  it('source passes mainRef={mainRef} to multiple panes (OutlinePane + CommentPane)', () => {
    const matches = source.match(/mainRef=\{mainRef\}/g)
    expect(matches).toBeTruthy()
    expect(matches!.length).toBeGreaterThanOrEqual(2)
  })
})

describe('ReviewerV2Shell editingId + annotationCounts wiring (Phase 21)', () => {
  it('source destructures editAnnotation from useAnnotations()', () => {
    expect(source).toContain('editAnnotation')
  })

  it('source destructures removeAnnotation from useAnnotations()', () => {
    expect(source).toContain('removeAnnotation')
  })

  it('source declares useState<string | null>(null) at least twice (focusedCommentId and editingId)', () => {
    const matches = source.match(/useState<string \| null>\(null\)/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  it('source calls useSectionAnnotationCounts(sections, annotations, planRef)', () => {
    expect(source).toContain('useSectionAnnotationCounts(sections, annotations, planRef)')
  })

  it('source passes annotationCounts={annotationCounts} to OutlinePane', () => {
    expect(source).toContain('annotationCounts={annotationCounts}')
  })

  it('source passes editingId={editingId} to CommentPane', () => {
    expect(source).toContain('editingId={editingId}')
  })

  it('source passes onCancelEdit closing over setEditingId(null)', () => {
    expect(source).toMatch(/onCancelEdit=\{.*setEditingId\(null\).*\}/)
  })

  it('source calls setEditingId(null) (Escape handler extension)', () => {
    expect(source).toContain('setEditingId(null)')
  })

  it('source contains editAnnotation(id, newComment) in the onEdit commit branch', () => {
    expect(source).toContain('editAnnotation(id, newComment)')
  })

  it('source imports useSectionAnnotationCounts from ./hooks/useSectionAnnotationCounts', () => {
    expect(source).toContain("import { useSectionAnnotationCounts } from './hooks/useSectionAnnotationCounts'")
  })
})
