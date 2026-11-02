import { useState } from 'react'
import { supabase } from './supabase'
import { PasswordHint } from './ui'
import { DataTools } from './Admin'
import { useDesktop, SideNav } from './layout'
import { AppInfo } from './appinfo'
import { MfaCard } from './mfa'
import { CalendarSync } from './calsync'
import { deletePackage, saveRules } from './data'
import { m, today, passwordCheck } from './lib'
import { dl, plural } from './util'

export function Account({ X }) {
  const { theme, setTheme, inst, setInst, profile, say, signOut } = X
  const [pw, setPw] = useState('')
  return (
  <>
    <div className="card srow"><div className="sl"><div className="lab">Appearance</div><div className="sub">How the app looks on this device.</div></div>
      <div className="sc"><div className="act">{[['light', 'Light'], ['dark', 'Dark'], ['auto', 'System']].map((a) => <button key={a[0]} className={'btn' + (theme === a[0] ? ' p' : '')} onClick={() => setTheme(a[0])}>{a[1]}</button>)}</div></div></div>
    <div className="card srow"><div className="sl"><div className="lab">Account</div><div className="sub">Signed in as <b>{profile.name}</b> · {dl(profile.role)}</div></div>
      <div className="sc"><label>New password</label><input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 10 characters" />
        <PasswordHint pw={pw} email={profile.email} name={profile.name} />
      <div className="act" style={{ marginTop: 8 }}>
        <button className="btn" onClick={async () => { const pc = passwordCheck(pw, { email: profile.email, name: profile.name }); if (!pc.ok) { say('Choose a stronger password: ' + pc.problems.join('. ') + '.'); return } const { error } = await supabase.auth.updateUser({ password: pw }); setPw(''); say(error ? error.message : 'Password changed.') }}>Change password</button>
        <button className="btn" onClick={signOut}>Sign out</button></div></div></div>
    {inst && <div className="card srow"><div className="sl"><div className="lab">Install app</div><div className="sub">Add it to this device like a normal app.</div></div><div className="sc"><button className="btn o" onClick={() => { inst.prompt(); setInst(null) }}>Install app</button></div></div>}
    <MfaCard X={X} />
    <CalendarSync X={X} />
  </>
  )
}

export function Team({ X }) {
  const { CC, T, owner, isAdmin, myid, say, ask, closeSheet, refresh } = X
  const waiting = T.filter((u) => u.status !== 'active' && u.role === 'staff').length
  const admins = T.filter((u) => u.role === 'admin' && u.status === 'active').length
  return (
  <div className="mason">
    {owner && waiting > 0 && <div className="card span"><div className="warn" role="status">{waiting} new sign-up{waiting === 1 ? ' is' : 's are'} waiting for approval. Tap Approve on {waiting === 1 ? 'their' : 'each'} card below.</div></div>}
    {isAdmin && admins === 1 && <div className="card span"><div className="warn" role="status">You have only one Admin. If that account is ever lost, nobody can change roles. Promote a trusted person to Admin below, and keep supabase/recover-admin.sql somewhere safe.</div></div>}
    {T.map((u) => {
      const me = u.id === myid, up = CC.filter((c) => c.date >= today() && c.assign.includes(u.id)).length
      return (
        <div key={u.id} className="card">
          <div className="row" style={{ alignItems: 'center' }}>
            <div><h3>{me ? 'You' : u.name || '(no name)'}</h3><p className="sub">{[dl(u.role), u.title, u.phone, u.email, up + ' upcoming'].filter(Boolean).join(' · ')}</p></div>
            <span className={'badge ' + (u.status === 'active' ? 'bok' : 'bsus')}>{u.status === 'active' ? 'Active' : 'Pending'}</span>
          </div>
          {!me && (isAdmin || (owner && u.role === 'staff')) && (
            <div className="act">
              {isAdmin && (<select value={u.role} onChange={async (e) => { const { error } = await supabase.from('profiles').update({ role: e.target.value }).eq('id', u.id); error ? say(error.message) : refresh() }}>
                <option value="admin">Admin</option><option value="director">Director</option><option value="staff">Staff</option></select>)}
              <button className="btn" onClick={async () => { const { error } = await supabase.from('profiles').update({ status: u.status === 'active' ? 'suspended' : 'active' }).eq('id', u.id); error ? say(error.message) : refresh() }}>{u.status === 'active' ? 'Suspend' : 'Approve'}</button>
              {isAdmin && <button className="btn" onClick={() => ask('Remove ' + u.name + '? They lose access permanently.' + (up ? ' They are assigned to ' + plural(up, 'upcoming session') + '.' : ''), 'Remove', async () => { const { error } = await supabase.from('profiles').delete().eq('id', u.id); closeSheet(); error ? say(error.message) : refresh() }, 1)}>Remove</button>}
            </div>
          )}
        </div>
      )
    })}
    {isAdmin && <div className="card"><div className="lab">Access</div><div className="sub">People create their own accounts and wait here as pending staff. Set their role, then activate them. Staff see clients, calendar and photo selections only. Payments, reports and pricing stay with the Director and Admin.</div></div>}
  </div>
  )
}

export function Pkgs({ X }) {
  const { P, R, setSheet, ask, run, closeSheet } = X
  return (
  <>
    <button className="btn p" style={{ width: '100%', marginBottom: 10 }} onClick={() => setSheet({ t: 'pk' })}>+ New package</button>
    <div className="mason">
    {P.map((p) => (
      <div key={p.id} className="card">
        <div className="head"><div><h3>{p.name}</h3><p>{p.inc}</p></div><b style={{ color: 'var(--pur)', font: '600 18px Fredoka,sans-serif' }}>{m(p.price)}</b></div>
        <div className="row" style={{ alignItems: 'center' }}><span>{p.photos} edited photos included</span>
          <span><button className="chip" onClick={() => setSheet({ t: 'pk', p })}>Edit</button> <button className="chip" onClick={() => ask('Delete the ' + p.name + ' package?', 'Delete', async () => { closeSheet(); await run(() => deletePackage(p.id)) }, 1)}>Delete</button></span></div>
      </div>
    ))}
    <div className="card"><div className="lab">Pricing rules</div><div className="sub">Applied automatically when you add a client. You can still change the final price by hand.</div>
      <RuleInputs R={R} onSave={(r) => run(() => saveRules(r))} /></div>
    </div>
  </>
  )
}

export function SettingsPg({ X }) {
  const { owner, isAdmin, sg, setSg, CC, AA, T, say, ask, run, reload, closeSheet } = X
  const desk = useDesktop()
  // The Director gets Data tools here; the Admin already has them in the Admin tab.
  const items = [
    ['ac', 'Account'],
    ...(owner ? [['tm', 'Team'], ['pk', 'Packages and pricing']] : []),
    ...(owner && !isAdmin ? [['dt', 'Data tools']] : []),
    ['ap', 'App'],
  ]
  let body
  if (sg === 'ap') body = <AppInfo X={X} />
  else if (!owner || sg === 'ac') body = <Account X={X} />
  else if (sg === 'tm') body = <Team X={X} />
  else if (sg === 'dt' && !isAdmin) body = <DataTools C={CC} A={AA} T={T} isAdmin={false} say={say} ask={ask} run={run} reload={reload} closeSheet={closeSheet} />
  else body = <Pkgs X={X} />
  if (desk) return <div className="shell2"><SideNav items={items} value={sg} onChange={setSg} label="Settings sections" /><div className="spane">{body}</div></div>
  return (
    <>
      <div className="pipe">{items.map((a) => <button key={a[0]} className={sg === a[0] ? 'on' : ''} onClick={() => setSg(a[0])}>{a[1]}</button>)}</div>
      {body}
    </>
  )
}

export function RuleInputs({ R, onSave }) {
  const [r, setR] = useState({ extra: R.extra, weekend: R.weekend, disc: R.disc })
  const set = (k) => (e) => setR({ ...r, [k]: +e.target.value || 0 })
  return (
    <>
      <label>Extra photo price (beyond the package)</label><input type="number" inputMode="decimal" value={r.extra} onChange={set('extra')} onBlur={() => onSave(r)} />
      <div className="g2">
        <div><label>Weekend surcharge %</label><input type="number" inputMode="decimal" value={r.weekend} onChange={set('weekend')} onBlur={() => onSave(r)} /></div>
        <div><label>Standard discount %</label><input type="number" inputMode="decimal" value={r.disc} onChange={set('disc')} onBlur={() => onSave(r)} /></div>
      </div>
    </>
  )
}
