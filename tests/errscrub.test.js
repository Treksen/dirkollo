import { describe, it, expect } from 'vitest'
import { scrub, shouldIgnore, fingerprint } from '../src/errscrub.js'

describe('scrub (nothing personal leaves the phone)', () => {
  it('removes phone numbers, emails, ids and tokens', () => {
    const s = scrub('Failed for jane@mail.com phone 0712 345 678 id 123e4567-e89b-12d3-a456-426614174000 token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop')
    expect(s).not.toMatch(/jane|0712|345|123e4567|eyJ/)
    expect(s).toContain('[email]')
    expect(s).toContain('[number]')
    expect(s).toContain('[id]')
    expect(s).toContain('[token]')
  })
  it('drops the query string of links (they can carry secrets)', () => {
    expect(scrub('GET https://x.supabase.co/rest/v1/clients?token=SECRET123&name=Jane failed')).not.toMatch(/SECRET|Jane/)
  })
  it('keeps ordinary messages readable and caps their length', () => {
    expect(scrub("TypeError: Cannot read properties of undefined (reading 'map')")).toContain('Cannot read properties of undefined')
    expect(scrub('x'.repeat(2000), 600).length).toBeLessThanOrEqual(601)
  })
})

describe('shouldIgnore', () => {
  it('skips browser noise and offline failures', () => {
    expect(shouldIgnore('ResizeObserver loop limit exceeded', '')).toBe(true)
    expect(shouldIgnore('Script error.', '')).toBe(true)
    expect(shouldIgnore('TypeError: Failed to fetch', '')).toBe(true)
    expect(shouldIgnore('boom', 'at x (chrome-extension://abc/content.js:1:1)')).toBe(true)
  })
  it('reports real mistakes', () => { expect(shouldIgnore("TypeError: Cannot read properties of undefined (reading 'map')", 'at List (index.js:1:1)')).toBe(false) })
})

describe('fingerprint (repeats are counted, not listed again)', () => {
  const stack = 'TypeError: x\n at List (https://s.app/assets/index-AbCd1234.js:10:20)\n at Home (https://s.app/assets/index-AbCd1234.js:30:5)'
  it('is the same for the same mistake, even with different numbers and file hashes', () => {
    const a = fingerprint('screen', 'Cannot read 5 items', stack)
    const b = fingerprint('screen', 'Cannot read 9 items', stack.replace('AbCd1234', 'ZzYy9876').replace(':10:20', ':11:21'))
    expect(a).toBe(b)
  })
  it('differs for a different mistake or kind', () => {
    expect(fingerprint('screen', 'Cannot read', stack)).not.toBe(fingerprint('screen', 'Something else', stack))
    expect(fingerprint('screen', 'Cannot read', stack)).not.toBe(fingerprint('sync', 'Cannot read', stack))
  })
})
