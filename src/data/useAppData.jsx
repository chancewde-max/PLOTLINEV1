import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { PROJECTS as D_PROJECTS, SHEETS as D_SHEETS } from './sampleData.js'

const Ctx = createContext(null)
const VER = '5'

// Module-level in-memory cache. Parsed once per page-load; reused instantly on
// any provider re-mount (rapid navigation, HMR, StrictMode double-mount) so we
// never re-parse localStorage JSON while clicking around. "Load once, reuse
// instantly."
const dataCache = { loaded: false, snapshot: null }

function load() {
  if (dataCache.loaded) return dataCache.snapshot
  let snap = null
  try {
    const d = JSON.parse(localStorage.getItem('plotline-appdata') || 'null')
    if (d?.v === VER) snap = d
  } catch {}
  dataCache.loaded = true
  dataCache.snapshot = snap
  return snap
}

export function AppDataProvider({ children }) {
  const saved = load()
  const [projects, setProjects] = useState(saved?.projects ?? D_PROJECTS)
  const [sheets, setSheets]     = useState(saved?.sheets   ?? D_SHEETS)
  const [customCats, setCustomCats] = useState(saved?.customCats ?? [])
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
      const snapshot = { v: VER, projects, sheets, customCats }
      localStorage.setItem('plotline-appdata', JSON.stringify(snapshot))
      // Keep the module cache in sync so remounts reuse fresh data.
      dataCache.loaded = true
      dataCache.snapshot = snapshot
      setSaveStatus('saved')
    }, 500)
    return () => clearTimeout(lsTimerRef.current)
  }, [projects, sheets, customCats])

  const addProject = (proj) =>
    setProjects(p => ({ ...p, [proj.id]: proj }))

  const updateProject = (projectId, updates) =>
    setProjects(p => ({ ...p, [projectId]: { ...p[projectId], ...updates } }))

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
  }

  // Reset to empty defaults (used on sign-out).
  const reset = () => {
    setProjects({})
    setSheets({})
    setCustomCats([])
  }

  return (
    <Ctx.Provider value={{
      projects, sheets, customCats,
      saveStatus,
      addProject, updateProject,
      addSheet, addSheets, updateSheet,
      addCustomCat, deleteCustomCat,
      addRegion, updateRegion, deleteRegion,
      addSheetSet, renameSheetSet, deleteSheetSet, moveSheetToSet,
      hydrate, reset,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAppData = () => useContext(Ctx)
