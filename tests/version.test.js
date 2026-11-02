import { describe, it, expect } from 'vitest'
import { versionCmp, versionLt } from '../src/version.js'
import { newerEntries, CHANGELOG } from '../src/changelog.js'

describe('versionCmp', () => {
  it('compares numbers, not text', () => {
    expect(versionCmp('2.10.0', '2.9.0')).toBe(1)
    expect(versionCmp('2.2.0', '2.2.0')).toBe(0)
    expect(versionCmp('1.9.9', '2.0.0')).toBe(-1)
  })
  it('treats missing parts as zero', () => { expect(versionCmp('2.2', '2.2.0')).toBe(0) })
})

describe('required-update lock', () => {
  it('blocks only copies older than the minimum', () => {
    expect(versionLt('2.1.0', '2.2.0')).toBe(true)
    expect(versionLt('2.2.0', '2.2.0')).toBe(false)
    expect(versionLt('2.3.0', '2.2.0')).toBe(false)
  })
  it('does nothing when no minimum is set', () => {
    expect(versionLt('1.0.0', '')).toBe(false)
    expect(versionLt('1.0.0', undefined)).toBe(false)
  })
})

describe("what's new", () => {
  it('lists releases after the one you had, up to the one you run, newest first', () => {
    const l = newerEntries('2.0.0', '2.2.0')
    expect(l.map((e) => e.v)).toEqual(['2.2.0', '2.1.0'])
  })
  it('lists nothing when you are already up to date', () => { expect(newerEntries('2.2.0', '2.2.0')).toEqual([]) })
  it('keeps the newest entry at the top of the changelog', () => { expect(CHANGELOG[0].v).toBe('2.5.1') })
})
