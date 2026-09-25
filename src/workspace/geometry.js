// Point-in-polygon (ray casting)
export function inside(pt, poly) {
  if (poly.length < 3) return false
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const { x: xi, y: yi } = poly[i], { x: xj, y: yj } = poly[j]
    if ((yi > pt.y) !== (yj > pt.y) && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

// Signed area (Shoelace)
export function polyAreaPx(poly) {
  let a = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y)
  }
  return Math.abs(a / 2)
}

// Perimeter
export function perimPx(pts, closed = false) {
  let d = 0
  for (let i = 0; i < pts.length - 1; i++) d += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
  if (closed && pts.length > 2) d += Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y)
  return d
}

// Centroid of polygon
export function centroid(pts) {
  const n = pts.length
  if (!n) return { x: 0, y: 0 }
  return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n }
}

// Bounding box
export function bbox(poly) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  poly.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y) })
  return { minX, minY, maxX, maxY }
}

// True polygon clipping by grid sampling — returns overlap area px² and centroid
export function clipPx2(subj, region, step = 4) {
  if (region.length < 3) return { px2: 0, c: null }
  const a = bbox(subj), b = bbox(region)
  const x0 = Math.max(a.minX, b.minX), y0 = Math.max(a.minY, b.minY)
  const x1 = Math.min(a.maxX, b.maxX), y1 = Math.min(a.maxY, b.maxY)
  if (x1 <= x0 || y1 <= y0) return { px2: 0, c: null }
  let hits = 0, sx = 0, sy = 0
  for (let y = y0 + step / 2; y < y1; y += step) {
    for (let x = x0 + step / 2; x < x1; x += step) {
      const p = { x, y }
      if (inside(p, subj) && inside(p, region)) { hits++; sx += x; sy += y }
    }
  }
  return { px2: hits * step * step, c: hits ? { x: sx / hits, y: sy / hits } : null }
}

// Distance between two points
export function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) }

// Cubic segment: { c1, c2 }. Anchors P0/P1 live on the polygon.
// Straight edges omit C1/C2. Circular through-points {x,y} are not cubic.
export function isCubicSeg(seg) {
  return !!(seg && seg.c1 && seg.c2
    && Number.isFinite(seg.c1.x) && Number.isFinite(seg.c1.y)
    && Number.isFinite(seg.c2.x) && Number.isFinite(seg.c2.y))
}

export function cloneCubicSegs(cubicSegs) {
  if (!cubicSegs) return {}
  const next = {}
  for (const [k, seg] of Object.entries(cubicSegs)) {
    if (!isCubicSeg(seg)) continue
    next[k] = {
      c1: { x: seg.c1.x, y: seg.c1.y },
      c2: { x: seg.c2.x, y: seg.c2.y },
    }
  }
  return next
}

export function translateCubicSegs(cubicSegs, dx, dy) {
  const next = {}
  for (const [k, seg] of Object.entries(cloneCubicSegs(cubicSegs))) {
    next[k] = {
      c1: { x: seg.c1.x + dx, y: seg.c1.y + dy },
      c2: { x: seg.c2.x + dx, y: seg.c2.y + dy },
    }
  }
  return next
}

// Straight-edge insert: drop any cubic on that edge and shift later indexes by +1.
// A cubic edge is split with splitCubicEdge instead, so the curve is kept.
export function shiftCubicSegsForInsert(cubicSegs, edgeIndex) {
  const next = {}
  for (const [k, seg] of Object.entries(cloneCubicSegs(cubicSegs))) {
    const i = Number(k)
    if (!Number.isInteger(i) || i === edgeIndex) continue
    next[i > edgeIndex ? i + 1 : i] = seg
  }
  return next
}

// Shoelace edge term, same sign as polyAreaPx (already includes the /2).
function chordEdgeArea(p0, p1) {
  return (p0.x + p1.x) * (p0.y - p1.y) / 2
}

// Signed area of cubic P0,C1,C2,P1. Equals chordEdgeArea when the curve is the chord.
function cubicEdgeArea(p0, c1, c2, p1) {
  const ax = p1.x - 3 * c2.x + 3 * c1.x - p0.x
  const bx = 3 * (c2.x - 2 * c1.x + p0.x)
  const cx = 3 * (c1.x - p0.x)
  const dx = p0.x
  const ay = p1.y - 3 * c2.y + 3 * c1.y - p0.y
  const by = 3 * (c2.y - 2 * c1.y + p0.y)
  const cy = 3 * (c1.y - p0.y)
  const dy = p0.y
  // ∫ x y' dt on t in [0,1]. Chord shoelace is the negation of that integral.
  const integ =
    (1 / 2) * ax * ay + (2 / 5) * ax * by + (1 / 4) * ax * cy +
    (3 / 5) * bx * ay + (1 / 2) * bx * by + (1 / 3) * bx * cy +
    (3 / 4) * cx * ay + (2 / 3) * cx * by + (1 / 2) * cx * cy +
    dx * ay + dx * by + dx * cy
  return -integ
}

// Closed path area in px². Straight edges match polyAreaPx; cubic edges use the curve.
export function shapeAreaPx(poly, cubicSegs = {}) {
  if (!poly || poly.length < 3) return 0
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p0 = poly[i]
    const p1 = poly[(i + 1) % poly.length]
    const seg = cubicSegs && cubicSegs[i]
    a += isCubicSeg(seg) ? cubicEdgeArea(p0, seg.c1, seg.c2, p1) : chordEdgeArea(p0, p1)
  }
  return Math.abs(a)
}

export function areaShapePx(area) {
  return shapeAreaPx(area?.poly || [], area?.cubicSegs)
}

function lerpPt(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

export function cubicPoint(p0, c1, c2, p1, t) {
  const u = 1 - t
  const uu = u * u
  const tt = t * t
  return {
    x: uu * u * p0.x + 3 * uu * t * c1.x + 3 * u * tt * c2.x + tt * t * p1.x,
    y: uu * u * p0.y + 3 * uu * t * c1.y + 3 * u * tt * c2.y + tt * t * p1.y,
  }
}

// de Casteljau. Left runs P0 → point, right runs point → P1.
export function splitCubicAt(p0, c1, c2, p1, t) {
  const a = lerpPt(p0, c1, t)
  const b = lerpPt(c1, c2, t)
  const c = lerpPt(c2, p1, t)
  const d = lerpPt(a, b, t)
  const e = lerpPt(b, c, t)
  const point = lerpPt(d, e, t)
  return {
    point,
    left: { c1: a, c2: d },
    right: { c1: e, c2: c },
  }
}

export function nearestOnCubic(p0, c1, c2, p1, pt, steps = 48) {
  let bestT = 0
  let bestD = Infinity
  let bestP = { x: p0.x, y: p0.y }
  const consider = (t) => {
    const p = cubicPoint(p0, c1, c2, p1, t)
    const d = Math.hypot(p.x - pt.x, p.y - pt.y)
    if (d < bestD) { bestD = d; bestT = t; bestP = p }
  }
  for (let i = 0; i <= steps; i++) consider(i / steps)
  const span = 1 / steps
  const lo = Math.max(0, bestT - span)
  const hi = Math.min(1, bestT + span)
  for (let i = 0; i <= 16; i++) consider(lo + (hi - lo) * (i / 16))
  return { t: bestT, p: bestP, dist: bestD }
}

// Sample cubics into a polyline. Straight edges stay single chords.
// Does not flatten circular arcSegs.
export function flattenAreaPoly(poly, cubicSegs = {}, steps = 32) {
  if (!poly || poly.length < 2) return poly ? poly.map(p => ({ x: p.x, y: p.y })) : []
  const out = []
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const p0 = poly[i]
    const p1 = poly[(i + 1) % n]
    const seg = cubicSegs && cubicSegs[i]
    if (isCubicSeg(seg)) {
      for (let s = 0; s < steps; s++) out.push(cubicPoint(p0, seg.c1, seg.c2, p1, s / steps))
    } else {
      out.push({ x: p0.x, y: p0.y })
    }
  }
  return out
}

export function pointInArea(pt, area) {
  const poly = area?.poly || []
  if (poly.length < 3) return false
  const cubics = area?.cubicSegs
  const curved = cubics && Object.values(cubics).some(isCubicSeg)
  if (!curved) return inside(pt, poly)
  return inside(pt, flattenAreaPoly(poly, cubics))
}

function properSegCross(p1, p2, p3, p4) {
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const d1 = cross(p3, p4, p1), d2 = cross(p3, p4, p2)
  const d3 = cross(p1, p2, p3), d4 = cross(p1, p2, p4)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

function ringKey(poly) {
  let s = ''
  for (let i = 0; i < poly.length; i++) s += `${poly[i].x},${poly[i].y};`
  return s
}

function cubicKey(cubicSegs) {
  if (!cubicSegs) return ''
  const keys = Object.keys(cubicSegs).sort((a, b) => Number(a) - Number(b))
  let s = ''
  for (const k of keys) {
    const seg = cubicSegs[k]
    if (!isCubicSeg(seg)) continue
    s += `${k}:${seg.c1.x},${seg.c1.y},${seg.c2.x},${seg.c2.y};`
  }
  return s
}

const flattenCache = new Map()
const clipCache = new Map()
const CACHE_MAX = 80

function remember(map, key, value) {
  if (map.has(key)) map.delete(key)
  map.set(key, value)
  if (map.size > CACHE_MAX) {
    const oldest = map.keys().next().value
    map.delete(oldest)
  }
  return value
}

// Flattened outlines are reused by the canvas clip and the folder panel.
export function cachedFlattenAreaPoly(poly, cubicSegs = {}, steps = 32) {
  const key = `${steps}|${ringKey(poly || [])}|${cubicKey(cubicSegs)}`
  const hit = flattenCache.get(key)
  if (hit) {
    flattenCache.delete(key)
    flattenCache.set(key, hit)
    return hit
  }
  return remember(flattenCache, key, flattenAreaPoly(poly, cubicSegs, steps))
}

function outlineEdgesCross(flat, region) {
  const n = flat.length
  const m = region.length
  for (let i = 0; i < n; i++) {
    const a = flat[i]
    const b = flat[(i + 1) % n]
    for (let j = 0; j < m; j++) {
      if (properSegCross(a, b, region[j], region[(j + 1) % m])) return true
    }
  }
  return false
}

// Area-weighted centroid. Falls back to a point on the widest interior
// scanline when the centroid lands outside (bowed / self-overlapping outlines).
export function outlineLabelPoint(poly) {
  if (!poly || poly.length === 0) return { x: 0, y: 0 }
  if (poly.length < 3) return centroid(poly)
  let twice = 0, cx = 0, cy = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const cross = poly[j].x * poly[i].y - poly[i].x * poly[j].y
    twice += cross
    cx += (poly[j].x + poly[i].x) * cross
    cy += (poly[j].y + poly[i].y) * cross
  }
  const c = Math.abs(twice) < 1e-8
    ? centroid(poly)
    : { x: cx / (3 * twice), y: cy / (3 * twice) }
  if (inside(c, poly)) return c
  const spanMid = (y) => {
    const xs = []
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[j], b = poly[i]
      if ((a.y > y) === (b.y > y)) continue
      const denom = b.y - a.y
      if (denom === 0) continue
      xs.push(a.x + (b.x - a.x) * (y - a.y) / denom)
    }
    xs.sort((p, q) => p - q)
    let best = null
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const w = xs[i + 1] - xs[i]
      if (w > 0 && (!best || w > best.w)) best = { lo: xs[i], hi: xs[i + 1], w }
    }
    if (!best) return null
    const p = { x: (best.lo + best.hi) / 2, y }
    return inside(p, poly) ? p : null
  }
  const through = spanMid(c.y)
  if (through) return through
  const box = bbox(poly)
  let best = null
  const rows = 28
  for (let i = 1; i < rows; i++) {
    const y = box.minY + (box.maxY - box.minY) * (i / rows)
    const p = spanMid(y)
    if (!p) continue
    if (!best || Math.abs(p.y - c.y) < Math.abs(best.y - c.y)) best = p
  }
  return best || c
}

// Region/folder overlap. The exact cubic integral is used only when the
// flattened outline does not cross the region and no region vertex sits
// inside the shape. A concave bite fails that test and grid-samples the
// outline instead. Closed clips (step <= 4) use a 2px grid so a notch like
// QA's U lands near the fine-grid area; coarser steps stay coarse while drawing.
// Areas with only circular arcSegs stay on the chord polygon.
export function clipAreaPx2(area, region, step = 4) {
  const poly = area?.poly || []
  const cubics = area?.cubicSegs
  const curved = cubics && Object.values(cubics).some(isCubicSeg)
  if (!curved) return clipPx2(poly, region, step)
  const flat = cachedFlattenAreaPoly(poly, cubics)
  const gridStep = step <= 4 ? 2 : step
  const clipKey = `${gridStep}|${ringKey(flat)}|${ringKey(region || [])}`
  const cached = clipCache.get(clipKey)
  if (cached) {
    clipCache.delete(clipKey)
    clipCache.set(clipKey, cached)
    return cached
  }
  let result
  const samplesInside = region && region.length >= 3 && flat.length >= 3 && flat.every(p => inside(p, region))
  const fullyInside = samplesInside
    && !outlineEdgesCross(flat, region)
    && !region.some(v => inside(v, flat))
  if (fullyInside) {
    result = { px2: shapeAreaPx(poly, cubics), c: outlineLabelPoint(flat) }
  } else {
    result = clipPx2(flat, region, gridStep)
  }
  return remember(clipCache, clipKey, result)
}

// Sheet MTO and takeoff pass no region and get the full curve. A region MTO
// passes the folder polygon and clips that same flattened outline. When the
// outline sits entirely inside the region, both numbers are shapeAreaPx.
export function measuredAreaPx2(area, region) {
  if (region && region.length >= 3) return clipAreaPx2(area, region, 4).px2
  return areaShapePx(area)
}

// sheet.areas and savedAreas share ids. Later copies (the drawn cubic) win
// so a region total does not add the chord twin on top of the curve.
export function areasPreferLatest(areas) {
  const byId = new Map()
  const anon = []
  for (const a of areas || []) {
    if (!a) continue
    if (a.id == null) anon.push(a)
    else byId.set(a.id, a)
  }
  return [...byId.values(), ...anon]
}

export function areaOutlineCentroid(area) {
  const poly = area?.poly || []
  if (poly.length < 3) return centroid(poly)
  const cubics = area?.cubicSegs
  const curved = cubics && Object.values(cubics).some(isCubicSeg)
  const ring = curved ? cachedFlattenAreaPoly(poly, cubics) : poly
  return outlineLabelPoint(ring)
}

// True when non-adjacent edges of the flattened outline properly cross.
export function outlineSelfIntersects(poly, cubicSegs) {
  const flat = (!poly || poly.length < 4) ? poly : cachedFlattenAreaPoly(poly, cubicSegs || {})
  if (!flat || flat.length < 4) return false
  const n = flat.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue
      if (properSegCross(flat[i], flat[(i + 1) % n], flat[j], flat[(j + 1) % n])) return true
    }
  }
  return false
}

function ptInRect(p, r) {
  return p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY
}

function segsCross(p1, p2, p3, p4) {
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const d1 = cross(p3, p4, p1), d2 = cross(p3, p4, p2)
  const d3 = cross(p1, p2, p3), d4 = cross(p1, p2, p4)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

function segIntersectsRect(a, b, r) {
  if (ptInRect(a, r) || ptInRect(b, r)) return true
  const c1 = { x: r.minX, y: r.minY }, c2 = { x: r.maxX, y: r.minY }
  const c3 = { x: r.maxX, y: r.maxY }, c4 = { x: r.minX, y: r.maxY }
  return segsCross(a, b, c1, c2) || segsCross(a, b, c2, c3) ||
         segsCross(a, b, c3, c4) || segsCross(a, b, c4, c1)
}

// Marquee hit against the curved outline, not the straight-edge polygon.
export function areaTouchesRect(area, rect) {
  const poly = area?.poly || []
  if (!rect || poly.length < 2) return false
  const flat = flattenAreaPoly(poly, area?.cubicSegs)
  const ring = flat.length >= 2 ? flat : poly
  if (ring.some(v => ptInRect(v, rect))) return true
  for (let i = 0; i < ring.length; i++) {
    if (segIntersectsRect(ring[i], ring[(i + 1) % ring.length], rect)) return true
  }
  const corners = [
    { x: rect.minX, y: rect.minY },
    { x: rect.maxX, y: rect.minY },
    { x: rect.maxX, y: rect.maxY },
    { x: rect.minX, y: rect.maxY },
  ]
  return corners.some(c => pointInArea(c, area))
}

// Vertices before C1/C2. A control point sitting on P0 must not steal the drag.
// Handles are only considered for handleAreaId (the selected area).
export function firstAreaHit(areas, pt, hitPx, { handleAreaId = null } = {}) {
  const list = areas || []
  if (!pt) return null
  for (let i = list.length - 1; i >= 0; i--) {
    const a = list[i]
    const poly = a?.poly || []
    for (let j = 0; j < poly.length; j++) {
      if (Math.hypot(poly[j].x - pt.x, poly[j].y - pt.y) < hitPx) {
        return { area: a, kind: 'vertex', index: j }
      }
    }
  }
  if (handleAreaId != null) {
    const sel = list.find(a => a.id === handleAreaId)
    if (sel?.cubicSegs) {
      for (const [k, seg] of Object.entries(sel.cubicSegs)) {
        if (!seg?.c1 || !seg?.c2) continue
        for (const which of ['c1', 'c2']) {
          if (Math.hypot(seg[which].x - pt.x, seg[which].y - pt.y) < hitPx) {
            return { area: sel, kind: 'handle', edge: Number(k), which }
          }
        }
      }
    }
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const a = list[i]
    if (pointInArea(pt, a)) return { area: a, kind: 'interior' }
  }
  return null
}

// Closest point on the real edge. Cubic edges use the curve, not the chord.
export function nearestAreaEdge(poly, cubicSegs, pt) {
  if (!poly || poly.length < 2 || !pt) return null
  let best = null
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const seg = cubicSegs && cubicSegs[i]
    if (isCubicSeg(seg)) {
      const hit = nearestOnCubic(a, seg.c1, seg.c2, b, pt)
      if (!best || hit.dist < best.dist) {
        best = { edge: i, dist: hit.dist, point: hit.p, t: hit.t, cubic: true }
      }
    } else {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len2 = dx * dx + dy * dy
      if (len2 === 0) continue
      const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2))
      const point = { x: a.x + t * dx, y: a.y + t * dy }
      const d = Math.hypot(pt.x - point.x, pt.y - point.y)
      if (!best || d < best.dist) best = { edge: i, dist: d, point, t, cubic: false }
    }
  }
  return best
}

// Insert a vertex on a cubic edge, splitting the bezier at t. Area is preserved.
export function splitCubicEdge(poly, cubicSegs, edgeIndex, t) {
  const n = poly.length
  const p0 = poly[edgeIndex]
  const p1 = poly[(edgeIndex + 1) % n]
  const seg = cubicSegs[edgeIndex]
  const split = splitCubicAt(p0, seg.c1, seg.c2, p1, t)
  const nextPoly = [
    ...poly.slice(0, edgeIndex + 1).map(p => ({ x: p.x, y: p.y })),
    split.point,
    ...poly.slice(edgeIndex + 1).map(p => ({ x: p.x, y: p.y })),
  ]
  const next = {}
  for (const [k, s] of Object.entries(cloneCubicSegs(cubicSegs))) {
    const i = Number(k)
    if (!Number.isInteger(i) || i === edgeIndex) continue
    next[i > edgeIndex ? i + 1 : i] = s
  }
  next[edgeIndex] = split.left
  next[edgeIndex + 1] = split.right
  return { poly: nextPoly, cubicSegs: next }
}

function areaEdgeCmd(start, end, arcThrough, cubic, closing = false) {
  if (isCubicSeg(cubic)) {
    return ` C ${cubic.c1.x} ${cubic.c1.y} ${cubic.c2.x} ${cubic.c2.y} ${end.x} ${end.y}`
  }
  if (arcThrough && Number.isFinite(arcThrough.x) && Number.isFinite(arcThrough.y) && !arcThrough.c1) {
    return circularArcSeg(start, arcThrough, end)
  }
  if (closing) return ''
  return ` L ${end.x} ${end.y}`
}

// Open chain (drawing preview). Does not close.
export function buildChainPath(pts, arcSegs = {}, cubicSegs = {}) {
  if (!pts || pts.length < 1) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    d += areaEdgeCmd(pts[i - 1], pts[i], arcSegs?.[i - 1], cubicSegs?.[i - 1], false)
  }
  return d
}

// Live cubic rubber-band from the last anchor to the cursor.
// c1: line to cursor. c2: curve with C2 and P1 on the cursor. p1: full cubic to cursor.
export function cubicPreviewCmd(phase, c1, c2, cursor) {
  if (!cursor || !Number.isFinite(cursor.x) || !Number.isFinite(cursor.y)) return ''
  if (phase === 'c2' && c1) {
    return ` C ${c1.x} ${c1.y} ${cursor.x} ${cursor.y} ${cursor.x} ${cursor.y}`
  }
  if (phase === 'p1' && c1 && c2) {
    return ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${cursor.x} ${cursor.y}`
  }
  return ` L ${cursor.x} ${cursor.y}`
}

// Circular arc SVG segment through 3 points S, T (through-point), E.
// Still used by Linear and Turf-draw. New Area curves use cubic `C` commands.
export function circularArcSeg(S, T, E) {
  const ax = S.x, ay = S.y, bx = T.x, by = T.y, cx = E.x, cy = E.y
  const D = 2 * (ax*(by-cy) + bx*(cy-ay) + cx*(ay-by))
  if (Math.abs(D) < 1e-10) return ` L ${E.x} ${E.y}` // collinear → straight line
  const ux = ((ax*ax+ay*ay)*(by-cy) + (bx*bx+by*by)*(cy-ay) + (cx*cx+cy*cy)*(ay-by)) / D
  const uy = ((ax*ax+ay*ay)*(cx-bx) + (bx*bx+by*by)*(ax-cx) + (cx*cx+cy*cy)*(bx-ax)) / D
  const r = Math.hypot(ax-ux, ay-uy)
  // In SVG y-down coords, CW on screen = increasing atan2 angle.
  // Determine sweep/large by checking which arc (CW vs CCW) T falls on.
  const n2pi = a => ((a % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI)
  const angS = Math.atan2(ay - uy, ax - ux)
  const angT = Math.atan2(by - uy, bx - ux)
  const angE = Math.atan2(cy - uy, cx - ux)
  const cwSE = n2pi(angE - angS) // CW span from S to E
  const cwST = n2pi(angT - angS) // CW span from S to T
  const sweep = cwST < cwSE ? 1 : 0 // T reached before E going CW → use CW
  const span = sweep === 1 ? cwSE : (2 * Math.PI - cwSE)
  const large = span > Math.PI ? 1 : 0
  return ` A ${r} ${r} 0 ${large} ${sweep} ${E.x} ${E.y}`
}

export function buildAreaPath(poly, arcSegs = {}, cubicSegs = {}) {
  if (!poly || poly.length < 2) return ''
  let d = `M ${poly[0].x} ${poly[0].y}`
  for (let i = 1; i < poly.length; i++) {
    d += areaEdgeCmd(poly[i - 1], poly[i], arcSegs?.[i - 1], cubicSegs?.[i - 1], false)
  }
  if (poly.length > 2) {
    const closeIdx = poly.length - 1
    d += areaEdgeCmd(poly[closeIdx], poly[0], arcSegs?.[closeIdx], cubicSegs?.[closeIdx], true)
  }
  return d + ' Z'
}

export function buildLinePath(pts, arcSegs = {}) {
  if (!pts || pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const S = pts[i - 1], E = pts[i]
    if (arcSegs[i - 1]) d += circularArcSeg(S, arcSegs[i - 1], E)
    else d += ` L ${E.x} ${E.y}`
  }
  return d
}

// True circular arc LENGTH (px) between S and E through T — mirrors circularArcSeg.
export function circularArcLen(S, T, E) {
  const ax = S.x, ay = S.y, bx = T.x, by = T.y, cx = E.x, cy = E.y
  const D = 2 * (ax*(by-cy) + bx*(cy-ay) + cx*(ay-by))
  if (Math.abs(D) < 1e-10) return Math.hypot(cx - ax, cy - ay) // collinear → straight chord
  const ux = ((ax*ax+ay*ay)*(by-cy) + (bx*bx+by*by)*(cy-ay) + (cx*cx+cy*cy)*(ay-by)) / D
  const uy = ((ax*ax+ay*ay)*(cx-bx) + (bx*bx+by*by)*(ax-cx) + (cx*cx+cy*cy)*(bx-ax)) / D
  const r = Math.hypot(ax-ux, ay-uy)
  const n2pi = a => ((a % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI)
  const angS = Math.atan2(ay - uy, ax - ux)
  const angT = Math.atan2(by - uy, bx - ux)
  const angE = Math.atan2(cy - uy, cx - ux)
  const cwSE = n2pi(angE - angS)
  const cwST = n2pi(angT - angS)
  const sweep = cwST < cwSE ? 1 : 0
  const span = sweep === 1 ? cwSE : (2 * Math.PI - cwSE)
  return r * span
}

// Arc-aware polyline length (px): arc segments use true curve length, others use chords.
export function linePathLenPx(pts, arcSegs = {}) {
  if (!pts || pts.length < 2) return 0
  let d = 0
  for (let i = 1; i < pts.length; i++) {
    const S = pts[i - 1], E = pts[i]
    if (arcSegs && arcSegs[i - 1]) d += circularArcLen(S, arcSegs[i - 1], E)
    else d += Math.hypot(E.x - S.x, E.y - S.y)
  }
  return d
}
