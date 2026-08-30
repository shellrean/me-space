import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import {
  CaptureUpdateAction,
  Excalidraw,
  MainMenu,
  exportToBlob,
  exportToSvg,
  restore,
  serializeAsJSON,
} from '@excalidraw/excalidraw'
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  LibraryItems,
} from '@excalidraw/excalidraw/types'
import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
} from '@excalidraw/excalidraw/element/types'
import '@excalidraw/excalidraw/index.css'
import { parseDrawing } from '../lib/drawings'
import {
  buildStencilLibraryItems,
  loadUserLibraryItems,
  saveUserLibraryItems,
} from '../lib/drawingLibrary'
import { IconGrid } from './icons'

/**
 * `serializeAsJSON(..., 'local')` keeps every appState key Excalidraw would
 * persist to localStorage — including the viewport (`scrollX`/`scrollY`/`zoom`)
 * and the current selection. For a file-backed document that's pure noise: just
 * panning the canvas would rewrite the file, wake the folder watcher, and dirty
 * the user's git status. Persist only the settings that belong to the drawing
 * itself and drop the rest; everything omitted simply falls back to Excalidraw's
 * defaults on the next open.
 */
const PERSISTED_APP_STATE_KEYS = [
  'viewBackgroundColor',
  'gridSize',
  'gridStep',
  'gridModeEnabled',
  'objectsSnapModeEnabled',
  'exportBackground',
  'exportScale',
  'exportEmbedScene',
  'exportWithDarkMode',
  'frameRendering',
  'name',
] as const

const AUTOSAVE_DELAY_MS = 700

export type ExportFormat = 'svg' | 'png'

export interface DrawingCanvasHandle {
  /** Renders the current scene to image bytes, ready to be written to disk. */
  exportImage: (format: ExportFormat) => Promise<Uint8Array>
}

interface DrawingCanvasProps {
  /** Absolute path of the drawing, handed back on save: a debounced write can
   * land after the user switched files, and it must still target this file. */
  filePath: string
  /** Raw `.excalidraw` file content. Mount this component keyed by file path so
   * a different drawing gets a fresh canvas rather than a stale one. */
  content: string
  /** Debounced autosave, called only when the serialized scene actually changed. */
  onSave: (filePath: string, content: string) => void
}

function serializeScene(
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
): string {
  const scene = JSON.parse(serializeAsJSON(elements, appState, files, 'local')) as {
    appState: Record<string, unknown>
  }
  const trimmed: Record<string, unknown> = {}
  for (const key of PERSISTED_APP_STATE_KEYS) {
    if (key in scene.appState) trimmed[key] = scene.appState[key]
  }
  return `${JSON.stringify({ ...scene, appState: trimmed }, null, 2)}\n`
}

const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(function DrawingCanvas(
  { filePath, content, onSave },
  ref,
) {
  // Parsed once per mount: <Excalidraw> only reads initialData on mount, and
  // the component is keyed by file path so a different drawing remounts.
  const [initialData] = useState<ExcalidrawInitialDataState>(() => ({
    // Scene data comes off disk and can't be statically typed here; Excalidraw
    // runs it through its own `restore` pass, which repairs and fills in
    // anything malformed or missing.
    ...(parseDrawing(content) as ExcalidrawInitialDataState),
    scrollToContent: true,
  }))
  // What the file on disk amounts to once Excalidraw has normalised it — the
  // same `restore()` pass the canvas itself runs on `initialData`. Comparing
  // against this is what keeps merely *opening* a drawing from rewriting it,
  // while still catching the very first edit the user makes. (Seeding from the
  // first onChange instead would swallow that edit whenever Excalidraw doesn't
  // report the initial load.)
  const [initial] = useState(() => {
    const restored = restore(initialData, null, null)
    return {
      serialized: serializeScene(restored.elements, restored.appState, restored.files),
      gridEnabled: restored.appState.gridModeEnabled,
    }
  })
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const saveTimeout = useRef<number | null>(null)
  // Guards the library round-trip: Excalidraw reports an empty library while
  // ours is still loading, and persisting that would wipe the user's items.
  const libraryReady = useRef(false)
  const lastSerialized = useRef(initial.serialized)
  // Mirrored into React state purely so the menu item can render its checkmark;
  // the canvas itself reads the flag straight off its own appState.
  const [gridEnabled, setGridEnabled] = useState(initial.gridEnabled)

  const handleChange = useCallback(
    (elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      setGridEnabled(appState.gridModeEnabled)

      const next = serializeScene(elements, appState, files)
      if (next === lastSerialized.current) return

      if (saveTimeout.current) window.clearTimeout(saveTimeout.current)
      saveTimeout.current = window.setTimeout(() => {
        lastSerialized.current = next
        onSave(filePath, next)
      }, AUTOSAVE_DELAY_MS)
    },
    [filePath, onSave],
  )

  const handleApi = useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api
    if (libraryReady.current) return

    // Built-in stencils are rebuilt from source every time and stacked in front
    // of whatever the user has saved, so deleting one only lasts the session.
    loadUserLibraryItems()
      // A saved library that fails to load shouldn't cost the user the
      // built-in stencils too, so fall back to shipping just those.
      .catch(() => [])
      .then((userItems) =>
        api.updateLibrary({
          libraryItems: [...buildStencilLibraryItems(), ...userItems],
          merge: false,
        }),
      )
      .finally(() => {
        libraryReady.current = true
      })
  }, [])

  const handleLibraryChange = useCallback((items: LibraryItems) => {
    if (!libraryReady.current) return
    saveUserLibraryItems(items)
  }, [])

  useImperativeHandle(ref, () => ({
    async exportImage(format) {
      const api = apiRef.current
      if (!api) throw new Error('Kanvas belum siap.')

      const elements = api.getSceneElements()
      if (elements.length === 0) throw new Error('Gambar masih kosong, tidak ada yang bisa diekspor.')

      const files = api.getFiles()
      // Exports go into Markdown, which is read on a light page — render them
      // in light mode regardless of the dark theme used while drawing.
      const appState = { ...api.getAppState(), exportWithDarkMode: false }

      if (format === 'svg') {
        const svg = await exportToSvg({ elements, appState, files, exportPadding: 16 })
        return new TextEncoder().encode(new XMLSerializer().serializeToString(svg))
      }

      const blob = await exportToBlob({
        elements,
        appState,
        files,
        mimeType: 'image/png',
        exportPadding: 16,
      })
      return new Uint8Array(await blob.arrayBuffer())
    },
  }))

  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={handleApi}
        onLibraryChange={handleLibraryChange}
        initialData={initialData}
        onChange={handleChange}
        theme="dark"
        // The workspace owns ⌘P and the tab shortcuts; letting Excalidraw bind
        // globally would have a background tab's canvas swallow them.
        handleKeyboardGlobally={false}
        // The file on disk *is* the scene and is autosaved, so Excalidraw's own
        // open/save/export-to-disk actions have nothing to add — and they route
        // through browser-fs-access, which the Tauri webview can't satisfy.
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            saveAsImage: false,
            export: false,
          },
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.CommandPalette />
          <MainMenu.Separator />
          {/* Upstream only exposes the grid toggle through the canvas
              right-click menu and ⌘', which is easy to miss — and this app
              trims the rest of the menu, so surface it here too. */}
          <MainMenu.Item
            icon={<IconGrid className="h-4 w-4" />}
            shortcut="⌘'"
            selected={gridEnabled}
            onSelect={() => {
              const api = apiRef.current
              if (!api) return
              api.updateScene({
                appState: { gridModeEnabled: !api.getAppState().gridModeEnabled },
                // Matches the built-in action: toggling the grid is a view
                // preference, not something undo should step back through.
                captureUpdate: CaptureUpdateAction.EVENTUALLY,
              })
            }}
          >
            Grid
          </MainMenu.Item>
          <MainMenu.DefaultItems.ChangeCanvasBackground />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.DefaultItems.Help />
        </MainMenu>
      </Excalidraw>
    </div>
  )
})

export default DrawingCanvas
