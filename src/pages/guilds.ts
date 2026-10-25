import type { Guild, GuildStatus } from '../api'
import { h } from '../dom'
import { dateMedium, fmt, guildRate, pct } from '../format'
import { icon } from '../icons'
import { guildBadge, pageHead, statusPill } from '../ui'

type Filter = 'all' | GuildStatus
type SortKey = 'name' | 'members' | 'active_7d' | 'rate' | 'created_at' | 'status'

// What the list remembers while the page is open: filter, search and order.
const state: { filter: Filter; q: string; sort: SortKey; dir: 1 | -1 } = { filter: 'all', q: '', sort: 'members', dir: -1 }

const statusOrder: Record<GuildStatus, number> = { active: 0, idle: 1, left: 2 }

function value(g: Guild, k: SortKey): number | string {
  switch (k) {
    case 'name':
      return g.name.toLocaleLowerCase('en')
    case 'rate':
      return guildRate(g) ?? -1
    case 'status':
      return statusOrder[g.status]
    case 'created_at':
      return g.created_at
    default:
      return g[k]
  }
}

/** visible applies the filter, the search and the order. */
export function visible(guilds: Guild[], s = state): Guild[] {
  const q = s.q.trim().toLocaleLowerCase('en')
  return guilds
    .filter((g) => s.filter === 'all' || g.status === s.filter)
    .filter((g) => !q || g.name.toLocaleLowerCase('en').includes(q) || g.discord_guild_id.includes(q))
    .sort((a, b) => {
      const va = value(a, s.sort)
      const vb = value(b, s.sort)
      return (va > vb ? 1 : va < vb ? -1 : 0) * s.dir || a.name.localeCompare(b.name, 'en')
    })
}

export function guildsPage(guilds: Guild[], open: (id: string) => void, updated: Node): Node[] {
  const names: Record<Filter, string> = { all: 'All', active: 'Active', idle: 'Idle', left: 'Removed' }
  const count = (f: Filter) => (f === 'all' ? guilds.length : guilds.filter((g) => g.status === f).length)
  const tbody = h('tbody')
  const segButtons = (Object.keys(names) as Filter[]).map((f) =>
    h('button', { type: 'button', 'aria-pressed': String(state.filter === f), onclick: () => ((state.filter = f), redraw()) }, names[f], h('span', { class: 'count' }, String(count(f)))),
  )
  const cols: [SortKey, string, boolean][] = [
    ['name', 'Server', false],
    ['members', 'Members', true],
    ['active_7d', 'Active 7 d', true],
    ['rate', 'Response rate', true],
    ['created_at', 'Added', false],
    ['status', 'State', false],
  ]
  const ths = cols.map(([k, label, num]) =>
    h(
      'th',
      { class: num ? 'num' : '' },
      h('button', { type: 'button', onclick: () => ((state.dir = state.sort === k ? (state.dir === 1 ? -1 : 1) : k === 'name' ? 1 : -1), (state.sort = k), redraw()) }, label),
    ),
  )

  function redraw() {
    segButtons.forEach((b, i) => b.setAttribute('aria-pressed', String((Object.keys(names) as Filter[])[i] === state.filter)))
    ths.forEach((th, i) => {
      if (cols[i][0] === state.sort) th.setAttribute('aria-sort', state.dir === 1 ? 'ascending' : 'descending')
      else th.removeAttribute('aria-sort')
    })
    const list = visible(guilds)
    tbody.replaceChildren(
      ...list.map((g) => {
        const rate = guildRate(g)
        const fill = h('span', { class: 'fill' })
        fill.style.width = `${(rate ?? 0) * 100}%`
        return h(
          'tr',
          { tabindex: 0, onclick: () => open(g.discord_guild_id), onkeydown: (e: Event) => (e as KeyboardEvent).key === 'Enter' && open(g.discord_guild_id) },
          h('td', {}, h('span', { class: 'srv' }, guildBadge(g), h('span', { class: 'srv-name', title: g.name }, g.name))),
          h('td', { class: 'num' }, fmt(g.members)),
          h('td', { class: 'num' }, g.status === 'left' ? '–' : fmt(g.active_7d)),
          h('td', { class: 'num' }, rate === null ? '–' : h('span', { class: 'rate' }, pct(rate), h('span', { class: 'track' }, fill))),
          h('td', {}, dateMedium(g.created_at)),
          h('td', {}, statusPill(g)),
        )
      }),
    )
    if (!list.length) tbody.append(h('tr', { class: 'empty-row' }, h('td', { colspan: 6 }, guilds.length ? 'No server matches the search.' : 'No servers with the bot yet.')))
  }
  redraw()

  return [
    pageHead('Servers', 'Every server with the bot, or that had it in the last 30 days. Counts only.', updated),
    h(
      'div',
      { class: 'toolbar' },
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Filter by state' }, ...segButtons),
      h(
        'label',
        { class: 'search' },
        icon('search', 'icon-sm'),
        h('input', { id: 'q', type: 'search', placeholder: 'Search servers', value: state.q, 'aria-label': 'Search servers', oninput: (e: Event) => ((state.q = (e.target as HTMLInputElement).value), redraw()) }),
      ),
    ),
    h('section', { class: 'card table-card' }, h('div', { class: 'scroll-x' }, h('table', { class: 'table servers-table' }, h('thead', {}, h('tr', {}, ...ths)), tbody))),
    h('p', { class: 'foot-note' }, 'Servers that remove the bot are kept for 30 days in case they invite it back; after that they are deleted automatically.'),
  ]
}
