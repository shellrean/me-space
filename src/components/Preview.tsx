import { isValidElement, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Mermaid from './Mermaid'
import CodeBlock from './CodeBlock'
import MarkdownImage from './MarkdownImage'
import { extractLanguage } from '../lib/markdownLang'
import type { Comment } from '../lib/comments'

interface PreviewProps {
  source: string
  animate?: boolean
  /** Absolute path of the file being previewed, so relative image links
   * (an exported drawing, say) can be resolved against its folder. */
  basePath?: string | null
  comments?: Comment[]
  onAddComment?: (text: string, comment: string) => void
  onDeleteComment?: (id: string) => void
}

function tableCellCheckbox(children: React.ReactNode) {
  const text =
    typeof children === 'string'
      ? children
      : Array.isArray(children) && children.length === 1 && typeof children[0] === 'string'
        ? children[0]
        : null

  const match = text?.trim().match(/^\[([ xX])\]$/)
  if (!match) return null

  const checked = match[1].toLowerCase() === 'x'
  return <span className={`table-checkbox${checked ? ' checked' : ''}`} aria-hidden="true" />
}

function unwrapHighlights(container: HTMLElement) {
  container.querySelectorAll('mark.comment-highlight').forEach((mark) => {
    const parent = mark.parentNode
    if (!parent) return
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
  })
}

function applyHighlights(container: HTMLElement, comments: Comment[]) {
  unwrapHighlights(container)

  for (const comment of comments) {
    if (!comment.text) continue
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      const textNode = node as Text
      const idx = textNode.textContent?.indexOf(comment.text) ?? -1
      if (idx === -1) continue

      const range = document.createRange()
      range.setStart(textNode, idx)
      range.setEnd(textNode, idx + comment.text.length)
      const mark = document.createElement('mark')
      mark.className = 'comment-highlight'
      mark.dataset.commentId = comment.id
      range.surroundContents(mark)
      break
    }
  }
}

type Popover =
  | { kind: 'menu'; x: number; y: number; selectedText: string }
  | { kind: 'draft'; x: number; y: number; selectedText: string }
  | { kind: 'view'; x: number; y: number; comment: Comment }

export default function Preview({
  source,
  animate = true,
  basePath = null,
  comments = [],
  onAddComment,
  onDeleteComment,
}: PreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [popover, setPopover] = useState<Popover | null>(null)
  const [draftValue, setDraftValue] = useState('')

  useEffect(() => {
    if (containerRef.current) applyHighlights(containerRef.current, comments)
  }, [source, comments])

  useEffect(() => {
    function handleDocMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (target.closest?.('[data-comment-popover]')) return

      const mark = target.closest?.('mark.comment-highlight') as HTMLElement | null
      if (mark) {
        const found = comments.find((c) => c.id === mark.dataset.commentId)
        if (found) {
          const rect = mark.getBoundingClientRect()
          setPopover({ kind: 'view', x: rect.left, y: rect.bottom + 6, comment: found })
        }
        return
      }

      setPopover(null)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPopover(null)
    }
    document.addEventListener('mousedown', handleDocMouseDown)
    window.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDocMouseDown)
      window.removeEventListener('keydown', handleKey)
    }
  }, [comments])

  function handleContextMenu(e: React.MouseEvent) {
    if (!onAddComment) return
    const selection = window.getSelection()
    const text = selection?.toString().trim() ?? ''
    const anchorNode = selection?.anchorNode
    if (!text || !anchorNode || !containerRef.current?.contains(anchorNode)) return

    e.preventDefault()
    setPopover({ kind: 'menu', x: e.clientX, y: e.clientY, selectedText: text })
  }

  function handleSaveDraft() {
    if (popover?.kind !== 'draft' || !draftValue.trim() || !onAddComment) return
    onAddComment(popover.selectedText, draftValue.trim())
    window.getSelection()?.removeAllRanges()
    setPopover(null)
    setDraftValue('')
  }

  return (
    <div
      ref={containerRef}
      onContextMenu={handleContextMenu}
      className="premium-prose prose prose-invert max-w-none px-10 py-8 prose-pre:bg-transparent prose-pre:p-0"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            const child = Array.isArray(children) ? children[0] : children

            if (
              isValidElement<{ className?: string; children?: React.ReactNode }>(child) &&
              extractLanguage(child.props.className) === 'mermaid'
            ) {
              const code = String(child.props.children ?? '').replace(/\n$/, '')
              return <Mermaid chart={code} animate={animate} />
            }

            if (isValidElement<{ className?: string; children?: React.ReactNode }>(child)) {
              const language = extractLanguage(child.props.className)
              const code = String(child.props.children ?? '').replace(/\n$/, '')
              return <CodeBlock code={code} language={language} />
            }

            return <pre>{children}</pre>
          },
          td({ children, ...props }) {
            const checkbox = tableCellCheckbox(children)
            return (
              <td {...props} className={checkbox ? 'checkbox-cell' : undefined}>
                {checkbox ?? children}
              </td>
            )
          },
          img({ src, alt, title }) {
            return <MarkdownImage src={typeof src === 'string' ? src : undefined} alt={alt} title={title} basePath={basePath} />
          },
          code({ className, children, ...props }) {
            const language = extractLanguage(className)
            if (language) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            }
            return (
              <code className="inline-code" {...props}>
                {children}
              </code>
            )
          },
        }}
      >
        {source}
      </ReactMarkdown>

      {popover?.kind === 'menu' &&
        createPortal(
          <div
            data-comment-popover
            style={{ left: popover.x, top: popover.y }}
            className="fixed z-[150] rounded-lg border border-white/10 bg-[#0b0c10] p-1 shadow-[0_8px_20px_rgba(0,0,0,0.4)]"
          >
            <button
              type="button"
              onClick={() => {
                if (popover.kind !== 'menu') return
                setDraftValue('')
                setPopover({ kind: 'draft', x: popover.x, y: popover.y, selectedText: popover.selectedText })
              }}
              className="flex items-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1.5 text-xs text-neutral-200 hover:bg-white/10"
            >
              💬 Tambah Komentar
            </button>
          </div>,
          document.body,
        )}

      {popover?.kind === 'draft' &&
        createPortal(
          <div
            data-comment-popover
            style={{ left: popover.x, top: popover.y }}
            className="fixed z-[150] w-72 rounded-lg border border-white/10 bg-[#0b0c10] p-3 shadow-[0_8px_20px_rgba(0,0,0,0.4)]"
          >
            <p className="mb-1.5 truncate text-[11px] text-neutral-500">&ldquo;{popover.selectedText}&rdquo;</p>
            <textarea
              autoFocus
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveDraft()
              }}
              placeholder="Tulis komentar… (⌘Enter untuk simpan)"
              rows={3}
              className="w-full resize-none rounded border border-white/10 bg-white/5 p-2 text-xs text-neutral-100 outline-none focus:border-cyan-400/50"
            />
            <div className="mt-2 flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setPopover(null)}
                className="rounded px-2 py-1 text-[11px] text-neutral-500 hover:bg-white/10"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={!draftValue.trim()}
                className="rounded bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-300 hover:bg-cyan-400/20 disabled:opacity-40"
              >
                Simpan
              </button>
            </div>
          </div>,
          document.body,
        )}

      {popover?.kind === 'view' &&
        createPortal(
          <div
            data-comment-popover
            style={{ left: popover.x, top: popover.y }}
            className="fixed z-[150] w-72 rounded-lg border border-white/10 bg-[#0b0c10] p-3 shadow-[0_8px_20px_rgba(0,0,0,0.4)]"
          >
            <p className="mb-1.5 truncate text-[11px] text-neutral-500">&ldquo;{popover.comment.text}&rdquo;</p>
            <p className="text-xs leading-relaxed text-neutral-200">{popover.comment.comment}</p>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (popover.kind !== 'view') return
                  onDeleteComment?.(popover.comment.id)
                  setPopover(null)
                }}
                className="rounded px-2 py-1 text-[11px] text-neutral-500 hover:bg-red-500/10 hover:text-red-400"
              >
                Hapus
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
