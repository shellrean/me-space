import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import { load, type Store } from '@tauri-apps/plugin-store'
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import type { LibraryItem, LibraryItems } from '@excalidraw/excalidraw/types'
import type { NonDeleted, ExcalidrawElement } from '@excalidraw/excalidraw/element/types'

/**
 * Built-in stencils for the drawing canvas, exposed through Excalidraw's own
 * library panel (the book icon in the toolbar) so they can be dragged onto a
 * canvas like any other library item.
 *
 * This module pulls in `@excalidraw/excalidraw` at runtime, so it must only
 * ever be imported from `<DrawingCanvas>` — the lazily-loaded chunk. Importing
 * it from anywhere the workspace always loads would drag Excalidraw into the
 * main bundle.
 */

const STROKE = '#1e1e1e'
const BLUE = '#a5d8ff'
const GREEN = '#b2f2bb'
const YELLOW = '#ffec99'

/** Excalidraw brands its point tuples; skeletons still take plain pairs. */
type Points = ExcalidrawElementSkeleton extends { points?: infer P } ? P : never
const points = (pairs: [number, number][]) => pairs as unknown as Points

const shared = {
  strokeColor: STROKE,
  fillStyle: 'solid',
  strokeWidth: 2,
} as const

/** Short pin marks around the CPU chip, three to a side. */
function cpuPins(): ExcalidrawElementSkeleton[] {
  const offsets = [30, 50, 70]
  const pins: ExcalidrawElementSkeleton[] = []

  for (const at of offsets) {
    // top, bottom, left, right
    pins.push(
      { type: 'line', x: at, y: 0, points: points([[0, 0], [0, 12]]), ...shared },
      { type: 'line', x: at, y: 98, points: points([[0, 0], [0, 12]]), ...shared },
      { type: 'line', x: 0, y: at, points: points([[0, 0], [12, 0]]), ...shared },
      { type: 'line', x: 98, y: at, points: points([[0, 0], [12, 0]]), ...shared },
    )
  }

  return pins
}

const STENCILS: { id: string; name: string; skeleton: ExcalidrawElementSkeleton[] }[] = [
  {
    id: 'stencil-database',
    name: 'Database',
    skeleton: [
      // Body silhouette drawn as one filled line: left side, the belly curve,
      // right side. Excalidraw closes a filled line back to its first point,
      // and the rim ellipse below is stacked on top to hide that straight edge.
      {
        type: 'line',
        x: 0,
        y: 0,
        points: points([
          [0, 15],
          [0, 100],
          [50, 120],
          [100, 100],
          [100, 15],
        ]),
        roundness: { type: 2 },
        backgroundColor: BLUE,
        ...shared,
      },
      { type: 'ellipse', x: 0, y: 0, width: 100, height: 30, backgroundColor: BLUE, ...shared },
      { type: 'text', x: 38, y: 55, text: 'DB', fontSize: 20, textAlign: 'center', strokeColor: STROKE },
    ],
  },
  {
    id: 'stencil-gateway',
    name: 'Gateway',
    skeleton: [
      {
        type: 'diamond',
        x: 0,
        y: 0,
        width: 180,
        height: 110,
        backgroundColor: GREEN,
        label: { text: 'GATEWAY', fontSize: 16 },
        ...shared,
      },
    ],
  },
  {
    id: 'stencil-cpu',
    name: 'CPU',
    skeleton: [
      ...cpuPins(),
      {
        type: 'rectangle',
        x: 10,
        y: 10,
        width: 90,
        height: 90,
        roundness: { type: 3 },
        backgroundColor: YELLOW,
        label: { text: 'CPU', fontSize: 20 },
        ...shared,
      },
    ],
  },
]

const STENCIL_IDS = new Set(STENCILS.map((s) => s.id))

export function buildStencilLibraryItems(): LibraryItem[] {
  return STENCILS.map((stencil) => ({
    id: stencil.id,
    status: 'unpublished' as const,
    name: stencil.name,
    created: 0,
    elements: convertToExcalidrawElements(stencil.skeleton) as readonly NonDeleted<ExcalidrawElement>[],
  }))
}

const STORE_KEY = 'drawingLibrary'

let storePromise: Promise<Store> | null = null

function getStore() {
  if (!storePromise) storePromise = load('app-state.json')
  return storePromise
}

/**
 * The user's own library items. Built-in stencils are deliberately excluded:
 * they're rebuilt from source on every load, so persisting them would pin them
 * to whatever shape they had the day they were saved.
 */
export async function loadUserLibraryItems(): Promise<LibraryItems> {
  const store = await getStore()
  return (await store.get<LibraryItem[]>(STORE_KEY)) ?? []
}

export async function saveUserLibraryItems(items: LibraryItems): Promise<void> {
  const store = await getStore()
  await store.set(
    STORE_KEY,
    items.filter((item) => !STENCIL_IDS.has(item.id)),
  )
  await store.save()
}
