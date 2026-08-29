import { useEffect, useRef, useState } from 'react'
import { EMOJI_CATEGORIES } from '../lib/emojiData'

interface EmojiPickerButtonProps {
  onSelect: (emoji: string) => void
}

export default function EmojiPickerButton({ onSelect }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as globalThis.Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const normalizedQuery = query.trim().toLowerCase()
  const categories = normalizedQuery
    ? [
        {
          label: 'Hasil',
          emojis: EMOJI_CATEGORIES.flatMap((cat) => cat.emojis).filter((e) =>
            e.name.includes(normalizedQuery),
          ),
        },
      ]
    : EMOJI_CATEGORIES

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Insert emoji"
        className={`rounded px-1.5 py-0.5 text-[13px] ${open ? 'bg-white/10' : 'hover:bg-white/10'}`}
      >
        😀
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#0b0c10] shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
          <div className="border-b border-white/10 p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari emoji…"
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-neutral-100 outline-none focus:border-cyan-400/50"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {categories.map((cat) => (
              <div key={cat.label} className="mb-2 last:mb-0">
                <p className="mb-1 px-1 text-[10px] uppercase tracking-wider text-neutral-600">{cat.label}</p>
                {cat.emojis.length === 0 ? (
                  <p className="px-1 text-xs text-neutral-600">Tidak ditemukan.</p>
                ) : (
                  <div className="grid grid-cols-8 gap-0.5">
                    {cat.emojis.map((e) => (
                      <button
                        key={e.char + e.name}
                        type="button"
                        title={e.name}
                        onClick={() => {
                          onSelect(e.char)
                          setOpen(false)
                          setQuery('')
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded text-base hover:bg-white/10"
                      >
                        {e.char}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
