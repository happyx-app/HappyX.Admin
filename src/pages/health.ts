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
    pageHead('Salud del servicio', 'Bot, API, base de datos y copias de seguridad.', updated),
    healthStrip(hl, failed7, now),
    h(
      'div',
      { class: 'grid-2' },
      card(
        'Latencia de la API',
        'Últimas 24 horas, por hora',
        h('div', { class: 'legend' }, legend('var(--cat-1)', 'p50 (la mitad de peticiones)'), legend('var(--cat-2)', 'p95')),
        busy
          ? lineChart(
              hours.map((x) => x.hour),
              [
                { name: 'p50', color: 'var(--cat-1)', values: hours.map((x) => p(x.p50_ms, x.requests)) },
                { name: 'p95', color: 'var(--cat-2)', values: hours.map((x) => p(x.p95_ms, x.requests)) },
              ],
              {
                label: 'Latencia de la API por hora',
                yMin: 0,
                yMax,
                yFmt: (v) => `${fmt(v)} ms`,
                xTick: hourLabel,
                tip: (i) =>
                  tipRows(`${hourLabel(hours[i].hour)} · ${fmt(hours[i].requests)} peticiones`, [
                    ['var(--cat-1)', 'p50', hours[i].requests ? `${fmt(hours[i].p50_ms, 1)} ms` : '–'],
                    ['var(--cat-2)', 'p95', hours[i].requests ? `${fmt(hours[i].p95_ms, 1)} ms` : '–'],
                    [null, 'Errores 5xx', fmt(hours[i].errors)],
                  ]),
              },
            )
          : h('div', { class: 'chart-empty' }, 'Sin peticiones desde que arrancó la API.'),
        h('p', { class: 'small muted' }, `Se cuenta en memoria desde que arrancó la API (${ago(hl.api.started_at, now)}). Los picos suelen coincidir con la hora de la encuesta.`),
        tableView(['Hora', 'Peticiones', 'p50', 'p95', 'Errores'], hours.map((x) => [hourLabel(x.hour), fmt(x.requests), x.requests ? `${fmt(x.p50_ms, 1)} ms` : '–', x.requests ? `${fmt(x.p95_ms, 1)} ms` : '–', fmt(x.errors)])),
      ),
      card(
        'Envíos fallidos',
        `Últimos ${hl.deliveries.length} días`,
        barChart(
          hl.deliveries.map((d) => ({
            label: dayShort(d.day),
            value: totalFailed(d),
            tip: tipRows(dayLong(d.day), [
              [null, 'Encuestas', `${fmt(d.failed.survey)} de ${fmt(d.sent.survey)}`],
              [null, 'Reports', `${fmt(d.failed.report)} de ${fmt(d.sent.report)}`],
              [null, 'Juego', `${fmt(d.failed.game + d.failed.game_guess)} de ${fmt(d.sent.game + d.sent.game_guess)}`],
            ]),
          })),
          { label: 'DMs fallidos por día', height: 200, max: niceMax(Math.max(4, ...hl.deliveries.map(totalFailed))) },
        ),
        statList([
          ['Encuestas que no llegaron', fmt(sum('survey'))],
          ['Reports que no llegaron al admin', fmt(sum('report'))],
          ['DMs del juego que no llegaron', fmt(sum('game') + sum('game_guess'))],
          ['DMs enviados en total', fmt(hl.deliveries.reduce((a, d) => a + totalSent(d), 0))],
        ]),
        tableView(['Día', 'Enviados', 'Fallidos'], hl.deliveries.map((d) => [dayLong(d.day), fmt(totalSent(d)), fmt(totalFailed(d))])),
      ),
    ),
    h(
      'div',
      { class: 'grid-2' },
      card(
        'Base de datos y API',
        `PostgreSQL ${db.version.split(' ')[0]}`,
        statList([
          ['Tamaño de la base de datos', bytes(db.size_bytes)],
          ['Tabla más grande', db.largest_table ? `${db.largest_table} · ${bytes(db.largest_table_bytes)}` : '–'],
          ['Conexiones abiertas', `${fmt(db.connections)} de ${fmt(db.max_connections)}`],
          ['Migración aplicada', String(db.migration).padStart(6, '0')],
          ['Versión de la API', h('span', { class: 'v-plain' }, `${hl.api.version} · arrancó ${ago(hl.api.started_at, now)}`)],
        ]),
      ),
      card(
        'Copias de seguridad',
        'Las más recientes',
        hl.backups.configured
          ? hl.backups.files.length
            ? h(
                'div',
                { class: 'backups' },
                ...[...hl.backups.files].reverse().map((b) => h('div', { class: 'bk ok', title: b.name }, icon('check'), h('b', {}, weekday(b.modified)), h('span', {}, bytes(b.size_bytes)))),
              )
            : h('p', { class: 'empty' }, 'No hay ninguna copia en la carpeta de backups.')
          : h('p', { class: 'small secondary' }, 'La API no tiene acceso a las copias. Monta la carpeta de backups en la API (solo lectura) y pon BACKUP_DIR.'),
        h('p', { class: 'small muted' }, 'Las hace cada noche el contenedor de backup del stack.'),
      ),
    ),
  ]
}

function legend(color: string, text: string): HTMLElement {
  const ln = h('span', { class: 'ln' })
  ln.style.background = color
  return h('span', {}, ln, text)
}
