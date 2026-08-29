import { useEffect, useRef, useState, useId } from 'react'
import mermaid from 'mermaid'
import { animateDataFlow } from '../lib/flowAnimation'
import DiagramFullscreen from './DiagramFullscreen'

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'strict',
  themeVariables: {
    darkMode: true,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif',
    background: '#0b0c10',
    primaryColor: '#1c1d24',
    primaryBorderColor: 'rgba(167, 139, 250, 0.5)',
    primaryTextColor: '#e4e4e7',
    secondaryColor: '#1c1d24',
    tertiaryColor: '#15161b',
    lineColor: 'rgba(34, 211, 238, 0.65)',
    textColor: '#d4d4d8',
    actorBkg: '#1c1d24',
    actorBorder: 'rgba(167, 139, 250, 0.5)',
    actorTextColor: '#e4e4e7',
    actorLineColor: 'rgba(255, 255, 255, 0.2)',
    signalColor: 'rgba(34, 211, 238, 0.75)',
    signalTextColor: '#d4d4d8',
    labelBoxBkgColor: '#1c1d24',
    labelBoxBorderColor: 'rgba(167, 139, 250, 0.4)',
    labelTextColor: '#d4d4d8',
    noteBkgColor: 'rgba(167, 139, 250, 0.12)',
    noteBorderColor: 'rgba(167, 139, 250, 0.4)',
    noteTextColor: '#e4e4e7',
    activationBorderColor: 'rgba(34, 211, 238, 0.5)',
    activationBkgColor: 'rgba(34, 211, 238, 0.08)',
    edgeLabelBackground: '#15161b',
    erEdgeLabelBackground: '#15161b',
    nodeTextColor: '#d4d4d8',
  },
})

interface MermaidProps {
  chart: string
  animate?: boolean
}

export default function Mermaid({ chart, animate = true }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const rawId = useId().replace(/:/g, '')
  const id = `mermaid-${rawId}`

  useEffect(() => {
    let cancelled = false

    mermaid
      .parse(chart)
      .then(() => mermaid.render(id, chart))
      .then(({ svg }) => {
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg
          setError(null)
          if (animate) animateDataFlow(containerRef.current)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      cancelled = true
    }
  }, [chart, id, animate])

  if (error) {
    return (
      <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
        <p className="font-medium">Diagram error</p>
        <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{error}</pre>
      </div>
    )
  }

  return (
    <div className="group relative my-5 overflow-x-auto rounded-xl border border-white/10 bg-[#0b0c10] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
      <button
        type="button"
        onClick={() => setIsFullscreen(true)}
        title="Lihat layar penuh"
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-neutral-400 opacity-0 transition hover:bg-white/10 hover:text-cyan-300 group-hover:opacity-100"
      >
        ⤢
      </button>
      <div ref={containerRef} className="mermaid-container flex justify-center" />
      {isFullscreen && containerRef.current && (
        <DiagramFullscreen
          svg={containerRef.current.innerHTML}
          animate={animate}
          onClose={() => setIsFullscreen(false)}
        />
      )}
    </div>
  )
}
