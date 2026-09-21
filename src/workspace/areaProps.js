import { polyAreaPx } from './geometry.js'

// Soil Area inspector is IN SCOPE: Custom depth → cy + topsoil.
// Depth-inch PRESET lists stay empty — do not invent inches.
// Turf rolls are free L×W only (no thickness).

export const TOPSOIL_OPTIONS = [
  { value: 'enriched', label: 'Enriched' },
  { value: 'sandy_loam', label: 'Sandy loam' },
  { value: '4way', label: '4-way mix' },
  { value: 'custom', label: 'Custom' },
  { value: 'none', label: 'None' },
]

// No product inch list in repo. Do not invent presets.
export const DEPTH_PRESETS = []

export function volumeCuFt(areaSqFt, depthIn) {
  const d = parseFloat(depthIn)
  if (!Number.isFinite(d) || d <= 0 || !Number.isFinite(areaSqFt)) return 0
  return areaSqFt * (d / 12)
}

export function volumeCy(areaSqFt, depthIn) {
  return volumeCuFt(areaSqFt, depthIn) / 27
}

export function formatCy(cy) {
  const n = Number(cy)
  if (!Number.isFinite(n) || n <= 0) return '0.00 cy'
  return `${n.toFixed(2)} cy`
}

export function isTurfArea(a) {
  return !!(a && (a.type === 'turf' || a.kind === 'turf'))
}

export function areaDepthOf(area, groups = []) {
  if (area && area.depth != null && String(area.depth) !== '') return String(area.depth)
  const g = area?.groupId ? groups.find(x => x.id === area.groupId) : null
  return g?.depth != null && String(g.depth) !== '' ? String(g.depth) : ''
}

/** CY only when this area (or its group) has depth set. Never page-level. */
export function areaOwnVolumeCy(areaSqFt, area, groups = []) {
  const d = areaDepthOf(area, groups)
  if (d == null || String(d).trim() === '') return 0
  return volumeCy(areaSqFt, d)
}

export function areaTopsoilOf(area, groups = []) {
  if (area && area.topsoil) return area.topsoil
  const g = area?.groupId ? groups.find(x => x.id === area.groupId) : null
  return g?.topsoil || 'none'
}

export function areaTopsoilCustomOf(area, groups = []) {
  if (area && area.topsoilCustom != null && area.topsoilCustom !== '') return area.topsoilCustom
  const g = area?.groupId ? groups.find(x => x.id === area.groupId) : null
  return g?.topsoilCustom || ''
}

export function mixedValue(values) {
  if (!values.length) return { mixed: false, value: '' }
  const first = values[0]
  return values.every(v => v === first) ? { mixed: false, value: first } : { mixed: true, value: first }
}

function topsoilExportLabel(value, custom) {
  if (!value || value === 'none') return ''
  if (value === 'custom') return custom || 'Custom'
  const o = TOPSOIL_OPTIONS.find(x => x.value === value)
  return o?.label || value
}

/** Notes string for existing MTO/export rows — per-area inspector fields. */
export function areaExportNotes(areas, groups = [], sqftFn) {
  const list = (areas || []).filter(a => !isTurfArea(a))
  if (!list.length) return ''
  const depths = list.map(a => areaDepthOf(a, groups))
  const soils = list.map(a => areaTopsoilOf(a, groups))
  const customs = list.map(a => areaTopsoilCustomOf(a, groups))
  const depthMix = mixedValue(depths)
  const soilMix = mixedValue(soils)
  const customMix = mixedValue(customs)
  const totalCy = list.reduce((sum, a) => {
    const sf = typeof sqftFn === 'function' ? sqftFn(polyAreaPx(a.poly || [])) : 0
    return sum + volumeCy(sf, areaDepthOf(a, groups))
  }, 0)
  const parts = []
  if (depthMix.mixed) parts.push('Depth: Multiple')
  else if (depthMix.value) parts.push(`Depth: ${depthMix.value}"`)
  if (totalCy > 0) parts.push(formatCy(totalCy))
  if (soilMix.mixed) parts.push('Topsoil: Multiple')
  else {
    const label = topsoilExportLabel(soilMix.value, customMix.value)
    if (label) parts.push(`Topsoil: ${label}`)
  }
  return parts.join('; ')
}

/**
 * Page-level quote header fields: explicit page depth/topsoil win; otherwise
 * fall back to inspector values on the given areas (selected, else all soil).
 */
export function quoteHeaderFields(areas, groups = [], page = {}) {
  const list = (areas || []).filter(a => !isTurfArea(a))
  const depthMix = mixedValue(list.map(a => areaDepthOf(a, groups)))
  const soilMix = mixedValue(list.map(a => areaTopsoilOf(a, groups)))
  const customMix = mixedValue(list.map(a => areaTopsoilCustomOf(a, groups)))
  const pageDepth = page.depth != null && String(page.depth).trim() !== '' ? String(page.depth) : ''
  const depth = pageDepth || (depthMix.mixed ? 'Multiple' : (depthMix.value || ''))
  let topsoilLabel = ''
  if (page.topsoil && page.topsoil !== 'none') {
    topsoilLabel = page.topsoil === 'custom'
      ? (page.topsoilCustom || 'Custom')
      : (TOPSOIL_OPTIONS.find(x => x.value === page.topsoil)?.label || page.topsoil)
  } else if (list.length) {
    topsoilLabel = soilMix.mixed ? 'Multiple' : topsoilExportLabel(soilMix.value, customMix.value)
  }
  return { depth, topsoilLabel }
}
