import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  // the version people see in Settings > App comes from package.json ("version"), plus the moment this build was made
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt': a new version waits until the person taps Update, so a half-filled form is never wiped by a surprise reload
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png'],
      manifest: false,
      workbox: {
        // Never cache Supabase API calls: data must always be live.
        navigateFallback: '/index.html',
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i, handler: 'StaleWhileRevalidate', options: { cacheName: 'fonts' } }
        ]
      }
    })
  ]
})
