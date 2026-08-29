import { exists, readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'
import TurndownService from 'turndown'
import type { FileNode } from './fileSystem'
import type { JiraIssue, JiraIssueDetail } from './jira'

export interface ProjectConfig {
  name: string
  jiraEpicKey: string | null
}

const PROJECT_FILE_NAME = 'project.json'
const STANDUPS_DIR_NAME = 'standups'
const TODO_FILE_NAME = 'TODO.md'
const TICKETS_DIR_NAME = 'tickets'
const TICKET_STATUS_DIR_NAME = 'ticket-status'

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
})

// turndown has no table support at all by default, and the official GFM
// plugin only converts a table if its header row is marked up with real
// <th>/<thead> — Jira's rendered tables don't reliably do that (often just
// styled <td> cells). Treat the first row as the header unconditionally,
// which matches how Jira tables actually look.
turndownService.addRule('jiraTable', {
  filter: 'table',
  replacement: (_content, node) => {
    const table = node as HTMLTableElement
    const rows = Array.from(table.rows)
    if (rows.length === 0) return ''

    const cellText = (cell: HTMLTableCellElement) =>
      (cell.textContent ?? '').trim().replace(/\|/g, '\\|').replace(/\s+/g, ' ')
    const rowLine = (row: HTMLTableRowElement) => `| ${Array.from(row.cells).map(cellText).join(' | ')} |`

    const [headerRow, ...bodyRows] = rows
    const separator = `| ${Array.from(headerRow.cells)
      .map(() => '---')
      .join(' | ')} |`

    return `\n\n${[rowLine(headerRow), separator, ...bodyRows.map(rowLine)].join('\n')}\n\n`
  },
})

// Jira's rendered HTML wraps code blocks in nested divs with syntax-highlight
// spans (not a plain `<pre><code>`), so turndown's built-in `pre` rule often
// fails to match and the code falls through to generic text handling —
// losing the fence and sometimes escaping markdown characters inside the
// code. Match any `<pre>` regardless of its internal structure and pull the
// raw text content directly instead.
turndownService.addRule('jiraCodeBlock', {
  filter: (node) => node.nodeName === 'PRE',
  replacement: (_content, node) => {
    const element = node as HTMLElement
    const codeEl = element.querySelector('code')
    const text = (codeEl ?? element).textContent ?? ''
    const classSource = codeEl?.className || element.className || ''
    const langMatch = /(?:language|code|lang)-(\w+)/.exec(classSource)
    const lang = langMatch?.[1] ?? ''
    return `\n\n\`\`\`${lang}\n${text.replace(/\n+$/, '')}\n\`\`\`\n\n`
  },
})

// Same issue for the inline "code" mark: Jira doesn't always render it as a
// plain `<code>` tag turndown recognizes — it can be a `<span>` with a
// generated class name (e.g. from Atlaskit) instead. Match `<code>`/`<tt>`
// explicitly plus any `<span>` whose class hints at inline code, so it still
// becomes backtick-wrapped text either way.
turndownService.addRule('jiraInlineCode', {
  filter: (node) => {
    if (node.nodeName === 'CODE' || node.nodeName === 'TT') return true
    if (node.nodeName === 'SPAN') {
      return /code|monospace/i.test((node as HTMLElement).className || '')
    }
    return false
  },
  replacement: (_content, node) => {
    const text = (node as HTMLElement).textContent ?? ''
    if (!text.trim()) return text
    const useDouble = text.includes('`')
    const fence = useDouble ? '``' : '`'
    const pad = useDouble ? ' ' : ''
    return `${fence}${pad}${text}${pad}${fence}`
  },
})

export async function loadProjectConfig(rootPath: string, fallbackName: string): Promise<ProjectConfig> {
  const path = await join(rootPath, PROJECT_FILE_NAME)
  if (!(await exists(path))) {
    return { name: fallbackName, jiraEpicKey: null }
  }
  try {
    const raw = JSON.parse(await readTextFile(path)) as Partial<ProjectConfig>
    return { name: raw.name ?? fallbackName, jiraEpicKey: raw.jiraEpicKey ?? null }
  } catch {
    return { name: fallbackName, jiraEpicKey: null }
  }
}

export async function saveProjectConfig(rootPath: string, config: ProjectConfig): Promise<void> {
  const path = await join(rootPath, PROJECT_FILE_NAME)
  await writeTextFile(path, JSON.stringify(config, null, 2))
}

function todayDateString(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

interface EpicIssueRef {
  key: string
  summary: string
}

export async function ensureTodayStandup(
  rootPath: string,
  epicIssues: EpicIssueRef[],
): Promise<{ node: FileNode; created: boolean }> {
  const date = todayDateString()
  const dirPath = await join(rootPath, STANDUPS_DIR_NAME)
  if (!(await exists(dirPath))) await mkdir(dirPath, { recursive: true })

  const fileName = `${date}.md`
  const filePath = await join(dirPath, fileName)

  if (await exists(filePath)) {
    return { node: { kind: 'file', name: fileName, path: filePath }, created: false }
  }

  const epicSection =
    epicIssues.length > 0
      ? `\n## Issue Epic\n\n${epicIssues.map((i) => `- [ ] ${i.key} — ${i.summary}`).join('\n')}\n`
      : ''

  const template = `# Daily Standup — ${date}

## Kemarin

-

## Hari ini

-

## Blocker

-
${epicSection}`

  await writeTextFile(filePath, template)
  return { node: { kind: 'file', name: fileName, path: filePath }, created: true }
}

export async function ensureTodoFile(rootPath: string): Promise<{ node: FileNode; created: boolean }> {
  const filePath = await join(rootPath, TODO_FILE_NAME)

  if (await exists(filePath)) {
    return { node: { kind: 'file', name: TODO_FILE_NAME, path: filePath }, created: false }
  }

  const template = `# Todo

## In Progress

- [ ]

## Blocked

- [ ]

## Done

- [ ]
`
  await writeTextFile(filePath, template)
  return { node: { kind: 'file', name: TODO_FILE_NAME, path: filePath }, created: true }
}

/**
 * Saves a Jira ticket into `tickets/{KEY}.md` inside the project, converting
 * the rendered HTML description to Markdown. Always overwrites, so re-saving
 * a ticket refreshes it with the latest content from Jira.
 */
export async function saveTicketToProject(rootPath: string, detail: JiraIssueDetail): Promise<FileNode> {
  const dirPath = await join(rootPath, TICKETS_DIR_NAME)
  if (!(await exists(dirPath))) await mkdir(dirPath, { recursive: true })

  const fileName = `${detail.key}.md`
  const filePath = await join(dirPath, fileName)

  const description = detail.descriptionHtml
    ? turndownService.turndown(detail.descriptionHtml)
    : '_Tidak ada deskripsi._'

  const content = `# ${detail.key}: ${detail.summary}

- **Status:** ${detail.status}
- **Tipe:** ${detail.issueType}
- **Priority:** ${detail.priority}
- **Assignee:** ${detail.assignee}
- **Reporter:** ${detail.reporter}
- **Project:** ${detail.project}
- **Updated:** ${new Date(detail.updated).toLocaleString('id-ID')}

## Deskripsi

${description}

---

[Buka di Jira](${detail.url})
`

  await writeTextFile(filePath, content)
  return { kind: 'file', name: fileName, path: filePath }
}

function sanitizeMermaidId(text: string): string {
  return text.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function escapeYamlSingleQuoted(text: string): string {
  return text.replace(/\r?\n/g, ' ').replace(/'/g, "''")
}

const STATUS_CATEGORY_ORDER: Record<string, number> = { new: 0, indeterminate: 1, done: 2 }

/**
 * Mermaid's `kanban` diagram natively supports per-card metadata
 * (`ticket`/`assigned`/`priority`) via `@{ ... }` shape data — a good fit for
 * a Jira-derived board. Columns are grouped by the issue's actual status
 * (not just the 3 coarse categories) so it matches the real board, ordered
 * roughly todo → in progress → done using the status category as a tiebreak.
 */
export function generateKanbanFromIssues(issues: JiraIssue[]): string {
  const columns = new Map<string, JiraIssue[]>()
  for (const issue of issues) {
    const list = columns.get(issue.status) ?? []
    list.push(issue)
    columns.set(issue.status, list)
  }

  const sortedColumns = [...columns.entries()].sort(([, a], [, b]) => {
    const rank = (list: JiraIssue[]) => STATUS_CATEGORY_ORDER[list[0]?.statusCategory ?? 'new'] ?? 1
    return rank(a) - rank(b)
  })

  const lines = ['kanban']
  for (const [status, statusIssues] of sortedColumns) {
    lines.push(`  ${sanitizeMermaidId(status)}[${status}]`)
    for (const issue of statusIssues) {
      const label = escapeYamlSingleQuoted(issue.summary)
      const assigned = escapeYamlSingleQuoted(issue.assignee || 'Unassigned')
      const priority = escapeYamlSingleQuoted(issue.priority || '—')
      lines.push(
        `    ${sanitizeMermaidId(issue.key)}[${issue.key}]@{ ticket: '${issue.key}', assigned: '${assigned}', priority: '${priority}', label: '${label}' }`,
      )
    }
  }
  return lines.join('\n')
}

/**
 * Writes today's kanban snapshot to `ticket-status/{date}.md`, always
 * overwriting so re-running later the same day refreshes it — but each new
 * calendar day gets its own file, building a history of the board over time.
 */
export async function saveKanbanSnapshot(rootPath: string, issues: JiraIssue[]): Promise<FileNode> {
  const date = todayDateString()
  const dirPath = await join(rootPath, TICKET_STATUS_DIR_NAME)
  if (!(await exists(dirPath))) await mkdir(dirPath, { recursive: true })

  const fileName = `${date}.md`
  const filePath = await join(dirPath, fileName)

  const kanban = generateKanbanFromIssues(issues)
  const content = `# Ticket Status — ${date}

\`\`\`mermaid
${kanban}
\`\`\`
`

  await writeTextFile(filePath, content)
  return { kind: 'file', name: fileName, path: filePath }
}
