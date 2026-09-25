// Fast node smoke for turf / volume math (no browser).
import { volumeCy, formatCy, mixedValue, DEPTH_PRESETS, areaExportNotes, quoteHeaderFields, areaOwnVolumeCy, isUngroupedSoilArea } from '../src/workspace/areaProps.js'
import { takeoffMaterialItems, mtoSqFtCell } from '../src/data/takeoff.js'
import {
  polyAreaPx, shapeAreaPx, areaShapePx, buildAreaPath, buildChainPath, cubicPreviewCmd,
  shiftCubicSegsForInsert, translateCubicSegs, clipPx2, clipAreaPx2, inside, pointInArea,
  nearestAreaEdge, nearestOnCubic, splitCubicEdge,
  measuredAreaPx2, areasPreferLatest, areaOutlineCentroid, areaTouchesRect, firstAreaHit,
  outlineSelfIntersects, flattenAreaPoly, bbox,
  cubicP1DuplicatesP0, syncGeometryCache, geometryCacheStats, resetGeometryWorkCounters,
} from '../src/workspace/geometry.js'
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

// --- Area cubic bezier (§5.1). Straight edges must match the chord shoelace. ---
const unitSquare = [
  { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
]
check('shapeAreaPx matches polyAreaPx with no cubics',
  shapeAreaPx(unitSquare, {}) === polyAreaPx(unitSquare))
const onChord = {
  1: {
    c1: { x: 100, y: 100 / 3 },
    c2: { x: 100, y: 200 / 3 },
  },
}
check('cubic on the chord does not change area',
  Math.abs(shapeAreaPx(unitSquare, onChord) - polyAreaPx(unitSquare)) < 1e-6,
  String(shapeAreaPx(unitSquare, onChord)))

function cubicAt(p0, c1, c2, p1, t) {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
  }
}
function sampledShape(poly, cubics, steps = 240) {
  const pts = []
  for (let i = 0; i < poly.length; i++) {
    const p0 = poly[i]
    const p1 = poly[(i + 1) % poly.length]
    const seg = cubics[i]
    const n = seg ? steps : 1
    for (let s = 0; s < n; s++) {
      pts.push(seg ? cubicAt(p0, seg.c1, seg.c2, p1, s / n) : p0)
    }
  }
  return polyAreaPx(pts)
}
const bulge = {
  1: { c1: { x: 180, y: 0 }, c2: { x: 180, y: 100 } },
}
const exactBulge = shapeAreaPx(unitSquare, bulge)
const sampledBulge = sampledShape(unitSquare, bulge)
check('bulged cubic area matches sampled curve (not the chord)',
  Math.abs(exactBulge - sampledBulge) < 1
  && exactBulge > polyAreaPx(unitSquare) + 100,
  `exact=${exactBulge.toFixed(2)} sampled=${sampledBulge.toFixed(2)} chord=${polyAreaPx(unitSquare)}`)

const mixed = [
  { x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 50 }, { x: 0, y: 50 },
]
const mixedCubics = { 0: { c1: { x: 20, y: -40 }, c2: { x: 60, y: -40 } } }
check('mixed straight+cubic area matches the sampled polygon',
  Math.abs(shapeAreaPx(mixed, mixedCubics) - sampledShape(mixed, mixedCubics)) < 1,
  `${shapeAreaPx(mixed, mixedCubics).toFixed(2)} vs ${sampledShape(mixed, mixedCubics).toFixed(2)}`)
check('areaShapePx reads cubicSegs off the area object',
  areaShapePx({ poly: mixed, cubicSegs: mixedCubics }) === shapeAreaPx(mixed, mixedCubics))

const cubicD = buildAreaPath(mixed, {}, mixedCubics)
check('new Area path uses cubic C and not a circular A',
  /\sC\s/.test(cubicD) && !/\sA\s/.test(cubicD), cubicD)
const arcD = buildAreaPath(mixed, { 0: { x: 40, y: -20 } }, {})
check('circular arc path still available for linear/turf',
  /\sA\s/.test(arcD) && !/\sC\s/.test(arcD), arcD)

const c1 = { x: 10, y: 30 }
const c2 = { x: 40, y: 30 }
const cursor = { x: 80, y: 0 }
check('rubber-band C1 is a line', cubicPreviewCmd('c1', null, null, cursor).startsWith(' L '))
check('rubber-band C2 is a cubic ending at the cursor',
  cubicPreviewCmd('c2', c1, null, cursor).includes(` C ${c1.x} ${c1.y} ${cursor.x} ${cursor.y} ${cursor.x} ${cursor.y}`))
check('rubber-band P1 is the full cubic',
  cubicPreviewCmd('p1', c1, c2, cursor).includes(` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${cursor.x} ${cursor.y}`))
check('open chain does not close with Z', !buildChainPath(mixed, {}, mixedCubics).includes('Z'))

const shifted = shiftCubicSegsForInsert({ 0: mixedCubics[0], 2: { c1: { x: 1, y: 1 }, c2: { x: 2, y: 2 } } }, 0)
check('inserting a vertex drops that edge cubic and shifts later edges',
  !shifted[0] && !shifted[1] && shifted[3] && shifted[3].c1.x === 1,
  JSON.stringify(shifted))
const moved = translateCubicSegs(mixedCubics, 5, -2)
check('translating an area moves C1 and C2 with it',
  moved[0].c1.x === 25 && moved[0].c1.y === -42 && moved[0].c2.x === 65)

const cubicTakeoff = takeoffMaterialItems(
  { sheetIds: ['s1'] },
  {
    s1: {
      pxPerFt: 4,
      savedAreaGroups: [],
      savedAreas: [{ name: 'Bed', poly: unitSquare, cubicSegs: bulge, depth: '12', topsoil: 'none' }],
    },
  },
)
const chordSf = polyAreaPx(unitSquare) / 16
const curveSf = shapeAreaPx(unitSquare, bulge) / 16
check('takeoff sq ft uses the cubic area, not the chord',
  cubicTakeoff.some(it => it.kind === 'area' && it.qty === Math.round(curveSf) && it.qty !== Math.round(chordSf)),
  JSON.stringify(cubicTakeoff.map(it => it.qty)))
check('DEPTH_PRESETS stay empty', DEPTH_PRESETS.length === 0)

const enclose = [
  { x: -50, y: -50 }, { x: 250, y: -50 }, { x: 250, y: 250 }, { x: -50, y: 250 },
]
const curvedArea = { poly: unitSquare, cubicSegs: bulge }
const regionClip = clipAreaPx2(curvedArea, enclose, 4)
const chordClip = clipPx2(unitSquare, enclose, 4)
check('enclosing region clip uses the cubic area, 925 sf at 4 px/ft',
  regionClip.px2 === exactBulge && exactBulge / 16 === 925 && chordClip.px2 === 10000,
  `clip=${regionClip.px2} chordClip=${chordClip.px2} sf=${exactBulge / 16}`)
check('region clip without cubics stays on the chord',
  clipAreaPx2({ poly: unitSquare }, enclose, 4).px2 === chordClip.px2)
check('circular arcSegs are still clipped as the chord',
  clipAreaPx2({ poly: unitSquare, arcSegs: { 1: { x: 180, y: 50 } } }, enclose, 4).px2 === chordClip.px2)

check('bulge interior is inside the curved outline and outside the chord polygon',
  pointInArea({ x: 140, y: 50 }, curvedArea) && !inside({ x: 140, y: 50 }, unitSquare))
check('square interior is still inside',
  pointInArea({ x: 50, y: 50 }, curvedArea) && inside({ x: 50, y: 50 }, unitSquare))

const chordOnCurve = nearestOnCubic(
  { x: 100, y: 0 }, { x: 180, y: 0 }, { x: 180, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 50 },
)
const chordHit = nearestAreaEdge(unitSquare, bulge, { x: 100, y: 50 })
const curveHit = nearestAreaEdge(unitSquare, bulge, { x: 160, y: 50 })
check('dbl-click on the chord inside the bulge misses the curve',
  chordOnCurve.dist > 30 && !!chordHit && chordHit.dist > 30,
  `curve=${chordOnCurve.dist.toFixed(2)} edge=${chordHit ? chordHit.dist.toFixed(2) : 'none'}`)
check('dbl-click on the curve hits that cubic near t=0.5',
  !!curveHit && curveHit.cubic && curveHit.edge === 1 && curveHit.dist < 0.5 && Math.abs(curveHit.t - 0.5) < 0.02,
  curveHit ? `dist=${curveHit.dist.toFixed(3)} t=${curveHit.t.toFixed(3)} edge=${curveHit.edge}` : 'none')

const split = splitCubicEdge(unitSquare, bulge, 1, curveHit.t)
const splitClip = clipAreaPx2({ poly: split.poly, cubicSegs: split.cubicSegs }, enclose, 4)
check('splitting the cubic keeps 925 sf and two cubic segments',
  split.poly.length === 5
  && Object.keys(split.cubicSegs).length === 2
  && split.cubicSegs[1] && split.cubicSegs[2]
  && Math.abs(shapeAreaPx(split.poly, split.cubicSegs) - exactBulge) < 1e-4
  && splitClip.px2 === exactBulge
  && Math.hypot(split.poly[2].x - 160, split.poly[2].y - 50) < 0.05,
  `px2=${shapeAreaPx(split.poly, split.cubicSegs)} keys=${Object.keys(split.cubicSegs).join(',')} pt=${split.poly[2].x.toFixed(2)},${split.poly[2].y.toFixed(2)}`)

const chordTwin = { id: 'bed', type: 'sod', name: 'Bed', poly: unitSquare }
const cubicTwin = { id: 'bed', type: 'sod', name: 'Bed', poly: unitSquare, cubicSegs: bulge }
const deduped = areasPreferLatest([chordTwin, cubicTwin])
const regionSf = Math.round(deduped.reduce((s, a) => s + measuredAreaPx2(a, enclose), 0) / 16)
const exportSf = Math.round(measuredAreaPx2(cubicTwin) / 16)
const takeoffSf = takeoffMaterialItems(
  { sheetIds: ['s1'] },
  { s1: { pxPerFt: 4, savedAreaGroups: [], savedAreas: [cubicTwin] } },
).find(it => it.kind === 'area')?.qty
const doubled = Math.round((clipPx2(unitSquare, enclose, 4).px2 + exactBulge) / 16)
check('region MTO, export MTO, and takeoff agree on the flattened curve',
  deduped.length === 1
  && regionSf === 925 && exportSf === 925 && takeoffSf === 925
  && regionSf === exportSf && exportSf === takeoffSf
  && doubled !== 925,
  `region=${regionSf} export=${exportSf} takeoff=${takeoffSf} doubled=${doubled}`)

const bulgeBox = { minX: 120, minY: 30, maxX: 170, maxY: 70 }
check('marquee over the bulge hits the curve and misses the chord',
  areaTouchesRect(curvedArea, bulgeBox) && !areaTouchesRect({ poly: unitSquare }, bulgeBox))
const outlineC = areaOutlineCentroid(curvedArea)
check('area label uses the area-weighted outline centroid',
  pointInArea(outlineC, curvedArea)
  && Math.abs(outlineC.x - 74.56) < 0.5
  && Math.abs(outlineC.y - 50) < 0.5,
  `outline=${outlineC.x.toFixed(2)},${outlineC.y.toFixed(2)}`)

const triPoly = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 100, y: 120 }]
const triCubics = { 0: { c1: { x: 0, y: 200 }, c2: { x: 200, y: 200 } } }
const triArea = { poly: triPoly, cubicSegs: triCubics }
const triLabel = areaOutlineCentroid(triArea)
check('bowed triangle label point stays inside the shape',
  pointInArea(triLabel, triArea),
  `label=${triLabel.x.toFixed(2)},${triLabel.y.toFixed(2)}`)

// Independent of clipAreaPx2: count cell centers that sit in both polygons.
function fineGridPx2(subject, region, step) {
  const a = bbox(subject)
  const b = bbox(region)
  const x0 = Math.max(a.minX, b.minX)
  const y0 = Math.max(a.minY, b.minY)
  const x1 = Math.min(a.maxX, b.maxX)
  const y1 = Math.min(a.maxY, b.maxY)
  let hits = 0
  for (let y = y0 + step / 2; y < y1; y += step) {
    for (let x = x0 + step / 2; x < x1; x += step) {
      const p = { x, y }
      if (inside(p, subject) && inside(p, region)) hits++
    }
  }
  return hits * step * step
}
const uRegion = [
  { x: -50, y: -50 }, { x: 20, y: -50 }, { x: 20, y: 50 }, { x: 80, y: 50 },
  { x: 80, y: -50 }, { x: 250, y: -50 }, { x: 250, y: 250 }, { x: -50, y: 250 },
]
const flatBulge = flattenAreaPoly(unitSquare, bulge, 32)
const uExpectedSf = fineGridPx2(flatBulge, uRegion, 0.5) / 16
const uClipSf = clipAreaPx2(curvedArea, uRegion, 4).px2 / 16
check('concave U region drops the fully-inside shortcut',
  Math.abs(uClipSf - 925) > 50
  && Math.abs(uClipSf - uExpectedSf) < 1.5
  && Math.abs(uClipSf - 737.5) < 1,
  `clip=${uClipSf.toFixed(2)} independent=${uExpectedSf.toFixed(2)}`)
const halfRegion = [
  { x: -10, y: -10 }, { x: 50, y: -10 }, { x: 50, y: 150 }, { x: -10, y: 150 },
]
const halfExpectedSf = fineGridPx2(flatBulge, halfRegion, 0.5) / 16
const halfClipSf = clipAreaPx2(curvedArea, halfRegion, 4).px2 / 16
check('partial region matches an independent fine grid',
  Math.abs(halfClipSf - halfExpectedSf) < 1.5 && halfClipSf < 400,
  `clip=${halfClipSf.toFixed(2)} independent=${halfExpectedSf.toFixed(2)}`)
check('self-intersecting outline is detected and a plain square is not',
  outlineSelfIntersects(unitSquare, { 1: { c1: { x: 300, y: 200 }, c2: { x: 300, y: -100 } } })
  && !outlineSelfIntersects(unitSquare, bulge))

const warmAreas = Array.from({ length: 20 }, (_, i) => ({
  poly: unitSquare.map(p => ({ x: p.x + i * 30, y: p.y })),
  cubicSegs: { 1: { c1: { x: 180 + i * 30, y: 0 }, c2: { x: 180 + i * 30, y: 100 } } },
}))
const warmRegions = warmAreas.map((_, i) => uRegion.map(p => ({ x: p.x + i * 30, y: p.y })))
for (let i = 0; i < warmAreas.length; i++) clipAreaPx2(warmAreas[i], warmRegions[i], 4)
const warmStart = performance.now()
for (let n = 0; n < 20; n++) {
  for (let i = 0; i < warmAreas.length; i++) clipAreaPx2(warmAreas[i], warmRegions[i], 4)
}
const warmMs = performance.now() - warmStart
check('repeat region clips hit the flatten/clip cache', warmMs < 30, `warm=${warmMs.toFixed(2)}ms`)

const cPoly = [
  { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 40 }, { x: 40, y: 40 },
  { x: 40, y: 160 }, { x: 200, y: 160 }, { x: 200, y: 200 }, { x: 0, y: 200 },
]
const cArea = { poly: cPoly, cubicSegs: { 7: { c1: { x: -60, y: 150 }, c2: { x: -60, y: 50 } } } }
const cRegion = [{ x: -100, y: -100 }, { x: 300, y: -100 }, { x: 300, y: 199 }, { x: -100, y: 199 }]
const cClip = clipAreaPx2(cArea, cRegion, 4)
const notch = { x: 57.4, y: 98.5 }
check('partial clip label sits inside the clipped C, not the notch',
  !!cClip.c
  && pointInArea(cClip.c, cArea)
  && inside(cClip.c, cRegion)
  && Math.hypot(cClip.c.x - notch.x, cClip.c.y - notch.y) > 8,
  `label=${cClip.c ? cClip.c.x.toFixed(2) + ',' + cClip.c.y.toFixed(2) : 'null'}`)

// A flip is a label jump while the piece centroid stays put. Ties may still
// switch pieces; the gate on these sweeps is inside at every step.
function sweepLabel(area, samples) {
  let prev = null
  let fails = 0
  let maxHeldJump = 0
  let maxJump = 0
  let pieceChanges = 0
  let flips = 0
  const bad = []
  const marks = []
  for (const sample of samples) {
    const clip = clipAreaPx2(area, sample.region, 4)
    if (!(clip.px2 > 0)) {
      prev = clip
      continue
    }
    const ok = !!(clip.c && pointInArea(clip.c, area) && inside(clip.c, sample.region))
    if (!ok) {
      fails++
      if (bad.length < 3) bad.push(`${sample.tag}:${clip.c ? clip.c.x.toFixed(2) + ',' + clip.c.y.toFixed(2) : 'null'}`)
    }
    if (sample.mark && clip.c) marks.push(`${sample.tag}=(${clip.c.x.toFixed(2)},${clip.c.y.toFixed(2)})`)
    if (prev?.c && clip.c && prev.pieceC && clip.pieceC) {
      const jump = Math.hypot(clip.c.x - prev.c.x, clip.c.y - prev.c.y)
      const pieceJump = Math.hypot(clip.pieceC.x - prev.pieceC.x, clip.pieceC.y - prev.pieceC.y)
      if (jump > maxJump) maxJump = jump
      if (pieceJump > 5) pieceChanges++
      else {
        if (jump > maxHeldJump) maxHeldJump = jump
        if (jump > 5) flips++
      }
    }
    prev = clip
  }
  return { fails, maxHeldJump, maxJump, pieceChanges, flips, bad, steps: samples.length, marks }
}
function rangeSamples(from, to, step, tagOf, regionOf, markAt) {
  const samples = []
  const n = Math.round((to - from) / step)
  for (let i = 0; i <= n; i++) {
    const v = from + i * step
    const tag = tagOf(v)
    samples.push({
      tag,
      region: regionOf(v),
      mark: !!(markAt && [...markAt].some((m) => Math.abs(m - v) < 1e-6)),
    })
  }
  return samples
}
const box = (x0, y0, x1, y1) => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
]
function logSweep(name, sweep) {
  const marks = sweep.marks.length ? ` marks=${sweep.marks.join(' ')}` : ''
  console.log(`${name} steps=${sweep.steps} fails=${sweep.fails} flips=${sweep.flips} maxJump=${sweep.maxJump.toFixed(3)} maxHeldJump=${sweep.maxHeldJump.toFixed(3)} pieceChanges=${sweep.pieceChanges}${marks}`)
}
// box(L,-500,600,600): vertical cut at x=L through the C. L in the notch
// used to leave the label on the zero-width bridge.
const leftSamples = rangeSamples(30, 120, 0.5, (L) => `L${L}`, (L) => box(L, -500, 600, 600))
const straightC = { poly: cPoly }
const curvedSweep = sweepLabel(cArea, leftSamples)
const straightSweep = sweepLabel(straightC, leftSamples)
logSweep('C label sweep left L=30..120 step 0.5 curved', curvedSweep)
logSweep('C label sweep left L=30..120 step 0.5 straight', straightSweep)
check('curved C label stays inside across the left region sweep',
  curvedSweep.fails === 0 && curvedSweep.maxHeldJump <= 5,
  `fails=${curvedSweep.fails} flips=${curvedSweep.flips} maxHeldJump=${curvedSweep.maxHeldJump.toFixed(3)} pieceChanges=${curvedSweep.pieceChanges} bad=${curvedSweep.bad.join(' ')}`)
check('straight C label stays inside across the left region sweep',
  straightSweep.fails === 0 && straightSweep.maxHeldJump <= 5,
  `fails=${straightSweep.fails} flips=${straightSweep.flips} maxHeldJump=${straightSweep.maxHeldJump.toFixed(3)} pieceChanges=${straightSweep.pieceChanges} bad=${straightSweep.bad.join(' ')}`)

const triMarks = new Set([3, 3.5, 4.5])
const triTop = rangeSamples(0, 110, 0.5, (v) => `v${v}`, (v) => box(-500, v, 600, 600), triMarks)
const triTopSweep = sweepLabel(triArea, triTop)
logSweep('bowed triangle top sweep v=0..110 step 0.5', triTopSweep)
check('bowed triangle label stays inside across the top sweep',
  triTopSweep.fails === 0,
  `fails=${triTopSweep.fails} flips=${triTopSweep.flips} maxJump=${triTopSweep.maxJump.toFixed(3)} bad=${triTopSweep.bad.join(' ')}`)

const cRight = rangeSamples(0, 200, 0.5, (R) => `R${R}`, (R) => box(-500, -500, R, 600))
const cTop = rangeSamples(0, 200, 0.5, (T) => `T${T}`, (T) => box(-500, T, 600, 600))
const cBottom = rangeSamples(0, 200, 0.5, (B) => `B${B}`, (B) => box(-500, -500, 600, B))
for (const [name, samples] of [['right', cRight], ['top', cTop], ['bottom', cBottom]]) {
  for (const [shape, area] of [['curved', cArea], ['straight', straightC]]) {
    const sweep = sweepLabel(area, samples)
    logSweep(`C label sweep ${name} step 0.5 ${shape}`, sweep)
    check(`C ${shape} label stays inside across the ${name} sweep`,
      sweep.fails === 0,
      `fails=${sweep.fails} flips=${sweep.flips} maxJump=${sweep.maxJump.toFixed(3)} maxHeldJump=${sweep.maxHeldJump.toFixed(3)} pieceChanges=${sweep.pieceChanges} bad=${sweep.bad.join(' ')}`)
  }
}

const side = 500.25
const straightSquare = [
  { x: 10, y: 10 }, { x: 10 + side, y: 10 }, { x: 10 + side, y: 10 + side }, { x: 10, y: 10 + side },
]
const straightRegion = [{ x: -40, y: -40 }, { x: 700, y: -40 }, { x: 700, y: 700 }, { x: -40, y: 700 }]
const straightClip = clipAreaPx2({ poly: straightSquare }, straightRegion, 4)
const straightShoe = polyAreaPx(straightSquare)
check('fully enclosed large straight square equals its shoelace area exactly',
  straightClip.px2 === straightShoe && Math.abs(straightShoe - side * side) < 1e-6,
  `clip=${straightClip.px2} shoelace=${straightShoe}`)

const partialStraight = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 800 }, { x: 0, y: 800 }]
const partialRegion = [{ x: 30.5, y: -20 }, { x: 640.2, y: -20 }, { x: 640.2, y: 900 }, { x: 30.5, y: 900 }]
const partialClip = clipAreaPx2({ poly: partialStraight }, partialRegion, 4).px2
const partialExact = (640.2 - 30.5) * 800
const partialPct = ((partialClip - partialExact) / partialExact) * 100
console.log(`partial straight overlap grid vs shoelace: ${partialPct.toFixed(3)}% (clip=${partialClip} exact=${partialExact})`)

const bowPoly = unitSquare.map(p => ({ x: p.x + 3, y: p.y + 7 }))
const bowSeg = { 1: { c1: { x: 303, y: 207 }, c2: { x: 303, y: -93 } } }
const calmSeg = { 1: { c1: { x: 183, y: 7 }, c2: { x: 183, y: 107 } } }
resetGeometryWorkCounters()
const bowFlag = outlineSelfIntersects(bowPoly, bowSeg)
const bowWork = geometryCacheStats().flattenWork
const bowAgain = outlineSelfIntersects(bowPoly, bowSeg)
check('self-intersect flag is derived once per geometry version',
  bowFlag === true && bowAgain === true && bowWork === 1 && geometryCacheStats().flattenWork === 1,
  `work=${geometryCacheStats().flattenWork}`)
check('an edit that removes a crossing clears the flag', outlineSelfIntersects(bowPoly, calmSeg) === false)
check('an edit that creates a crossing sets the flag', outlineSelfIntersects(bowPoly, bowSeg) === true)
const triCross = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }]
check('a curved triangle is flagged from the flattened outline',
  outlineSelfIntersects(triCross, { 1: { c1: { x: 300, y: 200 }, c2: { x: -200, y: -100 } } }) === true
  && outlineSelfIntersects(triCross, {}) === false)

const FIT = 0.72
const highZoom = 400
const shortSheetPx = 8
const shortScreenPx = shortSheetPx * (highZoom / 100) * FIT
check('high zoom short cubic P1 is not a duplicate of P0',
  shortScreenPx > 10
  && !cubicP1DuplicatesP0({ x: shortSheetPx, y: 0 }, { x: 0, y: 0 })
  && !cubicP1DuplicatesP0({ x: 16, y: 0 }, { x: 0, y: 0 })
  && cubicP1DuplicatesP0({ x: 0, y: 0 }, { x: 0, y: 0 })
  && cubicP1DuplicatesP0({ x: 0.2, y: 0 }, { x: 0, y: 0 })
  && !cubicP1DuplicatesP0({ x: 0.6, y: 0 }, { x: 0, y: 0 }),
  `screenPx@400%=${shortScreenPx.toFixed(2)}`)

const csvCells = [1023, 2, 806.25, 737.4].map(n => String(mtoSqFtCell(n)))
check('region CSV sq ft matches exportMTO Math.round with no separators',
  csvCells.join(',') === '1023,2,806,737'
  && !csvCells.some(c => c.includes(',') || c.includes('.'))
  && mtoSqFtCell(737.4) !== 735
  && mtoSqFtCell(737.4) !== 740
  && mtoSqFtCell(1023) !== 1025,
  csvCells.join(','))

const cacheN = 120
const cacheAreas = Array.from({ length: cacheN }, (_, i) => {
  const col = i % 12
  const row = Math.floor(i / 12)
  const ox = 1000 + col * 140
  const oy = 1000 + row * 140
  return {
    id: `cache-${i}`,
    poly: unitSquare.map(p => ({ x: p.x + ox, y: p.y + oy })),
    cubicSegs: { 1: { c1: { x: 180 + ox, y: oy }, c2: { x: 180 + ox, y: 100 + oy } } },
  }
})
const cacheLive = [{ x: 800, y: 800 }, { x: 4000, y: 800 }, { x: 4000, y: 4000 }, { x: 800, y: 4000 }]
const cacheFolder = [{ x: 820, y: 820 }, { x: 3900, y: 820 }, { x: 3900, y: 3900 }, { x: 820, y: 3900 }]
const cachePlans = [{ region: cacheLive, step: 4 }, { region: cacheFolder, step: 4 }]
syncGeometryCache(cacheAreas, cachePlans)
resetGeometryWorkCounters()
const coldStart = performance.now()
for (const a of cacheAreas) {
  clipAreaPx2(a, cacheLive, 4)
  clipAreaPx2(a, cacheFolder, 4)
}
const coldMs = performance.now() - coldStart
const coldStats = geometryCacheStats()
console.log(`first uncached render cost (120 curved areas, live region + different folder): ${coldMs.toFixed(2)}ms flatten=${coldStats.flattenWork} clip=${coldStats.clipWork}`)
resetGeometryWorkCounters()
syncGeometryCache(cacheAreas, cachePlans)
for (const a of cacheAreas) {
  clipAreaPx2(a, cacheLive, 4)
  clipAreaPx2(a, cacheFolder, 4)
}
const steady = geometryCacheStats()
check('120 curved areas do no clip or flatten work on a steady re-render',
  steady.flattenWork === 0 && steady.clipWork === 0 && steady.clipEntries === cacheN * 2,
  `flatten=${steady.flattenWork} clip=${steady.clipWork} entries=${steady.clipEntries}`)
let maxClipEntries = steady.clipEntries
resetGeometryWorkCounters()
for (let step = 0; step < 25; step++) {
  const drag = cacheLive.map(p => ({ x: p.x + step * 5, y: p.y + step * 2 }))
  syncGeometryCache(cacheAreas, [{ region: drag, step: 6 }, { region: cacheFolder, step: 4 }])
  for (const a of cacheAreas) clipAreaPx2(a, drag, 6)
  maxClipEntries = Math.max(maxClipEntries, geometryCacheStats().clipEntries)
}
const dragStats = geometryCacheStats()
check('region drag keeps the clip cache bounded to live areas',
  dragStats.flattenWork === 0 && maxClipEntries <= cacheN * 2 && dragStats.clipEntries <= cacheN * 2,
  `flatten=${dragStats.flattenWork} maxEntries=${maxClipEntries} entries=${dragStats.clipEntries}`)
syncGeometryCache(cacheAreas.slice(0, 10), [{ region: cacheFolder, step: 4 }])
const evicted = geometryCacheStats()
check('deleted areas are evicted from the geometry cache',
  evicted.flattenEntries <= 10 && evicted.clipEntries <= 10 && evicted.areaEntries <= 10,
  `flattenEntries=${evicted.flattenEntries} clipEntries=${evicted.clipEntries}`)

const onP0 = { id: 'bed', poly: unitSquare, cubicSegs: { 0: { c1: { x: 0, y: 0 }, c2: { x: 40, y: -20 } } } }
const vertexFirst = firstAreaHit([onP0], { x: 0, y: 0 }, 8, { handleAreaId: 'bed' })
const handleClear = firstAreaHit([onP0], { x: 40, y: -20 }, 8, { handleAreaId: 'bed' })
const hiddenHandle = firstAreaHit([onP0], { x: 40, y: -20 }, 8, { handleAreaId: null })
check('a C1 on P0 hits the vertex, not the control point',
  vertexFirst?.kind === 'vertex' && vertexFirst.index === 0
  && handleClear?.kind === 'handle' && handleClear.which === 'c2'
  && hiddenHandle == null,
  `onP0=${vertexFirst?.kind} clear=${handleClear?.kind} hidden=${hiddenHandle?.kind}`)

const roundTrip = JSON.parse(JSON.stringify(curvedArea))
check('cubicSegs JSON round-trip keeps the curve area',
  Math.abs(shapeAreaPx(roundTrip.poly, roundTrip.cubicSegs) - exactBulge) < 1e-6
  && roundTrip.cubicSegs[1].c1.x === 180)

if (failed) { console.log(`\nFAILURES: ${failed}`); process.exit(1) }
console.log('\n=== ALL PASS ===')
