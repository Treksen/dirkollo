import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { OFFLINE } from './data'

// Settings > Account: a private link that puts your sessions in your phone's own calendar
export function CalendarSync({ X }) {
  const { say, ask, closeSheet } = X
  const [token, setToken] = useState(undefined)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let dead = false
    supabase.rpc('calendar_token_get').then(({ data, error }) => { if (!dead) setToken(error ? null : data || null) }, () => { if (!dead) setToken(null) })
    return () => { dead = true }
  }, [])
  const link = token ? location.origin + '/api/calendar?token=' + token : ''
  async function make() {
    if (!navigator.onLine) { say(OFFLINE); return }
    setBusy(true)
    const { data, error } = await supabase.rpc('calendar_token_rotate')
    setBusy(false)
    if (error) say(error.message + ' (Run supabase/calendar-update.sql first.)'); else setToken(data)
  }
  const replace = () => ask('Make a new link? The old link stops working, so you must add the new one to your calendar again.', 'Make new link', async () => { closeSheet(); await make() })
  const turnOff = () => ask('Turn off calendar sync? The link stops working and your calendar app will stop showing sessions.', 'Turn off', async () => {
    closeSheet()
    const { error } = await supabase.rpc('calendar_token_delete')
    if (error) say(error.message); else setToken(null)
  }, 1)
  const copy = () => navigator.clipboard?.writeText(link).then(() => say('Link copied.'), () => say('Could not copy. Select the link and copy it by hand.'))
  return (
    <div className="card srow">
      <div className="sl"><div className="lab">Phone calendar</div><div className="sub">Show your sessions in the calendar app on your phone, with its normal alarms. It shows names, places and times only, never phone numbers or money.</div></div>
      <div className="sc">
        {token === undefined && <div className="sub">Checking…</div>}
        {token === null && <button className="btn p" disabled={busy} onClick={make}>{busy ? 'Working…' : 'Create my calendar link'}</button>}
        {token && (
          <>
            <label>Your private link (anyone with it can see your sessions, so do not share it)</label>
            <input readOnly value={link} onFocus={(e) => e.target.select()} />
            <div className="act" style={{ marginTop: 8 }}>
              <button className="btn p" onClick={copy}>Copy link</button>
              <a className="btn" href={'webcal://' + location.host + '/api/calendar?token=' + token}>Open in calendar (iPhone, Mac)</a>
            </div>
            <ul style={{ margin: '10px 0 0', paddingLeft: 20, lineHeight: 1.55 }} className="sub">
              <li><b>Android or Google Calendar:</b> on a computer open Google Calendar, then Settings, then Add calendar, then From URL, and paste the link.</li>
              <li><b>iPhone:</b> tap "Open in calendar" and confirm Subscribe.</li>
              <li>Google can take many hours to refresh a subscribed calendar. The app itself is always up to date.</li>
            </ul>
            <div className="act" style={{ marginTop: 8 }}><button className="btn" onClick={replace}>Make a new link</button><button className="btn" onClick={turnOff}>Turn off</button></div>
          </>
        )}
      </div>
    </div>
  )
}
