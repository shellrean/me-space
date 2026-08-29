import { useEffect, useState } from 'react'
import { readFile } from '@tauri-apps/plugin-fs'
import { dirname, join } from '@tauri-apps/api/path'

const MIME_BY_EXTENSION: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
}

/** `http:`, `data:`, `blob:`, … — anything the webview can already load itself. */
function hasScheme(src: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(src)
}

function mimeTypeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXTENSION[ext] ?? 'application/octet-stream'
}

interface MarkdownImageProps {
  src?: string
  alt?: string
  title?: string
  /** Absolute path of the Markdown file the image is referenced from. */
  basePath: string | null
}

/**
 * Renders `![](diagram.svg)` for images stored next to the Markdown file.
 *
 * The webview can't load a bare filesystem path, so relative sources are
 * resolved against the open file's folder, read through the fs plugin, and
 * handed to the `<img>` as a blob URL. This is what makes an exported drawing
 * show up in the preview.
 */
export default function MarkdownImage({ src, alt, title, basePath }: MarkdownImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const isLocal = !!src && !hasScheme(src) && !!basePath

  useEffect(() => {
    if (!isLocal || !src || !basePath) return

    let cancelled = false
    let url: string | null = null
    setFailed(false)

    ;(async () => {
      try {
        // Markdown percent-encodes spaces and the like; the filesystem wants
        // the decoded name back.
        let relative = src
        try {
          relative = decodeURI(src)
        } catch {
          // Malformed escape — fall back to the raw source.
        }

        const path = relative.startsWith('/') ? relative : await join(await dirname(basePath), relative)
        const bytes = await readFile(path)
        if (cancelled) return

        url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeTypeFor(path) }))
        setObjectUrl(url)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()

    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
      setObjectUrl(null)
    }
  }, [src, basePath, isLocal])

  if (!src) return null

  if (!isLocal) return <img src={src} alt={alt ?? ''} title={title} />

  if (failed) {
    return (
      <span className="inline-block rounded border border-dashed border-white/15 px-2 py-1 font-mono text-[11px] text-neutral-500">
        gambar tidak ditemukan: {src}
      </span>
    )
  }

  if (!objectUrl) {
    return (
      <span className="inline-block rounded border border-white/10 px-2 py-1 font-mono text-[11px] text-neutral-600">
        memuat {src}…
      </span>
    )
  }

  return <img src={objectUrl} alt={alt ?? ''} title={title} />
}
