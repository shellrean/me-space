import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { CommentsStore } from '../lib/comments'
import { IconTrash } from './icons'

interface CommentsPanelProps {
  store: CommentsStore
  onOpenFile: (relPath: string) => void
  onDelete: (relPath: string, id: string) => void
  onClose: () => void
}

export default function CommentsPanel({ store, onOpenFile, onDelete, onClose }: CommentsPanelProps) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const entries = Object.entries(store).filter(([, comments]) => comments.length > 0)

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm">
      <div className="flex max-h-[75vh] w-[480px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0b0c10] shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-3">
          <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">
            Komentar ({entries.reduce((sum, [, c]) => sum + c.length, 0)})
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
            <p className="px-4 py-8 text-center text-sm text-neutral-500">
              Belum ada komentar. Select teks di preview lalu klik kanan untuk menambahkan.
            </p>
          ) : (
            entries.map(([relPath, comments]) => (
              <div key={relPath}>
                <p className="border-b border-white/5 bg-white/[0.02] px-4 py-1.5 font-mono text-[11px] text-neutral-500">
                  {relPath}
                </p>
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-2 border-b border-white/5 px-4 py-2.5 last:border-b-0 hover:bg-white/[0.03]"
                  >
                    <button type="button" onClick={() => onOpenFile(relPath)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-[11px] text-neutral-500">&ldquo;{c.text}&rdquo;</p>
                      <p className="text-xs leading-relaxed text-neutral-200">{c.comment}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(relPath, c.id)}
                      title="Hapus komentar"
                      className="mt-0.5 shrink-0 text-neutral-500 hover:text-red-400"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
