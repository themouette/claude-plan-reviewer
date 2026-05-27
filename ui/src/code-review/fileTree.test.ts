import { describe, it, expect } from 'vitest'
import { buildTree, flattenTree, type FileNode, type DirNode } from './fileTree'
import type { FileDiff } from './types'

function makeFile(filename: string): FileDiff {
  return { filename, status: 'modified', additions: 1, deletions: 1, changes: 2, patch: '' }
}

describe('buildTree', () => {
  it('single root file produces one FileNode', () => {
    const tree = buildTree([makeFile('README.md')])
    expect(tree).toHaveLength(1)
    expect(tree[0].kind).toBe('file')
    const node = tree[0] as FileNode
    expect(node.index).toBe(0)
    expect(node.basename).toBe('README.md')
    expect(node.file.filename).toBe('README.md')
  })

  it('compresses single-child dirs: domains/service/hello with file + subdir', () => {
    const files = [
      makeFile('domains/service/hello/config.ts'),
      makeFile('domains/service/hello/routes/index.ts'),
    ]
    const tree = buildTree(files)
    expect(tree).toHaveLength(1)
    const dir = tree[0] as DirNode
    expect(dir.kind).toBe('dir')
    expect(dir.label).toBe('domains/service/hello')
    expect(dir.path).toBe('domains/service/hello')
    // dirs first, files second
    expect(dir.children).toHaveLength(2)
    expect(dir.children[0].kind).toBe('dir')
    expect((dir.children[0] as DirNode).label).toBe('routes')
    expect(dir.children[1].kind).toBe('file')
    expect((dir.children[1] as FileNode).basename).toBe('config.ts')
  })

  it('stops compression at fork (>=2 subdirs)', () => {
    const files = [makeFile('src/a/foo.ts'), makeFile('src/b/bar.ts')]
    const tree = buildTree(files)
    expect(tree).toHaveLength(1)
    const dir = tree[0] as DirNode
    expect(dir.label).toBe('src')
    expect(dir.children).toHaveLength(2)
    expect(dir.children.every(n => n.kind === 'dir')).toBe(true)
  })

  it('stops compression when dir has both a file and a subdir', () => {
    const files = [makeFile('src/index.ts'), makeFile('src/lib/util.ts')]
    const tree = buildTree(files)
    expect(tree).toHaveLength(1)
    const dir = tree[0] as DirNode
    expect(dir.label).toBe('src')
    // dirs first, files second
    expect(dir.children[0].kind).toBe('dir')
    expect(dir.children[1].kind).toBe('file')
  })

  it('preserves original file index', () => {
    const files = [makeFile('b.ts'), makeFile('a.ts')]
    const tree = buildTree(files)
    const fileNodes = tree.filter(n => n.kind === 'file') as FileNode[]
    expect(fileNodes.find(n => n.basename === 'b.ts')!.index).toBe(0)
    expect(fileNodes.find(n => n.basename === 'a.ts')!.index).toBe(1)
  })

  it('orders dirs before files in children', () => {
    const files = [makeFile('src/index.ts'), makeFile('src/lib/util.ts')]
    const srcDir = (buildTree(files)[0] as DirNode)
    expect(srcDir.children[0].kind).toBe('dir')
    expect(srcDir.children[1].kind).toBe('file')
  })

  it('root-level files produce FileNodes without wrapping dir', () => {
    const files = [makeFile('a.ts'), makeFile('b.ts')]
    const tree = buildTree(files)
    expect(tree).toHaveLength(2)
    expect(tree.every(n => n.kind === 'file')).toBe(true)
  })

  it('mixed root files and dirs: dirs come first', () => {
    const files = [makeFile('README.md'), makeFile('src/index.ts')]
    const tree = buildTree(files)
    expect(tree).toHaveLength(2)
    expect(tree[0].kind).toBe('dir')
    expect(tree[1].kind).toBe('file')
  })
})

describe('flattenTree', () => {
  it('returns files in tree render order (dirs before files at each level)', () => {
    // git diff order: README.md (0), src/index.ts (1), src/lib/util.ts (2)
    // tree order: src/ dir → src/lib/util.ts, src/index.ts, then README.md
    const files = [makeFile('README.md'), makeFile('src/index.ts'), makeFile('src/lib/util.ts')]
    const flat = flattenTree(buildTree(files))
    expect(flat.map((n) => n.file.filename)).toEqual([
      'src/lib/util.ts',
      'src/index.ts',
      'README.md',
    ])
  })

  it('reordering by flattenTree index produces tree-stable sort', () => {
    // git diff order scrambles files across dirs
    const files = [makeFile('src/main.rs'), makeFile('ui/App.tsx'), makeFile('src/lib.rs')]
    const flat = flattenTree(buildTree(files))
    expect(flat.map((n) => n.file.filename)).toEqual(['src/main.rs', 'src/lib.rs', 'ui/App.tsx'])
  })

  it('round-trips: buildTree(sortedFiles) produces same filenames in same order', () => {
    const files = [makeFile('src/main.rs'), makeFile('ui/App.tsx'), makeFile('src/lib.rs')]
    const sortedFiles = flattenTree(buildTree(files)).map((n) => n.file)
    const flat2 = flattenTree(buildTree(sortedFiles))
    expect(flat2.map((n) => n.file.filename)).toEqual(sortedFiles.map((f) => f.filename))
  })
})
