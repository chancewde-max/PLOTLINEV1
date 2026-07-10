import React, { useRef, useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import {
  UploadCloud, FileSpreadsheet, Trash2, AlertTriangle, Layers, Table2,
  Plus, Sparkles, Check, Tag, ChevronRight,
} from 'lucide-react'
import { useAppData } from '../data/useAppData.jsx'
import { Button } from './ui/Button.jsx'
import { Input } from './ui/Input.jsx'
import { Dialog } from './ui/Dialog.jsx'
import s from './MtoPanel.module.css'

// ---------------------------------------------------------------------------
// Canonical MTO fields the rest of the app understands. A version's `columnMap`
// maps each canonical KEY -> a SOURCE HEADER (or null when unmapped).
// ---------------------------------------------------------------------------
const CANONICAL = [
  { key: 'item', label: 'Item / Code', numeric: false },
  { key: 'description', label: 'Description', numeric: false },
  { key: 'qty', label: 'Qty', numeric: true },
  { key: 'unit', label: 'Unit', numeric: false },
  { key: 'unitPrice', label: 'Unit Price', numeric: true },
  { key: 'total', label: 'Total', numeric: true },
]

const NULL_MAP = () =>
  CANONICAL.reduce((acc, f) => (acc[f.key] = null, acc), {})

// ---------------------------------------------------------------------------
// HEURISTIC AUTO-MAP (Phase 1 — no LLM, dependency-free)
// 3-stage mapper: normalize -> alias/substring + fuzzy -> confidence.
// ---------------------------------------------------------------------------

// Canonical alias dictionaries. Strong aliases (exact/known tokens) win; the
// shorter lists are also matched loosely via edit distance as a fallback.
const ALIASES = {
  item: ['item', 'item #', 'item number', 'part', 'part #', 'part number', 'sku', 'code', 'material', 'mat', 'id', 'model'],
  description: ['desc', 'description', 'descript', 'name', 'product', 'detail', 'notes', 'spec'],
  qty: ['qty', 'quantity', 'quant', 'count', 'ea', 'each', 'units', 'amount', 'qty ordered'],
  unit: ['unit', 'uom', 'u/m', 'measure', 'um', 'lf', 'sf', 'ea', 'suffix'],
  unitPrice: ['price', 'unit price', 'unit cost', 'rate', 'cost', 'unit rate', '$/unit', 'price ea'],
  total: ['total', 'line total', 'extended', 'amount total', 'sum', 'ext price', 'total price'],
}

// Tokenize a header into comparable chunks (lowercased, punctuation stripped).
function normalizeHeader(h) {
  return String(h ?? '')
    .toLowerCase()
    .replace(/[#@*()]/g, ' ')
    .replace(/[\/\-_]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Classic Levenshtein edit distance — tiny, no deps.
function editDistance(a, b) {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let cur = new Array(n + 1).fill(0)
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    [prev, cur] = [cur, prev]
  }
  return prev[n]
}

// A near match is allowed when the two strings are short and close, or one is a
// substring of the other, OR the token sets overlap significantly.
function fuzzyScore(normHeader, alias) {
  if (!normHeader) return { matched: false }
  if (normHeader === alias) return { matched: true, strong: true }
  if (normHeader.includes(alias) || alias.includes(normHeader)) {
    // Substring containment: strong if the alias is the dominant token.
    const ratio = Math.min(normHeader.length, alias.length) / Math.max(normHeader.length, alias.length)
    return { matched: true, strong: ratio > 0.5 }
  }
  // Token overlap
  const ht = new Set(normHeader.split(' ').filter(Boolean))
  const at = new Set(alias.split(' ').filter(Boolean))
  let overlap = 0
  for (const t of at) if (ht.has(t)) overlap++
  if (overlap === at.size && at.size > 0) return { matched: true, strong: at.size >= normHeader.split(' ').length }
  // Edit-distance fallback for short tokens (≤ 12 chars), allow ≤ 2 edits.
  if (normHeader.length <= 12 && alias.length <= 12 && editDistance(normHeader, alias) <= 2) {
    return { matched: true, strong: false }
  }
  return { matched: false }
}

// Build a columnMap guess + per-field confidence ('high' | 'weak' | 'none').
function heuristicMap(headers) {
  const map = NULL_MAP()
  const confidence = NULL_MAP() // null | 'high' | 'weak'
  const used = new Set() // source headers already claimed by a stronger field

  // First pass: strong matches only.
  for (const f of CANONICAL) {
    for (const header of headers) {
      if (used.has(header)) continue
      const score = fuzzyScore(normalizeHeader(header), ALIASES[f.key][0]) // primary strong alias
      // Also test the full alias list for a strong exact/substring hit.
      let strong = false
      for (const alias of ALIASES[f.key]) {
        const sc = fuzzyScore(normalizeHeader(header), alias)
        if (sc.matched && sc.strong) { strong = true; break }
      }
      if (strong) {
        map[f.key] = header
        confidence[f.key] = 'high'
        used.add(header)
        break
      }
    }
  }

  // Second pass: weak/fuzzy matches for any still-unmapped field.
  for (const f of CANONICAL) {
    if (confidence[f.key]) continue
    for (const header of headers) {
      if (used.has(header)) continue
      let weak = false
      for (const alias of ALIASES[f.key]) {
        const sc = fuzzyScore(normalizeHeader(header), alias)
        if (sc.matched) { weak = true; break }
      }
      if (weak) {
        map[f.key] = header
        confidence[f.key] = 'weak'
        used.add(header)
        break
      }
    }
  }

  // Third pass: confidence "none" for anything still unmapped.
  for (const f of CANONICAL) {
    if (!confidence[f.key]) confidence[f.key] = null
  }

  return { map, confidence }
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

// ---------------------------------------------------------------------------
export default function MtoPanel({ projectId, project }) {
  const {
    mtoTemplates, addMtoTemplate, updateMtoTemplate,
    addMtoVersion, setCurrentMtoVersion, removeMtoVersion, updateMtoVersion,
  } = useAppData()

  const versions = useMemo(() => Array.isArray(project?.mtoVersions) ? project.mtoVersions : [], [project])
  const current = versions.find(v => v.isCurrent) || versions[versions.length - 1] || null

  const fileInputRef = useRef(null)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [view, setView] = useState('mapped') // 'mapped' | 'raw'

  // New-MTO modal (Blank / From Template)
  const [newModal, setNewModal] = useState(false)
  const [templateName, setTemplateName] = useState('')

  // Review mapping UI: draft map + confidence for the current version once a
  // file is parsed but before the human confirms & saves.
  const [review, setReview] = useState(null) // { map, confidence } when active

  const headers = current?.headers || []
  const rows = current?.rows || []
  const columnMap = current?.columnMap || {}

  // ---- NEW MTO: create a version ----
  const createBlank = () => {
    addMtoVersion(projectId, {
      v: versions.length + 1,
      templateId: null,
      rows: [],
      columnMap: NULL_MAP(),
      reviewed: false,
    })
    setNewModal(false)
    setReview(null)
    setView('mapped')
  }

  const createFromTemplate = (tpl) => {
    addMtoVersion(projectId, {
      v: versions.length + 1,
      templateId: tpl.id,
      // Seed with the template's saved headers + canonical mapping so the user
      // can immediately upload a matching file or fill manually.
      headers: [...(tpl.sampleHeaders || [])],
      columnMap: { ...NULL_MAP(), ...(tpl.canonicalMapping || {}) },
      rows: [],
      reviewed: false,
    })
    setNewModal(false)
    setReview(null)
    setView('mapped')
  }

  // ---- Upload Excel and run heuristic ----
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
        const { map, confidence } = heuristicMap(cols)
        if (!current) {
          // No version yet — create one seeded with this upload.
          addMtoVersion(projectId, {
            v: 1,
            templateId: null,
            fileName: file.name,
            uploadedAt: new Date().toISOString(),
            headers: cols,
            rows: json,
            columnMap: map,
            reviewed: false,
          })
          setReview(null)
        } else {
          // Store parsed data + the heuristic guess on the version, but hold
          // the mapping in "review" until the human confirms (Save mapping).
          updateMtoVersion(projectId, current.id, {
            fileName: file.name,
            uploadedAt: new Date().toISOString(),
            headers: cols,
            rows: json,
          })
          setReview({ map, confidence })
        }
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

  // ---- Review mapping handlers ----
  // Works in two modes:
  //  • review active  -> mutate the draft `review` state (not yet saved)
  //  • no review       -> edit the already-saved columnMap directly
  const confidenceFor = (canonicalKey, header) => {
    if (!header) return null
    let strong = false
    for (const alias of ALIASES[canonicalKey]) {
      const sc = fuzzyScore(normalizeHeader(header), alias)
      if (sc.matched && sc.strong) { strong = true; break }
    }
    return strong ? 'high' : 'weak'
  }

  const onReviewChange = (canonicalKey, header) => {
    if (review) {
      setReview(prev => {
        if (!prev) return prev
        const map = { ...prev.map, [canonicalKey]: header || null }
        const confidence = { ...prev.confidence, [canonicalKey]: confidenceFor(canonicalKey, header || null) }
        return { map, confidence }
      })
    } else if (current) {
      updateMtoVersion(projectId, current.id, {
        columnMap: { ...columnMap, [canonicalKey]: header || null },
      })
    }
  }

  const saveReview = () => {
    if (!current) return
    if (review) {
      updateMtoVersion(projectId, current.id, {
        columnMap: review.map,
        reviewed: true,
      })
      setReview(null)
    } else {
      // Already-saved mapping being tweaked directly — mark as reviewed/confirmed.
      updateMtoVersion(projectId, current.id, { reviewed: true })
    }
  }

  const saveAsTemplate = () => {
    const src = review ? review.map : columnMap
    const srcHeaders = current?.headers || []
    const tname = templateName.trim() || current?.fileName || 'MTO template'
    addMtoTemplate({
      name: tname,
      ownerAccountId: 'local',
      canonicalMapping: { ...src },
      sampleHeaders: [...srcHeaders],
    })
    setTemplateName('')
    setError(null)
    setNewModal(false)
  }

  const removeVersion = () => {
    if (!current) return
    removeMtoVersion(projectId, current.id)
    setReview(null)
    setError(null)
  }

  const switchVersion = (id) => {
    setCurrentMtoVersion(projectId, id)
    setReview(null)
    setError(null)
  }

  // ---- Derived mapped rows (from the saved columnMap) ----
  const activeMap = review ? review.map : columnMap
  const mappedRows = rows.map((raw) => {
    const out = {}
    for (const f of CANONICAL) {
      const src = activeMap[f.key]
      out[f.key] = src ? raw[src] : ''
    }
    return out
  })
  const unmapped = CANONICAL.filter((f) => !activeMap[f.key])

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

  const uploadedAtStr = current?.uploadedAt
    ? new Date(current.uploadedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : ''

  // =====================================================================
  // EMPTY STATE
  // =====================================================================
  if (versions.length === 0) {
    return (
      <div className={s.root}>
        <div className={s.empty}>
          <div className={s.emptyIcon}><FileSpreadsheet size={26} /></div>
          <div className={s.emptyTitle}>No MTO yet</div>
          <div className={s.emptyHint}>
            Upload a material take-off spreadsheet, or start from a saved template.
          </div>
          <Button variant="primary" iconLeft={<Plus size={16} />} size="md" onClick={() => setNewModal(true)}>
            New MTO
          </Button>
        </div>
        <NewMtoModal
          open={newModal}
          onClose={() => setNewModal(false)}
          templates={Object.values(mtoTemplates)}
          onBlank={createBlank}
          onTemplate={createFromTemplate}
        />
        {error && (
          <div className={`${s.notice} ${s.error}`}>
            <AlertTriangle size={16} className={s.noticeIcon} />
            <span>{error}</span>
          </div>
        )}
      </div>
    )
  }

  // =====================================================================
  // VERSION EXISTS
  // =====================================================================
  return (
    <div className={s.root}>
      {/* Version switcher */}
      <div className={s.versionBar}>
        <div className={s.versionPills}>
          {versions.map((v) => (
            <button
              key={v.id}
              className={`${s.pill} ${v.id === current?.id ? s.pillActive : ''}`}
              onClick={() => switchVersion(v.id)}
              title={v.fileName || (v.templateId ? 'From template' : 'Blank')}
            >
              v{v.v}
              {v.id === current?.id && <span className={s.pillDot} />}
            </button>
          ))}
          <button className={s.pillAdd} onClick={() => setNewModal(true)} title="New version">
            <Plus size={15} />
          </button>
        </div>
        {current && (
          <div className={s.versionMeta}>
            {current.fileName && (
              <span className={s.versionFile}>
                <FileSpreadsheet size={14} /> {current.fileName}
              </span>
            )}
            {current.uploadedAt && (
              <span className={s.versionSub}>{uploadedAtStr}</span>
            )}
          </div>
        )}
      </div>

      {/* Review banner (pending human confirmation) */}
      {review && (
        <div className={`${s.notice} ${s.warn}`}>
          <Sparkles size={16} className={s.noticeIcon} />
          <span>
            We auto-detected a column mapping from <b>{current.fileName}</b>. Review &amp; confirm below, or adjust any dropdown.
          </span>
        </div>
      )}

      {error && (
        <div className={`${s.notice} ${s.error}`}>
          <AlertTriangle size={16} className={s.noticeIcon} />
          <span>{error}</span>
        </div>
      )}

      {/* Upload / replace */}
      <div className={s.uploadRow}>
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
          <UploadCloud size={18} />
          <span>{rows.length ? 'Replace file — drag & drop or click' : 'Upload Excel — .xlsx, .xls, .csv'}</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={onInputChange}
          style={{ display: 'none' }}
        />
        <Button variant="ghost" iconLeft={<Trash2 size={15} />} size="sm" onClick={removeVersion}>
          Remove version
        </Button>
      </div>

      {/* Review mapping table */}
      {rows.length > 0 && (
        <div className={s.reviewCard}>
          <div className={s.reviewHead}>
            <div className={s.sectionLabel}>Review mapping</div>
            <span className={s.reviewHint}>
              {review
                ? 'Bot guess — confirm with one click or adjust.'
                : 'Adjust any dropdown to fix the mapping.'}
            </span>
          </div>
          <div className={s.mapGrid}>
            {CANONICAL.map((f) => {
              const conf = review ? review.confidence[f.key] : null
              const val = (review ? review.map : columnMap)[f.key] || ''
              return (
                <div key={f.key} className={s.mapField}>
                  <label className={s.mapLabel}>
                    {f.label}
                    {conf && <ConfidenceBadge level={conf} />}
                  </label>
                  <select
                    className={`${s.select} ${val ? s.mapped : ''}`}
                    value={val}
                    onChange={(e) => onReviewChange(f.key, e.target.value)}
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
          <div className={s.reviewActions}>
            <Button variant="primary" iconLeft={<Check size={15} />} size="sm" onClick={saveReview}>
              {review ? 'Save mapping' : 'Confirm mapping'}
            </Button>
            <div className={s.saveTemplateWrap}>
              <Input
                size="sm"
                placeholder="Template name…"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                leadingIcon={<Tag size={14} />}
              />
              <Button variant="secondary" iconLeft={<Sparkles size={15} />} size="sm" onClick={saveAsTemplate}>
                Save as template
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: view toggle + chips */}
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
            {current?.reviewed && (
              <span className={s.chip} style={{ color: 'var(--success-500)', borderColor: 'color-mix(in srgb, var(--success-500) 30%, transparent)' }}>
                Reviewed <Check size={12} />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Mapped view */}
      {view === 'mapped' && (
        <div>
          <div className={s.sectionLabel}>Mapped take-off</div>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  {CANONICAL.map((f) => (
                    <th key={f.key} className={f.numeric ? s.num : ''}>
                      {f.label}
                      {!activeMap[f.key] && <span className={s.colMissing}> · —</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mappedRows.map((r, i) => (
                  <tr key={i}>
                    {CANONICAL.map((f) => (
                      <td key={f.key} className={f.numeric ? s.num : (activeMap[f.key] ? '' : s.colMissing)}>
                        {activeMap[f.key] ? (f.numeric ? fmt(toNumber(r[f.key])) : String(r[f.key])) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Raw view */}
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

      <NewMtoModal
        open={newModal}
        onClose={() => setNewModal(false)}
        templates={Object.values(mtoTemplates)}
        onBlank={createBlank}
        onTemplate={createFromTemplate}
        onSaveTemplate={saveAsTemplate}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
function ConfidenceBadge({ level }) {
  const label = level === 'high' ? 'high' : level === 'weak' ? 'weak' : 'unmapped'
  return <span className={`${s.badge} ${s[`badge_${level}`]}`}>{label}</span>
}

// ---------------------------------------------------------------------------
function NewMtoModal({ open, onClose, templates, onBlank, onTemplate }) {
  return (
    <Dialog open={open} onClose={onClose} title="New MTO" description="Start blank or seed from a saved template." width={520}>
      <div className={s.modalSection}>
        <div className={s.modalSectionLabel}>Start blank</div>
        <button className={s.blankCard} onClick={onBlank}>
          <div className={s.blankIcon}><Plus size={18} /></div>
          <div>
            <div className={s.blankTitle}>Blank take-off</div>
            <div className={s.blankSub}>Create an empty v{1} and upload a spreadsheet.</div>
          </div>
          <ChevronRight size={16} className={s.blankArrow} />
        </button>
      </div>

      <div className={s.modalSection}>
        <div className={s.modalSectionLabel}>From template {templates.length > 0 && <span className={s.tplCount}>{templates.length}</span>}</div>
        {templates.length === 0 ? (
          <div className={s.tplEmpty}>No templates yet — upload a file, review the mapping, then “Save as template”.</div>
        ) : (
          <div className={s.tplList}>
            {templates.map((t) => (
              <button key={t.id} className={s.tplCard} onClick={() => onTemplate(t)}>
                <div className={s.tplIcon}><Sparkles size={16} /></div>
                <div className={s.tplInfo}>
                  <div className={s.tplName}>{t.name}</div>
                  <div className={s.tplHeaders}>
                    {(t.sampleHeaders || []).slice(0, 8).join(' · ') || '—'}
                  </div>
                </div>
                <ChevronRight size={16} className={s.blankArrow} />
              </button>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  )
}
