import type { JiraConfig } from '../lib/jira'

interface WelcomeScreenProps {
  onOpenFolder: () => void
  onOpenRecent: (path: string) => void
  recentFolders: string[]
  jiraConfig: JiraConfig | null
  jiraIssueCount: number | null
}

function folderName(path: string) {
  const parts = path.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

export default function WelcomeScreen({
  onOpenFolder,
  onOpenRecent,
  recentFolders,
  jiraConfig,
  jiraIssueCount,
}: WelcomeScreenProps) {
  return (
    <div className="col-span-2 flex h-full flex-col items-center justify-center gap-10 overflow-y-auto bg-[#0b0c10] px-6 py-10">
      <div className="text-center">
        <h1
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          className="text-3xl font-semibold text-neutral-100"
        >
          Selamat datang
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">Markdown workspace untuk software engineer.</p>
      </div>

      <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onOpenFolder}
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4 text-left transition hover:border-cyan-400/40 hover:bg-white/[0.04]"
        >
          <p className="text-sm font-medium text-neutral-200">Buka Folder</p>
          <p className="mt-0.5 text-xs text-neutral-500">Mulai kerja dari folder catatan lokal.</p>
        </button>

        <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4 text-left">
          <p className="text-sm font-medium text-neutral-200">Jira</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {jiraConfig
              ? `Terhubung ke ${jiraConfig.site} · ${jiraIssueCount ?? '…'} issue`
              : 'Belum terhubung — isi di sidebar kiri'}
          </p>
        </div>
      </div>

      {recentFolders.length > 0 && (
        <div className="w-full max-w-md">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-neutral-600">Recent</p>
          <div className="overflow-hidden rounded-xl border border-white/10">
            {recentFolders.map((path) => (
              <button
                key={path}
                type="button"
                onClick={() => onOpenRecent(path)}
                title={path}
                className="flex w-full flex-col border-b border-white/5 px-4 py-2.5 text-left last:border-b-0 hover:bg-white/[0.04]"
              >
                <span className="truncate text-sm text-neutral-200">{folderName(path)}</span>
                <span className="truncate text-[11px] text-neutral-600">{path}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
