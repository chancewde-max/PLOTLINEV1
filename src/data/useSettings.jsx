import React, { createContext, useContext, useState, useEffect } from 'react'

const Ctx = createContext(null)

function load() {
  try { return JSON.parse(localStorage.getItem('plotline-settings') || 'null') } catch { return null }
}

export function SettingsProvider({ children }) {
  const saved = load()
  const [theme, setTheme] = useState(saved?.theme || 'light')
  const [accent, setAccent] = useState(saved?.accent || 'green')

  useEffect(() => {
    localStorage.setItem('plotline-settings', JSON.stringify({ theme, accent }))
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme, accent])

  // Apply on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [])

  return (
    <Ctx.Provider value={{ theme, setTheme, accent, setAccent }}>
      {children}
    </Ctx.Provider>
  )
}

export const useSettings = () => useContext(Ctx)
