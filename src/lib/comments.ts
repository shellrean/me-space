import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'

export interface Comment {
  id: string
  text: string
  comment: string
  createdAt: string
}

export type CommentsStore = Record<string, Comment[]>

const COMMENTS_FILE_NAME = '_comments.json'

export async function loadComments(rootPath: string): Promise<CommentsStore> {
  const path = await join(rootPath, COMMENTS_FILE_NAME)
  if (!(await exists(path))) return {}
  try {
    return JSON.parse(await readTextFile(path)) as CommentsStore
  } catch {
    return {}
  }
}

export async function saveComments(rootPath: string, store: CommentsStore): Promise<void> {
  const path = await join(rootPath, COMMENTS_FILE_NAME)
  await writeTextFile(path, JSON.stringify(store, null, 2))
}
