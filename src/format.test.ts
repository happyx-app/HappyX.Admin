import { describe, expect, it } from 'vitest'
import type { Guild, Health } from './api'
import { ago, attention, backupLevel, botLevel, bytes, colorSlot, daysUntil, initials, pctOrDash, rateOf, ratio, workingDays, wouldPay } from './format'

const guild = (over: Partial<Guild>): Guild => ({
  discord_guild_id: '100000000000000001',
  name: 'Alpha',
  status: 'active',
  created_at: '2026-09-01T10:00:00Z',
  left_at: null,
  purge_at: null,
  language: 'es',
  timezone: 'Europe/Madrid',
  members: 10,
  opted_out: 0,
  active_7d: 5,
  last_answer: '2026-10-22',
  recipients_7d: 40,
  answered_7d: 20,
  failed_7d: 0,
  ...over,
})

const now = Date.parse('2026-10-25T12:00:00Z')

describe('rates', () => {
  it('has no rate without recipients, instead of 0 %', () => {
    expect(ratio(3, 0)).toBeNull()
    expect(pctOrDash(null)).toBe('–')
    expect(rateOf([])).toBeNull()
  })
  it('sums answers and recipients before dividing', () => {
    const days = [
      { day: '2026-10-20', answers: 9, with_message: 0, recipients: 10, answered: 5, failed: 0 },
      { day: '2026-10-21', answers: 1, with_message: 0, recipients: 30, answered: 1, failed: 0 },
    ]
    expect(rateOf(days)).toBe(6 / 40)
  })
})

describe('attention', () => {
  it('lists failing, idle and soon-deleted servers, failing first', () => {
    const items = attention(
      [
        guild({ name: 'Calm' }),
        guild({ name: 'Quiet', status: 'idle', last_answer: null }),
        guild({ name: 'Gone', status: 'left', purge_at: '2026-10-31T12:00:00Z' }),
        guild({ name: 'Closed DMs', failed_7d: 9, recipients_7d: 40 }),
      ],
      now,
    )
    expect(items.map((i) => [i.guild.name, i.kind])).toEqual([
      ['Closed DMs', 'failed'],
      ['Quiet', 'idle'],
      ['Gone', 'left'],
    ])
    expect(items[2].text).toContain('6 days')
  })
  it('ignores a few failed DMs in a big server', () => {
    expect(attention([guild({ failed_7d: 3, recipients_7d: 400 })], now)).toEqual([])
  })
})

describe('health levels', () => {
  const health = (over: Partial<Health>): Health => ({
    generated_at: '2026-10-25T12:00:00Z',
    bot: { last_seen: null, online: false },
    api: { version: '1.0.0', started_at: '2026-10-25T11:58:00Z', hours: [] },
    deliveries: [],
    database: { version: '18.1', size_bytes: 1, largest_table: '', largest_table_bytes: 0, connections: 1, max_connections: 100, migration: 15 },
    backups: { configured: true, files: [{ name: 'happyx-20261025.sql.gz', size_bytes: 10, modified: '2026-10-25T03:00:00Z' }] },
    ...over,
  })
  it('waits a few minutes for the bot after the API starts', () => {
    expect(botLevel(health({}), now)).toBe('neutral')
    expect(botLevel(health({ api: { version: '1', started_at: '2026-10-25T10:00:00Z', hours: [] } }), now)).toBe('critical')
    expect(botLevel(health({ bot: { last_seen: '2026-10-25T11:59:00Z', online: true } }), now)).toBe('good')
  })
  it('warns when the last backup is older than a night', () => {
    expect(backupLevel(health({}), now)).toBe('good')
    expect(backupLevel(health({ backups: { configured: true, files: [{ name: 'x.sql.gz', size_bytes: 1, modified: '2026-10-23T03:00:00Z' }] } }), now)).toBe('warning')
    expect(backupLevel(health({ backups: { configured: true, files: [] } }), now)).toBe('critical')
    expect(backupLevel(health({ backups: { configured: false, files: [] } }), now)).toBe('neutral')
  })
})

describe('formatting', () => {
  it('says how long ago', () => {
    expect(ago('2026-10-25T11:59:30Z', now)).toBe('just now')
    expect(ago('2026-10-25T11:15:00Z', now)).toBe('45 min ago')
    expect(ago('2026-10-24T12:00:00Z', now)).toBe('24 h ago')
    expect(ago('2026-10-20T12:00:00Z', now)).toBe('5 days ago')
    expect(daysUntil('2026-10-24T00:00:00Z', now)).toBe(0)
  })
  it('shortens working days', () => {
    expect(workingDays([1, 2, 3, 4, 5])).toBe('Mon–Fri')
    expect(workingDays([5, 1, 3])).toBe('Mon, Wed, Fri')
    expect(workingDays([6, 7])).toBe('Sat, Sun')
  })
  it('formats sizes', () => {
    expect(bytes(512)).toBe('512 B')
    expect(bytes(184 * 1024 * 1024)).toBe('184 MB')
    expect(bytes(1.5 * 1024 * 1024)).toBe('1.5 MB')
  })
  it('gives each server stable initials and colour', () => {
    expect(initials('Club d’Escacs Gràcia')).toBe('CD')
    expect(initials('🎮')).toBe('?')
    expect(colorSlot('100000000000000001')).toBe(colorSlot('100000000000000001'))
    expect(colorSlot('100000000000000001')).toBeGreaterThanOrEqual(1)
    expect(colorSlot('100000000000000001')).toBeLessThanOrEqual(8)
  })
})

describe('phase 0', () => {
  it('counts servers that would pay anything', () => {
    expect(wouldPay({ '0': 4, '5': 2, '9': 3, '29': 1 })).toBe(6)
    expect(wouldPay({})).toBe(0)
  })
})
