// Cleaning and grouping of error reports. No imports, so it can be unit-tested.

// Remove anything personal or secret before an error message leaves the phone.
export function scrub(text, max = 600) {
  let s = String(text == null ? '' : text)
  s = s.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[id]')
  s = s.replace(/\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/g, '[token]')
  s = s.replace(/\b(Bearer|apikey)\s+[\w.-]{10,}/gi, '$1 [key]')
  s = s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
  s = s.replace(/https?:\/\/[^\s)'"]+/g, (u) => { try { const x = new URL(u); return x.origin + x.pathname } catch { return '[url]' } })
  s = s.replace(/\+?\d[\d\s().-]{6,}\d/g, '[number]')
  return s.length > max ? s.slice(0, max) + '…' : s
}

// Mistakes that are not the app's fault, or not worth the Admin's time
export function shouldIgnore(message, stack) {
  const m = String(message || '')
  const st = String(stack || '')
  if (/ResizeObserver loop/i.test(m)) return true
  if (/^Script error\.?$/i.test(m.trim())) return true
  if (/Failed to fetch|NetworkError|Load failed|Network request failed|fetch failed|AbortError|operation was aborted/i.test(m)) return true
  if (/(chrome|moz|safari)-extension:\/\//i.test(st)) return true
  return false
}

// The same mistake always gets the same fingerprint, so repeats are counted instead of listed again
export function fingerprint(kind, message, stack) {
  const msg = String(message || '').toLowerCase().replace(/\d+/g, '#').replace(/-[a-z0-9_]{6,}\.(js|css)/g, '.$1')
  const frames = String(stack || '').split('\n').slice(0, 4).map((l) => l.trim().replace(/https?:\/\/\S+/g, '').replace(/[\d:]+/g, '')).join('|')
  const text = kind + '|' + msg + '|' + frames
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(16).padStart(8, '0') + text.length.toString(16)
}
