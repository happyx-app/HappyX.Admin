// Numbers, dates and the few rules the pages share.

import type { Day, Guild, Health, Week } from './api'

const locale = 'en-GB'

export const fmt = (n: number, digits = 0) =>
  n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** pct formats a share (0.42) as "42%". */
export const pct = (share: number, digits = 0) => `${fmt(share * 100, digits)}%`

/** ratio is a / b, or null when b is 0, so "no data" never shows as 0 %. */
export const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null)

export const pctOrDash = (share: number | null, digits = 0) => (share === null ? '–' : pct(share, digits))

/** parseDay reads YYYY-MM-DD as a local date, so it never shifts a day with the timezone. */
export function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const clean = (s: string) => s.replace(/\./g, '')

export const dayShort = (s: string) => clean(parseDay(s).toLocaleDateString(locale, { day: 'numeric', month: 'short' }))
export const dayLong = (s: string) => clean(parseDay(s).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }))
export const dateLong = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
export const dateMedium = (iso: string) => clean(new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }))
export const weekday = (iso: string) => clean(new Date(iso).toLocaleDateString(locale, { weekday: 'short' }))
export const hourLabel = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
export const isWeekend = (s: string) => [0, 6].includes(parseDay(s).getDay())

/** ago says how long ago a moment was, in the largest unit that fits ("3 h ago"). */
export function ago(iso: string, now = Date.now()): string {
  const secs = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.floor(hours / 24)} days ago`
}

/** daysUntil counts whole days from now until iso, at least 0. */
export const daysUntil = (iso: string, now = Date.now()) => Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 86_400_000))

export function bytes(n: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${fmt(n, i > 1 && n < 100 ? 1 : 0)} ${units[i]}`
}

const languageNames = new Intl.DisplayNames([locale], { type: 'language' })
export function languageName(code: string): string {
  try {
    const name = languageNames.of(code) ?? code
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return code
  }
}

const isoDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
/** workingDays shortens ISO days to "Mon–Fri", or lists them ("Mon, Wed, Fri"). */
export function workingDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b)
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1)
  if (sorted.length >= 3 && consecutive) return `${isoDays[sorted[0] - 1]}–${isoDays[sorted[sorted.length - 1] - 1]}`
  return sorted.map((d) => isoDays[d - 1]).join(', ')
}

/** rateOf is the response rate of some days or weeks: answers to surveys over the people they went to. */
export const rateOf = (xs: (Day | Week)[]) =>
  ratio(
    xs.reduce((a, x) => a + x.answered, 0),
    xs.reduce((a, x) => a + x.recipients, 0),
  )

export const guildRate = (g: Guild) => ratio(g.answered_7d, g.recipients_7d)

export type Attention = { guild: Guild; kind: 'idle' | 'left' | 'failed'; text: string }

/** FailedShare is the share of a server's DMs failing in a week that needs a look. */
export const FailedShare = 0.2

/** attention lists the servers to look at: idle, about to be deleted, or losing many DMs. */
export function attention(guilds: Guild[], now = Date.now()): Attention[] {
  const out: Attention[] = []
  for (const g of guilds) {
    if (g.status === 'idle') {
      out.push({ guild: g, kind: 'idle', text: g.last_answer ? `No answers since ${dayLong(g.last_answer)}` : 'Nobody has answered yet' })
    } else if (g.status === 'left' && g.purge_at) {
      out.push({ guild: g, kind: 'left', text: `Removed the bot · deleted in ${daysUntil(g.purge_at, now)} days` })
    }
    if (g.status !== 'left' && g.failed_7d > 0 && g.failed_7d >= FailedShare * g.recipients_7d) {
      out.push({ guild: g, kind: 'failed', text: `${fmt(g.failed_7d)} failed DMs this week` })
    }
  }
  const order = { failed: 0, idle: 1, left: 2 }
  return out.sort((a, b) => order[a.kind] - order[b.kind] || a.guild.name.localeCompare(b.guild.name, locale))
}

export type Level = 'good' | 'warning' | 'critical' | 'neutral'

/** BackupMaxAge is how old the latest backup can be before it shows as a warning (they run nightly). */
export const BackupMaxAge = 26 * 3_600_000

export function backupLevel(h: Health, now = Date.now()): Level {
  if (!h.backups.configured) return 'neutral'
  const latest = h.backups.files[0]
  if (!latest) return 'critical'
  return now - new Date(latest.modified).getTime() <= BackupMaxAge ? 'good' : 'warning'
}

export function botLevel(h: Health, now = Date.now()): Level {
  if (h.bot.online) return 'good'
  // Right after the API restarts nobody has called yet; give the bot its minute.
  if (!h.bot.last_seen && now - new Date(h.api.started_at).getTime() < 5 * 60_000) return 'neutral'
  return 'critical'
}

/** initials of a server's name for its badge, e.g. "Club d’Escacs" → "CD". */
export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(' ').filter(Boolean)
  return (words.slice(0, 2).map((w) => w[0]).join('') || '?').toUpperCase()
}

/** colorSlot picks one of the 8 categorical colours for a server, always the same for its ID. */
export function colorSlot(id: string): number {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return (h % 8) + 1
}
