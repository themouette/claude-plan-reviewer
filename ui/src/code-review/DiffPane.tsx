import { Fragment, useMemo, useState } from 'react'
import { FileDiff as FileDiffComponent, PatchDiff } from '@pierre/diffs/react'
import { parseDiffFromFile } from '@pierre/diffs'
import type { FileDiff, Commit } from './types'

// Theme read once at module scope (D-12 — no listener, stable across re-renders)
// T-25-WIN: typeof guard covers SSR / test environments where matchMedia may be absent
const DIFF_THEME: 'github-dark' | 'github-light' =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'github-dark'
    : 'github-light'

// Renders one file diff. Uses FileDiffComponent (non-partial, expansion enabled) when
// old_content + new_content are present; falls back to PatchDiff for binary files.
function FileDiffRenderer({
  file,
  diffStyle,
}: {
  file: FileDiff
  diffStyle: 'unified' | 'split'
}) {
  const fileDiffMetadata = useMemo(() => {
    if (file.old_content === undefined || file.new_content === undefined) return null
    return parseDiffFromFile(
      { name: file.previous_filename ?? file.filename, contents: file.old_content },
      { name: file.filename, contents: file.new_content },
    )
  }, [file.filename, file.previous_filename, file.old_content, file.new_content])

  if (fileDiffMetadata) {
    return (
      <FileDiffComponent
        fileDiff={fileDiffMetadata}
        disableWorkerPool={true}
        options={{ diffStyle, expansionLineCount: 10, collapsedContextThreshold: 3, theme: DIFF_THEME }}
      />
    )
  }
  return (
    <PatchDiff
      patch={file.patch}
      disableWorkerPool={true}
      options={{ diffStyle, theme: DIFF_THEME }}
    />
  )
}

export interface DiffPaneProps {
  files: FileDiff[]
  loading: boolean
  error: string | null
  diffStyle: 'unified' | 'split'
  diffPaneRef: React.RefObject<HTMLDivElement | null> // ref-forwarding via prop, NOT React.forwardRef
  onReload: () => void // wired to error state's "Reload Diff" button
  // Phase 26 additions — all optional; default values preserve existing call sites
  viewMode?: 'branch' | 'commit'  // default 'branch'
  activeCommitSha?: string | null // default null
  commits?: Commit[]              // default [] — for title strip lookup
  // Phase 26.2 D-05 additions — optional; default values preserve existing call sites
  allSelected?: boolean  // default false — when true + branchName set, renders "diff from branch" label
  branchName?: string    // default '' — branch label shown when allSelected is true
}

export default function DiffPane({
  files,
  loading,
  error,
  diffStyle,
  diffPaneRef,
  onReload,
  viewMode = 'branch',
  activeCommitSha = null,
  commits = [],
  allSelected = false,
  branchName = '',
}: DiffPaneProps): React.JSX.Element {
  const [reloadFocused, setReloadFocused] = useState(false)

  // Lookup the active commit for per-commit title strip (D-06)
  const activeCommit =
    viewMode === 'commit' && activeCommitSha !== null
      ? (commits.find((c) => c.sha === activeCommitSha) ?? null)
      : null

  // suppress unused variable warning
  void reloadFocused

  function renderContent() {
    // State 1: Loading (no files yet)
    if (loading && files.length === 0) {
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
              color: 'var(--color-accent-deny)',
              margin: '0 0 12px',
            }}
          >
            Could not load diff
          </h2>
          <p
            style={{
              fontSize: 14,
              color: 'var(--color-text-secondary)',
              margin: '0 0 16px',
              maxWidth: 400,
            }}
          >
            The server returned an error. Check that the repository has a main branch and try
            reloading.
          </p>
          <button
            type="button"
            onClick={onReload}
            style={{
              height: 32,
              padding: '0 16px',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontWeight: 400,
              outline: 'none',
            }}
            onFocus={(e) => {
              setReloadFocused(true)
              e.currentTarget.style.outline = '2px solid var(--color-focus)'
              e.currentTarget.style.outlineOffset = '2px'
            }}
            onBlur={(e) => {
              setReloadFocused(false)
              e.currentTarget.style.outline = 'none'
            }}
          >
            Reload Diff
          </button>
        </div>
      )
    }

    // State 3: Empty (no files)
    if (files.length === 0) {
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
            No changes on this branch
          </h2>
          <p
            style={{
              fontSize: 14,
              color: 'var(--color-text-secondary)',
              margin: 0,
              maxWidth: 400,
            }}
          >
            This branch has no uncommitted or unpushed changes compared to main.
          </p>
        </div>
      )
    }

    // State 4: Diff content
    return (
      <>
        {files.map((file, index) => (
          <Fragment key={`${file.filename}-${index}`}>
            {/* Anchor div — scroll target and IntersectionObserver target (D-09) */}
            <div id={`file-${index}`} aria-label={file.filename} />

            {/* File header */}
            <div
              style={{
                background: 'var(--color-surface)',
                borderBottom: '1px solid var(--color-border)',
                padding: '8px 16px',
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                }}
              >
                {file.filename.split('/').pop() ?? file.filename}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: 'var(--color-text-secondary)',
                  marginLeft: 8,
                }}
              >
                {file.filename}
              </span>
            </div>

            {/* Binary file guard (Pitfall 5) */}
            {file.patch === '[binary file]' ? (
              <div
                style={{
                  padding: 16,
                  color: 'var(--color-text-secondary)',
                  fontSize: 14,
                }}
              >
                Binary file — no diff available
              </div>
            ) : (
              <FileDiffRenderer file={file} diffStyle={diffStyle} />
            )}
          </Fragment>
        ))}
      </>
    )
  }

  return (
    <div
      ref={diffPaneRef}
      style={{
        flex: 1,
        minWidth: 0,
        background: 'var(--color-bg)',
        overflowY: 'auto',
        padding: 0,
      }}
    >
      {/* Per-commit title strip (D-06) — renders above content when viewMode === 'commit' and commit is found */}
      {viewMode === 'commit' && activeCommitSha !== null && activeCommit !== null && (
        <div
          style={{
            background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            padding: '8px 16px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            {activeCommit.short_sha} — {activeCommit.message}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              marginTop: 2,
            }}
          >
            {activeCommit.author} · {activeCommit.date}
          </div>
        </div>
      )}
      {/* WR-04: Fallback strip when activeCommitSha is not found in commits list */}
      {viewMode === 'commit' && activeCommitSha !== null && activeCommit === null && (
        <div
          style={{
            background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            padding: '8px 16px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            {activeCommitSha.slice(0, 7)}
          </div>
        </div>
      )}
      {/* D-05: All-selected branch label — renders when all commits selected */}
      {allSelected && branchName.length > 0 && (
        <div
          style={{
            background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            padding: '8px 16px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            {`diff from branch ${branchName}`}
          </div>
        </div>
      )}
      {renderContent()}
    </div>
  )
}
