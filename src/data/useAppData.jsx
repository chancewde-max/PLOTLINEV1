import React, { createContext, useContext, useState, useEffect } from 'react'
import { PROJECTS as D_PROJECTS, SHEETS as D_SHEETS } from './sampleData.js'

const Ctx = createContext(null)
const VER = '4'

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

  useEffect(() => {
    localStorage.setItem('plotline-appdata', JSON.stringify({ v: VER, projects, sheets, customCats }))
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

  const updateSheet = (sheetId, updates) =>
    setSheets(s => ({ ...s, [sheetId]: { ...s[sheetId], ...updates } }))

  const addCustomCat = (cat) =>
    setCustomCats(prev => [...prev, cat])

  const deleteCustomCat = (catId) =>
    setCustomCats(prev => prev.filter(c => c.id !== catId))

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

  return (
    <Ctx.Provider value={{
      projects, sheets, customCats,
      addProject, updateProject,
      addSheet, updateSheet,
      addCustomCat, deleteCustomCat,
      addSheetSet, renameSheetSet, deleteSheetSet, moveSheetToSet,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAppData = () => useContext(Ctx)
