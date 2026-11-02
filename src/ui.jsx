import { useState, useEffect } from 'react'
import { Captcha, CAPTCHA_KEY } from './captcha'
import { supabase } from './supabase'
import { STUDIO as DEF, wan, igHandle, passwordCheck, PW_LABELS, PW_MIN } from './lib'

// Live password feedback: strength bar plus exactly what to fix
export function PasswordHint({ pw, email, name }) {
  if (!pw) return <div className="sub" style={{ marginTop: 6 }}>Use at least {PW_MIN} characters.</div>
  const r = passwordCheck(pw, { email, name })
  return (
    <div style={{ marginTop: 6 }} aria-live="polite">
      <div className="pwm" aria-hidden="true"><i className={'s' + r.score} style={{ width: Math.max(8, r.score * 25) + '%' }}></i></div>
      <div className="sub" style={{ marginTop: 4 }}><b>{PW_LABELS[r.score]}</b>{r.problems.length ? ': ' + r.problems.join('. ') + '.' : ''}</div>
    </div>
  )
}

export function Brand() {
  return (
    <div className="brand">
      <svg width="50" height="50" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="#f59a1f" /><rect x="14" y="22" width="36" height="26" rx="5" fill="#4b22b0" /><rect x="21" y="17" width="12" height="7" rx="2" fill="#4b22b0" /><rect x="40" y="25" width="6" height="3" rx="1.5" fill="#f59a1f" /><circle cx="32" cy="36" r="9" fill="#fff" /><circle cx="32" cy="36" r="5.5" fill="#4b22b0" /><circle cx="30" cy="34" r="1.6" fill="#fff" /></svg>
      <div className="bt"><b>Director Kollo</b><div className="bp"><i></i><span>Studios</span></div></div>
    </div>
  )
}

function StudioSummary({ S }) {
  const K = S.contact || {}
  const ph = K.phone ? wan(K.phone) : ''
  const wa = ph ? 'https://wa.me/' + ph + '?text=' + encodeURIComponent('Hello ' + S.name + ', I would like to book a session.') : ''
  const ig = igHandle(K.instagram)
  const gal = Array.isArray(S.gallery) ? S.gallery : []
  const ct = [
    K.phone && <a key="p" href={'tel:' + String(K.phone).replace(/[^\d+]/g, '')}>Call</a>,
    wa && <a key="w" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>,
    K.email && <a key="e" href={'mailto:' + K.email}>Mail</a>,
    K.location && <span key="l">{K.location}</span>,
    K.hours && <span key="h">{K.hours}</span>,
    ig && <a key="i" href={'https://instagram.com/' + ig} target="_blank" rel="noopener noreferrer">@{ig}</a>,
  ].filter(Boolean)
  return (
    <div className="lgdet">
      <div className="lgh">What we photograph</div>
      <div className="lgchips">{S.services.map((x) => <span key={x[1]}>{x[0]} {x[1]}</span>)}</div>
      <div className="lgh">Our work</div>
      <div className="lggal">
        {gal.length
          ? gal.map((g) => <img key={g.url} src={g.url} alt="Photo by the studio" loading="lazy" decoding="async" />)
          : S.services.slice(0, 6).map((x) => <div key={x[1]} className="ph-tile"><span aria-hidden="true">{x[0]}</span><b>{x[1]}</b></div>)}
      </div>
      <div className="lgh">How it works</div>
      <ol className="lgsteps">{S.steps.map((x) => <li key={x[0]}><b>{x[0]}</b><span>{x[1]}</span></li>)}</ol>
      <div className="lgh">About</div>
      <p className="lgabout">{S.about}</p>
      {ct.length > 0 && (<><div className="lgh">Contact</div><div className="lgct">{ct}</div></>)}
    </div>
  )
}

// Landing page + sign in / create account. Original design kept.
export function Landing({ pending, onOut }) {
  const [S, setS] = useState(DEF)
  useEffect(() => {
    supabase.from('studio_settings').select('data').eq('id', 1).maybeSingle().then(({ data }) => {
      const d = data?.data
      if (d && Object.keys(d).length) setS({ ...DEF, ...d, contact: { ...DEF.contact, ...(d.contact || {}) } })
    })
  }, [])
  const [up, setUp] = useState(false)
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [ctoken, setCtoken] = useState('')
  const [ckey, setCkey] = useState(0)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit() {
    setMsg(''); setBusy(true)
    if (!f.email || !f.password || (up && !f.name.trim())) {
      setMsg(up ? 'Enter your name, an email and a password.' : 'Enter your email and password.'); setBusy(false); return
    }
    if (up) {
      const pc = passwordCheck(f.password, { email: f.email, name: f.name })
      if (!pc.ok) { setMsg('Choose a stronger password: ' + pc.problems.join('. ') + '.'); setBusy(false); return }
    }
    if (CAPTCHA_KEY && !ctoken) { setMsg('Please complete the check below first.'); setBusy(false); return }
    const captchaToken = ctoken || undefined
    const { error } = up
      ? await supabase.auth.signUp({ email: f.email, password: f.password, options: { data: { name: f.name.trim() }, captchaToken } })
      : await supabase.auth.signInWithPassword({ email: f.email, password: f.password, options: { captchaToken } })
    setCkey((k) => k + 1) // a captcha answer works only once
    if (error) setMsg(error.message)
    else if (up) setMsg('Account created. If we sent a confirmation email, open it, then sign in.')
    else if (!passwordCheck(f.password, { email: f.email }).ok) { try { localStorage.setItem('dk_weakpw', '1') } catch { /* storage blocked */ } }
    setBusy(false)
  }
  async function forgot() {
    if (!f.email) { setMsg('Type your email first, then tap Forgot password.'); return }
    if (CAPTCHA_KEY && !ctoken) { setMsg('Please complete the check below first.'); return }
    const { error } = await supabase.auth.resetPasswordForEmail(f.email, { redirectTo: location.origin, captchaToken: ctoken || undefined })
    setCkey((k) => k + 1)
    setMsg(error ? error.message : 'Reset link sent. Check your email.')
  }

  return (
    <div id="lg" className="show">
      <div className="lgwrap">
        <div className="lgside">
          <div className="lghead">
            <Brand />
            <small className="kick">{S.kicker}</small>
            <h2>{S.headline}</h2>
            <p className="tag">{S.sub}</p>
          </div>
          <StudioSummary S={S} />
        </div>
        <div className="lgmain">
          {pending ? (
            <>
              <h1>Waiting for approval</h1>
              <div className="card">
                <p style={{ lineHeight: 1.55 }}>
                  Your account is created. Wait for Activation.
                </p>
                <button
                  className="btn p"
                  style={{ width: "100%", marginTop: 14 }}
                  onClick={onOut}
                >
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 style={{ textAlign: "center" }}>
                {up ? "Create your account" : "Sign in"}
              </h1>
              <div
                className="card"
                onKeyDown={(e) => e.key === "Enter" && submit()}
              >
                {up && (
                  <>
                    <label>Your name</label>
                    <input
                      value={f.name}
                      onChange={set("name")}
                      autoComplete="name"
                    />
                  </>
                )}
                <label>Email</label>
                <input
                  type="email"
                  value={f.email}
                  onChange={set("email")}
                  autoComplete="username"
                  placeholder="you@gmail.com"
                />
                <label>Password</label>
                <input
                  type="password"
                  value={f.password}
                  onChange={set("password")}
                  autoComplete={up ? "new-password" : "current-password"}
                  placeholder={up ? "At least " + PW_MIN + " characters" : ""}
                />
                {up && (
                  <PasswordHint pw={f.password} email={f.email} name={f.name} />
                )}
                <Captcha onToken={setCtoken} resetKey={ckey} />
                {msg && (
                  <div className="warn" style={{ marginTop: 10 }}>
                    {msg}
                  </div>
                )}
                <button
                  className="btn p"
                  disabled={busy}
                  style={{ marginTop: 14, width: "100%" }}
                  onClick={submit}
                >
                  {up ? "Create account" : "Sign in"}
                </button>
                {!up && (
                  <button
                    className="chip"
                    style={{ marginTop: 10 }}
                    onClick={forgot}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <button
                className="chip"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setUp(!up);
                  setMsg("");
                }}
              >
                {up ? "I already have an account" : "Create an account"}
              </button>
              {/* <p className="sub" style={{ marginTop: 14 }}>The first account created becomes the Admin. Everyone else waits for the Admin to approve them.</p> */}
            </>
          )}
          <p className="lgfoot">
            © {new Date().getFullYear()} {S.name}
          </p>
        </div>
      </div>
    </div>
  );
}

// Shown after someone opens a password-reset email link
export function NewPassword({ onDone, email }) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  async function save() {
    const pc = passwordCheck(a, { email })
    if (!pc.ok) { setMsg('Choose a stronger password: ' + pc.problems.join('. ') + '.'); return }
    if (a !== b) { setMsg('The two passwords do not match.'); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: a })
    setBusy(false)
    if (error) setMsg(error.message); else onDone()
  }
  return (
    <div id="lg" className="show"><div className="lgwrap"><div className="lgmain">
      <h1>Choose a new password</h1>
      <div className="card" onKeyDown={(e) => e.key === 'Enter' && save()}>
        <label>New password</label><input type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} />
        <PasswordHint pw={a} email={email} />
        <label>Repeat new password</label><input type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />
        {msg && <div className="warn" style={{ marginTop: 10 }}>{msg}</div>}
        <button className="btn p" disabled={busy} style={{ marginTop: 14, width: '100%' }} onClick={save}>Save password</button>
      </div>
    </div></div></div>
  )
}
