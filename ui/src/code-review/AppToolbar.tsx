import { useState } from 'react'

export interface AppToolbarProps {
  diffStyle: 'unified' | 'split'
  contextExpanded: boolean
  contextLoading: boolean
  onDiffStyleChange: (style: 'unified' | 'split') => void
  onExpandAll: () => void
}

export default function AppToolbar({
  diffStyle,
  contextExpanded,
  contextLoading,
  onDiffStyleChange,
  onExpandAll,
}: AppToolbarProps): React.JSX.Element {
  const [focusedButton, setFocusedButton] = useState<string | null>(null)

  function makeFocusHandlers(id: string) {
    return {
      onFocus: (e: React.FocusEvent<HTMLButtonElement>) => {
        setFocusedButton(id)
        e.currentTarget.style.outline = '2px solid var(--color-focus)'
        e.currentTarget.style.outlineOffset = '2px'
      },
      onBlur: (e: React.FocusEvent<HTMLButtonElement>) => {
        setFocusedButton(null)
        e.currentTarget.style.outline = 'none'
      },
    }
  }

  // suppress unused variable warning — focusedButton used for tracking only
  void focusedButton

  return (
    <header
      style={{
        height: 48,
        flexShrink: 0,
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      {/* Left: title */}
      <span
        style={{
          fontSize: 14,
          fontWeight: 400,
          color: 'var(--color-text-secondary)',
        }}
      >
        Code Review
      </span>

      {/* Right: controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Reserved: help / GitHub / theme — empty in Phase 25 (D-03) */}
        <div />

        {/* Layout toggle: Unified | Side-by-side */}
        <div
          style={{
            display: 'flex',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
          }}
        >
          {(['unified', 'split'] as const).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => onDiffStyleChange(style)}
              style={{
                height: 32,
                padding: '0 12px',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                cursor: 'pointer',
                outline: 'none',
                background:
                  diffStyle === style ? 'var(--color-surface)' : 'transparent',
                color:
                  diffStyle === style
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-secondary)',
                fontWeight: diffStyle === style ? 600 : 400,
              }}
              {...makeFocusHandlers(`layout-${style}`)}
            >
              {style === 'unified' ? 'Unified' : 'Side-by-side'}
            </button>
          ))}
        </div>

        {/* Expand All / Collapse / Loading */}
        <button
          type="button"
          onClick={onExpandAll}
          disabled={contextLoading}
          style={{
            height: 32,
            padding: '0 16px',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            fontSize: 14,
            cursor: contextLoading ? 'default' : 'pointer',
            outline: 'none',
            background: 'var(--color-surface)',
            color: contextExpanded
              ? 'var(--color-text-primary)'
              : 'var(--color-text-secondary)',
            fontWeight: contextExpanded ? 600 : 400,
          }}
          {...makeFocusHandlers('expand')}
        >
          {contextLoading ? 'Loading...' : contextExpanded ? 'Collapse' : 'Expand All'}
        </button>
      </div>
    </header>
  )
}
