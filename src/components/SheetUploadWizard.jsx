import React, { useState, useRef, useEffect, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { createWorker } from 'tesseract.js'
import { Upload, X, ChevronRight, CheckCircle, Loader, Square, ChevronLeft, Check, Folder } from 'lucide-react'
import { Button } from './ui/Button.jsx'
import { Skeleton } from './Skeleton.jsx'
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
    .catch(err => { ocrWorkerLoading = null; return Promise.reject(err) })
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

// Read file directly as bytes — avoids the wasteful data URL → base64 → binary roundtrip
async function fileToBytes(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = e => res(new Uint8Array(e.target.result))
    reader.onerror = rej
    reader.readAsArrayBuffer(file)
  })
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

// Never let a full-page render (in renderRectCrop / ocrRect below) exceed
// this many pixels per side, no matter how small the selected rect is. Both
// functions solve for "the SELECTED RECT should be N px wide" by scaling
// the ENTIRE page up until that's true — for a small rect (e.g. a corner
// sheet-number box that's a few percent of the page width) on a real
// architectural sheet, that scale factor can blow the full-page canvas up
// to tens of thousands of pixels per side (a 600+ megapixel canvas isn't
// hypothetical — it's what a ~5%-wide rect on a 36"x24" sheet actually
// works out to), enough to hang the tab for 30+ seconds PER PAGE. Capping
// the full-page render trades a bit of crop resolution on unusually small
// selections for guaranteed-bounded render cost — plenty for OCR-ing a
// short sheet code either way.
const MAX_FULL_RENDER_DIM = 3500

// Render just the rect region of a PDF page at high res, returns a dataURL.
// Renders the full page at a scale where rect.w fills cropW pixels, then
// uses drawImage to extract just that region — handles rotated pages correctly.
async function renderRectCrop(fileId, bytes, pageNum, rect, cropW = 320) {
  const pdf = await getPdfDoc(fileId, bytes)
  const page = await pdf.getPage(pageNum)
  const dpr = Math.max(window.devicePixelRatio || 1, 2)
  const vp0 = page.getViewport({ scale: 1 })
  // Scale so the rect's width maps to cropW*dpr device pixels — capped (see
  // MAX_FULL_RENDER_DIM above) so a tiny rect can't blow the full-page
  // render this is derived from up to an unbounded size.
  const idealScale = (cropW * dpr) / (rect.w * vp0.width)
  const capScale = MAX_FULL_RENDER_DIM / Math.max(vp0.width, vp0.height)
  const scale = Math.min(idealScale, capScale)
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

async function renderPageFull(fileId, bytes, pageNum, targetW = 1400) {
  const pdf = await getPdfDoc(fileId, bytes)
  const page = await pdf.getPage(pageNum)
  const vp0 = page.getViewport({ scale: 1 })
  // Cap at the display's ACTUAL pixel ratio (max 2×) — never inflate above it.
  // This used to force a 2× floor even on standard 1× monitors, quadrupling
  // the rasterized pixel count for zero visible benefit (the screen can't
  // show detail it doesn't have). On a real CAD-exported sheet with embedded
  // raster imagery, re-rendered on every page navigation in the picker, that
  // was slow enough to trigger the browser's own "page is slowing down"
  // warning. This is only the overview render for placing the crop
  // rectangle anyway — extractEmbeddedText/ocrRect do their own dedicated
  // high-res re-render of just the selected rect afterward.
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
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

// OCR a rect on a page by rendering just that region at high res and passing to Tesseract.
// Adds padding so edge characters (like a leading "L") aren't clipped.
async function ocrRect(fileId, bytes, pageNum, rect) {
  const pdf = await getPdfDoc(fileId, bytes)
  const page = await pdf.getPage(pageNum)
  const vp0 = page.getViewport({ scale: 1 })
  // Render so the selected rect fills ~1600px wide for high accuracy —
  // capped so the full page it's derived from never exceeds MAX_FULL_RENDER_DIM.
  const idealScale = 1600 / (rect.w * vp0.width)
  const capScale = MAX_FULL_RENDER_DIM / Math.max(vp0.width, vp0.height)
  const scale = Math.min(idealScale, capScale)
  const vp = page.getViewport({ scale })
  const full = document.createElement('canvas')
  full.width = Math.round(vp.width); full.height = Math.round(vp.height)
  const fctx = full.getContext('2d')
  fctx.fillStyle = '#fff'; fctx.fillRect(0, 0, full.width, full.height)
  await page.render({ canvasContext: fctx, viewport: vp }).promise
  // Expand the crop rect by 15% on each side so edge characters aren't cut off
  const pad = 0.15
  const px = rect.x - rect.w * pad; const py = rect.y - rect.h * pad
  const pw = rect.w * (1 + 2 * pad); const ph = rect.h * (1 + 2 * pad)
  const srcX = Math.max(0, Math.round(px * vp.width))
  const srcY = Math.max(0, Math.round(py * vp.height))
  const srcX2 = Math.min(full.width, Math.round((px + pw) * vp.width))
  const srcY2 = Math.min(full.height, Math.round((py + ph) * vp.height))
  const srcW = Math.max(1, srcX2 - srcX)
  const srcH = Math.max(1, srcY2 - srcY)
  // Add white padding border so Tesseract doesn't treat crop edge as page edge
  const border = 20
  const crop = document.createElement('canvas')
  crop.width = srcW + border * 2; crop.height = srcH + border * 2
  const cctx = crop.getContext('2d')
  cctx.fillStyle = '#fff'; cctx.fillRect(0, 0, crop.width, crop.height)
  cctx.drawImage(full, srcX, srcY, srcW, srcH, border, border, srcW, srcH)
  const worker = await getOcrWorker()
  const { data } = await worker.recognize(crop)
  return (data.text || '').replace(/\s+/g, ' ').trim()
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

// How many pages to render/extract-text concurrently. Unbounded concurrency
// (firing every page's render at once) sounds faster but for real plan sets
// (30-100+ pages) it means dozens of canvases + pdf.js render calls all
// contending for the main thread and memory at the same moment — in
// practice that's slower wall-clock time AND a frozen-feeling UI (progress
// text jumps in stalling batches instead of counting up smoothly). A capped
// pool keeps steady throughput without saturating the browser.
const RENDER_CONCURRENCY = 6

// Force a real macrotask yield back to the browser's event loop. Awaiting a
// promise alone (e.g. between pdf.js calls) only yields at the MICROtask
// level — if a single page's render/getTextContent is itself one long
// synchronous stretch inside pdf.js (common for CAD-exported architectural
// sheets with heavy vector content, even at small thumbnail output size),
// back-to-back pages with no macrotask breathing room is exactly what trips
// a browser's "this page is slowing down / unresponsive" watchdog on large
// (30-100+ page) plan sets. This doesn't reduce total processing time, but
// it gives paint/input a checkpoint between every page so the tab stays
// responsive instead of appearing frozen.
const yieldToBrowser = () => new Promise(r => setTimeout(r, 0))

// Fixed-size worker pool: each worker pulls the next item off a shared
// index until none remain, so at most `concurrency` items are ever in
// flight regardless of the list's total length.
async function runPooled(items, concurrency, worker) {
  let next = 0
  const pool = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
    while (next < items.length) {
      const i = next++
      await worker(items[i], i)
    }
  })
  await Promise.all(pool)
}

async function processPdfFile(file, onPageDone) {
  // Read directly as ArrayBuffer — no base64 roundtrip
  const bytes = await fileToBytes(file)
  const fileId = `pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`
  pdfCache.set(fileId, bytes)
  const pdf = await getPdfDoc(fileId, bytes)
  const total = pdf.numPages
  const pages = new Array(total)
  let done = 0
  console.time(`processPdfFile:${file.name}`)

  const renderOne = async (i) => {
    const page = await pdf.getPage(i)
    // Render thumbnail at 160px and extract text concurrently within the page
    const [thumbData, textContent] = await Promise.all([renderPageThumb(page, 160), page.getTextContent()])
    pages[i - 1] = {
      id: `sheet-${Date.now()}-${i}`,
      fileName: file.name,
      pageIndex: i,
      totalPages: total,
      thumb: thumbData.thumb,
      thumbAspect: thumbData.aspect,
      sheetNum: guessSheetNumber(textContent.items),
      title: guessTitle(textContent.items),
      fileId,
      sheetNumRect: null,
      titleRect: null,
    }
    done++
    onPageDone && onPageDone(done, total)
    await yieldToBrowser()
  }

  await runPooled(Array.from({ length: total }, (_, i) => i + 1), RENDER_CONCURRENCY, renderOne)
  console.timeEnd(`processPdfFile:${file.name}`)
  return pages.filter(Boolean)
}

// ---- Stepper ----------------------------------------------------------------
const STEPS = ['Files', 'Sheet numbers', 'Titles', 'Version Set']

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
  const canvasCssSizeRef = useRef({ w: 1, h: 1 }) // logical CSS px dimensions of the rendered page

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
      if (!cancelled) {
        canvasCssSizeRef.current = { w: parseFloat(c.style.width) || c.width, h: parseFloat(c.style.height) || c.height }
        setCanvas(c); setLoading(false)
      }
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
    if (!container) return { x: 0, y: 0 }
    const cr = container.getBoundingClientRect()
    // Position in container space
    const cx = clientX - cr.left
    const cy = clientY - cr.top
    // Undo pan+scale to get position in canvas CSS pixel space
    const canvasX = (cx - panRef.current.x) / scaleRef.current
    const canvasY = (cy - panRef.current.y) / scaleRef.current
    // Normalize by canvas CSS size (stored in ref when canvas is rendered)
    const { w: cssW, h: cssH } = canvasCssSizeRef.current
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
      const bytes = pdfCache.get(page.fileId)
      // Try embedded text first (accurate for CAD/vector PDFs); OCR only as fallback for scanned pages
      let t = bytes ? await extractEmbeddedText(page.fileId, bytes, page.pageIndex, r) : ''
      if (!t) t = await ocrRect(page.fileId, bytes, page.pageIndex, r)
      setExtracted(t)
    } finally { setExtracting(false) }
  }, [panning, dragging, clientToNorm, page])

  const handleSave = () => {
    onSave(rect, extracted || '', pages.map(p => p.id), page.id)
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
          {extracting ? 'reading…' : extracted || (rect ? 'Type manually ↗' : 'Draw a rectangle')}
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
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(70vw, 640px)', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            {/* Layout-shaped skeleton of the page being rendered, not a lonely spinner */}
            <Skeleton width="100%" height={340} radius={8} style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ display: 'flex', gap: 10, width: '60%' }}>
              <Skeleton height={16} style={{ background: 'rgba(255,255,255,0.08)' }} />
              <Skeleton width={90} height={16} style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>
            <span style={{ fontSize: 12, color: '#888' }}>Rendering page…</span>
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
          style={{ width: '100%', padding: '6px 10px', fontSize: 13, fontFamily: field === 'sheetNum' ? 'var(--font-mono)' : undefined, border: '1px solid var(--border-default)', borderRadius: 6, background: 'var(--surface-card)', color: 'var(--text-strong)', outline: 'none', boxSizing: 'border-box' }}
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

// ---- Version set name input ------------------------------------------------
function VersionSetInput({ value, onChange }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Version set name
      </label>
      <input
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
        placeholder="Contract Set - 2024-12-06"
        style={{ width: '100%', padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-mono)', border: '1px solid var(--border-default)', borderRadius: 8, background: 'var(--surface-card)', color: 'var(--text-strong)', outline: 'none', boxSizing: 'border-box' }}
      />
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
  const [versionSetName, setVersionSetName] = useState('')

  // Pre-load OCR worker as soon as wizard opens so it's ready when user draws a rect
  useEffect(() => { if (open) getOcrWorker() }, [open])

  const reset = () => { setStep(0); setPages([]); setProcessing(false); setPickerField(null); setSelected(new Set()); setVersionSetName('') }
  const handleClose = () => { reset(); onClose() }

  const handleFiles = async (files) => {
    setProcessing(true)
    const allPages = []
    for (let i = 0; i < files.length; i++) {
      const fileName = files[i].name
      setProcessingMsg(`Reading ${fileName}…`)
      const pgs = await processPdfFile(files[i], (done, total) => {
        setProcessingMsg(`${fileName} — page ${done} of ${total}…`)
      })
      allPages.push(...pgs)
    }
    // Pre-fill the version-set name with the uploaded PDF's base name.
    // If multiple files were dropped, use the first one as the default suggestion.
    if (allPages.length > 0) {
      setVersionSetName(files[0].name.replace(/\.pdf$/i, ''))
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

  const handlePickerSave = (rect, text, pageIds, currentPageId) => {
    const rectField = pickerField === 'sheetNum' ? 'sheetNumRect' : 'titleRect'
    const textField = pickerField === 'sheetNum' ? 'sheetNum' : 'title'
    const idSet = new Set(pageIds)

    // Apply rect immediately; text only for the page that was displayed in picker
    setPages(ps => ps.map(p => {
      if (!idSet.has(p.id)) return p
      const updated = { ...p, [rectField]: rect }
      if (text && p.id === currentPageId) updated[textField] = text
      return updated
    }))
    setPickerField(null)

    // Background-OCR every other selected page using its own PDF content.
    // Pooled (not one unbounded fire-and-forget per page) — with "select all"
    // on a real 40-100 page plan set this was firing that many concurrent
    // pdf.js + tesseract calls at once with no cap, the same anti-pattern
    // that made the initial file-processing step janky before it was pooled.
    const field = pickerField // capture before async
    const otherPages = pages.filter(p => idSet.has(p.id) && p.id !== currentPageId)
    runPooled(otherPages, RENDER_CONCURRENCY, async (p) => {
      const bytes = pdfCache.get(p.fileId)
      if (!bytes) return
      let t = await extractEmbeddedText(p.fileId, bytes, p.pageIndex, rect)
      if (!t) t = await ocrRect(p.fileId, bytes, p.pageIndex, rect)
      if (t) setPages(ps => ps.map(pg => pg.id === p.id ? { ...pg, [field === 'sheetNum' ? 'sheetNum' : 'title']: t } : pg))
      await yieldToBrowser()
    })
  }

  const handleImport = async () => {
    // Store the ORIGINAL PDF bytes as a data:application/pdf URL (so PdfCanvas
    // can re-parse it with pdfjs after reload, unlike the in-memory
    // plotline-pdf: reference which dies on reload) — but ONCE PER SOURCE
    // FILE, not once per sheet. A multi-page PDF split into N sheets used to
    // embed a full duplicate copy of itself in every one of those N sheets;
    // for a real plan set that's N× the bytes re-saved on every autosave.
    // Sheets now just carry a `pdfAssetId` pointing at a shared map entry.
    const pdfAssets = {}
    for (const fileId of new Set(pages.map(p => p.fileId))) {
      try {
        const bytes = pdfCache.get(fileId)
        if (!bytes) continue
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        pdfAssets[fileId] = `data:application/pdf;base64,${btoa(binary)}`
      } catch (e) { /* leave unset — sheet falls back to plotline-pdf: (session-only) */ }
    }
    const sheetArr = pages.map((p, idx) => ({
      id: p.id,
      name: p.title || p.sheetNum || `Sheet ${idx + 1}`,
      code: p.sheetNum || `S-${idx + 1}`,
      pdfAssetId: pdfAssets[p.fileId] ? p.fileId : null,
      pdfUrl: pdfAssets[p.fileId] ? null : `plotline-pdf:${p.fileId}:${p.pageIndex}`,
      pdfPage: p.pageIndex,
      pxPerFt: null,
      areas: [], lines: [], points: [],
    }))
    onImport(sheetArr, { versionSetName, pdfAssets })
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
>
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

            {/* Step 3 — Version Set */}
                {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '28px 0', maxWidth: 520 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 4 }}>Name this version set</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      This creates a sheet folder and an MTO folder with this name so the imported
                      {pages.length !== 1 ? ` ${pages.length} sheets` : ' sheet'} stay grouped together.
                    </div>
                  </div>
                  <VersionSetInput
                    value={versionSetName}
                    onChange={setVersionSetName}
                  />
                  <div style={{ fontSize: 12, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Folder size={14} style={{ color: 'var(--brand-600)' }} />
                    e.g. “Contract Set - 2024-12-06”
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
                <Button variant="primary" iconRight={<ChevronRight size={15} />} onClick={() => setStep(3)} disabled={pages.length === 0}>
                  Next: Version Set
                </Button>
              )}
              {step === 3 && (
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
