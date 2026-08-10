import React, { useMemo, useState, useEffect } from 'react'
import {
  LayoutDashboard, MapPin, Package, Truck, ShoppingCart, ClipboardList,
  CalendarDays, ListChecks, Users, ClipboardCheck, Plus, Trash2,
  Download, ChevronRight, ChevronDown, RotateCw,
} from 'lucide-react'
import { Button } from './ui/Button.jsx'
import { Input } from './ui/Input.jsx'
import { Select } from './ui/Select.jsx'
import { useAppData } from '../data/useAppData.jsx'
import { takeoffMaterialItems } from '../data/takeoff.js'

// ---------------------------------------------------------------------------
// Field / Job-management workspace for a CONTRACTED project.
//
// All state lives on `project.field` and is persisted through the normal
// useAppData save flow (localStorage + cloud snapshot) via updateProject.
// On first open it is seeded from the project's takeoff: folders become site
// Areas, and the current MTO version's rows become Materials with a required
// quantity.
// ---------------------------------------------------------------------------

const uid = (p = 'f') => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const TX_TYPES = ['Ordered', 'Delivered', 'Installed']
const nextTxType = (type) => TX_TYPES[Math.min(TX_TYPES.indexOf(type) + 1, TX_TYPES.length - 1)]
const PUNCH_PRIORITIES = ['Low', 'Medium', 'High']
const STATUSES = ['Open', 'In progress', 'Complete']

const MODULES = [
  { id: 'overview',    label: 'Overview',        Icon: LayoutDashboard },
  { id: 'areas',       label: 'Areas',           Icon: MapPin },
  { id: 'materials',   label: 'Materials',       Icon: Package },
  { id: 'deliveries',  label: 'Orders & Deliveries', Icon: Truck },
  { id: 'procurement', label: 'Procurement',     Icon: ShoppingCart },
  { id: 'daily',       label: 'Daily Reports',   Icon: ClipboardList },
  { id: 'schedule',    label: 'Schedule',        Icon: CalendarDays },
  { id: 'punch',       label: 'Punch List',      Icon: ListChecks },
  { id: 'crew',        label: 'Crew & Equipment', Icon: Users },
  { id: 'inspections', label: 'Inspections',     Icon: ClipboardCheck },
]

function emptyField() {
  return {
    seeded: false,
    areas: [], materials: [], requirements: [], transactions: [],
    vendors: [], purchaseOrders: [], changeOrders: [],
    dailyReports: [], scheduleTasks: [], punchItems: [],
    crew: [], equipmentLogs: [], inspections: [],
  }
}

// Pull the current MTO version's priced line items into
// { code, description, unit, qty } materials. Rows are objects keyed by their
// source header (as produced by MtoPanel via sheet_to_json), and `columnMap`
// maps each canonical key -> the source header to read from.
function materialsFromMto(project) {
  const versions = Array.isArray(project?.mtoVersions) ? project.mtoVersions : []
  const current = versions.find(v => v.isCurrent) || versions[versions.length - 1] || null
  if (!current) return []
  const rows = current.rows || []
  const cm = current.columnMap || {}
  const cell = (row, key) => (cm[key] ? row[cm[key]] : undefined)
  const out = []
  for (const r of rows) {
    const code = String(cell(r, 'item') ?? '').trim()
    const description = String(cell(r, 'description') ?? '').trim()
    const unit = String(cell(r, 'unit') ?? '').trim()
    const qty = parseFloat(String(cell(r, 'qty') ?? '').replace(/[^0-9.\-]/g, '')) || 0
    if (!code && !description) continue
    out.push({ code, description, unit, qty })
  }
  return out
}

// The material list that feeds the job — the same list the Material List tab
// shows: on-sheet takeoff quantities merged with any uploaded/priced MTO line
// items. Items are deduped by label + unit so a condition that appears in both
// the takeoff and the priced spreadsheet becomes a single material (the takeoff
// quantity wins, since it's measured from the sheets).
function materialListItems(project, sheets) {
  const merged = []
  const seen = new Set()
  const push = (it) => {
    const label = (it.code || it.description || '').trim().toLowerCase()
    const key = `${label}::${it.unit || ''}`
    if (seen.has(key)) return
    seen.add(key)
    merged.push(it)
  }
  takeoffMaterialItems(project, sheets).forEach(push)
  materialsFromMto(project).forEach(push)
  return merged
}

// Build the initial field state from takeoff data.
function seedField(project, sheets) {
  const f = emptyField()
  f.seeded = true

  // Areas ← folders (sheet sets); fall back to a single whole-site area.
  const folders = project.sheetSets || []
  if (folders.length) {
    f.areas = folders.map((s, i) => ({ id: uid('area'), name: s.name, seq: i + 1 }))
  } else {
    f.areas = [{ id: uid('area'), name: 'Whole site', seq: 1 }]
  }
  const primaryAreaId = f.areas[0]?.id || null

  // Materials ← Material List (takeoff). Each material's full required qty lands
  // on the primary area; the user can split/reassign later.
  const mats = materialListItems(project, sheets)
  f.materials = mats.map(m => ({ id: uid('mat'), code: m.code, description: m.description, unit: m.unit }))
  f.requirements = mats.map((m, i) => ({
    id: uid('req'), areaId: primaryAreaId, materialId: f.materials[i].id, requiredQty: m.qty,
  }))
  return f
}

const fmtMoney = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0 }

// Build a multi-section CSV of the whole field workspace and download it.
function exportFieldCsv(project, field, vendors = []) {
  const areaName = (id) => field.areas.find(a => a.id === id)?.name || ''
  const matLabel = (id) => { const m = field.materials.find(x => x.id === id); return m ? (m.code || m.description || '') : '' }
  const vendorName = (id) => vendors.find(v => v.id === id)?.name || ''
  const tot = (materialId, type) => field.transactions.filter(t => t.materialId === materialId && t.type === type).reduce((s, t) => s + num(t.qty), 0)
  const rows = []
  const section = (title, header, data) => {
    rows.push([title]); rows.push(header)
    if (data.length) data.forEach(r => rows.push(r)); else rows.push(['(none)'])
    rows.push([])
  }
  rows.push(['Job Management Export', project.name, new Date().toLocaleDateString()]); rows.push([])

  section('Areas', ['#', 'Area'], field.areas.map((a, i) => [i + 1, a.name]))
  section('Materials', ['Code', 'Description', 'Unit', 'Required', 'Ordered', 'Delivered', 'Installed', 'Remaining'],
    field.materials.map(m => {
      const required = field.requirements.filter(r => r.materialId === m.id).reduce((s, r) => s + num(r.requiredQty), 0)
      const installed = tot(m.id, 'Installed')
      return [m.code, m.description, m.unit, required, tot(m.id, 'Ordered'), tot(m.id, 'Delivered'), installed, required - installed]
    }))
  section('Material requirements by area', ['Material', 'Area', 'Required'],
    field.requirements.map(r => [matLabel(r.materialId), areaName(r.areaId), num(r.requiredQty)]))
  section('Transactions', ['Date', 'Type', 'Area', 'Material', 'Qty', 'Notes'],
    field.transactions.map(t => [t.date, t.type, areaName(t.areaId), matLabel(t.materialId), num(t.qty), t.notes]))
  section('Vendors', ['Name'], vendors.map(v => [v.name]))
  section('Purchase orders', ['PO #', 'Vendor', 'Description', 'Amount', 'Status', 'Required'],
    field.purchaseOrders.map(p => [p.poNumber, vendorName(p.vendorId), p.description, num(p.amount), p.status, p.requiredDate]))
  section('Change orders', ['CO #', 'Description', 'Amount', 'Status'],
    field.changeOrders.map(c => [c.coNumber, c.description, num(c.amount), c.status]))
  section('Daily reports', ['Date', 'Weather', 'Crew', 'Work completed', 'Issues'],
    field.dailyReports.map(d => [d.date, d.weather, d.manpower, d.workCompleted, d.issues]))
  section('Schedule', ['Task', 'Area', 'Start', 'End', 'Status'],
    field.scheduleTasks.map(t => [t.name, areaName(t.areaId), t.start, t.end, t.status]))
  section('Punch list', ['Item', 'Area', 'Priority', 'Status', 'Due'],
    field.punchItems.map(p => [p.title, areaName(p.areaId), p.priority, p.status, p.dueDate]))
  section('Crew', ['Name', 'Role', 'Phone', 'Status'], field.crew.map(c => [c.name, c.role, c.phone, c.status]))
  section('Equipment log', ['Date', 'Equipment', 'Operator', 'Hours', 'Condition'],
    field.equipmentLogs.map(e => [e.date, e.name, e.operator, num(e.hours), e.condition]))
  section('Inspections', ['Date', 'Type', 'Area', 'Inspector', 'Result'],
    field.inspections.map(i => [i.date, i.type, areaName(i.areaId), i.inspector, i.result]))

  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `Job-${project.name}.csv`.replace(/\s+/g, '_')
  a.click(); URL.revokeObjectURL(url)
}

export default function JobManagement({ projectId, project, sheets }) {
  const { updateProject, vendors, addVendor, deleteVendor } = useAppData()
  const [view, setView] = useState('overview')

  const field = project.field && project.field.seeded ? project.field : null

  // Seed on first open (once), persisting the initial state.
  useEffect(() => {
    if (!project.field || !project.field.seeded) {
      updateProject(projectId, { field: seedField(project, sheets) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const setField = (patch) => {
    const base = project.field && project.field.seeded ? project.field : seedField(project, sheets)
    updateProject(projectId, { field: { ...base, ...patch } })
  }

  // Pull any newly-drawn takeoff conditions into the material list without
  // disturbing quantities the user has already logged or split.
  const syncFromTakeoff = () => {
    if (!field) return
    const items = materialListItems(project, sheets)
    const primary = field.areas[0]?.id || null
    const materials = [...field.materials]
    const requirements = [...field.requirements]
    for (const it of items) {
      const label = (it.code || it.description || '').toLowerCase()
      const exists = materials.find(m => ((m.code || m.description || '').toLowerCase() === label) && m.unit === it.unit)
      if (!exists) {
        const m = { id: uid('mat'), code: it.code, description: it.description, unit: it.unit }
        materials.push(m)
        if (primary) requirements.push({ id: uid('req'), areaId: primary, materialId: m.id, requiredQty: it.qty })
      }
    }
    setField({ materials, requirements })
  }

  // Totals — computed unconditionally so the hook count stays stable across the
  // pre-seed (field null) and post-seed renders. Never early-return before a hook.
  const totals = useMemo(() => {
    const f = field || emptyField()
    const required = f.requirements.reduce((s, r) => s + num(r.requiredQty), 0)
    const installed = f.transactions.filter(t => t.type === 'Installed').reduce((s, t) => s + num(t.qty), 0)
    const committed = f.purchaseOrders.reduce((s, p) => s + num(p.amount), 0)
    const changeTotal = f.changeOrders.reduce((s, c) => s + num(c.amount), 0)
    const openPunch = f.punchItems.filter(p => p.status !== 'Complete').length
    const pct = required > 0 ? Math.min(100, Math.round((installed / required) * 100)) : 0
    return { required, installed, committed, changeTotal, openPunch, pct }
  }, [field])

  if (!field) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Setting up the job workspace…</div>
  }

  const areaName = (id) => field.areas.find(a => a.id === id)?.name || '—'
  const materialLabel = (id) => {
    const m = field.materials.find(x => x.id === id)
    return m ? (m.code || m.description || 'Material') : '—'
  }

  // Aggregate installed/ordered/delivered per (area, material) from transactions.
  const txTotal = (areaId, materialId, type) =>
    field.transactions
      .filter(t => t.areaId === areaId && t.materialId === materialId && t.type === type)
      .reduce((s, t) => s + num(t.qty), 0)

  return (
    <div>
      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {MODULES.map(m => {
            const on = view === m.id
            const Icon = m.Icon
            return (
              <button key={m.id} onClick={() => setView(m.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                  borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${on ? 'var(--brand-600)' : 'var(--border-default)'}`,
                  background: on ? 'var(--brand-600)' : 'transparent',
                  color: on ? '#fff' : 'var(--text-body)',
                }}>
                <Icon size={14} /> {m.label}
              </button>
            )
          })}
        </div>
        <Button variant="secondary" size="sm" iconLeft={<Download size={14} />} onClick={() => exportFieldCsv(project, field, vendors)}>Export CSV</Button>
      </div>

      {view === 'overview'   && <Overview totals={totals} field={field} />}
      {view === 'areas'      && <Areas field={field} setField={setField} totals={totals} txTotal={txTotal} />}
      {view === 'materials'  && <Materials field={field} setField={setField} areaName={areaName} txTotal={txTotal} onSync={syncFromTakeoff} />}
      {view === 'deliveries' && <Deliveries field={field} setField={setField} areaName={areaName} materialLabel={materialLabel} />}
      {view === 'procurement'&& <Procurement field={field} setField={setField} vendors={vendors} addVendor={addVendor} deleteVendor={deleteVendor} />}
      {view === 'daily'      && <DailyReports field={field} setField={setField} />}
      {view === 'schedule'   && <Schedule field={field} setField={setField} areaName={areaName} />}
      {view === 'punch'      && <Punch field={field} setField={setField} areaName={areaName} />}
      {view === 'crew'       && <CrewEquipment field={field} setField={setField} />}
      {view === 'inspections'&& <Inspections field={field} setField={setField} areaName={areaName} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared table primitives
// ---------------------------------------------------------------------------
const th = { textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-subtle)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }
const td = { padding: '8px 10px', fontSize: 13, color: 'var(--text-body)', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' }

function Card({ title, children, right }) {
  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
      {(title || right) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', flex: 1 }}>{title}</div>
          {right}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>{children}</div>
    </div>
  )
}

function Empty({ children }) {
  return <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{children}</div>
}

function Stat({ label, value, accent }) {
  return (
    <div style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 30, fontWeight: 700, color: accent ? 'var(--brand-600)' : 'var(--text-strong)' }}>{value}</div>
    </div>
  )
}

// Little inline "add row" form: renders inputs described by `fields`, calls onAdd(values).
function AddRow({ fields, onAdd, addLabel = 'Add' }) {
  const init = () => fields.reduce((a, f) => (a[f.key] = f.default ?? '', a), {})
  const [vals, setVals] = useState(init)
  const set = (k, v) => setVals(s => ({ ...s, [k]: v }))
  const submit = () => {
    if (fields.some(f => f.required && !String(vals[f.key] ?? '').trim())) return
    onAdd(vals); setVals(init())
  }
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', padding: '12px 16px', background: 'var(--surface-sunken)' }}>
      {fields.map(f => (
        <div key={f.key} style={{ flex: f.grow || '1 1 120px', minWidth: f.minWidth || 100 }}>
          {f.search
            ? <SearchableSelect label={f.label} value={vals[f.key]} options={f.options} onChange={v => set(f.key, v)} onCreate={f.onCreate} placeholder={f.placeholder} />
            : f.options
              ? <Select label={f.label} size="sm" value={vals[f.key]} onChange={e => set(f.key, e.target.value)} options={f.options} />
              : <Input label={f.label} size="sm" type={f.type || 'text'} placeholder={f.placeholder} value={vals[f.key]} onChange={e => set(f.key, e.target.value)} />}
        </div>
      ))}
      <Button variant="primary" size="sm" iconLeft={<Plus size={14} />} onClick={submit}>{addLabel}</Button>
    </div>
  )
}

// A type-to-filter dropdown. `options` are { value, label }. Typing a value not
// in the list and blurring/Entering calls onCreate(text) so new entries (e.g.
// vendors) can be added inline.
function SearchableSelect({ label, value, options, onChange, onCreate, placeholder }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const selected = options.find(o => o.value === value)
  const shown = q.trim() ? options.filter(o => o.label.toLowerCase().includes(q.trim().toLowerCase())) : options
  const exactExists = options.some(o => o.label.toLowerCase() === q.trim().toLowerCase())
  return (
    <div style={{ position: 'relative' }}>
      {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</label>}
      <input
        value={open ? q : (selected?.label || '')}
        placeholder={placeholder || 'Search…'}
        onFocus={() => { setOpen(true); setQ('') }}
        onChange={e => setQ(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => { if (e.key === 'Enter' && q.trim() && !exactExists && onCreate) { const id = onCreate(q.trim()); if (id) onChange(id); setOpen(false) } }}
        style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-strong)' }}
      />
      {open && (
        <div style={{ position: 'absolute', zIndex: 30, top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 200, overflowY: 'auto', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 8, boxShadow: 'var(--shadow-md)' }}>
          {shown.map(o => (
            <button key={o.value} onMouseDown={() => { onChange(o.value); setOpen(false) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 13, background: o.value === value ? 'var(--surface-sunken)' : 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-strong)' }}>
              {o.label}
            </button>
          ))}
          {q.trim() && !exactExists && onCreate && (
            <button onMouseDown={() => { const id = onCreate(q.trim()); if (id) onChange(id); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 13, background: 'transparent', border: 'none', borderTop: shown.length ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer', color: 'var(--brand-600)', fontWeight: 600 }}>
              <Plus size={13} /> Add “{q.trim()}”
            </button>
          )}
          {!shown.length && !q.trim() && <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)' }}>No vendors yet — type to add.</div>}
        </div>
      )}
    </div>
  )
}

function DelBtn({ onClick }) {
  return (
    <button onClick={onClick} aria-label="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: 2, display: 'inline-flex' }}>
      <Trash2 size={14} />
    </button>
  )
}

function IconBtn({ onClick, title, icon: Icon }) {
  return (
    <button onClick={onClick} title={title} aria-label={title} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: 2, display: 'inline-flex', marginRight: 4 }}>
      <Icon size={14} />
    </button>
  )
}

function ProgressBar({ pct }) {
  return (
    <div style={{ background: 'var(--surface-sunken)', borderRadius: 999, height: 8, overflow: 'hidden', minWidth: 80 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand-600)', borderRadius: 999 }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------
function Overview({ totals, field }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Stat label="Material installed" value={`${totals.pct}%`} accent />
        <Stat label="Committed cost" value={fmtMoney(totals.committed)} />
        <Stat label="Open punch items" value={totals.openPunch} />
        <Stat label="Daily reports" value={field.dailyReports.length} />
      </div>
      <Card title="Area progress">
        {field.areas.length === 0 ? <Empty>No areas yet.</Empty> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Area</th><th style={th}>Required</th><th style={th}>Installed</th><th style={th}>Progress</th></tr></thead>
            <tbody>
              {field.areas.map(a => {
                const req = field.requirements.filter(r => r.areaId === a.id).reduce((s, r) => s + num(r.requiredQty), 0)
                const inst = field.transactions.filter(t => t.areaId === a.id && t.type === 'Installed').reduce((s, t) => s + num(t.qty), 0)
                const pct = req > 0 ? Math.min(100, Math.round((inst / req) * 100)) : 0
                return (
                  <tr key={a.id}>
                    <td style={td}>{a.name}</td>
                    <td style={td}>{req.toLocaleString()}</td>
                    <td style={td}>{inst.toLocaleString()}</td>
                    <td style={{ ...td, minWidth: 160 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ProgressBar pct={pct} /> <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{pct}%</span></div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}

function Areas({ field, setField, txTotal }) {
  const add = (v) => setField({ areas: [...field.areas, { id: uid('area'), name: v.name.trim(), seq: field.areas.length + 1 }] })
  const del = (id) => setField({
    areas: field.areas.filter(a => a.id !== id),
    requirements: field.requirements.filter(r => r.areaId !== id),
    transactions: field.transactions.filter(t => t.areaId !== id),
  })
  return (
    <Card title="Site areas">
      {field.areas.length === 0 ? <Empty>No areas yet — add one below.</Empty> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>#</th><th style={th}>Area</th><th style={th}>Required</th><th style={th}>Installed</th><th style={th}></th></tr></thead>
          <tbody>
            {field.areas.map((a, i) => {
              const req = field.requirements.filter(r => r.areaId === a.id).reduce((s, r) => s + num(r.requiredQty), 0)
              const inst = field.transactions.filter(t => t.areaId === a.id && t.type === 'Installed').reduce((s, t) => s + num(t.qty), 0)
              return (
                <tr key={a.id}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{a.name}</td>
                  <td style={td}>{req.toLocaleString()}</td>
                  <td style={td}>{inst.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: 'right' }}><DelBtn onClick={() => del(a.id)} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <AddRow fields={[{ key: 'name', label: 'Area name', required: true, placeholder: 'Building A, Phase 2…', grow: '1 1 240px' }]} onAdd={add} addLabel="Add area" />
    </Card>
  )
}

function Materials({ field, setField, areaName, txTotal, onSync }) {
  const [expanded, setExpanded] = useState(() => new Set())
  const toggleExpand = (id) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const addMaterial = (v) => setField({ materials: [...field.materials, { id: uid('mat'), code: v.code.trim(), description: v.description.trim(), unit: v.unit.trim() }] })
  const delMaterial = (id) => setField({
    materials: field.materials.filter(m => m.id !== id),
    requirements: field.requirements.filter(r => r.materialId !== id),
    transactions: field.transactions.filter(t => t.materialId !== id),
  })
  // Set the required quantity for a (material, area) pair — create, update, or
  // drop the requirement row.
  const setReq = (materialId, areaId, val) => {
    const q = num(val)
    const others = field.requirements.filter(r => !(r.materialId === materialId && r.areaId === areaId))
    const existing = field.requirements.find(r => r.materialId === materialId && r.areaId === areaId)
    const next = q > 0
      ? [...others, { id: existing?.id || uid('req'), areaId, materialId, requiredQty: q }]
      : others
    setField({ requirements: next })
  }
  const reqFor = (materialId, areaId) => field.requirements.find(r => r.materialId === materialId && r.areaId === areaId)?.requiredQty ?? ''
  const colSpan = 9
  return (
    <Card title="Materials — required vs installed"
      right={<Button variant="ghost" size="sm" iconLeft={<Download size={14} style={{ transform: 'rotate(180deg)' }} />} onClick={onSync}>Sync from takeoff</Button>}>

      {field.materials.length === 0 ? <Empty>No materials yet. They seed from your Material List (takeoff) — use “Sync from takeoff”, or add one below.</Empty> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={{ ...th, width: 28 }}></th><th style={th}>Code</th><th style={th}>Description</th><th style={th}>Unit</th>
            <th style={th}>Required</th><th style={th}>Ordered</th><th style={th}>Delivered</th><th style={th}>Installed</th><th style={th}>Remaining</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {field.materials.map(m => {
              const required = field.requirements.filter(r => r.materialId === m.id).reduce((s, r) => s + num(r.requiredQty), 0)
              const tot = (type) => field.transactions.filter(t => t.materialId === m.id && t.type === type).reduce((s, t) => s + num(t.qty), 0)
              const installed = tot('Installed')
              const isOpen = expanded.has(m.id)
              return (
                <React.Fragment key={m.id}>
                  <tr>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <button onClick={() => toggleExpand(m.id)} title="Split required qty by area"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', display: 'inline-flex', padding: 0 }}>
                        {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </button>
                    </td>
                    <td style={{ ...td, fontFamily: 'var(--font-mono)' }}>{m.code || '—'}</td>
                    <td style={td}>{m.description || '—'}</td>
                    <td style={td}>{m.unit || '—'}</td>
                    <td style={td}>{required.toLocaleString()}</td>
                    <td style={td}>{tot('Ordered').toLocaleString()}</td>
                    <td style={td}>{tot('Delivered').toLocaleString()}</td>
                    <td style={td}>{installed.toLocaleString()}</td>
                    <td style={{ ...td, fontWeight: 700, color: (required - installed) > 0 ? 'var(--text-strong)' : 'var(--brand-600)' }}>{(required - installed).toLocaleString()}</td>
                    <td style={{ ...td, textAlign: 'right' }}><DelBtn onClick={() => delMaterial(m.id)} /></td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td style={{ padding: 0, background: 'var(--surface-sunken)' }} colSpan={colSpan + 1}>
                        <div style={{ padding: '10px 16px' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-subtle)', marginBottom: 8 }}>Required quantity by area</div>
                          {field.areas.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Add areas first.</div> : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                              {field.areas.map(a => (
                                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-body)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                                  <input type="number" value={reqFor(m.id, a.id)} placeholder="0"
                                    onChange={e => setReq(m.id, a.id, e.target.value)}
                                    style={{ width: 80, fontFamily: 'var(--font-mono)', fontSize: 13, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-strong)' }} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      )}
      <AddRow
        fields={[
          { key: 'code', label: 'Code', placeholder: 'SKU / item', grow: '1 1 120px' },
          { key: 'description', label: 'Description', required: true, placeholder: 'Material name', grow: '2 1 200px' },
          { key: 'unit', label: 'Unit', placeholder: 'LF / SF / EA', grow: '1 1 90px' },
        ]}
        onAdd={addMaterial} addLabel="Add material" />
    </Card>
  )
}

// Add form for the deliveries log. One order/log action can carry several
// material lines (shared area/type/date/notes) — each line becomes its own
// transaction so the rest of the app (totals, CSV export) is unchanged.
function OrderForm({ areaOpts, matOpts, onAdd, prefill }) {
  const blankItem = () => ({ key: uid('item'), materialId: matOpts[0]?.value || '', qty: '' })
  const [areaId, setAreaId] = useState(prefill?.areaId ?? areaOpts[0]?.value ?? '')
  const [type, setType] = useState(prefill?.type ?? 'Ordered')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState(() => prefill
    ? [{ key: uid('item'), materialId: prefill.materialId, qty: prefill.qty }]
    : [blankItem()])

  const setItem = (key, patch) => setItems(list => list.map(it => it.key === key ? { ...it, ...patch } : it))
  const addItem = () => setItems(list => [...list, blankItem()])
  const delItem = (key) => setItems(list => list.length > 1 ? list.filter(it => it.key !== key) : list)

  const submit = () => {
    if (!areaId) return
    const valid = items.filter(it => it.materialId && num(it.qty) > 0)
    if (!valid.length) return
    onAdd({ areaId, type, date, notes, items: valid })
    setAreaId(areaOpts[0]?.value ?? '')
    setType('Ordered')
    setDate('')
    setNotes('')
    setItems([blankItem()])
  }

  return (
    <div style={{ padding: '12px 16px', background: 'var(--surface-sunken)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 140px' }}><Select label="Area" size="sm" value={areaId} onChange={e => setAreaId(e.target.value)} options={areaOpts} /></div>
        <div style={{ flex: '1 1 120px' }}><Select label="Type" size="sm" value={type} onChange={e => setType(e.target.value)} options={TX_TYPES} /></div>
        <div style={{ flex: '1 1 140px' }}><Input label="Date" size="sm" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div style={{ flex: '2 1 160px' }}><Input label="Notes" size="sm" placeholder="optional — applies to whole order" value={notes} onChange={e => setNotes(e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(it => (
          <div key={it.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: '2 1 220px' }}><Select label="Material" size="sm" value={it.materialId} onChange={e => setItem(it.key, { materialId: e.target.value })} options={matOpts} /></div>
            <div style={{ flex: '0 1 90px', minWidth: 80 }}><Input label="Qty" size="sm" type="number" value={it.qty} onChange={e => setItem(it.key, { qty: e.target.value })} /></div>
            <DelBtn onClick={() => delItem(it.key)} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button variant="ghost" size="sm" iconLeft={<Plus size={14} />} onClick={addItem}>Add another item</Button>
        <span style={{ flex: 1 }} />
        <Button variant="primary" size="sm" iconLeft={<Plus size={14} />} onClick={submit}>Log</Button>
      </div>
    </div>
  )
}

function Deliveries({ field, setField, areaName, materialLabel }) {
  const areaOpts = field.areas.map(a => ({ value: a.id, label: a.name }))
  const matOpts = field.materials.map(m => ({ value: m.id, label: m.code || m.description || 'Material' }))
  const [prefill, setPrefill] = useState(null)
  const add = (v) => {
    const date = v.date || new Date().toISOString().slice(0, 10)
    const notes = v.notes.trim()
    const newTx = v.items.map(it => ({ id: uid('tx'), areaId: v.areaId, materialId: it.materialId, type: v.type, qty: num(it.qty), date, notes }))
    setField({ transactions: [...newTx, ...field.transactions] })
    setPrefill(null)
  }
  const del = (id) => setField({ transactions: field.transactions.filter(t => t.id !== id) })
  // Re-log an existing entry against the same area/material/qty, advanced to its
  // next stage (Ordered -> Delivered -> Installed) — e.g. one click to log the
  // delivery once an order comes in, without retyping area/material/qty.
  const repeat = (t) => setPrefill({ areaId: t.areaId, materialId: t.materialId, type: nextTxType(t.type), qty: t.qty })
  const canAdd = field.areas.length > 0 && field.materials.length > 0
  return (
    <Card title="Orders & deliveries log">
      {!canAdd ? <Empty>Add at least one area and one material first.</Empty> : (
        <OrderForm
          key={prefill ? `${prefill.areaId}-${prefill.materialId}-${prefill.type}-${prefill.qty}` : 'default'}
          areaOpts={areaOpts} matOpts={matOpts} onAdd={add} prefill={prefill} />
      )}
      {field.transactions.length === 0 ? <Empty>No transactions logged yet.</Empty> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Date</th><th style={th}>Type</th><th style={th}>Area</th><th style={th}>Material</th><th style={th}>Qty</th><th style={th}>Notes</th><th style={th}></th></tr></thead>
          <tbody>
            {field.transactions.map(t => (
              <tr key={t.id}>
                <td style={td}>{t.date}</td>
                <td style={td}><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--surface-sunken)', color: 'var(--text-body)' }}>{t.type}</span></td>
                <td style={td}>{areaName(t.areaId)}</td>
                <td style={td}>{materialLabel(t.materialId)}</td>
                <td style={{ ...td, fontFamily: 'var(--font-mono)' }}>{num(t.qty).toLocaleString()}</td>
                <td style={td}>{t.notes || '—'}</td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <IconBtn icon={RotateCw} title={`Log as ${nextTxType(t.type)}…`} onClick={() => repeat(t)} />
                  <DelBtn onClick={() => del(t.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

function Procurement({ field, setField, vendors, addVendor, deleteVendor }) {
  // Vendors are account-level and shared across every project.
  const vendorOpts = vendors.map(v => ({ value: v.id, label: v.name }))
  const vendorName = (id) => vendors.find(v => v.id === id)?.name || '—'
  const addPO = (v) => setField({ purchaseOrders: [...field.purchaseOrders, { id: uid('po'), vendorId: v.vendorId, poNumber: v.poNumber.trim(), description: v.description.trim(), amount: num(v.amount), status: v.status, requiredDate: v.requiredDate }] })
  const delPO = (id) => setField({ purchaseOrders: field.purchaseOrders.filter(p => p.id !== id) })
  const addCO = (v) => setField({ changeOrders: [...field.changeOrders, { id: uid('co'), coNumber: v.coNumber.trim(), description: v.description.trim(), amount: num(v.amount), status: v.status }] })
  const delCO = (id) => setField({ changeOrders: field.changeOrders.filter(c => c.id !== id) })
  const poTotal = field.purchaseOrders.reduce((s, p) => s + num(p.amount), 0)
  const coTotal = field.changeOrders.reduce((s, c) => s + num(c.amount), 0)
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <Stat label="Vendors" value={vendors.length} />
        <Stat label="PO total" value={fmtMoney(poTotal)} accent />
        <Stat label="Change orders" value={fmtMoney(coTotal)} />
      </div>

      <Card title="Vendors" right={<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Shared across all projects</span>}>
        {vendors.length === 0 ? <Empty>No vendors yet.</Empty> : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 16px' }}>
            {vendors.map(v => (
              <span key={v.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'var(--surface-sunken)', fontSize: 13, fontWeight: 600 }}>
                {v.name}
                <button onClick={() => deleteVendor(v.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', display: 'inline-flex' }}><Trash2 size={12} /></button>
              </span>
            ))}
          </div>
        )}
        <AddRow fields={[{ key: 'name', label: 'Vendor name', required: true, grow: '1 1 240px' }]} onAdd={(v) => addVendor(v.name)} addLabel="Add vendor" />
      </Card>

      <Card title="Purchase orders">
        {field.purchaseOrders.length === 0 ? <Empty>No purchase orders.</Empty> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>PO #</th><th style={th}>Vendor</th><th style={th}>Description</th><th style={th}>Amount</th><th style={th}>Status</th><th style={th}>Required</th><th style={th}></th></tr></thead>
            <tbody>
              {field.purchaseOrders.map(p => (
                <tr key={p.id}>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)' }}>{p.poNumber || '—'}</td>
                  <td style={td}>{vendorName(p.vendorId)}</td>
                  <td style={td}>{p.description || '—'}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)' }}>{fmtMoney(p.amount)}</td>
                  <td style={td}>{p.status}</td>
                  <td style={td}>{p.requiredDate || '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}><DelBtn onClick={() => delPO(p.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <AddRow
          fields={[
            { key: 'poNumber', label: 'PO #', grow: '1 1 100px' },
            { key: 'vendorId', label: 'Vendor', search: true, options: vendorOpts, onCreate: (name) => addVendor(name), placeholder: 'Search or add…', grow: '1 1 160px' },
            { key: 'description', label: 'Description', required: true, grow: '2 1 200px' },
            { key: 'amount', label: 'Amount', type: 'number', grow: '1 1 110px' },
            { key: 'status', label: 'Status', options: ['Draft', 'Issued', 'Received'], default: 'Draft', grow: '1 1 110px' },
            { key: 'requiredDate', label: 'Required', type: 'date', grow: '1 1 140px' },
          ]}
          onAdd={addPO} addLabel="Add PO" />
      </Card>

      <Card title="Change orders">
        {field.changeOrders.length === 0 ? <Empty>No change orders.</Empty> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>CO #</th><th style={th}>Description</th><th style={th}>Amount</th><th style={th}>Status</th><th style={th}></th></tr></thead>
            <tbody>
              {field.changeOrders.map(c => (
                <tr key={c.id}>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)' }}>{c.coNumber || '—'}</td>
                  <td style={td}>{c.description || '—'}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)' }}>{fmtMoney(c.amount)}</td>
                  <td style={td}>{c.status}</td>
                  <td style={{ ...td, textAlign: 'right' }}><DelBtn onClick={() => delCO(c.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <AddRow
          fields={[
            { key: 'coNumber', label: 'CO #', grow: '1 1 100px' },
            { key: 'description', label: 'Description', required: true, grow: '2 1 220px' },
            { key: 'amount', label: 'Amount', type: 'number', grow: '1 1 110px' },
            { key: 'status', label: 'Status', options: ['Pending', 'Approved', 'Rejected'], default: 'Pending', grow: '1 1 120px' },
          ]}
          onAdd={addCO} addLabel="Add CO" />
      </Card>
    </>
  )
}

function DailyReports({ field, setField }) {
  const add = (v) => setField({ dailyReports: [{ id: uid('dr'), date: v.date || new Date().toISOString().slice(0, 10), weather: v.weather.trim(), manpower: v.manpower, workCompleted: v.workCompleted.trim(), issues: v.issues.trim() }, ...field.dailyReports] })
  const del = (id) => setField({ dailyReports: field.dailyReports.filter(d => d.id !== id) })
  return (
    <Card title="Daily reports">
      <AddRow
        fields={[
          { key: 'date', label: 'Date', type: 'date', grow: '1 1 140px' },
          { key: 'weather', label: 'Weather', placeholder: 'Sunny, 72°', grow: '1 1 130px' },
          { key: 'manpower', label: 'Crew', type: 'number', grow: '0 1 90px', minWidth: 80 },
          { key: 'workCompleted', label: 'Work completed', required: true, grow: '2 1 220px' },
          { key: 'issues', label: 'Issues', placeholder: 'optional', grow: '2 1 180px' },
        ]}
        onAdd={add} addLabel="Log report" />
      {field.dailyReports.length === 0 ? <Empty>No daily reports yet.</Empty> : (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {field.dailyReports.map(d => (
            <div key={d.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{d.date}</span>
                {d.weather && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {d.weather}</span>}
                {d.manpower && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {d.manpower} crew</span>}
                <span style={{ flex: 1 }} />
                <DelBtn onClick={() => del(d.id)} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-body)' }}>{d.workCompleted}</div>
              {d.issues && <div style={{ fontSize: 12, color: 'var(--error-500, #dc2626)', marginTop: 4 }}>Issues: {d.issues}</div>}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function Schedule({ field, setField, areaName }) {
  const areaOpts = [{ value: '', label: '— none —' }, ...field.areas.map(a => ({ value: a.id, label: a.name }))]
  const add = (v) => setField({ scheduleTasks: [...field.scheduleTasks, { id: uid('task'), name: v.name.trim(), areaId: v.areaId, start: v.start, end: v.end, status: v.status }] })
  const del = (id) => setField({ scheduleTasks: field.scheduleTasks.filter(t => t.id !== id) })
  const sorted = [...field.scheduleTasks].sort((a, b) => (a.start || '').localeCompare(b.start || ''))
  return (
    <Card title="Schedule">
      <AddRow
        fields={[
          { key: 'name', label: 'Task', required: true, grow: '2 1 200px' },
          { key: 'areaId', label: 'Area', options: areaOpts, default: '', grow: '1 1 140px' },
          { key: 'start', label: 'Start', type: 'date', grow: '1 1 140px' },
          { key: 'end', label: 'End', type: 'date', grow: '1 1 140px' },
          { key: 'status', label: 'Status', options: STATUSES, default: 'Open', grow: '1 1 120px' },
        ]}
        onAdd={add} addLabel="Add task" />
      {sorted.length === 0 ? <Empty>No tasks scheduled.</Empty> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Task</th><th style={th}>Area</th><th style={th}>Start</th><th style={th}>End</th><th style={th}>Status</th><th style={th}></th></tr></thead>
          <tbody>
            {sorted.map(t => (
              <tr key={t.id}>
                <td style={td}>{t.name}</td>
                <td style={td}>{t.areaId ? areaName(t.areaId) : '—'}</td>
                <td style={td}>{t.start || '—'}</td>
                <td style={td}>{t.end || '—'}</td>
                <td style={td}>{t.status}</td>
                <td style={{ ...td, textAlign: 'right' }}><DelBtn onClick={() => del(t.id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

function Punch({ field, setField, areaName }) {
  const areaOpts = [{ value: '', label: '— none —' }, ...field.areas.map(a => ({ value: a.id, label: a.name }))]
  const add = (v) => setField({ punchItems: [...field.punchItems, { id: uid('pi'), title: v.title.trim(), areaId: v.areaId, priority: v.priority, status: v.status, dueDate: v.dueDate }] })
  const del = (id) => setField({ punchItems: field.punchItems.filter(p => p.id !== id) })
  const toggle = (id) => setField({ punchItems: field.punchItems.map(p => p.id === id ? { ...p, status: p.status === 'Complete' ? 'Open' : 'Complete' } : p) })
  const prColor = (p) => p === 'High' ? '#dc2626' : p === 'Medium' ? '#d97706' : 'var(--text-muted)'
  return (
    <Card title="Punch list">
      <AddRow
        fields={[
          { key: 'title', label: 'Item', required: true, grow: '2 1 220px' },
          { key: 'areaId', label: 'Area', options: areaOpts, default: '', grow: '1 1 140px' },
          { key: 'priority', label: 'Priority', options: PUNCH_PRIORITIES, default: 'Medium', grow: '1 1 110px' },
          { key: 'status', label: 'Status', options: ['Open', 'Complete'], default: 'Open', grow: '1 1 110px' },
          { key: 'dueDate', label: 'Due', type: 'date', grow: '1 1 140px' },
        ]}
        onAdd={add} addLabel="Add item" />
      {field.punchItems.length === 0 ? <Empty>No punch items.</Empty> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}></th><th style={th}>Item</th><th style={th}>Area</th><th style={th}>Priority</th><th style={th}>Due</th><th style={th}></th></tr></thead>
          <tbody>
            {field.punchItems.map(p => (
              <tr key={p.id} style={{ opacity: p.status === 'Complete' ? 0.55 : 1 }}>
                <td style={{ ...td, width: 30 }}><input type="checkbox" checked={p.status === 'Complete'} onChange={() => toggle(p.id)} /></td>
                <td style={{ ...td, textDecoration: p.status === 'Complete' ? 'line-through' : 'none' }}>{p.title}</td>
                <td style={td}>{p.areaId ? areaName(p.areaId) : '—'}</td>
                <td style={{ ...td, color: prColor(p.priority), fontWeight: 600 }}>{p.priority}</td>
                <td style={td}>{p.dueDate || '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}><DelBtn onClick={() => del(p.id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

function CrewEquipment({ field, setField }) {
  const addCrew = (v) => setField({ crew: [...field.crew, { id: uid('cr'), name: v.name.trim(), role: v.role.trim(), phone: v.phone.trim(), status: v.status }] })
  const delCrew = (id) => setField({ crew: field.crew.filter(c => c.id !== id) })
  const addEq = (v) => setField({ equipmentLogs: [{ id: uid('eq'), date: v.date || new Date().toISOString().slice(0, 10), name: v.name.trim(), operator: v.operator.trim(), hours: num(v.hours), condition: v.condition }, ...field.equipmentLogs] })
  const delEq = (id) => setField({ equipmentLogs: field.equipmentLogs.filter(e => e.id !== id) })
  return (
    <>
      <Card title="Crew">
        {field.crew.length === 0 ? <Empty>No crew members.</Empty> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Name</th><th style={th}>Role</th><th style={th}>Phone</th><th style={th}>Status</th><th style={th}></th></tr></thead>
            <tbody>
              {field.crew.map(c => (
                <tr key={c.id}>
                  <td style={td}>{c.name}</td><td style={td}>{c.role || '—'}</td><td style={td}>{c.phone || '—'}</td><td style={td}>{c.status}</td>
                  <td style={{ ...td, textAlign: 'right' }}><DelBtn onClick={() => delCrew(c.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <AddRow
          fields={[
            { key: 'name', label: 'Name', required: true, grow: '1 1 160px' },
            { key: 'role', label: 'Role', grow: '1 1 140px' },
            { key: 'phone', label: 'Phone', grow: '1 1 130px' },
            { key: 'status', label: 'Status', options: ['Active', 'Off'], default: 'Active', grow: '1 1 110px' },
          ]}
          onAdd={addCrew} addLabel="Add crew" />
      </Card>

      <Card title="Equipment log">
        {field.equipmentLogs.length === 0 ? <Empty>No equipment logs.</Empty> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Date</th><th style={th}>Equipment</th><th style={th}>Operator</th><th style={th}>Hours</th><th style={th}>Condition</th><th style={th}></th></tr></thead>
            <tbody>
              {field.equipmentLogs.map(e => (
                <tr key={e.id}>
                  <td style={td}>{e.date}</td><td style={td}>{e.name}</td><td style={td}>{e.operator || '—'}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)' }}>{num(e.hours)}</td><td style={td}>{e.condition}</td>
                  <td style={{ ...td, textAlign: 'right' }}><DelBtn onClick={() => delEq(e.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <AddRow
          fields={[
            { key: 'date', label: 'Date', type: 'date', grow: '1 1 140px' },
            { key: 'name', label: 'Equipment', required: true, grow: '1 1 160px' },
            { key: 'operator', label: 'Operator', grow: '1 1 140px' },
            { key: 'hours', label: 'Hours', type: 'number', grow: '0 1 90px', minWidth: 80 },
            { key: 'condition', label: 'Condition', options: ['Good', 'Fair', 'Needs service'], default: 'Good', grow: '1 1 130px' },
          ]}
          onAdd={addEq} addLabel="Log" />
      </Card>
    </>
  )
}

function Inspections({ field, setField, areaName }) {
  const areaOpts = [{ value: '', label: '— none —' }, ...field.areas.map(a => ({ value: a.id, label: a.name }))]
  const add = (v) => setField({ inspections: [{ id: uid('insp'), date: v.date || new Date().toISOString().slice(0, 10), areaId: v.areaId, type: v.type.trim(), inspector: v.inspector.trim(), result: v.result }, ...field.inspections] })
  const del = (id) => setField({ inspections: field.inspections.filter(i => i.id !== id) })
  const resColor = (r) => r === 'Pass' ? 'var(--brand-600)' : r === 'Fail' ? '#dc2626' : 'var(--text-muted)'
  return (
    <Card title="Inspections">
      <AddRow
        fields={[
          { key: 'date', label: 'Date', type: 'date', grow: '1 1 140px' },
          { key: 'type', label: 'Type', required: true, placeholder: 'Irrigation, Grading…', grow: '2 1 180px' },
          { key: 'areaId', label: 'Area', options: areaOpts, default: '', grow: '1 1 140px' },
          { key: 'inspector', label: 'Inspector', grow: '1 1 140px' },
          { key: 'result', label: 'Result', options: ['Pass', 'Fail', 'Pending'], default: 'Pending', grow: '1 1 110px' },
        ]}
        onAdd={add} addLabel="Add" />
      {field.inspections.length === 0 ? <Empty>No inspections logged.</Empty> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Date</th><th style={th}>Type</th><th style={th}>Area</th><th style={th}>Inspector</th><th style={th}>Result</th><th style={th}></th></tr></thead>
          <tbody>
            {field.inspections.map(i => (
              <tr key={i.id}>
                <td style={td}>{i.date}</td><td style={td}>{i.type}</td><td style={td}>{i.areaId ? areaName(i.areaId) : '—'}</td>
                <td style={td}>{i.inspector || '—'}</td><td style={{ ...td, color: resColor(i.result), fontWeight: 600 }}>{i.result}</td>
                <td style={{ ...td, textAlign: 'right' }}><DelBtn onClick={() => del(i.id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}
