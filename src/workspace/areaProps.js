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
