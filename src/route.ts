// Routes live in the URL fragment, which the browser never sends to the server.

export type Route = { page: 'resumen' | 'servidores' | 'salud' | 'configuracion'; guild?: string }

export function parseRoute(hash: string): Route {
  const [page, guild] = hash.replace(/^#\/?/, '').split('/')
  if (page === 'servidores') return guild && /^\d{15,20}$/.test(guild) ? { page, guild } : { page }
  if (page === 'salud' || page === 'configuracion') return { page }
  return { page: 'resumen' }
}
