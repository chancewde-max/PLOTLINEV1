import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Pre-bundle the heavy deps that are only reached through lazy-loaded routes
  // (SheetPage's pdf.js/tesseract, xlsx import/export). Without this, Vite
  // discovers them the first time you navigate from the eager landing page into
  // /app and re-optimizes mid-session, which can make that first dynamic import
  // fail before the dev server's auto-reload recovers. Including them here
  // optimizes everything once at startup, so navigation is reliable.
  optimizeDeps: {
    include: ['pdfjs-dist', 'tesseract.js', 'xlsx'],
  },
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
