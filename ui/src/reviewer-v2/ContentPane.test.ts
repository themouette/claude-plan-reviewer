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

  it('source routes comment through handleFormSubmit (not anchorText stub)', () => {
    expect(source).toContain('handleFormSubmit')
  })

  it('source uses formState.anchorText (not comment: anchorText stub)', () => {
    expect(source).toContain('formState.anchorText')
  })
})

describe('ContentPane annotation form wiring (Phase 21)', () => {
  it('source imports AnnotationForm from ./AnnotationForm', () => {
    expect(source).toContain("from './AnnotationForm'")
  })

  it('source imports FormState type from ./AnnotationForm', () => {
    expect(source).toContain('FormState')
  })

  it('source declares useState<FormState | null>', () => {
    expect(source).toMatch(/useState<FormState \| null>/)
  })

  it('source declares latestFormValueRef with useRef', () => {
    expect(source).toContain('latestFormValueRef')
  })

  it('source declares handleAction with prefillComment optional arg', () => {
    expect(source).toContain('function handleAction(type: AnnotationType, anchorText: string, prefillComment?: string)')
  })

  it('source declares handleFormSubmit', () => {
    expect(source).toContain('function handleFormSubmit(')
  })

  it('source declares handleFormCancel', () => {
    expect(source).toContain('function handleFormCancel(')
  })

  it('source uses latestFormValueRef for auto-submit (D-03)', () => {
    expect(source).toContain('latestFormValueRef.current')
  })

  it('source renders <AnnotationForm conditionally on formState', () => {
    expect(source).toContain('<AnnotationForm')
  })

  it('source guards SelectionToolbar with !formState', () => {
    expect(source).toMatch(/!formState/)
  })

  it('source prefill has Delete literal', () => {
    expect(source).toContain("'Delete'")
  })

  it('source prefill has Replace literal', () => {
    expect(source).toContain("'Replace'")
  })

  it('source uses selectNodeContents for programmatic paragraph selection (D-06)', () => {
    expect(source).toContain('selectNodeContents')
  })

  it('source uses window.getSelection() in handleAdd', () => {
    expect(source).toContain('window.getSelection()')
  })

  it('source uses addRange( in handleAdd', () => {
    expect(source).toContain('addRange(')
  })

  it('handleAction bypasses form and calls resetTextSelection for delete type and predefined actions', () => {
    expect(source).toContain("type === 'delete' || prefillComment !== undefined")
    expect(source).toContain('resetTextSelection()')
  })

  it('handleAction opens form (setFormState) for comment and replace types without clearing selection (D-04)', () => {
    expect(source).toContain('setFormState({')
    expect(source).toMatch(/type.*'replace'.*\?.*'Replace'/)
  })

  it('handleFormSubmit calls resetTextSelection', () => {
    const body = source.match(/function handleFormSubmit[\s\S]*?\n {2}\}/)?.[0] ?? ''
    expect(body).toContain('resetTextSelection')
  })

  it('handleFormCancel calls resetTextSelection', () => {
    const body = source.match(/function handleFormCancel[\s\S]*?\n {2}\}/)?.[0] ?? ''
    expect(body).toContain('resetTextSelection')
  })
})

describe('ContentPane anchor-text hover -> bubble highlight wiring (COMMENT-02 reverse direction)', () => {
  it("source imports offsetFromPoint from './hooks/offsetFromPoint'", () => {
    expect(source).toContain("from './hooks/offsetFromPoint'")
  })

  it('source has onMouseMove= handler on the content wrapper', () => {
    expect(source).toContain('onMouseMove=')
  })

  it('source has onMouseLeave= handler on the content wrapper', () => {
    expect(source).toContain('onMouseLeave=')
  })

  it('source calls offsetFromPoint( with arguments', () => {
    expect(source).toContain('offsetFromPoint(')
  })

  it('source invokes onHoverCommentId (not just declares it)', () => {
    expect(source).toContain('onHoverCommentId(')
  })

  it('source contains range containment check against anchorStart', () => {
    expect(source).toMatch(/offset >= [a-zA-Z]+\.anchorStart/)
  })

  it('source contains half-open interval check against anchorEnd', () => {
    expect(source).toMatch(/offset < [a-zA-Z]+\.anchorEnd/)
  })

  it('source uses e.clientX for cursor coordinates', () => {
    expect(source).toContain('e.clientX')
  })

  it('source uses e.clientY for cursor coordinates', () => {
    expect(source).toContain('e.clientY')
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
