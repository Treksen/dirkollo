// Pure logic for offline changes (no database imports, so it can be unit-tested).
export const isNetErr = (m) => !navigator.onLine || /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|timed out/i.test(String(m || ''))

export const sortClients = (a) => a.sort((x, y) => (x.date === y.date ? (x.name < y.name ? -1 : 1) : x.date < y.date ? 1 : -1))

export const blankClient = (id) => ({
  id, name: '', phone: '', eventType: 'Other', date: '', time: '', hrs: 2, loc: '', services: '', status: 'Booked', codes: [],
  gallery: '', archived: false, assign: [], pk: '', pkg: 0, payBy: '', deliverBy: '', statusAt: '', pay: [], paid: 0, ver: null,
})

const addPay = (c, e) => {
  const pay = [...c.pay.filter((x) => x.id !== e.id), e]
  return { ...c, pay, paid: pay.reduce((s, x) => s + x.amt, 0) }
}

// Show a queued change on screen straight away, before the server has it.
export function applyOp(c, op) {
  const base = c || blankClient(op.id)
  if (op.k === 'pay') return addPay(base, op.local)
  let r = { ...base, ...op.local }
  if (op.local && op.local.status && op.local.status !== base.status) r.statusAt = new Date(op.at || Date.now()).toISOString()
  if (op.k === 'save' && op.pay) r = addPay(r, { id: op.pay.id, d: op.pay.paid_on, amt: +op.pay.amount, m: op.pay.method, note: op.pay.note || '' })
  return r
}

// A client row with all of its not-yet-sent changes laid on top (failed changes are left out: the server copy is the truth).
export function pendingRow(row, id, ops) {
  const mine = ops.filter((o) => o.id === id && !o.failed)
  if (!mine.length) return row
  if (!row && !mine.some((o) => o.k === 'save')) return null
  return mine.reduce((r, o) => applyOp(r, o), row)
}

export function applyAllPending(C, ops) {
  const ids = new Set(ops.filter((o) => !o.failed).map((o) => o.id))
  if (!ids.size) return C
  const map = new Map(C.map((c) => [c.id, c]))
  ids.forEach((id) => { const r = pendingRow(map.get(id) || null, id, ops); if (r) map.set(id, r) })
  return sortClients([...map.values()])
}
