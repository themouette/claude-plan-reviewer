import type { FileDiff } from './types'

export interface FileNode {
  kind: 'file'
  index: number
  file: FileDiff
  basename: string
}

export interface DirNode {
  kind: 'dir'
  label: string
  path: string
  children: TreeNode[]
}

export type TreeNode = FileNode | DirNode

interface TrieNode {
  files: Array<{ index: number; file: FileDiff; basename: string }>
  dirs: Map<string, TrieNode>
}

function insertFile(trie: TrieNode, segments: string[], index: number, file: FileDiff): void {
  if (segments.length === 1) {
    trie.files.push({ index, file, basename: segments[0] })
    return
  }
  const [head, ...rest] = segments
  let child = trie.dirs.get(head)
  if (!child) {
    child = { files: [], dirs: new Map() }
    trie.dirs.set(head, child)
  }
  insertFile(child, rest, index, file)
}

function compressDir(label: string, trie: TrieNode, path: string): DirNode {
  let currentLabel = label
  let currentPath = path
  let currentTrie = trie

  // Collapse single-child dirs that contain only one subdir and no files
  while (currentTrie.files.length === 0 && currentTrie.dirs.size === 1) {
    const entries = [...currentTrie.dirs]
    const [childSegment, childTrie] = entries[0]
    currentLabel = `${currentLabel}/${childSegment}`
    currentPath = `${currentPath}/${childSegment}`
    currentTrie = childTrie
  }

  return {
    kind: 'dir',
    label: currentLabel,
    path: currentPath,
    children: convertTrie(currentTrie, currentPath),
  }
}

function convertTrie(trie: TrieNode, basePath: string): TreeNode[] {
  const dirNodes: DirNode[] = []
  const fileNodes: FileNode[] = []

  for (const { index, file, basename } of trie.files) {
    fileNodes.push({ kind: 'file', index, file, basename })
  }

  for (const [segment, child] of trie.dirs) {
    const childPath = basePath ? `${basePath}/${segment}` : segment
    dirNodes.push(compressDir(segment, child, childPath))
  }

  return [...dirNodes, ...fileNodes]
}

export function flattenTree(nodes: TreeNode[]): FileNode[] {
  const result: FileNode[] = []
  for (const node of nodes) {
    if (node.kind === 'file') {
      result.push(node)
    } else {
      result.push(...flattenTree(node.children))
    }
  }
  return result
}

export function buildTree(files: FileDiff[]): TreeNode[] {
  const root: TrieNode = { files: [], dirs: new Map() }

  for (let i = 0; i < files.length; i++) {
    const segments = files[i].filename.split('/')
    insertFile(root, segments, i, files[i])
  }

  return convertTrie(root, '')
}
