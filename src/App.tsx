import { useEffect, useRef, useState } from 'react'
import Workspace from './components/Workspace'
import { loadSpaces, saveSpaces } from './lib/spaces'

interface Tab {
  id: string
  path: string | null
  name: string | null
}

function makeTab(path: string | null = null): Tab {
  return { id: crypto.randomUUID(), path, name: null }
}

function App() {
  const [tabs, setTabs] = useState<Tab[]>(() => [makeTab()])
  const [activeId, setActiveId] = useState<string>(() => tabs[0].id)
  const restored = useRef(false)

  useEffect(() => {
    loadSpaces().then((state) => {
      if (state && state.spaces.length > 0) {
        setTabs(state.spaces.map((s) => ({ id: s.id, path: s.path, name: null })))
        setActiveId(state.spaces.some((s) => s.id === state.activeId) ? state.activeId : state.spaces[0].id)
      }
      restored.current = true
    })
  }, [])

  useEffect(() => {
    if (!restored.current) return
    saveSpaces({ spaces: tabs.map((t) => ({ id: t.id, path: t.path })), activeId })
  }, [tabs, activeId])

  function handleNewTab() {
    const tab = makeTab()
    setTabs((prev) => [...prev, tab])
    setActiveId(tab.id)
  }

  function handleCloseTab(id: string) {
    const idx = tabs.findIndex((t) => t.id === id)
    if (idx === -1) return
    const next = tabs.filter((t) => t.id !== id)

    if (next.length === 0) {
      const fresh = makeTab()
      setTabs([fresh])
      setActiveId(fresh.id)
      return
    }

    setTabs(next)
    if (activeId === id) setActiveId(next[Math.max(0, idx - 1)].id)
  }

  function handleRootChange(id: string, info: { path: string | null; name: string | null }) {
    setTabs((prev) =>
      prev.map((t) => (t.id === id && (t.path !== info.path || t.name !== info.name) ? { ...t, ...info } : t)),
    )
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key.toLowerCase() === 't') {
        e.preventDefault()
        handleNewTab()
      } else if (e.key.toLowerCase() === 'w') {
        e.preventDefault()
        handleCloseTab(activeId)
      } else if (/^[1-9]$/.test(e.key)) {
        const tab = tabs[Number(e.key) - 1]
        if (tab) {
          e.preventDefault()
          setActiveId(tab.id)
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, activeId])

  return (
    <div className="flex h-full flex-col bg-neutral-950">
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/10 bg-neutral-950 px-2 pt-1.5">
        {tabs.map((tab, idx) => (
          <div
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            title={tab.path ?? undefined}
            className={`group flex max-w-[200px] shrink-0 cursor-pointer items-center gap-2 rounded-t-md border border-b-0 px-3 py-1.5 text-xs transition-colors ${
              tab.id === activeId
                ? 'border-white/10 bg-neutral-900 text-neutral-100'
                : 'border-transparent text-neutral-500 hover:bg-white/5 hover:text-neutral-300'
            }`}
          >
            <span className="truncate">{tab.name ?? 'Tab Baru'}</span>
            {idx < 9 && (
              <span className="shrink-0 font-mono text-[10px] text-neutral-600 group-hover:hidden">
                ⌘{idx + 1}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleCloseTab(tab.id)
              }}
              title="Tutup tab (⌘W)"
              className="hidden shrink-0 rounded px-1 text-neutral-600 hover:bg-white/10 hover:text-red-400 group-hover:block"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={handleNewTab}
          title="Tab baru (⌘T)"
          className="ml-1 shrink-0 rounded px-2 py-1 text-sm text-neutral-500 hover:bg-white/10 hover:text-cyan-300"
        >
          +
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {tabs.map((tab) => (
          <div key={tab.id} className={tab.id === activeId ? 'h-full' : 'hidden'}>
            <Workspace
              initialPath={tab.path}
              active={tab.id === activeId}
              onRootChange={(info) => handleRootChange(tab.id, info)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
