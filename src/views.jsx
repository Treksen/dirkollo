import { restoreClient } from './data'
import { ST, m, off, today, fd, kfmt, isDate, bal, used, reminders, exportCsv, exportPdf, isOverdue, daysSince, ALL_ST, END, isLate, isBehind, stuckDays } from './lib'
import { cl, plural } from './util'
import { AsgRow } from './forms'

export function Mini({ X, c, u }) {
  const { owner, who, go, tab } = X
  const dp = c.codes.filter((x) => u[x] && u[x].length > 1).length
  return (
    <div className="card cl" {...cl(() => go(X.desk ? 'c' : tab, c.id))}>
      <div className="head"><div><h3>{c.name}</h3><p>{[c.eventType, fd(c.date) + (c.time ? ' · ' + c.time : '')].join(' · ')}</p></div><span className={'badge' + (END.includes(c.status) ? ' end' : '')}>{c.status}</span></div>
      <div className="row"><span>{plural(c.codes.length, 'photo')} selected</span><b>{owner ? 'Balance ' + m(bal(c)) : ''}</b></div>
      <AsgRow c={c} who={who} />
      {c.pending && <div className="warn">Saved on this phone, not sent yet</div>}
      {isOverdue(c) && <div className="warn" style={{ background: '#fde1e1', color: '#9b1c1c' }}>Overdue: session was {daysSince(c.date)} day{daysSince(c.date) === 1 ? '' : 's'} ago. Mark as Shot or reschedule.</div>}
      {isLate(c) && <div className="warn" style={{ background: '#fde1e1', color: '#9b1c1c' }}>Delivery was due {fd(c.deliverBy)}.</div>}
      {stuckDays(c) > 0 && <div className="warn">{stuckDays(c)} days in {c.status}. Move it on.</div>}
      {owner && bal(c) < 0 && !END.includes(c.status) && <div className="warn">Overpaid by {m(-bal(c))}</div>}
      {dp > 0 && <div className="warn">{dp} duplicate code{dp > 1 ? 's' : ''} — open to review</div>}
    </div>
  )
}

export function Trow({ X, c }) {
  const { who, go, tab } = X
  return (
  <div className="card cl" {...cl(() => go(X.desk ? 'c' : tab, c.id))}>
    <div className="head"><div><h3>{c.time ? c.time + ' · ' : ''}{c.name}</h3><p>{[c.eventType, c.loc].filter(Boolean).join(' · ')}</p></div><span className={'badge' + (END.includes(c.status) ? ' end' : '')}>{c.status}</span></div>
    <AsgRow c={c} who={who} />
    {c.pending && <div className="warn">Saved on this phone, not sent yet</div>}
    {isOverdue(c) && <div className="warn" style={{ background: '#fde1e1', color: '#9b1c1c' }}>Overdue: session was {daysSince(c.date)} day{daysSince(c.date) === 1 ? '' : 's'} ago. Mark as Shot or reschedule.</div>}
      {isLate(c) && <div className="warn" style={{ background: '#fde1e1', color: '#9b1c1c' }}>Delivery was due {fd(c.deliverBy)}.</div>}
      {stuckDays(c) > 0 && <div className="warn">{stuckDays(c)} days in {c.status}. Move it on.</div>}
  </div>
  )
}

export function Rcard({ X, r }) {
  const { go, tab } = X
  return (
  <div className="card cl" {...cl(() => go(X.desk ? 'c' : tab, r.c.id))}><div className="head"><div><h3>{r.c.name}</h3><p>{r.k}</p></div><span className={'badge' + (END.includes(r.c.status) ? ' end' : '')}>{r.c.status}</span></div></div>
  )
}

export function Stats({ X }) {
  const { owner, tot } = X
  const t = tot()
  return (
    <div className="stats">
      <div className="stat"><b>{t.n}</b><span>Clients</span></div>
      <div className="stat"><b>{t.p}</b><span>Photos selected</span></div>
      {owner && <><div className="stat"><b>{m(t.g)}</b><span>Income received</span></div><div className="stat"><b>{m(t.b - t.g)}</b><span>Outstanding</span></div></>}
    </div>
  )
}

export function Home({ X }) {
  const { CC, AA, T, owner, myid, go, tab, setFlt, setSd, setSheet, vis, tot } = X
  const t = today(), ym = t.slice(0, 7), u = used(CC)
  const pd = new Date(); pd.setDate(1); pd.setMonth(pd.getMonth() - 1)
  const lm = pd.getFullYear() + '-' + String(pd.getMonth() + 1).padStart(2, '0')
  const td = vis.filter((c) => c.date === t).sort((a, b) => ((a.time || '99') < (b.time || '99') ? -1 : 1))
  const wk = [...Array(7)].map((_, i) => { const d = off(i), dt = new Date(d + 'T00:00'); return { d, n: vis.filter((c) => c.date === d).length, l: dt.toLocaleDateString('en-GB', { weekday: 'short' }), x: dt.getDate() } })
  const wkN = wk.reduce((s, x) => s + x.n, 0)
  const pays = []; [...CC, ...AA].forEach((c) => c.pay.forEach((x) => { if (isDate(x.d)) pays.push({ ...x, n: c.name, id: c.id }) }))
  const inc = (k) => pays.filter((x) => String(x.d).slice(0, 7) === k).reduce((s, x) => s + (+x.amt || 0), 0)
  const a = inc(ym), b = inc(lm), tt = tot()
  const sm = vis.filter((c) => (c.date || '').startsWith(ym)), ph = sm.reduce((s, c) => s + c.codes.length, 0)
  const dlt = b ? Math.round((a - b) / b * 100) : null
  const unas = owner ? CC.filter((c) => !END.includes(c.status) && c.date >= t && c.date <= off(7) && !c.assign.length).length : 0
  const archOwed = AA.reduce((s, c) => s + Math.max(0, bal(c)), 0)
  const rm = reminders(CC, owner, myid), n = ST.map((s) => vis.filter((c) => c.status === s).length)
  const up = vis.filter((c) => c.date > t).sort((x, y) => (x.date < y.date ? -1 : 1)).slice(0, 3)
  const rp = pays.filter((x) => x.d <= t).sort((x, y) => (x.d < y.d ? 1 : -1)).slice(0, 3)
  const mo = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); return { l: d.toLocaleDateString('en-GB', { month: 'short' }), v: inc(k) } })
  const mx = Math.max(1, ...mo.map((x) => x.v))
  const L = T.filter((x) => x.status === 'active').map((x) => ({ ...x, n: CC.filter((c) => !END.includes(c.status) && c.date >= t && c.date <= off(6) && c.assign.includes(x.id)).length }))
  const lx = Math.max(1, ...L.map((x) => x.n))
  return (
    <>
      <div className="hcols">
        <div className="hmain">
        <div style={{ order: 1 }}>
                <div className="hero"><small>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</small>
                  <h2>{td.length ? 'You have ' + plural(td.length, 'session') + ' today' : 'No sessions today'}</h2>
                  <p>{plural(wkN, 'session')} in the next 7 days{unas ? ' · ' + unas + ' still need a photographer' : ''}</p>
                  <div className="act"><button className="btn o" onClick={() => setSheet({ t: 'form' })}>+ New client</button><button className="btn g" onClick={() => go('s')}>Open calendar</button></div></div>
        </div>
        <div style={{ order: 2 }}>
                <div className="stats">
                  {owner ? (<>
                    <div className="stat"><b>{m(a)}</b><span>Income this month</span>{dlt != null && <em className={dlt >= 0 ? 'up' : 'dn'}>{dlt >= 0 ? '▲ ' : '▼ '}{Math.abs(dlt)}% vs last month</em>}</div>
                    <div className="stat"><b>{m(tt.b - tt.g)}</b><span>Outstanding balance</span><em>{CC.filter((c) => bal(c) > 0).length} unpaid clients{archOwed ? ' · plus ' + m(archOwed) + ' owed by archived clients' : ''}</em></div>
                  </>) : (<>
                    <div className="stat"><b>{wkN}</b><span>My sessions, next 7 days</span></div>
                    <div className="stat"><b>{vis.filter((c) => c.status === 'Selecting').length}</b><span>Waiting for selection</span></div>
                  </>)}
                  <div className="stat"><b>{sm.length}</b><span>Sessions this month</span></div>
                  <div className="stat"><b>{ph}</b><span>Photos selected this month</span></div>
                </div>
        </div>
        <div style={{ order: 3 }}>
                <div className="sec">Next 7 days</div>
                <div className="wk">{wk.map((x) => <button key={x.d} className={'wd' + (x.n ? ' has' : '') + (x.d === t ? ' today' : '')} onClick={() => { setSd(x.d); go('s') }}><small>{x.l}</small><b>{x.x}</b><i>{x.n}</i></button>)}</div>
        </div>
        <div style={{ order: 4 }}>
                {td.length > 0 && <><div className="sec">Today</div>{td.map((c) => <Trow X={X} key={c.id} c={c} />)}</>}
        </div>
        <div style={{ order: 5 }}>
                <div className="sec">Needs attention</div>
                {rm.slice(0, 4).map((r, i) => <Rcard X={X} key={i} r={r} />)}{!rm.length && <div className="empty">All caught up.</div>}
                {rm.length > 4 && <button className="chip" style={{ margin: '4px 0 10px' }} onClick={() => go('s')}>See all {rm.length} reminders</button>}
        </div>
        <div style={{ order: 10 }}>
                <div className="sec">{owner ? 'Coming up' : 'My next sessions'}</div>
                {up.map((c) => <Mini X={X} key={c.id} c={c} u={u} />)}{!up.length && <div className="empty">No upcoming sessions.</div>}
        </div>
        </div>
        <div className="haside">
        <div style={{ order: 6 }}>
                <div className="sec">Pipeline</div>
                <div className="seg">{n.map((x, i) => <i key={i} style={{ flex: x }}></i>)}</div>
                <div className="pipe">{ST.map((s, i) => <button key={s} onClick={() => { setFlt(s); go('c') }}>{s} · {n[i]}</button>)}</div>
        </div>
                {owner && (<div style={{ order: 7 }}>
                  <div className="sec">Income</div>
                  <div className="card"><div className="lab">Last 6 months</div>
                    <div className="chart">{mo.map((x, i) => <div key={i} className={i === 5 ? 'cur' : ''}><b>{x.v ? kfmt(x.v) : ''}</b><i style={{ height: Math.max(3, Math.round(x.v / mx * 80)) }}></i><span>{x.l}</span></div>)}</div></div>
        </div>)}
                {owner && (<div style={{ order: 8 }}>
                  <div className="sec">Team</div>
                  <div className="card"><div className="lab">Workload, next 7 days</div>
                    {L.map((x) => <div key={x.id}><div className="row"><span>{x.id === myid ? 'You' : x.name}</span><b>{plural(x.n, 'session')}</b></div><div className="bar"><i style={{ width: Math.round(x.n / lx * 100) + '%' }}></i></div></div>)}</div>
        </div>)}
          {owner && rp.length > 0 && <div style={{ order: 9 }}><div className="sec">Recent payments</div>{rp.map((x) => <div key={x.id + x.d + x.amt} className="card cl" {...cl(() => go(X.desk ? 'c' : tab, x.id))}><div className="row"><span>{x.n} · {x.m} · {fd(x.d)}</span><b>{m(x.amt)}</b></div></div>)}</div>}
        </div>
      </div>
    </>
  )
}

export function List({ X }) {
  const { CC, C, owner, myid, q, setQ, flt, setFlt } = X
  const u = used(CC), k = q.toLowerCase()
  const r = CC.filter((c) => (flt === "All" || (flt === 'Mine' ? c.assign.includes(myid) : flt === 'Unassigned' ? !c.assign.length : flt === 'Behind' ? isBehind(c) : flt === 'Overdue' ? isOverdue(c) : flt === 'No date' ? !c.date : c.status === flt)) &&
    (!k || [c.name, c.phone, c.eventType, ...c.codes].join(' ').toLowerCase().includes(k)))
  return (
    <>
      <input placeholder="Search name, phone or photo code" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="pipe">{['All', 'Mine', 'Behind', 'No date', ...(owner ? ['Unassigned'] : []), ...ST, ...END].map((s) => <button key={s} className={flt === s ? 'on' : ''} onClick={() => setFlt(s)}>{s}</button>)}</div>
      {r.map((c) => <Mini X={X} key={c.id} c={c} u={u} />)}
      {!r.length && <div className="empty">{C.length ? 'No matching clients.' : <>No clients yet.<br />Tap + to add your first one.</>}</div>}
    </>
  )
}

export function Cal({ X }) {
  const { CC, owner, myid, cm, setCm, sd, setSd } = X
  const y = cm.getFullYear(), mo = cm.getMonth(), first = new Date(y, mo, 1).getDay(), n = new Date(y, mo + 1, 0).getDate()
  const pad = (x) => String(x).padStart(2, '0'), by = {}
  CC.forEach((c) => { if (c.date) (by[c.date] = by[c.date] || []).push(c) })
  const day = sd || today(), Lst = by[day] || [], u = used(CC), rm = reminders(CC, owner, myid)
  return (
    <>
      <div className="cal2">
      <div className="calL">
      <div className="card">
        <div className="row" style={{ alignItems: 'center' }}>
          <button className="btn" style={{ flex: 'none', width: 46 }} aria-label="Previous month" onClick={() => setCm(new Date(y, mo - 1, 1))}>‹</button>
          <h3>{cm.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3>
          <button className="btn" style={{ flex: 'none', width: 46 }} aria-label="Next month" onClick={() => setCm(new Date(y, mo + 1, 1))}>›</button>
        </div>
        <div className="cg">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x, i) => <b key={i} className="dw">{x}</b>)}
          {[...Array(first)].map((_, i) => <span key={'e' + i}></span>)}
          {[...Array(n)].map((_, i) => { const d = i + 1, k = y + '-' + pad(mo + 1) + '-' + pad(d), cnt = (by[k] || []).length
            return <button key={k} className={'dy' + (k === today() ? ' td' : '') + (k === day ? ' sl' : '')} onClick={() => setSd(k)}>{d}{cnt > 0 && <i>{cnt}</i>}</button> })}
        </div>
      </div>
      </div>
      <div className="calR">
      <div className="sec">{fd(day)}</div>
      {Lst.map((c) => <Mini X={X} key={c.id} c={c} u={u} />)}{!Lst.length && <div className="empty">No sessions on this day.</div>}
      <div className="sec">Reminders</div>
      {rm.map((r, i) => <Rcard X={X} key={i} r={r} />)}{!rm.length && <div className="empty">All caught up.</div>}
      </div>
    </div>
    </>
  )
}

export function Money({ X }) {
  const { CC, C, go, tab, tot, AA, run } = X
  const owed = AA.filter((c) => bal(c) > 0).sort((x, y) => bal(y) - bal(x))
  const over = CC.filter((c) => bal(c) < 0 && !END.includes(c.status))
  const t = tot(), o = CC.filter((c) => bal(c) > 0).sort((a, b) => bal(b) - bal(a)), p = []
  CC.forEach((c) => c.pay.forEach((x) => p.push({ ...x, n: c.name, id: c.id })))
  p.sort((a, b) => (a.d < b.d ? 1 : -1))
  return (
    <>
      <div className="stats">
        <div className="stat"><b>{m(t.g)}</b><span>Collected</span></div><div className="stat"><b>{m(t.b - t.g)}</b><span>Outstanding</span></div>
        <div className="stat"><b>{C.length}</b><span>Invoices</span></div><div className="stat"><b>{o.length}</b><span>Unpaid clients</span></div>
      </div>
      <div className="sec">Outstanding balances</div>
      {o.map((c) => <div key={c.id} className="card cl" {...cl(() => go(X.desk ? 'c' : tab, c.id))}><div className="head"><div><h3>{c.name}</h3><p>{c.eventType} · {fd(c.date)}{c.payBy ? ' · pay by ' + fd(c.payBy) : ''}</p></div><b style={{ color: 'var(--orgd)' }}>{m(bal(c))}</b></div></div>)}
      {!o.length && <div className="empty">Everything is paid.</div>}
      <div className="sec">Recent payments</div>
      {p.slice(0, 8).map((x) => <div key={x.id + x.d + x.amt + x.m} className="card cl" {...cl(() => go(X.desk ? 'c' : tab, x.id))}><div className="row"><span>{x.n} · {x.m} · {isDate(x.d) ? fd(x.d) : x.d}</span><b>{m(x.amt)}</b></div></div>)}
      {!p.length && <div className="empty">No payments recorded.</div>}
      {over.length > 0 && (
        <>
          <div className="sec">Overpaid: check or refund ({m(over.reduce((s, c) => s - bal(c), 0))})</div>
          {over.map((c) => <div key={c.id} className="card cl" {...cl(() => go(X.desk ? 'c' : tab, c.id))}><div className="head"><div><h3>{c.name}</h3><p>{c.eventType} · {fd(c.date)}</p></div><b style={{ color: 'var(--orgd)' }}>{m(-bal(c))} over</b></div></div>)}
        </>
      )}
      {owed.length > 0 && (
        <>
          <div className="sec">Owed by archived clients ({m(owed.reduce((s, c) => s + bal(c), 0))})</div>
          {owed.map((c) => (
            <div key={c.id} className="card">
              <div className="head"><div><h3>{c.name}</h3><p>{c.eventType} · {fd(c.date)}</p></div><b style={{ color: 'var(--orgd)' }}>{m(bal(c))}</b></div>
              <div className="act"><button className="btn" onClick={() => run(() => restoreClient(c.id), [c.id])}>Restore client</button></div>
            </div>
          ))}
        </>
      )}
    </>
  )
}

export function Report({ X }) {
  const { CC, C, say, tot } = X
  const t = tot()
  return (
    <>
      <Stats X={X} />
      <div className="mason" style={{ marginTop: 12 }}>
      <div className="card"><div className="lab">Clients by status</div>
        {ALL_ST.map((s) => { const n = C.filter((c) => c.status === s).length; return <div key={s}><div className="row"><span>{s}</span><b>{n}</b></div><div className="bar"><i style={{ width: (t.n ? n / t.n * 100 : 0) + '%' }}></i></div></div> })}</div>
      <div className="card"><div className="lab">Export</div>
        <div className="act"><button className="btn p" onClick={() => exportCsv(CC)}>Excel (CSV)</button>
          <button className="btn" onClick={() => exportPdf(CC).catch(() => say('The PDF tool could not load. Check your internet connection and try again.'))}>PDF report</button></div></div>
      </div>
    </>
  )
}

export function Hub({ X }) {
  const { owner, isAdmin, go } = X
  const it = (t, a, b) => <div key={t} className="card cl" {...cl(() => go(t))}><div className="head"><div><h3>{a}</h3><p>{b}</p></div><span style={{ fontSize: 22, color: 'var(--mute)' }}>›</span></div></div>
  return <>{owner && it('m', 'Payments', 'Balances, payments and invoices')}{owner && it('r', 'Reports', 'Summary and exports (Excel, PDF)')}{it('g', 'Settings', 'Account' + (owner ? ', staff, packages and pricing' : ''))}{isAdmin && it('a', 'Admin', 'Overview, activity, data tools and studio settings')}</>
}
