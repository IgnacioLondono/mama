import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function base(props: IconProps) {
  return {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    ...props,
  }
}

export function IconDesk(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 10h16v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8Z" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M9 14h6" />
    </svg>
  )
}

export function IconNeedles(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 3v14a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V8" />
      <path d="M18 3v14a2 2 0 0 1-2 2h0a2 2 0 0 1-2-2V8" />
      <path d="M10 8h4" />
    </svg>
  )
}

export function IconBook(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5Z" />
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    </svg>
  )
}

export function IconYarn(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8" />
      <path d="M6.5 8.5c2.5 1.5 5.5 1.5 8 0" />
      <path d="M5.5 12.5c3 2 7 2 10 0" />
      <path d="M7.5 16c2.2 1 5 1 7.2 0" />
      <path d="M14 4.5c1.2 2.5 1.5 5.5.3 8.2" />
    </svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </svg>
  )
}

export function IconSun(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
    </svg>
  )
}

export function IconMoon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M19 13.5A7.5 7.5 0 0 1 10.5 5 7.5 7.5 0 1 0 19 13.5Z" />
    </svg>
  )
}

export function IconChat(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H11l-3.5 3v-3H7.5A2.5 2.5 0 0 1 5 13.5v-7Z" />
      <path d="M8.5 9h7M8.5 12h4.5" />
    </svg>
  )
}

export function IconBrush(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m14.5 4.5 5 5-9.2 9.2a3.2 3.2 0 0 1-4.5-4.5L14.5 4.5Z" />
      <path d="m16.2 6.2 1.6-1.6a1.2 1.2 0 0 1 1.7 1.7L17.9 7.9" />
      <path d="M5.2 18.2c1.4.2 2.6-.2 3.5-1.1" />
    </svg>
  )
}

export function IconEraser(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m15.5 4.5 4 4-8.5 8.5H7.5L3.5 13.5 15.5 4.5Z" />
      <path d="M7 17h12" />
    </svg>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 7h14" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M7.5 7 8.2 18.5A1.5 1.5 0 0 0 9.7 20h4.6a1.5 1.5 0 0 0 1.5-1.5L16.5 7" />
    </svg>
  )
}

export function IconSend(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h12" />
      <path d="m12 6 6 6-6 6" />
    </svg>
  )
}

export function IconStop(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconFolder(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4.2l1.3 1.5H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17v-9.5Z" />
    </svg>
  )
}

export function IconAnime(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="11" r="6.5" />
      <path d="M8.2 10.2c.5-.7 1.2-1.1 1.9-1.1M14 9.1c.7 0 1.4.4 1.9 1.1" />
      <path d="M9.2 13.2c.8.9 1.8 1.4 2.8 1.4s2-.5 2.8-1.4" />
      <path d="M7.2 5.2 5.5 3.2M16.8 5.2 18.5 3.2" />
    </svg>
  )
}

export function IconTv(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="6" width="17" height="12" rx="2" />
      <path d="M8 20h8M9 3.5 12 6l3-2.5" />
    </svg>
  )
}

export function IconFilm(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M8 5v14M16 5v14M4 9h4M16 9h4M4 15h4M16 15h4" />
    </svg>
  )
}

export function IconGame(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 9h10a4 4 0 0 1 4 4v1.5a3.5 3.5 0 0 1-3.5 3.5h-1.2L14.5 15h-5L7.7 18H6.5A3.5 3.5 0 0 1 3 14.5V13a4 4 0 0 1 4-4Z" />
      <path d="M8 12.5v3M6.5 14h3" />
      <circle cx="15.2" cy="13.2" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="17" cy="14.8" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconMusic(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 18V6.5l10-2V15" />
      <circle cx="7" cy="18" r="2.2" />
      <circle cx="17" cy="15" r="2.2" />
    </svg>
  )
}

export function IconPaw(props: IconProps) {
  return (
    <svg {...base(props)}>
      <ellipse cx="12" cy="15.5" rx="4.2" ry="3.2" />
      <circle cx="7.2" cy="10" r="1.6" />
      <circle cx="10.2" cy="8" r="1.55" />
      <circle cx="13.8" cy="8" r="1.55" />
      <circle cx="16.8" cy="10" r="1.6" />
    </svg>
  )
}

export function IconHeart(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 19.2 5.8 13.2A3.8 3.8 0 0 1 12 7.6a3.8 3.8 0 0 1 6.2 5.6L12 19.2Z" />
    </svg>
  )
}

export function IconStar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m12 3.5 2.2 4.6 5.1.7-3.7 3.6.9 5.1L12 15.5 7.5 17.5l.9-5.1-3.7-3.6 5.1-.7L12 3.5Z" />
    </svg>
  )
}

export function IconHome(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m4 11 8-7 8 7" />
      <path d="M6.5 10.5V19h11v-8.5" />
      <path d="M10 19v-5h4v5" />
    </svg>
  )
}
