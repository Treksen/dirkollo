import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { savePackage } from './data'
import { ST, SV, SS, m, codes, today, fd, wan, isDate, bal, used, clash, exportInvoice, calcPrice, isOverdue, daysSince, ALL_ST, END, phoneOk, dupMatches, isLate, stuckDays, getLimits } from './lib'
import { plural } from './util'

export function ClientForm({ id, C, P, R, team, who, owner, submit, onClose, onSaved }) {
  const old = C.find((c) => c.id === id)
  const [f, setF] = useState(() => ({
    name: old?.name || '', phone: old?.phone || '', eventType: old?.eventType || 'Wedding', date: old?.date || '',
    loc: old?.loc || '', time: old?.time || '', hrs: old?.hrs || 2, assign: old?.assign || [], services: old?.services || '',
    status: old?.status || 'Booked', codes: (old?.codes || []).join(', '), pk: old?.pk || '',
    pkg: old ? old.pkg : '', paid: old ? old.paid : '', payBy: old?.payBy || '', deliverBy: old?.deliverBy || '', man: !!old,
  }))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [srv, setSrv] = useState({})
  // Duplicate photo codes are checked on the server too, so staff who cannot see every client are still protected
  useEffect(() => {
    const l = codes(f.codes)
    if (!l.length) { setSrv({}); return undefined }
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('code_clashes', { codes: l, except_id: id || null })
      const o = {}; (data || []).forEach((r) => (o[r.code] = o[r.code] || []).push(r.client_name || 'another client')); setSrv(o)
    }, 400)
    return () => clearTimeout(t)
  }, [f.codes, id])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const cd = codes(f.codes), u = { ...used(C, id), ...srv }
  const po = P.find((p) => p.name === f.pk)
  const calc = calcPrice(po, cd.length, f.date, R)
  const pkgVal = !f.man && calc ? calc.t : f.pkg
  const clashes = clash(C, id, f.date, f.time, +f.hrs || 2, f.assign, who)
  const dups = dupMatches(C, { id, phone: f.phone, name: f.name, date: f.date })
  const over = po && cd.length > po.photos ? cd.length - po.photos : 0
  const tog = (x) => setF({ ...f, assign: f.assign.includes(x) ? f.assign.filter((y) => y !== x) : [...f.assign, x] })

  async function save() {
    const n = f.name.trim()
    if (!n) { setErr('Enter the client name.'); return }
    setBusy(true); setErr('')
    const paid = owner ? +f.paid || 0 : old?.paid || 0
    const delta = owner ? paid - (old?.paid || 0) : 0
    const op = {
      k: 'save', id: old?.id || crypto.randomUUID(), isNew: !old, name: n, base: old?.ver || null,
      p: { name: n, phone: f.phone.trim(), event_type: f.eventType, session_date: f.date, session_time: f.time, duration_hrs: +f.hrs || 2, location: f.loc.trim(), services: f.services.trim(), status: f.status, photo_codes: cd, deliver_by: f.deliverBy || null },
      assign: owner ? f.assign : null,
      fin: owner ? { package_name: f.pk, price: +pkgVal || 0, pay_by: f.payBy || null } : null,
      // money is sent as a CHANGE (+/-), never as a total, so two people adding payments offline never overwrite each other
      pay: delta ? { id: crypto.randomUUID(), amount: delta, method: old ? 'Adjustment' : 'Deposit', note: old ? 'Edited in client form' : null, paid_on: today() } : null,
      local: {
        name: n, phone: f.phone.trim(), eventType: f.eventType, date: f.date, loc: f.loc.trim(), time: f.time, hrs: +f.hrs || 2,
        services: f.services.trim(), status: f.status, codes: cd, deliverBy: f.deliverBy,
        ...(owner ? { assign: f.assign, pk: f.pk, pkg: +pkgVal || 0, payBy: f.payBy } : {}),
      },
    }
    const r = await submit(op)
    setBusy(false)
    if (r.error) setErr(r.error); else onSaved({ ...r, name: n })
  }

  return (
    <>
      <h2>{id ? 'Edit client' : 'New client'}</h2>
      <label>Name</label><input value={f.name} onChange={set('name')} />
      <label>Phone</label><input type="tel" value={f.phone} onChange={set('phone')} />
      {f.phone.trim() && !phoneOk(f.phone) && <div className="warn" style={{ marginTop: 6 }}>This number looks too short or has odd characters. Use digits like 0712 345 678.</div>}
      {dups.length > 0 && <div className="warn" style={{ marginTop: 6 }}>Possible duplicate: {dups.map((x) => x.name + ' (' + fd(x.date) + ')').join(', ')} already {dups.length > 1 ? 'have' : 'has'} this phone number, or the same name on this date.</div>}
      <div className="g2">
        <div><label>Event type</label><select value={f.eventType} onChange={set('eventType')}>{SV.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label>Session date</label><input type="date" value={f.date} onChange={set('date')} /></div>
      </div>
      <label>Location</label><input value={f.loc} onChange={set('loc')} />
      <div className="g2">
        <div><label>Start time</label><input type="time" value={f.time} onChange={set('time')} /></div>
        <div><label>Duration</label><select value={f.hrs} onChange={set('hrs')}>{[1, 2, 3, 4, 6, 8, 10].map((x) => <option key={x} value={x}>{x} hr{x > 1 ? 's' : ''}</option>)}</select></div>
      </div>
      {owner && (
        <div className="own"><label>Assigned to</label>
          <div className="chips">{team.filter((u2) => u2.status === 'active').map((u2) => <button key={u2.id} className={'chip' + (f.assign.includes(u2.id) ? ' on' : '')} onClick={() => tog(u2.id)}>{who(u2.id)}</button>)}</div>
        </div>
      )}
      {clashes.map((x, i) => <div key={i} className="warn" style={{ marginTop: 6 }}>{x.w} is also assigned to {x.n} ({x.t}) - times overlap</div>)}
      <label>Services</label><input value={f.services} onChange={set('services')} />
      <div className="chips">{SS.map((s) => <button key={s} className="chip" onClick={() => setF({ ...f, services: f.services ? f.services + ', ' + s : s })}>+ {s}</button>)}</div>
      <label>Status</label><select value={f.status} onChange={set('status')}>{ALL_ST.map((s) => <option key={s}>{s}</option>)}</select>
      <label>Deliver by (optional)</label><input type="date" value={f.deliverBy} onChange={set('deliverBy')} />
      <label>Selected photo codes</label><input inputMode="numeric" placeholder="3217, 3219, 3223" value={f.codes} onChange={set('codes')} />
      <div className="lab" style={{ marginTop: 8 }}>{plural(cd.length, 'photo')} selected</div>
      {over > 0 && <div className="warn" style={{ marginTop: 6 }}>Over package limit: {plural(over, 'extra photo')} (limit {po.photos})</div>}
      {cd.filter((x) => u[x]).map((x) => <div key={x} className="warn" style={{ marginTop: 6 }}>Code {x} is also selected by {u[x].join(', ')}</div>)}
      {owner && (
        <div className="own"><label>Package</label>
          <select value={f.pk} onChange={(e) => setF({ ...f, pk: e.target.value, man: false })}>
            <option value="">Custom</option>{P.map((p) => <option key={p.id} value={p.name}>{p.name} — {m(p.price)}</option>)}
          </select>
          {calc && !f.man && <div className="sub" style={{ marginTop: 6 }}>Base {m(calc.base)}{calc.ex ? ' + extra photos ' + m(calc.ex) : ''}{calc.wk ? ' + weekend ' + m(calc.wk) : ''}{calc.dc ? ' - discount ' + m(calc.dc) : ''} = <b>{m(calc.t)}</b></div>}
          <div className="g2">
            <div><label>Package price</label><input type="number" inputMode="decimal" value={pkgVal} onChange={(e) => setF({ ...f, pkg: e.target.value, man: true })} /></div>
            <div><label>Amount paid</label><input type="number" inputMode="decimal" value={f.paid} onChange={set('paid')} /></div>
          </div>
          <label>Pay by (optional)</label><input type="date" value={f.payBy} onChange={set('payBy')} />
        </div>
      )}
      {err && <div className="warn" style={{ marginTop: 10 }}>{err}</div>}
      <div className="act" style={{ marginTop: 18 }}><button className="btn" onClick={onClose}>Cancel</button><button className="btn p" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button></div>
    </>
  )
}

export function PayForm({ id, name, submit, onClose, onSaved }) {
  const [f, setF] = useState({ amt: '', m: 'M-Pesa', d: today(), note: '' })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  async function save() {
    if (!+f.amt) { setErr('Enter the amount.'); return }
    const e = { id: crypto.randomUUID(), d: f.d || today(), amt: +f.amt, m: f.m, note: f.note.trim() }
    const r = await submit({ k: 'pay', id, name, payId: e.id, local: e })
    if (r.error) setErr(r.error); else onSaved(r)
  }
  return (
    <>
      <h2>Record payment</h2>
      <label>Amount</label><input type="number" inputMode="decimal" value={f.amt} onChange={set('amt')} />
      <div className="g2">
        <div><label>Method</label><select value={f.m} onChange={set('m')}>{['M-Pesa', 'Cash', 'Bank', 'Card'].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label>Date</label><input type="date" value={f.d} onChange={set('d')} /></div>
      </div>
      <label>Note</label><input placeholder="Deposit, balance…" value={f.note} onChange={set('note')} />
      {err && <div className="warn" style={{ marginTop: 10 }}>{err}</div>}
      <div className="act" style={{ marginTop: 18 }}><button className="btn" onClick={onClose}>Cancel</button><button className="btn p" onClick={save}>Save</button></div>
    </>
  )
}

export function PkForm({ p, onClose, onSaved }) {
  const [f, setF] = useState({ name: p?.name || '', price: p?.price ?? '', photos: p?.photos ?? '', inc: p?.inc || '' })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  async function save() {
    if (!f.name.trim()) { setErr('Enter the package name.'); return }
    const { error } = await savePackage({ id: p?.id, name: f.name.trim(), price: +f.price || 0, photos: +f.photos || 0, inc: f.inc.trim() })
    if (error) setErr(error.message); else onSaved()
  }
  return (
    <>
      <h2>{p ? 'Edit package' : 'New package'}</h2>
      <label>Name</label><input value={f.name} onChange={set('name')} />
      <div className="g2">
        <div><label>Price</label><input type="number" inputMode="decimal" value={f.price} onChange={set('price')} /></div>
        <div><label>Photos included</label><input type="number" inputMode="numeric" value={f.photos} onChange={set('photos')} /></div>
      </div>
      <label>What is included</label><input value={f.inc} onChange={set('inc')} />
      {err && <div className="warn" style={{ marginTop: 10 }}>{err}</div>}
      <div className="act" style={{ marginTop: 18 }}><button className="btn" onClick={onClose}>Cancel</button><button className="btn p" onClick={save}>Save</button></div>
    </>
  )
}

export function Detail({ c, C, owner, isAdmin, who, submit, embedded, onBack, onEdit, onDelete, onPurge, onNext, onPay, say }) {
  const u = used(C, c.id), cd = c.codes, b = bal(c)
  const ph = String(c.phone || '').replace(/[^\d+]/g, ''), nx = ST[ST.indexOf(c.status) + 1]
  const setEnd = async (s) => {
    const r = await submit({ k: 'patch', id: c.id, name: c.name, base: c.ver, p: { status: s }, local: { status: s } })
    if (r.error) say(r.error)
  }
  const [g, setG] = useState(c.gallery)
  const msg = encodeURIComponent('Hi ' + c.name.split(/[ &]/)[0] + ', your photos from Director Kollo Studios are ready: ' + g)
  const dd = (d) => (isDate(d) ? fd(d) : d)
  return (
    <>
      {embedded
        ? <button className="chip" style={{ marginBottom: 8 }} aria-label="Close details" onClick={onBack}>Close</button>
        : <button className="back" onClick={onBack}>← Back</button>}
      <div className="card dcard">
        {c.pending && <div className="warn" style={{ marginBottom: 8 }}>Saved on this phone. Not sent to the server yet.</div>}
        {isOverdue(c) && <div className="warn" style={{ marginBottom: 8, background: '#fde1e1', color: '#9b1c1c' }}>Overdue: this session was {daysSince(c.date)} day{daysSince(c.date) === 1 ? '' : 's'} ago and the client is still Booked. Move to Shot, or Edit to reschedule.</div>}
        {isLate(c) && <div className="warn" style={{ marginBottom: 8, background: '#fde1e1', color: '#9b1c1c' }}>Delivery was due {fd(c.deliverBy)}. It has not been delivered yet.</div>}
        {stuckDays(c) > 0 && <div className="warn" style={{ marginBottom: 8 }}>In "{c.status}" for {stuckDays(c)} days (limit {getLimits()[c.status]}). Move it on, or Edit if it is waiting on the client.</div>}
        {!c.phone && <div className="warn" style={{ marginBottom: 8 }}>No phone number, so Call and WhatsApp cannot work. <button className="chip" onClick={onEdit}>Add phone</button></div>}
        {c.phone && !phoneOk(c.phone) && <div className="warn" style={{ marginBottom: 8 }}>This phone number looks wrong. <button className="chip" onClick={onEdit}>Fix phone</button></div>}
        <div className="head"><div><h2>{c.name}</h2><p>{[c.eventType, fd(c.date) + (c.time ? ' · ' + c.time : ''), c.loc].filter(Boolean).join(' · ')}</p></div><span className={'badge' + (END.includes(c.status) ? ' end' : '')}>{c.status}</span></div>
        {c.services && <div className="row"><span>Services</span><b>{c.services}</b></div>}
        {c.phone && <div className="row"><span>Phone</span><b>{c.phone}</b></div>}
        <AsgRow c={c} who={who} />
        <div className="lab">{plural(cd.length, 'photo')} selected</div>
        {cd.length > 0 && <div className="codes">{cd.map((x) => <i key={x} className={u[x] ? 'dup' : ''}>{x}</i>)}</div>}
        {cd.filter((x) => u[x]).map((x) => <div key={x} className="warn">Code {x} is also selected by {u[x].join(', ')}</div>)}
        {owner && <div className="price"><div><span>Package</span><b>{m(c.pkg)}</b></div><div><span>Paid</span><b>{m(c.paid)}</b></div><div><span>Balance</span><b>{m(b)}</b></div></div>}
        {c.deliverBy && <div className="row"><span>Deliver by</span><b style={{ color: isLate(c) ? '#c62f3d' : undefined }}>{fd(c.deliverBy)}{isLate(c) ? ' (late)' : ''}</b></div>}
        {owner && c.payBy && <div className="row"><span>Pay by</span><b style={{ color: b > 0 && c.payBy < today() ? '#c62f3d' : undefined }}>{fd(c.payBy)}</b></div>}
        {owner && b < 0 && !END.includes(c.status) && <div className="warn">Overpaid by {m(-b)}. Check the price, or refund the difference.</div>}
        <div className="act">
          <a className={ph ? '' : 'off'} href={'tel:' + ph}>Call</a>
          <a className={ph ? '' : 'off'} href={'https://wa.me/' + wan(c.phone)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </div>
        {owner && (
          <>
            <div className="lab">Payments</div>
            {c.pay.map((x) => <div key={x.id} className="row"><span>{dd(x.d)} · {x.m}</span><b>{m(x.amt)}</b></div>)}
            {!c.pay.length && <div className="sub">No payments recorded yet.</div>}
            <div className="act"><button className="btn o" onClick={onPay}>Record payment</button><button className="btn" onClick={async () => {
          const r = await supabase.rpc('invoice_number', { p_client: c.id })
          if (r.error) { say(r.error.message); return }
          exportInvoice(c, r.data).catch(() => say('The PDF tool could not load. Check your internet connection and try again.'))
        }}>Invoice</button></div>
          </>
        )}
        <div className="lab">Photo delivery</div>
        <input placeholder="Paste gallery link (Drive, Pixieset…)" value={g} onChange={(e) => setG(e.target.value)} />
        <div className="act">
          <button className="btn" onClick={async () => { const v = g.trim(); const r = await submit({ k: 'patch', id: c.id, name: c.name, base: c.ver, p: { gallery_url: v || null }, local: { gallery: v } }); if (r.error) say(r.error) }}>Save link</button>
          <button className="btn" onClick={() => navigator.clipboard?.writeText(g).catch(() => say("Could not copy. Select the link and copy it by hand."))}>Copy</button>
          <a className={g && ph ? '' : 'off'} href={'https://wa.me/' + wan(c.phone) + '?text=' + msg} target="_blank" rel="noopener noreferrer">Send</a>
        </div>
        {nx && <button className="btn o" onClick={onNext}>{END.includes(c.status) ? 'Reopen as ' + nx : 'Move to ' + nx}</button>}
        {c.status === 'Booked' && (
          <div className="act">
            <button className="btn" onClick={() => setEnd('Cancelled')}>Mark cancelled</button>
            <button className="btn" onClick={() => setEnd('No-show')}>Mark no-show</button>
          </div>
        )}
        <div className="act"><button className="btn" onClick={onEdit}>Edit</button>{owner && <button className="btn" onClick={onDelete}>Archive</button>}</div>
        {isAdmin && <button className="btn d" style={{ width: '100%', marginTop: 8 }} onClick={onPurge}>Delete permanently</button>}
      </div>
    </>
  )
}

export function AsgRow({ c, who }) {
  const a = c.assign
  if (a.length) return <div className="row"><span>Assigned</span><b>{a.map((x) => who(x)).join(', ')}</b></div>
  return c.date >= today() ? <div className="row"><span>Assigned</span><b style={{ color: 'var(--warn)' }}>Unassigned</b></div> : null
}
