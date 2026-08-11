import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { PROJECTS as D_PROJECTS, SHEETS as D_SHEETS } from './sampleData.js'
import { emptyOcrMemory, addSample as addOcrSample, addCorrection as addOcrCorrection } from './ocrLearning.js'

const Ctx = createContext(null)
const VER = '6'

// Module-level in-memory cache. Parsed once per page-load; reused instantly on
// any provider re-mount (rapid navigation, HMR, StrictMode double-mount) so we
// never re-parse localStorage JSON while clicking around. "Load once, reuse
// instantly."
const dataCache = { loaded: false, snapshot: null }

// Migrate the legacy single `project.mto` shape into the new versioned array.
// Old:  project.mto = { fileName, uploadedAt, headers, rows, columnMap }
// New:  project.mtoVersions = [ { id, v:1, templateId:null, ..., isCurrent:true } ]
// Projects that have no `mto` and no `mtoVersions` get an empty array so the
// rest of the app can rely on `mtoVersions` always being an array.
//
// Migrate the legacy single `project.proposal` shape into a versioned array,
// the same way, so a job can carry multiple proposal versions (e.g. a change
// order or a revised plan set) instead of one document that gets overwritten.
// Old:  project.proposal = { header, to, project, scopeSections, ... }
// New:  project.proposalVersions = [ { id, v:1, name, isCurrent:true, header, to, ... } ]
function migrateProjects(projects) {
  if (!projects) return {}
  const out = {}
  for (const [pid, proj] of Object.entries(projects)) {
    const p = { ...proj }
    if (p.mto) {
      const m = p.mto
      p.mtoVersions = [{
        id: `mto-${Date.now()}-${pid}`,
        v: 1,
        templateId: null,
        fileName: m.fileName || null,
        uploadedAt: m.uploadedAt || null,
        headers: Array.isArray(m.headers) ? m.headers : [],
        rows: Array.isArray(m.rows) ? m.rows : [],
        columnMap: m.columnMap && typeof m.columnMap === 'object' ? m.columnMap : {},
        reviewed: !!(m.columnMap && Object.keys(m.columnMap).length),
        isCurrent: true,
      }]
      delete p.mto
    } else if (!Array.isArray(p.mtoVersions)) {
      p.mtoVersions = []
    }
    if (p.proposal) {
      p.proposalVersions = [{
        id: `prop-${Date.now()}-${pid}`,
        v: 1,
        name: 'Original Proposal',
        createdAt: p.proposal.createdAt || new Date().toISOString(),
        isCurrent: true,
        ...p.proposal,
      }]
      delete p.proposal
    } else if (!Array.isArray(p.proposalVersions)) {
      p.proposalVersions = []
    }
    out[pid] = p
  }
  return out
}

function load() {
  if (dataCache.loaded) return dataCache.snapshot
  let snap = null
  try {
    const d = JSON.parse(localStorage.getItem('plotline-appdata') || 'null')
    // Accept any snapshot that carries a recognizable projects object; migrate
    // the legacy `mto` shape regardless of the stored version stamp so data is
    // never silently dropped, then stamp it with the current VER on save.
    if (d && typeof d.projects === 'object') {
      snap = {
        ...d,
        projects: migrateProjects(d.projects),
        clients: d.clients && typeof d.clients === 'object' ? d.clients : {},
        mtoTemplates: d.mtoTemplates && typeof d.mtoTemplates === 'object' ? d.mtoTemplates : {},
        phrases: d.phrases && typeof d.phrases === 'object' ? d.phrases : {},
        pdfAssets: d.pdfAssets && typeof d.pdfAssets === 'object' ? d.pdfAssets : {},
        ocrMemory: d.ocrMemory && typeof d.ocrMemory === 'object' ? d.ocrMemory : emptyOcrMemory(),
        vendors: Array.isArray(d.vendors) ? d.vendors : [],
      }
    }
  } catch {}
  dataCache.loaded = true
  dataCache.snapshot = snap
  return snap
}

export function AppDataProvider({ children }) {
  const saved = load()
  const [projects, setProjects] = useState(saved?.projects ?? migrateProjects(D_PROJECTS))
  const [sheets, setSheets]     = useState(saved?.sheets   ?? D_SHEETS)
  const [customCats, setCustomCats] = useState(saved?.customCats ?? [])
  const [clients, setClients]   = useState(saved?.clients ?? {})
  const [mtoTemplates, setMtoTemplates] = useState(saved?.mtoTemplates ?? {})
  const [proposalTemplates, setProposalTemplates] = useState(saved?.proposalTemplates ?? {})
  // Account-level "template phrases" — reusable boilerplate text snippets for
  // proposals, shared/reused across every project (like proposalTemplates).
  const [phrases, setPhrases] = useState(saved?.phrases ?? {})
  // One entry per SOURCE PDF file uploaded through the sheet wizard (keyed by
  // fileId), not per sheet. A single multi-page plan set split into N sheets
  // used to embed a full duplicate copy of the PDF in every one of those N
  // sheets' `pdfUrl` — for a 20-sheet set that's 20x the bytes, on every
  // autosave, to both localStorage and the cloud snapshot. Sheets from a
  // wizard import now carry a lightweight `pdfAssetId` pointing in here
  // instead. Legacy sheets (pre-dating this) still carry their own `pdfUrl`
  // directly and keep working unchanged.
  const [pdfAssets, setPdfAssets] = useState(saved?.pdfAssets ?? {})
  // Account-level vendor directory, shared across every project (job management).
  const [vendors, setVendors] = useState(saved?.vendors ?? [])
  // "Correction memory" for the sheet-upload wizard's OCR guesses — see
  // src/data/ocrLearning.js for what this actually does (pattern learning,
  // not ML).
  const [ocrMemory, setOcrMemory] = useState(saved?.ocrMemory ?? emptyOcrMemory())
  // Account-level company profile (logo + identity used on customer-facing docs).
  const [company, setCompany] = useState(saved?.company ?? {
    name: '', address: '', phone: '', email: '', logoDataUrl: '',
  })
  // Optimistic save indicator: mutations flip this to 'saving' instantly, then
  // back to 'saved' once the background (debounced) persist resolves.
  const [saveStatus, setSaveStatus] = useState('saved')

  const lsTimerRef = useRef(null)
  const firstRunRef = useRef(true)
  useEffect(() => {
    // Skip the initial mount so we don't flash "Saving…" on first paint.
    if (firstRunRef.current) { firstRunRef.current = false; return }
    setSaveStatus('saving')
    if (lsTimerRef.current) clearTimeout(lsTimerRef.current)
    lsTimerRef.current = setTimeout(() => {
      const snapshot = { v: VER, projects, sheets, customCats, clients, mtoTemplates, proposalTemplates, phrases, company, pdfAssets, ocrMemory, vendors }
      localStorage.setItem('plotline-appdata', JSON.stringify(snapshot))
      // Keep the module cache in sync so remounts reuse fresh data.
      dataCache.loaded = true
      dataCache.snapshot = snapshot
      setSaveStatus('saved')
    }, 500)
    return () => clearTimeout(lsTimerRef.current)
  }, [projects, sheets, customCats, clients, mtoTemplates, proposalTemplates, phrases, company, pdfAssets, ocrMemory, vendors])

  const addProject = (proj) =>
    setProjects(p => ({ ...p, [proj.id]: proj }))

  const updateProject = (projectId, updates) =>
    setProjects(p => ({ ...p, [projectId]: { ...p[projectId], ...updates } }))

  // Account-level vendors (shared across projects). Adds a vendor if a
  // case-insensitive match doesn't already exist; returns the vendor id either
  // way so callers can reference it.
  const addVendor = (name) => {
    const clean = (name || '').trim()
    if (!clean) return null
    const existing = vendors.find(v => v.name.toLowerCase() === clean.toLowerCase())
    if (existing) return existing.id
    const id = `ven-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setVendors(list => [...list, { id, name: clean }])
    return id
  }
  const deleteVendor = (id) => setVendors(list => list.filter(v => v.id !== id))

  // Persist edits to a project's CURRENT proposal version, in place (the
  // "Pricebook" editor autosaves here on every field change). No-op if the
  // job has no proposal version yet — callers should addProposalVersion first.
  const updateProposal = (projectId, updates) =>
    setProjects(p => {
      const proj = p[projectId]
      if (!proj) return p
      const list = proj.proposalVersions || []
      if (!list.some(x => x.isCurrent)) return p
      const next = list.map(x => (x.isCurrent ? { ...x, ...updates } : x))
      return { ...p, [projectId]: { ...proj, proposalVersions: next } }
    })

  // --- Proposal templates (account-level, reusable proposal structures) ---
  const addProposalTemplate = (tpl) => {
    const id = tpl.id || `ptpl-${Date.now()}`
    const full = {
      id,
      name: tpl.name || 'Untitled proposal template',
      ownerAccountId: tpl.ownerAccountId || 'local',
      createdAt: tpl.createdAt || new Date().toISOString(),
      structure: tpl.structure || {},
    }
    setProposalTemplates(t => ({ ...t, [id]: full }))
    return id
  }

  const updateProposalTemplate = (tplId, updates) =>
    setProposalTemplates(t => ({ ...t, [tplId]: { ...t[tplId], ...updates } }))

  // --- Template phrases (account-level, reusable boilerplate snippets) ---
  const addPhrase = (text) => {
    const clean = (text || '').trim()
    if (!clean) return null
    const id = `phr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setPhrases(t => ({ ...t, [id]: { id, text: clean, createdAt: new Date().toISOString() } }))
    return id
  }
  const deletePhrase = (id) =>
    setPhrases(t => { const next = { ...t }; delete next[id]; return next })

  // Account-level company profile (logo + identity). Merge so partial updates
  // keep other fields. Persisted to localStorage + cloud snapshot via the
  // provider's save effect.
  const updateCompany = (updates) =>
    setCompany(c => ({ ...c, ...updates }))

  const addSheet = (projectId, sheet) => {
    setSheets(s => ({ ...s, [sheet.id]: sheet }))
    setProjects(p => ({
      ...p,
      [projectId]: {
        ...p[projectId],
        sheetIds: [...(p[projectId]?.sheetIds || []), sheet.id],
      },
    }))
  }

  const addSheets = (projectId, sheetArray) => {
    setSheets(s => {
      const next = { ...s }
      for (const sh of sheetArray) next[sh.id] = { ...sh, projectId }
      return next
    })
    setProjects(p => ({
      ...p,
      [projectId]: {
        ...p[projectId],
        sheetIds: [...(p[projectId]?.sheetIds || []), ...sheetArray.map(s => s.id)],
      },
    }))
  }

  const updateSheet = (sheetId, updates) =>
    setSheets(s => ({ ...s, [sheetId]: { ...s[sheetId], ...updates } }))

  // Register one or more shared PDF byte-blobs (keyed by fileId). Merges —
  // never drops assets other sheets/projects still reference.
  const addPdfAssets = (assetsMap) => {
    if (!assetsMap || !Object.keys(assetsMap).length) return
    setPdfAssets(a => ({ ...a, ...assetsMap }))
  }

  // Record a confirmed sheet-number/title value (whether auto-filled
  // correctly or hand-typed) so its FORMAT feeds future pattern-matching.
  const recordOcrSample = (field, value) =>
    setOcrMemory(m => addOcrSample(m, field, value))

  // Record that the bot's guess was wrong and what the real value was.
  const recordOcrCorrection = (field, guess, corrected) =>
    setOcrMemory(m => addOcrCorrection(m, field, guess, corrected))

  const addCustomCat = (cat) =>
    setCustomCats(prev => [...prev, cat])

  const deleteCustomCat = (catId) =>
    setCustomCats(prev => prev.filter(c => c.id !== catId))

  const addRegion = (projectId, region) =>
    setProjects(p => ({
      ...p,
      [projectId]: { ...p[projectId], regions: [...(p[projectId]?.regions || []), region] },
    }))

  const updateRegion = (projectId, regionId, updates) =>
    setProjects(p => ({
      ...p,
      [projectId]: {
        ...p[projectId],
        regions: (p[projectId]?.regions || []).map(r => r.id === regionId ? { ...r, ...updates } : r),
      },
    }))

  const deleteRegion = (projectId, regionId) =>
    setProjects(p => ({
      ...p,
      [projectId]: {
        ...p[projectId],
        regions: (p[projectId]?.regions || []).filter(r => r.id !== regionId),
      },
    }))

  const addSheetSet = (projectId, setName) => {
    const id = `set-${Date.now()}`
    setProjects(p => ({
      ...p,
      [projectId]: {
        ...p[projectId],
        sheetSets: [...(p[projectId]?.sheetSets || []), { id, name: setName, sheetIds: [] }],
      },
    }))
    return id
  }

  const renameSheetSet = (projectId, setId, name) => {
    setProjects(p => ({
      ...p,
      [projectId]: {
        ...p[projectId],
        sheetSets: (p[projectId]?.sheetSets || []).map(s => s.id === setId ? { ...s, name } : s),
      },
    }))
  }

  const deleteSheetSet = (projectId, setId) => {
    setProjects(p => ({
      ...p,
      [projectId]: {
        ...p[projectId],
        sheetSets: (p[projectId]?.sheetSets || []).filter(s => s.id !== setId),
      },
    }))
  }

  const moveSheetToSet = (projectId, sheetId, setId) => {
    setProjects(p => {
      const proj = p[projectId]
      const sets = (proj?.sheetSets || []).map(s => ({
        ...s,
        sheetIds: s.id === setId
          ? [...new Set([...s.sheetIds, sheetId])]
          : s.sheetIds.filter(id => id !== sheetId),
      }))
      return { ...p, [projectId]: { ...proj, sheetSets: sets } }
    })
  }

  // --- MTO templates (account-level, reusable schemas) ---

  const addMtoTemplate = (tpl) => {
    const id = tpl.id || `mto-${Date.now()}`
    const full = {
      id,
      name: tpl.name || 'Untitled template',
      ownerAccountId: tpl.ownerAccountId || 'local',
      canonicalMapping: tpl.canonicalMapping || {},
      sampleHeaders: Array.isArray(tpl.sampleHeaders) ? tpl.sampleHeaders : [],
      createdAt: tpl.createdAt || new Date().toISOString(),
    }
    setMtoTemplates(t => ({ ...t, [id]: full }))
    return id
  }

  const updateMtoTemplate = (tplId, updates) =>
    setMtoTemplates(t => ({ ...t, [tplId]: { ...t[tplId], ...updates } }))

  // --- MTO versions (per-project, versioned instances) ---

  const addMtoVersion = (projectId, version) => {
    setProjects(p => {
      const proj = p[projectId]
      if (!proj) return p
      const list = Array.isArray(proj.mtoVersions) ? [...proj.mtoVersions] : []
      const next = list.length + 1
      const v = {
        id: version.id || `mto-${Date.now()}`,
        v: version.v || next,
        templateId: version.templateId ?? null,
        fileName: version.fileName ?? null,
        uploadedAt: version.uploadedAt ?? null,
        headers: version.headers ?? [],
        rows: version.rows ?? [],
        columnMap: version.columnMap ?? {},
        reviewed: version.reviewed ?? false,
        isCurrent: true,
      }
      const demoted = list.map(x => ({ ...x, isCurrent: false }))
      return { ...p, [projectId]: { ...proj, mtoVersions: [...demoted, v] } }
    })
  }

  const setCurrentMtoVersion = (projectId, versionId) => {
    setProjects(p => {
      const proj = p[projectId]
      if (!proj) return p
      const list = (proj.mtoVersions || []).map(x => ({ ...x, isCurrent: x.id === versionId }))
      return { ...p, [projectId]: { ...proj, mtoVersions: list } }
    })
  }

  const removeMtoVersion = (projectId, versionId) => {
    setProjects(p => {
      const proj = p[projectId]
      if (!proj) return p
      const list = (proj.mtoVersions || []).filter(x => x.id !== versionId)
      // If we removed the current version, promote the most-recent remaining
      // one (highest v) as current; otherwise leave the array as-is.
      if (!list.some(x => x.isCurrent) && list.length) {
        const latest = list.reduce((a, b) => (b.v > a.v ? b : a))
        latest.isCurrent = true
      }
      return { ...p, [projectId]: { ...proj, mtoVersions: list } }
    })
  }

  const updateMtoVersion = (projectId, versionId, updates) => {
    setProjects(p => {
      const proj = p[projectId]
      if (!proj) return p
      const list = (proj.mtoVersions || []).map(x =>
        x.id === versionId ? { ...x, ...updates } : x
      )
      return { ...p, [projectId]: { ...proj, mtoVersions: list } }
    })
  }

  // --- Proposal versions (per-project — e.g. a change order or a revised
  // plan set gets its own version instead of overwriting the original bid) ---

  const addProposalVersion = (projectId, version) => {
    setProjects(p => {
      const proj = p[projectId]
      if (!proj) return p
      const list = Array.isArray(proj.proposalVersions) ? [...proj.proposalVersions] : []
      const next = list.length + 1
      const { id, v, name, createdAt, isCurrent, ...content } = version || {}
      const entry = {
        ...content,
        id: id || `prop-${Date.now()}`,
        v: v || next,
        name: name || `Version ${next}`,
        createdAt: createdAt || new Date().toISOString(),
        isCurrent: true,
      }
      const demoted = list.map(x => ({ ...x, isCurrent: false }))
      return { ...p, [projectId]: { ...proj, proposalVersions: [...demoted, entry] } }
    })
  }

  const setCurrentProposalVersion = (projectId, versionId) => {
    setProjects(p => {
      const proj = p[projectId]
      if (!proj) return p
      const list = (proj.proposalVersions || []).map(x => ({ ...x, isCurrent: x.id === versionId }))
      return { ...p, [projectId]: { ...proj, proposalVersions: list } }
    })
  }

  const removeProposalVersion = (projectId, versionId) => {
    setProjects(p => {
      const proj = p[projectId]
      if (!proj) return p
      const list = (proj.proposalVersions || []).filter(x => x.id !== versionId)
      // If we removed the current version, promote the most-recent remaining
      // one (highest v) as current; otherwise leave the array as-is.
      if (!list.some(x => x.isCurrent) && list.length) {
        const latest = list.reduce((a, b) => (b.v > a.v ? b : a))
        latest.isCurrent = true
      }
      return { ...p, [projectId]: { ...proj, proposalVersions: list } }
    })
  }

  const updateProposalVersion = (projectId, versionId, updates) => {
    setProjects(p => {
      const proj = p[projectId]
      if (!proj) return p
      const list = (proj.proposalVersions || []).map(x =>
        x.id === versionId ? { ...x, ...updates } : x
      )
      return { ...p, [projectId]: { ...proj, proposalVersions: list } }
    })
  }

  // --- Cloud hydration / reset (additive; used by AuthProvider) ---
  // Replace the full collections in one shot (from a cloud snapshot).
  // `merge` keeps existing local keys when the incoming value is empty.
  const hydrate = (snapshot, merge = true) => {
    if (!snapshot) return
    setProjects(p => merge && p && Object.keys(p).length
      ? { ...p, ...(snapshot.projects ?? {}) }
      : (snapshot.projects ?? {}))
    setSheets(s => merge && s && Object.keys(s).length
      ? { ...s, ...(snapshot.sheets ?? {}) }
      : (snapshot.sheets ?? {}))
    setCustomCats(prev => merge && prev.length
      ? [...prev, ...(snapshot.customCats ?? [])]
      : (snapshot.customCats ?? []))
    setClients(c => merge && c && Object.keys(c).length
      ? { ...c, ...(snapshot.clients ?? {}) }
      : (snapshot.clients ?? {}))
    setMtoTemplates(t => merge && t && Object.keys(t).length
      ? { ...t, ...(snapshot.mtoTemplates ?? {}) }
      : (snapshot.mtoTemplates ?? {}))
    setProposalTemplates(t => merge && t && Object.keys(t).length
      ? { ...t, ...(snapshot.proposalTemplates ?? {}) }
      : (snapshot.proposalTemplates ?? {}))
    setPhrases(t => merge && t && Object.keys(t).length
      ? { ...t, ...(snapshot.phrases ?? {}) }
      : (snapshot.phrases ?? {}))
    setPdfAssets(a => merge && a && Object.keys(a).length
      ? { ...a, ...(snapshot.pdfAssets ?? {}) }
      : (snapshot.pdfAssets ?? {}))
    setOcrMemory(m => merge && m
      ? { ...m, ...(snapshot.ocrMemory ?? {}) }
      : (snapshot.ocrMemory ?? emptyOcrMemory()))
    setCompany(prev => merge && prev && prev.name
      ? { ...prev, ...(snapshot.company ?? {}) }
      : (snapshot.company ?? prev))
    setVendors(prev => {
      const incoming = snapshot.vendors ?? []
      if (!(merge && prev.length)) return incoming
      const seen = new Set(prev.map(v => v.name.toLowerCase()))
      return [...prev, ...incoming.filter(v => !seen.has((v.name || '').toLowerCase()))]
    })
  }

  // Reset to empty defaults (used on sign-out).
  const reset = () => {
    setProjects({})
    setSheets({})
    setCustomCats([])
    setClients({})
    setMtoTemplates({})
    setProposalTemplates({})
    setPhrases({})
    setPdfAssets({})
    setOcrMemory(emptyOcrMemory())
    setCompany({ name: '', address: '', phone: '', email: '', logoDataUrl: '' })
    setVendors([])
  }

  return (
    <Ctx.Provider value={{
      projects, sheets, customCats, clients, mtoTemplates, proposalTemplates,
      pdfAssets, addPdfAssets,
      ocrMemory, recordOcrSample, recordOcrCorrection,
      company, updateCompany,
      vendors, addVendor, deleteVendor,
      saveStatus,
      addProject, updateProject,
      addSheet, addSheets, updateSheet,
      addCustomCat, deleteCustomCat,
      addRegion, updateRegion, deleteRegion,
      addSheetSet, renameSheetSet, deleteSheetSet, moveSheetToSet,
      addMtoTemplate, updateMtoTemplate,
      addMtoVersion, setCurrentMtoVersion, removeMtoVersion, updateMtoVersion,
      updateProposal,
      addProposalVersion, setCurrentProposalVersion, removeProposalVersion, updateProposalVersion,
      addProposalTemplate, updateProposalTemplate,
      phrases, addPhrase, deletePhrase,
      hydrate, reset,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAppData = () => useContext(Ctx)
