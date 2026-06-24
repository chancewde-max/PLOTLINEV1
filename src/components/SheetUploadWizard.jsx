import React, { useState, useRef, useEffect, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Upload, X, ChevronRight, CheckCircle, Loader, Crosshair } from 'lucide-react'
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

async function renderPageThumb(page, thumbW = 200) {
  const vp0 = page.getViewport({ scale: 1 })
  const scale = thumbW / vp0.width
  const vp = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = vp.width
  canvas.height = vp.height
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
  return { thumb: canvas.toDataURL('image/jpeg', 0.7), aspect: vp.height / vp.width, w: vp.width, h: vp.height }
}

// Extract text within a normalized rect (0-1 coords, y from top)
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

// Guess sheet number from text items
function guessSheetNumber(items) {
  const text = items.map(i => i.str).join(' ')
  const patterns = [
    /\b([A-Z]{1,3}[0-9]{1,2}\.[0-9]{2})\b/,
    /\b([A-Z]{1,3}-[0-9]{1,3}[A-Z]?)\b/,
    /\b([A-Z]{1,2}[0-9]{3})\b/,
    /\b([A-Z][0-9]\.[0-9]{2})\b/,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m) return m[1]
  }
  return ''
}

// Guess title from text items
function guessTitle(items) {
  const lines = []
  let cur = ''
  let lastY = null
  for (const item of items) {
    if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) {
      if (cur.trim()) lines.push(cur.trim())
      cur = ''
    }
    cur += item.str + ' '
    lastY = item.transform[5]
  }
  if (cur.trim()) lines.push(cur.trim())
  const candidates = lines.filter(l => {
    const stripped = l.replace(/[^a-zA-Z]/g, '')
    return stripped.length >= 4 && l.length <= 80 && !/^\s*[A-Z][0-9]/.test(l)
  })
  return candidates[candidates.length - 1] || ''
}

// Process one File: return array of page descriptors
async function processPdfFile(file) {
  const dataUrl = await fileToDataUrl(file)
  const bytes = dataUrlToUint8Array(dataUrl)
  const fileId = `pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`
  pdfCache.set(fileId, bytes)

  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const [thumbData, textContent] = await Promise.all([
      renderPageThumb(page, 200),
      page.getTextContent(),
    ])
    pages.push({
      id: `sheet-${Date.now()}-${i}`,
      fileName: file.name,
      pageIndex: i,
      totalPages: pdf.numPages,
      thumb: thumbData.thumb,
      thumbAspect: thumbData.aspect,
      sheetNum: guessSheetNumber(textContent.items),
      title: guessTitle(textContent.items),
      fileId, // references pdfCache
      sheetNumRect: null,  // normalized rect user drew for sheet # area
      titleRect: null,     // normalized rect user drew for title area
    })
  }
  return pages
}

// ---- Stepper ----------------------------------------------------------------
const STEPS = ['Files', 'Sheet numbers', 'Titles']

function Stepper({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 28 }}>
      {STEPS.map((label, i) => {
        const done = i < step
        const active = i === step
        return (
          <React.Fragment key={label}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done || active ? 'var(--brand-600)' : 'var(--surface-sunken)',
                border: `2px solid ${done || active ? 'var(--brand-600)' : 'var(--border-default)'}`,
                color: done || active ? '#fff' : 'var(--text-muted)',
                fontSize: 12, fontWeight: 700, transition: 'all 0.2s',
              }}>
                {done ? <CheckCircle size={14} /> : i + 1}
              </div>
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? 'var(--brand-600)' : done ? 'var(--text-muted)' : 'var(--text-subtle)', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ width: 64, height: 2, background: done ? 'var(--brand-600)' : 'var(--border-default)', margin: '0 6px', marginBottom: 20, transition: 'background 0.2s' }} />
            )}
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
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf')
    if (files.length) onFiles(files)
  }, [onFiles])

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? 'var(--brand-600)' : 'var(--border-strong)'}`,
        borderRadius: 12,
        background: dragging ? 'var(--brand-50)' : 'var(--surface-sunken)',
        padding: '48px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none',
      }}
    >
      <input ref={inputRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
        onChange={e => {
          const files = Array.from(e.target.files).filter(f => f.type === 'application/pdf')
          if (files.length) onFiles(files)
        }} />
      <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
        <Upload size={24} style={{ color: 'var(--brand-600)' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-strong)', marginBottom: 4 }}>Drag PDF files here or click to browse</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Multi-page PDFs are automatically split into individual sheets</div>
      </div>
    </div>
  )
}

// ---- Area picker overlay ----------------------------------------------------
// Shows a page thumbnail at full width; user drags a rectangle; returns normalized rect
function AreaPickerOverlay({ page, field, onConfirm, onCancel }) {
  const [rect, setRect] = useState(null)       // {x,y,w,h} normalized
  const [dragging, setDragging] = useState(null) // {startX,startY}
  const [preview, setPreview] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState(null)
  const imgRef = useRef(null)

  const getRelPos = (e) => {
    const r = imgRef.current.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }

  const onMouseDown = (e) => {
    e.preventDefault()
    const pos = getRelPos(e)
    setDragging(pos)
    setPreview({ x: pos.x, y: pos.y, w: 0, h: 0 })
    setRect(null)
    setExtracted(null)
  }

  const onMouseMove = (e) => {
    if (!dragging) return
    const pos = getRelPos(e)
    setPreview({
      x: Math.min(dragging.x, pos.x),
      y: Math.min(dragging.y, pos.y),
      w: Math.abs(pos.x - dragging.x),
      h: Math.abs(pos.y - dragging.y),
    })
  }

  const onMouseUp = async (e) => {
    if (!dragging) return
    const pos = getRelPos(e)
    const r = {
      x: Math.min(dragging.x, pos.x),
      y: Math.min(dragging.y, pos.y),
      w: Math.abs(pos.x - dragging.x),
      h: Math.abs(pos.y - dragging.y),
    }
    setDragging(null)
    if (r.w < 0.01 || r.h < 0.01) { setPreview(null); return }
    setRect(r)
    setPreview(r)
    // Extract text from this region
    const bytes = pdfCache.get(page.fileId)
    if (bytes) {
      setExtracting(true)
      try {
        const text = await extractTextInRect(bytes, page.pageIndex, r)
        setExtracted(text)
      } finally {
        setExtracting(false)
      }
    }
  }

  const normToStyle = (r) => r ? ({
    position: 'absolute',
    left: `${r.x * 100}%`,
    top: `${r.y * 100}%`,
    width: `${r.w * 100}%`,
    height: `${r.h * 100}%`,
    border: '2px solid var(--brand-600)',
    background: 'rgba(37,140,98,0.1)',
    pointerEvents: 'none',
  }) : null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{ background: 'var(--surface-paper)', borderRadius: 16, boxShadow: 'var(--shadow-xl)', width: 640, maxWidth: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}>Draw area — {field === 'sheetNum' ? 'sheet number' : 'sheet title'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Drag a rectangle around the text on the plan</div>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          <div style={{ position: 'relative', userSelect: 'none', cursor: 'crosshair' }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
            <img ref={imgRef} src={page.thumb} alt="" style={{ width: '100%', display: 'block', borderRadius: 6, border: '1px solid var(--border-subtle)' }} draggable={false} />
            {preview && <div style={normToStyle(preview)} />}
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {extracting && <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Extracting text…</div>}
          {extracted !== null && !extracting && (
            <div style={{ fontSize: 13, color: 'var(--text-strong)', background: 'var(--surface-sunken)', borderRadius: 6, padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>
              {extracted || <span style={{ color: 'var(--text-subtle)' }}>No text found in this area</span>}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button variant="primary" disabled={!rect} onClick={() => onConfirm(rect, extracted || '')}>
              Use this area
            </Button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ---- Thumbnail --------------------------------------------------------------
function PageThumb({ page }) {
  const h = 80 * (page.thumbAspect || 1.3)
  return (
    <div style={{ width: 80, height: h, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: '#f5f5f5', border: '1px solid var(--border-subtle)' }}>
      <img src={page.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </div>
  )
}

// ---- Main wizard ------------------------------------------------------------
export default function SheetUploadWizard({ open, onClose, onImport }) {
  const [step, setStep] = useState(0)
  const [pages, setPages] = useState([])
  const [processing, setProcessing] = useState(false)
  const [processingMsg, setProcessingMsg] = useState('')
  const [pickerFor, setPickerFor] = useState(null) // { pageId, field }

  const reset = () => { setStep(0); setPages([]); setProcessing(false); setPickerFor(null) }
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
    setProcessing(false)
    setStep(1)
  }

  const updatePage = (id, field, value) => setPages(ps => ps.map(p => p.id === id ? { ...p, [field]: value } : p))
  const removePage = (id) => setPages(ps => ps.filter(p => p.id !== id))

  const openPicker = (pageId, field) => setPickerFor({ pageId, field })

  const handlePickerConfirm = (rect, text) => {
    const { pageId, field } = pickerFor
    const rectField = field === 'sheetNum' ? 'sheetNumRect' : 'titleRect'
    setPages(ps => ps.map(p => p.id === pageId ? { ...p, [field]: text, [rectField]: rect } : p))
    setPickerFor(null)
  }

  const handleImport = () => {
    const sheetArr = pages.map((p, idx) => ({
      id: p.id,
      name: p.title || p.sheetNum || `Sheet ${idx + 1}`,
      code: p.sheetNum || `S-${idx + 1}`,
      pdfUrl: `plotline-pdf:${p.fileId}:${p.pageIndex}`,
      pxPerFt: null,
      areas: [], lines: [], points: [],
    }))
    onImport(sheetArr)
    handleClose()
  }

  if (!open) return null

  const pickerPage = pickerFor ? pages.find(p => p.id === pickerFor.pageId) : null

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={e => e.target === e.currentTarget && handleClose()}>
        <div style={{ background: 'var(--surface-paper)', borderRadius: 16, boxShadow: 'var(--shadow-xl)', width: 720, maxWidth: '96vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-strong)' }}>Add sheets</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Import PDF plans as individual takeoff sheets</div>
            </div>
            <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, display: 'flex' }}>
              <X size={20} />
            </button>
          </div>

          {/* Stepper */}
          <div style={{ padding: '20px 24px 0' }}>
            <Stepper step={step} />
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 8px' }}>

            {/* Step 0 — Files */}
            {step === 0 && (
              processing ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 0' }}>
                  <Loader size={28} style={{ color: 'var(--brand-600)', animation: 'spin 1s linear infinite' }} />
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{processingMsg}</div>
                </div>
              ) : (
                <DropZone onFiles={handleFiles} />
              )
            )}

            {/* Step 1 — Sheet numbers */}
            {step === 1 && (
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  {pages.length} sheet{pages.length !== 1 ? 's' : ''} found · Review and edit sheet numbers
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr 160px 88px 28px', gap: 10, alignItems: 'center', padding: '0 0 6px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Preview</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>File</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sheet #</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pick area</div>
                    <div />
                  </div>
                  {pages.map(p => (
                    <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '84px 1fr 160px 88px 28px', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <PageThumb page={p} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-strong)', marginBottom: 2 }}>{p.fileName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Page {p.pageIndex}{p.totalPages > 1 ? ` of ${p.totalPages}` : ''}</div>
                      </div>
                      <input
                        value={p.sheetNum}
                        onChange={e => updatePage(p.id, 'sheetNum', e.target.value)}
                        placeholder="e.g. L0.00"
                        style={{ width: '100%', padding: '6px 10px', fontSize: 13, fontFamily: 'var(--font-mono)', border: '1px solid var(--border-default)', borderRadius: 6, background: 'var(--surface-input)', color: 'var(--text-strong)', outline: 'none', boxSizing: 'border-box' }}
                      />
                      <button onClick={() => openPicker(p.id, 'sheetNum')}
                        title="Draw area on page to extract sheet number"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', border: `1px solid ${p.sheetNumRect ? 'var(--brand-600)' : 'var(--border-default)'}`, borderRadius: 6, background: p.sheetNumRect ? 'var(--brand-50)' : 'transparent', cursor: 'pointer', fontSize: 11, color: p.sheetNumRect ? 'var(--brand-600)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        <Crosshair size={12} /> Pick
                      </button>
                      <button onClick={() => removePage(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2 — Titles */}
            {step === 2 && (
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Review and edit sheet titles — these appear on the sheet card
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '84px 80px 1fr 88px', gap: 10, alignItems: 'center', padding: '0 0 6px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Preview</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sheet #</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Title</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pick area</div>
                  </div>
                  {pages.map(p => (
                    <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '84px 80px 1fr 88px', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <PageThumb page={p} />
                      <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brand-600)' }}>{p.sheetNum || '—'}</div>
                      <input
                        value={p.title}
                        onChange={e => updatePage(p.id, 'title', e.target.value)}
                        placeholder="Sheet title…"
                        style={{ width: '100%', padding: '6px 10px', fontSize: 13, border: '1px solid var(--border-default)', borderRadius: 6, background: 'var(--surface-input)', color: 'var(--text-strong)', outline: 'none', boxSizing: 'border-box' }}
                      />
                      <button onClick={() => openPicker(p.id, 'title')}
                        title="Draw area on page to extract title"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', border: `1px solid ${p.titleRect ? 'var(--brand-600)' : 'var(--border-default)'}`, borderRadius: 6, background: p.titleRect ? 'var(--brand-50)' : 'transparent', cursor: 'pointer', fontSize: 11, color: p.titleRect ? 'var(--brand-600)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        <Crosshair size={12} /> Pick
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-paper)' }}>
            <Button variant="ghost" onClick={step === 0 ? handleClose : () => setStep(s => s - 1)}>
              {step === 0 ? 'Cancel' : 'Back'}
            </Button>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {pages.length > 0 && step > 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pages.length} sheet{pages.length !== 1 ? 's' : ''}</span>
              )}
              {step === 0 && !processing && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Select files to continue</span>
              )}
              {step === 1 && (
                <Button variant="primary" iconRight={<ChevronRight size={15} />} onClick={() => setStep(2)} disabled={pages.length === 0}>
                  Review titles
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

      {/* Area picker overlay */}
      {pickerFor && pickerPage && (
        <AreaPickerOverlay
          page={pickerPage}
          field={pickerFor.field}
          onConfirm={handlePickerConfirm}
          onCancel={() => setPickerFor(null)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  )
}
