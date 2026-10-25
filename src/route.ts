// Routes live in the URL fragment, which the browser never sends to the server.

export type Route = { page: 'overview' | 'servers' | 'health' | 'settings'; guild?: string }

export function parseRoute(hash: string): Route {
  const [page, guild] = hash.replace(/^#\/?/, '').split('/')
  if (page === 'servers') return guild && /^\d{15,20}$/.test(guild) ? { page, guild } : { page }
  if (page === 'health' || page === 'settings') return { page }
  return { page: 'overview' }
}
