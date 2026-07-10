import React, { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { UploadCloud, FileSpreadsheet, Trash2, AlertTriangle, ArrowRight, Table2, Layers } from 'lucide-react'
import { useAppData } from '../data/useAppData.jsx'
import { Button } from './ui/Button.jsx'
import s from './MtoPanel.module.css'

// Canonical MTO fields the rest of the app understands. The user will supply
// the exact Excel layout later, so every field can be mapped to an arbitrary
// source column via `columnMap`.
const CANONICAL = [
  { key: 'item', label: 'Item / Code', required: false, numeric: false },
  { key: 'description', label: 'Description', required: false, numeric: false },
  { key: 'qty', label: 'Qty', required: false, numeric: true },
  { key: 'unit', label: 'Unit', required: false, numeric: false },
  { key: 'unitPrice', label: 'Unit Price', required: false, numeric: true },
  { key: 'total', label: 'Total', required: false, numeric: true },
]

// Auto-detect a canonical field from a raw Excel header by case-insensitive
// substring match. Order matters: check the most specific keywords first.
function detectField(header) {
  const h = String(header || '').toLowerCase()
  if (!h) return null
  if (h.includes('desc')) return 'description'
  if (h.includes('total')) return 'total'
  if (h.includes('price')) return 'unitPrice'
  if (h.includes('quant') || h.includes('qty')) return 'qty'
  if (h.includes('unit')) return 'unit'
  if (h.includes('sku') || h.includes('code') || h.includes('item')) return 'item'
  return null
}

function buildColumnMap(headers) {
  const map = {}
  const used = new Set()
  for (const header of headers) {
    const field = detectField(header)
    if (field && !used.has(field) && !map[field]) {
      map[field] = header
      used.add(field)
    }
  }
  return map
}

function toNumber(v) {
  if (v === '' || v == null) return null
  const cleaned = String(v).replace(/[^0-9.\-]/g, '')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function fmt(n) {
  if (n == null) return '—'
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export default function MtoPanel({ projectId, project }) {
  const { updateProject } = useAppData()
  const fileInputRef = useRef(null)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [view, setView] = useState('mapped') // 'mapped' | 'raw'

  const mto = project?.mto
  const headers = mto?.headers || []
  const rows = mto?.rows || []
  const columnMap = mto?.columnMap || {}

  const handleFile = (file) => {
    setError(null)
    if (!file) return
    const name = file.name.toLowerCase()
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      setError(`Unsupported file type: "${file.name}". Please upload an .xlsx, .xls, or .csv file.`)
      return
    }
    const reader = new FileReader()
    reader.onerror = () => setError('Could not read the file. Please try again.')
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result)
        const wb = XLSX.read(data, { type: 'array' })
        if (!wb.SheetNames.length) {
          setError('The workbook has no sheets. Please check the file and re-upload.')
          return
        }
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (!json.length) {
          setError('No data rows were found in the first sheet. Please check the file and re-upload.')
          return
        }
        const cols = Object.keys(json[0])
        if (!cols.length) {
          setError('No columns were detected. Please check the file and re-upload.')
          return
        }
        const map = buildColumnMap(cols)
        updateProject(projectId, {
          mto: {
            fileName: file.name,
            uploadedAt: new Date().toISOString(),
            headers: cols,
            rows: json,
            columnMap: map,
          },
        })
        setView('mapped')
      } catch (e) {
        setError('Failed to parse the file. It may be corrupted or password-protected — please re-export and try again.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const onInputChange = (e) => {
    const file = e.target.files?.[0]
    handleFile(file)
    e.target.value = '' // allow re-uploading the same file
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    handleFile(file)
  }

  const onMapChange = (canonicalKey, header) => {
    updateProject(projectId, {
      mto: { ...mto, columnMap: { ...columnMap, [canonicalKey]: header || '' } },
    })
  }

  const removeMto = () => {
    setError(null)
    updateProject(projectId, { mto: null })
  }

  // ---- Empty state ----
  if (!mto) {
    return (
      <div className={s.root}>
        <div
          className={`${s.dropzone} ${dragOver ? s.drag : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
        >
          <div className={s.dropIcon}><UploadCloud size={22} /></div>
          <div className={s.dropTitle}>Upload an MTO spreadsheet</div>
          <div className={s.dropHint}>
            Drag &amp; drop, or click to browse · .xlsx, .xls, .csv
          </div>
          <Button variant="primary" iconLeft={<UploadCloud size={16} />} size="sm">Upload Excel</Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onInputChange}
            style={{ display: 'none' }}
          />
        </div>
        {error && (
          <div className={`${s.notice} ${s.error}`}>
            <AlertTriangle size={16} className={s.noticeIcon} />
            <span>{error}</span>
          </div>
        )}
      </div>
    )
  }

  // ---- Derived mapped rows ----
  const mappedRows = rows.map((raw) => {
    const out = {}
    for (const f of CANONICAL) {
      const src = columnMap[f.key]
      out[f.key] = src ? raw[src] : ''
    }
    return out
  })
  const unmapped = CANONICAL.filter((f) => !columnMap[f.key])

  // Mapped total (only if qty & unitPrice both mapped, otherwise use total col)
  let lineTotal = 0
  let hasTotals = false
  for (const r of mappedRows) {
    const q = toNumber(r.qty)
    const p = toNumber(r.unitPrice)
    const t = toNumber(r.total)
    if (t != null) { lineTotal += t; hasTotals = true }
    else if (q != null && p != null) { lineTotal += q * p; hasTotals = true }
  }

  const uploadedAtStr = mto.uploadedAt
    ? new Date(mto.uploadedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : ''

  return (
    <div className={s.root}>
      {/* File bar */}
      <div className={s.fileBar}>
        <FileSpreadsheet size={20} style={{ color: 'var(--brand-600)' }} />
        <div className={s.fileMeta}>
          <div className={s.fileName}>
            {mto.fileName}
            <span className={s.fileSub}>{rows.length} row{rows.length !== 1 ? 's' : ''}</span>
          </div>
          <div className={s.fileSub}>Uploaded {uploadedAtStr}</div>
        </div>
        <div className={s.spacer} />
        <Button variant="ghost" iconLeft={<Trash2 size={15} />} size="sm" onClick={removeMto}>Remove</Button>
      </div>

      {/* View toggle + unmapped warning */}
      <div className={s.toolbar}>
        <div className={s.toggle}>
          <button
            className={`${s.toggleBtn} ${view === 'mapped' ? s.active : ''}`}
            onClick={() => setView('mapped')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Layers size={13} /> Mapped
            </span>
          </button>
          <button
            className={`${s.toggleBtn} ${view === 'raw' ? s.active : ''}`}
            onClick={() => setView('raw')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Table2 size={13} /> Raw
            </span>
          </button>
        </div>
        {view === 'mapped' && (
          <div className={s.chips}>
            <span className={s.chip}>Items <b>{rows.length}</b></span>
            {hasTotals && <span className={s.chip}>MTO total <b>${fmt(lineTotal)}</b></span>}
            {unmapped.length > 0 && (
              <span className={s.chip} style={{ color: 'var(--warning-500)', borderColor: 'color-mix(in srgb, var(--warning-500) 30%, transparent)' }}>
                {unmapped.length} field{unmapped.length !== 1 ? 's' : ''} unmapped
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className={`${s.notice} ${s.error}`}>
          <AlertTriangle size={16} className={s.noticeIcon} />
          <span>{error}</span>
        </div>
      )}

      {/* ---- Mapped view ---- */}
      {view === 'mapped' && (
        <>
          <div>
            <div className={s.sectionLabel}>Column mapping</div>
            <div className={s.mapCard}>
              <div className={s.mapGrid}>
                {CANONICAL.map((f) => {
                  const mapped = !!columnMap[f.key]
                  return (
                    <div key={f.key} className={s.mapField}>
                      <label className={s.mapLabel}>
                        {f.label}{f.required && <span className={s.req}>*</span>}
                      </label>
                      <select
                        className={`${s.select} ${mapped ? s.mapped : ''}`}
                        value={columnMap[f.key] || ''}
                        onChange={(e) => onMapChange(f.key, e.target.value)}
                      >
                        <option value="">— not mapped —</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div>
            <div className={s.sectionLabel}>Mapped take-off</div>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    {CANONICAL.map((f) => (
                      <th key={f.key} className={f.numeric ? s.num : ''}>
                        {f.label}
                        {!columnMap[f.key] && <span className={s.colMissing}> · —</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mappedRows.map((r, i) => (
                    <tr key={i}>
                      {CANONICAL.map((f) => (
                        <td key={f.key} className={f.numeric ? s.num : (columnMap[f.key] ? '' : s.colMissing)}>
                          {columnMap[f.key] ? (f.numeric ? fmt(toNumber(r[f.key])) : String(r[f.key])) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ---- Raw view ---- */}
      {view === 'raw' && (
        <div>
          <div className={s.sectionLabel}>Raw spreadsheet ({headers.length} columns)</div>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    {headers.map((h) => <td key={h}>{r[h] === '' ? '—' : String(r[h])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Re-upload */}
      <div>
        <input
          ref={(el) => { fileInputRef.current = el }}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={onInputChange}
          style={{ display: 'none' }}
        />
        <Button variant="secondary" iconLeft={<UploadCloud size={15} />} size="sm"
          onClick={() => fileInputRef.current?.click()}>
          Replace file
        </Button>
      </div>
    </div>
  )
}
