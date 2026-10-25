import type { Count, Settings } from '../api'
import { distribution } from '../charts'
import { h } from '../dom'
import { languageName } from '../format'
import { card, pageHead } from '../ui'

/** top keeps the n most common values and folds the rest into "Otras". */
export function top(cs: Count[], n: number, label: (v: string) => string = (v) => v): { label: string; n: number }[] {
  const sorted = [...cs].sort((a, b) => b.guilds - a.guilds || a.value.localeCompare(b.value))
  const head = sorted.slice(0, n).map((c) => ({ label: label(c.value), n: c.guilds }))
  const rest = sorted.slice(n).reduce((a, c) => a + c.guilds, 0)
  return rest > 0 ? [...head, { label: 'Otras', n: rest }] : head
}

const names: Record<string, string> = {
  anonymous: 'Anónimas',
  public: 'Públicas',
  weekly: 'Semanal',
  monthly: 'Mensual',
  on: 'Activado',
  off: 'Desactivado',
  all: 'Todos',
  except: 'Todos excepto unos roles',
  only: 'Solo unos roles',
}
const named = (v: string) => names[v] ?? v

export function settingsPage(st: Settings, updated: Node): Node[] {
  const N = st.guilds
  const extras: Record<string, string> = {
    games: 'Juego «¿Quién es quién?»',
    kudos_channel: 'Canal de kudos',
    custom_message: 'Mensaje de encuesta propio',
    custom_days: 'Días laborables cambiados',
  }
  return [
    pageHead('Configuración de los servidores', `Cómo tienen configurado HappyX los ${N} servidores con el bot dentro. Sirve para decidir valores por defecto.`, updated),
    h(
      'div',
      { class: 'grid-2' },
      card('Idioma', null, distribution(top(st.language, 5, languageName), N)),
      card('Zona horaria', null, distribution(top(st.timezone, 5), N)),
      card('Hora de la encuesta', null, distribution(top(st.survey_hour, 5), N)),
      card('Respuestas', null, distribution(top(st.anonymous, 2, named), N)),
      card('Frecuencia del report', null, distribution(top(st.report_frequency, 2, named), N)),
      card('Report por DM al admin', null, distribution(top(st.report_dm, 2, named), N)),
      card('Quién recibe la encuesta', null, distribution(top(st.survey_roles, 3, named), N)),
      card('Extras', null, distribution(st.extras.map((c) => ({ label: extras[c.value] ?? c.value, n: c.guilds })), N)),
    ),
  ]
}
