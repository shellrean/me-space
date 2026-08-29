import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { flattenFiles, type DirNode, type FileNode } from '../lib/fileSystem'
import { fuzzyMatch } from '../lib/fuzzy'
import { IconSearch } from './icons'

interface QuickOpenProps {
  root: DirNode
  onSelect: (file: FileNode) => void
  onClose: () => void
}

interface Ranked {
  file: FileNode
  score: number
  indices: number[]
  relativePath: string
}

const MAX_RESULTS = 50

export default function QuickOpen({ root, onSelect, onClose }: QuickOpenProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const files = useMemo(() => flattenFiles(root), [root])

  const results = useMemo(() => {
    const ranked: Ranked[] = []
    for (const file of files) {
      const match = fuzzyMatch(query, file.name)
      if (!match) continue
      const relativePath = file.path.startsWith(`${root.path}/`)
        ? file.path.slice(root.path.length + 1)
        : file.path
      ranked.push({ file, score: match.score, indices: match.indices, relativePath })
    }
    ranked.sort((a, b) => b.score - a.score || a.file.name.localeCompare(b.file.name))
    return ranked.slice(0, MAX_RESULTS)
  }, [files, query, root.path])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // Handled globally (not just on the input's onKeyDown) so Esc still closes
  // this even if focus has moved off the input, e.g. after hovering/clicking
  // a result row — matches every other modal in the app.
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [onClose])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const chosen = results[selectedIndex]
      if (chosen) onSelect(chosen.file)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-neutral-950/70 pt-[15vh] backdrop-blur-sm">
      <div className="w-[520px] max-w-[90vw] overflow-hidden rounded-xl border border-white/10 bg-[#0b0c10] shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2 border-b border-white/10 px-3.5 py-2.5">
          <IconSearch className="h-4 w-4 shrink-0 text-neutral-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Cari file di folder ini…"
            className="w-full bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
          />
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1.5">
          {results.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-xs text-neutral-600">Tidak ada file yang cocok.</p>
          ) : (
            results.map((r, i) => (
              <button
                key={r.file.path}
                type="button"
                data-index={i}
                onClick={() => onSelect(r.file)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`flex w-full flex-col gap-0.5 px-3.5 py-2 text-left ${
                  i === selectedIndex ? 'bg-cyan-400/10' : ''
                }`}
              >
                <span className="truncate text-sm text-neutral-200">
                  <HighlightedName name={r.file.name} indices={r.indices} />
                </span>
                <span className="truncate text-[11px] text-neutral-600">{r.relativePath}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function HighlightedName({ name, indices }: { name: string; indices: number[] }) {
  const indexSet = useMemo(() => new Set(indices), [indices])
  return (
    <>
      {[...name].map((ch, i) => (
        <span key={i} className={indexSet.has(i) ? 'text-cyan-300' : undefined}>
          {ch}
        </span>
      ))}
    </>
  )
}
