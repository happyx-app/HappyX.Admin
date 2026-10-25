// Hand-drawn SVG charts in HappyX.Web's style: thin marks, 4px rounded bar ends, a recessive grid,
// a hover tooltip and a table view. Every chart redraws to its container's width.

import { h, s } from './dom'
import { fmt, pct } from './format'

type Draw = (width: number, tip: HTMLElement) => SVGSVGElement

function responsive(draw: Draw): HTMLElement {
  const wrap = h('div', { class: 'chart-wrap' })
  const tip = h('div', { class: 'tooltip', role: 'status', hidden: true })
  let drawn = 0
  new ResizeObserver(() => {
    const w = Math.round(wrap.clientWidth)
    if (!w || w === drawn) return
    drawn = w
    wrap.replaceChildren(draw(Math.max(260, w), tip), tip)
  }).observe(wrap)
  return wrap
}

function placeTip(tip: HTMLElement, x: number, y: number, width: number) {
  tip.hidden = false
  const left = Math.min(Math.max(x - tip.offsetWidth / 2, 0), width - tip.offsetWidth)
  tip.style.left = `${left}px`
  tip.style.top = `${Math.max(-8, y - tip.offsetHeight - 12)}px`
}

/** niceMax rounds a maximum up to 1, 2, 2.5 or 5 times a power of ten, so ticks are round. */
export function niceMax(v: number): number {
  if (!(v > 0)) return 4
  const p = 10 ** Math.floor(Math.log10(v))
  const m = v / p
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p
}

/** A bar with a 4px rounded data end, square at the baseline; up or down from y0. */
export function barPath(x: number, y0: number, w: number, y1: number, r = 4): string {
  const hgt = Math.abs(y0 - y1)
  if (hgt < 0.5) return ''
  r = Math.min(r, w / 2, hgt)
  const up = y1 < y0
  const c = up ? y1 + r : y1 - r
  return `M${x},${y0}V${c}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${c}V${y0}Z`
}

export type TipRow = [color: string | null, name: string, value: string]

export function tipRows(title: string, rows: TipRow[]): Node[] {
  return [
    h('div', { class: 'tooltip-title' }, title),
    ...rows.map(([color, name, value]) => {
      const sw = color ? h('span', { class: 'sw' }) : null
      if (sw && color) sw.style.background = color
      return h('div', { class: 'tooltip-row' }, sw, h('span', { class: 'name' }, name), h('strong', { class: 'tabnum' }, value))
    }),
  ]
}

function hover(svg: SVGSVGElement, x0: number, width: number, height: number, onMove: (clientX: number) => void, onLeave: () => void) {
  const hit = s('rect', { x: x0, y: 0, width, height, fill: 'transparent' })
  hit.addEventListener('pointermove', (e) => onMove(e.clientX))
  hit.addEventListener('pointerdown', (e) => onMove(e.clientX))
  hit.addEventListener('pointerleave', onLeave)
  svg.append(hit)
}

export interface Bar {
  label: string
  value: number
  muted?: boolean
  tip: Node[]
}

/** Vertical bars from zero. */
export function barChart(items: Bar[], opts: { label: string; height?: number; color?: string; max?: number; yFmt?: (v: number) => string; tickEvery?: number }): HTMLElement {
  const { height = 220, color = 'var(--series)', yFmt = (v: number) => fmt(v) } = opts
  return responsive((width, tip) => {
    const m = { top: 14, right: 8, bottom: 26, left: 40 }
    const iw = width - m.left - m.right
    const ih = height - m.top - m.bottom
    const max = opts.max ?? niceMax(Math.max(0, ...items.map((d) => d.value)) * 1.05)
    const y = (v: number) => m.top + ih - (v / max) * ih
    const band = iw / items.length
    const gap = Math.max(2, band * 0.22)
    const bw = band - gap
    const svg = s('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img', 'aria-label': opts.label })
    for (let k = 0; k <= 4; k++) {
      const v = (max / 4) * k
      svg.append(
        s('line', { x1: m.left, x2: width - m.right, y1: y(v), y2: y(v), class: k === 0 ? 'axis' : 'grid' }),
        s('text', { x: m.left - 8, y: y(v), class: 'tick', 'text-anchor': 'end', 'dominant-baseline': 'central' }, yFmt(v)),
      )
    }
    const every = opts.tickEvery ?? Math.max(1, Math.ceil(items.length / Math.max(1, Math.floor(iw / 64))))
    const bars = items.map((d, i) => {
      const x = m.left + i * band + gap / 2
      const p = s('path', { d: barPath(x, y(0), bw, y(d.value)), class: 'bar', fill: d.muted ? 'var(--axis)' : color })
      svg.append(p)
      if ((items.length - 1 - i) % every === 0) svg.append(s('text', { x: x + bw / 2, y: height - 8, class: 'tick', 'text-anchor': 'middle' }, d.label))
      return p
    })
    hover(
      svg,
      m.left,
      iw,
      height,
      (clientX) => {
        const box = svg.getBoundingClientRect()
        const i = Math.max(0, Math.min(items.length - 1, Math.floor((clientX - box.left - m.left) / band)))
        bars.forEach((b, k) => b.classList.toggle('dim', k !== i))
        tip.replaceChildren(...items[i].tip)
        placeTip(tip, m.left + i * band + band / 2, y(items[i].value), width)
      },
      () => {
        bars.forEach((b) => b.classList.remove('dim'))
        tip.hidden = true
      },
    )
    return svg
  })
}

export interface Series {
  name: string
  color: string
  values: (number | null)[] // null leaves a gap
}

/** Lines on one shared y axis. */
export function lineChart(
  xs: string[],
  series: Series[],
  opts: { label: string; yMin: number; yMax: number; yFmt: (v: number) => string; xTick: (x: string) => string; tip: (i: number) => Node[]; height?: number; area?: boolean },
): HTMLElement {
  const { height = 220 } = opts
  return responsive((width, tip) => {
    const m = { top: 14, right: 14, bottom: 26, left: 48 }
    const iw = width - m.left - m.right
    const ih = height - m.top - m.bottom
    const n = xs.length
    const step = n > 1 ? iw / (n - 1) : 0
    const x = (i: number) => m.left + (n > 1 ? i * step : iw / 2)
    const y = (v: number) => m.top + ih - ((Math.min(v, opts.yMax) - opts.yMin) / (opts.yMax - opts.yMin)) * ih
    const svg = s('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img', 'aria-label': opts.label })
    for (let k = 0; k <= 4; k++) {
      const v = opts.yMin + ((opts.yMax - opts.yMin) / 4) * k
      svg.append(
        s('line', { x1: m.left, x2: width - m.right, y1: y(v), y2: y(v), class: k === 0 ? 'axis' : 'grid' }),
        s('text', { x: m.left - 8, y: y(v), class: 'tick', 'text-anchor': 'end', 'dominant-baseline': 'central' }, opts.yFmt(v)),
      )
    }
    const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / 70))))
    xs.forEach((d, i) => {
      if ((n - 1 - i) % every !== 0) return
      const anchor = i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'
      svg.append(s('text', { x: x(i), y: height - 8, class: 'tick', 'text-anchor': anchor }, opts.xTick(d)))
    })
    for (const se of series) {
      // Lines join only consecutive points that both have a value.
      let d = ''
      se.values.forEach((v, i) => {
        if (v === null) return
        d += `${i > 0 && se.values[i - 1] !== null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
      })
      const firstIdx = se.values.findIndex((v) => v !== null)
      if (opts.area && firstIdx >= 0 && se.values.every((v, i) => i < firstIdx || v !== null)) {
        svg.append(s('path', { d: `${d}L${x(n - 1)},${y(opts.yMin)}L${x(firstIdx)},${y(opts.yMin)}Z`, class: 'area', fill: se.color }))
      }
      svg.append(s('path', { d, class: 'line', stroke: se.color }))
      se.values.forEach((v, i) => {
        // A point without neighbours would be invisible as a line.
        const alone = v !== null && (i === 0 || se.values[i - 1] === null) && (i === n - 1 || se.values[i + 1] === null)
        if (v !== null && (alone || i === n - 1)) svg.append(s('circle', { cx: x(i), cy: y(v), r: 4, class: 'dot', fill: se.color }))
      })
    }
    const cross = s('line', { y1: m.top, y2: m.top + ih, class: 'crosshair', visibility: 'hidden' })
    const focus = series.map((se) => s('circle', { r: 5, class: 'focus', fill: se.color, visibility: 'hidden' }))
    svg.append(cross, ...focus)
    hover(
      svg,
      m.left - step / 2,
      iw + step,
      height,
      (clientX) => {
        const box = svg.getBoundingClientRect()
        const i = Math.max(0, Math.min(n - 1, Math.round((clientX - box.left - m.left) / (step || 1))))
        cross.setAttribute('x1', String(x(i)))
        cross.setAttribute('x2', String(x(i)))
        cross.setAttribute('visibility', 'visible')
        let top = m.top + ih / 2
        series.forEach((se, k) => {
          const v = se.values[i]
          if (v === null) return focus[k].setAttribute('visibility', 'hidden')
          focus[k].setAttribute('cx', String(x(i)))
          focus[k].setAttribute('cy', String(y(v)))
          focus[k].setAttribute('visibility', 'visible')
          top = Math.min(top, y(v))
        })
        tip.replaceChildren(...opts.tip(i))
        placeTip(tip, x(i), top, width)
      },
      () => {
        cross.setAttribute('visibility', 'hidden')
        focus.forEach((f) => f.setAttribute('visibility', 'hidden'))
        tip.hidden = true
      },
    )
    return svg
  })
}

export interface Flow {
  label: string
  up: number
  down: number
  tip: Node[]
}

/** Two quantities per column, one above the axis and one below (servers joining and leaving). */
export function flowChart(rows: Flow[], opts: { label: string; height?: number }): HTMLElement {
  const { height = 220 } = opts
  return responsive((width, tip) => {
    const m = { top: 12, right: 8, bottom: 26, left: 32 }
    const iw = width - m.left - m.right
    const ih = height - m.top - m.bottom
    const up = Math.max(2, ...rows.map((r) => r.up))
    const down = Math.max(1, ...rows.map((r) => r.down))
    const y = (v: number) => m.top + ((up - v) / (up + down)) * ih
    const band = iw / rows.length
    const gap = Math.max(4, band * 0.3)
    const bw = band - gap
    const svg = s('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img', 'aria-label': opts.label })
    const stepY = Math.max(1, Math.ceil((up + down) / 6))
    for (let v = -Math.floor(down / stepY) * stepY; v <= up; v += stepY) {
      svg.append(
        s('line', { x1: m.left, x2: width - m.right, y1: y(v), y2: y(v), class: v === 0 ? 'axis' : 'grid' }),
        s('text', { x: m.left - 8, y: y(v), class: 'tick', 'text-anchor': 'end', 'dominant-baseline': 'central' }, v < 0 ? `−${-v}` : String(v)),
      )
    }
    const every = Math.max(1, Math.ceil(rows.length / Math.max(1, Math.floor(iw / 64))))
    const groups = rows.map((r, i) => {
      const x = m.left + i * band + gap / 2
      const a = s('path', { d: barPath(x, y(0) - 1, bw, y(r.up)), class: 'bar', fill: 'var(--cat-1)' })
      const b = s('path', { d: barPath(x, y(0) + 1, bw, y(-r.down)), class: 'bar', fill: 'var(--cat-2)' })
      svg.append(a, b)
      if ((rows.length - 1 - i) % every === 0) svg.append(s('text', { x: x + bw / 2, y: height - 6, class: 'tick', 'text-anchor': 'middle' }, r.label))
      return [a, b]
    })
    hover(
      svg,
      m.left,
      iw,
      height,
      (clientX) => {
        const box = svg.getBoundingClientRect()
        const i = Math.max(0, Math.min(rows.length - 1, Math.floor((clientX - box.left - m.left) / band)))
        groups.forEach((g, k) => g.forEach((p) => p.classList.toggle('dim', k !== i)))
        tip.replaceChildren(...rows[i].tip)
        placeTip(tip, m.left + i * band + band / 2, y(rows[i].up), width)
      },
      () => {
        groups.flat().forEach((p) => p.classList.remove('dim'))
        tip.hidden = true
      },
    )
    return svg
  })
}

/** A small trend line for a KPI tile. */
export function spark(values: number[], color = 'var(--series)'): SVGSVGElement {
  const w = 120
  const hgt = 28
  const max = Math.max(...values)
  const min = Math.min(...values)
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * (w - 4) + 2
  const y = (v: number) => hgt - 3 - ((v - min) / (max - min || 1)) * (hgt - 6)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  return s(
    'svg',
    { viewBox: `0 0 ${w} ${hgt}`, class: 'spark', preserveAspectRatio: 'none', width: '100%', 'aria-hidden': 'true' },
    s('path', { d: `${d}L${x(values.length - 1)},${hgt}L${x(0)},${hgt}Z`, fill: color, opacity: 0.12 }),
    s('path', { d, fill: 'none', stroke: color, 'stroke-width': 1.75, 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }),
    s('circle', { cx: x(values.length - 1), cy: y(values[values.length - 1]), r: 2.5, fill: color }),
  )
}

/** The same numbers as a chart, as a table under a disclosure. */
export function tableView(head: string[], rows: (string | number)[][], numericFrom = 1): HTMLElement {
  const cls = (i: number) => (i >= numericFrom ? 'num' : '')
  return h(
    'details',
    { class: 'table-view' },
    h('summary', {}, 'Show as table'),
    h(
      'div',
      { class: 'scroll-x' },
      h(
        'table',
        { class: 'table' },
        h('thead', {}, h('tr', {}, ...head.map((t, i) => h('th', { class: cls(i) }, t)))),
        h('tbody', {}, ...rows.map((r) => h('tr', {}, ...r.map((c, i) => h('td', { class: cls(i) }, String(c)))))),
      ),
    ),
  )
}

/** Horizontal bars for how many servers have each value of a setting. */
export function distribution(rows: { label: string; n: number }[], total: number): HTMLElement {
  const max = Math.max(1, ...rows.map((r) => r.n))
  if (rows.length === 0) return h('p', { class: 'empty' }, 'No servers yet.')
  return h(
    'div',
    { class: 'dist' },
    ...rows.map(({ label, n }) => {
      const fill = h('span', { class: 'fil' })
      fill.style.width = `${(n / max) * 100}%`
      return h(
        'div',
        { class: 'dist-row', title: `${label}: ${n} of ${total} servers` },
        h('span', { class: 'lbl' }, label),
        h('span', { class: 'trk' }, fill),
        h('span', { class: 'n' }, String(n), ' ', h('small', {}, total > 0 ? pct(n / total) : '')),
      )
    }),
  )
}
