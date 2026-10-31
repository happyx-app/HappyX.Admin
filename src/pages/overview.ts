import type { Guild, Health, Overview } from '../api'
import { barChart, flowChart, lineChart, spark, tableView, tipRows } from '../charts'
import { h } from '../dom'
import type { Phase0 } from '../api'
import { attention, dayLong, dayShort, fmt, isWeekend, pct, pctOrDash, PHASE0_ACTIVE_GOAL, rateOf, ratio } from '../format'
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
      ? 'Measured once the bot reports how many people it sends to'
      : prevRate === null
        ? 'last 7 days'
        : h('span', {}, h('span', { class: `delta ${rate >= prevRate ? 'up' : 'down'}` }, `${rate >= prevRate ? '+' : '−'}${fmt(Math.abs(rate - prevRate) * 100, 1)} pt`), ' vs. previous week')

  const dailyBars = o.days.map((d) => ({
    label: dayShort(d.day),
    value: d.answers,
    muted: isWeekend(d.day),
    tip: tipRows(dayLong(d.day), [
      [null, 'Answers', fmt(d.answers)],
      [null, 'Surveys sent', d.recipients ? fmt(d.recipients) : '–'],
      [null, 'With a message', fmt(d.with_message)],
      [null, 'Rate', pctOrDash(ratio(d.answered, d.recipients))],
    ]),
  }))

  const items = attention(guilds, now)
  const pillOf = { idle: pill('warning', 'Idle'), left: pill('neutral', 'Removed'), failed: pill('critical', 'Failed DMs') }

  return [
    pageHead('Overview', '', updated),
    healthStrip(hl, { survey: o.failed_7d.survey, report: o.failed_7d.report, game: o.failed_7d.game + o.failed_7d.game_guess }, now),
    h(
      'div',
      { class: 'kpis' },
      kpi('Active servers', fmt(active), h('span', {}, h('span', { class: 'delta up' }, `+${fmt(o.guilds.new_7d)}`), ` joined · −${fmt(o.guilds.left_7d)} left (7 d)`), o.weeks.length > 1 ? spark(o.weeks.map((w) => w.guilds ?? 0)) : undefined),
      kpi('Idle (14 d)', fmt(o.guilds.idle), `of ${fmt(o.guilds.with_bot)} with the bot`),
      kpi('Response rate', rate === null ? '–' : unit(fmt(rate * 100), '%'), rateFoot, weeksWithRate.filter((r) => r !== null).length > 1 ? spark(weeksWithRate.map((r) => r ?? 0)) : undefined),
      kpi('Active (7 d)', fmt(o.people.active_7d), `of ${fmt(o.people.members)} members`),
    ),
    ...(o.phase0 ? [phase0Card(o.phase0)] : []),
    h(
      'div',
      { class: 'grid-main' },
      card(
        'Answers per day',
        'Last 30 days · weekends in grey',
        barChart(dailyBars, { label: 'Answers per day, last 30 days', height: 240 }),
        tableView(
          ['Day', 'Sent', 'Answers', 'With a message'],
          o.days.map((d) => [dayLong(d.day), d.recipients ? fmt(d.recipients) : '–', fmt(d.answers), fmt(d.with_message)]),
        ),
      ),
      card(
        'Usage',
        'People, not servers',
        statList([
          ['Active (today)', fmt(o.people.active_today)],
          ['Active (7 d)', fmt(o.people.active_7d)],
          ['Active (30 d)', fmt(o.people.active_30d)],
          ['Answered 3+ of last 7 days', pctOrDash(ratio(o.people.repeat_7d, o.people.active_7d))],
          ['With a comment (7 d)', pctOrDash(ratio(o.usage.with_message_7d, o.usage.answers_7d))],
          ['Kudos (7 d)', fmt(o.usage.kudos_7d)],
          ['Game on', h('span', {}, fmt(o.usage.games_on), ' ', h('small', {}, 'servers'))],
          ['Game answers (7 d)', fmt(o.usage.game_answers_7d)],
          ['Proposed questions (7 d)', fmt(o.usage.proposals_7d)],
          ["“Don't ask me again”", h('span', {}, fmt(o.people.opted_out), ' ', h('small', {}, o.people.members ? `(${pct(o.people.opted_out / o.people.members, 1)})` : ''))],
        ]),
      ),
    ),
    h(
      'div',
      { class: 'grid-2' },
      card(
        'Response rate per week',
        `${o.weeks.length} weeks`,
        weeksWithRate.some((r) => r !== null)
          ? lineChart(
              o.weeks.map((w) => w.week),
              [{ name: 'Rate', color: 'var(--series)', values: weeksWithRate }],
              {
                label: 'Weekly response rate',
                yMin: 0,
                yMax: 1,
                yFmt: (v) => `${Math.round(v * 100)}%`,
                xTick: dayShort,
                area: true,
                tip: (i) => tipRows(`Week of ${dayShort(o.weeks[i].week)}`, [['var(--series)', 'Rate', pctOrDash(weeksWithRate[i], 1)], [null, 'Sent', fmt(o.weeks[i].recipients)]]),
              },
            )
          : h('div', { class: 'chart-empty' }, 'No data yet: the rate shows up once the bot starts counting who each survey goes to.'),
        tableView(['Week', 'Sent', 'Answered', 'Rate'], o.weeks.map((w, i) => [dayShort(w.week), fmt(w.recipients), fmt(w.answered), pctOrDash(weeksWithRate[i], 1)])),
      ),
      card(
        'Servers joining and leaving',
        'Per week',
        h(
          'div',
          { class: 'legend' },
          legend('var(--cat-1)', 'Joined'),
          legend('var(--cat-2)', 'Left'),
        ),
        flowChart(
          o.weeks.map((w) => ({
            label: dayShort(w.week),
            up: w.joins ?? 0,
            down: w.leaves ?? 0,
            tip: tipRows(`Week of ${dayShort(w.week)}`, [['var(--cat-1)', 'Joined', fmt(w.joins ?? 0)], ['var(--cat-2)', 'Left', fmt(w.leaves ?? 0)], [null, 'With the bot at week end', fmt(w.guilds ?? 0)]]),
          })),
          { label: 'Servers joining and leaving per week' },
        ),
        tableView(['Week', 'Joined', 'Left', 'With the bot'], o.weeks.map((w) => [dayShort(w.week), fmt(w.joins ?? 0), fmt(w.leaves ?? 0), fmt(w.guilds ?? 0)])),
      ),
    ),
    card(
      'Needs attention',
      items.length === 1 ? '1 alert' : `${items.length} alerts`,
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
        : h('p', { class: 'empty' }, 'Nothing needs attention.'),
    ),
  ]
}

// Progress towards the market study's Phase 0 gate, before any billing gets built.
function phase0Card(p: Phase0): HTMLElement {
  const fill = h('span', { class: 'goal-fill' })
  fill.style.width = `${Math.min(100, (p.active_guilds / PHASE0_ACTIVE_GOAL) * 100)}%`
  return card(
    'Phase 0 goal',
    'From the market study',
    h(
      'div',
      { class: 'grid-2' },
      h(
        'div',
        { class: 'goal' },
        h('div', { class: 'goal-head' }, h('span', {}, 'Active servers'), h('b', {}, `${fmt(p.active_guilds)} / ${fmt(PHASE0_ACTIVE_GOAL)}`)),
        h('span', { class: 'goal-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(PHASE0_ACTIVE_GOAL), 'aria-valuenow': String(p.active_guilds), 'aria-label': 'Active servers' }, fill),
        h('small', {}, '5 or more people answering in the last 7 days'),
      ),
      statList([['Over 15 people (free plan limit)', fmt(p.over_free)]]),
    ),
  )
}

function legend(color: string, text: string): HTMLElement {
  const sw = h('span', { class: 'sw' })
  sw.style.background = color
  return h('span', {}, sw, text)
}
