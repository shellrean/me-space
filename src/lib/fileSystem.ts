import { readDir, readTextFile, writeTextFile, mkdir, stat, exists, remove, rename as renamePath, watch } from '@tauri-apps/plugin-fs'
import { open } from '@tauri-apps/plugin-dialog'
import { basename, dirname, join } from '@tauri-apps/api/path'
import { DRAWING_EXTENSION, emptyDrawingContent, withDrawingExtension } from './drawings'

export interface FileNode {
  kind: 'file'
  name: string
  path: string
}

export interface DirNode {
  kind: 'directory'
  name: string
  path: string
  children: TreeNode[]
}

export type TreeNode = FileNode | DirNode

const IGNORED_NAMES = new Set(['node_modules', '.git', '.DS_Store', '_stash'])

/** Extensions the file tree surfaces — everything else is hidden. */
const EDITABLE_EXTENSIONS = ['.md', DRAWING_EXTENSION]

function isEditableFile(name: string): boolean {
  const lower = name.toLowerCase()
  return EDITABLE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export async function pickFolder(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false })
  return typeof selected === 'string' ? selected : null
}

export async function isDirectoryPath(path: string): Promise<boolean> {
  const info = await stat(path)
  return info.isDirectory
}

export async function buildTree(dirPath: string, name?: string): Promise<DirNode> {
  const entries = await readDir(dirPath)
  const children: TreeNode[] = []

  for (const entry of entries) {
    if (IGNORED_NAMES.has(entry.name) || entry.name.startsWith('.')) continue
    const childPath = await join(dirPath, entry.name)

    if (entry.isDirectory) {
      children.push(await buildTree(childPath, entry.name))
    } else if (isEditableFile(entry.name)) {
      children.push({ kind: 'file', name: entry.name, path: childPath })
    }
  }

  children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return {
    kind: 'directory',
    name: name ?? (await basename(dirPath)),
    path: dirPath,
    children,
  }
}

export async function readFile(path: string): Promise<string> {
  return readTextFile(path)
}

export async function writeFile(path: string, content: string): Promise<void> {
  await writeTextFile(path, content)
}

export async function createFile(dirPath: string, name: string): Promise<FileNode> {
  // A name typed with the drawing extension creates a drawing, so the "new
  // file" input stays a single way in for both document kinds.
  if (name.toLowerCase().endsWith(DRAWING_EXTENSION)) return createDrawing(dirPath, name)

  const fileName = name.toLowerCase().endsWith('.md') ? name : `${name}.md`
  const path = await join(dirPath, fileName)
  await writeTextFile(path, '')
  return { kind: 'file', name: fileName, path }
}

export async function createDrawing(dirPath: string, name: string): Promise<FileNode> {
  const fileName = withDrawingExtension(name)
  const path = await join(dirPath, fileName)
  await writeTextFile(path, emptyDrawingContent())
  return { kind: 'file', name: fileName, path }
}

export async function createFolder(dirPath: string, name: string): Promise<DirNode> {
  const path = await join(dirPath, name)
  await mkdir(path)
  return { kind: 'directory', name, path, children: [] }
}

export async function renameEntry(oldPath: string, newName: string): Promise<string> {
  const parentDir = await dirname(oldPath)
  const newPath = await join(parentDir, newName)
  await renamePath(oldPath, newPath)
  return newPath
}

export async function moveEntry(sourcePath: string, targetDirPath: string): Promise<string> {
  const name = await basename(sourcePath)
  const newPath = await join(targetDirPath, name)
  await renamePath(sourcePath, newPath)
  return newPath
}

export async function duplicateFile(node: FileNode): Promise<FileNode> {
  const content = await readTextFile(node.path)
  const parentDir = await dirname(node.path)
  const dotIndex = node.name.lastIndexOf('.')
  const base = dotIndex > 0 ? node.name.slice(0, dotIndex) : node.name
  const ext = dotIndex > 0 ? node.name.slice(dotIndex) : ''

  let candidateName = `${base} copy${ext}`
  let candidatePath = await join(parentDir, candidateName)
  let counter = 2
  while (await exists(candidatePath)) {
    candidateName = `${base} copy ${counter}${ext}`
    candidatePath = await join(parentDir, candidateName)
    counter++
  }

  await writeTextFile(candidatePath, content)
  return { kind: 'file', name: candidateName, path: candidatePath }
}

const STASH_DIR_NAME = '_stash'
const STASH_MANIFEST_NAME = 'manifest.json'

export interface StashEntry {
  stashName: string
  originalPath: string
  originalName: string
  kind: 'file' | 'directory'
  deletedAt: string
}

async function getStashDir(rootPath: string): Promise<string> {
  const stashPath = await join(rootPath, STASH_DIR_NAME)
  // Every stash read and write funnels through here, and several can be in
  // flight at once (opening a folder refreshes the stash while a delete is
  // still finishing). An exists-then-mkdir pair loses that race and throws
  // EEXIST; `recursive` makes creating an existing directory a no-op.
  await mkdir(stashPath, { recursive: true })
  return stashPath
}

async function readManifest(rootPath: string): Promise<StashEntry[]> {
  const stashPath = await getStashDir(rootPath)
  const manifestPath = await join(stashPath, STASH_MANIFEST_NAME)
  if (!(await exists(manifestPath))) return []
  try {
    return JSON.parse(await readTextFile(manifestPath)) as StashEntry[]
  } catch {
    return []
  }
}

async function writeManifest(rootPath: string, entries: StashEntry[]): Promise<void> {
  const stashPath = await getStashDir(rootPath)
  const manifestPath = await join(stashPath, STASH_MANIFEST_NAME)
  await writeTextFile(manifestPath, JSON.stringify(entries, null, 2))
}

export async function listStash(rootPath: string): Promise<StashEntry[]> {
  return readManifest(rootPath)
}

export async function moveToStash(rootPath: string, node: TreeNode): Promise<void> {
  const stashPath = await getStashDir(rootPath)
  const stashName = `${Date.now()}-${node.name}`
  const stashEntryPath = await join(stashPath, stashName)
  await renamePath(node.path, stashEntryPath)

  const entries = await readManifest(rootPath)
  entries.unshift({
    stashName,
    originalPath: node.path,
    originalName: node.name,
    kind: node.kind,
    deletedAt: new Date().toISOString(),
  })
  await writeManifest(rootPath, entries)
}

export async function restoreFromStash(rootPath: string, entry: StashEntry): Promise<void> {
  const stashPath = await getStashDir(rootPath)
  const stashEntryPath = await join(stashPath, entry.stashName)
  const parentDir = await dirname(entry.originalPath)
  if (!(await exists(parentDir))) await mkdir(parentDir, { recursive: true })
  await renamePath(stashEntryPath, entry.originalPath)

  const entries = await readManifest(rootPath)
  await writeManifest(
    rootPath,
    entries.filter((e) => e.stashName !== entry.stashName),
  )
}

export async function deleteStashEntryForever(rootPath: string, entry: StashEntry): Promise<void> {
  const stashPath = await getStashDir(rootPath)
  const stashEntryPath = await join(stashPath, entry.stashName)
  await remove(stashEntryPath, { recursive: true })

  const entries = await readManifest(rootPath)
  await writeManifest(
    rootPath,
    entries.filter((e) => e.stashName !== entry.stashName),
  )
}

export async function watchFolder(rootPath: string, onChange: () => void): Promise<() => void> {
  return watch(rootPath, () => onChange(), { recursive: true, delayMs: 400 })
}

export function flattenFiles(node: DirNode): FileNode[] {
  const files: FileNode[] = []
  for (const child of node.children) {
    if (child.kind === 'file') files.push(child)
    else files.push(...flattenFiles(child))
  }
  return files
}

export function relativePath(rootPath: string, filePath: string): string {
  return filePath.startsWith(`${rootPath}/`) ? filePath.slice(rootPath.length + 1) : filePath
}
