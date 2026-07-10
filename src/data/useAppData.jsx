import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { PROJECTS as D_PROJECTS, SHEETS as D_SHEETS } from './sampleData.js'

const Ctx = createContext(null)
const VER = '5'

function load() {
  try {
    const d = JSON.parse(localStorage.getItem('plotline-appdata') || 'null')
    if (d?.v === VER) return d
  } catch {}
  return null
}

export function AppDataProvider({ children }) {
  const saved = load()
  const [projects, setProjects] = useState(saved?.projects ?? D_PROJECTS)
  const [sheets, setSheets]     = useState(saved?.sheets   ?? D_SHEETS)
  const [customCats, setCustomCats] = useState(saved?.customCats ?? [])

  const lsTimerRef = useRef(null)
  useEffect(() => {
    if (lsTimerRef.current) clearTimeout(lsTimerRef.current)
    lsTimerRef.current = setTimeout(() => {
      localStorage.setItem('plotline-appdata', JSON.stringify({ v: VER, projects, sheets, customCats }))
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
