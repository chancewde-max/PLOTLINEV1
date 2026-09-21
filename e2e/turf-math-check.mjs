// Fast node smoke for turf / volume math (no browser).
import { volumeCy, formatCy, mixedValue, DEPTH_PRESETS } from '../src/workspace/areaProps.js'
import { rollCorners, rollFitsInArea, turfCoverage, snapAngle } from '../src/workspace/turf.js'

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
check('snap 22 → 15', snapAngle(22) === 15)
check('snap 8 → 15', snapAngle(8) === 15)

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

if (failed) { console.log(`\nFAILURES: ${failed}`); process.exit(1) }
console.log('\n=== ALL PASS ===')
