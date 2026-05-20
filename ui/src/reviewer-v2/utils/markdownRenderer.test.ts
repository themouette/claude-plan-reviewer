import { describe, it, expect } from 'vitest'
import { renderMarkdown, slugify, extractRawText } from './markdownRenderer'

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

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('My Heading')).toBe('my-heading')
  })

  it('strips special characters leaving alphanumerics and hyphens', () => {
    expect(slugify('**Bold** Title')).toBe('bold-title')
  })

  it('trims surrounding whitespace before slugifying', () => {
    expect(slugify('  Trim Me  ')).toBe('trim-me')
  })
})

describe('renderMarkdown heading ids', () => {
  it('injects id attribute on h1', () => {
    const result = renderMarkdown('# My Heading')
    expect(result).toContain('id="my-heading"')
  })

  it('duplicate headings get numeric suffix starting at -2', () => {
    const result = renderMarkdown('# Hello World\n## Hello World')
    expect(result).toContain('id="hello-world"')
    expect(result).toContain('id="hello-world-2"')
  })

  it('slug counter resets between renderMarkdown calls (no cross-call drift)', () => {
    renderMarkdown('# Foo')
    const second = renderMarkdown('# Foo')
    // Second independent call: first occurrence should be "foo", not "foo-2"
    expect(second).toContain('id="foo"')
    expect(second).not.toContain('id="foo-2"')
  })

  it('bold inside heading produces id without asterisks', () => {
    const result = renderMarkdown('## **Bold** Section')
    expect(result).toContain('id="bold-section"')
  })
})
