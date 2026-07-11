import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  Plus, Trash2, RefreshCw, FileText, Save, Upload, Download, Printer,
  Sparkles, ChevronDown, X, ImagePlus, Building2,
} from 'lucide-react'
import { useAppData } from '../data/useAppData.jsx'
import { Button } from './ui/Button.jsx'
import { Input } from './ui/Input.jsx'
import { Dialog } from './ui/Dialog.jsx'
import s from './ProposalEditor.module.css'

/* ============================================================
   ProposalEditor — a commercial bid/proposal document (Word-like).
   The document uses the ACCOUNT'S OWN company logo + identity
   (from the account-level `company` object), not a hardcoded logo.
   The proposal `structure` is stored as project.proposal and is
   fully editable via structured inputs / textareas / editable tables.
   ============================================================ */

// Canonical proposal line-item (Materials List row) shape.
const emptyLine = () => ({ item: '', description: '', qty: '', unit: '', unitPrice: '' })
const emptyBullet = () => ({ text: '' })

let sidSeq = 0
const newScopeId = () => `scope-${Date.now()}-${sidSeq++}`

// Build a fresh scope section with sensible empty bullet lists.
function emptyScope(title = '') {
  return {
    id: newScopeId(),
    title,
    inclusions: [emptyBullet(), emptyBullet()],
    exclusions: [emptyBullet(), emptyBullet()],
    init: '',
    total: '',
  }
}

// The default boilerplate for a fresh proposal.
function defaultProposal(project) {
  return {
    header: {
      date: 'xx-xx-2026',
      title: 'Proposal & Scope of Work',
    },
    to: {
      name: project?.client || '',
      address: '',
      attention: '',
      email: '',
    },
    project: {
      title: project?.name || '',
      location: '',
      sheetNumbers: '',
      date: '',
      addendum: 'N/A',
      estimator: '',
    },
    scopeNote: 'Note: See Qualifications and Materials List below',
    scopeSections: [
      emptyScope('Irrigation System:'),
      emptyScope('Landscape:'),
    ],
    exhibit: { caption: 'Exhibit', imageDataUrl: '' },
    clarifications:
      'This proposal is based upon the plans and specifications provided by the Owner and ' +
      'reflects our best understanding of the work required. Any conditions encountered in ' +
      'the field that differ materially from the drawings will be brought to the Owner’s ' +
      'attention and may result in an adjusted price prior to performance.',
    clarificationsGeneral: [
      'Contractor carries commercial general liability and workers’ compensation insurance as required by law.',
      'Permits and utility locates are the responsibility of the Owner unless noted otherwise in the scope.',
      'This proposal is valid for 30 days from the date above.',
      'Any change to the scope of work must be authorized in writing as a change order before performance.',
      'This agreement shall be governed by the laws of the state in which the work is performed.',
    ],
    payment:
      'Payment terms are Net 30 from the date of invoice. A deposit may be required to ' +
      'schedule work. Final payment is due upon substantial completion. Late balances may ' +
      'accrue interest at the maximum rate permitted by law.',
    signature: {
      companySignatory: '',
    },
    footer:
      'This proposal is prepared in accordance with applicable state regulations. The ' +
      'Contractor is licensed and regulated under state law. All work shall comply with ' +
      'local codes and the approved plans.',
    footerNotice:
      'IMPORTANT NOTICE: You have the right to accept or reject this proposal. Before ' +
      'signing, read the entire document. You are entitled to a copy of the signed proposal ' +
      'and any written warranties. Misrepresentation of material facts by either party may ' +
      'result in remedies under state consumer-protection law.',
    // Legacy materials rows (kept so MTO auto-populate + templates round-trip).
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
  const {
    proposalTemplates, addProposalTemplate, updateProposal,
    company, updateCompany,
  } = useAppData()

  const companiesEqual = (a, b) =>
    a && b && a.name === b.name && a.address === b.address &&
    a.phone === b.phone && a.email === b.email && a.logoDataUrl === b.logoDataUrl

  // Seed the editor from the persisted proposal, falling back to defaults.
  const [doc, setDoc] = useState(() => project?.proposal || defaultProposal(project))
  const [dirty, setDirty] = useState(false)
  const [importErr, setImportErr] = useState(null)
  const [logoErr, setLogoErr] = useState(null)

  // Templates UI
  const [saveTplOpen, setSaveTplOpen] = useState(false)
  const [tplName, setTplName] = useState('')
  const [loadOpen, setLoadOpen] = useState(false)
  const importRef = useRef(null)
  const logoRef = useRef(null)
  const exhibitRef = useRef(null)
  const printRef = useRef(null)

  // If the project's proposal changes externally (e.g. navigation), re-seed.
  useEffect(() => {
    setDoc(project?.proposal || defaultProposal(project))
    setDirty(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Persist on every change.
  const persist = (next) => {
    setDirty(true)
    updateProposal(projectId, next)
  }

  const patch = (updates) => {
    const next = { ...doc, ...updates }
    setDoc(next)
    persist(next)
  }

  // ----- Company (account identity + logo) -----
  const patchCompany = (updates) => updateCompany(updates)

  const onLogoChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\//.test(file.type)) {
      setLogoErr('Please choose an image file (PNG, JPG, SVG).')
      setTimeout(() => setLogoErr(null), 3000)
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = String(ev.target.result)
      patchCompany({ logoDataUrl: dataUrl })
    }
    reader.onerror = () => {
      setLogoErr('Could not read that image.')
      setTimeout(() => setLogoErr(null), 3000)
    }
    reader.readAsDataURL(file)
  }

  // ----- Materials List rows (the editable line-item table) -----
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
      'Refresh the Materials List from the current MTO? This replaces the table with the MTO data.'
    )
    if (confirmed) pullFromMto(true)
  }

  // ----- Scope sections -----
  const patchScope = (id, updates) => {
    patch({
      scopeSections: doc.scopeSections.map((sc) => (sc.id === id ? { ...sc, ...updates } : sc)),
    })
  }
  const addScope = () => patch({ scopeSections: [...doc.scopeSections, emptyScope('')] })
  const removeScope = (id) => {
    const scopeSections = doc.scopeSections.filter((sc) => sc.id !== id)
    patch({ scopeSections: scopeSections.length ? scopeSections : [emptyScope('')] })
  }
  const setBullet = (scopeId, kind, idx, text) => {
    const scope = doc.scopeSections.find((sc) => sc.id === scopeId)
    if (!scope) return
    const list = scope[kind].map((b, i) => (i === idx ? { text } : b))
    patchScope(scopeId, { [kind]: list })
  }
  const addBullet = (scopeId, kind) => {
    const scope = doc.scopeSections.find((sc) => sc.id === scopeId)
    if (!scope) return
    patchScope(scopeId, { [kind]: [...scope[kind], emptyBullet()] })
  }
  const removeBullet = (scopeId, kind, idx) => {
    const scope = doc.scopeSections.find((sc) => sc.id === scopeId)
    if (!scope) return
    const list = scope[kind].filter((_, i) => i !== idx)
    patchScope(scopeId, { [kind]: list.length ? list : [emptyBullet()] })
  }

  // ----- To / Project / Header -----
  const patchTo = (k, v) => patch({ to: { ...doc.to, [k]: v } })
  const patchProject = (k, v) => patch({ project: { ...doc.project, [k]: v } })
  const patchHeader = (k, v) => patch({ header: { ...doc.header, [k]: v } })
  const patchExhibit = (k, v) => patch({ exhibit: { ...doc.exhibit, [k]: v } })
  const patchSignature = (k, v) => patch({ signature: { ...doc.signature, [k]: v } })

  const onExhibitChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\//.test(file.type)) {
      setImportErr('Exhibit images must be an image file.')
      setTimeout(() => setImportErr(null), 3000)
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => patchExhibit('imageDataUrl', String(ev.target.result))
    reader.readAsDataURL(file)
  }

  // --- Templates: save / load / import ---
  // A template captures the full proposal structure (sans live MTO rows, which
  // are re-pulled per project). If the template carries an old `company` field
  // we lift it into the account-level company so the logo/identity follows.
  const structureFromDoc = (d) => ({
    header: d.header,
    to: d.to,
    project: d.project,
    scopeNote: d.scopeNote,
    scopeSections: d.scopeSections,
    exhibit: { caption: d.exhibit?.caption ?? 'Exhibit', imageDataUrl: '' },
    clarifications: d.clarifications,
    clarificationsGeneral: d.clarificationsGeneral,
    payment: d.payment,
    signature: d.signature,
    footer: d.footer,
    footerNotice: d.footerNotice,
    lineItems: (d.lineItems || []).map((li) => ({
      item: li.item, description: li.description, qty: li.qty, unit: li.unit, unitPrice: li.unitPrice,
    })),
  })

  const applyStructure = (st, { liftCompany = true } = {}) => {
    if (!st) return
    // Lift legacy company field into the account company (logo/identity).
    if (liftCompany && st.company && !company?.name) {
      patchCompany({ name: st.company })
    }
    const lineItems = Array.isArray(st.lineItems) && st.lineItems.length
      ? st.lineItems.map((li) => ({
          item: li.item || '', description: li.description || '', qty: li.qty || '', unit: li.unit || '', unitPrice: li.unitPrice || '',
        }))
      : [emptyLine()]

    const legacyBullet = (arr) =>
      Array.isArray(arr) && arr.length
        ? arr.map((x) => ({ text: typeof x === 'string' ? x : (x?.text ?? '') }))
        : null

    const scopeIn = Array.isArray(st.scopeSections) && st.scopeSections.length
      ? st.scopeSections.map((sc) => ({
          id: sc.id || newScopeId(),
          title: sc.title || '',
          inclusions: legacyBullet(sc.inclusions) || [emptyBullet(), emptyBullet()],
          exclusions: legacyBullet(sc.exclusions) || [emptyBullet(), emptyBullet()],
          init: sc.init || '',
          total: sc.total || '',
        }))
      : [emptyScope('Irrigation System:'), emptyScope('Landscape:')]

    patch({
      header: st.header || { date: 'xx-xx-2026', title: 'Proposal & Scope of Work' },
      to: st.to || { name: '', address: '', attention: '', email: '' },
      project: st.project || { title: '', location: '', sheetNumbers: '', date: '', addendum: 'N/A', estimator: '' },
      scopeNote: st.scopeNote || 'Note: See Qualifications and Materials List below',
      scopeSections: scopeIn,
      exhibit: { caption: st.exhibit?.caption ?? 'Exhibit', imageDataUrl: '' },
      clarifications: st.clarifications ?? '',
      clarificationsGeneral: legacyBullet(st.clarificationsGeneral) || [],
      payment: st.payment ?? '',
      signature: st.signature || { companySignatory: '' },
      footer: st.footer ?? '',
      footerNotice: st.footerNotice ?? '',
      lineItems,
      templateId: st.templateId ?? null,
    })
  }

  const handleSaveTemplate = () => {
    const name = tplName.trim() || doc.header.title || 'Proposal template'
    addProposalTemplate({
      name,
      ownerAccountId: 'local',
      structure: structureFromDoc(doc),
    })
    setTplName('')
    setSaveTplOpen(false)
  }

  const handleLoadTemplate = (tpl) => {
    applyStructure(tpl.structure || {}, { liftCompany: false })
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
        const st = parsed.structure || parsed
        applyStructure(st, { liftCompany: true })
      } catch {
        setImportErr('That file is not valid JSON. Import a proposal template (.json).')
        setTimeout(() => setImportErr(null), 3000)
      }
    }
    reader.readAsText(file)
  }

  const handleExportJson = () => {
    const payload = {
      name: doc.header.title || 'Proposal',
      structure: structureFromDoc(doc),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug(doc.header.title || 'proposal')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handlePrint = () => {
    window.requestAnimationFrame(() => window.print())
  }

  const tplList = Object.values(proposalTemplates || {})

  // Signatory fallback uses the account company name.
  const signatoryLabel = doc.signature?.companySignatory ||
    (company?.name ? `Contract Administrator, ${company.name}` : 'Contract Administrator')

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
      {logoErr && (
        <div className={s.errorBar}>
          <X size={14} /> {logoErr}
        </div>
      )}

      {/* The document (white page) */}
      <div className={s.desk}>
        <div className={s.page} ref={printRef} id="proposal-document">
          {/* ===== HEADER BLOCK (account company logo + identity) ===== */}
          <header className={s.docHead}>
            <div className={s.headLeft}>
              {company?.logoDataUrl ? (
                <img src={company.logoDataUrl} alt="Company logo" className={s.logoImg} />
              ) : (
                <button
                  type="button"
                  className={s.logoDrop}
                  onClick={() => logoRef.current?.click()}
                  title="Upload your company logo"
                >
                  <ImagePlus size={20} />
                  <span>Upload your<br />company logo</span>
                </button>
              )}
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={onLogoChange}
              />
              <div className={s.companyId}>
                <input
                  className={s.companyName}
                  value={company?.name || ''}
                  placeholder="Your Company Name"
                  onChange={(e) => patchCompany({ name: e.target.value })}
                  aria-label="Company name"
                />
                <input
                  className={s.companyLine}
                  value={company?.address || ''}
                  placeholder="Street Address, City, ST 00000"
                  onChange={(e) => patchCompany({ address: e.target.value })}
                  aria-label="Company address"
                />
                <div className={s.companyContactRow}>
                  <input
                    className={s.companyLineSm}
                    value={company?.phone || ''}
                    placeholder="(000) 000-0000"
                    onChange={(e) => patchCompany({ phone: e.target.value })}
                    aria-label="Company phone"
                  />
                  <input
                    className={s.companyLineSm}
                    value={company?.email || ''}
                    placeholder="bids@company.com"
                    onChange={(e) => patchCompany({ email: e.target.value })}
                    aria-label="Company email"
                  />
                </div>
              </div>
            </div>
            <div className={s.headRight}>
              <input
                className={s.docTitle}
                value={doc.header.title}
                placeholder="Proposal title"
                onChange={(e) => patchHeader('title', e.target.value)}
              />
              <label className={s.dateField}>
                <span className={s.dateLabel}>Date</span>
                <input
                  className={s.dateInput}
                  value={doc.header.date}
                  placeholder="xx-xx-2026"
                  onChange={(e) => patchHeader('date', e.target.value)}
                />
              </label>
            </div>
          </header>

          {/* ===== TO: block ===== */}
          <section className={s.block}>
            <div className={s.toBlock}>
              <div className={s.toLabel}>To:</div>
              <div className={s.toFields}>
                <input
                  className={s.toInput}
                  value={doc.to.name}
                  placeholder="Customer's full business name"
                  onChange={(e) => patchTo('name', e.target.value)}
                />
                <input
                  className={s.toInput}
                  value={doc.to.address}
                  placeholder="Customer's full business address"
                  onChange={(e) => patchTo('address', e.target.value)}
                />
                <div className={s.toRow}>
                  <input
                    className={s.toInputSm}
                    value={doc.to.attention}
                    placeholder="Attention (name)"
                    onChange={(e) => patchTo('attention', e.target.value)}
                  />
                  <input
                    className={s.toInputSm}
                    value={doc.to.email}
                    placeholder="Email"
                    onChange={(e) => patchTo('email', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ===== PROJECT block ===== */}
          <section className={s.block}>
            <h2 className={s.sectionHeading}>Project</h2>
            <div className={s.projGrid}>
              <label className={s.projField}>
                <span className={s.projLabel}>Project Title</span>
                <input className={s.projInput} value={doc.project.title} onChange={(e) => patchProject('title', e.target.value)} placeholder="Project name" />
              </label>
              <label className={s.projField}>
                <span className={s.projLabel}>Location</span>
                <input className={s.projInput} value={doc.project.location} onChange={(e) => patchProject('location', e.target.value)} placeholder="City, ST" />
              </label>
              <label className={s.projField}>
                <span className={s.projLabel}>Sheet Numbers</span>
                <input className={s.projInput} value={doc.project.sheetNumbers} onChange={(e) => patchProject('sheetNumbers', e.target.value)} placeholder="L-1, I-1, G-1" />
              </label>
              <label className={s.projField}>
                <span className={s.projLabel}>Date</span>
                <input className={s.projInput} value={doc.project.date} onChange={(e) => patchProject('date', e.target.value)} placeholder="xx-xx-2026" />
              </label>
              <label className={s.projField}>
                <span className={s.projLabel}>Specifications</span>
                <input className={s.projInput} value="Per plan sheets listed above" readOnly tabIndex={-1} />
              </label>
              <label className={s.projField}>
                <span className={s.projLabel}>Addendum</span>
                <input className={s.projInput} value={doc.project.addendum} onChange={(e) => patchProject('addendum', e.target.value)} placeholder="N/A" />
              </label>
              <label className={s.projField}>
                <span className={s.projLabel}>Estimator / Job ID</span>
                <input className={s.projInput} value={doc.project.estimator} onChange={(e) => patchProject('estimator', e.target.value)} placeholder="___" />
              </label>
            </div>
          </section>

          {/* ===== Heading line ===== */}
          <p className={s.scopeHeadingLine}>
            Project Completion to be performed as Indicated for Sum(s) Described:
          </p>

          {/* ===== SCOPE OF WORK ===== */}
          <section className={s.block}>
            <h2 className={s.sectionHeading}>Scope of Work</h2>
            <p className={s.scopeNote}>{doc.scopeNote}</p>

            {doc.scopeSections.map((sc) => (
              <div className={s.scopeSection} key={sc.id}>
                <div className={s.scopeHead}>
                  <input
                    className={s.scopeTitle}
                    value={sc.title}
                    placeholder="Section title:"
                    onChange={(e) => patchScope(sc.id, { title: e.target.value })}
                  />
                  <button
                    type="button"
                    className={s.delBtn}
                    onClick={() => removeScope(sc.id)}
                    title="Remove section"
                    aria-label="Remove scope section"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Inclusions */}
                <div className={s.bulletGroup}>
                  <div className={s.bulletLabel}>Inclusions:</div>
                  {sc.inclusions.map((b, i) => (
                    <div className={s.bulletRow} key={i}>
                      <span className={s.bulletDot}>•</span>
                      <input
                        className={s.bulletInput}
                        value={b.text}
                        placeholder="Inclusion line (may end with a $ amount, e.g. ($1,234.00))"
                        onChange={(e) => setBullet(sc.id, 'inclusions', i, e.target.value)}
                      />
                      <button
                        type="button"
                        className={s.delBtn}
                        onClick={() => removeBullet(sc.id, 'inclusions', i)}
                        title="Remove line"
                        aria-label={`Remove inclusion ${i + 1}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={s.addBullet}
                    onClick={() => addBullet(sc.id, 'inclusions')}
                  >
                    <Plus size={13} /> Add inclusion
                  </button>
                </div>

                {/* Exclusions */}
                <div className={s.bulletGroup}>
                  <div className={s.bulletLabel}>Exclusions:</div>
                  {sc.exclusions.map((b, i) => (
                    <div className={s.bulletRow} key={i}>
                      <span className={s.bulletDot}>•</span>
                      <input
                        className={s.bulletInput}
                        value={b.text}
                        placeholder="Exclusion line"
                        onChange={(e) => setBullet(sc.id, 'exclusions', i, e.target.value)}
                      />
                      <button
                        type="button"
                        className={s.delBtn}
                        onClick={() => removeBullet(sc.id, 'exclusions', i)}
                        title="Remove line"
                        aria-label={`Remove exclusion ${i + 1}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={s.addBullet}
                    onClick={() => addBullet(sc.id, 'exclusions')}
                  >
                    <Plus size={13} /> Add exclusion
                  </button>
                </div>

                <div className={s.scopeFooter}>
                  <label className={s.initBox} title="Initials">
                    <span className={s.initLabel}>Init.</span>
                    <input
                      className={s.initInput}
                      value={sc.init}
                      maxLength={6}
                      placeholder=""
                      onChange={(e) => patchScope(sc.id, { init: e.target.value })}
                      aria-label="Initials"
                    />
                  </label>
                  <label className={s.sectionTotal}>
                    <span className={s.sectionTotalLabel}>
                      Total {sc.title ? sc.title.replace(/:$/, '') : 'Section'} Change
                    </span>
                    <span className={s.sectionTotalAmount}>
                      $<input
                        className={s.sectionTotalInput}
                        value={sc.total}
                        placeholder="______"
                        onChange={(e) => patchScope(sc.id, { total: e.target.value })}
                        aria-label="Section total"
                      />
                    </span>
                  </label>
                </div>
              </div>
            ))}

            <button type="button" className={s.addSection} onClick={addScope}>
              <Plus size={14} /> Add scope section
            </button>
          </section>

          {/* ===== EXHIBIT ===== */}
          <section className={s.block}>
            <h2 className={s.sectionHeading}>Exhibit</h2>
            <input
              className={s.exhibitCaption}
              value={doc.exhibit.caption}
              placeholder="Exhibit caption"
              onChange={(e) => patchExhibit('caption', e.target.value)}
            />
            <div className={s.exhibitBox}>
              {doc.exhibit.imageDataUrl ? (
                <img src={doc.exhibit.imageDataUrl} alt={doc.exhibit.caption} className={s.exhibitImg} />
              ) : (
                <button
                  type="button"
                  className={s.exhibitUpload}
                  onClick={() => exhibitRef.current?.click()}
                >
                  <ImagePlus size={18} />
                  <span>Add exhibit image (optional)</span>
                </button>
              )}
              <input
                ref={exhibitRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={onExhibitChange}
              />
            </div>
          </section>

          {/* ===== MATERIALS LIST (from MTO) ===== */}
          <section className={s.block}>
            <div className={s.materialsHead}>
              <h2 className={s.sectionHeading}>Materials List</h2>
              <Button variant="ghost" size="sm" iconLeft={<RefreshCw size={13} />} onClick={handleRefreshFromMto}>
                Refresh from MTO
              </Button>
            </div>
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
          </section>

          {/* ===== CLARIFICATIONS ===== */}
          <section className={s.block}>
            <h2 className={s.sectionHeading}>Clarifications</h2>
            <textarea
              className={s.para}
              value={doc.clarifications}
              placeholder="Clarifications / warranty boilerplate…"
              onChange={(e) => patch({ clarifications: e.target.value })}
              rows={4}
            />
            <div className={s.bulletLabel}>General:</div>
            {doc.clarificationsGeneral.map((b, i) => (
              <div className={s.bulletRow} key={i}>
                <span className={s.bulletDot}>•</span>
                <input
                  className={s.bulletInput}
                  value={b.text}
                  placeholder="General clarification line"
                  onChange={(e) => {
                    const clarificationsGeneral = doc.clarificationsGeneral.map((x, j) => (j === i ? { text: e.target.value } : x))
                    patch({ clarificationsGeneral })
                  }}
                />
                <button
                  type="button"
                  className={s.delBtn}
                  onClick={() => {
                    const clarificationsGeneral = doc.clarificationsGeneral.filter((_, j) => j !== i)
                    patch({ clarificationsGeneral: clarificationsGeneral.length ? clarificationsGeneral : [emptyBullet()] })
                  }}
                  title="Remove line"
                  aria-label={`Remove general line ${i + 1}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={s.addBullet}
              onClick={() => patch({ clarificationsGeneral: [...doc.clarificationsGeneral, emptyBullet()] })}
            >
              <Plus size={13} /> Add general point
            </button>
          </section>

          {/* ===== PAYMENT ===== */}
          <section className={s.block}>
            <h2 className={s.sectionHeading}>Payment / Payment Schedule</h2>
            <textarea
              className={s.para}
              value={doc.payment}
              placeholder="Payment terms / schedule…"
              onChange={(e) => patch({ payment: e.target.value })}
              rows={4}
            />
          </section>

          {/* ===== SIGNATURE BLOCK ===== */}
          <section className={s.block}>
            <h2 className={s.sectionHeading}>Acceptance &amp; Signature</h2>
            <div className={s.signGrid}>
              <div className={s.signCell}>
                <div className={s.signLine} />
                <div className={s.signCap}>By: {signatoryLabel}</div>
              </div>
              <div className={s.signCell}>
                <div className={s.signLine} />
                <div className={s.signCap}>Accepted By:</div>
              </div>
              <div className={s.signCell}>
                <div className={s.signLine} />
                <div className={s.signCap}>Title:</div>
              </div>
              <div className={s.signCell}>
                <div className={s.signLine} />
                <div className={s.signCap}>Date</div>
              </div>
              <div className={s.signCell}>
                <div className={s.signLine} />
                <div className={s.signCap}>Printed Name / Title:</div>
              </div>
              <div className={s.signCell}>
                <div className={s.signLine} />
                <div className={s.signCap}>Date</div>
              </div>
            </div>
            <label className={s.signatoryEdit}>
              <span className={s.signatoryLabel}>Contractor signatory line</span>
              <input
                className={s.signatoryInput}
                value={doc.signature?.companySignatory || ''}
                placeholder={`Contract Administrator, ${company?.name || 'Your Company'}`}
                onChange={(e) => patchSignature('companySignatory', e.target.value)}
              />
            </label>
          </section>

          {/* ===== REGULATORY FOOTER ===== */}
          <footer className={s.docFoot}>
            <h2 className={s.sectionHeading}>Regulatory Notice</h2>
            <textarea
              className={s.footText}
              value={doc.footer}
              placeholder="Regulatory notice (state-specific)…"
              onChange={(e) => patch({ footer: e.target.value })}
              rows={3}
            />
            <textarea
              className={s.footText}
              value={doc.footerNotice}
              placeholder="IMPORTANT NOTICE — consumer rights…"
              onChange={(e) => patch({ footerNotice: e.target.value })}
              rows={3}
            />
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
                  <div className={s.tplSub}>{(t.structure?.scopeSections || []).length} scope sections</div>
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
            padding: 24px 28px !important;
          }
          .${s.desk} { background: #fff !important; padding: 0 !important; }
          .${s.toolbar}, .${s.errorBar} { display: none !important; }
          /* Don't break the signature / scope blocks awkwardly across pages. */
          .${s.block}, .${s.scopeSection}, .${s.signGrid}, .${s.docTable} { page-break-inside: avoid; }
          .${s.sectionHeading} { page-break-after: avoid; }
        }
      `}</style>
    </div>
  )
}

function slug(str = '') {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'proposal'
}
