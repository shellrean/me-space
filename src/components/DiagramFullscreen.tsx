import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'

interface DiagramFullscreenProps {
  svg: string
  animate: boolean
  onClose: () => void
}

export default function DiagramFullscreen({ svg, animate, onClose }: DiagramFullscreenProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] bg-neutral-950/95 backdrop-blur-sm ${animate ? '' : 'diagrams-paused'}`}
    >
      <TransformWrapper initialScale={1} minScale={0.15} maxScale={8} centerOnInit doubleClick={{ mode: 'toggle' }}>
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-[#0b0c10] p-1 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
                <button
                  type="button"
                  onClick={() => zoomOut()}
                  title="Perkecil"
                  className="flex h-7 w-7 items-center justify-center rounded text-neutral-300 hover:bg-white/10"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => resetTransform()}
                  title="Reset zoom"
                  className="h-7 rounded px-2 text-[11px] text-neutral-400 hover:bg-white/10"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => zoomIn()}
                  title="Perbesar"
                  className="flex h-7 w-7 items-center justify-center rounded text-neutral-300 hover:bg-white/10"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={onClose}
                title="Tutup (Esc)"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#0b0c10] text-neutral-300 shadow-[0_8px_30px_rgba(0,0,0,0.35)] hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <p className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 font-mono text-[11px] text-neutral-500">
              Scroll untuk zoom • Drag untuk geser • Klik dua kali untuk reset
            </p>

            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div className="p-20" dangerouslySetInnerHTML={{ __html: svg }} />
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>,
    document.body,
  )
}
