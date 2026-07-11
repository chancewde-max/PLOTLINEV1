import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  Plus, Trash2, RefreshCw, FileText, Save, Upload, Download, Printer,
  Sparkles, ChevronDown, X,
} from 'lucide-react'
import { useAppData } from '../data/useAppData.jsx'
import { Button } from './ui/Button.jsx'
import { Input } from './ui/Input.jsx'
import { Dialog } from './ui/Dialog.jsx'
import s from './ProposalEditor.module.css'

// Canonical proposal line-item shape.
const emptyLine = () => ({ item: '', description: '', qty: '', unit: '', unitPrice: '' })

// The default boilerplate for a fresh proposal.
function defaultProposal(project) {
  return {
    title: 'Proposal & Scope of Work',
    company: 'Plotline Landscaping & Irrigation',
    client: project?.client || '',
    projectName: project?.name || '',
    date: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
    intro:
      'Thank you for the opportunity to prepare this proposal. ' +
      'The scope below outlines the materials, quantities, and pricing for the work described. ' +
      'All quantities are derived from the approved plan take-off and are subject to field verification.',
    notes:
      'Terms: 50% deposit to schedule, balance on completion. ' +
      'Pricing valid for 30 days. Permits and utility locates are the responsibility of the owner unless noted otherwise.',
    lineItems: [emptyLine()],
    templateId: null,
  }
}

// Coerce a value to a finite number (or null).
function num(v) {
  if (v === '' || v == null) return null
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function money(n) {
  if (n == null) return '—'
  return '$' + (Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
}

// Build proposal line items from the current MTO version via its columnMap.
function lineItemsFromMto(version) {
  if (!version || !Array.isArray(version.rows)) return null
  const map = version.columnMap || {}
  if (!Object.values(map).some(Boolean)) return null // nothing mapped → don't clobber
  const rows = version.rows
    .map((raw) => {
      const get = (key) => {
        const src = map[key]
        const val = src ? raw[src] : ''
        return val == null ? '' : String(val)
      }
      const qty = num(get('qty'))
      const unitPrice = num(get('unitPrice'))
      return {
        item: get('item'),
        description: get('description'),
        qty: qty == null ? '' : String(qty),
        unit: get('unit'),
        unitPrice: unitPrice == null ? '' : String(unitPrice),
      }
    })
    .filter((r) => r.item || r.description || r.qty || r.unitPrice)
  return rows.length ? rows : null
}

export default function ProposalEditor({ projectId, project }) {
  const { proposalTemplates, addProposalTemplate, updateProposal } = useAppData()

  // Seed the editor from the persisted proposal, falling back to defaults.
  const [doc, setDoc] = useState(() => project?.proposal || defaultProposal(project))
  const [dirty, setDirty] = useState(false)
  const [importErr, setImportErr] = useState(null)

  // Templates UI
  const [saveTplOpen, setSaveTplOpen] = useState(false)
  const [tplName, setTplName] = useState('')
  const [loadOpen, setLoadOpen] = useState(false)
  const importRef = useRef(null)
  const printRef = useRef(null)

  // If the project's proposal changes externally (e.g. navigation), re-seed.
  useEffect(() => {
    setDoc(project?.proposal || defaultProposal(project))
    setDirty(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Persist on every change (debounced by the context's optimizer).
  const persist = (next) => {
    setDirty(true)
    updateProposal(projectId, next)
  }

  const patch = (updates) => {
    const next = { ...doc, ...updates }
    setDoc(next)
    persist(next)
  }

  const setLine = (idx, key, value) => {
    const lineItems = doc.lineItems.map((li, i) => (i === idx ? { ...li, [key]: value } : li))
    patch({ lineItems })
  }
  const addLine = () => patch({ lineItems: [...doc.lineItems, emptyLine()] })
  const removeLine = (idx) => {
    const lineItems = doc.lineItems.filter((_, i) => i !== idx)
    patch({ lineItems: lineItems.length ? lineItems : [emptyLine()] })
  }

  const grandTotal = useMemo(() => {
    return doc.lineItems.reduce((sum, li) => {
      const q = num(li.qty)
      const p = num(li.unitPrice)
      if (q != null && p != null) return sum + q * p
      const t = num(li.total)
      if (t != null) return sum + t
      return sum
    }, 0)
  }, [doc.lineItems])

  // --- MTO auto-populate ---
  const currentMto = useMemo(
    () => (project?.mtoVersions || []).find((v) => v.isCurrent) || null,
    [project]
  )

  const pullFromMto = (overwrite) => {
    const items = lineItemsFromMto(currentMto)
    if (!items) return false
    if (overwrite) {
      patch({ lineItems: items, templateId: null })
    }
    return true
  }

  const handleRefreshFromMto = () => {
    if (!currentMto) {
      setImportErr('No current MTO version found. Upload an MTO first.')
      setTimeout(() => setImportErr(null), 2600)
      return
    }
    const ok = lineItemsFromMto(currentMto)
    if (!ok) {
      setImportErr('The current MTO has no mapped columns yet. Review its mapping first.')
      setTimeout(() => setImportErr(null), 3000)
      return
    }
    const confirmed = window.confirm(
      'Refresh line items from the current MTO? This replaces the table with the MTO data.'
    )
    if (confirmed) pullFromMto(true)
  }

  // --- Templates: save / load / import ---
  const handleSaveTemplate = () => {
    const name = tplName.trim() || doc.title || 'Proposal template'
    addProposalTemplate({
      name,
      ownerAccountId: 'local',
      structure: {
        title: doc.title,
        intro: doc.intro,
        notes: doc.notes,
        company: doc.company,
        lineItems: doc.lineItems.map((li) => ({
          item: li.item, description: li.description, qty: li.qty, unit: li.unit, unitPrice: li.unitPrice,
        })),
      },
    })
    setTplName('')
    setSaveTplOpen(false)
  }

  const handleLoadTemplate = (tpl) => {
    const st = tpl.structure || {}
    const lineItems = Array.isArray(st.lineItems) && st.lineItems.length
      ? st.lineItems.map((li) => ({
          item: li.item || '', description: li.description || '', qty: li.qty || '', unit: li.unit || '', unitPrice: li.unitPrice || '',
        }))
      : [emptyLine()]
    patch({
      title: st.title || doc.title,
      intro: st.intro || doc.intro,
      notes: st.notes || doc.notes,
      company: st.company || doc.company,
      lineItems,
      templateId: tpl.id,
    })
    setLoadOpen(false)
  }

  const handleImportFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target.result))
        // Accept either a bare structure or a { name, structure } wrapper.
        const st = parsed.structure || parsed
        const lineItems = Array.isArray(st.lineItems)
          ? st.lineItems.map((li) => ({
              item: li.item || '', description: li.description || '', qty: li.qty || '', unit: li.unit || '', unitPrice: li.unitPrice || '',
            }))
          : [emptyLine()]
        patch({
          title: st.title || doc.title,
          intro: st.intro || doc.intro,
          notes: st.notes || doc.notes,
          company: st.company || doc.company,
          lineItems,
          templateId: null,
        })
      } catch {
        setImportErr('That file is not valid JSON. Import a proposal template (.json).')
        setTimeout(() => setImportErr(null), 3000)
      }
    }
    reader.readAsText(file)
  }

  const handleExportJson = () => {
    const payload = {
      name: doc.title || 'Proposal',
      structure: {
        title: doc.title,
        intro: doc.intro,
        notes: doc.notes,
        company: doc.company,
        lineItems: doc.lineItems.map((li) => ({
          item: li.item, description: li.description, qty: li.qty, unit: li.unit, unitPrice: li.unitPrice,
        })),
      },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug(doc.title || 'proposal')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handlePrint = () => {
    // Only print the document region.
    const prev = document.body.style
    window.requestAnimationFrame(() => window.print())
  }

  const tplList = Object.values(proposalTemplates || {})

  return (
    <div className={s.wrap}>
      {/* Toolbar */}
      <div className={s.toolbar}>
        <div className={s.toolLeft}>
          <span className={s.toolTitle}>
            <FileText size={15} /> Proposal editor
          </span>
          {dirty && <span className={s.savedPill}>Saved</span>}
        </div>
        <div className={s.toolActions}>
          <Button variant="ghost" size="sm" iconLeft={<RefreshCw size={15} />} onClick={handleRefreshFromMto}>
            Refresh from MTO
          </Button>
          <Button variant="secondary" size="sm" iconLeft={<Save size={15} />} onClick={() => setSaveTplOpen(true)}>
            Save as template
          </Button>
          <Button variant="secondary" size="sm" iconLeft={<Sparkles size={15} />} onClick={() => setLoadOpen(true)}>
            Load template
          </Button>
          <Button variant="secondary" size="sm" iconLeft={<Upload size={15} />} onClick={() => importRef.current?.click()}>
            Import
          </Button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <Button variant="ghost" size="sm" iconLeft={<Download size={15} />} onClick={handleExportJson}>
            Export
          </Button>
          <Button variant="primary" size="sm" iconLeft={<Printer size={15} />} onClick={handlePrint}>
            Print
          </Button>
        </div>
      </div>

      {importErr && (
        <div className={s.errorBar}>
          <X size={14} /> {importErr}
        </div>
      )}

      {/* The document (white page) */}
      <div className={s.desk}>
        <div className={s.page} ref={printRef} id="proposal-document">
          <header className={s.docHead}>
            <div className={s.brandRow}>
              <img src="/plotline-mark.svg" alt="" className={s.brandMark} />
              <span className={s.brandName}>Plotline<span className={s.dot}>.</span></span>
            </div>
            <input
              className={s.docTitle}
              value={doc.title}
              placeholder="Proposal title"
              onChange={(e) => patch({ title: e.target.value })}
            />
          </header>

          <div className={s.metaGrid}>
            <label className={s.metaField}>
              <span className={s.metaLabel}>Your Company</span>
              <input className={s.metaInput} value={doc.company} onChange={(e) => patch({ company: e.target.value })} />
            </label>
            <label className={s.metaField}>
              <span className={s.metaLabel}>Client</span>
              <input className={s.metaInput} value={doc.client} onChange={(e) => patch({ client: e.target.value })} />
            </label>
            <label className={s.metaField}>
              <span className={s.metaLabel}>Project</span>
              <input className={s.metaInput} value={doc.projectName} onChange={(e) => patch({ projectName: e.target.value })} />
            </label>
            <label className={s.metaField}>
              <span className={s.metaLabel}>Date</span>
              <input className={s.metaInput} value={doc.date} onChange={(e) => patch({ date: e.target.value })} />
            </label>
          </div>

          <textarea
            className={s.intro}
            value={doc.intro}
            placeholder="Introduction / scope of work…"
            onChange={(e) => patch({ intro: e.target.value })}
            rows={4}
          />

          {/* Line-item table */}
          <div className={s.tableWrap}>
            <table className={s.docTable}>
              <thead>
                <tr>
                  <th className={s.colItem}>Item</th>
                  <th className={s.colDesc}>Description</th>
                  <th className={s.colNum}>Qty</th>
                  <th className={s.colUnit}>Unit</th>
                  <th className={s.colNum}>Unit Price</th>
                  <th className={s.colNum}>Total</th>
                  <th className={s.colDel} aria-label="actions" />
                </tr>
              </thead>
              <tbody>
                {doc.lineItems.map((li, i) => {
                  const q = num(li.qty)
                  const p = num(li.unitPrice)
                  const total = q != null && p != null ? q * p : null
                  return (
                    <tr key={i}>
                      <td><input className={s.cell} value={li.item} onChange={(e) => setLine(i, 'item', e.target.value)} placeholder="—" /></td>
                      <td><input className={s.cell} value={li.description} onChange={(e) => setLine(i, 'description', e.target.value)} placeholder="—" /></td>
                      <td className={s.num}><input className={`${s.cell} ${s.cellNum}`} value={li.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} placeholder="0" inputMode="decimal" /></td>
                      <td className={s.num}><input className={`${s.cell} ${s.cellCenter}`} value={li.unit} onChange={(e) => setLine(i, 'unit', e.target.value)} placeholder="—" /></td>
                      <td className={s.num}><input className={`${s.cell} ${s.cellNum}`} value={li.unitPrice} onChange={(e) => setLine(i, 'unitPrice', e.target.value)} placeholder="$0.00" inputMode="decimal" /></td>
                      <td className={`${s.num} ${s.cellTotal}`}>{money(total)}</td>
                      <td className={s.delCell}>
                        <button className={s.delBtn} onClick={() => removeLine(i)} title="Remove line" aria-label={`Remove line ${i + 1}`}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className={s.grandLabel}>Grand Total</td>
                  <td className={`${s.num} ${s.grandTotal}`}>{money(grandTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
            <Button variant="ghost" size="sm" iconLeft={<Plus size={14} />} onClick={addLine} className={s.addLine}>
              Add line item
            </Button>
          </div>

          <textarea
            className={s.notes}
            value={doc.notes}
            placeholder="Terms, notes, exclusions…"
            onChange={(e) => patch({ notes: e.target.value })}
            rows={4}
          />

          <footer className={s.docFoot}>
            {doc.company || 'Plotline'} · Prepared {doc.date || ''}
          </footer>
        </div>
      </div>

      {/* Save-as-template dialog */}
      <Dialog open={saveTplOpen} onClose={() => setSaveTplOpen(false)} title="Save as template"
        description="Capture this proposal's structure to reuse on future projects." width={380}
        footer={<>
          <Button variant="ghost" onClick={() => setSaveTplOpen(false)}>Cancel</Button>
          <Button variant="primary" iconLeft={<Save size={15} />} onClick={handleSaveTemplate}>Save template</Button>
        </>}>
        <Input label="Template name" placeholder="Landscape Standard, Irrigation Bid…" value={tplName} onChange={(e) => setTplName(e.target.value)} autoFocus />
      </Dialog>

      {/* Load-template dialog */}
      <Dialog open={loadOpen} onClose={() => setLoadOpen(false)} title="Load template"
        description="Apply a saved proposal template to this project." width={440}
        footer={<Button variant="ghost" onClick={() => setLoadOpen(false)}>Close</Button>}>
        {tplList.length === 0 ? (
          <p className={s.tplEmpty}>No templates yet. Build a proposal, then “Save as template”.</p>
        ) : (
          <div className={s.tplList}>
            {tplList.map((t) => (
              <button key={t.id} className={s.tplCard} onClick={() => handleLoadTemplate(t)}>
                <div className={s.tplIcon}><Sparkles size={16} /></div>
                <div className={s.tplInfo}>
                  <div className={s.tplName}>{t.name}</div>
                  <div className={s.tplSub}>{(t.structure?.lineItems || []).length} line items</div>
                </div>
                <ChevronDown size={16} className={s.tplArrow} style={{ transform: 'rotate(-90deg)' }} />
              </button>
            ))}
          </div>
        )}
      </Dialog>

      {/* Print CSS: hide everything but the document while printing */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #proposal-document, #proposal-document * { visibility: visible !important; }
          #proposal-document {
            position: absolute; left: 0; top: 0; width: 100%;
            box-shadow: none !important; margin: 0 !important;
          }
          .${s.desk} { background: #fff !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  )
}

function slug(str = '') {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'proposal'
}
