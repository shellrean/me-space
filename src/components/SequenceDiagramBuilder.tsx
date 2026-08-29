import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Mermaid from './Mermaid'

interface SequenceDiagramBuilderProps {
  onInsert: (mermaidBlock: string) => void
  onClose: () => void
}

interface Participant {
  id: string
  label: string
}

type Arrow = '->>' | '-->>' | '-)'

type Step =
  | { id: string; kind: 'message'; from: string; to: string; arrow: Arrow; text: string }
  | { id: string; kind: 'note'; position: 'over' | 'left of' | 'right of'; participant: string; text: string }

const ARROW_LABELS: Record<Arrow, string> = {
  '->>': 'Panggil (kirim)',
  '-->>': 'Balas (respons)',
  '-)': 'Async (kirim & lupa)',
}

function nextParticipantId(existing: Participant[]): string {
  const used = new Set(existing.map((p) => p.id))
  for (let i = 0; i < 26; i++) {
    const id = String.fromCharCode(65 + i)
    if (!used.has(id)) return id
  }
  let n = existing.length + 1
  while (used.has(`P${n}`)) n++
  return `P${n}`
}

function generateMermaid(participants: Participant[], steps: Step[]): string {
  const lines = ['sequenceDiagram']
  for (const p of participants) {
    lines.push(`    participant ${p.id} as ${p.label || p.id}`)
  }
  for (const s of steps) {
    if (s.kind === 'message') {
      if (!s.from || !s.to) continue
      lines.push(`    ${s.from}${s.arrow}${s.to}: ${s.text || '...'}`)
    } else {
      if (!s.participant) continue
      lines.push(`    Note ${s.position} ${s.participant}: ${s.text || '...'}`)
    }
  }
  return lines.join('\n')
}

function moveItem<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta
  if (target < 0 || target >= list.length) return list
  const next = [...list]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export default function SequenceDiagramBuilder({ onInsert, onClose }: SequenceDiagramBuilderProps) {
  const [participants, setParticipants] = useState<Participant[]>([
    { id: 'A', label: 'Client' },
    { id: 'B', label: 'Server' },
  ])
  const [steps, setSteps] = useState<Step[]>([])
  const [newParticipantLabel, setNewParticipantLabel] = useState('')

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function addParticipant() {
    const label = newParticipantLabel.trim()
    if (!label) return
    setParticipants((prev) => [...prev, { id: nextParticipantId(prev), label }])
    setNewParticipantLabel('')
  }

  function removeParticipant(id: string) {
    setParticipants((prev) => prev.filter((p) => p.id !== id))
    setSteps((prev) =>
      prev.filter((s) => (s.kind === 'message' ? s.from !== id && s.to !== id : s.participant !== id)),
    )
  }

  function addMessage() {
    if (participants.length < 2) return
    setSteps((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        kind: 'message',
        from: participants[0].id,
        to: participants[1].id,
        arrow: '->>',
        text: '',
      },
    ])
  }

  function addNote() {
    if (participants.length < 1) return
    setSteps((prev) => [
      ...prev,
      { id: crypto.randomUUID(), kind: 'note', position: 'over', participant: participants[0].id, text: '' },
    ])
  }

  function updateStep(id: string, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? ({ ...s, ...patch } as Step) : s)))
  }

  function removeStep(id: string) {
    setSteps((prev) => prev.filter((s) => s.id !== id))
  }

  const code = generateMermaid(participants, steps)

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-[900px] max-w-[95vw] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0b0c10] shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-3">
          <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">
            Sequence Diagram Builder
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

        <div className="grid min-h-0 flex-1 grid-cols-2 divide-x divide-white/10">
          <div className="min-h-0 overflow-y-auto p-4">
            <p className="mb-2 text-[11px] uppercase tracking-wider text-neutral-500">Participant</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {participants.map((p) => (
                <span
                  key={p.id}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-1 pl-2.5 pr-1.5 text-xs text-neutral-200"
                >
                  {p.label}
                  <button
                    type="button"
                    onClick={() => removeParticipant(p.id)}
                    className="flex h-4 w-4 items-center justify-center rounded-full text-neutral-500 hover:bg-white/10 hover:text-red-400"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="mb-5 flex gap-1.5">
              <input
                value={newParticipantLabel}
                onChange={(e) => setNewParticipantLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
                placeholder="Nama participant baru…"
                className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-neutral-100 outline-none focus:border-cyan-400/50"
              />
              <button
                type="button"
                onClick={addParticipant}
                className="shrink-0 rounded border border-white/10 px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-white/10"
              >
                Tambah
              </button>
            </div>

            <p className="mb-2 text-[11px] uppercase tracking-wider text-neutral-500">Langkah</p>
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div key={step.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-600">
                      {step.kind === 'message' ? 'Pesan' : 'Note'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSteps((prev) => moveItem(prev, index, -1))}
                        disabled={index === 0}
                        className="text-neutral-500 hover:text-cyan-300 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => setSteps((prev) => moveItem(prev, index, 1))}
                        disabled={index === steps.length - 1}
                        className="text-neutral-500 hover:text-cyan-300 disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStep(step.id)}
                        className="ml-1 text-neutral-500 hover:text-red-400"
                      >
                        del
                      </button>
                    </div>
                  </div>

                  {step.kind === 'message' ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select
                        value={step.from}
                        onChange={(e) => updateStep(step.id, { from: e.target.value })}
                        className="rounded border border-white/10 bg-white/5 px-1.5 py-1 text-xs text-neutral-200"
                      >
                        {participants.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={step.arrow}
                        onChange={(e) => updateStep(step.id, { arrow: e.target.value as Arrow })}
                        className="rounded border border-white/10 bg-white/5 px-1.5 py-1 text-xs text-neutral-200"
                      >
                        {(Object.keys(ARROW_LABELS) as Arrow[]).map((a) => (
                          <option key={a} value={a}>
                            {ARROW_LABELS[a]}
                          </option>
                        ))}
                      </select>
                      <select
                        value={step.to}
                        onChange={(e) => updateStep(step.id, { to: e.target.value })}
                        className="rounded border border-white/10 bg-white/5 px-1.5 py-1 text-xs text-neutral-200"
                      >
                        {participants.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <input
                        value={step.text}
                        onChange={(e) => updateStep(step.id, { text: e.target.value })}
                        placeholder="Isi pesan…"
                        className="min-w-[120px] flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-neutral-100 outline-none focus:border-cyan-400/50"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select
                        value={step.position}
                        onChange={(e) =>
                          updateStep(step.id, { position: e.target.value as 'over' | 'left of' | 'right of' })
                        }
                        className="rounded border border-white/10 bg-white/5 px-1.5 py-1 text-xs text-neutral-200"
                      >
                        <option value="over">di atas</option>
                        <option value="left of">di kiri</option>
                        <option value="right of">di kanan</option>
                      </select>
                      <select
                        value={step.participant}
                        onChange={(e) => updateStep(step.id, { participant: e.target.value })}
                        className="rounded border border-white/10 bg-white/5 px-1.5 py-1 text-xs text-neutral-200"
                      >
                        {participants.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <input
                        value={step.text}
                        onChange={(e) => updateStep(step.id, { text: e.target.value })}
                        placeholder="Isi note…"
                        className="min-w-[120px] flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-neutral-100 outline-none focus:border-cyan-400/50"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-1.5">
              <button
                type="button"
                onClick={addMessage}
                disabled={participants.length < 2}
                className="rounded border border-white/10 px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-white/10 disabled:opacity-30"
              >
                + Pesan
              </button>
              <button
                type="button"
                onClick={addNote}
                disabled={participants.length < 1}
                className="rounded border border-white/10 px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-white/10 disabled:opacity-30"
              >
                + Note
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-neutral-500">Preview</p>
              <Mermaid chart={code} animate={false} />
            </div>
            <div className="border-t border-white/10 p-4">
              <p className="mb-1.5 text-[11px] uppercase tracking-wider text-neutral-500">Kode Mermaid</p>
              <textarea
                readOnly
                value={code}
                rows={5}
                className="w-full resize-none rounded border border-white/10 bg-white/5 p-2 font-mono text-[11px] text-neutral-400 outline-none"
              />
              <button
                type="button"
                onClick={() => onInsert('```mermaid\n' + code + '\n```\n')}
                className="mt-2 w-full rounded bg-cyan-400/10 py-1.5 text-sm text-cyan-300 hover:bg-cyan-400/20"
              >
                Sisipkan ke Editor
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
