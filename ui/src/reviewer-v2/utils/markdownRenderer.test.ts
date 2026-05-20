import { describe, it, expect } from 'vitest'
import { renderMarkdown } from './markdownRenderer'

describe('renderMarkdown', () => {
  it('renders headings: # Hello contains <h1', () => {
    const result = renderMarkdown('# Hello')
    expect(result).toContain('<h1')
  })

  it('renders GFM tables: pipe-table input contains <table', () => {
    const result = renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |')
    expect(result).toContain('<table')
  })

  it('renders GFM task lists: checkbox input contains type="checkbox"', () => {
    const result = renderMarkdown('- [ ] todo\n- [x] done')
    expect(result).toContain('type="checkbox"')
  })

  it('renders GFM strikethrough: ~~strike~~ contains <del', () => {
    const result = renderMarkdown('~~strike~~')
    expect(result).toContain('<del')
  })

  it('renders code blocks with highlight.js prefix: hljs language-js', () => {
    const result = renderMarkdown('```js\nconst x = 1\n```')
    expect(result).toContain('hljs language-js')
  })

  it('idempotency: calling renderMarkdown 3 times produces consistent output', () => {
    const input = '```js\nlet a = 1\n```'
    const first = renderMarkdown(input)
    renderMarkdown(input)
    const third = renderMarkdown(input)
    expect(third).toBe(first)
  })
})
