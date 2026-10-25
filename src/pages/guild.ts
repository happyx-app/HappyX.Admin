import type { GuildDetail, RolesMode } from '../api'
import { barChart, tableView, tipRows } from '../charts'
import { h } from '../dom'
import { dateLong, dayLong, dayShort, fmt, guildRate, languageName, pctOrDash, ratio, workingDays } from '../format'
import { icon } from '../icons'
import { card, guildBadge, kpi, pill, statList, statusPill, unit } from '../ui'

const roles: Record<RolesMode, string> = { all: 'Todos', except: 'Excepto unos roles', only: 'Solo unos roles' }

export function guildPage(d: GuildDetail, back: () => void): Node[] {
  const g = d.guild
  const s = d.settings
  const rate = guildRate(g)
  const chip = (k: string, v: string) => h('span', { class: 'chip' }, `${k} `, h('b', {}, v))
  const weeks = d.weeks.map((w) => ({
    label: dayShort(w.week),
    value: w.answers,
    tip: tipRows(`Semana del ${dayShort(w.week)}`, [
      [null, 'Respuestas', fmt(w.answers)],
      [null, 'Enviadas', w.recipients ? fmt(w.recipients) : '–'],
      [null, 'Tasa', pctOrDash(ratio(w.answered, w.recipients))],
    ]),
  }))

  return [
    h('button', { class: 'back', type: 'button', onclick: back }, icon('back', 'icon-sm'), 'Todos los servidores'),
    h(
      'div',
      { class: 'detail-head' },
      guildBadge(g),
      h('div', { class: 'detail-title' }, h('h1', {}, g.name), h('div', { class: 'meta' }, `ID ${g.discord_guild_id}`)),
      h('span', { class: 'detail-status' }, statusPill(g)),
    ),
    h(
      'div',
      { class: 'privacy-note' },
      icon('lock', 'icon-sm'),
      h('span', {}, 'Aquí solo hay recuentos. Ni estados de ánimo, ni mensajes, ni nombres de miembros: eso es del servidor y lo ve su admin en la web.'),
    ),
    h(
      'div',
      { class: 'kpis' },
      kpi('Miembros', fmt(g.members), `${fmt(g.opted_out)} pulsaron «No me preguntes más»`),
      kpi('Activos en 7 días', g.status === 'left' ? '–' : fmt(g.active_7d), 'han respondido al menos una vez'),
      kpi('Tasa de respuesta', rate === null ? '–' : unit(fmt(rate * 100), '%'), rate === null ? 'sin encuestas contadas esta semana' : `${fmt(g.answered_7d)} de ${fmt(g.recipients_7d)} encuestas`),
      kpi('DMs fallidos (7 d)', fmt(g.failed_7d), g.failed_7d > 0 && g.failed_7d >= 0.2 * g.recipients_7d ? pill('critical', 'Revisar') : 'DMs cerrados o bot bloqueado'),
    ),
    h(
      'div',
      { class: 'grid-main' },
      card(
        'Respuestas por semana',
        `Últimas ${d.weeks.length} semanas`,
        barChart(weeks, { label: `Respuestas por semana en ${g.name}` }),
        tableView(['Semana', 'Enviadas', 'Respuestas', 'Tasa'], d.weeks.map((w) => [dayShort(w.week), w.recipients ? fmt(w.recipients) : '–', fmt(w.answers), pctOrDash(ratio(w.answered, w.recipients))])),
      ),
      card(
        'Configuración',
        null,
        h(
          'div',
          { class: 'chips' },
          chip('Idioma', languageName(g.language)),
          chip('Zona', g.timezone),
          chip('Encuesta', `${String(s.survey_hour).padStart(2, '0')}:00`),
          chip('Días', workingDays(s.working_days)),
          chip('Report', s.report_frequency === 'weekly' ? 'Semanal' : 'Mensual'),
          chip('DM del report', s.report_dm ? 'Sí' : 'No'),
          chip('Respuestas', s.anonymous ? 'Anónimas' : 'Públicas'),
          chip('Mensaje propio', s.custom_message ? 'Sí' : 'No'),
          chip('Roles encuesta', roles[s.survey_roles]),
          chip('Juego', s.games_enabled ? `Activo · ${roles[s.game_roles].toLowerCase()}` : 'Apagado'),
          chip('Canal de kudos', s.kudos_channel ? 'Sí' : 'No'),
        ),
        statList([
          ['Alta del bot', dateLong(g.created_at)],
          ...(g.left_at ? ([['Expulsó al bot', dateLong(g.left_at)]] as [string, string][]) : []),
          ...(g.purge_at ? ([['Se borra el', dateLong(g.purge_at)]] as [string, string][]) : []),
          ['Última respuesta', g.last_answer ? dayLong(g.last_answer) : '–'],
          ['Último report enviado', d.last_report ? `periodo del ${dayLong(d.last_report)}` : '–'],
          ['Kudos esta semana', fmt(d.kudos_7d)],
          ['Respuestas con mensaje (30 d)', h('span', {}, pctOrDash(ratio(d.with_message_30d, d.answers_30d)), ' ', h('small', {}, `de ${fmt(d.answers_30d)}`))],
          ['Respuestas al juego (7 d)', fmt(d.game_answers_7d)],
        ]),
      ),
    ),
  ]
}
