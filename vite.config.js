import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
