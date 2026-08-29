import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import '@xterm/xterm/css/xterm.css'

interface TerminalPanelProps {
  cwd: string | null
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export default function TerminalPanel({ cwd }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new XTerm({
      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 13,
      cursorBlink: true,
      theme: {
        background: '#0b0c10',
        foreground: '#d4d4d8',
        cursor: '#22d3ee',
        selectionBackground: 'rgba(167, 139, 250, 0.3)',
      },
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)
    fitAddon.fit()

    let disposed = false

    invoke('pty_spawn', { cwd }).catch((err) => {
      term.writeln(`\x1b[31m[error] ${err}\x1b[0m`)
    })

    const outputUnlisten = listen<string>('pty-output', (event) => {
      if (disposed) return
      term.write(decodeBase64(event.payload))
    })

    const dataDisposable = term.onData((data) => {
      invoke('pty_write', { data }).catch(() => {})
    })

    function syncSize() {
      fitAddon.fit()
      invoke('pty_resize', { rows: term.rows, cols: term.cols }).catch(() => {})
    }
    syncSize()

    const resizeObserver = new ResizeObserver(syncSize)
    resizeObserver.observe(container)

    return () => {
      disposed = true
      resizeObserver.disconnect()
      dataDisposable.dispose()
      outputUnlisten.then((unlisten) => unlisten())
      invoke('pty_kill').catch(() => {})
      term.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} className="h-full w-full px-2 py-1" />
}
