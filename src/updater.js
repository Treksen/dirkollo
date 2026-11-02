import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

// App updates. The browser downloads a new version quietly; it waits until the person taps "Update now".
const state = { needRefresh: false, checking: false, lastChecked: null, error: '' }
const subs = new Set()
let reg = null
let doUpdate = null
let started = false
const emit = () => subs.forEach((f) => f({ ...state }))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export function initUpdater() {
  if (started) return
  started = true
  doUpdate = registerSW({
    onNeedRefresh() { state.needRefresh = true; emit() },
    onRegisteredSW(_url, r) { reg = r || null },
    onRegisterError(e) { state.error = String((e && e.message) || e); emit() },
  })
  // look again whenever the app comes back to the screen, and every hour while it stays open
  const tick = () => { if (document.visibilityState === 'visible' && navigator.onLine) checkForUpdate() }
  document.addEventListener('visibilitychange', tick)
  setInterval(tick, 60 * 60 * 1000)
}

export async function checkForUpdate() {
  if (!navigator.onLine) return { ...state, offline: true }
  state.checking = true; state.error = ''; emit()
  try {
    if (reg) {
      await reg.update()
      const w = reg.installing
      if (w) await Promise.race([new Promise((res) => w.addEventListener('statechange', () => w.state === 'installed' && res())), wait(8000)])
      await wait(300)
    }
    state.lastChecked = Date.now()
  } catch (e) { state.error = String((e && e.message) || e) }
  state.checking = false; emit()
  return { ...state }
}

// Activates the waiting version and reloads the app. Unsent offline changes live in the phone's storage, so they survive.
export const applyUpdate = () => { if (doUpdate) doUpdate(true); else location.reload() }

export function useUpdate() {
  const [s, setS] = useState({ ...state })
  useEffect(() => { subs.add(setS); setS({ ...state }); return () => { subs.delete(setS) } }, [])
  return s
}
