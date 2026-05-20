import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

// Module-level flag: ensures marked.use() is called at most once, regardless
// of how many times renderMarkdown() is called or how modules are split/loaded.
let configured = false

/**
 * Render a markdown string to HTML using marked with GFM and highlight.js.
 *
 * Configuration (marked.use calls) runs only on the first call — the
 * module-level `configured` flag prevents double-registration that would
 * cause highlight.js code blocks to appear as double-wrapped or mis-tokenized.
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
  }
  return marked.parse(md) as string
}
