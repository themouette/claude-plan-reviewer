import { PatchDiff } from '@pierre/diffs/react'

interface DiffViewProps {
  diff: string
}

export function DiffView({ diff }: DiffViewProps) {
  if (!diff) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flexGrow: 1,
          padding: '32px',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginBottom: '12px',
          }}
        >
          No changes in working tree
        </h2>
        <p
          style={{
            fontSize: '16px',
            fontWeight: 400,
            color: 'var(--color-text-secondary)',
          }}
        >
          The working directory is clean. Nothing to diff.
        </p>
      </div>
    )
  }

  return (
    <div
      aria-label="Code diff view"
      style={{
        width: '100%',
        overflowX: 'auto',
        background: 'var(--color-code-bg)',
        borderRadius: '8px',
        padding: 0,
      }}
    >
      <PatchDiff
        patch={diff}
        disableWorkerPool={true}
        options={{ theme: 'pierre-dark' }}
      />
    </div>
  )
}
