import { useState } from 'react'
import type { JiraConfig, JiraIssue } from '../lib/jira'
import { IconSearch } from './icons'

interface JiraSidebarSectionProps {
  config: JiraConfig | null
  checked: boolean
  issues: JiraIssue[] | null
  loading: boolean
  error: string | null
  selectedKey: string | null
  onlyMine: boolean
  onToggleOnlyMine: () => void
  epicKey: string | null
  onConnect: (config: JiraConfig) => void
  onDisconnect: () => void
  onSelectIssue: (key: string) => void
}

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-white/10 text-neutral-300',
  indeterminate: 'bg-cyan-400/10 text-cyan-300',
  done: 'bg-emerald-400/10 text-emerald-300',
}

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase())
}

export default function JiraSidebarSection({
  config,
  checked,
  issues,
  loading,
  error,
  selectedKey,
  onlyMine,
  onToggleOnlyMine,
  epicKey,
  onConnect,
  onDisconnect,
  onSelectIssue,
}: JiraSidebarSectionProps) {
  const [siteInput, setSiteInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (!checked) {
    return <p className="px-3 py-3 text-xs text-neutral-600">Memuat…</p>
  }

  if (!config) {
    return (
      <div className="space-y-2 px-3 py-3">
        <p className="text-[11px] leading-relaxed text-neutral-500">
          Hubungkan Jira Cloud untuk melihat issue kamu di sini.
        </p>
        <input
          value={siteInput}
          onChange={(e) => setSiteInput(e.target.value)}
          placeholder="perusahaan.atlassian.net"
          className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-neutral-100 outline-none focus:border-cyan-400/50"
        />
        <input
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="email@perusahaan.com"
          className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-neutral-100 outline-none focus:border-cyan-400/50"
        />
        <input
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          type="password"
          placeholder="API token"
          className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-neutral-100 outline-none focus:border-cyan-400/50"
        />
        {error && <p className="text-[11px] text-red-400">{error}</p>}
        <button
          type="button"
          disabled={loading}
          onClick={() => onConnect({ site: siteInput, email: emailInput, apiToken: tokenInput })}
          className="w-full rounded bg-cyan-400/10 py-1 text-xs text-cyan-300 hover:bg-cyan-400/20 disabled:opacity-50"
        >
          {loading ? 'Menyambungkan…' : 'Connect'}
        </button>
      </div>
    )
  }

  const trimmedQuery = query.trim()

  const displayIssues = trimmedQuery
    ? (issues ?? []).flatMap((issue) => {
        const parentMatches = matchesQuery(issue.key, trimmedQuery) || matchesQuery(issue.summary, trimmedQuery)
        const matchingSubtasks = issue.subtasks.filter(
          (sub) => matchesQuery(sub.key, trimmedQuery) || matchesQuery(sub.summary, trimmedQuery),
        )
        if (!parentMatches && matchingSubtasks.length === 0) return []
        return [{ ...issue, subtasks: parentMatches ? issue.subtasks : matchingSubtasks }]
      })
    : issues

  return (
    <div>
      {epicKey && (
        <p className="px-3 pt-2 text-[11px] text-violet-300">
          Scoped ke epic <span className="font-mono">{epicKey}</span>
        </p>
      )}
      <div className="relative px-3 pt-2">
        <IconSearch className="pointer-events-none absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-600" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nomor tiket…"
          className="w-full rounded border border-white/10 bg-white/5 py-1 pl-7 pr-6 text-xs text-neutral-100 outline-none focus:border-cyan-400/50"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
          >
            ✕
          </button>
        )}
      </div>
      <label className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-neutral-400">
        <input
          type="checkbox"
          checked={onlyMine}
          onChange={onToggleOnlyMine}
          className="accent-cyan-400"
        />
        Assigned ke saya
      </label>
      {error && <p className="px-3 py-2 text-[11px] text-red-400">{error}</p>}
      {loading && !issues && <p className="px-3 py-3 text-xs text-neutral-600">Memuat issue…</p>}
      {issues?.length === 0 && <p className="px-3 py-3 text-xs text-neutral-600">Tidak ada issue.</p>}
      {issues && issues.length > 0 && displayIssues?.length === 0 && (
        <p className="px-3 py-3 text-xs text-neutral-600">Tidak ada tiket yang cocok.</p>
      )}
      {displayIssues?.map((issue) => {
        const hasSubtasks = issue.subtasks.length > 0
        const isExpanded = trimmedQuery ? true : expanded.has(issue.key)
        return (
          <div key={issue.key}>
            <div
              className={`flex items-center gap-0.5 hover:bg-white/5 ${
                selectedKey === issue.key ? 'bg-white/10' : ''
              }`}
            >
              {hasSubtasks ? (
                <button
                  type="button"
                  onClick={() => toggleExpand(issue.key)}
                  className="w-5 shrink-0 self-stretch text-center text-neutral-500 hover:text-cyan-300"
                >
                  {isExpanded ? '▾' : '▸'}
                </button>
              ) : (
                <span className="w-5 shrink-0" />
              )}
              <button
                type="button"
                onClick={() => onSelectIssue(issue.key)}
                className="flex min-w-0 flex-1 flex-col gap-1 py-2 pr-3 text-left"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-neutral-500">{issue.key}</span>
                  <span
                    className={`rounded px-1 py-0.5 text-[9px] ${
                      STATUS_STYLES[issue.statusCategory] ?? STATUS_STYLES.new
                    }`}
                  >
                    {issue.status}
                  </span>
                  {hasSubtasks && (
                    <span className="text-[9px] text-neutral-600">{issue.subtasks.length} sub</span>
                  )}
                </div>
                <p className="truncate text-xs text-neutral-300">{issue.summary}</p>
              </button>
            </div>
            {isExpanded &&
              issue.subtasks.map((sub) => (
                <button
                  key={sub.key}
                  type="button"
                  onClick={() => onSelectIssue(sub.key)}
                  className={`flex w-full flex-col gap-1 py-1.5 pl-8 pr-3 text-left hover:bg-white/5 ${
                    selectedKey === sub.key ? 'bg-white/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-neutral-500">{sub.key}</span>
                    <span
                      className={`rounded px-1 py-0.5 text-[9px] ${
                        STATUS_STYLES[sub.statusCategory] ?? STATUS_STYLES.new
                      }`}
                    >
                      {sub.status}
                    </span>
                  </div>
                  <span className="truncate text-[11px] text-neutral-400">{sub.summary}</span>
                </button>
              ))}
          </div>
        )
      })}
      <button
        type="button"
        onClick={onDisconnect}
        className="w-full px-3 py-2 text-left text-[11px] text-neutral-600 hover:text-red-400"
      >
        Disconnect
      </button>
    </div>
  )
}
