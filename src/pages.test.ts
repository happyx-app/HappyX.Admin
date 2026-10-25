import { describe, expect, it } from 'vitest'
import type { Guild } from './api'
import { visible } from './pages/guilds'
import { top } from './pages/settings'
import { parseRoute } from './route'

const g = (name: string, status: Guild['status'], members: number, answered = 0, recipients = 0): Guild => ({
  discord_guild_id: String(100000000000000000 + members),
  name,
  status,
  created_at: '2026-09-01T00:00:00Z',
  left_at: null,
  purge_at: null,
  language: 'es',
  timezone: 'Europe/Madrid',
  members,
  opted_out: 0,
  active_7d: 0,
  last_answer: null,
  recipients_7d: recipients,
  answered_7d: answered,
  failed_7d: 0,
})

describe('server list', () => {
  const guilds = [g('Beta', 'active', 10, 5, 10), g('alpha', 'idle', 30), g('Gamma', 'left', 20), g('Delta', 'active', 5, 1, 10)]
  it('filters, searches and sorts', () => {
    expect(visible(guilds, { filter: 'all', q: '', sort: 'members', dir: -1 }).map((x) => x.name)).toEqual(['alpha', 'Gamma', 'Beta', 'Delta'])
    expect(visible(guilds, { filter: 'active', q: '', sort: 'rate', dir: -1 }).map((x) => x.name)).toEqual(['Beta', 'Delta'])
    expect(visible(guilds, { filter: 'all', q: 'ALP', sort: 'name', dir: 1 }).map((x) => x.name)).toEqual(['alpha'])
    expect(visible(guilds, { filter: 'all', q: '', sort: 'name', dir: 1 }).map((x) => x.name)).toEqual(['alpha', 'Beta', 'Delta', 'Gamma'])
  })
})

describe('settings', () => {
  it('folds the long tail into Other', () => {
    const cs = [
      { value: 'Europe/Madrid', guilds: 5 },
      { value: 'Europe/London', guilds: 2 },
      { value: 'America/Bogota', guilds: 1 },
      { value: 'Asia/Tokyo', guilds: 1 },
    ]
    expect(top(cs, 2)).toEqual([
      { label: 'Europe/Madrid', n: 5 },
      { label: 'Europe/London', n: 2 },
      { label: 'Other', n: 2 },
    ])
  })
})

describe('routes', () => {
  it('reads the page and server from the fragment', () => {
    expect(parseRoute('')).toEqual({ page: 'overview' })
    expect(parseRoute('#/servers')).toEqual({ page: 'servers' })
    expect(parseRoute('#/servers/100000000000000001')).toEqual({ page: 'servers', guild: '100000000000000001' })
    expect(parseRoute('#/servers/../etc')).toEqual({ page: 'servers' })
    expect(parseRoute('#/health')).toEqual({ page: 'health' })
    expect(parseRoute('#/nothing')).toEqual({ page: 'overview' })
  })
})
