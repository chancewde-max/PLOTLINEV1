import React, { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export default function PdfCanvas({ url, width, height, onReuploadNeeded }) {
  const canvasRef = useRef(null)
  const [error, setError] = useState(null)
  const [stale, setStale] = useState(false)

  useEffect(() => {
    if (!url) return
    // blob: URLs die on page reload — prompt re-upload instead of erroring
    if (url.startsWith('blob:')) {
      setStale(true)
      return
    }
    let cancelled = false
    setError(null)

    const render = async () => {
      try {
        // data: URLs are decoded to binary for reliable pdfjs parsing
        const src = url.startsWith('data:') ? { data: dataUrlToUint8Array(url) } : url
        const pdf = await pdfjsLib.getDocument(src).promise
        if (cancelled) return
        const page = await pdf.getPage(1)
        if (cancelled) return

        const canvas = canvasRef.current
        if (!canvas) return

        const viewport0 = page.getViewport({ scale: 1 })
        const scaleX = width / viewport0.width
        const scaleY = height / viewport0.height
        // Render at 3× display pixels so the plan stays crisp when zoomed in
        const dpr = window.devicePixelRatio || 1
        const scale = Math.min(scaleX, scaleY) * dpr * 3

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

  const msgStyle = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, color: '#999' }

  if (stale) return (
    <div style={msgStyle}>
      <span>PDF unavailable after reload</span>
      {onReuploadNeeded && (
        <button onClick={onReuploadNeeded}
          style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#444' }}>
          Re-upload PDF
        </button>
      )}
    </div>
  )

  if (error) return <div style={msgStyle}><span>PDF error — try re-uploading</span></div>

  return (
    <canvas ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none', zIndex: 0 }} />
  )
}
