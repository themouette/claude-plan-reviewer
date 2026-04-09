import { useEffect, useState, type RefObject } from 'react'

export function useTextSelection(containerRef: RefObject<HTMLDivElement | null>): string {
  const [selectedText, setSelectedText] = useState<string>('')

  useEffect(() => {
    const handler = () => {
      const selection = document.getSelection()
      if (!selection || selection.isCollapsed) {
        setSelectedText('')
        return
      }

      // Guard: only track selections within the plan content container
      const range = selection.getRangeAt(0)
      if (!containerRef.current?.contains(range.commonAncestorContainer)) {
        setSelectedText('')
        return
      }

      const text = selection.toString().trim()
      setSelectedText(text)
    }

    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [containerRef])

  return selectedText
}
