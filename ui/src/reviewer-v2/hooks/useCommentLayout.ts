export const COMPACT_HEIGHT = 48
const GAP = 8
const PUSH_THRESHOLD = 40

export function computeCommentLayout(
  items: Array<{ id: string; anchorY: number; isExpanded: boolean; height: number }>,
): Array<{ id: string; top: number; isCompact: boolean }> {
  // 1. Process the focused (expanded) item first — it always snaps to its anchorY.
  //    Remaining items are sorted by anchorY ascending.
  const expanded = items.find((i) => i.isExpanded)
  const rest = items.filter((i) => !i.isExpanded).sort((a, b) => a.anchorY - b.anchorY)

  // Insert expanded item back in its anchorY position
  const sorted = [...rest]
  if (expanded) {
    const insertIdx = sorted.findIndex((i) => i.anchorY > expanded.anchorY)
    if (insertIdx === -1) sorted.push(expanded)
    else sorted.splice(insertIdx, 0, expanded)
  }

  const result: Array<{ id: string; top: number; isCompact: boolean }> = []
  let previousBottom = 0

  for (const item of sorted) {
    if (item.isExpanded) {
      // Expanded item snaps to anchorY regardless of previous placement
      const top = item.anchorY
      previousBottom = top + item.height + GAP
      result.push({ id: item.id, top, isCompact: false })
    } else {
      const idealTop = item.anchorY
      const top = Math.max(idealTop, previousBottom)
      const isCompact = top > idealTop + PUSH_THRESHOLD
      const height = COMPACT_HEIGHT
      previousBottom = top + height + GAP
      result.push({ id: item.id, top, isCompact })
    }
  }
  return result
}
