/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import ContentPane from './ContentPane'

const source = readFileSync(
  resolve(__dirname, './ContentPane.tsx'),
  'utf-8',
)

describe('ContentPane', () => {
  it('exports a function as default', () => {
    expect(typeof ContentPane).toBe('function')
  })

  it('fetches /api/plan to load the plan markdown', () => {
    expect(source).toContain("fetch('/api/plan')")
  })

  it('uses renderMarkdown to convert markdown to HTML', () => {
    expect(source).toContain('renderMarkdown')
  })

  it('renders the error state copy matching UI-SPEC', () => {
    expect(source).toContain(
      'Could not render plan — The markdown content is unavailable. Reload the page to retry.',
    )
  })

  it('renders loading state with ellipsis copy', () => {
    expect(source).toContain('Loading…')
  })

  it('mounts PlanContent and SelectionToolbar JSX elements', () => {
    expect(source).toContain('<PlanContent')
    expect(source).toContain('<SelectionToolbar')
  })

  it('uses xl spacing token (padding: 32) as ContentPane-owned padding', () => {
    expect(source).toContain('padding: 32')
  })

  it('handleAction calls resetTextSelection to clear the selection', () => {
    expect(source).toContain('resetTextSelection')
    expect(source).toContain('function handleAction')
  })
})

describe('ContentPane CSS Highlights wiring', () => {
  it("source contains CSS.highlights.set with comment-hover highlight name", () => {
    expect(source).toContain("CSS.highlights.set(COMMENT_HOVER_HIGHLIGHT")
  })

  it("source contains CSS.highlights.delete with comment-hover highlight name", () => {
    expect(source).toContain("CSS.highlights.delete(COMMENT_HOVER_HIGHLIGHT)")
  })

  it("source defines the COMMENT_HOVER_HIGHLIGHT constant as 'comment-hover'", () => {
    expect(source).toContain("const COMMENT_HOVER_HIGHLIGHT = 'comment-hover'")
  })

  it('source imports rangeFromOffsets from useTextSelection', () => {
    expect(source).toContain('rangeFromOffsets')
  })

  it('source uses hoveredCommentId in the CSS highlights effect', () => {
    expect(source).toContain('hoveredCommentId')
  })

  it('source declares supportsHighlights constant', () => {
    expect(source).toContain('supportsHighlights')
  })
})

describe('ContentPane annotation creation wiring (D-02 + D-07)', () => {
  it('source contains onAddAnnotation prop and invocation', () => {
    expect(source).toContain('onAddAnnotation')
  })

  it('source uses crypto.randomUUID() for annotation id generation', () => {
    expect(source).toContain('crypto.randomUUID()')
  })

  it('source captures anchorStart from offsets.start (D-02)', () => {
    expect(source).toContain('anchorStart: offsets.start')
  })

  it('source captures anchorEnd from offsets.end (D-02)', () => {
    expect(source).toContain('anchorEnd: offsets.end')
  })

  it('source sets comment: anchorText as D-07 stub', () => {
    expect(source).toContain('comment: anchorText')
  })
})

describe('ContentPane onSectionsFound wiring', () => {
  it('source contains onSectionsFound prop declaration', () => {
    expect(source).toContain('onSectionsFound')
  })

  it('source contains querySelectorAll for heading walk', () => {
    expect(source).toContain('querySelectorAll')
  })

  it('source imports or uses the Section type', () => {
    expect(source).toContain('Section')
  })

  it('source contains the specific h1,h2,h3,h4,h5,h6 selector', () => {
    expect(source).toContain('h1,h2,h3,h4,h5,h6')
  })

  it('source contains el.textContent for text extraction from heading elements', () => {
    expect(source).toContain('el.textContent')
  })

  it('source contains parseInt(el.tagName for depth extraction', () => {
    expect(source).toContain('parseInt(el.tagName')
  })
})
