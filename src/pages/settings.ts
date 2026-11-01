import type { Count, Settings } from '../api'
import { distribution } from '../charts'
import { h } from '../dom'
import { languageName } from '../format'
import { card, pageHead } from '../ui'

/** top keeps the n most common values and folds the rest into "Other". */
export function top(cs: Count[], n: number, label: (v: string) => string = (v) => v): { label: string; n: number }[] {
  const sorted = [...cs].sort((a, b) => b.guilds - a.guilds || a.value.localeCompare(b.value))
  const head = sorted.slice(0, n).map((c) => ({ label: label(c.value), n: c.guilds }))
  const rest = sorted.slice(n).reduce((a, c) => a + c.guilds, 0)
  return rest > 0 ? [...head, { label: 'Other', n: rest }] : head
}

const names: Record<string, string> = {
  anonymous: 'Anonymous',
  public: 'Named',
  weekly: 'Weekly',
  monthly: 'Monthly',
  on: 'On',
  off: 'Off',
  all: 'Everyone',
  except: 'All but some roles',
  only: 'Only some roles',
  true: 'Yes',
  false: 'No',
}
const named = (v: string) => names[v] ?? v

export function settingsPage(st: Settings, updated: Node): Node[] {
  const N = st.guilds
  const extras: Record<string, string> = {
    games: "“Who's who?” game",
    kudos_channel: 'Kudos channel',
    custom_message: 'Custom message',
    custom_days: 'Custom days',
  }
  return [
    pageHead('Server settings', `Settings across the ${N} servers with the bot.`, updated),
    h(
      'div',
      { class: 'grid-2' },
      card('Language', null, distribution(top(st.language, 5, languageName), N)),
      card('Timezone', null, distribution(top(st.timezone, 5), N)),
      card('Survey time', null, distribution(top(st.survey_hour, 5, (v) => `${v.padStart(2, '0')}:00`), N)),
      card('Anonymity', null, distribution(top(st.anonymous, 2, (v) => (v === 'true' ? 'Anonymous' : v === 'false' ? 'Named' : named(v))), N)),
      card('Report frequency', null, distribution(top(st.report_frequency, 2, named), N)),
      card('Report DM to the admin', null, distribution(top(st.report_dm, 2, named), N)),
      card('Who gets the survey', null, distribution(top(st.survey_roles, 3, named), N)),
      card('Extras', null, distribution(st.extras.map((c) => ({ label: extras[c.value] ?? c.value, n: c.guilds })), N)),
    ),
  ]
}
