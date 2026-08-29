/**
 * Format helpers for `.excalidraw` drawing documents.
 *
 * Deliberately free of any `@excalidraw/excalidraw` import: that bundle is
 * several megabytes and is code-split behind the lazily-loaded
 * `<DrawingCanvas>`, so anything the rest of the app needs before a drawing is
 * ever opened (extension checks, blank-file content, parsing) has to live here
 * instead.
 */

export const DRAWING_EXTENSION = '.excalidraw'

export type DocumentKind = 'markdown' | 'drawing'

/** Which editor a file in the tree should open in, decided by its extension. */
export function documentKind(nameOrPath: string): DocumentKind {
  return nameOrPath.toLowerCase().endsWith(DRAWING_EXTENSION) ? 'drawing' : 'markdown'
}

/** Appends `.excalidraw` unless the name already carries it. */
export function withDrawingExtension(name: string): string {
  return name.toLowerCase().endsWith(DRAWING_EXTENSION) ? name : `${name}${DRAWING_EXTENSION}`
}

/** `foo.excalidraw` → `foo`, so exports can sit next to the drawing. */
export function drawingBaseName(name: string): string {
  return name.toLowerCase().endsWith(DRAWING_EXTENSION)
    ? name.slice(0, -DRAWING_EXTENSION.length)
    : name
}

/** The subset of a scene that `<Excalidraw initialData>` accepts. */
export interface DrawingScene {
  elements: unknown[]
  appState: Record<string, unknown>
  files: Record<string, unknown>
}

export const DRAWING_SOURCE = 'me-space'

export function emptyDrawingContent(): string {
  return `${JSON.stringify(
    {
      type: 'excalidraw',
      version: 2,
      source: DRAWING_SOURCE,
      elements: [],
      // Excalidraw's dark theme inverts the canvas in CSS rather than swapping
      // this value, so a white background is what makes the canvas read dark
      // in-app *and* export correctly for light contexts like a README.
      appState: { viewBackgroundColor: '#ffffff', gridSize: null },
      files: {},
    },
    null,
    2,
  )}\n`
}

/**
 * Reads a drawing file into `initialData`. A drawing that fails to parse is
 * treated as empty rather than throwing: the alternative is an unopenable file
 * with no way back, and Excalidraw itself restores/normalises whatever survives.
 */
export function parseDrawing(content: string): DrawingScene {
  if (!content.trim()) return { elements: [], appState: {}, files: {} }

  try {
    const parsed = JSON.parse(content) as Partial<DrawingScene>
    return {
      elements: Array.isArray(parsed.elements) ? parsed.elements : [],
      appState: parsed.appState && typeof parsed.appState === 'object' ? parsed.appState : {},
      files: parsed.files && typeof parsed.files === 'object' ? parsed.files : {},
    }
  } catch {
    return { elements: [], appState: {}, files: {} }
  }
}
