// Fast node smoke for turf / volume math (no browser).
import { volumeCy, formatCy, mixedValue, DEPTH_PRESETS, areaExportNotes, quoteHeaderFields, areaOwnVolumeCy, isUngroupedSoilArea } from '../src/workspace/areaProps.js'
import { takeoffMaterialItems } from '../src/data/takeoff.js'
import {
  rollCorners, rollFitsInArea, turfCoverage, parseRollFt,
  snapRollToNeighbors, neighborSnapTargets, estimateRollsNeeded, DEFAULT_ROLL_W_FT, ROLL_NEIGHBOR_SNAP_FT,
} from '../src/workspace/turf.js'

const square = [
  { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
]
const pxPerFt = 4 // 100px = 25ft

let failed = 0
function check(name, cond, detail) {
  if (!cond) { failed++; console.log(`[FAIL] ${name}${detail ? ' — ' + detail : ''}`) }
  else console.log(`[PASS] ${name}${detail ? ' — ' + detail : ''}`)
}

check('No invented depth presets', DEPTH_PRESETS.length === 0, String(DEPTH_PRESETS))
check('12in over 27 sq ft = 1.00 cy', formatCy(volumeCy(27, 12)) === '1.00 cy', formatCy(volumeCy(27, 12)))
check('mixedValue detects Multiple', mixedValue(['4', '6']).mixed === true)
const exportNotes = areaExportNotes(
  [{ poly: square, depth: '12', topsoil: 'enriched' }],
  [],
  (px2) => px2 / (pxPerFt * pxPerFt),
)
check('MTO notes include inspector depth + cy + topsoil',
  /Depth: 12"/.test(exportNotes) && /cy/.test(exportNotes) && /Enriched/.test(exportNotes),
  exportNotes)
const ungroupedTakeoff = takeoffMaterialItems(
  { sheetIds: ['s1'] },
  {
    s1: {
      pxPerFt: 4,
      savedAreaGroups: [],
      savedAreas: [{
        name: 'Area 1', poly: square, depth: '12', topsoil: 'custom', topsoilCustom: 'Ungrouped mix',
      }],
    },
  },
)
check('ungrouped soil appears in canonical takeoff with inspector notes',
  ungroupedTakeoff.some(it => it.kind === 'area' && it.unit === 'SF'
    && /Area 1/.test(it.description) && /Depth: 12"/.test(it.description)
    && /Ungrouped mix/.test(it.description) && it.qty > 0),
  JSON.stringify(ungroupedTakeoff.map(it => it.description)))
const orphanedTakeoff = takeoffMaterialItems(
  { sheetIds: ['s1'] },
  {
    s1: {
      pxPerFt: 4,
      savedAreaGroups: [{ id: 'ag-alive', name: 'Still here' }],
      savedAreas: [{
        name: 'Loose bed', groupId: 'ag-deleted', poly: square,
        depth: '12', topsoil: 'custom', topsoilCustom: 'Ungrouped mix',
      }],
    },
  },
)
check('orphaned-group soil uses the same takeoff Notes suffix',
  orphanedTakeoff.some(it => /Loose bed/.test(it.description) && /Ungrouped mix/.test(it.description)),
  JSON.stringify(orphanedTakeoff.map(it => it.description)))
check('orphan groupId counts as ungrouped soil',
  isUngroupedSoilArea({ groupId: 'ag-deleted' }, [{ id: 'ag-alive' }]) === true
    && isUngroupedSoilArea({ groupId: 'ag-alive' }, [{ id: 'ag-alive' }]) === false
    && isUngroupedSoilArea({ groupId: null }, []) === true)
const turfOnlyTakeoff = takeoffMaterialItems(
  { sheetIds: ['s1'] },
  { s1: { pxPerFt: 4, savedAreaGroups: [], savedAreas: [{ name: 'Turf Area 1', type: 'turf', kind: 'turf', poly: square }] } },
)
check('ungrouped turf is not a soil takeoff row',
  !turfOnlyTakeoff.some(it => it.kind === 'area'),
  JSON.stringify(turfOnlyTakeoff.map(it => it.description)))
const hdr = quoteHeaderFields(
  [{ depth: '12', topsoil: 'custom', topsoilCustom: 'Test mix' }],
  [],
  { depth: '', topsoil: 'none', topsoilCustom: '' },
)
check('quote header falls back to inspector depth + topsoil',
  hdr.depth === '12' && /Test mix/.test(hdr.topsoilLabel),
  JSON.stringify(hdr))
check('page-level header depth does not invent area CY',
  quoteHeaderFields([{ poly: square }], [], { depth: '8', topsoil: 'none' }).depth === '8'
    && areaOwnVolumeCy(27, { poly: square }, []) === 0)
check('no own depth → 0 cy', areaOwnVolumeCy(27, {}, []) === 0)
check('own depth → cy', formatCy(areaOwnVolumeCy(27, { depth: '12' }, [])) === '1.00 cy')
const noDepthNotes = areaExportNotes([{ poly: square, topsoil: 'enriched' }], [], (px2) => px2 / (pxPerFt * pxPerFt))
check('no-depth takeoff notes omit cy', !/cy/i.test(noDepthNotes) && /Enriched/.test(noDepthNotes), noDepthNotes)

const insideRoll = { cx: 50, cy: 50, wFt: 10, lFt: 10, rotation: 0 }
const outsideRoll = { cx: 95, cy: 50, wFt: 10, lFt: 20, rotation: 0 }
check('roll fully inside is valid', rollFitsInArea(insideRoll, square, pxPerFt) === true)
check('roll hanging out is invalid', rollFitsInArea(outsideRoll, square, pxPerFt) === false)

const cov = turfCoverage(square, [insideRoll], pxPerFt, 4)
check('coverage percent between 0 and 100', cov.coveragePct > 0 && cov.coveragePct <= 100, String(cov.coveragePct))
check('gaps + covered ~= area', Math.abs((cov.coveredSqFt + cov.gapsSqFt) - cov.areaSqFt) < 0.5,
  `area=${cov.areaSqFt} covered=${cov.coveredSqFt} gaps=${cov.gapsSqFt}`)

const corners = rollCorners(insideRoll, pxPerFt)
check('roll has 4 corners', corners.length === 4)

check('15 ft is a default only, not a cap', parseRollFt('22.5', DEFAULT_ROLL_W_FT) === 22.5)
check('parseRollFt rejects non-positive', parseRollFt('0', 15) === 15 && parseRollFt('abc', 15) === 15)

check('neighbor snap window is 0.5 ft world', ROLL_NEIGHBOR_SNAP_FT === 0.5)

const placed = { id: 'a', cx: 40, cy: 50, wFt: 10, lFt: 10, rotation: 0 }
const flush = placed.cx + 10 * pxPerFt
const near = { id: 'b', cx: flush + 0.4 * pxPerFt, cy: 50, wFt: 10, lFt: 10, rotation: 0 }
const locked = snapRollToNeighbors(near, [placed], pxPerFt)
check('edge within 0.5 ft snaps flush', !!(locked && locked.snapped), JSON.stringify(locked && { cx: locked.cx, cy: locked.cy }))
check('snapped center is exactly neighbor + (w1+w2)/2', locked && Math.abs(locked.cx - flush) < 0.01 && Math.abs(locked.cy - placed.cy) < 0.01,
  locked ? `${locked.cx},${locked.cy}` : 'null')

const offsetNear = { id: 'off', cx: flush + 0.3 * pxPerFt, cy: 50 + 8, wFt: 10, lFt: 10, rotation: 0 }
const lockOff = snapRollToNeighbors(offsetNear, [placed], pxPerFt)
check('offset approach uses real edge (keeps along-edge, flushes face)',
  !!(lockOff && Math.abs(lockOff.cx - flush) < 0.01 && Math.abs(lockOff.cy - (50 + 8)) < 0.01),
  lockOff ? `${lockOff.cx},${lockOff.cy}` : 'null')

const longFlush = placed.cy + 10 * pxPerFt
const longOff = { id: 'long', cx: 40 + 7, cy: longFlush + 0.25 * pxPerFt, wFt: 10, lFt: 10, rotation: 0 }
const lockLong = snapRollToNeighbors(longOff, [placed], pxPerFt)
check('length-edge offset snap flushes that face (not a width-center seat)',
  !!(lockLong && Math.abs(lockLong.cy - longFlush) < 0.01 && Math.abs(lockLong.cx - (40 + 7)) < 0.01),
  lockLong ? `${lockLong.cx},${lockLong.cy}` : 'null')

const justOut = { id: 'd', cx: flush + 0.75 * pxPerFt, cy: 50, wFt: 10, lFt: 10, rotation: 0 }
check('edge beyond 0.5 ft does not snap', snapRollToNeighbors(justOut, [placed], pxPerFt) === null)

const far = { id: 'c', cx: 40 + 40 * pxPerFt, cy: 50, wFt: 10, lFt: 10, rotation: 0 }
check('far roll does not snap', snapRollToNeighbors(far, [placed], pxPerFt) === null)
check('Alt/Option disable skips snap', snapRollToNeighbors(near, [placed], pxPerFt, { disable: true }) === null)

const a37 = { id: 'a37', cx: 80, cy: 80, wFt: 10, lFt: 10, rotation: 37 }
const seat37 = neighborSnapTargets({ wFt: 10, lFt: 10, rotation: 37 }, a37, pxPerFt)[0]
const incoming0 = { id: 'b', cx: seat37.cx, cy: seat37.cy, wFt: 10, lFt: 10, rotation: 0 }
const lock37 = snapRollToNeighbors(incoming0, [a37], pxPerFt)
check('adjacent snap adopts neighbor rotation', !!(lock37 && lock37.rotation === 37),
  lock37 ? String(lock37.rotation) : 'null')
check('adjacent snap is flush after co-rotate', !!(lock37 && Math.abs(lock37.cx - seat37.cx) < 0.01 && Math.abs(lock37.cy - seat37.cy) < 0.01))
check('winning neighbor id is snapTo for hover highlight', !!(lock37 && lock37.snapTo === 'a37'),
  lock37 ? String(lock37.snapTo) : 'null')

const rad37 = 37 * Math.PI / 180
const ux37 = { x: Math.cos(rad37), y: Math.sin(rad37) }
const uy37 = { x: -Math.sin(rad37), y: Math.cos(rad37) }
const gx37 = 10 * pxPerFt
const along37 = 9
const gap37 = 0.28 * pxPerFt
const incoming37off = {
  id: 'b37off',
  cx: a37.cx + ux37.x * (gx37 + gap37) + uy37.x * along37,
  cy: a37.cy + ux37.y * (gx37 + gap37) + uy37.y * along37,
  wFt: 10, lFt: 10, rotation: 12,
}
const expect37 = {
  cx: a37.cx + ux37.x * gx37 + uy37.x * along37,
  cy: a37.cy + ux37.y * gx37 + uy37.y * along37,
}
const lock37off = snapRollToNeighbors(incoming37off, [a37], pxPerFt)
check('37° offset inherit+flush uses real edge (not centered seat)',
  !!(lock37off && lock37off.rotation === 37
    && Math.abs(lock37off.cx - expect37.cx) < 0.02
    && Math.abs(lock37off.cy - expect37.cy) < 0.02),
  lock37off ? `${lock37off.rotation}@${lock37off.cx.toFixed(2)},${lock37off.cy.toFixed(2)}` : 'null')

const n0 = { id: 'n0', cx: 0, cy: 50, wFt: 10, lFt: 10, rotation: 0 }
const n45 = { id: 'n45', cx: 400, cy: 400, wFt: 10, lFt: 10, rotation: 45 }
const seatN0 = neighborSnapTargets({ wFt: 10, lFt: 10, rotation: 0 }, n0, pxPerFt)[0]
const conflict = snapRollToNeighbors(
  { id: 'x', cx: seatN0.cx, cy: seatN0.cy, wFt: 10, lFt: 10, rotation: 12 },
  [n0, n45],
  pxPerFt,
)
check('FINAL: two-angle conflict uses nearest neighbor', !!(conflict && conflict.snapTo === 'n0' && conflict.rotation === 0),
  conflict ? `${conflict.snapTo}/${conflict.rotation}` : 'null')

const a45 = { id: 'a45', cx: 240, cy: 240, wFt: 10, lFt: 10, rotation: 45 }
const seatB = neighborSnapTargets({ wFt: 10, lFt: 10, rotation: 45 }, a45, pxPerFt)[0]
const lockB = snapRollToNeighbors(
  { id: 'b45', cx: seatB.cx, cy: seatB.cy, wFt: 10, lFt: 10, rotation: 0 },
  [a45],
  pxPerFt,
)
check('chain A→B inherits 45°', !!(lockB && lockB.rotation === 45), lockB ? String(lockB.rotation) : 'null')
const seatC = neighborSnapTargets({ wFt: 10, lFt: 10, rotation: 45 }, lockB, pxPerFt)[0]
const lockC = snapRollToNeighbors(
  { id: 'c45', cx: seatC.cx, cy: seatC.cy, wFt: 10, lFt: 10, rotation: 8 },
  [a45, lockB],
  pxPerFt,
)
check('chain B→C inherits 45°', !!(lockC && lockC.rotation === 45), lockC ? String(lockC.rotation) : 'null')

const moving0 = { id: 'move', cx: seat37.cx, cy: seat37.cy, wFt: 10, lFt: 10, rotation: 0 }
const moveLock = snapRollToNeighbors(moving0, [a37], pxPerFt)
check('FINAL: move into snap range inherits neighbor angle', !!(moveLock && moveLock.rotation === 37 && Math.abs(moveLock.cx - seat37.cx) < 0.01),
  moveLock ? `${moveLock.rotation}@${moveLock.cx.toFixed(2)}` : 'null')

check('gaps 2500 / 1500 sq ft roll = 2 needed', estimateRollsNeeded(2500, 15, 100) === 2)
check('no gaps = 0 needed', estimateRollsNeeded(0, 15, 100) === 0)

if (failed) { console.log(`\nFAILURES: ${failed}`); process.exit(1) }
console.log('\n=== ALL PASS ===')
