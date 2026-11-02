import { supabase } from './supabase'
import { sortClients } from './pending'

export const OFFLINE = 'This needs an internet connection and was NOT saved. (Adding and editing clients, status changes, photo codes, gallery links and payments DO work offline.)'
const one = (v) => (Array.isArray(v) ? v[0] : v) || null
const SEL = '*, client_assignments(user_id), client_finance(*), payments(*)'

// Supabase returns at most 1,000 rows per request. This pages through with .range() until everything is read.
export async function fetchAll(make, size = 1000) {
  const out = []
  for (let from = 0; ; from += size) {
    const { data, error } = await make().range(from, from + size - 1)
    if (error) return { data: out, error }
    out.push(...data)
    if (data.length < size) return { data: out, error: null }
  }
}

export const mapClient = (x) => {
  const f = one(x.client_finance)
  const pay = (x.payments || []).map((p) => ({ id: p.id, d: p.paid_on, amt: +p.amount, m: p.method, note: p.note || '' })).sort((a, b) => (a.d < b.d ? -1 : 1))
  return {
    id: x.id, name: x.name, phone: x.phone || '', eventType: x.event_type || 'Other', date: x.session_date || '',
    time: (x.session_time || '').slice(0, 5), hrs: +x.duration_hrs || 2, loc: x.location || '', services: x.services || '',
    status: x.status, codes: x.photo_codes || [], gallery: x.gallery_url || '', archived: !!x.archived_at, ver: x.updated_at || null, deliverBy: x.deliver_by || '', statusAt: x.status_changed_at || '',
    assign: (x.client_assignments || []).map((a) => a.user_id),
    pk: f?.package_name || '', pkg: +f?.price || 0, payBy: f?.pay_by || '', pay, paid: pay.reduce((s, p) => s + p.amt, 0),
  }
}
export { sortClients }

const mapMeta = (t, p, r, s) => ({
  T: t.data || [],
  P: (p.data || []).map((x) => ({ id: x.id, name: x.name, price: +x.price, photos: x.photos, inc: x.includes || '' })),
  R: r.data ? { extra: +r.data.extra_photo_price, weekend: +r.data.weekend_pct, disc: +r.data.discount_pct } : { extra: 500, weekend: 15, disc: 0 },
  S: s.data?.data || {},
})
const metaQueries = () => [
  supabase.from('profiles').select('*').order('created_at'),
  supabase.from('packages').select('*').order('price'),
  supabase.from('pricing_rules').select('*').eq('id', 1).maybeSingle(),
  supabase.from('studio_settings').select('data').eq('id', 1).maybeSingle(),
]

export async function loadMeta() {
  const [t, p, r, s] = await Promise.all(metaQueries())
  return mapMeta(t, p, r, s)
}

export async function loadAll() {
  const [c, t, p, r, s] = await Promise.all([
    fetchAll(() => supabase.from('clients').select(SEL).order('session_date', { ascending: false }).order('id')),
    ...metaQueries(),
  ])
  const err = c.error || t.error || p.error
  const all = c.data.map(mapClient)
  return { err: err ? err.message : '', C: all.filter((x) => !x.archived), A: all.filter((x) => x.archived), ...mapMeta(t, p, r, s) }
}

// Re-read just the clients that changed (used by live sync) instead of the whole database.
export async function fetchClients(ids) {
  const { data, error } = await supabase.from('clients').select(SEL).in('id', ids)
  return { rows: (data || []).map(mapClient), error }
}
export function mergeClients(d, ids, rows) {
  const gone = new Set(ids)
  const C = d.C.filter((x) => !gone.has(x.id)), A = d.A.filter((x) => !gone.has(x.id))
  rows.forEach((r) => (r.archived ? A : C).push(r))
  return { ...d, C: sortClients(C), A: sortClients(A) }
}

export async function importClients(rows) {
  if (!navigator.onLine) return { error: { message: OFFLINE } }
  return supabase.rpc('import_clients', { rows })
}

export const patchClient = (id, p) => supabase.from('clients').update(p).eq('id', id)
export const archiveClient = (id) => patchClient(id, { archived_at: new Date().toISOString() })
export const restoreClient = (id) => patchClient(id, { archived_at: null })
export const savePackage = (p) => {
  const row = { name: p.name, price: p.price, photos: p.photos, includes: p.inc }
  return p.id ? supabase.from('packages').update(row).eq('id', p.id) : supabase.from('packages').insert(row)
}
export const deletePackage = (id) => supabase.from('packages').delete().eq('id', id)
export const saveRules = (r) => supabase.from('pricing_rules').upsert({ id: 1, extra_photo_price: r.extra, weekend_pct: r.weekend, discount_pct: r.disc })
