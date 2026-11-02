import { describe, it, expect } from 'vitest'
import { buildIcs, esc, fold } from '../netlify/functions/ics.js'

const now = new Date('2026-10-30T08:00:00Z')
const row = (o) => ({ id: 'abc', name: 'Jane & John, Doe', event_type: 'Wedding', session_date: '2026-12-05', session_time: '13:00:00', duration_hrs: 2, location: 'Karen; Nairobi', status: 'Booked', assigned: 'Admin Treks', ...o })

describe('calendar feed', () => {
  it('converts Nairobi time to UTC and keeps the duration', () => {
    const t = buildIcs([row({})], { now })
    expect(t).toContain('DTSTART:20261205T100000Z')
    expect(t).toContain('DTEND:20261205T120000Z')
  })
  it('makes an all-day event when there is no time', () => {
    const t = buildIcs([row({ session_time: null })], { now })
    expect(t).toContain('DTSTART;VALUE=DATE:20261205')
    expect(t).toContain('DTEND;VALUE=DATE:20261206')
  })
  it('escapes commas and semicolons in names and places', () => {
    const t = buildIcs([row({})], { now })
    expect(t).toContain('SUMMARY:Wedding: Jane & John\\, Doe')
    expect(t).toContain('LOCATION:Karen\\; Nairobi')
  })
  it('never includes phone numbers or money, and uses CRLF line ends', () => {
    const t = buildIcs([row({ phone: '0712345678', price: 5000 })], { now })
    expect(t).not.toContain('0712345678')
    expect(t).not.toContain('5000')
    expect(t.endsWith('\r\n')).toBe(true)
  })
  it('folds long lines to 75 bytes', () => {
    const f = fold('DESCRIPTION:' + 'x'.repeat(200))
    for (const line of f.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75)
  })
  it('escapes new lines', () => { expect(esc('a\nb')).toBe('a\\nb') })
  it('is a valid empty calendar when there are no sessions', () => {
    const t = buildIcs([], { now })
    expect(t.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(t).not.toContain('BEGIN:VEVENT')
  })
})
