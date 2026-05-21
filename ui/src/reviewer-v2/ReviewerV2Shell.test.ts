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
