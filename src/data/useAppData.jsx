import React, { createContext, useContext, useState, useEffect } from 'react'
import { PROJECTS as D_PROJECTS, SHEETS as D_SHEETS } from './sampleData.js'

const Ctx = createContext(null)
const VER = '1'

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
  const [sheets, setSheets] = useState(saved?.sheets ?? D_SHEETS)

  useEffect(() => {
    localStorage.setItem('plotline-appdata', JSON.stringify({ v: VER, projects, sheets }))
  }, [projects, sheets])

  const addProject = (proj) =>
    setProjects(p => ({ ...p, [proj.id]: proj }))

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

  return (
    <Ctx.Provider value={{ projects, sheets, addProject, addSheet }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAppData = () => useContext(Ctx)
