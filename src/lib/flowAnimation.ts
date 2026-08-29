const EDGE_SELECTORS = [
  '.edgePath path',
  '.flowchart-link',
  '.messageLine0',
  '.messageLine1',
  '.er.relationshipLine',
  '.relation',
  '.transition',
].join(',')

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Walks a rendered Mermaid SVG and adds a small "packet" dot on every edge
 * that travels along the edge's own path via CSS motion path, giving a
 * data-flow feel without needing per-diagram-type logic.
 */
export function animateDataFlow(container: HTMLElement) {
  const svg = container.querySelector('svg')
  if (!svg) return

  const edges = svg.querySelectorAll<SVGPathElement | SVGLineElement>(EDGE_SELECTORS)

  edges.forEach((edge, index) => {
    const d = pathDataFor(edge)
    if (!d) return

    const packet = document.createElementNS(SVG_NS, 'circle')
    packet.setAttribute('r', '3')
    packet.setAttribute('class', 'flow-packet')
    packet.style.setProperty('offset-path', `path("${d}")`)
    packet.style.setProperty('animation-delay', `${(index % 6) * -0.3}s`)

    svg.appendChild(packet)
  })
}

function pathDataFor(edge: SVGPathElement | SVGLineElement): string | null {
  if (edge instanceof SVGPathElement) {
    return edge.getAttribute('d')
  }

  const x1 = edge.getAttribute('x1')
  const y1 = edge.getAttribute('y1')
  const x2 = edge.getAttribute('x2')
  const y2 = edge.getAttribute('y2')
  if (x1 === null || y1 === null || x2 === null || y2 === null) return null

  return `M ${x1} ${y1} L ${x2} ${y2}`
}
