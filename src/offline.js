import { supabase } from './supabase'
import { isNetErr } from './pending'
import { APP_VERSION } from './version'

/* ---- tiny IndexedDB key/value store: the saved copy of your clients and the queue of unsent changes live here ---- */
const DB = 'dk-offline', STORE = 'kv'
const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => r.result.createObjectStore(STORE)
  r.onsuccess = () => res(r.result)
  r.onerror = () => rej(r.error)
})
async function tx(mode, fn) {
  try {
    const db = await open()
    return await new Promise((res, rej) => {
      const t = db.transaction(STORE, mode)
      const r = fn(t.objectStore(STORE))
      t.oncomplete = () => { db.close(); res(r && r.result) }
      t.onerror = () => rej(t.error)
    })
  } catch { return null }
}
export const kvGet = (k) => tx('readonly', (s) => s.get(k))
export const kvSet = (k, v) => tx('readwrite', (s) => s.put(v, k))
export const kvDel = (k) => tx('readwrite', (s) => s.delete(k))

export const loadQueue = async (uid) => (await kvGet('queue:' + uid)) || []
export const saveQueue = (uid, q) => kvSet('queue:' + uid, q)
export const loadCache = (uid) => kvGet('cache:' + uid)
export const saveCache = (uid, d) => kvSet('cache:' + uid, d)
export const clearOffline = async (uid) => { await kvDel('queue:' + uid); await kvDel('cache:' + uid) }

/* ---- who was signed in last, so the app can still open with no signal after the login token expired ---- */
export const readLast = () => { try { return JSON.parse(localStorage.getItem('dk_last')) } catch { return null } }
export const writeLast = (uid, profile) => { try { localStorage.setItem('dk_last', JSON.stringify({ uid, profile })) } catch { /* storage blocked */ } }
export const clearLast = () => { try { localStorage.removeItem('dk_last') } catch { /* storage blocked */ } }

/* ---- send ONE queued change to the server ---- */
export async function runOp(op) {
  let r
  if (op.k === 'save') r = await supabase.rpc('save_client', { p_id: op.id, p: op.p, p_assign: op.assign, p_fin: op.fin, p_pay: op.pay, p_base: op.base })
  else if (op.k === 'patch') r = await supabase.rpc('patch_client', { p_id: op.id, p: op.p, p_base: op.base })
  else r = await supabase.from('payments').insert({ id: op.payId, client_id: op.id, amount: op.local.amt, method: op.local.m, paid_on: op.local.d, note: op.local.note || null })
  if (r.error) {
    if (op.k === 'pay' && r.error.code === '23505') return { ok: true } // already saved by an earlier attempt
    return isNetErr(r.error.message) ? { net: true } : { error: r.error.message }
  }
  const d = r.data || {}
  return { ok: true, conflict: !!d.conflict, updated_at: d.updated_at || null }
}

/* ---- tell the Admin which phones are connected and which are behind ---- */
const deviceId = () => {
  try { let d = localStorage.getItem('dk_device'); if (!d) { d = crypto.randomUUID(); localStorage.setItem('dk_device', d) } return d } catch { return 'unknown' }
}
export const deviceName = () => {
  const ua = navigator.userAgent
  const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Device'
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  return os + ' ' + br
}
export const reportDevice = (waiting, oldestMs) =>
  supabase.rpc('report_device', { p_device: deviceId(), p_name: deviceName(), p_waiting: waiting, p_oldest: oldestMs ? new Date(oldestMs).toISOString() : null, p_version: APP_VERSION })
    .then(() => {}, () => {}) // best effort: never bother the person if this fails
