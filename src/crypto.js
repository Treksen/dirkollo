// Passphrase encryption for backup files: AES-256-GCM, key derived with PBKDF2. Uses the browser's built-in crypto (also in Node 20).
const enc = new TextEncoder()
const dec = new TextDecoder()
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s) }
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function deriveKey(pass, salt, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export const isEncrypted = (o) => !!o && o.app === 'director-kollo-encrypted'

// returns the text of an encrypted file (JSON)
export async function encryptText(text, pass, iter = 250000) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(pass, salt, iter)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text)))
  return JSON.stringify({ app: 'director-kollo-encrypted', v: 1, kdf: 'PBKDF2-SHA256', iter, salt: b64(salt), iv: b64(iv), data: b64(ct) })
}

export async function decryptText(file, pass) {
  try {
    const key = await deriveKey(pass, unb64(file.salt), file.iter)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(file.iv) }, key, unb64(file.data))
    return dec.decode(plain)
  } catch {
    throw new Error('Wrong passphrase, or the file is damaged.')
  }
}
