import { inside, polyAreaPx, bbox } from './geometry.js'

function segsCross(p1, p2, p3, p4) {
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const d1 = cross(p3, p4, p1), d2 = cross(p3, p4, p2)
  const d3 = cross(p1, p2, p3), d4 = cross(p1, p2, p4)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

export const DEFAULT_ROLL_W_FT = 15
export const DEFAULT_ROLL_L_FT = 100
export const DEFAULT_ROLL_ROT = 0
/** World-space edge gap (ft) that locks a stamp flush to a neighbor. */
export const ROLL_NEIGHBOR_SNAP_FT = 0.5

export function neighborSnapThresholdPx(pxPerFt) {
  const n = Number(pxPerFt)
  if (!Number.isFinite(n) || n <= 0) return 0
  return ROLL_NEIGHBOR_SNAP_FT * n
}

/** Any positive finite feet — 15 ft is a default, not a cap. */
export function parseRollFt(raw, fallback) {
  const n = parseFloat(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n
}

function axisFromDeg(deg) {
  const r = ((Number(deg) || 0) * Math.PI) / 180
  return {
    ux: { x: Math.cos(r), y: Math.sin(r) },
    uy: { x: -Math.sin(r), y: Math.cos(r) },
  }
}

/**
 * Four flush seats around a neighbor, assuming `roll` already shares the
 * neighbor's rotation so long/short edges can meet edge-to-edge.
 */
export function neighborSnapTargets(roll, neighbor, pxPerFt) {
  const { ux, uy } = axisFromDeg(neighbor.rotation)
  const nHW = (parseRollFt(neighbor.wFt, 0) * pxPerFt) / 2
  const nHL = (parseRollFt(neighbor.lFt, 0) * pxPerFt) / 2
  const rHW = (parseRollFt(roll.wFt, 0) * pxPerFt) / 2
  const rHL = (parseRollFt(roll.lFt, 0) * pxPerFt) / 2
  const gx = nHW + rHW
  const gy = nHL + rHL
  return [
    { cx: neighbor.cx + ux.x * gx, cy: neighbor.cy + ux.y * gx },
    { cx: neighbor.cx - ux.x * gx, cy: neighbor.cy - ux.y * gx },
    { cx: neighbor.cx + uy.x * gy, cy: neighbor.cy + uy.y * gy },
    { cx: neighbor.cx - uy.x * gy, cy: neighbor.cy - uy.y * gy },
  ]
}

/**
 * FINAL client rule (non-negotiable) — adjacent PLACE:
 * inherit the neighbor's current rotation AND snap flush. Chain along
 * the placement sequence (A 45° → B against A = 45° → C against B = 45°).
 * Translate-only flush without matching angle is wrong. Explicit rotate
 * is the only intentional angle change. `{ disable: true }` (Alt/Option)
 * turns off snap and inheritance. Free continuous rotation when no
 * neighbor is in range.
 *
 * Working defaults (Agency Manager: implement unless Chance overrides;
 * still PENDING CLIENT confirm — not product law):
 * 1) Two in-range neighbors at different angles → nearest single neighbor
 *    by flush-seat / edge distance. `snapTo` is that winner (for hover
 *    highlight). Do not invent other conflict rules.
 * 2) Callers also run this on move-into-contact (place + move).
 * 3) This helper is not applied during rotate, so post-snap free-rotate
 *    may break flush until the user re-snaps.
 */
export function snapRollToNeighbors(roll, neighbors, pxPerFt, opts = {}) {
  if (opts.disable || !roll || !neighbors?.length) return null
  const excludeId = opts.excludeId
  const limit = opts.thresholdPx ?? neighborSnapThresholdPx(pxPerFt)
  if (!(limit >= 0)) return null
  let best = null
  let bestDist = Infinity
  for (const n of neighbors) {
    if (!n || n.id === excludeId || n.id === roll.id) continue
    const aligned = { ...roll, rotation: n.rotation }
    for (const pos of neighborSnapTargets(aligned, n, pxPerFt)) {
      const d = Math.hypot(pos.cx - roll.cx, pos.cy - roll.cy)
      if (d <= limit && d < bestDist) {
        bestDist = d
        best = { ...aligned, cx: pos.cx, cy: pos.cy, snapped: true, snapTo: n.id }
      }
    }
  }
  return best
}

export function estimateRollsNeeded(gapsSqFt, wFt, lFt) {
  const a = parseRollFt(wFt, 0) * parseRollFt(lFt, 0)
  const g = Number(gapsSqFt)
  if (!(a > 0) || !Number.isFinite(g) || g <= 0) return 0
  return Math.ceil(g / a)
}

export function rollCorners(roll, pxPerFt) {
  const w = (Number(roll.wFt) || 0) * pxPerFt
  const l = (Number(roll.lFt) || 0) * pxPerFt
  const rad = ((Number(roll.rotation) || 0) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const hw = w / 2
  const hl = l / 2
  const local = [
    { x: -hw, y: -hl },
    { x: hw, y: -hl },
    { x: hw, y: hl },
    { x: -hw, y: hl },
  ]
  return local.map(p => ({
    x: roll.cx + p.x * cos - p.y * sin,
    y: roll.cy + p.x * sin + p.y * cos,
  }))
}

export function rollHandlePoint(roll, pxPerFt) {
  const l = (Number(roll.lFt) || 0) * pxPerFt
  const rad = ((Number(roll.rotation) || 0) * Math.PI) / 180
  const reach = l / 2 + Math.max(18, pxPerFt * 0.6)
  return {
    x: roll.cx + Math.sin(rad) * 0 + Math.cos(rad - Math.PI / 2) * reach,
    y: roll.cy + Math.sin(rad - Math.PI / 2) * reach,
  }
}

function edgesIntersect(a, b) {
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i], a2 = a[(i + 1) % a.length]
    for (let j = 0; j < b.length; j++) {
      const b1 = b[j], b2 = b[(j + 1) % b.length]
      if (segsCross(a1, a2, b1, b2)) return true
    }
  }
  return false
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** True if the rotated roll rectangle sits fully inside the turf polygon. */
export function rollFitsInArea(roll, poly, pxPerFt) {
  if (!poly || poly.length < 3) return false
  const corners = rollCorners(roll, pxPerFt)
  if (corners.some(p => !inside(p, poly))) return false
  if (edgesIntersect(corners, poly)) return false
  for (let i = 0; i < corners.length; i++) {
    const mid = midpoint(corners[i], corners[(i + 1) % corners.length])
    if (!inside(mid, poly)) return false
  }
  return true
}

export function pointInRoll(pt, roll, pxPerFt) {
  return inside(pt, rollCorners(roll, pxPerFt))
}

export function rollsOverlap(a, b, pxPerFt) {
  const ca = rollCorners(a, pxPerFt)
  const cb = rollCorners(b, pxPerFt)
  if (ca.some(p => inside(p, cb)) || cb.some(p => inside(p, ca))) return true
  return edgesIntersect(ca, cb)
}

/**
 * Coverage of a turf area by its rolls. Overlaps are allowed and counted
 * once. Grid sampling matches clipPx2 so union area is well-defined.
 */
export function turfCoverage(poly, rolls, pxPerFt, step = 6) {
  const areaPx = poly && poly.length >= 3 ? polyAreaPx(poly) : 0
  const areaSqFt = pxPerFt > 0 ? areaPx / (pxPerFt * pxPerFt) : 0
  const list = rolls || []
  if (!poly || poly.length < 3 || areaSqFt <= 0) {
    return {
      areaSqFt: 0,
      rollsPlaced: list.length,
      coveredSqFt: 0,
      coveragePct: 0,
      gapsSqFt: 0,
      hasOverlap: false,
    }
  }
  const rollPolys = list.map(r => rollCorners(r, pxPerFt))
  let hasOverlap = false
  for (let i = 0; i < list.length && !hasOverlap; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (rollsOverlap(list[i], list[j], pxPerFt)) { hasOverlap = true; break }
    }
  }
  const b = bbox(poly)
  let turfHits = 0
  let coveredHits = 0
  for (let y = b.minY + step / 2; y < b.maxY; y += step) {
    for (let x = b.minX + step / 2; x < b.maxX; x += step) {
      const p = { x, y }
      if (!inside(p, poly)) continue
      turfHits++
      if (rollPolys.some(rp => inside(p, rp))) coveredHits++
    }
  }
  const coverRatio = turfHits ? coveredHits / turfHits : 0
  const coveredSqFt = areaSqFt * coverRatio
  return {
    areaSqFt,
    rollsPlaced: list.length,
    coveredSqFt,
    coveragePct: coverRatio * 100,
    gapsSqFt: Math.max(0, areaSqFt - coveredSqFt),
    hasOverlap,
  }
}

export function objectBounds(item, kind, pxPerFt = 4) {
  if (!item) return null
  if (kind === 'area' && item.poly?.length) {
    return bbox(item.poly)
  }
  if (kind === 'line' && item.pts?.length) {
    return bbox(item.pts)
  }
  if (kind === 'point') {
    return { minX: item.x - 8, minY: item.y - 8, maxX: item.x + 8, maxY: item.y + 8 }
  }
  if (kind === 'roll') {
    return bbox(rollCorners(item, pxPerFt))
  }
  if (kind === 'text') {
    return { minX: item.x, minY: item.y, maxX: item.x + 80, maxY: item.y + 24 }
  }
  return null
}

export function unionBounds(boxes) {
  const valid = boxes.filter(Boolean)
  if (!valid.length) return null
  return valid.reduce((acc, b) => ({
    minX: Math.min(acc.minX, b.minX),
    minY: Math.min(acc.minY, b.minY),
    maxX: Math.max(acc.maxX, b.maxX),
    maxY: Math.max(acc.maxY, b.maxY),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
}
