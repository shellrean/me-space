import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { StashEntry } from '../lib/fileSystem'

interface StashPanelProps {
  entries: StashEntry[]
  onRestore: (entry: StashEntry) => void
  onDeleteForever: (entry: StashEntry) => void
  onClose: () => void
}

export default function StashPanel({ entries, onRestore, onDeleteForever, onClose }: StashPanelProps) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm">
      <div className="flex max-h-[70vh] w-[420px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0b0c10] shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-3">
          <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">
            Stash ({entries.length})
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Tutup (Esc)"
            className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">Stash kosong.</p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.stashName}
                className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5 last:border-b-0 hover:bg-white/[0.03]"
              >
                <span className="shrink-0 text-neutral-500">{entry.kind === 'file' ? '▤' : '▸'}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-neutral-200">{entry.originalName}</p>
                  <p className="truncate text-[11px] text-neutral-600">
                    {new Date(entry.deletedAt).toLocaleString('id-ID')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRestore(entry)}
                  className="shrink-0 rounded border border-white/10 px-2 py-1 text-[11px] text-neutral-300 hover:bg-white/10 hover:text-cyan-300"
                >
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteForever(entry)}
                  className="shrink-0 rounded border border-white/10 px-2 py-1 text-[11px] text-neutral-300 hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-400"
                >
                  Hapus
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
