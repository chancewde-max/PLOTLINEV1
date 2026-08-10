import React, { useMemo, useState, useEffect } from 'react'
import {
  LayoutDashboard, MapPin, Package, Truck, ShoppingCart, ClipboardList,
  CalendarDays, ListChecks, Users, ClipboardCheck, Plus, Trash2,
} from 'lucide-react'
import { Button } from './ui/Button.jsx'
import { Input } from './ui/Input.jsx'
import { Select } from './ui/Select.jsx'
import { useAppData } from '../data/useAppData.jsx'

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

// Pull the current MTO rows into { code, description, unit, qty } materials.
function materialsFromMto(project) {
  const versions = Array.isArray(project?.mtoVersions) ? project.mtoVersions : []
  const current = versions.find(v => v.isCurrent) || versions[versions.length - 1] || null
  if (!current) return []
  const headers = current.headers || []
  const rows = current.rows || []
  const cm = current.columnMap || {}
  const idx = (key) => (cm[key] ? headers.indexOf(cm[key]) : -1)
  const iItem = idx('item'), iDesc = idx('description'), iQty = idx('qty'), iUnit = idx('unit')
  const out = []
  for (const r of rows) {
    const code = iItem >= 0 ? String(r[iItem] ?? '').trim() : ''
    const description = iDesc >= 0 ? String(r[iDesc] ?? '').trim() : ''
    const unit = iUnit >= 0 ? String(r[iUnit] ?? '').trim() : ''
    const qty = iQty >= 0 ? parseFloat(String(r[iQty] ?? '').replace(/[^0-9.\-]/g, '')) || 0 : 0
    if (!code && !description) continue
    out.push({ code, description, unit, qty })
  }
  return out
}

// Build the initial field state from takeoff data.
function seedField(project) {
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

  // Materials ← current MTO rows. Each material's full required qty lands on
  // the primary area; the user can split/reassign later.
  const mats = materialsFromMto(project)
  f.materials = mats.map(m => ({ id: uid('mat'), code: m.code, description: m.description, unit: m.unit }))
  f.requirements = mats.map((m, i) => ({
    id: uid('req'), areaId: primaryAreaId, materialId: f.materials[i].id, requiredQty: m.qty,
  }))
  return f
}

const fmtMoney = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0 }

export default function JobManagement({ projectId, project }) {
  const { updateProject } = useAppData()
  const [view, setView] = useState('overview')

  const field = project.field && project.field.seeded ? project.field : null

  // Seed on first open (once), persisting the initial state.
  useEffect(() => {
    if (!project.field || !project.field.seeded) {
      updateProject(projectId, { field: seedField(project) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const setField = (patch) => {
    const base = project.field && project.field.seeded ? project.field : seedField(project)
    updateProject(projectId, { field: { ...base, ...patch } })
  }

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

  const totals = useMemo(() => {
    const required = field.requirements.reduce((s, r) => s + num(r.requiredQty), 0)
    const installed = field.transactions.filter(t => t.type === 'Installed').reduce((s, t) => s + num(t.qty), 0)
    const committed = field.purchaseOrders.reduce((s, p) => s + num(p.amount), 0)
    const changeTotal = field.changeOrders.reduce((s, c) => s + num(c.amount), 0)
    const openPunch = field.punchItems.filter(p => p.status !== 'Complete').length
    const pct = required > 0 ? Math.min(100, Math.round((installed / required) * 100)) : 0
    return { required, installed, committed, changeTotal, openPunch, pct }
  }, [field])

  return (
    <div>
      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
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

      {view === 'overview'   && <Overview totals={totals} field={field} />}
      {view === 'areas'      && <Areas field={field} setField={setField} totals={totals} txTotal={txTotal} />}
      {view === 'materials'  && <Materials field={field} setField={setField} areaName={areaName} txTotal={txTotal} />}
      {view === 'deliveries' && <Deliveries field={field} setField={setField} areaName={areaName} materialLabel={materialLabel} />}
      {view === 'procurement'&& <Procurement field={field} setField={setField} />}
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
          {f.options
            ? <Select label={f.label} size="sm" value={vals[f.key]} onChange={e => set(f.key, e.target.value)} options={f.options} />
            : <Input label={f.label} size="sm" type={f.type || 'text'} placeholder={f.placeholder} value={vals[f.key]} onChange={e => set(f.key, e.target.value)} />}
        </div>
      ))}
      <Button variant="primary" size="sm" iconLeft={<Plus size={14} />} onClick={submit}>{addLabel}</Button>
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

function Materials({ field, setField, areaName, txTotal }) {
  const addMaterial = (v) => setField({ materials: [...field.materials, { id: uid('mat'), code: v.code.trim(), description: v.description.trim(), unit: v.unit.trim() }] })
  const delMaterial = (id) => setField({
    materials: field.materials.filter(m => m.id !== id),
    requirements: field.requirements.filter(r => r.materialId !== id),
    transactions: field.transactions.filter(t => t.materialId !== id),
  })
  return (
    <Card title="Materials — required vs installed" >
      {field.materials.length === 0 ? <Empty>No materials. They seed from your MTO, or add one below.</Empty> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={th}>Code</th><th style={th}>Description</th><th style={th}>Unit</th>
            <th style={th}>Required</th><th style={th}>Ordered</th><th style={th}>Delivered</th><th style={th}>Installed</th><th style={th}>Remaining</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {field.materials.map(m => {
              const required = field.requirements.filter(r => r.materialId === m.id).reduce((s, r) => s + num(r.requiredQty), 0)
              const tot = (type) => field.transactions.filter(t => t.materialId === m.id && t.type === type).reduce((s, t) => s + num(t.qty), 0)
              const installed = tot('Installed')
              return (
                <tr key={m.id}>
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

function Deliveries({ field, setField, areaName, materialLabel }) {
  const areaOpts = field.areas.map(a => ({ value: a.id, label: a.name }))
  const matOpts = field.materials.map(m => ({ value: m.id, label: m.code || m.description || 'Material' }))
  const add = (v) => {
    if (!v.areaId || !v.materialId) return
    setField({ transactions: [{ id: uid('tx'), areaId: v.areaId, materialId: v.materialId, type: v.type, qty: num(v.qty), date: v.date || new Date().toISOString().slice(0, 10), notes: v.notes.trim() }, ...field.transactions] })
  }
  const del = (id) => setField({ transactions: field.transactions.filter(t => t.id !== id) })
  const canAdd = field.areas.length > 0 && field.materials.length > 0
  return (
    <Card title="Orders & deliveries log">
      {!canAdd ? <Empty>Add at least one area and one material first.</Empty> : (
        <AddRow
          fields={[
            { key: 'areaId', label: 'Area', options: areaOpts, default: areaOpts[0]?.value, grow: '1 1 140px' },
            { key: 'materialId', label: 'Material', options: matOpts, default: matOpts[0]?.value, grow: '1 1 160px' },
            { key: 'type', label: 'Type', options: TX_TYPES, default: 'Ordered', grow: '1 1 120px' },
            { key: 'qty', label: 'Qty', type: 'number', grow: '0 1 90px', minWidth: 80 },
            { key: 'date', label: 'Date', type: 'date', grow: '1 1 140px' },
            { key: 'notes', label: 'Notes', placeholder: 'optional', grow: '2 1 160px' },
          ]}
          onAdd={add} addLabel="Log" />
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
                <td style={{ ...td, textAlign: 'right' }}><DelBtn onClick={() => del(t.id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

function Procurement({ field, setField }) {
  const addVendor = (v) => setField({ vendors: [...field.vendors, { id: uid('ven'), name: v.name.trim() }] })
  const vendorOpts = field.vendors.map(v => ({ value: v.id, label: v.name }))
  const vendorName = (id) => field.vendors.find(v => v.id === id)?.name || '—'
  const addPO = (v) => setField({ purchaseOrders: [...field.purchaseOrders, { id: uid('po'), vendorId: v.vendorId, poNumber: v.poNumber.trim(), description: v.description.trim(), amount: num(v.amount), status: v.status, requiredDate: v.requiredDate }] })
  const delPO = (id) => setField({ purchaseOrders: field.purchaseOrders.filter(p => p.id !== id) })
  const addCO = (v) => setField({ changeOrders: [...field.changeOrders, { id: uid('co'), coNumber: v.coNumber.trim(), description: v.description.trim(), amount: num(v.amount), status: v.status }] })
  const delCO = (id) => setField({ changeOrders: field.changeOrders.filter(c => c.id !== id) })
  const poTotal = field.purchaseOrders.reduce((s, p) => s + num(p.amount), 0)
  const coTotal = field.changeOrders.reduce((s, c) => s + num(c.amount), 0)
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <Stat label="Vendors" value={field.vendors.length} />
        <Stat label="PO total" value={fmtMoney(poTotal)} accent />
        <Stat label="Change orders" value={fmtMoney(coTotal)} />
      </div>

      <Card title="Vendors">
        {field.vendors.length === 0 ? <Empty>No vendors yet.</Empty> : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 16px' }}>
            {field.vendors.map(v => (
              <span key={v.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'var(--surface-sunken)', fontSize: 13, fontWeight: 600 }}>
                {v.name}
                <button onClick={() => setField({ vendors: field.vendors.filter(x => x.id !== v.id) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', display: 'inline-flex' }}><Trash2 size={12} /></button>
              </span>
            ))}
          </div>
        )}
        <AddRow fields={[{ key: 'name', label: 'Vendor name', required: true, grow: '1 1 240px' }]} onAdd={addVendor} addLabel="Add vendor" />
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
            { key: 'vendorId', label: 'Vendor', options: vendorOpts.length ? vendorOpts : [{ value: '', label: '— add a vendor —' }], default: vendorOpts[0]?.value, grow: '1 1 140px' },
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
