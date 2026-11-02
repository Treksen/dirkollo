import { describe, it, expect } from 'vitest'
import { encryptText, decryptText, isEncrypted } from '../src/crypto.js'

describe('encrypted backups', () => {
  it('round-trips with the right passphrase', async () => {
    const file = JSON.parse(await encryptText('{"clients":[{"name":"Jane Wanjiru"}]}', 'correct horse battery', 1000))
    expect(isEncrypted(file)).toBe(true)
    expect(JSON.stringify(file)).not.toContain('Jane')
    expect(await decryptText(file, 'correct horse battery')).toContain('Jane Wanjiru')
  })
  it('refuses the wrong passphrase', async () => {
    const file = JSON.parse(await encryptText('secret', 'one passphrase', 1000))
    await expect(decryptText(file, 'another passphrase')).rejects.toThrow(/Wrong passphrase/)
  })
  it('detects a damaged file', async () => {
    const file = JSON.parse(await encryptText('secret', 'one passphrase', 1000))
    file.data = file.data.slice(0, -6) + 'AAAAAA'
    await expect(decryptText(file, 'one passphrase')).rejects.toThrow()
  })
  it('does not treat a normal backup as encrypted', () => { expect(isEncrypted({ app: 'director-kollo', clients: [] })).toBe(false) })
})
