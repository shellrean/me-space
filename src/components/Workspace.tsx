import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { writeFile as writeBinaryFile } from '@tauri-apps/plugin-fs'
import { dirname, join } from '@tauri-apps/api/path'
import Editor, { type EditorHandle } from './Editor'
import EmojiPickerButton from './EmojiPickerButton'
import SequenceDiagramBuilder from './SequenceDiagramBuilder'
import Preview from './Preview'
import FileTree from './FileTree'
import StashPanel from './StashPanel'
import JiraSidebarSection from './JiraSidebarSection'
import JiraTicketDetail from './JiraTicketDetail'
import WelcomeScreen from './WelcomeScreen'
import ProjectSettings from './ProjectSettings'
import TerminalPanel from './TerminalPanel'
import QuickOpen from './QuickOpen'
import CommentsPanel from './CommentsPanel'
import type { DrawingCanvasHandle, ExportFormat } from './DrawingCanvas'
import {
  IconArchive,
  IconChecklist,
  IconImageDown,
  IconKanban,
  IconMessage,
  IconSearch,
  IconSunrise,
  IconTerminal,
} from './icons'
import {
  buildTree,
  createDrawing,
  createFile,
  createFolder,
  deleteStashEntryForever,
  duplicateFile,
  flattenFiles,
  isDirectoryPath,
  listStash,
  moveEntry,
  moveToStash,
  pickFolder,
  readFile,
  relativePath,
  renameEntry,
  restoreFromStash,
  watchFolder,
  writeFile,
  type DirNode,
  type FileNode,
  type StashEntry,
  type TreeNode,
} from '../lib/fileSystem'
import { loadComments, saveComments, type Comment, type CommentsStore } from '../lib/comments'
import { documentKind, drawingBaseName } from '../lib/drawings'
import {
  clearJiraConfig,
  fetchEpicIssues,
  fetchIssueDetail,
  fetchIssues as fetchJiraIssues,
  loadJiraConfig,
  saveJiraConfig,
  type JiraConfig,
  type JiraIssue,
  type JiraIssueDetail,
} from '../lib/jira'
import { addRecentFolder, loadRecentFolders, removeRecentFolder } from '../lib/recents'
import {
  ensureTodayStandup,
  ensureTodoFile,
  loadProjectConfig,
  saveKanbanSnapshot,
  saveProjectConfig,
  saveTicketToProject,
  type ProjectConfig,
} from '../lib/project'

// Excalidraw is a multi-megabyte dependency that most sessions never touch, so
// it is code-split and only fetched the first time a drawing is opened.
const DrawingCanvas = lazy(() => import('./DrawingCanvas'))

function findFirstFile(node: DirNode): FileNode | null {
  for (const child of node.children) {
    if (child.kind === 'file') return child
    const found = findFirstFile(child)
    if (found) return found
  }
  return null
}

type SaveState = 'idle' | 'saving' | 'saved'

interface WorkspaceProps {
  /** Folder to auto-open on mount (used when restoring a previously open tab). */
  initialPath: string | null
  /** Whether this tab is the one currently shown. Background tabs stay mounted
   * (to keep their state and file watchers alive) but must not react to
   * window-global events like drag-drop or the quick-open shortcut. */
  active: boolean
  /** Called whenever the open folder or project name changes, so the tab bar can update its label. */
  onRootChange: (info: { path: string | null; name: string | null }) => void
}

function Workspace({ initialPath, active, onRootChange }: WorkspaceProps) {
  const [root, setRoot] = useState<DirNode | null>(null)
  const [activeFile, setActiveFile] = useState<FileNode | null>(null)
  const [source, setSource] = useState('')
  const [animate, setAnimate] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [fsError, setFsError] = useState<string | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [stashEntries, setStashEntries] = useState<StashEntry[]>([])
  const [showStash, setShowStash] = useState(false)
  const [jiraConfig, setJiraConfig] = useState<JiraConfig | null>(null)
  const [jiraChecked, setJiraChecked] = useState(false)
  const [jiraIssues, setJiraIssues] = useState<JiraIssue[] | null>(null)
  const [jiraLoading, setJiraLoading] = useState(false)
  const [jiraError, setJiraError] = useState<string | null>(null)
  const [jiraOnlyMine, setJiraOnlyMine] = useState(true)
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null)
  const [issueDetail, setIssueDetail] = useState<JiraIssueDetail | null>(null)
  const [issueDetailLoading, setIssueDetailLoading] = useState(false)
  const [issueDetailError, setIssueDetailError] = useState<string | null>(null)
  const [recentFolders, setRecentFolders] = useState<string[]>([])
  const [projectConfig, setProjectConfig] = useState<ProjectConfig | null>(null)
  const [showProjectSettings, setShowProjectSettings] = useState(false)
  const [previewOnly, setPreviewOnly] = useState(false)
  const [showSequenceBuilder, setShowSequenceBuilder] = useState(false)
  const [showTerminal, setShowTerminal] = useState(false)
  const [filesCollapsed, setFilesCollapsed] = useState(false)
  const [showQuickOpen, setShowQuickOpen] = useState(false)
  const [commentsStore, setCommentsStore] = useState<CommentsStore>({})
  const [showComments, setShowComments] = useState(false)
  const [jiraCollapsed, setJiraCollapsed] = useState(false)
  const [exportNotice, setExportNotice] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const saveTimeout = useRef<number | null>(null)
  const editorRef = useRef<EditorHandle>(null)
  const drawingRef = useRef<DrawingCanvasHandle>(null)

  // Background tabs stay mounted but must ignore window-global events; keep
  // the latest `active` value in a ref so long-lived listeners can check it
  // without having to resubscribe every time the tab is switched.
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    loadRecentFolders().then(setRecentFolders)
  }, [])

  async function refreshTree(dirPath: string) {
    const tree = await buildTree(dirPath)
    setRoot(tree)
    return tree
  }

  async function refreshStash(dirPath: string) {
    setStashEntries(await listStash(dirPath))
  }

  async function openFolder(dirPath: string): Promise<boolean> {
    try {
      const tree = await refreshTree(dirPath)
      const first = findFirstFile(tree)
      if (first) {
        // Read before setting state — see handleOpenFile.
        const content = await readFile(first.path)
        setActiveFile(first)
        setSource(content)
      } else {
        setActiveFile(null)
        setSource('')
      }
      setSaveState('idle')
      setFsError(null)
      await refreshStash(dirPath)
      setProjectConfig(await loadProjectConfig(dirPath, tree.name))
      setCommentsStore(await loadComments(dirPath))
      return true
    } catch (err) {
      setFsError(err instanceof Error ? err.message : String(err))
      return false
    }
  }

  async function handleOpenFolder() {
    const dirPath = await pickFolder()
    if (!dirPath) return
    const ok = await openFolder(dirPath)
    if (ok) setRecentFolders(await addRecentFolder(dirPath))
  }

  async function handleOpenRecent(dirPath: string) {
    const ok = await openFolder(dirPath)
    setRecentFolders(await (ok ? addRecentFolder(dirPath) : removeRecentFolder(dirPath)))
  }

  // Restore the folder this tab had open when the app was last closed.
  useEffect(() => {
    if (initialPath) openFolder(initialPath)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Let the tab bar know what to label this tab.
  useEffect(() => {
    onRootChange({ path: root?.path ?? null, name: projectConfig?.name ?? root?.name ?? null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, projectConfig?.name])

  // Keep the sidebar in sync with files added/removed/renamed from outside
  // the app (Finder, git, another editor, etc.).
  useEffect(() => {
    if (!root) return
    let unwatch: (() => void) | null = null
    let cancelled = false

    watchFolder(root.path, () => {
      refreshTree(root.path)
    }).then((fn) => {
      if (cancelled) fn()
      else unwatch = fn
    })

    return () => {
      cancelled = true
      unwatch?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root?.path])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!activeRef.current) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        if (root) setShowQuickOpen(true)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [root])

  useEffect(() => {
    const unlistenPromise = getCurrentWebview().onDragDropEvent(async (event) => {
      if (!activeRef.current) return
      if (event.payload.type === 'drop') {
        setIsDragActive(false)
        try {
          for (const path of event.payload.paths) {
            if (await isDirectoryPath(path)) {
              const ok = await openFolder(path)
              if (ok) setRecentFolders(await addRecentFolder(path))
              break
            }
          }
        } catch (err) {
          setFsError(err instanceof Error ? err.message : String(err))
        }
      } else if (event.payload.type === 'leave') {
        setIsDragActive(false)
      } else {
        setIsDragActive(true)
      }
    })

    return () => {
      unlistenPromise.then((unlisten) => unlisten())
    }
  }, [])

  async function handleOpenFile(file: FileNode) {
    if (saveTimeout.current) window.clearTimeout(saveTimeout.current)
    // Read the file *before* touching state. Setting `activeFile` first and
    // awaiting the read afterwards leaves a render where the new file is
    // active but `source` still holds the previous one's content — harmless
    // for the editor (a one-frame flash), but fatal for a drawing: that render
    // is when <DrawingCanvas> mounts, and Excalidraw only ever reads
    // `initialData` at mount, so the canvas keeps the wrong (usually empty)
    // scene forever and the next autosave writes it over the real file.
    const content = await readFile(file.path)
    setActiveFile(file)
    setSaveState('idle')
    setExportNotice(null)
    setSource(content)
  }

  function handleChange(value: string) {
    setSource(value)
    if (!activeFile) return

    setSaveState('idle')
    if (saveTimeout.current) window.clearTimeout(saveTimeout.current)
    saveTimeout.current = window.setTimeout(async () => {
      setSaveState('saving')
      await writeFile(activeFile.path, value)
      setSaveState('saved')
    }, 600)
  }

  /**
   * Autosave for the drawing canvas. `<DrawingCanvas>` debounces and hands back
   * the file it belongs to, because a pending save can land after the user has
   * already switched files — writing it is still correct, but the save
   * indicator must not claim the *new* file was just saved.
   */
  async function handleSaveDrawing(filePath: string, content: string) {
    const isStillActive = activeFile?.path === filePath
    if (isStillActive) setSaveState('saving')
    try {
      await writeFile(filePath, content)
      if (isStillActive) setSaveState('saved')
    } catch (err) {
      setFsError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleCreateDrawing(dirPath: string, name: string) {
    try {
      const file = await createDrawing(dirPath, name)
      if (root) await refreshTree(root.path)
      await handleOpenFile(file)
    } catch (err) {
      setFsError(err instanceof Error ? err.message : String(err))
    }
  }

  /**
   * Writes the drawing out as an image next to the `.excalidraw` source, which
   * is what makes it embeddable: the Markdown preview resolves relative image
   * links against the file's own folder.
   */
  async function handleExportDrawing(format: ExportFormat) {
    if (!activeFile) return
    setExporting(true)
    setExportNotice(null)
    setFsError(null)
    try {
      const bytes = await drawingRef.current?.exportImage(format)
      if (!bytes) throw new Error('Kanvas belum siap.')

      const outName = `${drawingBaseName(activeFile.name)}.${format}`
      await writeBinaryFile(await join(await dirname(activeFile.path), outName), bytes)

      const snippet = `![${drawingBaseName(activeFile.name)}](${encodeURI(outName)})`
      let copied = false
      try {
        await navigator.clipboard.writeText(snippet)
        copied = true
      } catch {
        // Clipboard can be unavailable; the snippet is shown either way.
      }
      setExportNotice(`${outName} tersimpan. ${snippet}${copied ? ' (disalin ke clipboard)' : ''}`)
    } catch (err) {
      setFsError(err instanceof Error ? err.message : String(err))
    } finally {
      setExporting(false)
    }
  }

  async function handleCreateFile(dirPath: string, name: string) {
    try {
      const file = await createFile(dirPath, name)
      if (root) await refreshTree(root.path)
      setActiveFile(file)
      setSource('')
      setSaveState('idle')
    } catch (err) {
      setFsError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleCreateFolder(dirPath: string, name: string) {
    try {
      await createFolder(dirPath, name)
      if (root) await refreshTree(root.path)
    } catch (err) {
      setFsError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleRename(node: TreeNode, newName: string) {
    try {
      const wasRoot = root?.path === node.path
      const newPath = await renameEntry(node.path, newName)

      if (activeFile) {
        if (activeFile.path === node.path) {
          setActiveFile({ ...activeFile, name: newName, path: newPath })
        } else if (activeFile.path.startsWith(`${node.path}/`)) {
          setActiveFile({ ...activeFile, path: newPath + activeFile.path.slice(node.path.length) })
        }
      }

      const refreshBasePath = wasRoot ? newPath : root?.path
      if (refreshBasePath) await refreshTree(refreshBasePath)
    } catch (err) {
      setFsError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleMoveItem(sourcePath: string, targetDirPath: string) {
    if (!root) return
    if (sourcePath === targetDirPath) return
    if (targetDirPath.startsWith(`${sourcePath}/`)) return

    try {
      const newPath = await moveEntry(sourcePath, targetDirPath)

      if (activeFile) {
        if (activeFile.path === sourcePath) {
          setActiveFile({ ...activeFile, path: newPath })
        } else if (activeFile.path.startsWith(`${sourcePath}/`)) {
          setActiveFile({ ...activeFile, path: newPath + activeFile.path.slice(sourcePath.length) })
        }
      }

      await refreshTree(root.path)
    } catch (err) {
      setFsError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleDuplicate(node: FileNode) {
    if (!root) return
    try {
      const copy = await duplicateFile(node)
      await refreshTree(root.path)
      // Read before setting state — see handleOpenFile.
      const content = await readFile(copy.path)
      setActiveFile(copy)
      setSource(content)
      setSaveState('idle')
    } catch (err) {
      setFsError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleDelete(node: TreeNode) {
    if (!root) return
    try {
      await moveToStash(root.path, node)

      if (activeFile && (activeFile.path === node.path || activeFile.path.startsWith(`${node.path}/`))) {
        if (saveTimeout.current) window.clearTimeout(saveTimeout.current)
        setActiveFile(null)
        setSource('')
        setSaveState('idle')
      }

      await refreshTree(root.path)
      await refreshStash(root.path)
    } catch (err) {
      setFsError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleRestore(entry: StashEntry) {
    if (!root) return
    try {
      await restoreFromStash(root.path, entry)
      await refreshTree(root.path)
      await refreshStash(root.path)
    } catch (err) {
      setFsError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleDeleteForever(entry: StashEntry) {
    if (!root) return
    if (!window.confirm(`Hapus permanen "${entry.originalName}"? Tindakan ini tidak bisa dibatalkan.`)) return
    try {
      await deleteStashEntryForever(root.path, entry)
      await refreshStash(root.path)
    } catch (err) {
      setFsError(err instanceof Error ? err.message : String(err))
    }
  }

  async function refreshJiraIssues(cfg: JiraConfig, onlyMine: boolean, epicKey?: string | null) {
    setJiraLoading(true)
    setJiraError(null)
    try {
      setJiraIssues(await fetchJiraIssues(cfg, { onlyMine, epicKey }))
    } catch (err) {
      setJiraError(err instanceof Error ? err.message : String(err))
    } finally {
      setJiraLoading(false)
    }
  }

  useEffect(() => {
    loadJiraConfig().then((stored) => {
      setJiraChecked(true)
      if (stored) {
        setJiraConfig(stored)
        refreshJiraIssues(stored, true, projectConfig?.jiraEpicKey)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-scope the Jira list whenever the active project's linked epic changes
  // (opening a different project, or editing the epic key in Project Settings).
  useEffect(() => {
    if (jiraConfig) refreshJiraIssues(jiraConfig, jiraOnlyMine, projectConfig?.jiraEpicKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectConfig?.jiraEpicKey])

  async function handleJiraConnect(cfg: JiraConfig) {
    setJiraLoading(true)
    setJiraError(null)
    try {
      const result = await fetchJiraIssues(cfg, { onlyMine: jiraOnlyMine, epicKey: projectConfig?.jiraEpicKey })
      await saveJiraConfig(cfg)
      setJiraConfig(cfg)
      setJiraIssues(result)
    } catch (err) {
      setJiraError(err instanceof Error ? err.message : String(err))
    } finally {
      setJiraLoading(false)
    }
  }

  async function handleToggleJiraOnlyMine() {
    const next = !jiraOnlyMine
    setJiraOnlyMine(next)
    if (jiraConfig) await refreshJiraIssues(jiraConfig, next, projectConfig?.jiraEpicKey)
  }

  async function handleJiraDisconnect() {
    await clearJiraConfig()
    setJiraConfig(null)
    setJiraIssues(null)
  }

  async function handleSelectIssue(key: string) {
    if (!jiraConfig) return
    setSelectedIssueKey(key)
    setIssueDetail(null)
    setIssueDetailError(null)
    setIssueDetailLoading(true)
    try {
      setIssueDetail(await fetchIssueDetail(jiraConfig, key))
    } catch (err) {
      setIssueDetailError(err instanceof Error ? err.message : String(err))
    } finally {
      setIssueDetailLoading(false)
    }
  }

  async function handleSaveProjectConfig(config: ProjectConfig) {
    if (!root) return
    try {
      await saveProjectConfig(root.path, config)
      setProjectConfig(config)
    } catch (err) {
      setFsError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleOpenStandup() {
    if (!root) return
    let epicIssues: JiraIssue[] = []
    if (jiraConfig && projectConfig?.jiraEpicKey) {
      try {
        epicIssues = await fetchEpicIssues(jiraConfig, projectConfig.jiraEpicKey)
      } catch {
        // Lanjut tanpa daftar issue epic kalau gagal fetch
      }
    }
    try {
      const { node } = await ensureTodayStandup(root.path, epicIssues)
      await refreshTree(root.path)
      await handleOpenFile(node)
    } catch (err) {
      setFsError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleOpenTodo() {
    if (!root) return
    try {
      const { node } = await ensureTodoFile(root.path)
      await refreshTree(root.path)
      await handleOpenFile(node)
    } catch (err) {
      setFsError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleGenerateKanban() {
    if (!root) return
    if (!jiraConfig || !projectConfig?.jiraEpicKey) {
      setFsError('Hubungkan Jira dan set epic key project ini dulu di Pengaturan Project.')
      return
    }
    try {
      const issues = await fetchEpicIssues(jiraConfig, projectConfig.jiraEpicKey)
      const node = await saveKanbanSnapshot(root.path, issues)
      await refreshTree(root.path)
      await handleOpenFile(node)
    } catch (err) {
      setFsError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleSaveTicketToProject(detail: JiraIssueDetail) {
    if (!root) return
    try {
      const node = await saveTicketToProject(root.path, detail)
      await refreshTree(root.path)
      await handleOpenFile(node)
      setSelectedIssueKey(null)
    } catch (err) {
      setFsError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleAddComment(text: string, commentText: string) {
    if (!root || !activeFile) return
    const key = relativePath(root.path, activeFile.path)
    const newComment: Comment = {
      id: crypto.randomUUID(),
      text,
      comment: commentText,
      createdAt: new Date().toISOString(),
    }
    const next = { ...commentsStore, [key]: [...(commentsStore[key] ?? []), newComment] }
    setCommentsStore(next)
    try {
      await saveComments(root.path, next)
    } catch (err) {
      setFsError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleDeleteComment(relPath: string, id: string) {
    if (!root) return
    const next = { ...commentsStore, [relPath]: (commentsStore[relPath] ?? []).filter((c) => c.id !== id) }
    setCommentsStore(next)
    try {
      await saveComments(root.path, next)
    } catch (err) {
      setFsError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleOpenCommentFile(relPath: string) {
    if (!root) return
    const target = flattenFiles(root).find((f) => relativePath(root.path, f.path) === relPath)
    if (target) {
      await handleOpenFile(target)
      setShowComments(false)
    }
  }

  const currentComments =
    root && activeFile ? (commentsStore[relativePath(root.path, activeFile.path)] ?? []) : []
  const totalComments = Object.values(commentsStore).reduce((sum, c) => sum + c.length, 0)

  const wordCount = source.trim() ? source.trim().split(/\s+/).length : 0
  const activeKind = activeFile ? documentKind(activeFile.name) : null
  const isDrawing = activeKind === 'drawing'

  return (
    <div className="relative flex h-full flex-col bg-neutral-950 text-neutral-100">
      {isDragActive && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-cyan-400/60 bg-neutral-950/80 backdrop-blur-sm">
          <div className="rounded-xl border border-white/10 bg-[#0b0c10] px-6 py-4 text-center shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
            <p className="font-mono text-sm text-cyan-300">Lepas untuk membuka folder</p>
          </div>
        </div>
      )}
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold tracking-wide text-neutral-300">
            Markdown Workspace
          </h1>
          {root && (
            <button
              type="button"
              onClick={() => setShowStash(true)}
              title="Lihat stash"
              className="relative flex items-center justify-center rounded border border-white/10 p-1.5 text-neutral-300 hover:bg-white/10"
            >
              <IconArchive className="h-4 w-4" />
              {stashEntries.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-cyan-500 px-0.5 text-[9px] font-semibold text-neutral-950">
                  {stashEntries.length}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowTerminal((v) => !v)}
            title="Toggle terminal"
            className={`flex items-center justify-center rounded border border-white/10 p-1.5 hover:bg-white/10 ${
              showTerminal ? 'text-cyan-300' : 'text-neutral-300'
            }`}
          >
            <IconTerminal className="h-4 w-4" />
          </button>
          {root && (
            <button
              type="button"
              onClick={() => setShowComments(true)}
              title="Lihat semua komentar"
              className="relative flex items-center justify-center rounded border border-white/10 p-1.5 text-neutral-300 hover:bg-white/10"
            >
              <IconMessage className="h-4 w-4" />
              {totalComments > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-cyan-500 px-0.5 text-[9px] font-semibold text-neutral-950">
                  {totalComments}
                </span>
              )}
            </button>
          )}
          {activeFile && (saveState === 'saving' || saveState === 'saved') && (
            <span className="text-xs text-neutral-500">
              {saveState === 'saving' && 'menyimpan…'}
              {saveState === 'saved' && 'tersimpan'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-neutral-400">
            <input
              type="checkbox"
              checked={animate}
              onChange={(e) => setAnimate(e.target.checked)}
              className="accent-cyan-400"
            />
            Animasi aliran data
          </label>
          <span className="text-xs text-neutral-500">Mermaid • GFM • Live Preview</span>
        </div>
      </header>

      {fsError && (
        <p className="border-b border-red-500/30 bg-red-500/10 px-4 py-1 text-xs text-red-400">
          {fsError}
        </p>
      )}

      {exportNotice && (
        <p className="flex items-center justify-between gap-3 border-b border-cyan-400/25 bg-cyan-400/5 px-4 py-1 text-xs text-cyan-300">
          <span className="truncate font-mono">{exportNotice}</span>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="shrink-0 text-neutral-500 hover:text-neutral-300"
          >
            ✕
          </button>
        </p>
      )}

      <main
        className={`grid min-h-0 flex-1 ${
          (previewOnly || isDrawing) && activeFile ? 'grid-cols-[240px_1fr]' : 'grid-cols-[240px_1fr_1fr]'
        } divide-x divide-white/10 ${animate ? '' : 'diagrams-paused'}`}
      >
        <div className="flex min-h-0 flex-col divide-y divide-white/10 overflow-hidden bg-neutral-900/40">
          {root && projectConfig && (
            <div className="shrink-0 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="truncate text-sm font-medium text-neutral-200">{projectConfig.name}</span>
                <button
                  type="button"
                  onClick={() => setShowProjectSettings(true)}
                  title="Pengaturan project"
                  className="shrink-0 text-neutral-500 hover:text-cyan-300"
                >
                  ⚙
                </button>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-neutral-600">
                {projectConfig.jiraEpicKey ? `Epic: ${projectConfig.jiraEpicKey}` : 'Epic belum diset'}
              </p>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={handleOpenStandup}
                  title="Standup Hari Ini"
                  className="flex flex-1 items-center justify-center rounded border border-white/10 py-1.5 text-neutral-300 hover:bg-white/10"
                >
                  <IconSunrise className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleOpenTodo}
                  title="Todo List"
                  className="flex flex-1 items-center justify-center rounded border border-white/10 py-1.5 text-neutral-300 hover:bg-white/10"
                >
                  <IconChecklist className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleGenerateKanban}
                  title="Ticket Status (Kanban) — generate dari epic Jira"
                  className="flex flex-1 items-center justify-center rounded border border-white/10 py-1.5 text-neutral-300 hover:bg-white/10"
                >
                  <IconKanban className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          <div className={`flex min-h-0 flex-col overflow-hidden ${filesCollapsed ? 'flex-none' : 'flex-1'}`}>
            <div className="flex shrink-0 items-center justify-between px-3 py-2">
              <button
                type="button"
                onClick={() => setFilesCollapsed((v) => !v)}
                className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-neutral-500 hover:text-neutral-300"
              >
                <span className="text-neutral-600">{filesCollapsed ? '▸' : '▾'}</span>
                Files
              </button>
              <div className="flex items-center gap-2">
                {root && (
                  <button
                    type="button"
                    onClick={() => setShowQuickOpen(true)}
                    title="Cari file (⌘P)"
                    className="text-neutral-500 hover:text-cyan-300"
                  >
                    <IconSearch className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenFolder}
                  title="Buka folder lokal"
                  className="text-[11px] text-neutral-500 hover:text-cyan-300"
                >
                  Buka Folder
                </button>
              </div>
            </div>
            {!filesCollapsed && (
              <div className="min-h-0 flex-1 overflow-y-auto">
                {root ? (
                  <FileTree
                    root={root}
                    activePath={activeFile?.path ?? null}
                    onOpenFile={handleOpenFile}
                    onCreateFile={handleCreateFile}
                    onCreateFolder={handleCreateFolder}
                    onCreateDrawing={handleCreateDrawing}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onMove={handleMoveItem}
                    onDuplicate={handleDuplicate}
                  />
                ) : (
                  <p className="px-3 py-3 text-xs text-neutral-600">Belum ada folder dibuka.</p>
                )}
              </div>
            )}
          </div>

          <div className={`flex min-h-0 flex-col overflow-hidden ${jiraCollapsed ? 'flex-none' : 'flex-1'}`}>
            <div className="flex shrink-0 items-center justify-between px-3 py-2">
              <button
                type="button"
                onClick={() => setJiraCollapsed((v) => !v)}
                className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-neutral-500 hover:text-neutral-300"
              >
                <span className="text-neutral-600">{jiraCollapsed ? '▸' : '▾'}</span>
                Jira
              </button>
              {jiraConfig && (
                <button
                  type="button"
                  onClick={() => refreshJiraIssues(jiraConfig, jiraOnlyMine, projectConfig?.jiraEpicKey)}
                  title="Refresh"
                  className="text-[11px] text-neutral-500 hover:text-cyan-300"
                >
                  Refresh
                </button>
              )}
            </div>
            {!jiraCollapsed && (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <JiraSidebarSection
                  config={jiraConfig}
                  checked={jiraChecked}
                  issues={jiraIssues}
                  loading={jiraLoading}
                  error={jiraError}
                  selectedKey={selectedIssueKey}
                  onlyMine={jiraOnlyMine}
                  onToggleOnlyMine={handleToggleJiraOnlyMine}
                  epicKey={projectConfig?.jiraEpicKey ?? null}
                  onConnect={handleJiraConnect}
                  onDisconnect={handleJiraDisconnect}
                  onSelectIssue={handleSelectIssue}
                />
              </div>
            )}
          </div>
        </div>
        {activeFile && isDrawing ? (
          <div className="flex min-h-0 flex-col overflow-hidden bg-[#0b0c10]">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-3.5 py-2">
              <span className="truncate font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                {activeFile.name}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <IconImageDown className="h-3.5 w-3.5 text-neutral-600" />
                {(['svg', 'png'] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    disabled={exporting}
                    onClick={() => handleExportDrawing(format)}
                    title={`Ekspor ${format.toUpperCase()} di samping file ini, siap disisipkan ke Markdown`}
                    className="rounded px-1.5 py-0.5 text-[11px] text-neutral-500 hover:bg-white/10 hover:text-cyan-300 disabled:opacity-40"
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-xs text-neutral-600">
                    memuat kanvas…
                  </div>
                }
              >
                <DrawingCanvas
                  key={activeFile.path}
                  ref={drawingRef}
                  filePath={activeFile.path}
                  content={source}
                  onSave={handleSaveDrawing}
                />
              </Suspense>
            </div>
          </div>
        ) : activeFile ? (
          <>
            {!previewOnly && (
              <div className="flex min-h-0 flex-col overflow-hidden bg-[#0b0c10]">
                <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-3.5 py-2">
                  <span className="truncate font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                    {activeFile.name}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] text-neutral-600">{wordCount} kata</span>
                    <button
                      type="button"
                      onClick={() => setShowSequenceBuilder(true)}
                      title="Buat sequence diagram"
                      className="rounded px-1.5 py-0.5 text-[11px] text-neutral-500 hover:bg-white/10 hover:text-cyan-300"
                    >
                      + Sequence
                    </button>
                    <EmojiPickerButton onSelect={(emoji) => editorRef.current?.insertAtCursor(emoji)} />
                  </div>
                </div>
                <div className="min-h-0 flex-1">
                  <Editor ref={editorRef} value={source} onChange={handleChange} />
                </div>
              </div>
            )}
            <div className="flex min-h-0 flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-3.5 py-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                  Preview
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewOnly((v) => !v)}
                  title={previewOnly ? 'Tampilkan editor' : 'Sembunyikan editor, lihat preview penuh'}
                  className={`rounded px-1.5 py-0.5 text-[11px] ${
                    previewOnly ? 'text-cyan-300' : 'text-neutral-500 hover:text-cyan-300'
                  }`}
                >
                  ⛶
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <Preview
                  source={source}
                  animate={animate}
                  basePath={activeFile.path}
                  comments={currentComments}
                  onAddComment={handleAddComment}
                  onDeleteComment={(id) => {
                    if (root && activeFile) handleDeleteComment(relativePath(root.path, activeFile.path), id)
                  }}
                />
              </div>
            </div>
          </>
        ) : (
          <WelcomeScreen
            onOpenFolder={handleOpenFolder}
            onOpenRecent={handleOpenRecent}
            recentFolders={recentFolders}
            jiraConfig={jiraConfig}
            jiraIssueCount={jiraIssues?.length ?? null}
          />
        )}
      </main>

      {showTerminal && (
        <div className="flex h-64 shrink-0 flex-col border-t border-white/10 bg-[#0b0c10]">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-3.5 py-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">Terminal</span>
            <button
              type="button"
              onClick={() => setShowTerminal(false)}
              className="flex h-5 w-5 items-center justify-center rounded text-neutral-500 hover:bg-white/10 hover:text-red-400"
            >
              ✕
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <TerminalPanel cwd={root?.path ?? null} />
          </div>
        </div>
      )}

      {showStash && (
        <StashPanel
          entries={stashEntries}
          onRestore={handleRestore}
          onDeleteForever={handleDeleteForever}
          onClose={() => setShowStash(false)}
        />
      )}

      {selectedIssueKey && (
        <JiraTicketDetail
          detail={issueDetail}
          loading={issueDetailLoading}
          error={issueDetailError}
          onClose={() => setSelectedIssueKey(null)}
          onSaveToProject={root ? handleSaveTicketToProject : undefined}
        />
      )}

      {showProjectSettings && projectConfig && (
        <ProjectSettings
          config={projectConfig}
          onSave={handleSaveProjectConfig}
          onClose={() => setShowProjectSettings(false)}
        />
      )}

      {showSequenceBuilder && (
        <SequenceDiagramBuilder
          onInsert={(block) => {
            editorRef.current?.insertAtCursor(block)
            setShowSequenceBuilder(false)
          }}
          onClose={() => setShowSequenceBuilder(false)}
        />
      )}

      {showQuickOpen && root && (
        <QuickOpen
          root={root}
          onSelect={(file) => {
            handleOpenFile(file)
            setShowQuickOpen(false)
          }}
          onClose={() => setShowQuickOpen(false)}
        />
      )}

      {showComments && (
        <CommentsPanel
          store={commentsStore}
          onOpenFile={handleOpenCommentFile}
          onDelete={handleDeleteComment}
          onClose={() => setShowComments(false)}
        />
      )}
    </div>
  )
}

export default Workspace
