import type { GuildDetail, RolesMode } from '../api'
import { barChart, tableView, tipRows } from '../charts'
import { h } from '../dom'
import { dateLong, dayLong, dayShort, fmt, guildRate, languageName, pctOrDash, ratio, workingDays } from '../format'
import { icon } from '../icons'
import { card, guildBadge, kpi, pill, statList, statusPill, unit } from '../ui'

const roles: Record<RolesMode, string> = { all: 'Everyone', except: 'All but some roles', only: 'Only some roles' }

export function guildPage(d: GuildDetail, back: () => void): Node[] {
  const g = d.guild
  const s = d.settings
  const rate = guildRate(g)
  const chip = (k: string, v: string) => h('span', { class: 'chip' }, `${k} `, h('b', {}, v))
  const weeks = d.weeks.map((w) => ({
    label: dayShort(w.week),
    value: w.answers,
    tip: tipRows(`Week of ${dayShort(w.week)}`, [
      [null, 'Answers', fmt(w.answers)],
      [null, 'Sent', w.recipients ? fmt(w.recipients) : '–'],
      [null, 'Rate', pctOrDash(ratio(w.answered, w.recipients))],
    ]),
  }))

  return [
    h('button', { class: 'back', type: 'button', onclick: back }, icon('back', 'icon-sm'), 'All servers'),
    h(
      'div',
      { class: 'detail-head' },
      guildBadge(g),
      h('div', { class: 'detail-title' }, h('h1', {}, g.name), h('div', { class: 'meta' }, `ID ${g.discord_guild_id}`)),
      h('span', { class: 'detail-status' }, statusPill(g)),
    ),
    h(
      'div',
      { class: 'kpis' },
      kpi('Members', fmt(g.members), `${fmt(g.opted_out)} pressed “Don't ask me again”`),
      kpi('Active (7 d)', g.status === 'left' ? '–' : fmt(g.active_7d), 'answered at least once'),
      kpi('Response rate', rate === null ? '–' : unit(fmt(rate * 100), '%'), rate === null ? 'no surveys counted this week' : `${fmt(g.answered_7d)} of ${fmt(g.recipients_7d)} surveys`),
      kpi('Failed DMs (7 d)', fmt(g.failed_7d), g.failed_7d > 0 && g.failed_7d >= 0.2 * g.recipients_7d ? pill('critical', 'Check') : 'closed DMs or bot blocked'),
    ),
    h(
      'div',
      { class: 'grid-main' },
      card(
        'Answers per week',
        `Last ${d.weeks.length} weeks`,
        barChart(weeks, { label: `Answers per week in ${g.name}` }),
        tableView(['Week', 'Sent', 'Answers', 'Rate'], d.weeks.map((w) => [dayShort(w.week), w.recipients ? fmt(w.recipients) : '–', fmt(w.answers), pctOrDash(ratio(w.answered, w.recipients))])),
      ),
      card(
        'Settings',
        null,
        h(
          'div',
          { class: 'chips' },
          chip('Language', languageName(g.language)),
          chip('Timezone', g.timezone),
          chip('Survey', `${String(s.survey_hour).padStart(2, '0')}:00`),
          chip('Days', workingDays(s.working_days)),
          chip('Report', s.report_frequency === 'weekly' ? 'Weekly' : 'Monthly'),
          chip('Report DM', s.report_dm ? 'Yes' : 'No'),
          chip('Answers', s.anonymous ? 'Anonymous' : 'Named'),
          chip('Custom message', s.custom_message ? 'Yes' : 'No'),
          chip('Survey roles', roles[s.survey_roles]),
          chip('Game', s.games_enabled ? `On · ${roles[s.game_roles].toLowerCase()}` : 'Off'),
          chip('Kudos channel', s.kudos_channel ? 'Yes' : 'No'),
        ),
        statList([
          ['Bot added', dateLong(g.created_at)],
          ...(g.left_at ? ([['Removed', dateLong(g.left_at)]] as [string, string][]) : []),
          ...(g.purge_at ? ([['Deleted', dateLong(g.purge_at)]] as [string, string][]) : []),
          ['Last answer', g.last_answer ? dayLong(g.last_answer) : '–'],
          ['Last report', d.last_report ? `for ${dayLong(d.last_report)}` : '–'],
          ['Kudos (7 d)', fmt(d.kudos_7d)],
          ['With a comment (30 d)', h('span', {}, pctOrDash(ratio(d.with_message_30d, d.answers_30d)), ' ', h('small', {}, `of ${fmt(d.answers_30d)}`))],
          ['Game answers (7 d)', fmt(d.game_answers_7d)],
        ]),
      ),
    ),
  ]
}
