interface IconProps {
  className?: string
}

const BASE_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function IconFilePlus({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="12" y1="12" x2="12" y2="18" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  )
}

export function IconFolderPlus({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
      <line x1="12" y1="10" x2="12" y2="16" />
      <line x1="9" y1="13" x2="15" y2="13" />
    </svg>
  )
}

export function IconSearch({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export function IconTrash({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

export function IconArchive({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <rect x="3" y="3" width="18" height="5" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <line x1="10" y1="13" x2="14" y2="13" />
    </svg>
  )
}

export function IconTerminal({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m7 9 3 3-3 3" />
      <line x1="12" y1="15" x2="17" y2="15" />
    </svg>
  )
}

export function IconMessage({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-4.2-1.1L3 20l1.1-5.3A8.5 8.5 0 1 1 21 11.5Z" />
    </svg>
  )
}

export function IconChecklist({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="m3 6 1.5 1.5L7 5" />
      <path d="m3 12 1.5 1.5L7 11" />
      <path d="m3 18 1.5 1.5L7 17" />
      <line x1="11" y1="6" x2="21" y2="6" />
      <line x1="11" y1="12" x2="21" y2="12" />
      <line x1="11" y1="18" x2="21" y2="18" />
    </svg>
  )
}

export function IconKanban({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <line x1="15" y1="4" x2="15" y2="20" />
      <line x1="5.5" y1="8" x2="6.5" y2="8" />
      <line x1="11.5" y1="8" x2="12.5" y2="8" />
      <line x1="17.5" y1="8" x2="18.5" y2="8" />
    </svg>
  )
}

export function IconSunrise({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M12 2v6" />
      <path d="m4.93 10.93 1.41 1.41" />
      <path d="M2 18h2" />
      <path d="M20 18h2" />
      <path d="m19.07 10.93-1.41 1.41" />
      <path d="M22 22H2" />
      <path d="m8 6 4-4 4 4" />
      <path d="M16 18a4 4 0 0 0-8 0" />
    </svg>
  )
}

export function IconDrawing({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <circle cx="17.5" cy="7" r="3.5" />
      <path d="m7 21 4-7H3z" />
      <path d="M14 14h7v7h-7z" />
    </svg>
  )
}

export function IconDrawingPlus({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <circle cx="17.5" cy="7" r="3.5" />
      <path d="m7 21 4-7H3z" />
      <line x1="17.5" y1="14" x2="17.5" y2="21" />
      <line x1="14" y1="17.5" x2="21" y2="17.5" />
    </svg>
  )
}

export function IconImageDown({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M21 13V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.5 3.5L14 15" />
      <path d="M17.5 18.5V12" />
    </svg>
  )
}

export function IconActivity({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <path d="M3 12h3.5l2.5-7 4 14 2.5-7H21" />
    </svg>
  )
}

export function IconSidebar({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9.5" y1="4" x2="9.5" y2="20" />
    </svg>
  )
}

export function IconGrid({ className }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  )
}
