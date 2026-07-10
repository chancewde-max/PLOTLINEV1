import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Test-only config: disables HMR websocket so Playwright+Firefox doesn't trip
// on the _onWebSocketOpened assertion during navigation. App behavior is identical.
export default defineConfig({
  plugins: [react()],
  server: { hmr: false },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('pdfjs-dist')) return 'pdfjs'
            if (id.includes('tesseract.js') || id.includes('tesseract')) return 'tesseract'
            if (
              id.includes('/react/') ||
              id.includes('react-dom') ||
              id.includes('react-router-dom') ||
              id.includes('scheduler')
            ) {
              return 'react-vendor'
            }
            if (id.includes('lucide-react')) return 'icons'
          }
          return undefined
        },
      },
    },
  },
})
