// Version of THIS copy of the app. Set from package.json at build time (see vite.config.js).
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : ''

const parts = (v) => String(v || '0').split('.').map((n) => parseInt(n, 10) || 0)
// -1, 0 or 1, comparing "2.10.0" and "2.9.0" the way people expect
export function versionCmp(a, b) {
  const x = parts(a), y = parts(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0)
    if (d) return d > 0 ? 1 : -1
  }
  return 0
}
// true when version `a` is older than the required minimum `min` (an empty minimum means no lock)
export const versionLt = (a, min) => !!min && versionCmp(a, min) < 0
