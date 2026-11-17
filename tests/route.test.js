import { describe, it, expect } from 'vitest'
import { TAB_PATH, pathToTab, tabToPath, allowedTab, syncPath } from '../src/route.js'

describe('address and page always agree', () => {
  it('maps every page to its own address and back', () => {
    for (const [tab, path] of Object.entries(TAB_PATH)) {
      expect(tabToPath(tab)).toBe(path)
      expect(pathToTab(path)).toBe(tab)
    }
  })
  it('gives every page a different address (so one can never stand in for another)', () => {
    const paths = Object.values(TAB_PATH)
    expect(new Set(paths).size).toBe(paths.length)
  })
  it('understands trailing slashes, queries and fragments', () => {
    expect(pathToTab('/payments/')).toBe('m')
    expect(pathToTab('/reports?x=1')).toBe('r')
    expect(pathToTab('/settings#top')).toBe('g')
    expect(pathToTab('/')).toBe('h')
  })
  it('does not recognise unknown addresses', () => {
    expect(pathToTab('/nonsense')).toBeNull()
    expect(pathToTab('/index.html')).toBeNull()
  })
})

describe('who may open what', () => {
  it('sends staff away from payments, reports and admin, but not Directors from payments', () => {
    expect(allowedTab('m', false, false)).toBe('h')
    expect(allowedTab('r', false, false)).toBe('h')
    expect(allowedTab('a', true, false)).toBe('h')
    expect(allowedTab('m', true, false)).toBe('m')
    expect(allowedTab('a', true, true)).toBe('a')
    expect(allowedTab('c', false, false)).toBe('c')
  })
})

describe('syncPath (the address follows the page)', () => {
  it('does nothing when the address already matches', () => { expect(syncPath('/payments', 'm', true, false)).toBeNull() })
  it('repairs the stuck-address bug: Payments on screen while the address says /reports', () => {
    expect(syncPath('/reports', 'm', true, false)).toBe('/payments')
  })
  it('repairs an unknown address', () => { expect(syncPath('/index.html', 'c', true, true)).toBe('/clients') })
  it('shows the Home address to someone who may not open the page', () => {
    expect(syncPath('/reports', 'r', false, false)).toBe('/')
  })
  it('treats /payments/ and /payments as the same', () => { expect(syncPath('/payments/', 'm', true, false)).toBeNull() })
})
