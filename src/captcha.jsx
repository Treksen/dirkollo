import { useEffect, useRef } from 'react'

// Cloudflare Turnstile. Switched on by setting VITE_TURNSTILE_SITE_KEY (and the matching secret in Supabase). No key means no captcha.
export const CAPTCHA_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
let loading = null
const load = () => loading || (loading = new Promise((res, rej) => {
  if (window.turnstile) { res(); return }
  const s = document.createElement('script')
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  s.async = true; s.onload = res; s.onerror = rej
  document.head.appendChild(s)
}))

export function Captcha({ onToken, resetKey }) {
  const box = useRef(null)
  const wid = useRef(null)
  useEffect(() => {
    if (!CAPTCHA_KEY) return undefined
    let dead = false
    load().then(() => {
      if (dead || !box.current || wid.current !== null) return
      wid.current = window.turnstile.render(box.current, { sitekey: CAPTCHA_KEY, callback: onToken, 'expired-callback': () => onToken(''), 'error-callback': () => onToken('') })
    }).catch(() => onToken(''))
    return () => { dead = true; if (wid.current !== null && window.turnstile) { try { window.turnstile.remove(wid.current) } catch { /* already gone */ } wid.current = null } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (wid.current !== null && window.turnstile) { window.turnstile.reset(wid.current); onToken('') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])
  return CAPTCHA_KEY ? <div ref={box} style={{ margin: '12px 0' }} /> : null
}
