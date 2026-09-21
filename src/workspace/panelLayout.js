export const PANEL_MIN_PX = 200
export const DEFAULT_LEFT_PANEL_W = 264
export const DEFAULT_RIGHT_PANEL_W = 320
export const LEFT_PANEL_W_KEY = 'plotline-leftPanelW'
export const RIGHT_PANEL_W_KEY = 'plotline-rightPanelW'

export function viewportWidth() {
  return typeof window !== 'undefined' ? window.innerWidth : 1280
}

export function clampPanelWidth(w, viewportW = viewportWidth()) {
  const n = Number(w)
  if (!Number.isFinite(n)) return PANEL_MIN_PX
  const max = Math.max(PANEL_MIN_PX, viewportW * 0.4)
  return Math.max(PANEL_MIN_PX, Math.min(max, n))
}

export function readStoredPanelWidth(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key) ?? localStorage.getItem(key)
    const n = parseFloat(raw)
    if (Number.isFinite(n)) return clampPanelWidth(n)
  } catch { /* ignore */ }
  return clampPanelWidth(fallback)
}

export function persistPanelWidth(key, w) {
  const n = clampPanelWidth(w)
  try {
    sessionStorage.setItem(key, String(n))
    localStorage.setItem(key, String(n))
  } catch { /* ignore */ }
  return n
}
