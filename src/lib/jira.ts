import { invoke } from '@tauri-apps/api/core'
import { load, type Store } from '@tauri-apps/plugin-store'

export interface JiraConfig {
  site: string
  email: string
  apiToken: string
}

export interface JiraSubtask {
  key: string
  summary: string
  status: string
  statusCategory: string
}

export interface JiraIssue {
  key: string
  summary: string
  status: string
  statusCategory: string
  issueType: string
  priority: string
  project: string
  updated: string
  url: string
  assignee: string
  subtasks: JiraSubtask[]
}

export interface JiraIssueDetail extends JiraIssue {
  assignee: string
  reporter: string
  created: string
  descriptionHtml: string | null
}

let storePromise: Promise<Store> | null = null

function getStore() {
  if (!storePromise) storePromise = load('jira-config.json')
  return storePromise
}

function normalizeSite(site: string) {
  return site.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
}

export async function loadJiraConfig(): Promise<JiraConfig | null> {
  const store = await getStore()
  const config = await store.get<JiraConfig>('config')
  return config ?? null
}

export async function saveJiraConfig(config: JiraConfig): Promise<void> {
  const store = await getStore()
  await store.set('config', { ...config, site: normalizeSite(config.site) })
  await store.save()
}

export async function clearJiraConfig(): Promise<void> {
  const store = await getStore()
  await store.delete('config')
  await store.save()
}

interface JiraSearchResponseIssue {
  key: string
  fields: {
    summary: string
    status: { name: string; statusCategory: { key: string } }
    issuetype: { name: string }
    priority?: { name: string }
    project: { name: string }
    updated: string
    assignee?: { displayName: string }
    subtasks?: Array<{
      key: string
      fields: {
        summary: string
        status: { name: string; statusCategory: { key: string } }
      }
    }>
  }
}

interface JiraSearchResponse {
  issues: JiraSearchResponseIssue[]
}

async function searchIssues(config: JiraConfig, jql: string): Promise<JiraIssue[]> {
  const site = normalizeSite(config.site)
  const raw = await invoke<JiraSearchResponse>('jira_search_issues', {
    site,
    email: config.email,
    apiToken: config.apiToken,
    jql,
  })

  return raw.issues.map((issue) => ({
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
    statusCategory: issue.fields.status.statusCategory.key,
    issueType: issue.fields.issuetype.name,
    priority: issue.fields.priority?.name ?? '—',
    project: issue.fields.project.name,
    updated: issue.fields.updated,
    url: `https://${site}/browse/${issue.key}`,
    assignee: issue.fields.assignee?.displayName ?? 'Unassigned',
    subtasks: (issue.fields.subtasks ?? []).map((sub) => ({
      key: sub.key,
      summary: sub.fields.summary,
      status: sub.fields.status.name,
      statusCategory: sub.fields.status.statusCategory.key,
    })),
  }))
}

export interface FetchIssuesOptions {
  onlyMine: boolean
  epicKey?: string | null
}

export async function fetchIssues(config: JiraConfig, options: FetchIssuesOptions): Promise<JiraIssue[]> {
  if (options.epicKey && options.onlyMine) {
    return fetchEpicIssuesForMe(config, options.epicKey)
  }

  const conditions = ['resolution = Unresolved', 'issuetype != Subtask']
  if (options.epicKey) conditions.push(`parent = "${options.epicKey}"`)
  if (options.onlyMine) conditions.push('assignee = currentUser()')
  const jql = `${conditions.join(' AND ')} ORDER BY updated DESC`
  return searchIssues(config, jql)
}

/**
 * `assignee = currentUser()` on the epic's direct children only checks the
 * story/task level — it misses issues where I'm assigned to a *subtask* but
 * not the parent story. Fetch the full epic tree first, then a second query
 * that matches "my" work at either level (story key or subtask parent key),
 * and keep only branches that touch me.
 */
async function fetchEpicIssuesForMe(config: JiraConfig, epicKey: string): Promise<JiraIssue[]> {
  const all = await searchIssues(
    config,
    `parent = "${epicKey}" AND issuetype != Subtask AND resolution = Unresolved ORDER BY updated DESC`,
  )
  if (all.length === 0) return []

  const keyList = all.map((issue) => `"${issue.key}"`).join(',')
  const mine = await searchIssues(
    config,
    `assignee = currentUser() AND resolution = Unresolved AND (key in (${keyList}) OR parent in (${keyList}))`,
  )
  const mineKeys = new Set(mine.map((issue) => issue.key))

  return all
    .filter((issue) => mineKeys.has(issue.key) || issue.subtasks.some((sub) => mineKeys.has(sub.key)))
    .map((issue) => ({
      ...issue,
      subtasks: issue.subtasks.filter((sub) => mineKeys.has(sub.key)),
    }))
}

export async function fetchEpicIssues(config: JiraConfig, epicKey: string): Promise<JiraIssue[]> {
  return searchIssues(config, `parent = "${epicKey}" ORDER BY status`)
}

interface JiraGetIssueResponse {
  key: string
  fields: {
    summary: string
    status: { name: string; statusCategory: { key: string } }
    issuetype: { name: string }
    priority?: { name: string }
    project: { name: string }
    updated: string
    created: string
    assignee?: { displayName: string }
    reporter?: { displayName: string }
  }
  renderedFields?: {
    description?: string | null
  }
}

export async function fetchIssueDetail(config: JiraConfig, issueKey: string): Promise<JiraIssueDetail> {
  const site = normalizeSite(config.site)
  const raw = await invoke<JiraGetIssueResponse>('jira_get_issue', {
    site,
    email: config.email,
    apiToken: config.apiToken,
    issueKey,
  })

  return {
    key: raw.key,
    summary: raw.fields.summary,
    status: raw.fields.status.name,
    statusCategory: raw.fields.status.statusCategory.key,
    issueType: raw.fields.issuetype.name,
    priority: raw.fields.priority?.name ?? '—',
    project: raw.fields.project.name,
    updated: raw.fields.updated,
    created: raw.fields.created,
    assignee: raw.fields.assignee?.displayName ?? 'Unassigned',
    reporter: raw.fields.reporter?.displayName ?? '—',
    descriptionHtml: raw.renderedFields?.description ?? null,
    url: `https://${site}/browse/${raw.key}`,
    subtasks: [],
  }
}
