import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import { loadAll, loadMeta, fetchClients, mergeClients, archiveClient, OFFLINE } from './data'
import { runOp, loadQueue, saveQueue, loadCache, saveCache, clearOffline, readLast, writeLast, clearLast, reportDevice } from './offline'
import { isNetErr, applyOp, pendingRow, applyAllPending, sortClients } from './pending'
import { Brand, Landing, NewPassword } from './ui'
import { Loader } from './Loader'
import { Admin } from './Admin'
import { Sheet } from './Sheet'
import { installA11y } from './a11y'
import { ST, getCur, setCur, END, bal, m, setLimits } from './lib'
import { dl, plural } from './util'
import { ClientForm, PayForm, PkForm, Detail } from './forms'
import { Home, List, Cal, Money, Report, Hub } from './views'
import { SettingsPg } from './settings'
import { ErrorBoundary } from './ErrorBoundary'
import { reportError } from './errors'
import { MfaChallenge, MfaRequired } from './mfa'
import { useDesktop } from './layout'
import { ClientsDesk, HomeDesk } from './desk'
import { useUpdate, applyUpdate } from './updater'
import { UpdateRequired, WhatsNew } from './appinfo'
import { APP_VERSION, versionLt } from './version'
import { newerEntries } from './changelog'

const applyMeta = (r) => {
  if (r.S && r.S.currency != null && r.S.currency !== getCur()) setCur(r.S.currency)
  if (r.S) setLimits(r.S.stageLimits)
}
// Where the person was, kept for this browser tab so a refresh returns to the same page (not the dashboard)
const TABS = ['h', 'c', 's', 'm', 'r', 'g', 'a', 'x']
function readNav(owner, isAdmin) {
  let n = {}
  try { n = JSON.parse(sessionStorage.getItem('dk_nav') || '{}') || {} } catch { n = {} }
  let tab = TABS.includes(n.tab) ? n.tab : 'h'
  if ((!owner && (tab === 'm' || tab === 'r')) || (!isAdmin && tab === 'a')) tab = 'h'
  return {
    tab,
    det: typeof n.det === 'string' ? n.det : null,
    sg: ['ac', 'tm', 'pk', 'dt', 'ap'].includes(n.sg) ? n.sg : 'ac',
    flt: typeof n.flt === 'string' ? n.flt : 'All',
    sd: /^\d{4}-\d{2}-\d{2}$/.test(n.sd || '') ? n.sd : null,
    cm: /^\d{4}-\d{2}$/.test(n.cm || '') ? new Date(n.cm + '-01T00:00') : new Date(),
  }
}
const TABLES_CLIENT = ['client_assignments', 'client_finance', 'payments']
const NOCOPY = 'This phone has no saved copy yet. Connect to the internet once to download your clients.'
const OPNAME = { save: 'Client details', patch: 'Status or gallery link', pay: 'Payment' }
const conflictMsg = (name) => 'Saved. Heads up: ' + name + ' was also changed by someone else while you were working. Your version replaced theirs.'

// Server rows + this phone's not-yet-sent changes laid on top
const mergeRows = (d, ids, rows, ops) =>
  mergeClients(d, ids, ids.map((id) => pendingRow(rows.find((r) => r.id === id) || null, id, ops)).filter(Boolean))

// Confirmation dialog. When `word` is given, the person must type it to enable the button (used for permanent deletes).
function AskBody({ sheet, closeSheet }) {
  const [typed, setTyped] = useState('')
  const ok = !sheet.word || typed.trim().toLowerCase() === sheet.word.trim().toLowerCase()
  return (
    <>
      <h2>Please confirm</h2><p style={{ lineHeight: 1.55, marginTop: 8 }}>{sheet.text}</p>
      {sheet.word && (<><label>Type “{sheet.word}” to confirm</label><input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></>)}
      <div className="act" style={{ marginTop: 18 }}><button className="btn" onClick={closeSheet}>Cancel</button>
        <button className={'btn ' + (sheet.danger ? 'd' : 'p')} disabled={!ok} onClick={sheet.fn}>{sheet.label}</button></div>
    </>
  )
}

function SyncBody({ ops, onRetry, onDiscard, closeSheet }) {
  return (
    <>
      <h2>Changes that could not be saved</h2>
      <p className="sub" style={{ marginTop: 6 }}>These were made on this phone. Retry, or discard them.</p>
      {ops.map((o) => (
        <div key={o.opid} className="card" style={{ marginTop: 10 }}>
          <div className="row"><b>{o.name || 'Client'}</b><span className="sub">{OPNAME[o.k]}</span></div>
          <div className="warn" style={{ marginTop: 6 }}>{o.err}</div>
          <div className="act" style={{ marginTop: 8 }}><button className="btn" onClick={() => onDiscard(o)}>Discard</button><button className="btn p" onClick={() => onRetry(o)}>Retry</button></div>
        </div>
      ))}
      {!ops.length && <p className="sub" style={{ marginTop: 10 }}>Nothing to review.</p>}
      <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={closeSheet}>Close</button>
    </>
  )
}

function AdminPg({ X }) {
  return <Admin C={X.CC} A={X.AA} T={X.T} S={X.D.S} say={X.say} ask={X.ask} run={X.run} reload={X.reload} closeSheet={X.closeSheet} />
}

function Studio({ session, profile, reloadProfile }) {
  const owner = profile.role === 'admin' || profile.role === 'director'
  const isAdmin = profile.role === 'admin'
  const myid = session.user.id
  const [D, setD] = useState({ C: [], A: [], T: [], P: [], R: { extra: 500, weekend: 15, disc: 0 }, S: {}, err: '', loaded: false })
  const [nav0] = useState(() => readNav(owner, isAdmin))
  const [tab, setTab] = useState(nav0.tab)
  const [det, setDet] = useState(nav0.det)
  const [q, setQ] = useState('')
  const [flt, setFlt] = useState(nav0.flt)
  const [cm, setCm] = useState(nav0.cm)
  const [sd, setSd] = useState(nav0.sd)
  const [sg, setSg] = useState(nav0.sg)
  const [sheet, setSheet] = useState(null)
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('theme') || 'light' } catch { return 'light' } })
  const [inst, setInst] = useState(null)
  const [online, setOnline] = useState(navigator.onLine)
  const desk = useDesktop()
  const upd = useUpdate()
  const [mfaOn, setMfaOn] = useState(null)
  const [errCount, setErrCount] = useState(0)
  const [queue, setQueueState] = useState([])
  const [needSignIn, setNeedSignIn] = useState(false)
  const pend = useRef({ ids: new Set(), meta: false, full: false })
  const timer = useRef(null)
  const qref = useRef([])
  const chain = useRef(Promise.resolve())

  /* ---------- the queue of changes made on this phone that the server does not have yet ---------- */
  const setQueue = useCallback((list) => { qref.current = list; setQueueState(list); saveQueue(myid, list) }, [myid])

  const reload = useCallback(async () => {
    const keep = (d) => (d.loaded ? d : { ...d, loaded: true, err: NOCOPY })
    if (!navigator.onLine) { setD(keep); return }
    const r = await loadAll()
    if (r.err && isNetErr(r.err)) { setD(keep); return }
    applyMeta(r)
    setD({ ...r, C: applyAllPending(r.C, qref.current), loaded: true })
  }, [])

  // Sends every waiting change, in order. One at a time, so nothing is applied out of order.
  const doFlush = useCallback(async () => {
    const results = {}, conflicts = []
    if (!navigator.onLine || !qref.current.some((o) => !o.failed)) return { results, conflicts }
    const { data: sd2 } = await supabase.auth.getSession()
    if (!sd2.session) { setNeedSignIn(true); return { results, conflicts } }
    setNeedSignIn(false)
    let list = [...qref.current]
    const okIds = new Set()
    for (const op of [...list]) {
      if (op.failed) continue
      const r = await runOp(op)
      if (r.net) { results[op.opid] = { net: true }; break }
      if (r.error) { op.failed = true; op.err = r.error; results[op.opid] = { error: r.error }; reportError({ message: 'Sync failed: ' + r.error, stack: '' }, 'sync'); continue }
      results[op.opid] = { ok: true, conflict: r.conflict }
      list = list.filter((x) => x.opid !== op.opid)
      okIds.add(op.id)
      if (r.updated_at) list.forEach((x) => { if (x.id === op.id && x.k !== 'pay') x.base = r.updated_at })
      if (r.conflict) conflicts.push(op.name)
    }
    setQueue(list)
    if (okIds.size) {
      const ids = [...okIds]
      const { rows } = await fetchClients(ids)
      setD((d) => mergeRows(d, ids, rows, qref.current))
    }
    return { results, conflicts }
  }, [setQueue])
  const flush = useCallback(() => { const p = chain.current.then(doFlush); chain.current = p.catch(() => {}); return p }, [doFlush])
  const syncNow = useCallback(async () => {
    const { conflicts } = await flush()
    if (conflicts.length) setSheet({ t: 'say', text: 'Your offline changes were sent. Heads up: ' + conflicts.join(', ') + ' ' + (conflicts.length > 1 ? 'were' : 'was') + ' also changed by someone else meanwhile. Your version replaced theirs.' })
  }, [flush])

  // Save a change: show it at once, keep it on the phone, and send it now if there is a connection.
  const submit = async (op) => {
    op.opid = crypto.randomUUID()
    op.at = Date.now()
    setD((d) => { const row = applyOp(d.C.find((c) => c.id === op.id) || null, op); return { ...d, C: sortClients([...d.C.filter((c) => c.id !== op.id), row]) } })
    setQueue([...qref.current, op])
    if (!navigator.onLine) return { queued: true }
    const { results } = await flush()
    const res = results[op.opid]
    if (!res || res.net) return { queued: true }
    if (res.error) {
      setQueue(qref.current.filter((x) => x.opid !== op.opid))
      if (op.isNew) setD((d) => ({ ...d, C: d.C.filter((c) => c.id !== op.id) })); else await refreshClients([op.id])
      return { error: res.error }
    }
    return { done: true, conflict: !!res.conflict }
  }
  const refreshClients = async (ids) => { const { rows } = await fetchClients(ids); setD((d) => mergeRows(d, ids, rows, qref.current)) }

  // Live sync: only the clients that changed are re-read, not the whole database.
  const flushLive = useCallback(async () => {
    const p = pend.current
    pend.current = { ids: new Set(), meta: false, full: false }
    if (p.full || p.ids.size > 30) { await reload(); return }
    if (p.ids.size) {
      const ids = [...p.ids]
      const { rows, error } = await fetchClients(ids)
      if (error) { await reload(); return }
      setD((d) => mergeRows(d, ids, rows, qref.current))
    }
    if (p.meta) { const meta = await loadMeta(); applyMeta(meta); setD((d) => ({ ...d, ...meta })) }
  }, [reload])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [cache, list] = await Promise.all([loadCache(myid), loadQueue(myid)])
      if (!alive) return
      list.forEach((o) => { if (!o.at) o.at = Date.now() })
      qref.current = list; setQueueState(list)
      if (cache) { applyMeta(cache); setD({ ...cache, err: '', loaded: true }) }
      if (navigator.onLine) { await syncNow(); await reload() } else setD((d) => (d.loaded ? d : { ...d, loaded: true, err: NOCOPY }))
    })()
    const on = (table) => (payload) => {
      const row = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) || {}
      const p = pend.current
      if (table === 'clients') { if (row.id) p.ids.add(row.id); else p.full = true }
      else if (TABLES_CLIENT.includes(table)) { if (row.client_id) p.ids.add(row.client_id); else p.full = true }
      else p.meta = true
      clearTimeout(timer.current)
      timer.current = setTimeout(flushLive, 300)
    }
    const ch = supabase.channel('studio-live')
    ;['clients', ...TABLES_CLIENT, 'profiles', 'packages', 'pricing_rules', 'studio_settings'].forEach((t) =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, on(t)))
    ch.subscribe()
    return () => { alive = false; clearTimeout(timer.current); supabase.removeChannel(ch) }
  }, [myid, reload, flushLive, syncNow])

  // remember the current page, and make the browser's own history entry match it
  useEffect(() => {
    try {
      sessionStorage.setItem('dk_nav', JSON.stringify({ tab, det, sg, flt, sd, cm: cm.getFullYear() + '-' + String(cm.getMonth() + 1).padStart(2, '0') }))
    } catch { /* storage blocked */ }
  }, [tab, det, sg, flt, sd, cm])
  useEffect(() => { try { history.replaceState({ t: tab, d: det }, '') } catch { /* ignore */ } }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // keep a saved copy of everything on this phone, so the lists open with no signal
  useEffect(() => {
    if (!D.loaded || (D.err && !D.C.length)) return undefined
    const t = setTimeout(() => saveCache(myid, { C: D.C, A: D.A, T: D.T, P: D.P, R: D.R, S: D.S }), 800)
    return () => clearTimeout(t)
  }, [D, myid])

  // back online: send what is waiting, then catch up on what everyone else did
  useEffect(() => {
    const up = () => { setOnline(true); syncNow().then(reload) }
    const down = () => setOnline(false)
    addEventListener('online', up); addEventListener('offline', down)
    return () => { removeEventListener('online', up); removeEventListener('offline', down) }
  }, [syncNow, reload])
  const waitingCount = queue.filter((o) => !o.failed).length
  const oldestAt = queue.filter((o) => !o.failed).reduce((mn, o) => Math.min(mn, o.at || mn), Infinity)
  const ageDays = waitingCount && Number.isFinite(oldestAt) ? Math.floor((Date.now() - oldestAt) / 864e5) : 0
  // tell the Admin this phone is alive and how many changes it is holding
  useEffect(() => {
    if (!D.loaded) return undefined
    const send = () => { if (navigator.onLine) reportDevice(waitingCount, Number.isFinite(oldestAt) ? oldestAt : null) }
    send()
    const t = setInterval(send, 5 * 60 * 1000)
    addEventListener('online', send)
    return () => { clearInterval(t); removeEventListener('online', send) }
  }, [D.loaded, waitingCount, oldestAt])
  useEffect(() => {
    if (!waitingCount) return undefined
    const t = setInterval(() => { if (navigator.onLine) syncNow() }, 30000)
    return () => clearInterval(t)
  }, [waitingCount, syncNow])

  useEffect(() => {
    const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    try { localStorage.setItem('theme', theme) } catch { /* storage blocked */ }
  }, [theme])
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setInst(e) }
    const pop = (e) => { const s = e.state; setTab(s ? s.t : 'h'); setDet(s ? s.d : null) }
    addEventListener('beforeinstallprompt', h); addEventListener('popstate', pop)
    return () => { removeEventListener('beforeinstallprompt', h); removeEventListener('popstate', pop) }
  }, [])

  useEffect(() => {
    if (!D.loaded) return
    try {
      if (localStorage.getItem('dk_weakpw')) {
        localStorage.removeItem('dk_weakpw')
        setSheet({ t: 'say', text: 'Your password is too easy to guess. Please change it now: Settings > Account > New password.' })
      }
    } catch { /* storage blocked */ }
  }, [D.loaded])

  // does this Admin or Director have two-step sign-in set up? (only matters when the studio requires it)
  useEffect(() => {
    if (!D.loaded || !owner || !navigator.onLine) return
    supabase.auth.mfa.listFactors().then(({ data }) => setMfaOn(!!(data && data.totp && data.totp.length)), () => {})
  }, [D.loaded, owner])

  // Admin only: how many reported app errors are still open
  useEffect(() => {
    if (!D.loaded || !isAdmin) return undefined
    const look = () => {
      if (!navigator.onLine) return
      supabase.from('error_log').select('fingerprint', { count: 'exact', head: true }).eq('resolved', false)
        .then(({ count }) => setErrCount(count || 0), () => {})
    }
    look()
    const t = setInterval(look, 10 * 60 * 1000)
    return () => clearInterval(t)
  }, [D.loaded, isAdmin])

  // After an update, show what changed (once)
  useEffect(() => {
    if (!D.loaded) return
    try {
      const seen = localStorage.getItem('dk_seen_version')
      if (seen && seen !== APP_VERSION) {
        // release notes are for the Admin. Everyone else just gets a short confirmation.
        if (!isAdmin) setSheet({ t: 'updated' })
        else if (newerEntries(seen, APP_VERSION).length) setSheet({ t: 'whatsnew', since: seen })
      }
      localStorage.setItem('dk_seen_version', APP_VERSION)
    } catch { /* storage blocked */ }
  }, [D.loaded, isAdmin])

  if (!D.loaded) return <Loader label="Loading your studio" />
  // The Admin can require a minimum version. Only enforced online, so nobody is locked out of offline work. Admins are never blocked.
  if (!isAdmin && online && versionLt(APP_VERSION, D.S.minVersion)) return <UpdateRequired min={D.S.minVersion} upd={upd} />
  if (owner && online && D.S.requireMfa && mfaOn === false) return <MfaRequired onDone={() => setMfaOn(true)} />
  const { C, A, P, R } = D
  // The Admin is not part of the team: everyone else (Director, staff) never sees them in lists, chips or workload.
  const T = isAdmin ? D.T : D.T.filter((x) => x.role !== 'admin')
  const who = (id) => (id === myid ? 'You' : T.find((x) => x.id === id)?.name || 'Unknown')
  const pendIds = new Set(queue.filter((o) => !o.failed).map((o) => o.id))
  const CC = C.map((c) => (pendIds.has(c.id) ? { ...c, pending: true } : c))
  const AA = A
  const failed = queue.filter((o) => o.failed)
  const go = (t, d) => { setTab(t); setDet(d || null); scrollTo(0, 0); try { history.pushState({ t, d: d || null }, '') } catch { /* ignore */ } }
  const say = (text) => setSheet({ t: 'say', text })
  const ask = (text, label, fn, danger, word) => setSheet({ t: 'ask', text, label, fn, danger, word })
  const vis = CC.filter((c) => !END.includes(c.status) && (owner || c.assign.includes(myid)))
  const tot = () => { const t = { n: C.length, p: 0, b: 0, g: 0 }; C.forEach((c) => { t.p += c.codes.length; t.b += +c.pkg || 0; t.g += +c.paid || 0 }); return t }
  const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening' }
  const fname = String(profile.name || '').split(' ')[0]
  const closeSheet = () => setSheet(null)
  const select = (id) => setDet(id)

  // refresh(ids): re-read those clients. refresh(): re-read team, packages, rules and settings.
  const refresh = async (ids) => {
    if (ids && ids.length) await refreshClients(ids)
    else { const meta = await loadMeta(); applyMeta(meta); setD((d) => ({ ...d, ...meta })) }
  }
  // run(fn, ids): for things that need a connection (archive, packages, team...). Nothing fails silently.
  const run = async (fn, ids) => {
    if (!navigator.onLine) { say(OFFLINE); return false }
    const r = await fn()
    if (r && r.error) { say(r.error.message || String(r.error)); return false }
    await refresh(ids)
    return true
  }
  const doSignOut = async () => {
    await clearOffline(myid); clearLast()
    try { sessionStorage.removeItem('dk_nav'); sessionStorage.removeItem('dk_admin_sec') } catch { /* ignore */ }
    await supabase.auth.signOut()
  }
  const signOut = () => {
    if (queue.length) ask('You have ' + plural(queue.length, 'change') + ' that ' + (queue.length > 1 ? 'have' : 'has') + ' not been sent yet. If you sign out now, ' + (queue.length > 1 ? 'they are' : 'it is') + ' lost for good.', 'Sign out and lose them', doSignOut, 1)
    else doSignOut()
  }
  const retryOp = (o) => { o.failed = false; o.err = ''; setQueue([...qref.current]); closeSheet(); syncNow() }
  const discardOp = async (o) => {
    setQueue(qref.current.filter((x) => x.opid !== o.opid))
    if (o.isNew) setD((d) => ({ ...d, C: d.C.filter((c) => c.id !== o.id) })); else await refreshClients([o.id])
  }

  const X = {
    CC, C, A, AA, T, P, R, D, owner, isAdmin, myid, who, go, tab, det, q, setQ, flt, setFlt, cm, setCm, sd, setSd, sg, setSg,
    theme, setTheme, inst, setInst, profile, setSheet, say, ask, run, closeSheet, reload, refresh, vis, tot, greet, fname, signOut, desk, select, upd, waitingCount,
  }

  const c = det && CC.find((z) => z.id === det)
  const hl = c ? 'c' : tab
  const tabs = [['h', 'Home'], ['c', 'Clients'], ['s', 'Calendar'], ['m', 'Payments', 'dk'], ['r', 'Reports', 'dk'], ['g', 'Settings', 'dk'], ['a', 'Admin', 'dk'], ['x', 'More', 'mb']]
  const title = c && !(desk && tab === 'c') ? 'Client details' : { h: greet() + (fname ? ', ' + fname : ''), c: 'Clients', s: 'Calendar', m: 'Payments', r: 'Reports', g: 'Settings', a: 'Admin', x: 'More' }[tab]
  const eff = (!owner && (tab === 'm' || tab === 'r')) || (!isAdmin && tab === 'a') ? 'h' : tab
  const VIEWS = { h: desk ? HomeDesk : Home, c: List, s: Cal, m: Money, r: Report, g: SettingsPg, a: AdminPg, x: Hub }
  const View = VIEWS[eff]
  const init = (profile.name || '?')[0].toUpperCase()
  const phStyle = { backgroundImage: profile.avatar ? 'url(' + profile.avatar + ')' : 'none' }

  // Profile photo is saved on the account, so it follows the person to every device and tab.
  function pickPhoto(e) {
    const f = e.target.files[0]; if (!f) return
    const r = new FileReader()
    r.onload = () => {
      const im = new Image()
      im.onload = async () => {
        const s = 160, cv = document.createElement('canvas'); cv.width = cv.height = s
        const x = cv.getContext('2d'), k = Math.max(s / im.width, s / im.height), w = im.width * k, h = im.height * k
        x.drawImage(im, (s - w) / 2, (s - h) / 2, w, h)
        const { error } = await supabase.from('profiles').update({ avatar: cv.toDataURL('image/jpeg', 0.78) }).eq('id', myid)
        if (error) say(error.message); else reloadProfile()
      }
      im.src = r.result
    }
    r.readAsDataURL(f)
    e.target.value = ''
  }

  const detailEl = (c, embedded) => (
        <Detail embedded={embedded} c={c} C={CC} owner={owner} isAdmin={isAdmin} who={who} submit={submit} say={say} onBack={embedded ? () => select(null) : () => go(tab)}
          onEdit={() => setSheet({ t: 'form', id: c.id })} onPay={() => setSheet({ t: 'pay', id: c.id, name: c.name })}
          onNext={async () => {
            const next = ST[ST.indexOf(c.status) + 1]
            const r = await submit({ k: 'patch', id: c.id, name: c.name, base: c.ver, p: { status: next }, local: { status: next } })
            if (r.error) say(r.error); else if (r.conflict) say(conflictMsg(c.name))
          }}
          onPurge={() => ask('PERMANENTLY delete ' + c.name + ' and ALL of their data: details, ' + plural(c.pay.length, 'payment') + ', pricing, assignments, photo codes and their activity-log entries? This cannot be undone. Older backup files will still contain them.', 'Delete permanently',
            async () => { closeSheet(); if (await run(() => supabase.rpc('purge_client', { p_id: c.id }), [c.id])) go(tab) }, 1, c.name)}
          onDelete={() => ask((bal(c) > 0 ? c.name + ' still owes ' + m(bal(c)) + '. That balance will stop counting in your outstanding total (it is listed separately under Payments). ' : '') + 'Archive ' + c.name + '? It is hidden from your lists, but its payments stay in your income history. The Admin can restore it.', 'Archive',
            async () => { closeSheet(); if (await run(() => archiveClient(c.id), [c.id])) go(tab) })} />
  )

  const ageNote = ageDays >= 1 ? ' The oldest has been waiting ' + plural(ageDays, 'day') + '. Connect to the internet soon.' : ''
  const isDark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
  const bannerOn = !online || queue.length > 0
  return (
    <>
      <div className="hd">
        <button className="av" aria-label="Profile and settings" onClick={() => setSheet({ t: 'profile' })}>
          <span className="ph" style={phStyle}>{profile.avatar ? '' : init}</span>
          <span className="nm"><b>{profile.name}</b><span>{dl(profile.role)}</span></span>
        </button>
        <div className="in"><Brand /></div>
      </div>
      {isAdmin && errCount > 0 && (
        <div className="offl bad" role="status">
          {plural(errCount, 'app error')} {errCount === 1 ? 'needs' : 'need'} a look.
          <button className="chip" onClick={() => { try { sessionStorage.setItem('dk_admin_sec', 'err') } catch { /* ignore */ } go('a') }}>Open errors</button>
        </div>
      )}
      {upd.needRefresh && (
        <div className="offl upd" role="status">
          A new version of the app is ready.
          <button className="chip" onClick={() => (sheet && ['form', 'pay', 'pk'].includes(sheet.t)
            ? ask('You have a form open. Updating reloads the app and clears it. Update anyway?', 'Update now', applyUpdate)
            : applyUpdate())}>Update now</button>
        </div>
      )}
      {bannerOn && (
        <div className={'offl' + (failed.length || ageDays >= 3 ? ' bad' : ageDays >= 1 ? ' stale' : '')} role="status">
          {failed.length ? <>{plural(failed.length, 'change')} could not be saved. <button className="chip" onClick={() => setSheet({ t: 'sync' })}>Review</button></>
            : needSignIn ? <>Sign in again to send your {plural(waitingCount, 'change')}. <button className="chip" onClick={() => supabase.auth.signOut()}>Sign in</button></>
              : !online ? <>You are offline. Your changes are saved on this phone and are sent when you are back online.{waitingCount ? ' ' + plural(waitingCount, 'change') + ' waiting.' : ''}{ageNote}</>
                  : <>Sending {plural(waitingCount, 'change')}…{ageNote} <button className="chip" onClick={syncNow}>Sync now</button></>}
        </div>
      )}
      <div className="wrap">
        <div className="phead">
          <h1>{title}</h1>
          <div className="pageact">
            <button className="btn themebtn" onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
              {isDark ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
              )}
            </button>
            {desk && tab === 'h' && (
              <>
                <button className="btn o" onClick={() => setSheet({ t: 'form' })}>+ New client</button>
                <button className="btn" onClick={() => go('s')}>Open calendar</button>
              </>
            )}
          </div>
        </div>
        <div id="view">
          {!c && 'mrga'.includes(tab) && (tab === 'g' || owner) && <button className="back mbo" onClick={() => go('x')}>‹ More</button>}
          {D.err && <div className="warn">{D.err}</div>}
          <ErrorBoundary key={tab + ':' + (det || '')} page>
            {tab === 'c' && desk ? <ClientsDesk X={X} selId={det} panel={c ? detailEl(c, true) : null} /> : c ? detailEl(c, false) : <View X={X} />}
          </ErrorBoundary>
        </div>
      </div>
      <nav className="tabs">
        <button className={hl === 'h' ? 'on' : ''} onClick={() => go('h')}>Home</button>
        <button className={hl === 'c' ? 'on' : ''} onClick={() => go('c')}>Clients</button>
        <button className="fab" aria-label="Add client" onClick={() => setSheet({ t: 'form' })}><span className="fp">+</span><span className="fl">Add client</span></button>
        <button className={hl === 's' ? 'on' : ''} onClick={() => go('s')}>Calendar</button>
        {tabs.slice(3).map(([k, l, cls]) => (
          <button key={k} className={(cls || '') + (hl === k || (k === 'x' && 'mrga'.includes(hl)) ? ' on' : '')}
            style={(!owner && (k === 'm' || k === 'r')) || (!isAdmin && k === 'a') ? { display: 'none' } : undefined} onClick={() => go(k)}>{l}</button>
        ))}
      </nav>
      <Sheet open={!!sheet} onClose={closeSheet} alert={sheet?.t === 'say' || sheet?.t === 'ask'}>
        {sheet?.t === 'form' && <ClientForm key={sheet.id || 'new'} id={sheet.id} C={CC} P={P} R={R} team={T} who={who} owner={owner} submit={submit} onClose={closeSheet}
          onSaved={(r) => { closeSheet(); if (r.conflict) say(conflictMsg(r.name)) }} />}
        {sheet?.t === 'pay' && <PayForm id={sheet.id} name={sheet.name} submit={submit} onClose={closeSheet} onSaved={closeSheet} />}
        {sheet?.t === 'pk' && <PkForm p={sheet.p} onClose={closeSheet} onSaved={() => { closeSheet(); refresh() }} />}
        {sheet?.t === 'updated' && <><h2>App updated</h2><p style={{ lineHeight: 1.55, marginTop: 8 }}>You are now using the latest version.</p><button className="btn p" style={{ width: '100%', marginTop: 16 }} onClick={closeSheet}>OK</button></>}
        {sheet?.t === 'whatsnew' && <WhatsNew since={sheet.since} onClose={closeSheet} />}
        {sheet?.t === 'sync' && <SyncBody ops={failed} onRetry={retryOp} onDiscard={discardOp} closeSheet={closeSheet} />}
        {sheet?.t === 'say' && <><h2>Notice</h2><p style={{ lineHeight: 1.55, marginTop: 8 }}>{sheet.text}</p><button className="btn p" style={{ width: '100%', marginTop: 16 }} onClick={closeSheet}>OK</button></>}
        {sheet?.t === 'ask' && <AskBody key={sheet.text} sheet={sheet} closeSheet={closeSheet} />}
        {sheet?.t === 'profile' && (
          <>
            <div style={{ textAlign: 'center' }}><div className="ph" style={{ width: 88, height: 88, margin: '0 auto 10px', fontSize: 34, ...phStyle }}>{profile.avatar ? '' : init}</div><h2>{profile.name}</h2><p className="sub">{dl(profile.role)}</p></div>
            <label className="btn" style={{ marginTop: 14 }}>Change photo<input type="file" accept="image/*" style={{ display: 'none' }} onChange={pickPhoto} /></label>
            <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={() => { closeSheet(); go('g') }}>Settings</button>
            <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={() => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')}>{document.documentElement.dataset.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</button>
            <button className="btn o" style={{ width: '100%', marginTop: 8 }} onClick={signOut}>Sign out</button>
            <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={closeSheet}>Close</button>
          </>
        )}
      </Sheet>
    </>
  )
}

/* ============ ROOT ============ */
export default function App() {
  const [session, setSession] = useState(undefined)
  const [prof, setProf] = useState({ id: null, data: null })
  const [recovery, setRecovery] = useState(false)
  const [aal, setAal] = useState('checking')

  useEffect(() => installA11y(), [])
  useEffect(() => {
    // With no signal and an expired login token, supabase cannot refresh it. If this phone knows who was signed in,
    // open the app as that person so their saved clients and waiting changes are still there.
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) { setSession(data.session); return }
      const last = readLast()
      if (!navigator.onLine && last) setSession({ offline: true, user: { id: last.uid } })
      else setSession(null)
    }
    init()
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (s) setSession(s)
      else if (event === 'SIGNED_OUT') setSession(null)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    addEventListener('online', init)
    return () => { sub.subscription.unsubscribe(); removeEventListener('online', init) }
  }, [])

  // Two-step sign-in: if this person has it set up and has only typed the password so far, ask for the code
  const sid = session && !session.offline ? session.user.id : null
  useEffect(() => {
    if (!sid) return undefined
    let dead = false
    setAal('checking')
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(
      ({ data }) => { if (!dead) setAal(data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2' ? 'need' : 'ok') },
      () => { if (!dead) setAal('ok') })
    return () => { dead = true }
  }, [sid])
  // a suspended or removed person's phone must not keep a copy of the clients
  useEffect(() => {
    if (prof.id && (prof.data === null || prof.data.status !== 'active')) clearOffline(prof.id)
  }, [prof])

  const uid = session ? session.user.id : null
  const loadProfile = useCallback(
    () => supabase.from('profiles').select('*').eq('id', uid).maybeSingle().then(({ data, error }) => {
      if (error) { const last = readLast(); if (last && last.uid === uid) setProf({ id: uid, data: last.profile }); return }
      if (data) writeLast(uid, data)
      setProf({ id: uid, data })
    }),
    [uid])
  useEffect(() => {
    if (!uid) return undefined
    loadProfile()
    const ch = supabase.channel('me-' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'id=eq.' + uid }, loadProfile).subscribe()
    return () => supabase.removeChannel(ch)
  }, [uid, loadProfile])
  useEffect(() => { if (!session) document.documentElement.dataset.theme = 'light' }, [session])

  if (session === undefined) return <Loader />
  if (!session) return <Landing />
  if (!session.offline && aal === 'checking') return <Loader />
  if (!session.offline && aal === 'need') return <MfaChallenge onDone={() => setAal('ok')} />
  if (recovery) return <NewPassword email={session.user.email} onDone={() => setRecovery(false)} />
  // profile is only trusted once it was loaded for THIS signed-in user; until then show the loader (no flash of the error screen)
  const profile = prof.id === session.user.id ? prof.data : undefined
  if (profile === undefined) return <Loader />
  if (profile === null) return (
    <div id="lg" className="show"><div className="lgwrap"><div className="lgmain">
      <h1>Profile missing</h1>
      <div className="card"><p style={{ lineHeight: 1.55 }}>You are signed in, but the database has no profile for this account. This happens when the account was created before schema.sql was run. Run the profile fix from the README in the Supabase SQL Editor, then sign in again.</p>
        <button className="btn p" style={{ width: '100%', marginTop: 14 }} onClick={() => supabase.auth.signOut()}>Sign out</button></div>
    </div></div></div>
  )
  if (profile.status !== 'active') return <Landing pending onOut={() => { clearLast(); supabase.auth.signOut() }} />
  return <Studio session={session} profile={profile} reloadProfile={loadProfile} />
}
