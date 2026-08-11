import React, { createContext, useContext, useState, useEffect } from 'react'

const Ctx = createContext(null)

// Default keyboard shortcuts for sheet-editor actions. Values are the raw
// KeyboardEvent.key, uppercased for letter keys (function keys like F3 keep
// their name as-is). Customized via Settings > Hotkeys.
export const DEFAULT_HOTKEYS = {
  select:  'V',
  pan:     'H',
  region:  'R',
  measure: 'M',
  text:    'T',
  area:    'A',
  linear:  'L',
  count:   'C',
  newItem: 'N',
  undo:    'Z',
  snap:    'F3',
  ortho:   'F8',
}

export const HOTKEY_LABELS = {
  select:  'Select tool',
  pan:     'Pan tool',
  region:  'Region count tool',
  measure: 'Measure tool',
  text:    'Text tool',
  area:    'Area tool',
  linear:  'Linear tool',
  count:   'Count tool',
  newItem: 'New item (in active tool)',
  undo:    'Undo (with Ctrl/Cmd)',
  snap:    'Toggle snap',
  ortho:   'Toggle ortho',
}

// Default order of the primary drawing-tool buttons in the sheet-editor
// toolbar. Customized by dragging buttons around; persisted per-browser.
export const DEFAULT_TOOLBAR_ORDER = ['select', 'pan', 'region', 'measure', 'text', 'area', 'linear', 'count']

function load() {
  try { return JSON.parse(localStorage.getItem('plotline-settings') || 'null') } catch { return null }
}

export function SettingsProvider({ children }) {
  const saved = load()
  const [theme, setTheme] = useState(saved?.theme || 'light')
  const [accent, setAccent] = useState(saved?.accent || 'green')
  const [hotkeys, setHotkeys] = useState({ ...DEFAULT_HOTKEYS, ...(saved?.hotkeys || {}) })
  const [toolbarOrder, setToolbarOrder] = useState(saved?.toolbarOrder || DEFAULT_TOOLBAR_ORDER)

  useEffect(() => {
    localStorage.setItem('plotline-settings', JSON.stringify({ theme, accent, hotkeys, toolbarOrder }))
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme, accent, hotkeys, toolbarOrder])

  // Apply on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [])

  const setHotkey = (actionId, key) => {
    setHotkeys(prev => ({ ...prev, [actionId]: key }))
  }
  const resetHotkeys = () => setHotkeys(DEFAULT_HOTKEYS)
  const resetToolbarOrder = () => setToolbarOrder(DEFAULT_TOOLBAR_ORDER)

  return (
    <Ctx.Provider value={{
      theme, setTheme, accent, setAccent,
      hotkeys, setHotkey, setHotkeys, resetHotkeys,
      toolbarOrder, setToolbarOrder, resetToolbarOrder,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useSettings = () => useContext(Ctx)
