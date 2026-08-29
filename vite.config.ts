import { createReadStream } from 'node:fs'
import { cp, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/** URL prefix the app points `window.EXCALIDRAW_ASSET_PATH` at (see src/main.tsx). */
const EXCALIDRAW_ASSET_BASE = '/excalidraw-assets/'
const EXCALIDRAW_FONTS_DIR = path.join(
  rootDir,
  'node_modules/@excalidraw/excalidraw/dist/prod/fonts',
)
/**
 * Xiaolai is the CJK handwriting font and alone accounts for ~12MB of the
 * ~13MB font payload. Shipping it would triple the bundle for a font almost
 * no drawing in this app uses, so it's left out — Excalidraw falls back to
 * fetching it from its CDN if a drawing actually needs it.
 */
const EXCLUDED_FONT_FAMILIES = new Set(['Xiaolai'])

const FONT_CONTENT_TYPES: Record<string, string> = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.css': 'text/css',
  '.json': 'application/json',
}

/**
 * Excalidraw loads its fonts lazily at runtime rather than bundling them, and
 * without `EXCALIDRAW_ASSET_PATH` it falls back to a CDN — which a local-first
 * desktop app can't rely on. Serve the package's own font directory under a
 * stable URL in dev, and copy it next to the bundle on build.
 */
function excalidrawAssets(): Plugin {
  const fontsUrlPrefix = `${EXCALIDRAW_ASSET_BASE}fonts/`

  return {
    name: 'excalidraw-assets',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (!url?.startsWith(fontsUrlPrefix)) return next()

        // Resolve inside the fonts dir and reject anything that escapes it.
        const relative = decodeURIComponent(url.slice(fontsUrlPrefix.length))
        const filePath = path.resolve(EXCALIDRAW_FONTS_DIR, relative)
        if (!filePath.startsWith(EXCALIDRAW_FONTS_DIR + path.sep)) {
          res.statusCode = 403
          return res.end()
        }

        // Anything under this prefix is ours, so a miss is a 404 rather than a
        // fall-through — otherwise Vite's SPA fallback would answer with
        // index.html and Excalidraw would try to parse HTML as a font.
        const notFound = () => {
          res.statusCode = 404
          res.end()
        }

        stat(filePath).then(
          (info) => {
            if (!info.isFile()) return notFound()
            res.setHeader(
              'Content-Type',
              FONT_CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
            )
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
            createReadStream(filePath).pipe(res)
          },
          notFound,
        )
      })
    },

    async writeBundle(options) {
      const outDir = options.dir ?? path.join(rootDir, 'dist')
      await cp(EXCALIDRAW_FONTS_DIR, path.join(outDir, 'excalidraw-assets/fonts'), {
        recursive: true,
        filter: (source) => {
          const family = path.relative(EXCALIDRAW_FONTS_DIR, source).split(path.sep)[0]
          return !family || !EXCLUDED_FONT_FAMILIES.has(family)
        },
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), excalidrawAssets()],
})
