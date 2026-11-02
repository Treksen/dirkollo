import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const fix = (m) => (/disabled|not enabled|not allowed/i.test(m || '') ? 'Two-step sign-in is switched off in your Supabase project. In the Supabase dashboard, open Authentication and turn on MFA (TOTP).' : m)

// Scan a QR code with an authenticator app, then type the 6-digit code to finish
export function MfaEnroll({ onDone, onCancel }) {
  const [step, setStep] = useState({ loading: true })
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let dead = false
    ;(async () => {
      // remove half-finished set-ups first, otherwise they block a new one
      const { data: l } = await supabase.auth.mfa.listFactors()
      for (const f of (l && l.all) || []) if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator ' + Date.now() })
      if (dead) return
      if (error) setStep({ error: fix(error.message) }); else setStep({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    })()
    return () => { dead = true }
  }, [])
  async function confirm() {
    setBusy(true); setErr('')
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: step.id, code: code.replace(/\s/g, '') })
    setBusy(false)
    if (error) setErr('That code did not work. Check the 6 digits, and that the time on your phone is automatic.'); else onDone()
  }
  async function cancel() { if (step.id) await supabase.auth.mfa.unenroll({ factorId: step.id }); if (onCancel) onCancel() }
  if (step.loading) return <div className="sub">Preparing…</div>
  if (step.error) return <><div className="warn">{step.error}</div>{onCancel && <button className="btn" style={{ marginTop: 10 }} onClick={onCancel}>Close</button>}</>
  return (
    <>
      <ol style={{ margin: '0 0 10px', paddingLeft: 20, lineHeight: 1.6 }}>
        <li>Install an authenticator app (Google Authenticator, Microsoft Authenticator or similar).</li>
        <li>Scan this code with it.</li>
        <li>Type the 6-digit number it shows.</li>
      </ol>
      <img src={step.qr} alt="QR code to scan with your authenticator app" width="180" height="180" style={{ background: '#fff', padding: 8, borderRadius: 8 }} />
      <div className="sub" style={{ marginTop: 6, wordBreak: 'break-all' }}>Cannot scan? Type this key into the app: <b>{step.secret}</b></div>
      <label>6-digit code</label>
      <input inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirm()} />
      {err && <div className="warn" style={{ marginTop: 8 }}>{err}</div>}
      <div className="act" style={{ marginTop: 10 }}>
        {onCancel && <button className="btn" onClick={cancel}>Cancel</button>}
        <button className="btn p" disabled={busy || code.replace(/\s/g, '').length < 6} onClick={confirm}>{busy ? 'Checking…' : 'Turn on'}</button>
      </div>
    </>
  )
}

// Settings > Account
export function MfaCard({ X }) {
  const { say, ask, closeSheet } = X
  const [state, setState] = useState('loading')
  const [fid, setFid] = useState(null)
  const refresh = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors()
    const f = data && data.totp && data.totp[0]
    setFid(f ? f.id : null)
    setState(error ? 'unknown' : f ? 'on' : 'off')
  }
  useEffect(() => { refresh() }, [])
  const turnOff = () => ask('Turn off two-step sign-in? Your account will only be protected by its password.', 'Turn off', async () => {
    closeSheet()
    const { error } = await supabase.auth.mfa.unenroll({ factorId: fid })
    if (error) say(error.message); else refresh()
  }, 1)
  return (
    <div className="card srow">
      <div className="sl"><div className="lab">Two-step sign-in</div><div className="sub">A code from your phone's authenticator app, as well as your password. It protects the account even if the password is stolen.</div></div>
      <div className="sc">
        {state === 'loading' && <div className="sub">Checking…</div>}
        {state === 'unknown' && <div className="sub">Could not check. Connect to the internet and open this page again.</div>}
        {state === 'off' && <><div className="sub">Off.</div><button className="btn p" style={{ marginTop: 8 }} onClick={() => setState('enroll')}>Set up</button></>}
        {state === 'on' && <><div className="warn" style={{ background: '#e7f7ec', color: '#14532d' }}>On.</div><button className="btn" style={{ marginTop: 8 }} onClick={turnOff}>Turn off</button></>}
        {state === 'enroll' && <MfaEnroll onDone={() => { refresh(); say('Two-step sign-in is on. Next time you sign in you will be asked for a code.') }} onCancel={refresh} />}
      </div>
    </div>
  )
}

// After the password: the code from the authenticator app
export function MfaChallenge({ onDone }) {
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  async function go() {
    setBusy(true); setMsg('')
    const { data: l } = await supabase.auth.mfa.listFactors()
    const f = l && l.totp && l.totp[0]
    if (!f) { onDone(); return }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: f.id, code: code.replace(/\s/g, '') })
    setBusy(false)
    if (error) setMsg('That code did not work. Check the 6 digits, and that the time on your phone is automatic.'); else onDone()
  }
  return (
    <div id="lg" className="show"><div className="lgwrap"><div className="lgmain">
      <h1>Two-step sign-in</h1>
      <div className="card" onKeyDown={(e) => e.key === 'Enter' && go()}>
        <p style={{ lineHeight: 1.55 }}>Open your authenticator app and type the 6-digit code.</p>
        <label>Code</label>
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} />
        {msg && <div className="warn" style={{ marginTop: 10 }}>{msg}</div>}
        <button className="btn p" disabled={busy || code.replace(/\s/g, '').length < 6} style={{ marginTop: 14, width: '100%' }} onClick={go}>Continue</button>
        <button className="chip" style={{ marginTop: 10 }} onClick={() => supabase.auth.signOut()}>Use a different account</button>
      </div>
    </div></div></div>
  )
}

// Blocks Admin and Director until two-step sign-in is set up (when the Admin requires it)
export function MfaRequired({ onDone }) {
  return (
    <div id="lg" className="show"><div className="lgwrap"><div className="lgmain">
      <h1>Set up two-step sign-in</h1>
      <div className="card">
        <p style={{ lineHeight: 1.55, marginBottom: 10 }}>Your studio requires two-step sign-in for Admin and Director accounts. Set it up once to continue.</p>
        <MfaEnroll onDone={onDone} />
        <button className="chip" style={{ marginTop: 14 }} onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </div></div></div>
  )
}
