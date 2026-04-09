import type { Tab } from '../types'

interface TabBarProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'plan', label: 'Plan' },
    { id: 'diff', label: 'Diff' },
    { id: 'help', label: 'Help' },
  ]

  return (
    <div
      role="tablist"
      aria-label="View switcher"
      style={{
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
        height: '48px',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            style={{
              height: '48px',
              padding: '0 16px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '16px',
              outline: 'none',
              color: isActive ? 'var(--color-tab-active, #f1f5f9)' : 'var(--color-tab-inactive, #94a3b8)',
              fontWeight: isActive ? 600 : 400,
              borderBottom: isActive
                ? '2px solid var(--color-tab-active, #f1f5f9)'
                : '2px solid transparent',
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid var(--color-focus)'
              e.currentTarget.style.outlineOffset = '2px'
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none'
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
