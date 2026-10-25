// Pieces the pages share.

import type { Guild, Health } from './api'
import { h } from './dom'
import { ago, backupLevel, botLevel, bytes, colorSlot, dateMedium, fmt, hourLabel, initials, type Level } from './format'
import { icon, type IconName } from './icons'

type Child = Node | string | null | false | undefined

export function card(title: string, sub: string | null, ...children: Child[]): HTMLElement {
  return h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, title), sub ? h('span', { class: 'sub' }, sub) : null), ...children)
}

export function pageHead(title: string, sub: string, right?: Node): HTMLElement {
  return h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, title), h('p', { class: 'secondary' }, sub)), right ?? null)
}

const levelIcon: Record<Level, IconName> = { good: 'check', warning: 'alert', critical: 'x', neutral: 'pause' }

/** pill shows a state with an icon and a word, never with colour alone. */
export function pill(level: Level, text: string): HTMLElement {
  return h('span', { class: `pill ${level}` }, icon(levelIcon[level]), text)
}

export function statusPill(g: Guild, now = Date.now()): HTMLElement {
  if (g.status === 'active') return pill('good', 'Activo')
  if (g.status === 'idle') return pill('warning', 'Sin actividad')
  const days = g.purge_at ? Math.max(0, Math.ceil((new Date(g.purge_at).getTime() - now) / 86_400_000)) : null
  return pill('neutral', days === null ? 'Expulsado' : `Expulsado · ${days} d`)
}

export function guildBadge(g: Guild): HTMLElement {
  const el = h('span', { class: 'srv-ico', 'aria-hidden': 'true' }, initials(g.name))
  el.style.background = `var(--cat-${colorSlot(g.discord_guild_id)})`
  return el
}

export function statList(rows: [string, Child][]): HTMLElement {
  return h('div', { class: 'stat-list' }, ...rows.map(([k, v]) => h('div', { class: 'stat-row' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, v))))
}

export function kpi(label: string, value: Child, foot: Child, extra?: Node): HTMLElement {
  return h('div', { class: 'kpi' }, h('span', { class: 'label' }, label), h('span', { class: 'value' }, value), h('span', { class: 'foot' }, foot), extra ?? null)
}

/** unit puts a small unit after a big number ("65 %"). */
export const unit = (n: string, u: string) => h('span', {}, n, h('small', {}, ` ${u}`))

function chip(level: Level, ic: IconName, name: string, word: string, meta: string): HTMLElement {
  return h(
    'div',
    { class: `hchip st-${level}` },
    h('span', { class: 'dot' }, icon(ic)),
    h('div', { class: 'srv-name-cell' }, h('div', { class: 'name' }, name), h('div', { class: 'val' }, word), h('div', { class: 'meta' }, meta)),
  )
}

/** healthStrip is the four service states shown on top of the summary and the health page. */
export function healthStrip(hl: Health, failed: { survey: number; report: number; game: number }, now = Date.now()): HTMLElement {
  const bot = botLevel(hl, now)
  const botWord = bot === 'good' ? 'En línea' : bot === 'neutral' ? 'Esperando' : 'Sin noticias'
  const botMeta = hl.bot.last_seen ? `Última llamada ${ago(hl.bot.last_seen, now)}` : `Sin llamadas desde que arrancó la API (${ago(hl.api.started_at, now)})`

  const hours = hl.api.hours
  const errors = hours.reduce((a, x) => a + x.errors, 0)
  const lastBusy = [...hours].reverse().find((x) => x.requests > 0)
  const apiMeta = `${lastBusy ? `p95 ${fmt(lastBusy.p95_ms)} ms a las ${hourLabel(lastBusy.hour)}` : 'Sin peticiones aún'} · ${fmt(errors)} errores 5xx en 24 h`

  const totalFailed = failed.survey + failed.report + failed.game
  const failMeta = `${fmt(failed.survey)} encuestas · ${fmt(failed.report)} reports · ${fmt(failed.game)} del juego`

  const bk = backupLevel(hl, now)
  const latest = hl.backups.files[0]
  const bkWord = !hl.backups.configured ? 'Sin configurar' : latest ? `${ago(latest.modified, now).replace(/^h/, 'H')}` : 'Ninguna copia'
  const bkMeta = latest ? `${dateMedium(latest.modified)} · ${bytes(latest.size_bytes)} · BD ${bytes(hl.database.size_bytes)}` : `BD ${bytes(hl.database.size_bytes)} · falta BACKUP_DIR en la API`

  return h(
    'div',
    { class: 'health' },
    chip(bot, 'bot', 'Bot de Discord', botWord, botMeta),
    chip(errors > 0 ? 'warning' : 'good', 'api', 'API', errors > 0 ? 'Con errores' : 'Responde', apiMeta),
    chip(totalFailed > 0 ? 'warning' : 'good', 'mail', 'Envíos fallidos (7 d)', totalFailed > 0 ? `${fmt(totalFailed)} DMs sin entregar` : 'Ninguno', failMeta),
    chip(bk, 'save', 'Copia de seguridad', bkWord, bkMeta),
  )
}

export function skeleton(): HTMLElement {
  return h('div', { class: 'skeleton', 'aria-busy': 'true', 'aria-label': 'Cargando' }, h('div', { class: 'sk sk-strip' }), h('div', { class: 'sk sk-kpis' }), h('div', { class: 'sk sk-chart' }))
}

export function errorCard(err: unknown): HTMLElement {
  const status = (err as { status?: number }).status
  const hint =
    status === 401
      ? 'La API no acepta la clave de admin. Comprueba que ADMIN_API_KEY de este contenedor corresponde a ADMIN_KEY_HASH de la API.'
      : status === 502 || status === 504
        ? 'No se llega a la API de admin. Comprueba que la API tiene ADMIN_KEY_HASH puesto y que API_URL apunta a su puerto de admin (por defecto http://api:8081).'
        : 'Algo ha fallado al pedir los datos. Vuelve a intentarlo en un momento.'
  return h(
    'section',
    { class: 'card error-card', role: 'alert' },
    h('div', { class: 'card-head' }, h('h2', {}, 'No se han podido cargar los datos')),
    h('p', {}, hint),
    h('pre', {}, String((err as Error)?.message ?? err)),
  )
}
