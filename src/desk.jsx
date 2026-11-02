import { useState } from 'react'
import { ST, m, fd, kfmt, off, today, isDate, bal, reminders, isOverdue, daysSince, ALL_ST, END, isLate, isStuck, isBehind, stuckDays } from './lib'
import { plural } from './util'

const clk = (fn) => ({ tabIndex: 0, onClick: fn, onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fn()) })
const Badge = ({ s }) => <span className={'sb ' + s}>{s}</span>

/* ============ CLIENTS: sortable table + details panel ============ */
export function ClientsDesk({ X, selId, panel }) {
  const { CC, owner, myid, who, q, setQ, flt, setFlt, select } = X
  const [sort, setSort] = useState({ k: 'date', d: -1 })
  const k = q.toLowerCase()
  const rows = CC.filter((c) => (flt === 'All' || (flt === 'Mine' ? c.assign.includes(myid) : flt === 'Unassigned' ? !c.assign.length : flt === 'Behind' ? isBehind(c) : flt === 'Overdue' ? isOverdue(c) : flt === 'No date' ? !c.date : c.status === flt)) &&
    (!k || [c.name, c.phone, c.eventType, ...c.codes].join(' ').toLowerCase().includes(k)))
  const val = {
    name: (c) => c.name.toLowerCase(), date: (c) => c.date + ' ' + (c.time || ''), event: (c) => c.eventType, status: (c) => ALL_ST.indexOf(c.status),
    assigned: (c) => c.assign.map(who).join(',').toLowerCase(), photos: (c) => c.codes.length, balance: (c) => bal(c),
  }
  const sorted = [...rows].sort((a, b) => { const x = val[sort.k](a), y = val[sort.k](b); return (x < y ? -1 : x > y ? 1 : 0) * sort.d })
  const Th = ({ id, children }) => (
    <th aria-sort={sort.k === id ? (sort.d > 0 ? 'ascending' : 'descending') : 'none'}>
      <button className="thb" onClick={() => setSort((s) => (s.k === id ? { k: id, d: -s.d } : { k: id, d: 1 }))}>{children}{sort.k === id ? (sort.d > 0 ? ' ▲' : ' ▼') : ''}</button>
    </th>
  )
  return (
    <div className="cd">
      <div>
        <input aria-label="Search clients" placeholder="Search name, phone or photo code" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="pipe">{['All', 'Mine', 'Behind', 'No date', ...(owner ? ['Unassigned'] : []), ...ST, ...END].map((s) => <button key={s} className={flt === s ? 'on' : ''} onClick={() => setFlt(s)}>{s}</button>)}</div>
        <div className="sub" style={{ margin: '0 0 8px' }}>{plural(sorted.length, 'client')}</div>
        {sorted.length > 0 ? (
          <div className="card dtw">
            <table className="dt">
              <thead><tr><Th id="name">Client</Th><Th id="date">Date</Th><Th id="event">Event</Th><Th id="status">Status</Th><Th id="assigned">Assigned</Th><Th id="photos">Photos</Th>{owner && <Th id="balance">Balance</Th>}</tr></thead>
              <tbody>
                {sorted.map((c) => (
                  <tr key={c.id} className={(c.id === selId ? 'sel' : '') + (isBehind(c) ? ' od' : '')} aria-selected={c.id === selId} {...clk(() => select(c.id))}>
                    <td><b>{c.name}</b>{c.pending && <small className="pendtxt"> Not synced</small>}<div className="sub">{c.phone}</div></td>
                    <td>{fd(c.date)}<div className="sub">{c.time}</div>{isOverdue(c) && <div className="odtxt">Overdue {daysSince(c.date)}d</div>}</td>
                    <td>{c.eventType}</td>
                    <td><Badge s={c.status} />{isOverdue(c) && <> <span className="sb Overdue">Overdue</span></>}{isLate(c) && <> <span className="sb Overdue">Late</span></>}{isStuck(c) && <> <span className="sb Unassigned">{stuckDays(c)}d in stage</span></>}</td>
                    <td>{c.assign.length ? c.assign.map(who).join(', ') : <span className="sub">Unassigned</span>}</td>
                    <td>{c.codes.length}</td>
                    {owner && <td>{m(bal(c))}{bal(c) < 0 && !END.includes(c.status) && <> <span className="sb Unassigned">Overpaid</span></>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">{CC.length ? 'No matching clients.' : <>No clients yet.<br />Use Add client to create the first one.</>}</div>}
      </div>
      <aside className="cside" aria-label="Client details">
        {panel || <div className="card"><div className="empty" style={{ padding: '30px 10px' }}>Select a client to see their details here.</div></div>}
      </aside>
    </div>
  )
}

/* ============ HOME: denser dashboard ============ */
const Panel = ({ title, children, action }) => (
  <section className="dpan"><div className="dph"><h3>{title}</h3>{action}</div>{children}</section>
)

export function HomeDesk({ X }) {
  const { CC, AA, T, owner, myid, go, setFlt } = X
  const t = today(), ym = t.slice(0, 7)
  const pd = new Date(); pd.setDate(1); pd.setMonth(pd.getMonth() - 1)
  const lm = pd.getFullYear() + '-' + String(pd.getMonth() + 1).padStart(2, '0')
  const vis = CC.filter((c) => owner || c.assign.includes(myid))
  const pays = []
  ;[...CC, ...AA].forEach((c) => c.pay.forEach((x) => { if (isDate(x.d)) pays.push({ ...x, n: c.name, id: c.id }) }))
  const inc = (key) => pays.filter((x) => String(x.d).slice(0, 7) === key).reduce((s, x) => s + (+x.amt || 0), 0)
  const a = inc(ym), b = inc(lm), dlt = b ? Math.round((a - b) / b * 100) : null
  const unpaid = CC.filter((c) => bal(c) > 0).sort((x, y) => bal(y) - bal(x))
  const out = unpaid.reduce((s, c) => s + bal(c), 0)
  const archOwed = AA.reduce((s, c) => s + Math.max(0, bal(c)), 0)
  const sm = vis.filter((c) => (c.date || '').startsWith(ym)), ph = sm.reduce((s, c) => s + c.codes.length, 0)
  const next7 = vis.filter((c) => c.date >= t && c.date <= off(7)).sort((x, y) => ((x.date + (x.time || '99')) < (y.date + (y.time || '99')) ? -1 : 1))
  const unas = owner ? CC.filter((c) => !END.includes(c.status) && c.date >= t && c.date <= off(7) && !c.assign.length).length : 0
  const rm = reminders(CC, owner, myid)
  const od = vis.filter(isBehind).length
  const n = ST.map((s) => vis.filter((c) => c.status === s).length)
  const mo = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); return { l: d.toLocaleDateString('en-GB', { month: 'short' }), v: inc(key) } })
  const mx = Math.max(1, ...mo.map((x) => x.v))
  const L = T.filter((x) => x.status === 'active').map((x) => ({ ...x, n: CC.filter((c) => !END.includes(c.status) && c.date >= t && c.date <= off(6) && c.assign.includes(x.id)).length }))
  const lx = Math.max(1, ...L.map((x) => x.n))
  const rp = pays.filter((x) => x.d <= t).sort((x, y) => (x.d < y.d ? 1 : -1)).slice(0, 5)
  const open = (id) => go('c', id)
  return (
    <div className="dhome">
      <div className="dtop">
        <span className="sub">
          {new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>
      <div className="kpis">
        {owner ? (
          <>
            <div className="kpi">
              <b>{m(a)}</b>
              <span>Income this month</span>
              {dlt != null && (
                <em className={dlt >= 0 ? "up" : "dn"}>
                  {dlt >= 0 ? "▲ " : "▼ "}
                  {Math.abs(dlt)}% vs last month
                </em>
              )}
            </div>
            <div className="kpi">
              <b>{m(out)}</b>
              <span>Outstanding balance</span>
              <em>
              {plural(unpaid.length, "unpaid client")}
              {archOwed ? " · plus " + m(archOwed) + " owed by archived clients" : ""}
            </em>
            </div>
          </>
        ) : (
          <>
            <div className="kpi">
              <b>{next7.length}</b>
              <span>My sessions, next 7 days</span>
            </div>
            <div className="kpi">
              <b>{vis.filter((c) => c.status === "Selecting").length}</b>
              <span>Waiting for selection</span>
            </div>
          </>
        )}
        <div className="kpi">
          <b>{sm.length}</b>
          <span>Sessions this month</span>
        </div>
        {od ? (
          <div className="kpi clk od" {...clk(() => { setFlt('Behind'); go('c') })}>
            <b>{od}</b>
            <span>Behind schedule</span>
            <em>Open the list</em>
          </div>
        ) : (
        <div className="kpi">
          {owner && unas ? (
            <>
              <b>{unas}</b>
              <span>Need a photographer</span>
            </>
          ) : (
            <>
              <b>{ph}</b>
              <span>Photos selected this month</span>
            </>
          )}
        </div>
        )}
      </div>
      <div className="dgrid">
        <div className="dcol">
          <Panel
            title="Sessions, next 7 days"
            action={
              <button className="chip" onClick={() => go("s")}>
                Calendar
              </button>
            }
          >
            {next7.map((c) => (
              <div key={c.id} className="drow clk" {...clk(() => open(c.id))}>
                <span>
                  <b>{c.date === t ? "Today" : fd(c.date)}</b>
                  {c.time ? ", " + c.time : ""} · {c.name}
                </span>
                <span>
                  {c.assign.length ? (
                    <Badge s={c.status} />
                  ) : (
                    <span className="sb Unassigned">Unassigned</span>
                  )}
                </span>
              </div>
            ))}
            {!next7.length && (
              <div className="sub">No sessions in the next 7 days.</div>
            )}
          </Panel>
          <Panel title="Needs attention">
            {rm.slice(0, 6).map((r, i) => (
              <div key={i} className="drow clk" {...clk(() => open(r.c.id))}>
                <span>
                  <b>{r.c.name}</b> · {r.k}
                </span>
                <Badge s={r.c.status} />
              </div>
            ))}
            {!rm.length && <div className="sub">All caught up.</div>}
          </Panel>
          {owner && (
            <Panel
              title="Largest unpaid balances"
              action={
                <button className="chip" onClick={() => go("m")}>
                  Payments
                </button>
              }
            >
              {unpaid.slice(0, 5).map((c) => (
                <div key={c.id} className="drow clk" {...clk(() => open(c.id))}>
                  <span>
                    {c.name} · {fd(c.date)}
                  </span>
                  <b>{m(bal(c))}</b>
                </div>
              ))}
              {!unpaid.length && <div className="sub">Everything is paid.</div>}
            </Panel>
          )}
        </div>
        <div className="dcol">
          {owner && (
            <Panel title="Income, last 6 months">
              <div className="chart">
                {mo.map((x, i) => (
                  <div key={i} className={i === 5 ? "cur" : ""}>
                    <b>{x.v ? kfmt(x.v) : ""}</b>
                    <i
                      style={{
                        height: Math.max(3, Math.round((x.v / mx) * 80)),
                      }}
                    ></i>
                    <span>{x.l}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          <Panel title="Pipeline">
            {ST.map((s, i) => (
              <div
                key={s}
                className="drow clk"
                {...clk(() => {
                  setFlt(s);
                  go("c");
                })}
              >
                <Badge s={s} />
                <b>{n[i]}</b>
              </div>
            ))}
          </Panel>

          {owner && (
            <Panel title="Team workload, next 7 days">
              {L.map((x) => (
                <div key={x.id}>
                  <div className="drow">
                    <span>{x.id === myid ? "You" : x.name}</span>
                    <b>{plural(x.n, "session")}</b>
                  </div>
                  <div className="bar">
                    <i
                      style={{ width: Math.round((x.n / lx) * 100) + "%" }}
                    ></i>
                  </div>
                </div>
              ))}
            </Panel>
          )}

          {owner && rp.length > 0 && (
            <Panel title="Recent payments">
              {rp.map((x) => (
                <div
                  key={x.id + x.d + x.amt}
                  className="drow clk"
                  {...clk(() => open(x.id))}
                >
                  <span>
                    {x.n} · {x.m} · {fd(x.d)}
                  </span>
                  <b>{m(x.amt)}</b>
                </div>
              ))}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
