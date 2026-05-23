import type { RefObject } from 'react'

// containerRef is accepted for type-symmetry with future hooks but is not read in this implementation
export default function GutterIcon({
  paragraph,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  containerRef: _containerRef,
  onAdd,
}: {
  paragraph: HTMLElement
  containerRef: RefObject<HTMLDivElement | null>
  onAdd: () => void
}): React.JSX.Element {
  const top = paragraph.offsetTop + paragraph.offsetHeight / 2 - 12

  return (
    <button
      aria-label="Add comment to paragraph"
      data-gutter-icon=""
      // CRITICAL (Pitfall 1): prevent mousedown from clearing selection before click fires
      onMouseDown={(e) => e.preventDefault()}
      onClick={onAdd}
      style={{
        position: 'absolute',
        top,
        right: -8,
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: 'var(--color-surface)',
        color: 'var(--color-focus)',
        border: 'none',
        cursor: 'pointer',
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '16px',
        opacity: 0.7,
      }}
      onMouseOver={(e) => { e.currentTarget.style.opacity = '1' }}
      onMouseOut={(e) => { e.currentTarget.style.opacity = '0.7' }}
      onFocus={(e) => {
        e.currentTarget.style.outline = '2px solid var(--color-focus)'
        e.currentTarget.style.outlineOffset = '2px'
      }}
      onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
    >
      +
    </button>
  )
}
