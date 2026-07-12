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
