// Aggregate a project's on-sheet takeoff (counts, areas, linear runs) into a
// flat material list. Quantities roll up across every sheet passed in (all
// sheets in the project by default, or a narrower set — see `sheetIds`
// below) and are grouped by condition name so the same condition drawn on
// multiple sheets combines into one line item.
//
// Units: counts -> EA, areas -> SF, linear -> LF. Deduction items subtract.
import { linePathLenPx, measuredAreaPx2 } from '../workspace/geometry.js'
import { areaExportNotes, isUngroupedSoilArea } from '../workspace/areaProps.js'
import { ownRecord } from './ownRecord.js'

const DEFAULT_PXFT = 4
const sign = (it) => (it && it.deduct ? -1 : 1)

// Sq ft written to export MTO, Region MTO, and takeoff. Plain rounded
// integer: 1023 → 1023, 2 → 2, 806.25 → 806. No thousands separators.
export function mtoSqFtCell(sqft) {
  const n = Number(sqft)
  if (!Number.isFinite(n)) return 0
  return Math.round(n)
}

// `sheetIds`, if given, restricts the aggregation to just those sheets
// (e.g. one plan/version set) instead of every sheet in the project — so
// quantities from different revision sets don't get summed together.
export function takeoffMaterialItems(project, sheets, sheetIds) {
  if (!project) return []
  const byKey = {} // `${name}::${unit}` -> item

  const add = (name, unit, qty, code, kind) => {
    const key = `${(name || '').trim().toLowerCase()}::${unit}`
    if (!byKey[key]) byKey[key] = { key, code: code || '', description: name || '', unit, qty: 0, kind }
    byKey[key].qty += qty
    if (!byKey[key].code && code) byKey[key].code = code
  }

  for (const sid of sheetIds || project.sheetIds || []) {
    const sh = ownRecord(sheets, sid)
    if (!sh) continue
    const pxft = sh.pxPerFt || DEFAULT_PXFT
    const sqft = (px2) => px2 / (pxft * pxft)
    const lnft = (px) => px / pxft

    for (const g of sh.savedCountGroups || []) {
      const qty = (g.points || []).reduce((s, p) => s + sign(p), 0)
      add(g.name, 'EA', qty, g.key, 'count')
    }
    const groups = sh.savedAreaGroups || []
    for (const g of groups) {
      const areas = (sh.savedAreas || []).filter(a => a.groupId === g.id)
      const qty = areas.reduce((s, a) => s + sqft(measuredAreaPx2(a)) * sign(a), 0)
      const notes = areaExportNotes(areas, groups, sqft)
      add(notes ? `${g.name} — ${notes}` : g.name, 'SF', qty, g.key, 'area')
    }
    // Ungrouped soil (no group, or group deleted) uses the same description + Notes suffix.
    const ungroupedSoil = (sh.savedAreas || []).filter(a => isUngroupedSoilArea(a, groups))
    const ungroupedByName = {}
    for (const a of ungroupedSoil) {
      const name = (a.name || 'Area').trim() || 'Area'
      if (!ungroupedByName[name]) ungroupedByName[name] = []
      ungroupedByName[name].push(a)
    }
    for (const [name, areas] of Object.entries(ungroupedByName)) {
      const qty = areas.reduce((s, a) => s + sqft(measuredAreaPx2(a)) * sign(a), 0)
      const notes = areaExportNotes(areas, groups, sqft)
      add(notes ? `${name} — ${notes}` : name, 'SF', qty, '', 'area')
    }
    for (const g of sh.savedLinearGroups || []) {
      const lines = (sh.savedLines || []).filter(l => l.groupId === g.id)
      const qty = lines.reduce((s, l) => s + lnft(linePathLenPx(l.pts, l.arcSegs)) * sign(l), 0)
      add(g.name, 'LF', qty, g.key, 'linear')
    }
  }

  return Object.values(byKey)
    // Round display quantities; keep tiny non-zero areas from showing as 0 loss.
    .map(it => ({ ...it, qty: it.unit === 'EA' ? it.qty : mtoSqFtCell(it.qty) }))
    .filter(it => it.description)
}
