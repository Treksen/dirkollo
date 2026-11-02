export const STUDIO = {
  name: "Director Kollo Studios",
  kicker: "Photography studio",
  headline: "Moments worth keeping, photographed with care.",
  sub: "Weddings, portraits, events and more. We plan, shoot and deliver your photos so you can enjoy the day.",
  services: [
    ["💍", "Weddings", "Full-day coverage from preparation to the last dance."],
    ["🖼️", "Portraits", "Studio and outdoor portraits that look like you."],
    ["🎉", "Events", "Birthdays, launches, graduations and celebrations."],
    ["🏢", "Corporate", "Brand, team and event photography for business."],
    [
      "👨‍👩‍👧",
      "Family",
      "Relaxed family sessions to keep the moments that matter.",
    ],
    [
      "✨",
      "Custom shoots",
      "Have something else in mind? Tell us and we will plan it.",
    ],
  ],
  steps: [
    ["Book your date", "Tell us about your event and we confirm the details."],
    ["We shoot", "We arrive prepared and capture the moments that matter."],
    [
      "Choose your favourites",
      "You pick your photos and we record each photo code, so nothing is missed.",
    ],
    [
      "Receive your gallery",
      "Your edited photos are delivered as an online gallery link.",
    ],
  ],
  about:
    "Director Kollo Studios is a photography studio. From the first message to the final gallery, our aim is a smooth experience and photos you are proud to share.",
  contact: {
    phone: "+254 757492023",
    email: "directorkollostudios@gmail.com",
    location: "",
    hours: "",
    instagram: "",
  },
};
export const CONFIG = { cc: '254' }
export const ST = ['Booked', 'Shot', 'Selecting', 'Editing', 'Delivered']
// Bookings that ended without being delivered. They leave the reminders, the pipeline and the double-booking check.
export const END = ['Cancelled', 'No-show']
export const ALL_ST = [...ST, ...END]
export const SV = ['Wedding', 'Portrait', 'Event', 'Corporate', 'Family', 'Other']
export const SS = ['Photography', 'Album', 'Prints', 'Video', 'Drone', 'Retouching']

let cur = 'KSh '
try { cur = localStorage.getItem('cur') || 'KSh ' } catch { /* storage blocked */ }
export const getCur = () => cur
export const setCur = (v) => { cur = v; try { localStorage.setItem('cur', v) } catch { /* storage blocked */ } }
export const m = (n) => cur + (+n || 0).toLocaleString()
export const codes = (s) => [...new Set(String(s || '').split(/[\s,;]+/).filter(Boolean))]
const z = (v) => String(v).padStart(2, '0')
export const off = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) }
export const today = () => off(0)
export const fd = (s) => (s ? new Date(s + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date')
export const kfmt = (n) => (n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k' : String(Math.round(n)))
export const ds = () => { const d = new Date(); return z(d.getDate()) + '-' + z(d.getMonth() + 1) + '-' + String(d.getFullYear()).slice(2) }
export const wan = (p) => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = CONFIG.cc + d.slice(1); return d }
export const isDate = (d) => /^\d/.test(String(d))
export const bal = (c) => (+c.pkg || 0) - (+c.paid || 0)

export function used(C, skip) {
  const u = {}
  C.forEach((c) => { if (c.id !== skip) (c.codes || []).forEach((k) => (u[k] = u[k] || []).push(c.name)) })
  return u
}

// Double-booking: same person, same day, overlapping hours (or no time set = same day).
export function clash(C, id, dt, tm, hr, as, who) {
  const o = []
  if (!dt) return o
  const mn = (t) => +t.slice(0, 2) * 60 + +t.slice(3)
  const s = tm ? mn(tm) : null
  C.forEach((c) => {
    if (c.id === id || c.date !== dt || END.includes(c.status)) return
    c.assign.filter((x) => as.includes(x)).forEach((x) => {
      let hit = true
      if (s != null && c.time) { const a = mn(c.time); hit = s < a + (c.hrs || 2) * 60 && a < s + (hr || 2) * 60 }
      if (hit) o.push({ w: who(x), n: c.name, t: c.time || 'no time set' })
    })
  })
  return o
}

// A session whose date has passed while the client is still "Booked": it was never marked as shot (or never rescheduled).
export const daysSince = (d) => Math.round((new Date(today() + 'T00:00') - new Date(d + 'T00:00')) / 864e5)
export const isOverdue = (c) => c.status === 'Booked' && !!c.date && c.date < today()

export function reminders(C, owner, myid) {
  const t = today(), t3 = off(3), t7 = off(7), o = []
  C.filter((c) => owner || c.assign.includes(myid)).forEach((c) => {
    const b = bal(c)
    if (END.includes(c.status)) {
      if (owner && b !== 0) o.push({ c, k: c.status + ': balance ' + m(b) + ' to settle (adjust the price or record a refund)', w: 1 })
      return
    }
    if (!c.date && c.status !== 'Delivered') o.push({ c, k: 'No session date yet: add the date', w: 1 })
    if (c.deliverBy && c.status !== 'Delivered') {
      if (c.deliverBy < t) o.push({ c, k: 'Delivery was due ' + fd(c.deliverBy) + ' (' + dayw(daysSince(c.deliverBy)) + ' late)', w: 0 })
      else if (c.deliverBy <= t3) o.push({ c, k: 'Delivery due ' + (c.deliverBy === t ? 'today' : 'on ' + fd(c.deliverBy)), w: 1 })
    }
    const sd = stuckDays(c)
    if (sd) o.push({ c, k: 'In "' + c.status + '" for ' + dayw(sd) + ' (limit ' + limits[c.status] + '): move it on', w: 1 })
    if (owner && b < 0) o.push({ c, k: 'Overpaid by ' + m(-b) + ': check the price or refund the difference', w: 1 })
    if (owner && b > 0 && c.payBy) {
      if (c.payBy < t) o.push({ c, k: 'Payment was due ' + fd(c.payBy) + ': balance ' + m(b), w: 0 })
      else if (c.payBy <= t3) o.push({ c, k: 'Payment due ' + (c.payBy === t ? 'today' : 'on ' + fd(c.payBy)) + ': balance ' + m(b), w: 1 })
    }
    if (isOverdue(c)) { const n = daysSince(c.date); o.push({ c, k: 'Session was ' + (n === 1 ? 'yesterday' : n + ' days ago') + ': mark as Shot or reschedule', w: 0 }) }
    if (c.date >= t && c.date <= t3) o.push({ c, k: 'Session ' + (c.date === t ? 'today' : 'on ' + fd(c.date)), w: 1 })
    if (owner && c.date >= t && c.date <= t7 && !c.assign.length) o.push({ c, k: 'Assign a photographer', w: 1 })
    if (c.status === 'Selecting' && !stuckDays(c)) o.push({ c, k: 'Waiting for photo selection', w: 2 })
    if (owner && b > 0 && (c.date < t || c.status === 'Delivered') && !(c.payBy && c.payBy < t)) o.push({ c, k: 'Balance due ' + m(b), w: 1 })
    if (c.status === 'Delivered' && !c.gallery) o.push({ c, k: 'Add the gallery link', w: 2 })
  })
  return o.sort((a, b) => a.w - b.w)
}

export function deliver(name, data, type) {
  const u = URL.createObjectURL(new Blob([data], { type: type || 'application/pdf' }))
  const a = document.createElement('a')
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(u), 4000)
}

export function csvRows(C) {
  return [['Name', 'Phone', 'Event', 'Date', 'Location', 'Services', 'Status', 'Photos', 'Photo codes', 'Package', 'Paid', 'Balance'],
    ...C.map((c) => [c.name, c.phone, c.eventType, c.date, c.loc, c.services, c.status, c.codes.length, c.codes.join(' '), c.pkg || 0, c.paid || 0, bal(c)])]
}
// A cell starting with = + - @ (or tab/CR) can run as a formula in Excel. Prefix TEXT cells with an apostrophe.
export const csvCell = (v) => {
  let t = String(v ?? '')
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t)) t = "'" + t
  return '"' + t.replace(/"/g, '""') + '"'
}
export function exportCsv(C) {
  const s = '\ufeff' + csvRows(C).map((r) => r.map(csvCell).join(',')).join('\n')
  deliver('DKS_Report_' + ds() + '.csv', s, 'text/csv')
}

export async function exportPdf(C) {
  const { jsPDF } = await import('jspdf')
  const D = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' })
  D.setFont('helvetica', 'bold'); D.setFontSize(18); D.setTextColor(217, 111, 0)
  D.text('Director Kollo Studios - Client report', 40, 48)
  D.setFontSize(9); D.setTextColor(100, 106, 138); D.text(fd(today()), 40, 62)
  const X = [40, 215, 295, 365, 430, 520, 610, 700], H = ['Client', 'Event', 'Date', 'Status', 'Photos', 'Package', 'Paid', 'Balance']
  let y = 90
  const head = () => {
    D.setFont('helvetica', 'bold'); D.setFontSize(10); D.setTextColor(75, 34, 176)
    H.forEach((h, i) => D.text(h, X[i], y)); y += 8
    D.setDrawColor(211, 227, 244); D.line(40, y, 800, y); y += 16
    D.setFont('helvetica', 'normal'); D.setTextColor(29, 22, 64)
  }
  head()
  C.forEach((c) => {
    if (y > 540) { D.addPage(); y = 50; head() }
    const v = [c.name, c.eventType, c.date || '-', c.status, String(c.codes.length), m(c.pkg), m(c.paid), m(bal(c))]
    v.forEach((t, i) => D.text(D.splitTextToSize(String(t || ''), (X[i + 1] || 800) - X[i] - 8)[0], X[i], y))
    y += 20
  })
  deliver('DKS_Report_' + ds() + '.pdf', D.output('arraybuffer'))
}

export async function exportInvoice(c, no) {
  const { jsPDF } = await import('jspdf')
  const D = new jsPDF({ unit: 'pt', format: 'a4' })
  const b = bal(c), dd = (d) => (isDate(d) ? fd(d) : String(d))
  D.setFont('helvetica', 'bold'); D.setFontSize(22); D.setTextColor(217, 111, 0); D.text('Director Kollo Studios', 40, 60)
  D.setFontSize(11); D.setTextColor(75, 34, 176); D.text('Photography invoice', 40, 78)
  D.setTextColor(29, 22, 64); D.setFont('helvetica', 'normal')
  D.text('Invoice ' + no, 555, 60, { align: 'right' })
  D.text('Date: ' + fd(today()), 555, 76, { align: 'right' })
  D.setFont('helvetica', 'bold'); D.text('Bill to', 40, 125); D.setFont('helvetica', 'normal')
  D.text(String(c.name), 40, 143); if (c.phone) D.text(String(c.phone), 40, 159)
  let y = 205
  D.setFillColor(234, 243, 252); D.rect(40, y - 15, 515, 26, 'F')
  D.setFont('helvetica', 'bold'); D.text('Description', 48, y + 2); D.text('Amount', 547, y + 2, { align: 'right' })
  D.setFont('helvetica', 'normal'); y += 32
  const row = (t, a) => { const L = D.splitTextToSize(t, 380); D.text(L, 48, y); D.text(a, 547, y, { align: 'right' }); y += 15 * L.length + 8 }
  row((c.pk || 'Photography services') + ' - ' + c.eventType + ', ' + fd(c.date), m(c.pkg))
  c.pay.forEach((x) => row('Payment received - ' + x.m + ' - ' + dd(x.d), '-' + m(x.amt)))
  D.setDrawColor(211, 227, 244); D.line(40, y, 555, y); y += 26
  D.setFont('helvetica', 'bold'); D.setFontSize(14); D.text('Balance due', 48, y); D.text(m(b), 547, y, { align: 'right' })
  D.setFont('helvetica', 'normal'); D.setFontSize(10); D.setTextColor(100, 106, 138)
  D.text('Thank you for choosing Director Kollo Studios.', 40, y + 50)
  deliver('DKS_Invoice_' + String(c.name).replace(/[^a-z0-9]+/gi, '-') + '_' + ds() + '.pdf', D.output('arraybuffer'))
}

// ---- pricing, helpers (kept here so they can be unit-tested) ----
export function calcPrice(po, nCodes, date, R) {
  if (!po) return null
  const ex = Math.max(0, nCodes - po.photos) * R.extra
  const wk = date && [0, 6].includes(new Date(date + 'T00:00').getDay()) ? Math.round(po.price * R.weekend / 100) : 0
  const dc = Math.round((po.price + ex + wk) * R.disc / 100)
  return { base: po.price, ex, wk, dc, t: po.price + ex + wk - dc }
}
export const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }
export const igHandle = (s) => {
  const h = String(s || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@/, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : ''
}
export function parseCsv(text) {
  const out = []; let row = [], f = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(f); f = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some((x) => x.trim())) out.push(row); row = [] }
    else f += c
  }
  row.push(f); if (row.some((x) => x.trim())) out.push(row)
  return out
}
export const normDate = (s) => {
  s = String(s || '').trim()
  const a = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (a) return a[3] + '-' + a[2].padStart(2, '0') + '-' + a[1].padStart(2, '0')
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''
}

// ---- password rules (length first, then a blocklist of easy-to-guess passwords) ----
export const PW_MIN = 10
const COMMON = new Set(['password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'qwerty', 'qwerty123', 'qwertyuiop', '123456', '1234567', '12345678', '123456789', '1234567890', '0123456789', '111111', '000000', 'abc123', 'abcd1234', 'iloveyou', 'admin', 'admin123', 'welcome', 'welcome1', 'welcome123', 'letmein', 'monkey', 'dragon', 'football', 'nairobi', 'kenya', 'kenya123', 'mombasa', 'harambee', 'mpesa', 'jesus', 'jesus123', 'godisgood', 'blessed', 'blessing', 'changeme', 'test1234', 'master', 'sunshine', 'princess', 'secret', 'kollostudios', 'directorkollo', 'photography', 'studio123'])
const SEQ = ['abcdefghijklmnopqrstuvwxyz', '0123456789', 'qwertyuiopasdfghjklzxcvbnm', '9876543210', 'zyxwvutsrqponmlkjihgfedcba']
export const PW_LABELS = ['Too weak', 'Acceptable', 'Fair', 'Good', 'Strong']

export function passwordCheck(pw, ctx = {}) {
  const p = String(pw || ''), low = p.toLowerCase(), problems = []
  const core = low.replace(/[^a-z0-9]/g, ''), letters = low.replace(/[^a-z]/g, '')
  if (p.length < PW_MIN) problems.push('Use at least ' + PW_MIN + ' characters')
  if (core && (COMMON.has(core) || COMMON.has(letters) || [...COMMON].some((w) => w.length >= 6 && core.startsWith(w) && core.length - w.length <= 4))) problems.push('This is a very common password')
  const mine = [String(ctx.email || '').split('@')[0], ...String(ctx.name || '').split(/\s+/)].map((x) => x.toLowerCase().replace(/[^a-z0-9]/g, '')).filter((x) => x.length >= 4)
  if (core.includes('kollo') || mine.some((x) => core.includes(x))) problems.push('Do not put your name, email or the studio name in it')
  if (core.length >= 6 && (/^(.)\1+$/.test(core) || SEQ.some((s) => s.includes(core)))) problems.push('Avoid repeated or sequential characters')
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length
  const words = p.trim().split(/[\s\-_.]+/).filter(Boolean).length
  const score = problems.length ? 0 : Math.min(4, 1 + (p.length >= 12) + (p.length >= 16) + (classes >= 3 || words >= 3 ? 1 : 0))
  return { ok: problems.length === 0, score, problems }
}

// ---- deadlines, stuck stages, data checks ----
const dayw = (n) => n + (n === 1 ? ' day' : ' days')
export const STAGE_DEFAULTS = { Shot: 3, Selecting: 7, Editing: 14 }
let limits = { ...STAGE_DEFAULTS }
export const setLimits = (o) => { limits = { ...STAGE_DEFAULTS, ...(o || {}) } }
export const getLimits = () => limits
// Days a client has been in its current stage beyond the allowed limit (0 means fine)
export function stuckDays(c) {
  const lim = limits[c.status]
  if (!lim || !c.statusAt) return 0
  const d = daysSince(String(c.statusAt).slice(0, 10))
  return d > lim ? d : 0
}
export const isStuck = (c) => stuckDays(c) > 0
export const isLate = (c) => !!c.deliverBy && c.deliverBy < today() && c.status !== 'Delivered' && !END.includes(c.status)
export const isBehind = (c) => isOverdue(c) || isLate(c) || isStuck(c)
export function phoneOk(p) { const d = String(p || '').replace(/[\s()\-+.]/g, ''); return /^\d{9,13}$/.test(d) }
// Other clients that look like the same person: same phone (last 9 digits), or same name on the same date
export function dupMatches(C, { id, phone, name, date }) {
  const tail = (p) => String(p || '').replace(/\D/g, '').slice(-9)
  const t = tail(phone), n = String(name || '').trim().toLowerCase()
  return C.filter((c) => c.id !== id && ((t.length >= 9 && tail(c.phone) === t) || (n && date && c.date === date && c.name.trim().toLowerCase() === n)))
}
