import React, { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

export default function PdfCanvas({ url, width, height }) {
  const canvasRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!url) return
    let cancelled = false

    const render = async () => {
      try {
        const pdf = await pdfjsLib.getDocument(url).promise
        if (cancelled) return
        const page = await pdf.getPage(1)
        if (cancelled) return

        const canvas = canvasRef.current
        if (!canvas) return

        const viewport0 = page.getViewport({ scale: 1 })
        const scaleX = width / viewport0.width
        const scaleY = height / viewport0.height
        const scale = Math.min(scaleX, scaleY) * (window.devicePixelRatio || 1)

        const viewport = page.getViewport({ scale })
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = '100%'
        canvas.style.height = '100%'

        const ctx = canvas.getContext('2d')
        await page.render({ canvasContext: ctx, viewport }).promise
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    }

    render()
    return () => { cancelled = true }
  }, [url, width, height])

  if (error) return <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#999' }}>PDF error: {error}</div>

  return (
    <canvas ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none', zIndex: 0 }} />
  )
}
