import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DirNode, FileNode, TreeNode } from '../lib/fileSystem'
import { documentKind } from '../lib/drawings'
import { IconDrawing, IconDrawingPlus, IconFilePlus, IconFolderPlus, IconTrash } from './icons'

interface FileTreeProps {
  root: DirNode
  activePath: string | null
  onOpenFile: (file: FileNode) => void
  onCreateFile: (dirPath: string, name: string) => void
  onCreateFolder: (dirPath: string, name: string) => void
  onCreateDrawing: (dirPath: string, name: string) => void
  onRename: (node: TreeNode, newName: string) => void
  onDelete: (node: TreeNode) => void
  onMove: (sourcePath: string, targetDirPath: string) => void
  onDuplicate: (node: FileNode) => void
}

type CreateKind = 'file' | 'directory' | 'drawing'

type Draft = { mode: 'create'; kind: CreateKind; dirPath: string } | { mode: 'rename'; node: TreeNode } | null

const DRAFT_PLACEHOLDER: Record<CreateKind, string> = {
  file: 'untitled.md',
  directory: 'folder-baru',
  drawing: 'untitled.excalidraw',
}

interface ActiveDrag {
  sourcePath: string
  sourceName: string
  x: number
  y: number
  overTargetPath: string | null
}

export default function FileTree({
  root,
  activePath,
  onOpenFile,
  onCreateFile,
  onCreateFolder,
  onCreateDrawing,
  onRename,
  onDelete,
  onMove,
  onDuplicate,
}: FileTreeProps) {
  const [draft, setDraft] = useState<Draft>(null)
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null)

  function submitDraft(name: string) {
    const trimmed = name.trim()
    if (!draft || !trimmed) {
      setDraft(null)
      return
    }
    if (draft.mode === 'create') {
      if (draft.kind === 'file') onCreateFile(draft.dirPath, trimmed)
      else if (draft.kind === 'drawing') onCreateDrawing(draft.dirPath, trimmed)
      else onCreateFolder(draft.dirPath, trimmed)
    } else if (trimmed !== draft.node.name) {
      onRename(draft.node, trimmed)
    }
    setDraft(null)
  }

  function startDrag(e: React.MouseEvent, sourcePath: string, sourceName: string) {
    if (e.button !== 0) return
    const startX = e.clientX
    const startY = e.clientY
    let dragging = false

    function targetPathAt(x: number, y: number): string | null {
      const el = document.elementFromPoint(x, y)
      const dropEl = el instanceof HTMLElement ? el.closest<HTMLElement>('[data-drop-target]') : null
      return dropEl?.dataset.dropTarget ?? null
    }

    function handleMove(ev: MouseEvent) {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return
        dragging = true
      }
      setActiveDrag({
        sourcePath,
        sourceName,
        x: ev.clientX,
        y: ev.clientY,
        overTargetPath: targetPathAt(ev.clientX, ev.clientY),
      })
    }

    function handleUp(ev: MouseEvent) {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      if (dragging) {
        const targetPath = targetPathAt(ev.clientX, ev.clientY)
        if (targetPath) onMove(sourcePath, targetPath)
      }
      setActiveDrag(null)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  return (
    <div className="text-sm">
      <TreeLevel
        node={root}
        depth={0}
        activePath={activePath}
        draft={draft}
        dragOverPath={activeDrag?.overTargetPath ?? null}
        onOpenFile={onOpenFile}
        onStartCreate={(dirPath, kind) => setDraft({ mode: 'create', kind, dirPath })}
        onStartRename={(node) => setDraft({ mode: 'rename', node })}
        onSubmitDraft={submitDraft}
        onCancelDraft={() => setDraft(null)}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onStartDrag={startDrag}
        forceExpanded
      />
      {activeDrag &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[200] rounded border border-cyan-400/40 bg-[#0b0c10] px-2 py-1 text-xs text-neutral-200 shadow-[0_8px_20px_rgba(0,0,0,0.4)]"
            style={{ left: activeDrag.x + 12, top: activeDrag.y + 12 }}
          >
            {activeDrag.sourceName}
          </div>,
          document.body,
        )}
    </div>
  )
}

interface TreeLevelProps {
  node: TreeNode
  depth: number
  activePath: string | null
  draft: Draft
  dragOverPath: string | null
  onOpenFile: (file: FileNode) => void
  onStartCreate: (dirPath: string, kind: CreateKind) => void
  onStartRename: (node: TreeNode) => void
  onSubmitDraft: (name: string) => void
  onCancelDraft: () => void
  onDelete: (node: TreeNode) => void
  onDuplicate: (node: FileNode) => void
  onStartDrag: (e: React.MouseEvent, sourcePath: string, sourceName: string) => void
  forceExpanded?: boolean
}

function TreeLevel({
  node,
  depth,
  activePath,
  draft,
  dragOverPath,
  onOpenFile,
  onStartCreate,
  onStartRename,
  onSubmitDraft,
  onCancelDraft,
  onDelete,
  onDuplicate,
  onStartDrag,
  forceExpanded,
}: TreeLevelProps) {
  const [expanded, setExpanded] = useState(true)
  const isOpen = forceExpanded || expanded
  const indent = { paddingLeft: `${depth * 14 + 8}px` }
  const isRenaming = draft?.mode === 'rename' && draft.node.path === node.path

  if (node.kind === 'file') {
    const isActive = node.path === activePath
    const isDrawing = documentKind(node.name) === 'drawing'
    const glyph = isDrawing ? (
      <IconDrawing className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
    ) : (
      <span className="shrink-0 text-neutral-500">▤</span>
    )

    if (isRenaming) {
      return (
        <div className="flex items-center gap-1.5 py-1 pr-2" style={indent}>
          {glyph}
          <InlineNameInput initialValue={node.name} onSubmit={onSubmitDraft} onCancel={onCancelDraft} />
        </div>
      )
    }

    return (
      <div
        onMouseDown={(e) => onStartDrag(e, node.path, node.name)}
        className="group flex items-center gap-1.5 py-1 pr-2 hover:bg-white/5"
        style={indent}
      >
        <button
          type="button"
          onClick={() => onOpenFile(node)}
          className={`flex flex-1 items-center gap-1.5 truncate text-left ${
            isActive ? 'text-cyan-300' : 'text-neutral-300'
          }`}
          title={node.path}
        >
          {glyph}
          <span className="truncate">{node.name}</span>
        </button>
        <button
          type="button"
          title="Rename"
          onClick={() => onStartRename(node)}
          className="hidden shrink-0 px-1 text-neutral-500 hover:text-cyan-300 group-hover:inline"
        >
          ✎
        </button>
        <button
          type="button"
          title="Duplikat"
          onClick={() => onDuplicate(node)}
          className="hidden shrink-0 px-1 text-neutral-500 hover:text-cyan-300 group-hover:inline"
        >
          ⧉
        </button>
        <button
          type="button"
          title="Hapus (pindah ke stash)"
          onClick={() => onDelete(node)}
          className="hidden shrink-0 px-1 text-neutral-500 hover:text-red-400 group-hover:inline-flex"
        >
          <IconTrash className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  const showCreateInput = isOpen && draft?.mode === 'create' && draft.dirPath === node.path
  const draftKind: CreateKind = draft?.mode === 'create' ? draft.kind : 'file'
  const isDragOver = dragOverPath === node.path

  return (
    <div>
      <div
        data-drop-target={node.path}
        onMouseDown={(e) => {
          if (depth === 0 || isRenaming) return
          onStartDrag(e, node.path, node.name)
        }}
        className={`group flex items-center gap-1.5 py-1 pr-2 text-neutral-400 hover:bg-white/5 ${
          isDragOver ? 'bg-cyan-400/10 outline outline-1 outline-cyan-400/40 -outline-offset-1' : ''
        }`}
        style={indent}
      >
        {isRenaming ? (
          <InlineNameInput initialValue={node.name} onSubmit={onSubmitDraft} onCancel={onCancelDraft} />
        ) : (
          <>
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="flex flex-1 items-center gap-1.5 truncate text-left"
            >
              <span className="shrink-0">{isOpen ? '▾' : '▸'}</span>
              <span className="truncate font-medium">{node.name}</span>
            </button>
            <button
              type="button"
              title="New file"
              onClick={() => onStartCreate(node.path, 'file')}
              className="hidden shrink-0 px-1 text-neutral-500 hover:text-cyan-300 group-hover:inline-flex"
            >
              <IconFilePlus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="New drawing (Excalidraw)"
              onClick={() => onStartCreate(node.path, 'drawing')}
              className="hidden shrink-0 px-1 text-neutral-500 hover:text-cyan-300 group-hover:inline-flex"
            >
              <IconDrawingPlus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="New folder"
              onClick={() => onStartCreate(node.path, 'directory')}
              className="hidden shrink-0 px-1 text-neutral-500 hover:text-cyan-300 group-hover:inline-flex"
            >
              <IconFolderPlus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Rename"
              onClick={() => onStartRename(node)}
              className="hidden shrink-0 px-1 text-neutral-500 hover:text-cyan-300 group-hover:inline"
            >
              ✎
            </button>
            {depth > 0 && (
              <button
                type="button"
                title="Hapus (pindah ke stash)"
                onClick={() => onDelete(node)}
                className="hidden shrink-0 px-1 text-neutral-500 hover:text-red-400 group-hover:inline-flex"
              >
                <IconTrash className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>
      {showCreateInput && (
        <div className="flex items-center gap-1.5 py-1 pr-2" style={{ paddingLeft: `${(depth + 1) * 14 + 8}px` }}>
          {draftKind === 'drawing' ? (
            <IconDrawing className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
          ) : (
            <span className="shrink-0 text-neutral-500">{draftKind === 'file' ? '▤' : '▸'}</span>
          )}
          <InlineNameInput
            initialValue={DRAFT_PLACEHOLDER[draftKind]}
            onSubmit={onSubmitDraft}
            onCancel={onCancelDraft}
          />
        </div>
      )}
      {isOpen &&
        node.children.map((child) => (
          <TreeLevel
            key={child.path}
            node={child}
            depth={depth + 1}
            activePath={activePath}
            draft={draft}
            dragOverPath={dragOverPath}
            onOpenFile={onOpenFile}
            onStartCreate={onStartCreate}
            onStartRename={onStartRename}
            onSubmitDraft={onSubmitDraft}
            onCancelDraft={onCancelDraft}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onStartDrag={onStartDrag}
          />
        ))}
      {isOpen && node.children.length === 0 && !showCreateInput && (
        <p style={{ paddingLeft: `${(depth + 1) * 14 + 8}px` }} className="py-1 text-xs text-neutral-600">
          empty
        </p>
      )}
    </div>
  )
}

interface InlineNameInputProps {
  initialValue: string
  onSubmit: (value: string) => void
  onCancel: () => void
}

function InlineNameInput({ initialValue, onSubmit, onCancel }: InlineNameInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    const dotIndex = initialValue.lastIndexOf('.')
    input.setSelectionRange(0, dotIndex > 0 ? dotIndex : initialValue.length)
  }, [initialValue])

  return (
    <input
      ref={inputRef}
      defaultValue={initialValue}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          cancelledRef.current = true
          e.currentTarget.blur()
        }
      }}
      onBlur={(e) => {
        if (cancelledRef.current) onCancel()
        else onSubmit(e.currentTarget.value)
      }}
      className="w-full rounded border border-cyan-400/50 bg-white/5 px-1.5 py-0.5 text-sm text-neutral-100 outline-none"
    />
  )
}
