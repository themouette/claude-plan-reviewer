import { vi } from 'vitest'

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
