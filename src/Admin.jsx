import { useEffect, useState, useCallback } from 'react'
import { plural } from './util'
import { useDesktop, SideNav } from './layout'
import { APP_VERSION, versionCmp, versionLt } from './version'
import { encryptText, decryptText, isEncrypted } from './crypto'

// sensitive actions go in the activity log (best effort)
const logEvent = (action, note) => supabase.rpc('log_event', { p_action: action, p_note: note }).then(() => {}, () => {})
import { supabase } from './supabase'
import { STUDIO as DEF, SV, m, off, today, fd, kfmt, bal, isDate, deliver, ds, chunk, parseCsv, normDate, igHandle, ALL_ST, END } from './lib'
import { fetchAll, importClients, OFFLINE } from './data'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const Bars = ({ rows }) => {
  const mx = Math.max(1, ...rows.map((r) => r.v))
  return rows.length ? rows.map((r) => (
    <div key={r.l}><div className="row"><span>{r.l}</span><b>{r.t ?? r.v}</b></div><div className="bar"><i style={{ width: Math.round(r.v / mx * 100) + '%' }}></i></div></div>
  )) : <div className="sub">No data in this range.</div>
}

/* ---------- 1. OVERVIEW ---------- */
function Overview({ C, A, T }) {
  const [rg, setRg] = useState('12')
  const t = today(), y = t.slice(0, 4)
  const from = rg === 'y' ? y + '-01-01' : rg === '12' ? off(-365) : '0000-00-00'
  const inR = (d) => d && d >= from && d <= '9999'
  const S = C.filter((c) => inR(c.date) && !END.includes(c.status))
  const pays = []; ;[...C, ...A].forEach((c) => c.pay.forEach((x) => { if (isDate(x.d) && inR(x.d)) pays.push(x) }))
  const inc = pays.reduce((s, x) => s + x.amt, 0)
  const avg = S.length ? Math.round(S.reduce((s, c) => s + c.pkg, 0) / S.length) : 0
  const out = C.reduce((s, c) => s + Math.max(0, bal(c)), 0)
  const everyone = [...C, ...A]
  const mo = [...Array(12)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 11 + i); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); return { l: MON[d.getMonth()], v: everyone.reduce((s, c) => s + c.pay.filter((x) => isDate(x.d) && String(x.d).slice(0, 7) === k).reduce((a, x) => a + x.amt, 0), 0) } })
  const mx = Math.max(1, ...mo.map((x) => x.v))
  const busy = MON.map((l, i) => ({ l, v: S.filter((c) => +c.date.slice(5, 7) === i + 1).length }))
  const ev = SV.map((l) => ({ l, v: S.filter((c) => c.eventType === l).length })).filter((x) => x.v).sort((a, b) => b.v - a.v)
  const bmx = Math.max(1, ...busy.map((x) => x.v))
  const wk = T.filter((u) => u.status === 'active').map((u) => ({ l: u.name || u.email, v: S.filter((c) => c.assign.includes(u.id)).length })).sort((a, b) => b.v - a.v)
  const unp = C.filter((c) => bal(c) > 0).sort((a, b) => bal(b) - bal(a)).slice(0, 5)
  return (
    <>
      <div className="pipe">{[['y', 'This year'], ['12', 'Last 12 months'], ['all', 'All time']].map((a) => <button key={a[0]} className={rg === a[0] ? 'on' : ''} onClick={() => setRg(a[0])}>{a[1]}</button>)}</div>
      <div className="stats">
        <div className="stat"><b>{m(inc)}</b><span>Income received</span></div>
        <div className="stat"><b>{S.length}</b><span>Sessions</span></div>
        <div className="stat"><b>{m(avg)}</b><span>Average booking</span></div>
        <div className="stat"><b>{m(out)}</b><span>Outstanding now</span></div>
      </div>
      <div className="mason">
      <div className="card span"><div className="lab">Income, last 12 months</div>
        <div className="chart">{mo.map((x, i) => <div key={i} className={i === 11 ? 'cur' : ''}><b>{x.v ? kfmt(x.v) : ''}</b><i style={{ height: Math.max(3, Math.round(x.v / mx * 80)) }}></i><span>{x.l}</span></div>)}</div></div>
      <div className="card"><div className="lab">Busiest months (sessions)</div>
        <div className="chart">{busy.map((x, i) => <div key={x.l} className={i === new Date().getMonth() ? 'cur' : ''}><b>{x.v || ''}</b><i style={{ height: Math.max(3, Math.round(x.v / bmx * 80)) }}></i><span>{x.l}</span></div>)}</div></div>
      <div className="card"><div className="lab">Sessions by event type</div><Bars rows={ev} /></div>
      <div className="card"><div className="lab">Staff workload (sessions)</div><Bars rows={wk} /></div>
      <div className="card"><div className="lab">Largest unpaid balances</div>
        {unp.map((c) => <div key={c.id} className="row"><span>{c.name} · {fd(c.date)}</span><b>{m(bal(c))}</b></div>)}{!unp.length && <div className="sub">Everything is paid.</div>}</div>
      </div>
    </>
  )
}

/* ---------- 2. ACTIVITY LOG ---------- */
function Activity({ C, T }) {
  const [rows, setRows] = useState([])
  const [n, setN] = useState(50)
  const [ent, setEnt] = useState('')
  const [usr, setUsr] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(true)
  const load = useCallback(async () => {
    setBusy(true)
    let q = supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(n)
    if (ent) q = q.eq('entity', ent)
    if (usr) q = q.eq('user_id', usr)
    const { data, error } = await q
    setBusy(false)
    if (error) setErr(error.message); else { setErr(''); setRows(data) }
  }, [n, ent, usr])
  useEffect(() => { load() }, [load])
  const nm = (id) => (id ? T.find((u) => u.id === id)?.name || 'Unknown' : 'System')
  const cn = (id) => C.find((c) => c.id === id)?.name
  const sum = (r) => {
    const d = r.details || {}
    if (r.entity === 'clients') return (d.name || '') + (d.status ? ' · ' + d.status : '')
    if (r.entity === 'payments') return m(d.amount) + ' · ' + d.method + (cn(d.client_id) ? ' · ' + cn(d.client_id) : '')
    if (r.entity === 'profiles') return (d.name || d.email || '') + ' · ' + d.role + ' · ' + d.status
    if (r.entity === 'packages') return (d.name || '') + ' · ' + m(d.price)
    if (r.entity === 'client_finance') return 'Price ' + m(d.price) + (cn(d.client_id) ? ' · ' + cn(d.client_id) : '')
    if (r.entity === 'system') return (d.note || r.action)
    if (r.entity === 'client_assignments') return (cn(d.client_id) || 'Client') + ' · ' + nm(d.user_id)
    if (r.entity === 'pricing_rules') return 'Extra photo ' + m(d.extra_photo_price) + ' · weekend ' + d.weekend_pct + '% · discount ' + d.discount_pct + '%'
    if (r.entity === 'studio_settings') return 'Landing page or studio details updated'
    return r.entity_id || ''
  }
  const label = { clients: 'Client', client_assignments: 'Assignment', payments: 'Payment', profiles: 'Team member', packages: 'Package', client_finance: 'Pricing', pricing_rules: 'Pricing rules', studio_settings: 'Studio settings', system: 'System' }
  return (
    <>
      <div className="g2">
        <div><label>Type</label><select value={ent} onChange={(e) => { setEnt(e.target.value); setN(50) }}><option value="">Everything</option>{Object.entries(label).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label>Person</label><select value={usr} onChange={(e) => { setUsr(e.target.value); setN(50) }}><option value="">Everyone</option>{T.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}</select></div>
      </div>
      {err && <div className="warn" style={{ marginTop: 10 }}>{err} (Run supabase/admin-update.sql if you have not yet.)</div>}
      <div className="mason" style={{ marginTop: 12 }}>
        {rows.map((r) => (
          <div key={r.id} className="card">
            <div className="head"><div><h3>{label[r.entity] || r.entity}</h3><p>{sum(r)}</p></div><span className="badge">{{ INSERT: 'Added', UPDATE: 'Changed', DELETE: 'Deleted' }[r.action] || r.action}</span></div>
            <div className="sub">{nm(r.user_id)} · {new Date(r.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        {!rows.length && !busy && !err && <div className="empty">No activity recorded yet.</div>}
        {rows.length >= n && <button className="btn" style={{ width: '100%' }} onClick={() => setN(n + 50)}>{busy ? 'Loading…' : 'Load more'}</button>}
      </div>
    </>
  )
}

/* ---------- 3. DATA TOOLS ---------- */
const TEMPLATE = 'Name,Phone,Event,Date,Time,Location,Services,Status,Package,Price,Paid,Photo codes\n"Jane & John Doe","0712345678",Wedding,2026-12-05,10:00,"Karen, Nairobi","Photography, Album",Booked,Classic,45000,10000,"3217 3219"\n'
const BACKUP_TABLES = [['clients', ['id']], ['client_assignments', ['client_id', 'user_id']], ['client_finance', ['client_id']], ['payments', ['id']], ['packages', ['id']], ['pricing_rules', ['id']], ['studio_settings', ['id']], ['audit_log', ['id']]]
const RESTORE_STEPS = [['packages', 'id'], ['pricing_rules', 'id'], ['studio_settings', 'id'], ['clients', 'id'], ['client_assignments', 'client_id,user_id'], ['client_finance', 'client_id'], ['payments', 'id']]

export function DataTools({ C, A, T, isAdmin, say, ask, run, reload, closeSheet }) {
  const [imp, setImp] = useState(null)
  const [rst, setRst] = useState(null)
  const [bpass, setBpass] = useState('')
  const [rpass, setRpass] = useState('')
  const [sel, setSel] = useState([])
  const [q, setQ] = useState('')
  const [act, setAct] = useState('status')
  const [val, setVal] = useState('Shot')
  const [busy, setBusy] = useState(false)

  /* ---- backup: pages through every table, so nothing is cut off at 1,000 rows ---- */
  async function backup() {
    if (!navigator.onLine) { say(OFFLINE); return }
    if (bpass && bpass.length < 10) { say('The passphrase needs at least 10 characters.'); return }
    setBusy(true)
    const out = { app: 'director-kollo', version: 2, exported_at: new Date().toISOString() }
    const counts = [], bad = []
    for (const [t, keys] of BACKUP_TABLES.filter(([t]) => isAdmin || t !== 'audit_log')) { // the activity log is Admin-only
      const r = await fetchAll(() => keys.reduce((qq, k) => qq.order(k), supabase.from(t).select('*')))
      if (r.error) bad.push(t + ': ' + r.error.message)
      out[t] = r.data; counts.push(t + ' ' + r.data.length)
    }
    const p = await fetchAll(() => supabase.from('profiles').select('id,name,email,phone,title,role,status,created_at').order('created_at'))
    if (p.error) bad.push('profiles: ' + p.error.message)
    out.profiles = p.data; counts.push('profiles ' + p.data.length)
    setBusy(false)
    if (bad.length) { say('The backup is INCOMPLETE, so no file was saved. ' + bad.join(' | ') + ' (Run supabase/hardening-update.sql if a table is missing.)'); return }
    const text = JSON.stringify(out, null, 1)
    deliver('DKS_Backup_' + ds() + (bpass ? '_encrypted' : '') + '.json', bpass ? await encryptText(text, bpass) : text, 'application/json')
    logEvent('BACKUP', (bpass ? 'Encrypted' : 'Plain (NOT encrypted)') + ' backup downloaded')
    say('Backup downloaded. Rows saved: ' + counts.join(', ') + '. ' + (bpass ? 'It is encrypted: without your passphrase nobody can open it, including you.' : 'It is NOT encrypted and holds personal data, so keep it somewhere private.') + ' Your Supabase plan\'s own backups are the real safety net.')
  }

  /* ---- restore: merges a backup file back in (adds and overwrites by ID, deletes nothing) ---- */
  function pickBackup(e) {
    const f = e.target.files[0]; if (!f) return
    const r = new FileReader()
    r.onload = () => {
      try {
        const j = JSON.parse(String(r.result))
        if (isEncrypted(j)) { setRpass(''); setRst({ enc: j, name: f.name }); return }
        if (j.app !== 'director-kollo' || !Array.isArray(j.clients)) throw new Error('not a backup')
        setRst({ j, name: f.name })
      } catch { say('That file is not a Director Kollo backup.') }
    }
    r.readAsText(f); e.target.value = ''
  }
  async function unlockBackup() {
    try {
      const j = JSON.parse(await decryptText(rst.enc, rpass))
      if (j.app !== 'director-kollo' || !Array.isArray(j.clients)) throw new Error('This is not a Director Kollo backup.')
      setRpass(''); setRst({ j, name: rst.name })
    } catch (e) { say(e.message) }
  }
  async function runRestore() {
    if (!navigator.onLine) { say(OFFLINE); return }
    setBusy(true)
    const people = new Set(T.map((u) => u.id)), j = rst.j
    let skipped = 0
    const done = []
    for (const [t, key] of RESTORE_STEPS) {
      let rows = j[t] || []
      if (t === 'clients') rows = rows.map((x) => ({ ...x, created_by: people.has(x.created_by) ? x.created_by : null }))
      if (t === 'client_assignments') { const n = rows.length; rows = rows.filter((x) => people.has(x.user_id)); skipped += n - rows.length }
      for (const ch of chunk(rows, 500)) {
        const { error } = await supabase.from(t).upsert(ch, { onConflict: key })
        if (error) { setBusy(false); reload(); say('Restore STOPPED at ' + t + ': ' + error.message + '. Already restored: ' + (done.join(', ') || 'nothing') + '. Fix the problem and restore again (it is safe to repeat).'); return }
      }
      done.push(t + ' ' + rows.length)
    }
    setBusy(false); setRst(null); reload()
    logEvent('RESTORE', 'Backup restored: ' + done.join(', '))
    say('Restore finished. ' + done.join(', ') + (skipped ? '. ' + skipped + ' assignments skipped (that person no longer has an account)' : '') + '.')
  }

  /* ---- CSV import: one database transaction, so it all imports or none of it does ---- */
  function pickFile(e) {
    const f = e.target.files[0]; if (!f) return
    const r = new FileReader()
    r.onload = () => {
      const rows = parseCsv(String(r.result).replace(/^\ufeff/, ''))
      if (rows.length < 2) { say('The file has no data rows.'); return }
      const h = rows[0].map((x) => x.trim().toLowerCase())
      const col = (row, k) => (row[h.indexOf(k)] || '').trim()
      const have = new Set([...C, ...A].map((c) => c.name.toLowerCase() + '|' + c.date))
      const list = [], skip = []
      rows.slice(1).forEach((row, i) => {
        const name = col(row, 'name'), date = normDate(col(row, 'date'))
        if (!name) { skip.push('Row ' + (i + 2) + ': no name'); return }
        if (have.has(name.toLowerCase() + '|' + date)) { skip.push('Row ' + (i + 2) + ': ' + name + ' already exists'); return }
        have.add(name.toLowerCase() + '|' + date)
        list.push({
          name, phone: col(row, 'phone'), event_type: SV.find((s) => s.toLowerCase() === col(row, 'event').toLowerCase()) || 'Other',
          date, time: col(row, 'time').slice(0, 5), loc: col(row, 'location'), services: col(row, 'services'),
          status: ALL_ST.find((s) => s.toLowerCase() === col(row, 'status').toLowerCase()) || 'Booked', pk: col(row, 'package'),
          price: +col(row, 'price') || 0, paid: +col(row, 'paid') || 0, codes: [...new Set(col(row, 'photo codes').split(/[\s,;]+/).filter(Boolean))],
        })
      })
      setImp({ list, skip })
    }
    r.readAsText(f); e.target.value = ''
  }
  async function runImport() {
    setBusy(true)
    const r = await importClients(imp.list)
    setBusy(false)
    if (r.error) { say('Nothing was imported. ' + r.error.message); return }
    setImp(null); reload()
    logEvent('IMPORT', plural(r.data, 'client') + ' imported from CSV')
    say(plural(r.data, 'client') + ' imported.')
  }

  /* ---- bulk actions, sent in chunks of 100 so the request is never too long ---- */
  const shown = C.filter((c) => !q || (c.name + c.phone).toLowerCase().includes(q.toLowerCase()))
  const tog = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])
  async function bulk(make) {
    let n = 0
    for (const ch of chunk(sel, 100)) {
      const { error } = await make(ch)
      if (error) { closeSheet(); reload(); say('Stopped after ' + plural(n, 'client') + ' of ' + sel.length + ': ' + error.message); return }
      n += ch.length
    }
    closeSheet(); setSel([]); reload(); say('Done: ' + plural(n, 'client') + ' updated.')
  }
  const owedNote = (ids) => {
    const t = C.filter((c) => ids.includes(c.id)).reduce((s, c) => s + Math.max(0, bal(c)), 0)
    return t > 0 ? 'Together they still owe ' + m(t) + ', which will stop counting in your outstanding total (it is listed separately under Payments). ' : ''
  }
  function apply() {
    if (!sel.length) { say('Select at least one client first.'); return }
    if (!navigator.onLine) { say(OFFLINE); return }
    if (act === 'status') ask('Set ' + plural(sel.length, 'client') + ' to ' + val + '?', 'Apply', () => bulk((ch) => supabase.from('clients').update({ status: val }).in('id', ch)))
    else if (act === 'assign') {
      if (!val || val === 'Shot') { say('Choose a team member first.'); return }
      ask('Assign ' + (T.find((u) => u.id === val)?.name || 'this person') + ' to ' + plural(sel.length, 'client') + '?', 'Assign',
        () => bulk((ch) => supabase.from('client_assignments').upsert(ch.map((id) => ({ client_id: id, user_id: val })), { onConflict: 'client_id,user_id', ignoreDuplicates: true })))
    } else ask('Archive ' + plural(sel.length, 'client') + '? ' + owedNote(sel) + 'They are hidden from lists but kept in your records. You can restore them below.', 'Archive',
      () => bulk((ch) => supabase.from('clients').update({ archived_at: new Date().toISOString() }).in('id', ch)))
  }

  return (
    <div className="mason">
      <div className="card"><div className="lab">Backup</div>
        <div className="sub">Downloads every table as one JSON file.</div>
        <label>Passphrase to encrypt the file (recommended, at least 10 characters)</label>
        <input type="password" autoComplete="new-password" value={bpass} onChange={(e) => setBpass(e.target.value)} />
        <button className="btn p" disabled={busy} style={{ width: '100%', marginTop: 10 }} onClick={backup}>{busy ? 'Working…' : 'Download full backup'}</button></div>

      {isAdmin && (
      <div className="card"><div className="lab">Restore from a backup file</div>
        <div className="sub">Adds and overwrites clients, payments, packages and settings by ID.</div>
        <label className="btn" style={{ marginTop: 10 }}>Choose backup file<input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={pickBackup} /></label>
        {rst && rst.enc && (<div style={{ marginTop: 12 }}>
          <div className="row"><span>{rst.name}</span><b>Encrypted</b></div>
          <label>Passphrase</label><input type="password" autoComplete="off" value={rpass} onChange={(e) => setRpass(e.target.value)} />
          <div className="act" style={{ marginTop: 10 }}><button className="btn" onClick={() => setRst(null)}>Cancel</button><button className="btn p" disabled={!rpass} onClick={unlockBackup}>Unlock</button></div></div>)}
        {rst && rst.j && (<div style={{ marginTop: 12 }}>
          <div className="row"><span>{rst.name}</span><b>{plural(rst.j.clients.length, 'client')}</b></div>
          <div className="sub">{plural((rst.j.payments || []).length, 'payment')}, {plural((rst.j.packages || []).length, 'package')}. Backup taken {rst.j.exported_at ? new Date(rst.j.exported_at).toLocaleString('en-GB') : 'at an unknown time'}.</div>
          <div className="act" style={{ marginTop: 10 }}><button className="btn" onClick={() => setRst(null)}>Cancel</button>
            <button className="btn d" disabled={busy} onClick={() => ask('Restore this backup into the live database? Rows with the same ID are overwritten.', 'Restore', () => { closeSheet(); runRestore() }, 1)}>{busy ? 'Restoring…' : 'Restore'}</button></div></div>)}</div>)}

      <div className="card"><div className="lab">Import clients from CSV</div>
        <div className="sub">Columns: Name, Phone, Event, Date, Time, Location, Services, Status, Package, Price, Paid, Photo codes. Only Name is required. Dates as 2026-12-05 or 05/12/2026. Clients with the same name and date are skipped.</div>
        <div className="act" style={{ marginTop: 10 }}>
          <button className="btn" onClick={() => deliver('DKS_Import_Template.csv', '\ufeff' + TEMPLATE, 'text/csv')}>Template</button>
          <label className="btn p">Choose CSV<input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={pickFile} /></label></div>
        {imp && (<div style={{ marginTop: 12 }}>
          <div className="row"><span>Ready to import</span><b>{imp.list.length}</b></div>
          {imp.skip.slice(0, 6).map((s, i) => <div key={i} className="warn" style={{ marginTop: 6 }}>{s}</div>)}{imp.skip.length > 6 && <div className="sub">and {imp.skip.length - 6} more skipped</div>}
          <div className="act" style={{ marginTop: 10 }}><button className="btn" onClick={() => setImp(null)}>Cancel</button><button className="btn p" disabled={busy || !imp.list.length} onClick={runImport}>{busy ? 'Importing…' : 'Import ' + imp.list.length}</button></div></div>)}</div>

      <div className="card"><div className="lab">Bulk actions</div>
        <input aria-label="Search clients" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="act" style={{ marginTop: 8 }}>
          <button className="btn" onClick={() => setSel(shown.map((c) => c.id))}>Select shown ({shown.length})</button><button className="btn" onClick={() => setSel([])}>Clear</button></div>
        <div style={{ maxHeight: 260, overflow: 'auto', margin: '10px 0', border: '1px solid var(--line, #d3e3f4)', borderRadius: 10 }}>
          {shown.map((c) => <label key={c.id} className="row" style={{ padding: '8px 10px', alignItems: 'center', cursor: 'pointer' }}><span><input type="checkbox" style={{ width: 'auto', marginRight: 8 }} checked={sel.includes(c.id)} onChange={() => tog(c.id)} />{c.name}</span><b>{c.status}</b></label>)}
        </div>
        <div className="g2">
          <div><label>Action</label><select value={act} onChange={(e) => { setAct(e.target.value); setVal(e.target.value === 'status' ? 'Shot' : '') }}><option value="status">Set status</option><option value="assign">Assign person</option><option value="archive">Archive</option></select></div>
          {act === 'status' && <div><label>Status</label><select value={val} onChange={(e) => setVal(e.target.value)}>{ALL_ST.map((s) => <option key={s}>{s}</option>)}</select></div>}
          {act === 'assign' && <div><label>Person</label><select value={val} onChange={(e) => setVal(e.target.value)}><option value="">Choose…</option>{T.filter((u) => u.status === 'active').map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}</select></div>}
        </div>
        <button className="btn p" style={{ width: '100%', marginTop: 10 }} onClick={apply}>Apply to {plural(sel.length, 'client')}</button></div>

      <div className="card"><div className="lab">Archived clients</div>
        <div className="sub"></div>
        {A.map((c) => (
          <div key={c.id} className="row" style={{ alignItems: 'center', marginTop: 8 }}><span>{c.name} · {fd(c.date)}</span>
            <span><button className="chip" onClick={() => run(() => supabase.from('clients').update({ archived_at: null }).eq('id', c.id), [c.id])}>Restore</button>{' '}
              {isAdmin && <button className="chip" onClick={() => ask('Delete ' + c.name + ' for good, including ' + plural(c.pay.length, 'payment') + ' and their activity-log entries? This cannot be undone.', 'Delete forever', async () => { closeSheet(); await run(() => supabase.rpc('purge_client', { p_id: c.id }), [c.id]) }, 1)}>Delete forever</button>}</span></div>
        ))}{!A.length && <div className="sub" style={{ marginTop: 8 }}>No archived clients.</div>}</div>
    </div>
  )
}

/* ---------- 4. STUDIO SETTINGS ---------- */
function shrink(file, max) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = reject
    r.onload = () => {
      const im = new Image()
      im.onerror = reject
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height)), cv = document.createElement('canvas')
        cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k)
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height)
        cv.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read the image'))), 'image/jpeg', 0.82)
      }
      im.src = r.result
    }
    r.readAsDataURL(file)
  })
}

function StudioSettings({ S, reload, say }) {
  const D = { ...DEF, ...S, contact: { ...DEF.contact, ...(S.contact || {}) } }
  const [up, setUp] = useState(false)
  const [f, setF] = useState({
    name: D.name, kicker: D.kicker, headline: D.headline, sub: D.sub, about: D.about, currency: S.currency ?? 'KSh ',
    staffScope: S.staffScope || 'assigned', minVersion: S.minVersion || '', requireMfa: !!S.requireMfa, limShot: String(S.stageLimits?.Shot ?? 3), limSel: String(S.stageLimits?.Selecting ?? 7), limEdit: String(S.stageLimits?.Editing ?? 14), ...D.contact,
    services: D.services.map((x) => x.join(' | ')).join('\n'), steps: D.steps.map((x) => x.join(' | ')).join('\n'),
  })
  const gal = Array.isArray(S.gallery) ? S.gallery : []
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const lines = (t, n) => t.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((a) => a[0] && a.length >= n).map((a) => a.slice(0, n === 3 ? 3 : 2))
  const put = (data) => supabase.from('studio_settings').upsert({ id: 1, data, updated_at: new Date().toISOString() })

  async function save() {
    if (!navigator.onLine) { say(OFFLINE); return }
    const lim = {}
    for (const [k, key] of [['Shot', 'limShot'], ['Selecting', 'limSel'], ['Editing', 'limEdit']]) {
      const n = parseInt(f[key], 10)
      if (!(n >= 1 && n <= 365)) { say('Stage limits must be whole days between 1 and 365.'); return }
      lim[k] = n
    }
    const mv = f.minVersion.trim()
    if (mv && !/^\d+\.\d+\.\d+$/.test(mv)) { say('The minimum version must look like 2.2.0.'); return }
    if (mv && versionCmp(mv, APP_VERSION) > 0) { say('You are running version ' + APP_VERSION + '. You cannot require a newer version than the one you are running, or the whole team could be locked out.'); return }
    const ig = f.instagram.trim()
    if (ig && !igHandle(ig)) { say('Instagram must be a handle such as @yourstudio (letters, numbers, dots and underscores), not the studio name or a sentence.'); return }
    const data = {
      ...S, name: f.name.trim(), kicker: f.kicker.trim(), headline: f.headline.trim(), sub: f.sub.trim(), about: f.about.trim(),
      currency: f.currency, staffScope: f.staffScope, minVersion: f.minVersion.trim(), requireMfa: f.requireMfa, stageLimits: lim,
      contact: { phone: f.phone.trim(), email: f.email.trim(), location: f.location.trim(), hours: f.hours.trim(), instagram: ig ? '@' + igHandle(ig) : '' },
      services: lines(f.services, 3), steps: lines(f.steps, 2),
    }
    const { error } = await put(data)
    if (error) say(error.message + ' (Run supabase/admin-update.sql first.)'); else { reload(); say('Saved. The landing page, currency and staff access are updated.') }
  }
  async function addPhotos(e) {
    const files = [...e.target.files]; e.target.value = ''
    if (!files.length) return
    if (!navigator.onLine) { say(OFFLINE); return }
    if (gal.length + files.length > 12) { say('The landing page holds up to 12 photos. Remove some first.'); return }
    setUp(true)
    const list = [...gal]
    try {
      for (const file of files) {
        const path = 'gallery/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg'
        const { error } = await supabase.storage.from('studio').upload(path, await shrink(file, 1400), { contentType: 'image/jpeg', cacheControl: '31536000' })
        if (error) { say(error.message + ' (Run supabase/hardening-update.sql first.)'); break }
        list.push({ path, url: supabase.storage.from('studio').getPublicUrl(path).data.publicUrl })
      }
      const { error } = await put({ ...S, gallery: list })
      if (error) say(error.message); else reload()
    } catch (err) { say('Could not process that photo: ' + err.message) }
    setUp(false)
  }
  async function removePhoto(g) {
    const r1 = await supabase.storage.from('studio').remove([g.path])
    if (r1.error) { say(r1.error.message); return }
    const { error } = await put({ ...S, gallery: gal.filter((x) => x.path !== g.path) })
    if (error) say(error.message); else reload()
  }

  return (
    <>
      <div className="mason">
      <div className="card"><div className="lab">Landing page photos</div>
        <div className="sub">Until you add your own photos, the landing page shows simple sample tiles. Upload up to 12 of your best photos (they are resized automatically).</div>
        <div className="lggal" style={{ marginTop: 10 }}>{gal.map((g) => <div key={g.path} style={{ position: 'relative' }}><img src={g.url} alt="Landing page photo" loading="lazy" /><button className="chip" style={{ position: 'absolute', right: 4, top: 4 }} onClick={() => removePhoto(g)}>Remove</button></div>)}</div>
        <label className="btn p" style={{ marginTop: 10 }}>{up ? 'Uploading…' : 'Add photos'}<input type="file" accept="image/*" multiple disabled={up} style={{ display: 'none' }} onChange={addPhotos} /></label></div>
      <div className="card"><div className="lab">Landing page</div>
        <label>Studio name</label><input value={f.name} onChange={set('name')} />
        <label>Small heading</label><input value={f.kicker} onChange={set('kicker')} />
        <label>Headline</label><input value={f.headline} onChange={set('headline')} />
        <label>Short description</label><textarea rows={3} value={f.sub} onChange={set('sub')} />
        <label>About</label><textarea rows={3} value={f.about} onChange={set('about')} />
        <label>What we photograph (one per line: emoji | name | description)</label><textarea rows={6} value={f.services} onChange={set('services')} />
        <label>How it works (one per line: title | description)</label><textarea rows={5} value={f.steps} onChange={set('steps')} /></div>
      <div className="card"><div className="lab">Contact details (leave blank to hide)</div>
        <label>Phone</label><input value={f.phone} onChange={set('phone')} />
        <label>Email</label><input value={f.email} onChange={set('email')} />
        <label>Location</label><input value={f.location} onChange={set('location')} />
        <label>Opening hours</label><input value={f.hours} onChange={set('hours')} />
        <label>Instagram handle</label><input value={f.instagram} onChange={set('instagram')} placeholder="@yourstudio" /></div>
      <div className="card"><div className="lab">Staff access</div>
        <label>What staff can see</label>
        <select value={f.staffScope} onChange={set('staffScope')}><option value="assigned">Only clients assigned to them (or that they added)</option><option value="all">All clients</option></select>
        <div className="sub" style={{ marginTop: 6 }}>Client phone numbers are personal data. "Only assigned" is the safer choice. Staff never see payments or prices either way.</div></div>
      <div className="card"><div className="lab">Stuck-stage limits (days)</div>
        <div className="sub">A client who stays in a stage longer than this is flagged as Behind schedule.</div>
        <div className="g2">
          <div><label>Shot</label><input type="number" min="1" max="365" value={f.limShot} onChange={set('limShot')} /></div>
          <div><label>Selecting</label><input type="number" min="1" max="365" value={f.limSel} onChange={set('limSel')} /></div>
        </div>
        <label>Editing</label><input type="number" min="1" max="365" value={f.limEdit} onChange={set('limEdit')} /></div>
      <div className="card"><div className="lab">Two-step sign-in</div>
        <label className="row" style={{ cursor: 'pointer', alignItems: 'center' }}><span>Require it for Admin and Director</span><input type="checkbox" style={{ width: 'auto' }} checked={f.requireMfa} onChange={(e) => setF({ ...f, requireMfa: e.target.checked })} /></label>
        <div className="sub" style={{ marginTop: 6 }}>Turn this on only after the Admin and Director have set up their authenticator app (Settings, then Account). Anyone not set up will be asked to do it at their next sign-in, and role changes and permanent deletes need it.</div></div>
      <div className="card"><div className="lab">Required app version</div>
        <label>Minimum version (leave blank for no lock)</label>
        <input value={f.minVersion} onChange={set('minVersion')} placeholder={APP_VERSION} />
        <div className="sub" style={{ marginTop: 6 }}>Staff and Directors on an older version are blocked with "Update required" while online. You are running {APP_VERSION}, and you are never blocked yourself. Only set a version that is already deployed.</div></div>
      <div className="card"><div className="lab">Currency</div><label>Currency symbol (used on every device)</label><input maxLength={6} value={f.currency} onChange={set('currency')} /></div>
      </div>
      <button className="btn p" style={{ width: '100%', marginTop: 4 }} onClick={save}>Save studio settings</button>
    </>
  )
}

/* ---------- ADMIN TAB ---------- */
/* ---------- DEVICES: which phones are connected, which are behind ---------- */
const ago = (iso) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 2) return 'just now'
  if (mins < 120) return mins + ' minutes ago'
  const h = Math.round(mins / 60)
  return h < 48 ? h + ' hours ago' : Math.round(h / 24) + ' days ago'
}

function Devices({ T, run }) {
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('device_status').select('*').order('last_seen', { ascending: false })
    if (error) setErr(error.message); else { setErr(''); setRows(data) }
  }, [])
  useEffect(() => { load() }, [load])
  const who = (id) => T.find((u) => u.id === id)?.name || 'Unknown'
  const level = (r) => { const h = (Date.now() - new Date(r.last_seen).getTime()) / 36e5; return h >= 72 ? 'bad' : h >= 24 ? 'stale' : 'ok' }
  const behind = rows.filter((r) => level(r) !== 'ok').length
  return (
    <>
      <div className="sub" style={{ marginBottom: 10 }}>Each phone reports in whenever it is online. A phone shows what it last reported. One that has been offline since it made changes cannot say so, so treat a phone that has not been seen for days as possibly holding unsent changes.</div>
      {err && <div className="warn" style={{ marginBottom: 10 }}>{err} (Run supabase/money-devices-update.sql if you have not yet.)</div>}
      {!err && <div className="stats"><div className="stat"><b>{rows.length}</b><span>Phones and computers</span></div><div className="stat"><b style={{ color: behind ? '#c62f3d' : undefined }}>{behind}</b><span>Not seen for over a day</span></div></div>}
      <div className="mason" style={{ marginTop: 12 }}>
        {rows.map((r) => {
          const lv = level(r)
          return (
            <div key={r.user_id + r.device_id} className="card">
              <div className="head"><div><h3>{who(r.user_id)}</h3><p>{r.name || 'Device'}</p></div>
                <span className={'sb ' + (lv === 'ok' ? 'Delivered' : lv === 'stale' ? 'Unassigned' : 'Overdue')}>{lv === 'ok' ? 'Connected' : lv === 'stale' ? 'Quiet' : 'Behind'}</span></div>
              <div className="row"><span>Last seen</span><b>{ago(r.last_seen)}</b></div>
              <div className="row"><span>Changes waiting</span><b>{r.waiting}{r.waiting > 0 && r.oldest_at ? ' (oldest ' + ago(r.oldest_at) + ')' : ''}</b></div>
              <div className="row"><span>App version</span><b>{r.version || 'unknown'}{versionLt(r.version || '0', APP_VERSION) ? ' (older)' : ''}</b></div>
              <div className="act" style={{ marginTop: 8 }}><button className="chip" onClick={() => run(() => supabase.from('device_status').delete().eq('user_id', r.user_id).eq('device_id', r.device_id)).then(load)}>Forget this device</button></div>
            </div>
          )
        })}
      </div>
      {!rows.length && !err && <div className="empty">No devices have reported in yet. They appear once people open the updated app.</div>}
    </>
  )
}

export function Admin({ C, A, T, S, say, ask, run, reload, closeSheet }) {
  const [sec, setSec] = useState('ov')
  const desk = useDesktop()
  const items = [['ov', 'Overview'], ['log', 'Activity'], ['data', 'Data tools'], ['dev', 'Devices'], ['st', 'Studio']]
  const body = (
    <>
      {sec === 'ov' && <Overview C={C} A={A} T={T} />}
      {sec === 'log' && <Activity C={C} T={T} />}
      {sec === 'dev' && <Devices T={T} run={run} />}
      {sec === 'data' && <DataTools C={C} A={A} T={T} isAdmin say={say} ask={ask} run={run} reload={reload} closeSheet={closeSheet} />}
      {sec === 'st' && <StudioSettings S={S} reload={reload} say={say} />}
    </>
  )
  if (desk) return <div className="shell2"><SideNav items={items} value={sec} onChange={setSec} label="Admin sections" /><div className="spane">{body}</div></div>
  return (
    <>
      <div className="pipe">{items.map((a) => <button key={a[0]} className={sec === a[0] ? 'on' : ''} onClick={() => setSec(a[0])}>{a[1]}</button>)}</div>
      {body}
    </>
  )
}
