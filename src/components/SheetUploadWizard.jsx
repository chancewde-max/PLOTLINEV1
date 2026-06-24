import React, { useState, useRef, useEffect, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Upload, X, ChevronRight, CheckCircle, Loader, Square, ChevronLeft, Check } from 'lucide-react'
import { Button } from './ui/Button.jsx'
import { pdfCache } from './pdfCache.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

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

// Render just the rect region of a PDF page at high res, returns a dataURL
async function renderRectCrop(bytes, pageNum, rect, cropW = 320) {
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise
  const page = await pdf.getPage(pageNum)
  const vp0 = page.getViewport({ scale: 1 })
  const dpr = Math.max(window.devicePixelRatio || 1, 2)
  // Scale so the cropped region fills cropW logical pixels
  const scale = (cropW / (rect.w * vp0.width)) * dpr
  const vp = page.getViewport({ scale })
  // Offset the viewport so the rect region starts at (0,0)
  const offsetX = -rect.x * vp0.width * scale
  const offsetY = -rect.y * vp0.height * scale
  const cropH = Math.round(rect.h * vp0.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = cropW * dpr
  canvas.height = cropH
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const transform = [scale, 0, 0, scale, offsetX, offsetY]
  await page.render({ canvasContext: ctx, viewport: { ...vp, transform } }).promise
  return canvas.toDataURL('image/png')
}

async function renderPageFull(bytes, pageNum, targetW = 1600) {
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise
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

async function extractTextInRect(bytes, pageNum, rect) {
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise
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
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise
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
  const containerRef = useRef(null)
  const canvasWrapRef = useRef(null)
  const canvasHostRef = useRef(null)

  const page = pages[idx]

  // Render the current page at full res
  useEffect(() => {
    if (!page) return
    setLoading(true); setCanvas(null); setRect(null); setPreview(null); setExtracted(null)
    const bytes = pdfCache.get(page.fileId)
    if (!bytes) { setLoading(false); return }
    let cancelled = false
    renderPageFull(bytes, page.pageIndex).then(c => {
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

  const getRelPos = (e) => {
    const r = canvasWrapRef.current.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    }
  }

  const onMouseDown = e => {
    e.preventDefault()
    const pos = getRelPos(e)
    setDragging(pos); setPreview({ x: pos.x, y: pos.y, w: 0, h: 0 }); setRect(null); setExtracted(null)
  }
  const onMouseMove = e => {
    if (!dragging) return
    const pos = getRelPos(e)
    setPreview({ x: Math.min(dragging.x, pos.x), y: Math.min(dragging.y, pos.y), w: Math.abs(pos.x - dragging.x), h: Math.abs(pos.y - dragging.y) })
  }
  const onMouseUp = async e => {
    if (!dragging) return
    const pos = getRelPos(e)
    const r = { x: Math.min(dragging.x, pos.x), y: Math.min(dragging.y, pos.y), w: Math.abs(pos.x - dragging.x), h: Math.abs(pos.y - dragging.y) }
    setDragging(null)
    if (r.w < 0.01 || r.h < 0.01) { setPreview(null); return }
    setRect(r); setPreview(r)
    const bytes = pdfCache.get(page.fileId)
    if (bytes) {
      setExtracting(true)
      try { const t = await extractTextInRect(bytes, page.pageIndex, r); setExtracted(t) }
      finally { setExtracting(false) }
    }
  }

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
        <span style={{ fontSize: 12, color: '#888' }}>Drag a rectangle around the {fieldLabel}</span>
        <div style={{ flex: 1 }} />
        <button onClick={onCancel} style={{ background: 'none', border: '1px solid #444', borderRadius: 6, cursor: 'pointer', color: '#ccc', padding: '6px 14px', fontSize: 13 }}>Cancel</button>
        <button onClick={handleSave} disabled={!rect}
          style={{ background: rect ? 'var(--brand-600)' : '#333', border: 'none', borderRadius: 6, cursor: rect ? 'pointer' : 'default', color: rect ? '#fff' : '#666', padding: '6px 16px', fontSize: 13, fontWeight: 600 }}>
          Save and apply to all ({pages.length})
        </button>
      </div>

      {/* PDF canvas area */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px', background: '#2a2a2a' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#aaa', marginTop: 80 }}>
            <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> Rendering…
          </div>
        )}
        {!loading && canvas && (
          <div ref={canvasWrapRef} style={{ position: 'relative', cursor: 'crosshair', userSelect: 'none', boxShadow: '0 4px 32px rgba(0,0,0,0.6)', display: 'inline-block' }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
            <div ref={canvasHostRef} />
            {preview && <div style={rectStyle(preview)} />}
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
  useEffect(() => {
    if (!rect) { setDataUrl(null); return }
    let cancelled = false
    const bytes = pdfCache.get(page.fileId)
    if (!bytes) return
    renderRectCrop(bytes, page.pageIndex, rect, 320).then(url => {
      if (!cancelled) setDataUrl(url)
    })
    return () => { cancelled = true }
  }, [page.fileId, page.pageIndex, rect?.x, rect?.y, rect?.w, rect?.h])

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
      // If field was empty, fill it with extracted text
      if (pickerField === 'sheetNum' && !p.sheetNum) updated.sheetNum = text
      if (pickerField === 'title' && !p.title) updated.title = text
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
