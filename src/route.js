// The web address is the single source of truth for which page is open.
// Pure helpers (no imports) so they can be unit-tested.
export const TAB_PATH = { h: '/', c: '/clients', s: '/calendar', m: '/payments', r: '/reports', g: '/settings', a: '/admin', x: '/more' }

// "/payments/", "/payments?x=1" and "/payments#top" all mean "/payments"
const norm = (p) => String(p || '/').split(/[?#]/)[0].replace(/\/+$/, '') || '/'

export const pathToTab = (p) => Object.keys(TAB_PATH).find((k) => TAB_PATH[k] === norm(p)) || null
export const tabToPath = (t) => TAB_PATH[t] || '/'

// People who may not open a page are shown Home instead
export const allowedTab = (tab, owner, isAdmin) => ((!owner && (tab === 'm' || tab === 'r')) || (!isAdmin && tab === 'a') ? 'h' : tab)

// If the address does not match the page being shown, the address it should have (otherwise null)
export const syncPath = (current, tab, owner, isAdmin) => {
  const want = tabToPath(allowedTab(tab, owner, isAdmin))
  return norm(current) === want ? null : want
}
