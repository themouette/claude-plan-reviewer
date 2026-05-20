import ContentPane from './ContentPane'

export default function ReviewerV2Shell() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header strip — 48px fixed height */}
      <header
        style={{
          height: 48,
          flexShrink: 0,
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 16,
          paddingRight: 16,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: 'var(--color-text-secondary)',
          }}
        >
          Reviewer v2
        </span>
      </header>

      {/* 3-column body row — occupies the remaining viewport height */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>
        {/* Left column: Outline */}
        <aside
          style={{
            width: 200,
            flexShrink: 0,
            borderRight: '1px solid var(--color-border)',
            background: 'var(--color-bg)',
            overflowY: 'auto',
            padding: 16,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 400,
              color: 'var(--color-text-secondary)',
            }}
          >
            Outline
          </span>
        </aside>

        {/* Center column: Content */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--color-bg)',
            overflowY: 'auto',
            padding: 0,
          }}
        >
          <ContentPane />
        </main>

        {/* Right column: Comments */}
        <aside
          style={{
            width: 280,
            flexShrink: 0,
            borderLeft: '1px solid var(--color-border)',
            background: 'var(--color-bg)',
            overflowY: 'auto',
            padding: 16,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 400,
              color: 'var(--color-text-secondary)',
            }}
          >
            Comments
          </span>
        </aside>
      </div>
    </div>
  )
}
