import type { Health } from '../api'
import { barChart, lineChart, niceMax, tableView, tipRows } from '../charts'
import { h } from '../dom'
import { ago, bytes, dayLong, dayShort, fmt, hourLabel, weekday } from '../format'
import { icon } from '../icons'
import { card, healthStrip, pageHead, statList } from '../ui'

export function healthPage(hl: Health, updated: Node): Node[] {
  const now = Date.now()
  const sum = (k: 'survey' | 'report' | 'game' | 'game_guess') => hl.deliveries.reduce((a, d) => a + d.failed[k], 0)
  const last7 = hl.deliveries.slice(-7)
  const failed7 = {
    survey: last7.reduce((a, d) => a + d.failed.survey, 0),
    report: last7.reduce((a, d) => a + d.failed.report, 0),
    game: last7.reduce((a, d) => a + d.failed.game + d.failed.game_guess, 0),
  }
  const hours = hl.api.hours
  const busy = hours.some((x) => x.requests > 0)
  const p = (x: number, n: number) => (n > 0 ? x : null)
  const yMax = niceMax(Math.max(10, ...hours.map((x) => x.p95_ms)) * 1.1)
  const totalFailed = (d: Health['deliveries'][number]) => d.failed.survey + d.failed.report + d.failed.game + d.failed.game_guess
  const totalSent = (d: Health['deliveries'][number]) => d.sent.survey + d.sent.report + d.sent.game + d.sent.game_guess
  const db = hl.database

  return [
    pageHead('Service health', '', updated),
    healthStrip(hl, failed7, now),
    h(
      'div',
      { class: 'grid-2' },
      card(
        'API latency',
        'Last 24 hours, per hour',
        h('div', { class: 'legend' }, legend('var(--cat-1)', 'p50'), legend('var(--cat-2)', 'p95')),
        busy
          ? lineChart(
              hours.map((x) => x.hour),
              [
                { name: 'p50', color: 'var(--cat-1)', values: hours.map((x) => p(x.p50_ms, x.requests)) },
                { name: 'p95', color: 'var(--cat-2)', values: hours.map((x) => p(x.p95_ms, x.requests)) },
              ],
              {
                label: 'API latency per hour',
                yMin: 0,
                yMax,
                yFmt: (v) => `${fmt(v)} ms`,
                xTick: hourLabel,
                tip: (i) =>
                  tipRows(`${hourLabel(hours[i].hour)} · ${fmt(hours[i].requests)} requests`, [
                    ['var(--cat-1)', 'p50', hours[i].requests ? `${fmt(hours[i].p50_ms, 1)} ms` : '–'],
                    ['var(--cat-2)', 'p95', hours[i].requests ? `${fmt(hours[i].p95_ms, 1)} ms` : '–'],
                    [null, '5xx errors', fmt(hours[i].errors)],
                  ]),
              },
            )
          : h('div', { class: 'chart-empty' }, 'No requests since the API started.'),
        h('p', { class: 'small muted' }, `Counted in memory since the API started (${ago(hl.api.started_at, now)}).`),
        tableView(['Hour', 'Requests', 'p50', 'p95', 'Errors'], hours.map((x) => [hourLabel(x.hour), fmt(x.requests), x.requests ? `${fmt(x.p50_ms, 1)} ms` : '–', x.requests ? `${fmt(x.p95_ms, 1)} ms` : '–', fmt(x.errors)])),
      ),
      card(
        'Failed DMs',
        `Last ${hl.deliveries.length} days`,
        barChart(
          hl.deliveries.map((d) => ({
            label: dayShort(d.day),
            value: totalFailed(d),
            tip: tipRows(dayLong(d.day), [
              [null, 'Surveys', `${fmt(d.failed.survey)} of ${fmt(d.sent.survey)}`],
              [null, 'Reports', `${fmt(d.failed.report)} of ${fmt(d.sent.report)}`],
              [null, 'Game', `${fmt(d.failed.game + d.failed.game_guess)} of ${fmt(d.sent.game + d.sent.game_guess)}`],
            ]),
          })),
          { label: 'Failed DMs per day', height: 200, max: niceMax(Math.max(4, ...hl.deliveries.map(totalFailed))) },
        ),
        statList([
          ['Surveys not delivered', fmt(sum('survey'))],
          ['Reports not delivered to the admin', fmt(sum('report'))],
          ['Game DMs not delivered', fmt(sum('game') + sum('game_guess'))],
          ['DMs sent in total', fmt(hl.deliveries.reduce((a, d) => a + totalSent(d), 0))],
        ]),
        tableView(['Day', 'Sent', 'Failed'], hl.deliveries.map((d) => [dayLong(d.day), fmt(totalSent(d)), fmt(totalFailed(d))])),
      ),
    ),
    h(
      'div',
      { class: 'grid-2' },
      card(
        'Database and API',
        `PostgreSQL ${db.version.replace(/^PostgreSQL\s*/i, '').split(' ')[0]}`,
        statList([
          ['Database size', bytes(db.size_bytes)],
          ['Largest table', db.largest_table ? `${db.largest_table} · ${bytes(db.largest_table_bytes)}` : '–'],
          ['Open connections', `${fmt(db.connections)} of ${fmt(db.max_connections)}`],
          ['Applied migration', String(db.migration).padStart(6, '0')],
          ['API version', h('span', { class: 'v-plain' }, `${hl.api.version} · started ${ago(hl.api.started_at, now)}`)],
        ]),
      ),
      card(
        'Backups',
        'The most recent',
        hl.backups.configured
          ? hl.backups.files.length
            ? h(
                'div',
                { class: 'backups' },
                ...[...hl.backups.files].reverse().map((b) => h('div', { class: 'bk ok', title: b.name }, icon('check'), h('b', {}, weekday(b.modified)), h('span', {}, bytes(b.size_bytes)))),
              )
            : h('p', { class: 'empty' }, 'No backups in the backups folder.')
          : h('p', { class: 'small secondary' }, "The API can't see the backups. Mount the backups folder into the API (read only) and set BACKUP_DIR."),
        h('p', { class: 'small muted' }, "The stack's backup container makes them every night."),
      ),
    ),
  ]
}

function legend(color: string, text: string): HTMLElement {
  const ln = h('span', { class: 'ln' })
  ln.style.background = color
  return h('span', {}, ln, text)
}
