// Fast node smoke for turf / volume math (no browser).
import { volumeCy, formatCy, mixedValue, DEPTH_PRESETS } from '../src/workspace/areaProps.js'
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

const justOut = { id: 'd', cx: flush + 0.75 * pxPerFt, cy: 50, wFt: 10, lFt: 10, rotation: 0 }
check('edge beyond 0.5 ft does not snap', snapRollToNeighbors(justOut, [placed], pxPerFt) === null)

const far = { id: 'c', cx: 40 + 40 * pxPerFt, cy: 50, wFt: 10, lFt: 10, rotation: 0 }
check('far roll does not snap', snapRollToNeighbors(far, [placed], pxPerFt) === null)
check('Alt/Option disable skips snap', snapRollToNeighbors(near, [placed], pxPerFt, { disable: true }) === null)

const angledBase = { id: 'e', cx: 0, cy: 0, wFt: 10, lFt: 10, rotation: 33.3 }
const seat = neighborSnapTargets(angledBase, placed, pxPerFt)[0]
const angled = { ...angledBase, cx: seat.cx, cy: seat.cy }
const angledLock = snapRollToNeighbors(angled, [placed], pxPerFt)
check('neighbor snap does not change rotation', !!(angledLock && angledLock.rotation === 33.3),
  angledLock ? String(angledLock.rotation) : 'null')

check('gaps 2500 / 1500 sq ft roll = 2 needed', estimateRollsNeeded(2500, 15, 100) === 2)
check('no gaps = 0 needed', estimateRollsNeeded(0, 15, 100) === 0)

if (failed) { console.log(`\nFAILURES: ${failed}`); process.exit(1) }
console.log('\n=== ALL PASS ===')
