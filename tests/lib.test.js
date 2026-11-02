import { describe, it, expect } from 'vitest'
import { calcPrice, clash, reminders, csvCell, igHandle, parseCsv, normDate, chunk, used, off, today, m, passwordCheck, isOverdue, daysSince, END, ALL_ST, setLimits, stuckDays, isLate, isBehind, phoneOk, dupMatches } from '../src/lib.js'

const R = { extra: 500, weekend: 15, disc: 10 }
const pkg = { price: 10000, photos: 20 }

describe('calcPrice', () => {
  it('adds extra photos, weekend surcharge and applies the discount', () => {
    // 2026-12-05 is a Saturday: +2500 extra, +1500 weekend, -1400 discount
    expect(calcPrice(pkg, 25, '2026-12-05', R)).toEqual({ base: 10000, ex: 2500, wk: 1500, dc: 1400, t: 12600 })
  })
  it('has no weekend surcharge on a weekday and no extras within the limit', () => {
    expect(calcPrice(pkg, 20, '2026-12-02', { ...R, disc: 0 }).t).toBe(10000)
  })
  it('returns null when no package is chosen', () => { expect(calcPrice(undefined, 5, '', R)).toBeNull() })
})

describe('clash (double booking)', () => {
  const C = [{ id: 'a', name: 'Anne', date: '2026-12-05', time: '10:00', hrs: 2, assign: ['u1'] }]
  const who = (id) => id
  it('flags overlapping hours for the same person', () => { expect(clash(C, 'b', '2026-12-05', '11:00', 2, ['u1'], who)).toHaveLength(1) })
  it('allows back-to-back sessions', () => { expect(clash(C, 'b', '2026-12-05', '12:00', 2, ['u1'], who)).toHaveLength(0) })
  it('ignores a different person or a different day', () => {
    expect(clash(C, 'b', '2026-12-05', '10:00', 2, ['u2'], who)).toHaveLength(0)
    expect(clash(C, 'b', '2026-12-06', '10:00', 2, ['u1'], who)).toHaveLength(0)
  })
  it('does not clash a client with itself', () => { expect(clash(C, 'a', '2026-12-05', '10:00', 2, ['u1'], who)).toHaveLength(0) })
  it('treats a booking with no start time as the whole day', () => { expect(clash(C, 'b', '2026-12-05', '', 2, ['u1'], who)).toHaveLength(1) })
})

describe('reminders', () => {
  const mk = (o) => ({ id: 'x', name: 'X', status: 'Booked', date: '', assign: [], pkg: 0, paid: 0, gallery: '', codes: [], pay: [], ...o })
  it('reminds about sessions in the next 3 days and unassigned ones (owner)', () => {
    const r = reminders([mk({ date: off(1) })], true, 'me').map((x) => x.k)
    expect(r.some((k) => k.startsWith('Session'))).toBe(true)
    expect(r).toContain('Assign a photographer')
  })
  it('flags an unpaid balance after delivery, only for owners', () => {
    const c = mk({ status: 'Delivered', date: off(-3), pkg: 5000, paid: 1000, gallery: 'x' })
    expect(reminders([c], true, 'me').some((x) => x.k.startsWith('Balance due'))).toBe(true)
    expect(reminders([c], false, 'me')).toHaveLength(0)
  })
  it('staff only see reminders for their own clients', () => {
    expect(reminders([mk({ date: today(), assign: ['other'] })], false, 'me')).toHaveLength(0)
  })
})

describe('csv safety', () => {
  it('neutralises spreadsheet formulas in text cells', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"')
    expect(csvCell('+254700000000')).toBe('"\'+254700000000"')
    expect(csvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"')
    expect(csvCell('-2+3')).toBe('"\'-2+3"')
  })
  it('leaves normal text and real numbers alone', () => { expect(csvCell('Jane Doe')).toBe('"Jane Doe"'); expect(csvCell(-500)).toBe('"-500"') })
  it('doubles quotes', () => { expect(csvCell('say "hi"')).toBe('"say ""hi"""') })
  it('parses quoted commas and newlines', () => { expect(parseCsv('a,b\n"x, y","l1\nl2"\n')).toEqual([['a', 'b'], ['x, y', 'l1\nl2']]) })
  it('normalises dates', () => { expect(normDate('05/12/2026')).toBe('2026-12-05'); expect(normDate('nonsense')).toBe('') })
})

describe('helpers', () => {
  it('only accepts a real Instagram handle', () => {
    expect(igHandle('Director Kollo Studios')).toBe('')
    expect(igHandle('@kollo.studio')).toBe('kollo.studio')
    expect(igHandle('https://instagram.com/kollo_studio/')).toBe('kollo_studio')
  })
  it('chunks arrays', () => { expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]) })
  it('finds duplicate photo codes between clients', () => {
    const C = [{ id: 'a', name: 'A', codes: ['1', '2'] }, { id: 'b', name: 'B', codes: ['2', '3'] }]
    expect(used(C, 'b')).toEqual({ 1: ['A'], 2: ['A'] })
  })
  it('formats money', () => { expect(m(1500)).toMatch(/1,500/) })
})

describe('passwordCheck', () => {
  it('rejects short passwords', () => { expect(passwordCheck('Ab1!xyz').ok).toBe(false) })
  it('rejects common passwords, even with a number or year added', () => {
    expect(passwordCheck('password123').ok).toBe(false)
    expect(passwordCheck('Password2024').ok).toBe(false)
    expect(passwordCheck('qwertyuiop').ok).toBe(false)
  })
  it('rejects repeated and sequential characters', () => {
    expect(passwordCheck('aaaaaaaaaaaa').ok).toBe(false)
    expect(passwordCheck('abcdefghijkl').ok).toBe(false)
    expect(passwordCheck('1234567890').ok).toBe(false)
  })
  it('rejects the studio name and personal details', () => {
    expect(passwordCheck('treks.kollo.2026').ok).toBe(false)
    expect(passwordCheck('janemwangi!2026', { email: 'jane.mwangi@x.com', name: 'Jane Mwangi' }).ok).toBe(false)
  })
  it('accepts a long phrase of random words and scores it well', () => {
    const r = passwordCheck('tulip sunset river moon')
    expect(r.ok).toBe(true)
    expect(r.score).toBeGreaterThanOrEqual(3)
  })
  it('accepts a 10 character password that avoids all the traps, with a low score', () => {
    const r = passwordCheck('Zx7!mQ2#pL')
    expect(r.ok).toBe(true)
    expect(r.score).toBeLessThan(passwordCheck('tulip sunset river moon').score + 1)
  })
})

describe('overdue sessions (date passed, still Booked)', () => {
  const mk = (o) => ({ id: 'x', name: 'X', status: 'Booked', date: '', assign: [], pkg: 0, paid: 0, gallery: '', codes: [], pay: [], ...o })
  it('flags a Booked client whose date has passed', () => {
    expect(isOverdue(mk({ date: off(-3) }))).toBe(true)
    expect(daysSince(off(-3))).toBe(3)
  })
  it('does not flag today, the future, no date, or any other status', () => {
    expect(isOverdue(mk({ date: today() }))).toBe(false)
    expect(isOverdue(mk({ date: off(2) }))).toBe(false)
    expect(isOverdue(mk({ date: '' }))).toBe(false)
    expect(isOverdue(mk({ date: off(-3), status: 'Shot' }))).toBe(false)
  })
  it('puts an overdue reminder first, even for a client who owes nothing', () => {
    const r = reminders([mk({ date: off(-2), assign: ['me'] }), mk({ id: 'y', date: off(1), assign: ['me'] })], true, 'me')
    expect(r[0].k).toMatch(/2 days ago/)
  })
  it('staff only get the overdue reminder for their own clients', () => {
    expect(reminders([mk({ date: off(-2), assign: ['other'] })], false, 'me')).toHaveLength(0)
    expect(reminders([mk({ date: off(-2), assign: ['me'] })], false, 'me').length).toBe(1)
  })
})

describe('cancelled and no-show bookings', () => {
  const mk = (o) => ({ id: 'x', name: 'X', status: 'Booked', date: '', assign: [], pkg: 0, paid: 0, gallery: '', codes: [], pay: [], ...o })
  it('are extra statuses outside the delivery pipeline', () => {
    expect(END).toEqual(['Cancelled', 'No-show'])
    expect(ALL_ST).toContain('Cancelled')
  })
  it('never count as overdue and give no session or photographer reminders', () => {
    const c = mk({ status: 'Cancelled', date: off(1) })
    expect(isOverdue(mk({ status: 'No-show', date: off(-3) }))).toBe(false)
    expect(reminders([c], true, 'me')).toHaveLength(0)
  })
  it('ask the owner to settle money on a cancelled booking, once', () => {
    const r = reminders([mk({ status: 'Cancelled', date: off(1), pkg: 5000, paid: 1000 })], true, 'me')
    expect(r).toHaveLength(1)
    expect(r[0].k).toMatch(/to settle/)
  })
  it('no longer block a photographer from being booked at that time', () => {
    const C = [mk({ id: 'a', status: 'Cancelled', date: '2026-12-05', time: '10:00', hrs: 2, assign: ['u1'] })]
    expect(clash(C, 'b', '2026-12-05', '10:00', 2, ['u1'], (id) => id)).toHaveLength(0)
  })
})
describe('clients with no date', () => {
  const mk = (o) => ({ id: 'x', name: 'X', status: 'Booked', date: '', assign: ['me'], pkg: 0, paid: 0, gallery: '', codes: [], pay: [], ...o })
  it('get a reminder so they are not invisible', () => {
    expect(reminders([mk({})], true, 'me').some((r) => r.k.startsWith('No session date'))).toBe(true)
  })
  it('do not, once delivered', () => {
    expect(reminders([mk({ status: 'Delivered', gallery: 'x' })], true, 'me').some((r) => r.k.startsWith('No session date'))).toBe(false)
  })
})

describe('overpaid and Pay by reminders', () => {
  const mk = (o) => ({ id: 'x', name: 'X', status: 'Booked', date: off(10), assign: ['me'], pkg: 1000, paid: 0, gallery: '', codes: [], pay: [], ...o })
  it('flags an overpaid client to the owner only', () => {
    expect(reminders([mk({ paid: 1500 })], true, 'me').some((r) => r.k.startsWith('Overpaid by'))).toBe(true)
    expect(reminders([mk({ paid: 1500 })], false, 'me').some((r) => r.k.startsWith('Overpaid'))).toBe(false)
  })
  it('reminds before the session when a Pay by date is close', () => {
    const r = reminders([mk({ payBy: off(2) })], true, 'me')
    expect(r.some((x) => x.k.startsWith('Payment due'))).toBe(true)
  })
  it('puts an overdue Pay by first, once, without the generic balance reminder', () => {
    const r = reminders([mk({ payBy: off(-2), date: off(-5), status: 'Shot' })], true, 'me')
    expect(r.filter((x) => /Payment was due/.test(x.k))).toHaveLength(1)
    expect(r.some((x) => x.k.startsWith('Balance due'))).toBe(false)
    expect(r[0].k).toMatch(/Payment was due/)
  })
  it('ignores a Pay by date once the client has paid in full', () => {
    expect(reminders([mk({ payBy: off(-2), paid: 1000 })], true, 'me').some((x) => /Payment/.test(x.k))).toBe(false)
  })
})

describe('deliver-by deadlines', () => {
  const mk = (o) => ({ id: 'x', name: 'X', status: 'Editing', date: off(-10), assign: ['me'], pkg: 0, paid: 0, gallery: '', codes: [], pay: [], ...o })
  it('flags a late delivery first, and not once delivered or cancelled', () => {
    expect(isLate(mk({ deliverBy: off(-2) }))).toBe(true)
    expect(isLate(mk({ deliverBy: off(-2), status: 'Delivered' }))).toBe(false)
    expect(isLate(mk({ deliverBy: off(-2), status: 'Cancelled' }))).toBe(false)
    expect(isLate(mk({ deliverBy: off(2) }))).toBe(false)
    expect(reminders([mk({ deliverBy: off(-2) })], false, 'me')[0].k).toMatch(/Delivery was due .*2 days late/)
  })
  it('reminds a few days before the deadline, to staff as well', () => {
    expect(reminders([mk({ deliverBy: off(1) })], false, 'me').some((r) => r.k.startsWith('Delivery due'))).toBe(true)
  })
})

describe('stuck stages', () => {
  const mk = (o) => ({ id: 'x', name: 'X', status: 'Editing', date: off(-30), assign: ['me'], pkg: 0, paid: 0, gallery: '', codes: [], pay: [], ...o })
  const ago = (n) => new Date(Date.now() - n * 864e5).toISOString()
  it('uses the limits and ignores stages without one', () => {
    setLimits({})
    expect(stuckDays(mk({ statusAt: ago(20) }))).toBeGreaterThanOrEqual(19)
    expect(stuckDays(mk({ statusAt: ago(5) }))).toBe(0)
    expect(stuckDays(mk({ status: 'Delivered', statusAt: ago(90) }))).toBe(0)
    expect(stuckDays(mk({ status: 'Booked', statusAt: ago(90) }))).toBe(0)
  })
  it('lets the Admin change the limits', () => {
    setLimits({ Editing: 30 })
    expect(stuckDays(mk({ statusAt: ago(20) }))).toBe(0)
    setLimits({})
  })
  it('adds one stuck reminder and drops the generic selection reminder', () => {
    setLimits({})
    const r = reminders([mk({ status: 'Selecting', statusAt: ago(12) })], false, 'me').map((x) => x.k)
    expect(r.some((k) => /for 12 days/.test(k))).toBe(true)
    expect(r).not.toContain('Waiting for photo selection')
  })
  it('groups overdue, late and stuck as behind schedule', () => {
    expect(isBehind(mk({ statusAt: ago(40) }))).toBe(true)
    expect(isBehind(mk({ statusAt: ago(1) }))).toBe(false)
  })
})

describe('phone and duplicate checks', () => {
  it('accepts normal Kenyan formats and rejects junk', () => {
    expect(phoneOk('0712 345 678')).toBe(true)
    expect(phoneOk('+254712345678')).toBe(true)
    expect(phoneOk('071234')).toBe(false)
    expect(phoneOk('call me')).toBe(false)
    expect(phoneOk('')).toBe(false)
  })
  it('finds the same phone written differently, and the same name on the same date', () => {
    const C = [{ id: 'a', name: 'Jane Doe', phone: '0712 345 678', date: '2026-12-01' }, { id: 'b', name: 'Sam', phone: '', date: '2026-12-02' }]
    expect(dupMatches(C, { phone: '+254712345678', name: 'Other', date: '' })).toHaveLength(1)
    expect(dupMatches(C, { phone: '', name: 'sam', date: '2026-12-02' })).toHaveLength(1)
    expect(dupMatches(C, { phone: '', name: 'Sam', date: '2026-12-09' })).toHaveLength(0)
  })
  it('does not match a client with itself', () => {
    expect(dupMatches([{ id: 'a', name: 'Jane', phone: '0712345678', date: '' }], { id: 'a', phone: '0712345678', name: 'Jane', date: '' })).toHaveLength(0)
  })
})
