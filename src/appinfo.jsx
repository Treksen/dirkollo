import { useState } from 'react'
import { checkForUpdate, applyUpdate } from './updater'
import { APP_VERSION, BUILD_TIME } from './version'
import { CHANGELOG, newerEntries } from './changelog'
import { plural } from './util'

const when = (x) => { try { return new Date(x).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
const Notes = ({ list }) => list.map((e) => (
  <div key={e.v} style={{ marginBottom: 10 }}>
    <b>Version {e.v}</b> <span className="sub">{e.date}</span>
    <ul style={{ margin: '4px 0 0', paddingLeft: 20, lineHeight: 1.5 }}>{e.items.map((t) => <li key={t}>{t}</li>)}</ul>
  </div>
))

// Settings > App: version, check for updates, update now, what changed
export function AppInfo({ X }) {
  const { upd, waitingCount, isAdmin} = X;
  const [msg, setMsg] = useState('')
  async function check() {
    setMsg('')
    const r = await checkForUpdate()
    if (r.offline) setMsg('You are offline. Connect to the internet, then check again.')
    else if (r.error) setMsg('Could not check for updates: ' + r.error)
    else if (!r.needRefresh) setMsg('You are on the latest version.')
  }
  return (
    <>
      <div className="card srow">
        <div className="sl">
          <div className="lab">This app</div>
          <div className="sub">The version running on this device.</div>
        </div>
        <div className="sc">
          <div className="row">
            <span>Version</span>
            <b>{APP_VERSION}</b>
          </div>
          {BUILD_TIME && (
            <div className="row">
              <span>Built</span>
              <b>{when(BUILD_TIME)}</b>
            </div>
          )}
        </div>
      </div>
      <div className="card srow">
        <div className="sl">
          <div className="lab">Updates</div>
          <div className="sub">
            New versions download quietly. Update when it suits you.
          </div>
        </div>
        <div className="sc">
          {upd.needRefresh ? (
            <div
              className="warn"
              style={{ background: "#e7f7ec", color: "#14532d" }}
            >
              A new version is ready.
            </div>
          ) : (
            <div className="sub">
              {upd.checking
                ? "Checking…"
                : upd.lastChecked
                  ? "Last checked " + when(upd.lastChecked)
                  : "Not checked yet in this session."}
            </div>
          )}
          {msg && (
            <div className="sub" style={{ marginTop: 6 }}>
              {msg}
            </div>
          )}
          {waitingCount > 0 && (
            <div className="sub" style={{ marginTop: 6 }}>
              You have {plural(waitingCount, "change")} waiting to send. They
              are kept safely on this phone and send after the update.
            </div>
          )}
          <div className="act" style={{ marginTop: 10 }}>
            <button className="btn" disabled={upd.checking} onClick={check}>
              {upd.checking ? "Checking…" : "Check for updates"}
            </button>
            {upd.needRefresh && (
              <button className="btn p" onClick={applyUpdate}>
                Update now
              </button>
            )}
          </div>
        </div>
      </div>
      {isAdmin && (
        <div className="card srow">
          <div className="sl">
            <div className="lab">What's new</div>
            <div className="sub">Recent changes.</div>
          </div>
          <div className="sc">
            <Notes list={CHANGELOG.slice(0, 3)} />
          </div>
        </div>
      )}
    </>
  );
}

// Shown once after the app has been updated
export function WhatsNew({ since, onClose }) {
  const list = newerEntries(since, APP_VERSION)
  return (
    <>
      <h2>What's new</h2>
      <div style={{ marginTop: 8 }}><Notes list={list} /></div>
      <button className="btn p" style={{ width: '100%', marginTop: 12 }} onClick={onClose}>Got it</button>
    </>
  )
}

// Replaces the whole app when the Admin has set a minimum version and this copy is older
export function UpdateRequired({ min, upd }) {
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  async function go() {
    setMsg('')
    if (upd.needRefresh) { applyUpdate(); return }
    setBusy(true)
    const r = await checkForUpdate()
    setBusy(false)
    if (r.needRefresh) applyUpdate()
    else setMsg('The new version has not reached this device yet. Wait a minute and try again, or close and reopen the app.')
  }
  return (
    <div id="lg" className="show"><div className="lgwrap"><div className="lgmain">
      <h1>Update required</h1>
      <div className="card">
        <p style={{ lineHeight: 1.55 }}>This copy of the app is out of date and can no longer be used. Update it to continue. Changes waiting to send are kept safely and will send after the update.</p>
        <p className="sub" style={{ marginTop: 8 }}>You have version {APP_VERSION}. Version {min} or newer is required.</p>
        {msg && <div className="warn" style={{ marginTop: 10 }}>{msg}</div>}
        <button className="btn p" disabled={busy} style={{ width: '100%', marginTop: 14 }} onClick={go}>{busy ? 'Checking…' : 'Update now'}</button>
      </div>
    </div></div></div>
  )
}
