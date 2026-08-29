import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { openUrl } from '@tauri-apps/plugin-opener'
import type { JiraIssueDetail } from '../lib/jira'

interface JiraTicketDetailProps {
  detail: JiraIssueDetail | null
  loading: boolean
  error: string | null
  onClose: () => void
  onSaveToProject?: (detail: JiraIssueDetail) => void
}

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-white/10 text-neutral-300',
  indeterminate: 'bg-cyan-400/10 text-cyan-300',
  done: 'bg-emerald-400/10 text-emerald-300',
}

export default function JiraTicketDetail({ detail, loading, error, onClose, onSaveToProject }: JiraTicketDetailProps) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-[600px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0b0c10] shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-3">
          <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">
            {detail?.key ?? 'Detail Issue'}
          </span>
          <div className="flex items-center gap-2">
            {detail && onSaveToProject && (
              <button
                type="button"
                onClick={() => onSaveToProject(detail)}
                title="Simpan sebagai markdown di folder tickets/ project ini"
                className="rounded px-2 py-1 text-[11px] text-neutral-400 hover:bg-white/10 hover:text-cyan-300"
              >
                Simpan ke Project
              </button>
            )}
            {detail && (
              <button
                type="button"
                onClick={() => openUrl(detail.url)}
                className="rounded px-2 py-1 text-[11px] text-neutral-400 hover:bg-white/10 hover:text-cyan-300"
              >
                Buka di Jira ↗
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              title="Tutup (Esc)"
              className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-white/10"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading && <p className="py-8 text-center text-sm text-neutral-500">Memuat detail…</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {detail && (
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      STATUS_STYLES[detail.statusCategory] ?? STATUS_STYLES.new
                    }`}
                  >
                    {detail.status}
                  </span>
                  <span className="text-[10px] text-neutral-500">{detail.issueType}</span>
                  <span className="text-[10px] text-neutral-500">•</span>
                  <span className="text-[10px] text-neutral-500">{detail.project}</span>
                </div>
                <h2 className="text-base font-medium text-neutral-100">{detail.summary}</h2>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs">
                <span className="text-neutral-500">Assignee</span>
                <span className="text-neutral-300">{detail.assignee}</span>
                <span className="text-neutral-500">Reporter</span>
                <span className="text-neutral-300">{detail.reporter}</span>
                <span className="text-neutral-500">Priority</span>
                <span className="text-neutral-300">{detail.priority}</span>
                <span className="text-neutral-500">Updated</span>
                <span className="text-neutral-300">{new Date(detail.updated).toLocaleString('id-ID')}</span>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-wider text-neutral-500">Deskripsi</p>
                {detail.descriptionHtml ? (
                  <div
                    className="jira-description prose prose-invert prose-sm max-w-none text-neutral-300"
                    dangerouslySetInnerHTML={{ __html: detail.descriptionHtml }}
                  />
                ) : (
                  <p className="text-sm text-neutral-600">Tidak ada deskripsi.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
