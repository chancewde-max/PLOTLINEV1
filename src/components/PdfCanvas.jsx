import React, { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { pdfCache } from './pdfCache.js'

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

export default function PdfCanvas({ url, width, height, onReuploadNeeded, pageNumber = 1 }) {
  const canvasRef = useRef(null)
  const [error, setError] = useState(null)
  const [stale, setStale] = useState(false)

  useEffect(() => {
    if (!url) return
    // blob: URLs die on page reload
    if (url.startsWith('blob:')) { setStale(true); return }

    // plotline-pdf: references in-memory pdfCache; stale after reload
    let resolvedBytes = null
    let resolvedPage = pageNumber
    if (url.startsWith('plotline-pdf:')) {
      const [, fileId, pageStr] = url.split(':')
      const bytes = pdfCache.get(fileId)
      if (!bytes) { setStale(true); return }
      resolvedBytes = bytes.slice(0) // copy so pdfjs doesn't consume it
      resolvedPage = parseInt(pageStr) || 1
    }

    let cancelled = false
    setError(null)
    setStale(false)

    const render = async () => {
      try {
        let src
        if (resolvedBytes) {
          src = { data: resolvedBytes }
        } else if (url.startsWith('data:')) {
          src = { data: dataUrlToUint8Array(url) }
        } else {
          src = url
        }

        const pdf = await pdfjsLib.getDocument(src).promise
        if (cancelled) return
        const page = await pdf.getPage(resolvedPage)
        if (cancelled) return

        const canvas = canvasRef.current
        if (!canvas) return

        const viewport0 = page.getViewport({ scale: 1 })
        const dpr = window.devicePixelRatio || 1
        const baseFit = Math.min(width / viewport0.width, height / viewport0.height)
        // Higher resolution so PDF stays sharp when zoomed in for counting.
        // The pixel budget below must cover dpr*5 at the common Retina dpr
        // of 2 (maxDim tops out around SHEET_W=900) — a lower budget was
        // silently clipping the intended dpr*5 multiplier on every
        // HiDPI/Retina screen, rendering the plan under native pixel
        // density (visibly soft/blurry) even before any zooming.
        const maxDim = Math.max(viewport0.width, viewport0.height) * baseFit
        const multiplier = Math.min(dpr * 5, 9000 / maxDim)
        const scale = baseFit * multiplier

        const viewport = page.getViewport({ scale })
        canvas.width = viewport.width
        canvas.height = viewport.height
        // Do NOT force 100%/100% — that stretches when aspect ratios differ.
        // object-fit: contain (set in JSX) handles sizing without distortion.

        const ctx = canvas.getContext('2d')
        await page.render({ canvasContext: ctx, viewport }).promise
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    }

    render()
    return () => { cancelled = true }
  }, [url, width, height, pageNumber])

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
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'top left', display: 'block', pointerEvents: 'none', zIndex: 0 }} />
  )
}
