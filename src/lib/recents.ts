import { load, type Store } from '@tauri-apps/plugin-store'

const MAX_RECENTS = 8

let storePromise: Promise<Store> | null = null

function getStore() {
  if (!storePromise) storePromise = load('app-state.json')
  return storePromise
}

export async function loadRecentFolders(): Promise<string[]> {
  const store = await getStore()
  return (await store.get<string[]>('recentFolders')) ?? []
}

export async function addRecentFolder(path: string): Promise<string[]> {
  const store = await getStore()
  const current = (await store.get<string[]>('recentFolders')) ?? []
  const next = [path, ...current.filter((p) => p !== path)].slice(0, MAX_RECENTS)
  await store.set('recentFolders', next)
  await store.save()
  return next
}

export async function removeRecentFolder(path: string): Promise<string[]> {
  const store = await getStore()
  const current = (await store.get<string[]>('recentFolders')) ?? []
  const next = current.filter((p) => p !== path)
  await store.set('recentFolders', next)
  await store.save()
  return next
}
