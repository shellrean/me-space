import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface CodeBlockProps {
  code: string
  language?: string
}

export default function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="code-window my-5 overflow-hidden rounded-xl border border-white/10 bg-[#0b0c10] shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-3.5 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/40" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/40" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-500/40" />
        </div>
        <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
          {language ?? 'text'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-[11px] text-neutral-500 transition hover:text-cyan-300"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: '1rem 1.1rem',
          background: 'transparent',
          fontSize: '13px',
        }}
        codeTagProps={{
          style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
