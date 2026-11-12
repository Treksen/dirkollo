import { supabase } from './supabase'
import { APP_VERSION } from './version'
import { scrub, shouldIgnore, fingerprint } from './errscrub'
import { deviceName } from './offline'

// Reports mistakes to the Admin (Admin > Errors). Never throws, never reports client details, never floods.
const QKEY = 'dk_errq'
const NAMES = { h: 'Home', c: 'Clients', s: 'Calendar', m: 'Payments', r: 'Reports', g: 'Settings', a: 'Admin', x: 'More' }
const sent = new Map()
let stamps = []

const load = () => { try { return JSON.parse(localStorage.getItem(QKEY) || '[]') } catch { return [] } }
const save = (q) => { try { localStorage.setItem(QKEY, JSON.stringify(q.slice(-20))) } catch { /* storage blocked */ } }
const page = () => { try { return NAMES[JSON.parse(sessionStorage.getItem('dk_nav') || '{}').tab] || 'App' } catch { return 'App' } }

async function send(p) {
  const { error } = await supabase.rpc('report_error', p)
  return !error
}

// reports that could not be sent (offline, or not signed in yet) wait on the phone and go out later
export async function flushErrors() {
  if (!navigator.onLine) return
  const q = load()
  if (!q.length) return
  const rest = []
  for (const p of q) { if (!(await send(p))) rest.push(p) }
  save(rest)
}

export function reportError(err, kind = 'error') {
  try {
    const raw = err && typeof err === 'object' && 'message' in err ? err : { message: String(err), stack: '' }
    if (shouldIgnore(raw.message, raw.stack)) return
    const message = scrub(raw.message)
    const fp = fingerprint(kind, message, raw.stack)
    const now = Date.now()
    if (sent.has(fp) && now - sent.get(fp) < 60000) return // same mistake within a minute
    stamps = stamps.filter((t) => now - t < 60000)
    if (stamps.length >= 6) return // never flood
    stamps.push(now); sent.set(fp, now)
    const p = { p_fingerprint: fp, p_kind: kind, p_message: message, p_stack: scrub(raw.stack, 3000), p_page: page(), p_version: APP_VERSION, p_agent: deviceName() }
    if (!navigator.onLine) { save([...load(), p]); return }
    send(p).then((ok) => { if (!ok) save([...load(), p]) }, () => save([...load(), p]))
  } catch { /* reporting must never break the app */ }
}

export function installErrorReporting() {
  window.addEventListener('error', (e) => reportError(e.error || { message: e.message, stack: '' }, 'error'))
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason && typeof e.reason === 'object' ? e.reason : { message: String(e.reason), stack: '' }, 'promise'))
  window.addEventListener('online', flushErrors)
  setTimeout(flushErrors, 5000)
}
