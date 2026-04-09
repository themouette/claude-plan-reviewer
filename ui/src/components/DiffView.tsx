import { FileDiff } from '@pierre/diffs/react'
import { parsePatchFiles } from '@pierre/diffs'

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

  const patches = parsePatchFiles(diff)
  const files = patches.flatMap((p) => p.files)

  if (files.length === 0) {
    return null
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
      {files.map((file, i) => (
        <FileDiff
          key={file.name ?? i}
          fileDiff={file}
          disableWorkerPool={true}
          options={{ theme: 'pierre-dark' }}
        />
      ))}
    </div>
  )
}
