// The admin API of HappyX.Api, behind this container's nginx at /api/admin/. nginx adds the admin
// key, so the browser never sees it. Every answer is counts only: no moods, messages or names.

export type Kind = 'survey' | 'report' | 'game' | 'game_guess'
export type KindCounts = Record<Kind, number>

export interface Day {
  day: string // YYYY-MM-DD
  answers: number
  with_message: number
  recipients: number // people the surveys went to (0 before the bot reported it)
  answered: number // answers to those surveys
  failed: number // survey DMs that failed
}

export interface Week {
  week: string // the Monday, YYYY-MM-DD
  recipients: number
  answered: number
  answers: number
  joins?: number
  leaves?: number
  guilds?: number
}

export interface Overview {
  generated_at: string
  guilds: { with_bot: number; idle: number; left: number; deleted: number; new_7d: number; left_7d: number }
  people: { members: number; opted_out: number; active_today: number; active_7d: number; active_30d: number; repeat_7d: number }
  usage: { answers_7d: number; with_message_7d: number; kudos_7d: number; games_on: number; proposals_7d: number; game_answers_7d: number }
  failed_7d: KindCounts
  days: Day[]
  weeks: Week[]
  // The market study's Phase 0 numbers; older APIs leave them out.
  phase0?: Phase0
}

export interface Phase0 {
  active_guilds: number // 5 or more people answered in the last 7 days
  over_free: number // the survey reaches more than 15 people
}

export type GuildStatus = 'active' | 'idle' | 'left'

export interface Guild {
  discord_guild_id: string
  name: string
  status: GuildStatus
  created_at: string
  left_at: string | null
  purge_at: string | null
  language: string
  timezone: string
  members: number
  opted_out: number
  active_7d: number
  last_answer: string | null
  recipients_7d: number
  answered_7d: number
  failed_7d: number
}

export type RolesMode = 'all' | 'except' | 'only'

export interface GuildDetail {
  guild: Guild
  settings: {
    anonymous: boolean
    survey_hour: number
    working_days: number[] // ISO, 1 Monday to 7 Sunday
    report_frequency: 'weekly' | 'monthly'
    report_dm: boolean
    custom_message: boolean
    survey_roles: RolesMode
    game_roles: RolesMode
    games_enabled: boolean
    kudos_channel: boolean
  }
  weeks: Week[]
  kudos_7d: number
  answers_30d: number
  with_message_30d: number
  last_report: string | null
  game_answers_7d: number
}

export interface Health {
  generated_at: string
  bot: { last_seen: string | null; online: boolean }
  api: { version: string; started_at: string; hours: { hour: string; requests: number; errors: number; p50_ms: number; p95_ms: number }[] }
  deliveries: { day: string; sent: KindCounts; failed: KindCounts }[]
  database: {
    version: string
    size_bytes: number
    largest_table: string
    largest_table_bytes: number
    connections: number
    max_connections: number
    migration: number
  }
  backups: { configured: boolean; files: { name: string; size_bytes: number; modified: string }[] }
}

export interface Count {
  value: string
  guilds: number
}

export interface Settings {
  guilds: number
  language: Count[]
  timezone: Count[]
  survey_hour: Count[]
  anonymous: Count[]
  report_frequency: Count[]
  report_dm: Count[]
  survey_roles: Count[]
  extras: Count[]
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api/admin${path}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    let msg = res.statusText
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg
    } catch {
      // nginx answers 502 with HTML when the API is down
    }
    throw new ApiError(res.status, msg)
  }
  return (await res.json()) as T
}

export const api = {
  overview: () => get<Overview>('/overview'),
  guilds: () => get<{ guilds: Guild[] }>('/guilds').then((r) => r.guilds),
  guild: (id: string) => get<GuildDetail>(`/guilds/${encodeURIComponent(id)}`),
  health: () => get<Health>('/health'),
  settings: () => get<Settings>('/settings'),
}
