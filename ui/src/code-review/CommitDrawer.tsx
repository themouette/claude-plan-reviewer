import type { Commit } from './types'

export interface CommitDrawerProps {
  commits: Commit[]
  loading: boolean
  error: string | null
  activeCommitSha: string | null
  checkedCommitShas: string[]
  onCommitClick: (sha: string) => void
  onCheckChange: (sha: string, checked: boolean) => void
}

export default function CommitDrawer({
  commits,
  loading,
  error,
  activeCommitSha,
  checkedCommitShas,
  onCommitClick,
  onCheckChange,
}: CommitDrawerProps): React.JSX.Element {
  function renderBody() {
    // State 1: Loading (no commits yet)
    if (loading && commits.length === 0) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            minHeight: 200,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              border: '2px solid var(--color-border)',
              borderTopColor: 'var(--color-focus)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      )
    }

    // State 2: Error
    if (error !== null) {
      return (
        <div
          style={{
            padding: '48px 32px',
            textAlign: 'center',
            color: 'var(--color-accent-deny)',
            fontSize: 14,
          }}
        >
          {'Could not load commits. Check server connection and reload.'}
        </div>
      )
    }

    // State 3: Empty (no commits)
    if (commits.length === 0) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '48px 32px',
            textAlign: 'center',
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              margin: '0 0 8px',
            }}
          >
            {'No commits on this branch'}
          </h2>
          <p
            style={{
              fontSize: 14,
              color: 'var(--color-text-secondary)',
              margin: 0,
              maxWidth: 280,
            }}
          >
            {'This branch has no commits beyond the base branch.'}
          </p>
        </div>
      )
    }

    // State 4: Commit list
    return (
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {commits.map((commit) => {
          const isActive = commit.sha === activeCommitSha
          const isChecked = checkedCommitShas.includes(commit.sha)

          return (
            <li
              key={commit.sha}
              role="button"
              tabIndex={0}
              onClick={() => onCommitClick(commit.sha)}
              onKeyDown={(e) => { if (e.key === 'Enter') onCommitClick(commit.sha) }}
              style={{
                padding: '8px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                cursor: 'pointer',
                borderLeft: isActive ? '2px solid var(--color-focus)' : '2px solid transparent',
                background: isActive ? 'var(--color-bg)' : 'transparent',
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {/* Line 1: checkbox + SHA chip + message */}
              <div style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    e.stopPropagation()
                    onCheckChange(commit.sha, e.target.checked)
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <span
                  style={{
                    fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
                    fontSize: 12,
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: '1px solid var(--color-border)',
                    background: 'rgba(59,130,246,0.12)',
                    color: 'var(--color-text-secondary)',
                    flexShrink: 0,
                  }}
                >
                  {commit.short_sha}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 14,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={commit.message}
                >
                  {commit.message}
                </span>
              </div>
              {/* Line 2: author · date */}
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {commit.author} · {commit.date}
              </div>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <aside
      role="navigation"
      aria-label="Branch commits"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 296,
        height: '100%',
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          color: 'var(--color-text-secondary)',
          padding: '8px 16px',
          flexShrink: 0,
        }}
      >
        {'COMMITS'}
      </div>
      {renderBody()}
    </aside>
  )
}
