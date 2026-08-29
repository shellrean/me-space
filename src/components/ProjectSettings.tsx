import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ProjectConfig } from '../lib/project'

interface ProjectSettingsProps {
  config: ProjectConfig
  onSave: (config: ProjectConfig) => void
  onClose: () => void
}

export default function ProjectSettings({ config, onSave, onClose }: ProjectSettingsProps) {
  const [name, setName] = useState(config.name)
  const [epicKey, setEpicKey] = useState(config.jiraEpicKey ?? '')

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleSave() {
    onSave({ name: name.trim() || config.name, jiraEpicKey: epicKey.trim() || null })
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm">
      <div className="w-[380px] overflow-hidden rounded-xl border border-white/10 bg-[#0b0c10] shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-3">
          <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">
            Pengaturan Project
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

        <div className="space-y-3 px-4 py-4">
          <div>
            <label className="mb-1 block text-[11px] text-neutral-500">Nama project</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-neutral-100 outline-none focus:border-cyan-400/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-neutral-500">Jira Epic key</label>
            <input
              value={epicKey}
              onChange={(e) => setEpicKey(e.target.value)}
              placeholder="mis. PROJ-100"
              className="w-full rounded border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-neutral-100 outline-none focus:border-cyan-400/50"
            />
            <p className="mt-1 text-[11px] text-neutral-600">
              Issue di bawah epic ini otomatis muncul saat bikin daily standup baru.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="w-full rounded bg-cyan-400/10 py-1.5 text-sm text-cyan-300 hover:bg-cyan-400/20"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
