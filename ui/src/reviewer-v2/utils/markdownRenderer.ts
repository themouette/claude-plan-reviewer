import { marked, type Token, type Tokens } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import DOMPurify from 'dompurify'

// Module-level flag: ensures marked.use() is called at most once, regardless
// of how many times renderMarkdown() is called or how modules are split/loaded.
let configured = false

// Module-level Map reset at the start of each renderMarkdown() call.
// CRITICAL: must be module-level (not local) because marked.use() registers
// the heading renderer once and the function closure reads this variable.
let headingSlugCounts: Map<string, number> = new Map()

/**
 * Recursively extract raw text from a token tree, concatenating all raw values.
 * Used by the heading renderer to get the plain-text content of a heading
 * before slugifying it into an id attribute.
 */
export function extractRawText(tokens: Token[]): string {
  return tokens
    .map((t) => ('tokens' in t && t.tokens ? extractRawText(t.tokens as Token[]) : t.raw ?? ''))
    .join('')
}

/**
 * Convert a string to a URL-safe slug for use as an HTML id attribute.
 * Lowercases, trims, replaces whitespace runs with hyphens, strips non-alphanumeric chars.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

/**
 * Render a markdown string to HTML using marked with GFM and highlight.js.
 *
 * Configuration (marked.use calls) runs only on the first call — the
 * module-level `configured` flag prevents double-registration that would
 * cause highlight.js code blocks to appear as double-wrapped or mis-tokenized.
 *
 * Each call resets headingSlugCounts so duplicate-id suffixes are scoped
 * per-call and do not drift across multiple renderMarkdown() invocations.
 */
export function renderMarkdown(md: string): string {
  if (!configured) {
    configured = true
    marked.use(markedHighlight({
      langPrefix: 'hljs language-',
      highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext'
        return hljs.highlight(code, { language }).value
      },
    }))
    marked.use({ gfm: true })
    // Heading renderer registered once; reads headingSlugCounts (reset per call below).
    // CRITICAL: regular method (not arrow function) — this.parser requires `this` binding.
    marked.use({
      renderer: {
        heading({ tokens, depth }: Tokens.Heading) {
          const rawText = extractRawText(tokens)
          const baseSlug = slugify(rawText) || `section-${depth}`
          const count = headingSlugCounts.get(baseSlug) ?? 0
          headingSlugCounts.set(baseSlug, count + 1)
          const id = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`
          const innerHTML = this.parser.parseInline(tokens)
          return `<h${depth} id="${id}">${innerHTML}</h${depth}>\n`
        }
      }
    })
  }
  // Reset per-call state BEFORE parsing so duplicate-id counters don't drift across calls.
  headingSlugCounts = new Map()
  const rawHtml = marked.parse(md)
  if (rawHtml instanceof Promise) {
    throw new Error(
      'renderMarkdown: marked.parse() returned a Promise. ' +
        'An async walkTokens was registered. Disable async mode or refactor to async.',
    )
  }
  return DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['class'], // preserve highlight.js class attributes
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
  })
}
