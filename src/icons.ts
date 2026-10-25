// Line icons in the text colour, like HappyX.Web's (Feather/Lucide shapes).

import { s } from './dom'

const shapes: Record<string, string[]> = {
  check: ['M20 6 9 17l-5-5'],
  alert: ['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01'],
  x: ['M18 6 6 18M6 6l12 12'],
  moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41'],
  bot: ['M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM12 4v4M9 13h.01M15 13h.01M9 17h6'],
  api: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  save: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3'],
  mail: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6'],
  chev: ['m9 18 6-6-6-6'],
  back: ['m15 18-6-6 6-6'],
  search: ['M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.35-4.35'],
  lock: ['M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4'],
  pause: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM10 15V9M14 15V9'],
  home: ['M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 21v-7h6v7'],
  refresh: ['M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15'],
}

export type IconName = keyof typeof shapes

export function icon(name: IconName, extra = ''): SVGSVGElement {
  return s(
    'svg',
    { viewBox: '0 0 24 24', class: `icon ${extra}`.trim(), 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    ...shapes[name].map((d) => s('path', { d })),
  )
}
