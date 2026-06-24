import React, { useState, useRef, useEffect, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { createWorker } from 'tesseract.js'
import { Upload, X, ChevronRight, CheckCircle, Loader, Square, ChevronLeft, Check } from 'lucide-react'
import { Button } from './ui/Button.jsx'
import { pdfCache } from './pdfCache.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

let ocrWorker = null
let ocrWorkerLoading = null
function getOcrWorker() {
  if (ocrWorker) return Promise.resolve(ocrWorker)
  if (ocrWorkerLoading) return ocrWorkerLoading
  ocrWorkerLoading = createWorker('eng').then(w => { ocrWorker = w; ocrWorkerLoading = null; return w })
  return ocrWorkerLoading
}
// Call this early so OCR is ready by the time user draws a rect
export function preloadOcrWorker() { getOcrWorker() }

// pdfjs document cache — keyed by fileId, avoids re-parsing bytes on every render
const pdfDocCache = new Map()
async function getPdfDoc(fileId, bytes) {
  if (pdfDocCache.has(fileId)) return pdfDocCache.get(fileId)
  const promise = pdfjsLib.getDocument({ data: bytes.slice(0) }).promise
  pdfDocCache.set(fileId, promise)
  return promise
}

// ---- Helpers ----------------------------------------------------------------

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = e => res(e.target.result)
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}

async function renderPageThumb(page, thumbW = 220) {
  const vp0 = page.getViewport({ scale: 1 })
  const scale = thumbW / vp0.width
  const vp = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = vp.width; canvas.height = vp.height
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
  return { thumb: canvas.toDataURL('image/jpeg', 0.75), aspect: vp.height / vp.width }
}

// Render just the rect region of a PDF page at high res, returns a dataURL.
// Renders the full page at a scale where rect.w fills cropW pixels, then
// uses drawImage to extract just that region — handles rotated pages correctly.
async function renderRectCrop(fileId, bytes, pageNum, rect, cropW = 320) {
  const pdf = await getPdfDoc(fileId, bytes)
  const page = await pdf.getPage(pageNum)
  const dpr = Math.max(window.devicePixelRatio || 1, 2)
  const vp0 = page.getViewport({ scale: 1 })
  // Scale so the rect's width maps to cropW*dpr device pixels
  const scale = (cropW * dpr) / (rect.w * vp0.width)
  const vp = page.getViewport({ scale })
  // Render full page at this scale
  const full = document.createElement('canvas')
  full.width = Math.round(vp.width)
  full.height = Math.round(vp.height)
  const fctx = full.getContext('2d')
  fctx.fillStyle = '#fff'
  fctx.fillRect(0, 0, full.width, full.height)
  await page.render({ canvasContext: fctx, viewport: vp }).promise
  // Crop the rect region from the rendered canvas (y from top, matches screen coords)
  const srcX = Math.round(rect.x * full.width)
  const srcY = Math.round(rect.y * full.height)
  const srcW = Math.round(rect.w * full.width)
  const srcH = Math.round(rect.h * full.height)
  const out = document.createElement('canvas')
  out.width = cropW * dpr
  out.height = Math.max(1, srcH)
  const ctx = out.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(full, srcX, srcY, srcW, srcH, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}

async function renderPageFull(fileId, bytes, pageNum, targetW = 1600) {
  const pdf = await getPdfDoc(fileId, bytes)
  const page = await pdf.getPage(pageNum)
  const vp0 = page.getViewport({ scale: 1 })
  const dpr = Math.max(window.devicePixelRatio || 1, 2) // at least 2× for crispness
  const scale = (targetW / vp0.width) * dpr
  const vp = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = vp.width; canvas.height = vp.height
  // CSS size = logical pixels (targetW wide)
  canvas.style.width = `${targetW}px`
  canvas.style.height = `${Math.round(targetW * vp0.height / vp0.width)}px`
  canvas.style.display = 'block'
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
  return canvas
}

async function extractEmbeddedText(fileId, bytes, pageNum, rect) {
  const pdf = await getPdfDoc(fileId, bytes)
  const page = await pdf.getPage(pageNum)
  const vp = page.getViewport({ scale: 1 })
  const textContent = await page.getTextContent()
  const items = textContent.items.filter(item => {
    const nx = item.transform[4] / vp.width
    const ny = 1 - item.transform[5] / vp.height
    return nx >= rect.x && nx <= rect.x + rect.w && ny >= rect.y && ny <= rect.y + rect.h
  })
  return items.map(i => i.str).join(' ').trim()
}

// OCR a rect directly from the picker's already-rendered high-res canvas.
// Avoids re-rendering the PDF and sidesteps any scale/coordinate mismatch.
async function ocrFromPickerCanvas(pickerCanvas, rect) {
  const sx = Math.round(rect.x * pickerCanvas.width)
  const sy = Math.round(rect.y * pickerCanvas.height)
  const sw = Math.max(1, Math.round(rect.w * pickerCanvas.width))
  const sh = Math.max(1, Math.round(rect.h * pickerCanvas.height))

  // Ensure minimum size for Tesseract (aim for text ~40px tall)
  const MIN_W = 800
  const outW = Math.max(sw, MIN_W)
  const outH = Math.round(sh * outW / sw)

  const crop = document.createElement('canvas')
  crop.width = outW; crop.height = outH
  const ctx = crop.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, outW, outH)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(pickerCanvas, sx, sy, sw, sh, 0, 0, outW, outH)

  // Gentle contrast boost: stretch to [0,255] then light sharpen
  const img = ctx.getImageData(0, 0, outW, outH)
  const d = img.data
  // Find actual min/max luminance for contrast stretch
  let lo = 255, hi = 0
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    if (lum < lo) lo = lum; if (lum > hi) hi = lum
  }
  const range = Math.max(1, hi - lo)
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    const v = Math.round(Math.max(0, Math.min(255, ((lum - lo) / range) * 255)))
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)

  const worker = await getOcrWorker()
  const psm = outH < outW * 0.35 ? '7' : '6' // PSM 7 = single line, 6 = block
  await worker.setParameters({ tessedit_pagesegmode: psm })
  const { data } = await worker.recognize(crop)
  return data.text.replace(/\s+/g, ' ').trim()
}

function guessSheetNumber(items) {
  const text = items.map(i => i.str).join(' ')
  const patterns = [
    /\b([A-Z]{1,3}[0-9]{1,2}\.[0-9]{2}[A-Z]?)\b/,
    /\b([A-Z]{1,3}-[0-9]{1,3}[A-Z]?)\b/,
    /\b([A-Z]{1,2}[0-9]{3})\b/,
    /\b([A-Z][0-9]\.[0-9]{2})\b/,
  ]
  for (const re of patterns) { const m = text.match(re); if (m) return m[1] }
  return ''
}

function guessTitle(items) {
  const lines = []
  let cur = '', lastY = null
  for (const item of items) {
    if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) { if (cur.trim()) lines.push(cur.trim()); cur = '' }
    cur += item.str + ' '; lastY = item.transform[5]
  }
  if (cur.trim()) lines.push(cur.trim())
  const candidates = lines.filter(l => {
    const s = l.replace(/[^a-zA-Z]/g, '')
    return s.length >= 4 && l.length <= 80 && !/^\s*[A-Z][0-9]/.test(l)
  })
  return candidates[candidates.length - 1] || ''
}

async function processPdfFile(file, onPageDone) {
  const dataUrl = await fileToDataUrl(file)
  const bytes = dataUrlToUint8Array(dataUrl)
  const fileId = `pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`
  pdfCache.set(fileId, bytes)
  const pdf = await getPdfDoc(fileId, bytes)
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const [thumbData, textContent] = await Promise.all([renderPageThumb(page), page.getTextContent()])
    pages.push({
      id: `sheet-${Date.now()}-${i}`,
      fileName: file.name,
      pageIndex: i,
      totalPages: pdf.numPages,
      thumb: thumbData.thumb,
      thumbAspect: thumbData.aspect,
      sheetNum: guessSheetNumber(textContent.items),
      title: guessTitle(textContent.items),
      fileId,
      sheetNumRect: null,
      titleRect: null,
    })
    onPageDone && onPageDone(pages.length)
  }
  return pages
}

// ---- Stepper ----------------------------------------------------------------
const STEPS = ['Files', 'Sheet numbers', 'Titles']

function Stepper({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 20 }}>
      {STEPS.map((label, i) => {
        const done = i < step, active = i === step
        return (
          <React.Fragment key={label}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: done || active ? 'var(--brand-600)' : 'var(--surface-sunken)', border: `2px solid ${done || active ? 'var(--brand-600)' : 'var(--border-default)'}`, color: done || active ? '#fff' : 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>
                {done ? <CheckCircle size={13} /> : i + 1}
              </div>
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? 'var(--brand-600)' : done ? 'var(--text-muted)' : 'var(--text-subtle)', whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div style={{ width: 56, height: 2, background: done ? 'var(--brand-600)' : 'var(--border-default)', margin: '0 6px', marginBottom: 18 }} />}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ---- Drop zone --------------------------------------------------------------
function DropZone({ onFiles }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const handleDrop = useCallback(e => {
    e.preventDefault(); setDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf')
    if (files.length) onFiles(files)
  }, [onFiles])
  return (
    <div onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{ border: `2px dashed ${dragging ? 'var(--brand-600)' : 'var(--border-strong)'}`, borderRadius: 12, background: dragging ? 'var(--brand-50)' : 'var(--surface-sunken)', padding: '52px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none' }}>
      <input ref={inputRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
        onChange={e => { const files = Array.from(e.target.files).filter(f => f.type === 'application/pdf'); if (files.length) onFiles(files) }} />
      <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
        <Upload size={24} style={{ color: 'var(--brand-600)' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-strong)', marginBottom: 4 }}>Drag PDF files here or click to browse</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Multi-page PDFs are automatically split into individual sheets</div>
      </div>
    </div>
  )
}

// ---- Full-page area picker --------------------------------------------------
// Shows the actual PDF at full resolution; user draws a rect; can navigate pages.
// On "Save and apply" the rect is applied to all selected pages (passed as `pages`).
function FullPageAreaPicker({ pages, startIndex = 0, field, onSave, onCancel }) {
  const [idx, setIdx] = useState(startIndex)
  const [canvas, setCanvas] = useState(null)
  const [loading, setLoading] = useState(false)
  const [rect, setRect] = useState(null)       // normalized {x,y,w,h}
  const [dragging, setDragging] = useState(null)
  const [preview, setPreview] = useState(null)
  const [extracted, setExtracted] = useState(null)
  const [extracting, setExtracting] = useState(false)
  // zoom/pan
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [spaceDown, setSpaceDown] = useState(false)
  const [panning, setPanning] = useState(null) // { startX, startY, panX, panY }
  const containerRef = useRef(null)
  const canvasWrapRef = useRef(null)
  const canvasHostRef = useRef(null)
  const scaleRef = useRef(1)
  const panRef = useRef({ x: 0, y: 0 })

  scaleRef.current = scale
  panRef.current = pan

  const page = pages[idx]

  // Space key for pan mode
  useEffect(() => {
    const down = e => { if (e.code === 'Space') { e.preventDefault(); setSpaceDown(true) } }
    const up = e => { if (e.code === 'Space') setSpaceDown(false) }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  // Render the current page at full res
  useEffect(() => {
    if (!page) return
    setLoading(true); setCanvas(null); setRect(null); setPreview(null); setExtracted(null)
    setScale(1); setPan({ x: 0, y: 0 })
    const bytes = pdfCache.get(page.fileId)
    if (!bytes) { setLoading(false); return }
    let cancelled = false
    renderPageFull(page.fileId, bytes, page.pageIndex).then(c => {
      if (!cancelled) { setCanvas(c); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [page?.fileId, page?.pageIndex])

  // Mount the canvas element into the DOM
  useEffect(() => {
    const host = canvasHostRef.current
    if (!host || !canvas) return
    host.innerHTML = ''
    host.appendChild(canvas)
  }, [canvas])

  // Scroll to zoom
  const onWheel = useCallback(e => {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const delta = -e.deltaY * (e.deltaMode === 1 ? 30 : 1)
    const zoomFactor = delta > 0 ? 1.08 : 1 / 1.08
    const newScale = Math.max(0.25, Math.min(8, scaleRef.current * zoomFactor))
    const ratio = newScale / scaleRef.current
    setPan(p => ({
      x: mouseX - ratio * (mouseX - p.x),
      y: mouseY - ratio * (mouseY - p.y),
    }))
    setScale(newScale)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  // Convert client coords → normalized canvas coords, accounting for zoom/pan
  const clientToNorm = useCallback((clientX, clientY) => {
    const container = containerRef.current
    const wrap = canvasWrapRef.current
    if (!container || !wrap) return { x: 0, y: 0 }
    const cr = container.getBoundingClientRect()
    // Position in container space
    const cx = clientX - cr.left
    const cy = clientY - cr.top
    // Undo pan+scale to get position in canvas CSS pixel space
    const canvasX = (cx - panRef.current.x) / scaleRef.current
    const canvasY = (cy - panRef.current.y) / scaleRef.current
    // Normalize by canvas CSS size (style.width / style.height)
    const cssW = parseFloat(wrap.firstChild?.style?.width || wrap.offsetWidth)
    const cssH = parseFloat(wrap.firstChild?.style?.height || wrap.offsetHeight)
    return {
      x: Math.max(0, Math.min(1, canvasX / cssW)),
      y: Math.max(0, Math.min(1, canvasY / cssH)),
    }
  }, [])

  const onMouseDown = useCallback(e => {
    e.preventDefault()
    if (spaceDown) {
      setPanning({ startX: e.clientX, startY: e.clientY, panX: panRef.current.x, panY: panRef.current.y })
      return
    }
    const pos = clientToNorm(e.clientX, e.clientY)
    setDragging(pos); setPreview({ x: pos.x, y: pos.y, w: 0, h: 0 }); setRect(null); setExtracted(null)
  }, [spaceDown, clientToNorm])

  const onMouseMove = useCallback(e => {
    if (panning) {
      setPan({ x: panning.panX + e.clientX - panning.startX, y: panning.panY + e.clientY - panning.startY })
      return
    }
    if (!dragging) return
    const pos = clientToNorm(e.clientX, e.clientY)
    setPreview({ x: Math.min(dragging.x, pos.x), y: Math.min(dragging.y, pos.y), w: Math.abs(pos.x - dragging.x), h: Math.abs(pos.y - dragging.y) })
  }, [panning, dragging, clientToNorm])

  const onMouseUp = useCallback(async e => {
    if (panning) { setPanning(null); return }
    if (!dragging) return
    const pos = clientToNorm(e.clientX, e.clientY)
    const r = { x: Math.min(dragging.x, pos.x), y: Math.min(dragging.y, pos.y), w: Math.abs(pos.x - dragging.x), h: Math.abs(pos.y - dragging.y) }
    setDragging(null)
    if (r.w < 0.005 || r.h < 0.005) { setPreview(null); return }
    setRect(r); setPreview(r)
    setExtracting(true)
    try {
      // 1. Try fast embedded text extraction from PDF
      const bytes = pdfCache.get(page.fileId)
      let t = bytes ? await extractEmbeddedText(page.fileId, bytes, page.pageIndex, r) : ''
      // 2. Fall back to OCR on the picker's already-rendered canvas
      if (!t && canvas) t = await ocrFromPickerCanvas(canvas, r)
      setExtracted(t)
    } finally { setExtracting(false) }
  }, [panning, dragging, clientToNorm, page])

  const handleSave = () => {
    onSave(rect, extracted || '', pages.map(p => p.id))
  }

  const rectStyle = r => r ? ({
    position: 'absolute', left: `${r.x * 100}%`, top: `${r.y * 100}%`,
    width: `${r.w * 100}%`, height: `${r.h * 100}%`,
    border: '2px solid var(--brand-600)', background: 'rgba(37,140,98,0.12)',
    pointerEvents: 'none', boxSizing: 'border-box',
  }) : null

  const fieldLabel = field === 'sheetNum' ? 'sheet number' : 'title'
  const cursor = spaceDown ? (panning ? 'grabbing' : 'grab') : 'crosshair'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: '#1a1a1a', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 48, background: '#111', borderBottom: '1px solid #333', flexShrink: 0 }}>
        <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
          style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#555' : '#ccc', padding: 4, display: 'flex' }}>
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontSize: 13, color: '#aaa', minWidth: 70, textAlign: 'center' }}>{idx + 1} of {pages.length}</span>
        <button onClick={() => setIdx(i => Math.min(pages.length - 1, i + 1))} disabled={idx === pages.length - 1}
          style={{ background: 'none', border: 'none', cursor: idx === pages.length - 1 ? 'default' : 'pointer', color: idx === pages.length - 1 ? '#555' : '#ccc', padding: 4, display: 'flex' }}>
          <ChevronRight size={18} />
        </button>
        <div style={{ width: 1, height: 24, background: '#333', margin: '0 4px' }} />
        <span style={{ fontSize: 13, color: '#ccc', textTransform: 'capitalize' }}>{fieldLabel}:</span>
        <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: extracting ? '#888' : extracted ? '#5ecb8f' : '#888', minWidth: 80 }}>
          {extracting ? 'reading…' : extracted || (rect ? 'No text found' : 'Draw a rectangle')}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#888' }}>Scroll to zoom · Hold Space to pan · Drag to draw area</span>
        <div style={{ flex: 1 }} />
        <button onClick={onCancel} style={{ background: 'none', border: '1px solid #444', borderRadius: 6, cursor: 'pointer', color: '#ccc', padding: '6px 14px', fontSize: 13 }}>Cancel</button>
        <button onClick={handleSave} disabled={!rect || extracting}
          style={{ background: rect && !extracting ? 'var(--brand-600)' : '#333', border: 'none', borderRadius: 6, cursor: rect && !extracting ? 'pointer' : 'default', color: rect && !extracting ? '#fff' : '#666', padding: '6px 16px', fontSize: 13, fontWeight: 600 }}>
          {extracting ? 'Reading…' : `Save and apply to all (${pages.length})`}
        </button>
      </div>

      {/* PDF canvas area */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#2a2a2a', cursor }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={e => { if (panning) setPanning(null); if (dragging) setDragging(null) }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#aaa', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
            <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> Rendering…
          </div>
        )}
        {!loading && canvas && (
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <div ref={canvasWrapRef} style={{ position: 'absolute', transformOrigin: '0 0', transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`, userSelect: 'none', boxShadow: '0 4px 32px rgba(0,0,0,0.6)', display: 'inline-block' }}>
              <div ref={canvasHostRef} style={{ position: 'relative' }}>
                {preview && <div style={rectStyle(preview)} />}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ---- Crisp crop preview from PDF bytes -------------------------------------
function CropPreview({ page, rect }) {
  const [dataUrl, setDataUrl] = useState(null)
  const key = rect ? `${rect.x},${rect.y},${rect.w},${rect.h}` : null
  useEffect(() => {
    if (!rect) { setDataUrl(null); return }
    let cancelled = false
    const bytes = pdfCache.get(page.fileId)
    if (!bytes) return
    renderRectCrop(page.fileId, bytes, page.pageIndex, rect, 320).then(url => {
      if (!cancelled) setDataUrl(url)
    })
    return () => { cancelled = true }
  }, [page.fileId, page.pageIndex, key])

  if (!rect) return <div style={{ fontSize: 11, color: 'var(--text-subtle)', fontStyle: 'italic' }}>No area set</div>
  if (!dataUrl) return <div style={{ width: 140, height: 44, borderRadius: 4, background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-subtle)' }} /></div>
  return <img src={dataUrl} alt="area preview" style={{ maxWidth: 180, maxHeight: 60, borderRadius: 4, border: '1px solid var(--border-subtle)', display: 'block', imageRendering: 'crisp-edges' }} />
}

// ---- Sheet table row --------------------------------------------------------
function SheetRow({ page, field, checked, onCheck, onUpdate, onRemove, rowH, onPickArea }) {
  const thumbH = rowH
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '36px minmax(120px,1.2fr) minmax(80px,1fr) 1fr 32px', gap: 0, alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', background: checked ? 'var(--brand-50)' : 'transparent', transition: 'background 0.1s' }}>
      {/* Checkbox */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: thumbH + 20 }}>
        <input type="checkbox" checked={checked} onChange={e => onCheck(e.target.checked)}
          style={{ width: 15, height: 15, accentColor: 'var(--brand-600)', cursor: 'pointer' }} />
      </div>
      {/* File + thumbnail */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px 10px 0' }}>
        <div style={{ width: thumbH * 0.75, height: thumbH, flexShrink: 0, borderRadius: 4, overflow: 'hidden', background: '#f5f5f3', border: '1px solid var(--border-subtle)' }}>
          <img src={page.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-strong)', wordBreak: 'break-word', lineHeight: 1.3 }}>{page.fileName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Page {page.pageIndex}{page.totalPages > 1 ? ` of ${page.totalPages}` : ''}</div>
        </div>
      </div>
      {/* Area crop preview — rendered from PDF at full resolution */}
      <div style={{ padding: '10px 8px', display: 'flex', alignItems: 'center' }}>
        <CropPreview page={page} rect={field === 'sheetNum' ? page.sheetNumRect : page.titleRect} />
      </div>
      {/* Editable field */}
      <div style={{ padding: '0 8px' }}>
        <input
          value={field === 'sheetNum' ? page.sheetNum : page.title}
          onChange={e => onUpdate(page.id, field === 'sheetNum' ? 'sheetNum' : 'title', e.target.value)}
          placeholder={field === 'sheetNum' ? 'e.g. L0.00' : 'Sheet title…'}
          style={{ width: '100%', padding: '6px 10px', fontSize: 13, fontFamily: field === 'sheetNum' ? 'var(--font-mono)' : undefined, border: '1px solid var(--border-default)', borderRadius: 6, background: 'var(--surface-input)', color: 'var(--text-strong)', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>
      {/* Remove */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button onClick={() => onRemove(page.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: 4, borderRadius: 4, display: 'flex' }}>
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

// ---- Main wizard ------------------------------------------------------------
export default function SheetUploadWizard({ open, onClose, onImport }) {
  const [step, setStep] = useState(0)
  const [pages, setPages] = useState([])
  const [processing, setProcessing] = useState(false)
  const [processingMsg, setProcessingMsg] = useState('')
  const [selected, setSelected] = useState(new Set()) // selected page ids
  const [pickerField, setPickerField] = useState(null) // 'sheetNum' | 'title'
  const [rowH, setRowH] = useState(80)

  // Pre-load OCR worker as soon as wizard opens so it's ready when user draws a rect
  useEffect(() => { if (open) getOcrWorker() }, [open])

  const reset = () => { setStep(0); setPages([]); setProcessing(false); setPickerField(null); setSelected(new Set()) }
  const handleClose = () => { reset(); onClose() }

  const handleFiles = async (files) => {
    setProcessing(true)
    const allPages = []
    for (let i = 0; i < files.length; i++) {
      setProcessingMsg(`Processing ${files[i].name} (${i + 1}/${files.length})…`)
      const pgs = await processPdfFile(files[i])
      allPages.push(...pgs)
    }
    setPages(allPages)
    setSelected(new Set(allPages.map(p => p.id)))
    setProcessing(false)
    setStep(1)
  }

  const updatePage = (id, field, value) => setPages(ps => ps.map(p => p.id === id ? { ...p, [field]: value } : p))
  const removePage = (id) => { setPages(ps => ps.filter(p => p.id !== id)); setSelected(s => { const n = new Set(s); n.delete(id); return n }) }

  const allChecked = pages.length > 0 && pages.every(p => selected.has(p.id))
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(pages.map(p => p.id)))
  const toggleOne = (id, on) => setSelected(s => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n })

  // Pages to show in the picker = currently selected (or all if none selected)
  const pickerPages = pages.filter(p => selected.size === 0 || selected.has(p.id))

  const handlePickerSave = (rect, text, pageIds) => {
    const rectField = pickerField === 'sheetNum' ? 'sheetNumRect' : 'titleRect'
    const idSet = new Set(pageIds)
    setPages(ps => ps.map(p => {
      if (!idSet.has(p.id)) return p
      const updated = { ...p, [rectField]: rect }
      if (text) {
        if (pickerField === 'sheetNum') updated.sheetNum = text
        if (pickerField === 'title') updated.title = text
      }
      return updated
    }))
    setPickerField(null)
  }

  const handleImport = () => {
    const sheetArr = pages.map((p, idx) => ({
      id: p.id,
      name: p.title || p.sheetNum || `Sheet ${idx + 1}`,
      code: p.sheetNum || `S-${idx + 1}`,
      pdfUrl: `plotline-pdf:${p.fileId}:${p.pageIndex}`,
      pdfPage: p.pageIndex,
      pxPerFt: null,
      areas: [], lines: [], points: [],
    }))
    onImport(sheetArr)
    handleClose()
  }

  if (!open) return null

  const field = step === 1 ? 'sheetNum' : 'title'
  const selectedCount = selected.size

  return (
    <>
      {/* Show area picker as full overlay */}
      {pickerField && pickerPages.length > 0 && (
        <FullPageAreaPicker
          pages={pickerPages}
          startIndex={0}
          field={pickerField}
          onSave={handlePickerSave}
          onCancel={() => setPickerField(null)}
        />
      )}

      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={e => e.target === e.currentTarget && handleClose()}>
        <div style={{ background: 'var(--surface-paper)', borderRadius: 16, boxShadow: 'var(--shadow-xl)', width: '92vw', maxWidth: 900, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px 0' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-strong)' }}>Add sheets</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Import PDF plans as individual takeoff sheets</div>
            </div>
            <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, display: 'flex' }}><X size={20} /></button>
          </div>

          <div style={{ padding: '16px 24px 0' }}><Stepper step={step} /></div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 8px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

            {/* Step 0 — Files */}
            {step === 0 && (
              processing ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '56px 0' }}>
                  <Loader size={28} style={{ color: 'var(--brand-600)', animation: 'spin 1s linear infinite' }} />
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{processingMsg}</div>
                </div>
              ) : <DropZone onFiles={handleFiles} />
            )}

            {/* Step 1 — Sheet numbers / Step 2 — Titles */}
            {(step === 1 || step === 2) && (
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 8px', borderBottom: '2px solid var(--border-subtle)', flexShrink: 0 }}>
                  <input type="checkbox" checked={allChecked} onChange={toggleAll}
                    style={{ width: 15, height: 15, accentColor: 'var(--brand-600)', cursor: 'pointer', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 90 }}>
                    {selectedCount > 0 ? `${selectedCount} of ${pages.length} selected` : `${pages.length} sheets`}
                  </span>
                  <button
                    onClick={() => setPickerField(field)}
                    disabled={pages.length === 0}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1px solid var(--border-default)', borderRadius: 7, background: 'var(--surface-card)', cursor: pages.length === 0 ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-strong)', opacity: pages.length === 0 ? 0.5 : 1 }}>
                    <Square size={13} strokeWidth={1.5} />
                    Draw {step === 1 ? 'sheet number' : 'title'} area
                    {selectedCount > 0 && <span style={{ fontSize: 11, color: 'var(--brand-600)', fontWeight: 700 }}>({selectedCount})</span>}
                  </button>
                </div>

                {/* Column headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '36px minmax(120px,1.2fr) minmax(80px,1fr) 1fr 32px', gap: 0, padding: '6px 0 4px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                  <div />
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: 0 }}>File / Thumbnail</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Area preview</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{step === 1 ? 'Sheet number' : 'Title'}</div>
                  <div />
                </div>

                {/* Rows */}
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  {pages.map(p => (
                    <SheetRow
                      key={p.id}
                      page={p}
                      field={field}
                      checked={selected.has(p.id)}
                      onCheck={on => toggleOne(p.id, on)}
                      onUpdate={updatePage}
                      onRemove={removePage}
                      rowH={rowH}
                      onPickArea={() => { setSelected(new Set([p.id])); setPickerField(field) }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-paper)', flexShrink: 0, gap: 16 }}>
            {/* Row height slider */}
            {(step === 1 || step === 2) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Row height</span>
                <input type="range" min="56" max="160" step="8" value={rowH} onChange={e => setRowH(+e.target.value)}
                  style={{ width: 90, accentColor: 'var(--brand-600)' }} />
              </div>
            )}
            {step === 0 && <div />}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 'auto' }}>
              <Button variant="ghost" onClick={step === 0 ? handleClose : () => setStep(s => s - 1)}>
                {step === 0 ? 'Cancel' : 'Back'}
              </Button>
              {step === 0 && !processing && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Select files to continue</span>}
              {step === 1 && (
                <Button variant="primary" iconRight={<ChevronRight size={15} />} onClick={() => setStep(2)} disabled={pages.length === 0}>
                  Next to titles
                </Button>
              )}
              {step === 2 && (
                <Button variant="primary" onClick={handleImport} disabled={pages.length === 0}>
                  Import {pages.length} sheet{pages.length !== 1 ? 's' : ''}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  )
}
