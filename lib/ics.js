// Builds an iCalendar (.ics) feed from the rows returned by the database's calendar_feed function.
// Times in the database are Nairobi time (UTC+3, no daylight saving), so they are converted to UTC here.
const pad = (n) => String(n).padStart(2, '0')
const stamp = (d) => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'
const dateOnly = (d) => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate())

export const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

// lines longer than 75 bytes must be folded
export function fold(line) {
  const out = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const b = Buffer.byteLength(ch)
    if (bytes + b > 74) { out.push(cur); cur = ' ' + ch; bytes = 1 + b } else { cur += ch; bytes += b }
  }
  out.push(cur)
  return out.join('\r\n')
}

export function buildIcs(rows, opts = {}) {
  const name = opts.name || 'Sessions'
  const now = opts.now || new Date()
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Director Kollo//Sessions//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:' + esc(name), 'X-WR-TIMEZONE:Africa/Nairobi', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H']
  for (const r of rows) {
    const [y, mo, d] = String(r.session_date).split('-').map(Number)
    const summary = (r.event_type ? r.event_type + ': ' : '') + r.name
    L.push('BEGIN:VEVENT', 'UID:' + r.id + '@kollo', 'DTSTAMP:' + stamp(now))
    if (r.session_time) {
      const [hh, mm] = String(r.session_time).split(':').map(Number)
      const start = new Date(Date.UTC(y, mo - 1, d, hh - 3, mm))
      const end = new Date(start.getTime() + (Number(r.duration_hrs) || 2) * 3600000)
      L.push('DTSTART:' + stamp(start), 'DTEND:' + stamp(end))
    } else {
      const start = new Date(Date.UTC(y, mo - 1, d))
      L.push('DTSTART;VALUE=DATE:' + dateOnly(start), 'DTEND;VALUE=DATE:' + dateOnly(new Date(start.getTime() + 86400000)))
    }
    L.push('SUMMARY:' + esc(summary))
    if (r.location) L.push('LOCATION:' + esc(r.location))
    L.push('DESCRIPTION:' + esc('Status: ' + r.status + (r.assigned ? '\nAssigned: ' + r.assigned : '')), 'STATUS:CONFIRMED',
      'BEGIN:VALARM', 'TRIGGER:-PT60M', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(summary), 'END:VALARM', 'END:VEVENT')
  }
  L.push('END:VCALENDAR')
  return L.map(fold).join('\r\n') + '\r\n'
}
