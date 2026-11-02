import { buildIcs } from './ics.js'

// GET /api/calendar?token=...  returns a calendar feed that phone calendar apps can subscribe to.
// It only uses the public Supabase address and key (already set for the app). The secret token is what protects each feed.
export const handler = async (event) => {
  const token = (event.queryStringParameters || {}).token || ''
  if (!/^[a-f0-9]{64}$/.test(token)) return { statusCode: 404, body: 'Not found' }
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) return { statusCode: 500, body: 'Calendar is not configured' }
  try {
    const res = await fetch(url + '/rest/v1/rpc/calendar_feed', {
      method: 'POST',
      headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token }),
    })
    if (!res.ok) return { statusCode: 502, body: 'Calendar unavailable' }
    const rows = await res.json()
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=300' },
      body: buildIcs(Array.isArray(rows) ? rows : [], { name: 'Studio sessions' }),
    }
  } catch {
    return { statusCode: 502, body: 'Calendar unavailable' }
  }
}
