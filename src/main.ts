// HappyX Admin: the owner's dashboard for a HappyX instance. Reachable only from the local
// network, it shows counts across every server, never what members wrote.
// Routes live in the URL fragment: #/ (overview), #/servers, #/servers/<id>, #/health, #/settings.

import './style.css'
import logoUrl from './logo.svg'
import { api } from './api'
import { h } from './dom'
import { ago } from './format'
import { icon } from './icons'
import { guildPage } from './pages/guild'
import { guildsPage } from './pages/guilds'
import { healthPage } from './pages/health'
import { overviewPage } from './pages/overview'
import { settingsPage } from './pages/settings'
import { applySavedTheme, currentTheme, setTheme } from './theme'
import { parseRoute, type Route } from './route'
import { errorCard, skeleton } from './ui'

applySavedTheme()

const tabs: [Route['page'], string][] = [
  ['overview', 'Overview'],
  ['servers', 'Servers'],
  ['health', 'Health'],
  ['settings', 'Settings'],
]

const app = document.getElementById('app')!
const main = h('main', { class: 'container', id: 'main' })
const themeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Switch theme' })
const navLinks = tabs.map(([page, label]) => h('a', { href: page === 'overview' ? '#/' : `#/${page}`, class: 'nav-link', 'data-page': page }, label))

function paintTheme() {
  const dark = currentTheme() === 'dark'
  themeBtn.replaceChildren(icon(dark ? 'sun' : 'moon'))
  themeBtn.setAttribute('aria-label', dark ? 'Use light theme' : 'Use dark theme')
}
themeBtn.addEventListener('click', () => {
  setTheme(currentTheme() === 'dark' ? 'light' : 'dark')
  paintTheme()
})
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintTheme)
paintTheme()

app.replaceChildren(
  h(
    'header',
    { class: 'topbar' },
    h(
      'div',
      { class: 'topbar-in' },
      h('a', { class: 'brand', href: '#/' }, h('img', { src: logoUrl, alt: '', width: 28, height: 28 }), 'HappyX ', h('span', { class: 'tag' }, 'ADMIN')),
      h('nav', { class: 'nav', 'aria-label': 'Sections' }, ...navLinks),
      h(
        'div',
        { class: 'top-right' },
        h('span', { class: 'lan', title: 'This dashboard only opens from the local network' }, icon('home', 'icon-sm'), h('span', {}, 'Local network')),
        themeBtn,
      ),
    ),
  ),
  main,
)

let loadedAt = Date.now()
let renderId = 0

function updatedLine(): HTMLElement {
  const label = h('span', { class: 'muted small' }, `Updated ${ago(new Date(loadedAt).toISOString())}`)
  const tick = setInterval(() => (label.isConnected ? (label.textContent = `Updated ${ago(new Date(loadedAt).toISOString())}`) : clearInterval(tick)), 30_000)
  return h('span', { class: 'updated' }, label, h('button', { class: 'icon-btn refresh', type: 'button', 'aria-label': 'Refresh', onclick: () => render() }, icon('refresh')))
}

const openGuild = (id: string) => (location.hash = `#/servers/${id}`)

async function render() {
  const route = parseRoute(location.hash)
  const id = ++renderId
  navLinks.forEach((a) => a.classList.toggle('nav-on', a.dataset.page === route.page))
  navLinks.forEach((a) => (a.dataset.page === route.page ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')))
  if (!main.childElementCount) main.replaceChildren(skeleton())
  try {
    let nodes: Node[]
    if (route.page === 'servers' && route.guild) {
      nodes = guildPage(await api.guild(route.guild), () => (location.hash = '#/servers'))
    } else if (route.page === 'servers') {
      nodes = guildsPage(await api.guilds(), openGuild, updatedLine())
    } else if (route.page === 'health') {
      nodes = healthPage(await api.health(), updatedLine())
    } else if (route.page === 'settings') {
      nodes = settingsPage(await api.settings(), updatedLine())
    } else {
      const [o, hl, gs] = await Promise.all([api.overview(), api.health(), api.guilds()])
      nodes = overviewPage(o, hl, gs, openGuild, updatedLine())
    }
    if (id !== renderId) return // a newer navigation won
    loadedAt = Date.now()
    main.replaceChildren(...nodes, h('p', { class: 'foot-note' }, 'HappyX Admin · counts only: never moods, messages or names.'))
    // Refresh the "updated" label now that loadedAt moved.
    main.querySelectorAll('.updated .muted').forEach((el) => (el.textContent = `Updated ${ago(new Date(loadedAt).toISOString())}`))
  } catch (err) {
    if (id !== renderId) return
    main.replaceChildren(errorCard(err))
  }
}

let lastPage = ''
window.addEventListener('hashchange', () => {
  const page = location.hash
  main.replaceChildren(skeleton())
  if (page !== lastPage) window.scrollTo(0, 0)
  lastPage = page
  render()
})
// Data changes slowly; refresh the open page every five minutes while it's visible.
setInterval(() => document.visibilityState === 'visible' && render(), 5 * 60_000)
render()
