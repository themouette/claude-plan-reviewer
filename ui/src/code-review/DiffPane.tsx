import { Fragment, useMemo, useState } from 'react'
import { FileDiff as FileDiffComponent, PatchDiff } from '@pierre/diffs/react'
import { parseDiffFromFile } from '@pierre/diffs'
import type { DiffLineAnnotation, AnnotationSide } from '@pierre/diffs'
import type { FileDiff, Commit, CodeReviewComment } from './types'
import HunkCommentForm from './HunkCommentForm'
import CommentBubble from './CommentBubble'

// Theme read once at module scope (D-12 — no listener, stable across re-renders)
// T-25-WIN: typeof guard covers SSR / test environments where matchMedia may be absent
const DIFF_THEME: 'github-dark' | 'github-light' =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'github-dark'
    : 'github-light'

// Renders one file diff. Uses FileDiffComponent (non-partial, expansion enabled) when
// old_content + new_content are present; falls back to PatchDiff for binary files.
// contextExpanded maps to Pierre's expandUnchanged — when true, all context lines are shown.
// For the PatchDiff path, the parent refetches with context=999 instead.
function FileDiffRenderer({
  file,
  diffStyle,
  contextExpanded,
  comments,
  onAddLineComment,
  onEditComment,
  onDeleteComment,
  pendingLineAnchor,
  setPendingLineAnchor,
}: {
  file: FileDiff
  diffStyle: 'unified' | 'split'
  contextExpanded: boolean
  comments: CodeReviewComment[]
  onAddLineComment?: (file: string, lineNumber: number, side: 'additions' | 'deletions', text: string) => void
  onEditComment?: (id: string, text: string) => void
  onDeleteComment?: (id: string) => void
  pendingLineAnchor: { file: string; lineNumber: number; side: AnnotationSide } | null
  setPendingLineAnchor: (anchor: { file: string; lineNumber: number; side: AnnotationSide } | null) => void
}) {
  const fileDiffMetadata = useMemo(() => {
    if (file.old_content === undefined || file.new_content === undefined) return null
    return parseDiffFromFile(
      { name: file.previous_filename ?? file.filename, contents: file.old_content },
      { name: file.filename, contents: file.new_content },
    )
  }, [file.filename, file.previous_filename, file.old_content, file.new_content])

  if (fileDiffMetadata) {
    // Build lineAnnotations from submitted line comments for this file
    const submittedLineAnnotations: DiffLineAnnotation<{ commentId: string }>[] = comments
      .filter((c): c is Extract<CodeReviewComment, { type: 'line' }> => c.type === 'line' && c.file === file.filename)
      .map((c) => ({ side: c.side, lineNumber: c.lineNumber, metadata: { commentId: c.id } }))

    // Append pending sentinel when this file has an open line-comment form
    const lineAnnotations: DiffLineAnnotation<{ commentId: string }>[] = [
      ...submittedLineAnnotations,
      ...(pendingLineAnchor?.file === file.filename
        ? [{ side: pendingLineAnchor.side, lineNumber: pendingLineAnchor.lineNumber, metadata: { commentId: '__pending__' } }]
        : []),
    ]

    return (
      <FileDiffComponent
        fileDiff={fileDiffMetadata}
        disableWorkerPool={true}
        options={{
          diffStyle,
          expansionLineCount: 10,
          collapsedContextThreshold: 3,
          theme: DIFF_THEME,
          disableFileHeader: true,
          expandUnchanged: contextExpanded,
          enableGutterUtility: true,
        }}
        lineAnnotations={lineAnnotations}
        renderAnnotation={(ann) => {
          if (ann.metadata?.commentId === '__pending__') {
            return (
              <HunkCommentForm
                onSubmit={(text) => {
                  onAddLineComment?.(file.filename, ann.lineNumber, ann.side, text)
                  setPendingLineAnchor(null)
                }}
                onCancel={() => setPendingLineAnchor(null)}
              />
            )
          }
          const c = comments.find((c) => c.id === ann.metadata?.commentId)
          if (!c || c.type !== 'line') return null
          return (
            <CommentBubble
              comment={c}
              onEdit={(text) => onEditComment?.(c.id, text)}
              onDelete={() => onDeleteComment?.(c.id)}
            />
          )
        }}
        renderGutterUtility={(getHoveredLine) => (
          <button
            type="button"
            aria-label="Add comment to this line"
            onClick={() => {
              const hovered = getHoveredLine()
              if (!hovered) return
              setPendingLineAnchor({ file: file.filename, lineNumber: hovered.lineNumber, side: hovered.side })
            }}
            style={{
              width: 20,
              height: 20,
              background: 'transparent',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            +
          </button>
        )}
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
  // Phase 26.2 D-07/D-09 additions — optional; default values preserve existing call sites
  collapsedFiles?: Set<string>              // default new Set() — filenames that are collapsed
  onToggleFile?: (filename: string) => void // default undefined — callback to toggle collapse
  contextExpanded?: boolean                 // default false — when true, all context lines shown
  // Prev/next navigation when a single commit is shown
  hasPrevCommit?: boolean
  hasNextCommit?: boolean
  onPrevCommit?: () => void
  onNextCommit?: () => void
  // Subset summary shown when 1 < selected < total commits
  selectedCommits?: Commit[]
  onClearSelection?: () => void
  // Phase 27 additions — all optional; default values preserve existing call sites until 27-03 wires them
  comments?: CodeReviewComment[]
  onAddLineComment?: (file: string, lineNumber: number, side: 'additions' | 'deletions', text: string) => void
  onAddFileComment?: (file: string, text: string) => void
  onEditComment?: (id: string, text: string) => void
  onDeleteComment?: (id: string) => void
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
  collapsedFiles = new Set<string>(),
  onToggleFile,
  contextExpanded = false,
  hasPrevCommit = false,
  hasNextCommit = false,
  onPrevCommit,
  onNextCommit,
  selectedCommits = [],
  onClearSelection,
  comments = [],
  onAddLineComment,
  onAddFileComment,
  onEditComment,
  onDeleteComment,
}: DiffPaneProps): React.JSX.Element {
  // Phase 27: local state for pending annotation anchors (Pattern 4 Option A — DiffPane-local)
  const [pendingLineAnchor, setPendingLineAnchor] = useState<{ file: string; lineNumber: number; side: AnnotationSide } | null>(null)
  const [pendingFileComment, setPendingFileComment] = useState<string | null>(null)

  // Lookup the active commit for per-commit title strip (D-06)
  const activeCommit =
    viewMode === 'commit' && activeCommitSha !== null
      ? (commits.find((c) => c.sha === activeCommitSha) ?? null)
      : null

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
              e.currentTarget.style.outline = '2px solid var(--color-focus)'
              e.currentTarget.style.outlineOffset = '2px'
            }}
            onBlur={(e) => {
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
        {/* D-09: Global stats strip — rendered once above all files, NOT inside the map */}
        <div
          style={{
            background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            padding: '6px 16px',
            flexShrink: 0,
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            display: 'flex',
            gap: 16,
          }}
        >
          <span>{files.length === 1 ? '1 file changed' : `${files.length} files changed`}</span>
          <span style={{ color: 'var(--color-accent-approve)' }}>+{files.reduce((s, f) => s + f.additions, 0)}</span>
          <span style={{ color: 'var(--color-accent-deny)' }}>−{files.reduce((s, f) => s + f.deletions, 0)}</span>
        </div>

        {files.map((file, index) => {
          const isCollapsed = collapsedFiles?.has(file.filename) ?? false
          const fileComments = comments.filter((c) => c.type === 'file' && c.file === file.filename)
          // CR-01: wraps onToggleFile to clear stale pendingFileComment when collapsing
          function handleToggleFile() {
            if (!isCollapsed) {
              // file is currently expanded — about to be collapsed; clear pending form
              setPendingFileComment((prev) => (prev === file.filename ? null : prev))
            }
            onToggleFile?.(file.filename)
          }
          return (
            <Fragment key={file.filename}>
              {/* Anchor div — scroll target and IntersectionObserver target (D-09); stays outside collapse so jump-to works when file is collapsed */}
              <div id={`file-${index}`} aria-label={file.filename} />

              {/* D-07: File header — acts as collapse toggle with chevron */}
              <div
                role="button"
                tabIndex={0}
                aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${file.filename}`}
                aria-expanded={!isCollapsed}
                onClick={handleToggleFile}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleToggleFile()
                  }
                }}
                style={{
                  background: 'var(--color-surface)',
                  borderBottom: '1px solid var(--color-border)',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {/* D-07: Chevron indicating collapsed/expanded state */}
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--color-text-secondary)',
                    marginRight: 8,
                  }}
                >
                  {isCollapsed ? '▶' : '▼'}
                </span>
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
                {file.additions + file.deletions > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: 12, flexShrink: 0, display: 'flex', gap: 6 }}>
                    <span style={{ color: 'var(--color-accent-approve)' }}>+{file.additions}</span>
                    <span style={{ color: 'var(--color-accent-deny)' }}>−{file.deletions}</span>
                  </span>
                )}
                {/* Phase 27 D-03: File-level comment trigger button */}
                <button
                  type="button"
                  aria-label="Add file-level comment"
                  onClick={(e) => {
                    e.stopPropagation()
                    // CR-01: auto-expand so the form renders immediately
                    if (isCollapsed) {
                      onToggleFile?.(file.filename)
                    }
                    setPendingFileComment(file.filename)
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.outline = '2px solid var(--color-focus)'
                    e.currentTarget.style.outlineOffset = '2px'
                  }}
                  onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
                  style={{
                    height: 24,
                    padding: '0 8px',
                    fontSize: 12,
                    fontWeight: 400,
                    background: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    marginLeft: 8,
                  }}
                >
                  + Comment
                </button>
              </div>

              {/* D-07: File body — hidden when collapsed */}
              {!isCollapsed && (
                <>
                  {/* Phase 27: File-level submitted comments — rendered between header and diff body */}
                  {fileComments.length > 0 && (
                    <div style={{ padding: '8px 16px', background: 'var(--color-bg)' }}>
                      {fileComments.map((c) => (
                        <CommentBubble
                          key={c.id}
                          comment={c}
                          onEdit={(text) => onEditComment?.(c.id, text)}
                          onDelete={() => onDeleteComment?.(c.id)}
                        />
                      ))}
                    </div>
                  )}
                  {/* Phase 27: Pending file-level comment form */}
                  {pendingFileComment === file.filename && (
                    <div style={{ padding: '8px 16px', background: 'var(--color-bg)' }}>
                      <HunkCommentForm
                        onSubmit={(text) => {
                          onAddFileComment?.(file.filename, text)
                          setPendingFileComment(null)
                        }}
                        onCancel={() => setPendingFileComment(null)}
                      />
                    </div>
                  )}
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
                    <FileDiffRenderer
                      file={file}
                      diffStyle={diffStyle}
                      contextExpanded={contextExpanded}
                      comments={comments}
                      onAddLineComment={onAddLineComment}
                      onEditComment={onEditComment}
                      onDeleteComment={onDeleteComment}
                      pendingLineAnchor={pendingLineAnchor}
                      setPendingLineAnchor={setPendingLineAnchor}
                    />
                  )}
                </>
              )}
            </Fragment>
          )
        })}
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
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              type="button"
              disabled={!hasPrevCommit}
              onClick={onPrevCommit}
              style={{
                height: 24,
                padding: '0 10px',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                fontSize: 12,
                cursor: hasPrevCommit ? 'pointer' : 'default',
                background: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
                opacity: hasPrevCommit ? 1 : 0.4,
                outline: 'none',
              }}
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={!hasNextCommit}
              onClick={onNextCommit}
              style={{
                height: 24,
                padding: '0 10px',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                fontSize: 12,
                cursor: hasNextCommit ? 'pointer' : 'default',
                background: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
                opacity: hasNextCommit ? 1 : 0.4,
                outline: 'none',
              }}
            >
              Next →
            </button>
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
      {/* Subset summary — renders when 1 < selected < total */}
      {!allSelected && selectedCommits.length > 1 && (
        <div
          style={{
            background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            padding: '8px 16px',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {selectedCommits.length} commits selected
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {Object.entries(
              selectedCommits.reduce<Record<string, number>>((acc, c) => {
                acc[c.author] = (acc[c.author] ?? 0) + 1
                return acc
              }, {}),
            )
              .map(([author, count]) => (count > 1 ? `${author} (${count})` : author))
              .join(', ')}
          </div>
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={onClearSelection}
              style={{
                height: 24,
                padding: '0 10px',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer',
                background: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
                outline: 'none',
              }}
            >
              Clear selection
            </button>
          </div>
        </div>
      )}
      {renderContent()}
    </div>
  )
}
