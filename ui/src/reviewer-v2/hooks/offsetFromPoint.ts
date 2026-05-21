/**
 * Maps a (clientX, clientY) point to a character offset relative to `container`.
 *
 * Uses document.caretRangeFromPoint (WebKit/Blink) with a fallback to
 * document.caretPositionFromPoint (Firefox). Returns null if the caret resolves
 * to a node outside `container`, to a non-text node, or if neither API is available.
 *
 * The offset is computed by walking all text node descendants of `container` in
 * document order (via TreeWalker), summing their lengths until reaching the caret
 * node, then adding the node-local caret offset — mirroring the getRangeOffsets
 * approach in useTextSelection.ts.
 */
export function offsetFromPoint(
  container: HTMLElement,
  clientX: number,
  clientY: number,
): number | null {
  if (typeof document === 'undefined') return null

  let node: Node | null = null
  let nodeOffset = 0

  if (typeof document.caretRangeFromPoint === 'function') {
    const r = document.caretRangeFromPoint(clientX, clientY)
    node = r?.startContainer ?? null
    nodeOffset = r?.startOffset ?? 0
  } else if (typeof (document as { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null }).caretPositionFromPoint === 'function') {
    const cp = (document as { caretPositionFromPoint: (x: number, y: number) => { offsetNode: Node; offset: number } | null }).caretPositionFromPoint(clientX, clientY)
    node = cp?.offsetNode ?? null
    nodeOffset = cp?.offset ?? 0
  } else {
    return null
  }

  if (node === null || node.nodeType !== Node.TEXT_NODE) return null
  if (!container.contains(node)) return null

  // Walk text nodes within container in document order, summing character counts
  // until we find the target node, then add the node-local offset.
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let charCount = 0
  let current: Node | null
  while ((current = walker.nextNode())) {
    if (current === node) {
      return charCount + nodeOffset
    }
    charCount += (current.textContent?.length ?? 0)
  }

  // Node was not found in the TreeWalker walk (defensive — shouldn't happen if
  // container.contains(node) is true, but guard anyway).
  return null
}
