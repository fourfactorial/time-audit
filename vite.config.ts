import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const repo_name = `time-audit`;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Let vite-plugin-pwa generate and register the service worker automatically.
      // In dev (npm run dev) the SW is available; in production Workbox generates
      // a full precache manifest.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true,
        type: 'module',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'Time Tracking and Analytics',
        short_name: 'Time Tracker',
        description: "Know how much time you're spending on different tasks",
        theme_color: '#131210',
        background_color: '#131210',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          { src: `/${repo_name}/icons/32.png`, sizes: '32x32', type: 'image/png' },
          { src: `/${repo_name}/icons/192.png`, sizes: '192x192', type: 'image/png' },
          { src: `/${repo_name}/icons/512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ]
})
