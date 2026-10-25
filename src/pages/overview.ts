import type { Guild, Health, Overview } from '../api'
import { barChart, flowChart, lineChart, spark, tableView, tipRows } from '../charts'
import { h } from '../dom'
import { attention, dayLong, dayShort, fmt, isWeekend, pct, pctOrDash, rateOf, ratio } from '../format'
import { icon } from '../icons'
import { card, guildBadge, healthStrip, kpi, pageHead, pill, statList, unit } from '../ui'

export function overviewPage(o: Overview, hl: Health, guilds: Guild[], open: (id: string) => void, updated: Node): Node[] {
  const now = Date.now()
  const active = o.guilds.with_bot - o.guilds.idle
  const last7 = o.days.slice(-7)
  const prev7 = o.days.slice(-14, -7)
  const rate = rateOf(last7)
  const prevRate = rateOf(prev7)
  const weeksWithRate = o.weeks.map((w) => ratio(w.answered, w.recipients))

  const rateFoot =
    rate === null
      ? 'Se empieza a medir cuando el bot avisa de a cuántos envía'
      : prevRate === null
        ? 'últimos 7 días'
        : h('span', {}, h('span', { class: `delta ${rate >= prevRate ? 'up' : 'down'}` }, `${rate >= prevRate ? '+' : '−'}${fmt(Math.abs(rate - prevRate) * 100, 1)} pt`), ' vs. semana anterior')

  const dailyBars = o.days.map((d) => ({
    label: dayShort(d.day),
    value: d.answers,
    muted: isWeekend(d.day),
    tip: tipRows(dayLong(d.day), [
      [null, 'Respuestas', fmt(d.answers)],
      [null, 'Encuestas enviadas', d.recipients ? fmt(d.recipients) : '–'],
      [null, 'Con mensaje', fmt(d.with_message)],
      [null, 'Tasa', pctOrDash(ratio(d.answered, d.recipients))],
    ]),
  }))

  const items = attention(guilds, now)
  const pillOf = { idle: pill('warning', 'Sin actividad'), left: pill('neutral', 'Expulsado'), failed: pill('critical', 'DMs fallidos') }

  return [
    pageHead('Resumen', 'Todos los servidores donde está el bot, solo con cifras agregadas.', updated),
    healthStrip(hl, { survey: o.failed_7d.survey, report: o.failed_7d.report, game: o.failed_7d.game + o.failed_7d.game_guess }, now),
    h(
      'div',
      { class: 'kpis' },
      kpi('Servidores activos', fmt(active), h('span', {}, h('span', { class: 'delta up' }, `+${fmt(o.guilds.new_7d)}`), ` esta semana · −${fmt(o.guilds.left_7d)} bajas`), o.weeks.length > 1 ? spark(o.weeks.map((w) => w.guilds ?? 0)) : undefined),
      kpi('Sin actividad (14 d)', fmt(o.guilds.idle), `de ${fmt(o.guilds.with_bot)} con el bot dentro · ${fmt(o.guilds.left)} expulsados`),
      kpi('Tasa de respuesta', rate === null ? '–' : unit(fmt(rate * 100), '%'), rateFoot, weeksWithRate.filter((r) => r !== null).length > 1 ? spark(weeksWithRate.map((r) => r ?? 0)) : undefined),
      kpi('Personas activas (7 d)', fmt(o.people.active_7d), `de ${fmt(o.people.members)} miembros`),
    ),
    h(
      'div',
      { class: 'grid-main' },
      card(
        'Respuestas por día',
        'Últimos 30 días · fines de semana en gris',
        barChart(dailyBars, { label: 'Respuestas por día, últimos 30 días', height: 240 }),
        tableView(
          ['Día', 'Enviadas', 'Respuestas', 'Con mensaje'],
          o.days.map((d) => [dayLong(d.day), d.recipients ? fmt(d.recipients) : '–', fmt(d.answers), fmt(d.with_message)]),
        ),
      ),
      card(
        'Uso',
        'Personas, no servidores',
        statList([
          ['Activas hoy', fmt(o.people.active_today)],
          ['Activas en 7 días', fmt(o.people.active_7d)],
          ['Activas en 30 días', fmt(o.people.active_30d)],
          ['Repiten (3+ días en 7)', pctOrDash(ratio(o.people.repeat_7d, o.people.active_7d))],
          ['Respuestas con mensaje', h('span', {}, pctOrDash(ratio(o.usage.with_message_7d, o.usage.answers_7d)), ' ', h('small', {}, '(solo el número)'))],
          ['Kudos esta semana', fmt(o.usage.kudos_7d)],
          ['Juego activo', h('span', {}, fmt(o.usage.games_on), ' ', h('small', {}, 'servidores'))],
          ['Respuestas al juego (7 d)', fmt(o.usage.game_answers_7d)],
          ['Preguntas propuestas (7 d)', fmt(o.usage.proposals_7d)],
          ['«No me preguntes más»', h('span', {}, fmt(o.people.opted_out), ' ', h('small', {}, o.people.members ? `(${pct(o.people.opted_out / o.people.members, 1)})` : ''))],
        ]),
      ),
    ),
    h(
      'div',
      { class: 'grid-2' },
      card(
        'Tasa de respuesta por semana',
        `${o.weeks.length} semanas`,
        weeksWithRate.some((r) => r !== null)
          ? lineChart(
              o.weeks.map((w) => w.week),
              [{ name: 'Tasa', color: 'var(--series)', values: weeksWithRate }],
              {
                label: 'Tasa de respuesta semanal',
                yMin: 0,
                yMax: 1,
                yFmt: (v) => `${Math.round(v * 100)} %`,
                xTick: dayShort,
                area: true,
                tip: (i) => tipRows(`Semana del ${dayShort(o.weeks[i].week)}`, [['var(--series)', 'Tasa', pctOrDash(weeksWithRate[i], 1)], [null, 'Enviadas', fmt(o.weeks[i].recipients)]]),
              },
            )
          : h('div', { class: 'chart-empty' }, 'Aún no hay datos: la tasa aparece cuando el bot empieza a contar a cuántos envía cada encuesta.'),
        tableView(['Semana', 'Enviadas', 'Respondidas', 'Tasa'], o.weeks.map((w, i) => [dayShort(w.week), fmt(w.recipients), fmt(w.answered), pctOrDash(weeksWithRate[i], 1)])),
      ),
      card(
        'Altas y bajas de servidores',
        'Por semana',
        h(
          'div',
          { class: 'legend' },
          legend('var(--cat-1)', 'Altas'),
          legend('var(--cat-2)', 'Bajas (expulsado o borrado)'),
        ),
        flowChart(
          o.weeks.map((w) => ({
            label: dayShort(w.week),
            up: w.joins ?? 0,
            down: w.leaves ?? 0,
            tip: tipRows(`Semana del ${dayShort(w.week)}`, [['var(--cat-1)', 'Altas', fmt(w.joins ?? 0)], ['var(--cat-2)', 'Bajas', fmt(w.leaves ?? 0)], [null, 'Con el bot al cierre', fmt(w.guilds ?? 0)]]),
          })),
          { label: 'Altas y bajas por semana' },
        ),
        tableView(['Semana', 'Altas', 'Bajas', 'Con el bot'], o.weeks.map((w) => [dayShort(w.week), fmt(w.joins ?? 0), fmt(w.leaves ?? 0), fmt(w.guilds ?? 0)])),
      ),
    ),
    card(
      'Necesitan atención',
      items.length === 1 ? '1 aviso' : `${items.length} avisos`,
      items.length
        ? h(
            'div',
            { class: 'attn' },
            ...items.map(({ guild, kind, text }) =>
              h(
                'button',
                { class: 'attn-item', type: 'button', onclick: () => open(guild.discord_guild_id) },
                guildBadge(guild),
                h('span', { class: 'what' }, h('b', {}, guild.name), h('span', {}, text)),
                pillOf[kind].cloneNode(true),
                h('span', { class: 'chev' }, icon('chev')),
              ),
            ),
          )
        : h('p', { class: 'empty' }, 'Todo en orden: ningún servidor inactivo, expulsado ni con muchos DMs fallidos.'),
    ),
  ]
}

function legend(color: string, text: string): HTMLElement {
  const sw = h('span', { class: 'sw' })
  sw.style.background = color
  return h('span', {}, sw, text)
}
