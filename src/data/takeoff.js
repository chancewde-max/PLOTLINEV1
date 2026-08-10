// Aggregate a project's on-sheet takeoff (counts, areas, linear runs) into a
// flat material list. Quantities roll up across every sheet in the project and
// are grouped by condition name so the same condition drawn on multiple sheets
// combines into one line item.
//
// Units: counts -> EA, areas -> SF, linear -> LF. Deduction items subtract.
import { polyAreaPx, linePathLenPx } from '../workspace/geometry.js'

const DEFAULT_PXFT = 4
const sign = (it) => (it && it.deduct ? -1 : 1)

export function takeoffMaterialItems(project, sheets) {
  if (!project) return []
  const byKey = {} // `${name}::${unit}` -> item

  const add = (name, unit, qty, code, kind) => {
    const key = `${(name || '').trim().toLowerCase()}::${unit}`
    if (!byKey[key]) byKey[key] = { key, code: code || '', description: name || '', unit, qty: 0, kind }
    byKey[key].qty += qty
    if (!byKey[key].code && code) byKey[key].code = code
  }

  for (const sid of project.sheetIds || []) {
    const sh = sheets?.[sid]
    if (!sh) continue
    const pxft = sh.pxPerFt || DEFAULT_PXFT
    const sqft = (px2) => px2 / (pxft * pxft)
    const lnft = (px) => px / pxft

    for (const g of sh.savedCountGroups || []) {
      const qty = (g.points || []).reduce((s, p) => s + sign(p), 0)
      add(g.name, 'EA', qty, g.key, 'count')
    }
    for (const g of sh.savedAreaGroups || []) {
      const areas = (sh.savedAreas || []).filter(a => a.groupId === g.id)
      const qty = areas.reduce((s, a) => s + sqft(polyAreaPx(a.poly)) * sign(a), 0)
      add(g.name, 'SF', qty, g.key, 'area')
    }
    for (const g of sh.savedLinearGroups || []) {
      const lines = (sh.savedLines || []).filter(l => l.groupId === g.id)
      const qty = lines.reduce((s, l) => s + lnft(linePathLenPx(l.pts, l.arcSegs)) * sign(l), 0)
      add(g.name, 'LF', qty, g.key, 'linear')
    }
  }

  return Object.values(byKey)
    // Round display quantities; keep tiny non-zero areas from showing as 0 loss.
    .map(it => ({ ...it, qty: it.unit === 'EA' ? it.qty : Math.round(it.qty) }))
    .filter(it => it.description)
}
