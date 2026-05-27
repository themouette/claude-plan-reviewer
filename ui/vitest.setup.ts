import { vi } from 'vitest'

// window.matchMedia — not implemented in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// IntersectionObserver — not implemented in jsdom
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}))

// ResizeObserver — not implemented in jsdom
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// CSS Custom Highlight API — not implemented in jsdom
if (typeof CSS === 'undefined') {
  ;(global as unknown as { CSS: object }).CSS = {}
}
if (!(CSS as { highlights?: unknown }).highlights) {
  ;(CSS as { highlights: unknown }).highlights = new Map()
}

// Highlight constructor — not implemented in jsdom
if (typeof (global as unknown as { Highlight?: unknown }).Highlight === 'undefined') {
  ;(global as unknown as { Highlight: unknown }).Highlight = class Highlight {
    ranges: Range[]
    constructor(...ranges: Range[]) {
      this.ranges = ranges
    }
  }
}
