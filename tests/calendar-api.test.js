import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from '../api/calendar.js'

const TOKEN = 'a'.repeat(64)
const mkRes = () => {
  const r = { code: 0, headers: {}, body: '' }
  r.status = (c) => { r.code = c; return r }
  r.setHeader = (k, v) => { r.headers[k] = v; return r }
  r.send = (b) => { r.body = b; return r }
  return r
}

describe('calendar function (Vercel)', () => {
  beforeEach(() => { process.env.VITE_SUPABASE_URL = 'https://x.supabase.co'; process.env.VITE_SUPABASE_ANON_KEY = 'anon-key' })
  afterEach(() => { vi.restoreAllMocks() })

  it('refuses a token that is not 64 hex characters, without calling the database', async () => {
    const f = vi.spyOn(globalThis, 'fetch')
    const res = mkRes()
    await handler({ query: { token: 'short' } }, res)
    expect(res.code).toBe(404)
    expect(f).not.toHaveBeenCalled()
  })
  it('returns a calendar for a good token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => [{ id: 'abc', name: 'Jane', event_type: 'Wedding', session_date: '2026-12-05', session_time: '13:00:00', duration_hrs: 2, location: 'Karen', status: 'Booked', assigned: 'Admin' }] })
    const res = mkRes()
    await handler({ query: { token: TOKEN } }, res)
    expect(res.code).toBe(200)
    expect(res.headers['Content-Type']).toMatch(/text\/calendar/)
    expect(res.body).toContain('SUMMARY:Wedding: Jane')
    expect(globalThis.fetch.mock.calls[0][0]).toBe('https://x.supabase.co/rest/v1/rpc/calendar_feed')
  })
  it('gives an empty but valid calendar when the token matches nobody', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => [] })
    const res = mkRes()
    await handler({ query: { token: TOKEN } }, res)
    expect(res.code).toBe(200)
    expect(res.body.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(res.body).not.toContain('BEGIN:VEVENT')
  })
  it('does not leak details when the database fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('secret internal detail'))
    const res = mkRes()
    await handler({ query: { token: TOKEN } }, res)
    expect(res.code).toBe(502)
    expect(res.body).not.toContain('secret')
  })
  it('says so when the site is not configured', async () => {
    delete process.env.VITE_SUPABASE_URL
    const res = mkRes()
    await handler({ query: { token: TOKEN } }, res)
    expect(res.code).toBe(500)
  })
})
