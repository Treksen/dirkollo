import { buildIcs } from '../lib/ics.js'

// Vercel function: GET /api/calendar?token=...  returns a calendar feed that phone calendar apps can subscribe to.
// It only uses the public Supabase address and key (already set for the app). The secret token is what protects each feed.
export default async function handler(req, res) {
  const token = String((req.query && req.query.token) || '')
  if (!/^[a-f0-9]{64}$/.test(token)) { res.status(404).send('Not found'); return }
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) { res.status(500).send('Calendar is not configured'); return }
  try {
    const r = await fetch(url + '/rest/v1/rpc/calendar_feed', {
      method: 'POST',
      headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token }),
    })
    if (!r.ok) { res.status(502).send('Calendar unavailable'); return }
    const rows = await r.json()
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Cache-Control', 'private, max-age=300')
    res.status(200).send(buildIcs(Array.isArray(rows) ? rows : [], { name: 'Studio sessions' }))
  } catch {
    res.status(502).send('Calendar unavailable')
  }
}
