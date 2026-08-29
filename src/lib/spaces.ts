import { load, type Store } from '@tauri-apps/plugin-store'

export interface PersistedSpace {
  id: string
  path: string | null
}

export interface PersistedSpacesState {
  spaces: PersistedSpace[]
  activeId: string
}

let storePromise: Promise<Store> | null = null

function getStore() {
  if (!storePromise) storePromise = load('app-state.json')
  return storePromise
}

export async function loadSpaces(): Promise<PersistedSpacesState | null> {
  const store = await getStore()
  return (await store.get<PersistedSpacesState>('openSpaces')) ?? null
}

export async function saveSpaces(state: PersistedSpacesState): Promise<void> {
  const store = await getStore()
  await store.set('openSpaces', state)
  await store.save()
}
