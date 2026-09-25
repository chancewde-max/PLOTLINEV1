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

// Grid sample of the bbox overlap only (not the full subject). Returns overlap
// area px² and the average of the hit cell centers.
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

// Geometry identity for one area: polygon plus cubic handles. No step prefix.
function geomId(poly, cubicSegs) {
  return `${ringKey(poly || [])}|${cubicKey(cubicSegs)}`
}

export function areaGeometryKey(area) {
  return geomId(area?.poly || [], area?.cubicSegs)
}

export function polygonKey(poly) {
  return ringKey(poly || [])
}

// Per-geometry flatten records and per-geometry clip results. There is no
// global cap: a fixed cap evicts live areas once the sheet (or a second
// folder polygon) exceeds it. syncGeometryCache drops deleted areas and
// clip keys for regions that are no longer on screen.
const flattenCache = new Map()
const clipCache = new Map()
let flattenWork = 0
let clipWork = 0

function areaIsCurved(area) {
  const cubics = area?.cubicSegs
  return !!(cubics && Object.values(cubics).some(isCubicSeg))
}

function gridStepFor(area, step) {
  return areaIsCurved(area) && step <= 4 ? 2 : step
}

function clipStoreKey(area, region, step, labels = true) {
  return `${gridStepFor(area, step)}|${labels ? 'L' : 'S'}|${ringKey(region || [])}`
}

function cachedFlatRecord(poly, cubicSegs, steps = 32) {
  const key = `${steps}|${geomId(poly, cubicSegs)}`
  const hit = flattenCache.get(key)
  if (hit) return hit
  flattenWork++
  const rec = { flat: flattenAreaPoly(poly, cubicSegs, steps), selfX: null }
  flattenCache.set(key, rec)
  return rec
}

// Flattened outlines are reused by the canvas clip and the folder panel.
export function cachedFlattenAreaPoly(poly, cubicSegs = {}, steps = 32) {
  return cachedFlatRecord(poly, cubicSegs, steps).flat
}

export function geometryCacheStats() {
  let clipEntries = 0
  for (const regions of clipCache.values()) clipEntries += regions.size
  return {
    flattenWork,
    clipWork,
    flattenEntries: flattenCache.size,
    clipEntries,
    areaEntries: clipCache.size,
  }
}

export function resetGeometryWorkCounters() {
  flattenWork = 0
  clipWork = 0
}

// Keep flatten/clip entries for these areas only, and only the clip regions
// listed (live region plus saved folder polygons). A region drag passes the
// polygon for this mouse position; the previous drag polygon is dropped.
export function syncGeometryCache(areas, keepClips) {
  const live = new Set()
  const keep = new Set()
  for (const a of areas || []) {
    const id = geomId(a?.poly || [], a?.cubicSegs)
    live.add(id)
    for (const c of keepClips || []) {
      const region = c?.region
      if (!region || region.length < 3) continue
      keep.add(`${id}||${clipStoreKey(a, region, c.step ?? 4, c.labels !== false)}`)
    }
  }
  for (const key of [...flattenCache.keys()]) {
    const id = key.slice(key.indexOf('|') + 1)
    if (!live.has(id)) flattenCache.delete(key)
  }
  for (const [id, regions] of [...clipCache.entries()]) {
    if (!live.has(id)) { clipCache.delete(id); continue }
    for (const ck of [...regions.keys()]) {
      if (!keep.has(`${id}||${ck}`)) regions.delete(ck)
    }
    if (regions.size === 0) clipCache.delete(id)
  }
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

// Widths within this fraction of the wider span are a tie. A strict
// `w > best` flips the two equal horns of a bow when float noise swaps
// which side is wider. Ties go to the span nearest nearX, then the lower x.
const SPAN_TIE_REL = 1e-4

function chooseSpan(xs, nearX) {
  let best = null
  const near = Number.isFinite(nearX) ? nearX : 0
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const w = xs[i + 1] - xs[i]
    if (!(w > 0)) continue
    const mid = (xs[i] + xs[i + 1]) / 2
    const cand = { lo: xs[i], hi: xs[i + 1], w, mid }
    if (!best) { best = cand; continue }
    const rel = (w - best.w) / Math.max(best.w, w)
    if (rel > SPAN_TIE_REL) { best = cand; continue }
    if (rel < -SPAN_TIE_REL) continue
    const dC = Math.abs(mid - near)
    const dB = Math.abs(best.mid - near)
    if (dC < dB - 1e-6 || (Math.abs(dC - dB) <= 1e-6 && mid < best.mid)) best = cand
  }
  return best
}

function spanCrossings(poly, y) {
  const xs = []
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i]
    if ((a.y > y) === (b.y > y)) continue
    const denom = b.y - a.y
    if (denom === 0) continue
    xs.push(a.x + (b.x - a.x) * (y - a.y) / denom)
  }
  xs.sort((p, q) => p - q)
  return xs
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
    const best = chooseSpan(spanCrossings(poly, y), c.x)
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

function ringSignedArea(poly) {
  let a = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += poly[j].x * poly[i].y - poly[i].x * poly[j].y
  }
  return a / 2
}

function cleanRing(poly) {
  const out = []
  for (const p of poly) {
    const prev = out[out.length - 1]
    if (prev && Math.hypot(prev.x - p.x, prev.y - p.y) < 1e-6) continue
    out.push({ x: p.x, y: p.y })
  }
  if (out.length > 1 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) < 1e-6) out.pop()
  return out
}

function isConvexRing(poly) {
  if (!poly || poly.length < 3) return false
  let sign = 0
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], c = poly[(i + 2) % n]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cross) < 1e-8) continue
    const s = cross > 0 ? 1 : -1
    if (!sign) sign = s
    else if (s !== sign) return false
  }
  return sign !== 0
}

function segmentLineHit(s, e, a, b) {
  const dx1 = e.x - s.x, dy1 = e.y - s.y
  const dx2 = b.x - a.x, dy2 = b.y - a.y
  const den = dx1 * dy2 - dy1 * dx2
  if (Math.abs(den) < 1e-12) return { x: e.x, y: e.y }
  const t = ((a.x - s.x) * dy2 - (a.y - s.y) * dx2) / den
  return { x: s.x + t * dx1, y: s.y + t * dy1 }
}

// Convex clip polygon. The subject may be concave (a C, or a flattened cubic).
function sutherlandHodgman(subject, clip) {
  let output = cleanRing(subject)
  if (output.length < 3 || !clip || clip.length < 3) return []
  const cw = ringSignedArea(clip) < 0
  const insideH = (p, a, b) => {
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
    return cw ? cross <= 1e-7 : cross >= -1e-7
  }
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length]
    const input = output
    output = []
    if (input.length < 1) break
    for (let j = 0; j < input.length; j++) {
      const s = input[j]
      const e = input[(j + 1) % input.length]
      const ein = insideH(e, a, b)
      const sin = insideH(s, a, b)
      if (ein) {
        if (!sin) output.push(segmentLineHit(s, e, a, b))
        output.push({ x: e.x, y: e.y })
      } else if (sin) {
        output.push(segmentLineHit(s, e, a, b))
      }
    }
    output = cleanRing(output)
  }
  return output.length >= 3 ? output : []
}

function pointInTri(p, a, b, c) {
  const s = (p1, p2, p3) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y)
  const d1 = s(p, a, b), d2 = s(p, b, c), d3 = s(p, c, a)
  const hasNeg = d1 < -1e-8 || d2 < -1e-8 || d3 < -1e-8
  const hasPos = d1 > 1e-8 || d2 > 1e-8 || d3 > 1e-8
  return !(hasNeg && hasPos)
}

function triangulateRing(poly) {
  const pts = poly.map(p => ({ x: p.x, y: p.y }))
  if (pts.length < 3) return []
  if (pts.length === 3) return [pts]
  if (ringSignedArea(pts) < 0) pts.reverse()
  const idx = pts.map((_, i) => i)
  const tris = []
  let guard = pts.length * pts.length
  while (idx.length > 3 && guard-- > 0) {
    let clipped = false
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i + idx.length - 1) % idx.length]
      const i1 = idx[i]
      const i2 = idx[(i + 1) % idx.length]
      const a = pts[i0], b = pts[i1], c = pts[i2]
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
      if (cross <= 1e-8) continue
      let contains = false
      for (let k = 0; k < idx.length; k++) {
        const ik = idx[k]
        if (ik === i0 || ik === i1 || ik === i2) continue
        if (pointInTri(pts[ik], a, b, c)) { contains = true; break }
      }
      if (contains) continue
      tris.push([a, b, c])
      idx.splice(i, 1)
      clipped = true
      break
    }
    if (!clipped) break
  }
  if (idx.length === 3) tris.push([pts[idx[0]], pts[idx[1]], pts[idx[2]]])
  return tris
}

function intersectionPieces(subject, region) {
  if (!subject || subject.length < 3 || !region || region.length < 3) return []
  if (isConvexRing(region)) {
    const piece = sutherlandHodgman(subject, region)
    return piece.length >= 3 ? [piece] : []
  }
  const pieces = []
  for (const tri of triangulateRing(region)) {
    const piece = sutherlandHodgman(subject, tri)
    if (piece.length >= 3 && Math.abs(ringSignedArea(piece)) > 1e-4) pieces.push(piece)
  }
  return pieces
}

function qCoord(v) { return Math.round(v * 1000) }

function pointStrictlyOnSeg(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y
  const len = Math.hypot(abx, aby)
  if (len < 1e-9) return false
  const cross = abx * (p.y - a.y) - aby * (p.x - a.x)
  if (Math.abs(cross) > 1e-4 * len) return false
  const t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby)
  return t > 1e-6 && t < 1 - 1e-6
}

// Sutherland–Hodgman emits one ring. A concave subject cut by a convex box
// can come back as two real pieces joined by a zero-width bridge. Split edges
// at vertices that lie on them and cancel those opposite bridge edges.
function splitBridgedRing(ring) {
  const n = ring.length
  if (n < 3) return []
  const segs = []
  for (let i = 0; i < n; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % n]
    const cuts = []
    for (let k = 0; k < n; k++) {
      if (k === i || k === (i + 1) % n) continue
      const p = ring[k]
      if (!pointStrictlyOnSeg(p, a, b)) continue
      const abx = b.x - a.x, aby = b.y - a.y
      const t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby)
      cuts.push({ t, p })
    }
    cuts.sort((u, v) => u.t - v.t)
    let cur = a
    for (const c of cuts) {
      if (Math.hypot(cur.x - c.p.x, cur.y - c.p.y) > 1e-6) segs.push([cur, c.p])
      cur = c.p
    }
    if (Math.hypot(cur.x - b.x, cur.y - b.y) > 1e-6) segs.push([cur, b])
  }
  const bag = new Map()
  const keyOf = (p, q) => `${qCoord(p.x)},${qCoord(p.y)}>${qCoord(q.x)},${qCoord(q.y)}`
  for (const [a, b] of segs) {
    const rev = keyOf(b, a)
    const revList = bag.get(rev)
    if (revList && revList.length) {
      revList.pop()
      if (!revList.length) bag.delete(rev)
    } else {
      const fwd = keyOf(a, b)
      const list = bag.get(fwd)
      if (list) list.push([a, b])
      else bag.set(fwd, [[a, b]])
    }
  }
  const edges = []
  for (const list of bag.values()) {
    for (const [a, b] of list) edges.push({ a, b })
  }
  const cancelled = edges.length !== segs.length
  const traced = traceDirectedRings(edges)
  const kept = traced.filter(r => r.length >= 3 && Math.abs(ringSignedArea(r)) > 1e-3)
  if (kept.length) return kept
  if (!cancelled && Math.abs(ringSignedArea(ring)) > 1e-3) return [cleanRing(ring)]
  return []
}

function traceDirectedRings(edges) {
  const byStart = new Map()
  edges.forEach((e, i) => {
    e.i = i
    const k = `${qCoord(e.a.x)},${qCoord(e.a.y)}`
    const list = byStart.get(k)
    if (list) list.push(e)
    else byStart.set(k, [e])
  })
  const used = new Array(edges.length).fill(false)
  const rings = []
  for (let i = 0; i < edges.length; i++) {
    if (used[i]) continue
    const startKey = `${qCoord(edges[i].a.x)},${qCoord(edges[i].a.y)}`
    const pts = [{ x: edges[i].a.x, y: edges[i].a.y }]
    used[i] = true
    let cur = edges[i]
    let guard = edges.length + 1
    let closed = false
    while (guard-- > 0) {
      const endKey = `${qCoord(cur.b.x)},${qCoord(cur.b.y)}`
      if (endKey === startKey) { closed = true; break }
      const nxt = (byStart.get(endKey) || []).find(e => !used[e.i])
      if (!nxt) break
      pts.push({ x: cur.b.x, y: cur.b.y })
      used[nxt.i] = true
      cur = nxt
    }
    if (closed && pts.length >= 3) rings.push(pts)
  }
  return rings
}

function pieceMetrics(poly) {
  let twice = 0, cx = 0, cy = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const cross = poly[j].x * poly[i].y - poly[i].x * poly[j].y
    twice += cross
    cx += (poly[j].x + poly[i].x) * cross
    cy += (poly[j].y + poly[i].y) * cross
  }
  const area = Math.abs(twice) / 2
  const c = Math.abs(twice) < 1e-8
    ? centroid(poly)
    : { x: cx / (3 * twice), y: cy / (3 * twice) }
  return { poly, area, c }
}

// Greater area, then the lower centroid, then the left one. Equal bars stay
// on the same piece when the region edge moves a fraction of a pixel.
function pickLargestPiece(pieces) {
  let best = null
  for (const poly of pieces) {
    const m = pieceMetrics(poly)
    if (m.area < 1e-3) continue
    if (!best || m.area > best.area + 1e-4) { best = m; continue }
    if (m.area < best.area - 1e-4) continue
    if (m.c.y < best.c.y - 1e-6 || (Math.abs(m.c.y - best.c.y) <= 1e-6 && m.c.x < best.c.x)) best = m
  }
  return best
}

function interiorScanline(poly, near) {
  const nearX = near && Number.isFinite(near.x) ? near.x : 0
  const nearY = near && Number.isFinite(near.y) ? near.y : (Number.isFinite(near) ? near : 0)
  const spanMid = (y) => {
    const best = chooseSpan(spanCrossings(poly, y), nearX)
    if (!best) return null
    const p = { x: (best.lo + best.hi) / 2, y }
    return inside(p, poly) ? p : null
  }
  const through = spanMid(nearY)
  if (through) return through
  const box = bbox(poly)
  let best = null
  const rows = 28
  for (let i = 1; i < rows; i++) {
    const y = box.minY + (box.maxY - box.minY) * (i / rows)
    const p = spanMid(y)
    if (!p) continue
    if (!best || Math.abs(p.y - nearY) < Math.abs(best.y - nearY)) best = p
  }
  return best
}

function nearestGridHit(flat, region, step, target) {
  const a = bbox(flat), b = bbox(region)
  const x0 = Math.max(a.minX, b.minX), y0 = Math.max(a.minY, b.minY)
  const x1 = Math.min(a.maxX, b.maxX), y1 = Math.min(a.maxY, b.maxY)
  if (x1 <= x0 || y1 <= y0) return null
  const tx = target ? target.x : (x0 + x1) / 2
  const ty = target ? target.y : (y0 + y1) / 2
  let best = null, bestD = Infinity
  for (let y = y0 + step / 2; y < y1; y += step) {
    for (let x = x0 + step / 2; x < x1; x += step) {
      if (!inside({ x, y }, flat) || !inside({ x, y }, region)) continue
      const d = (x - tx) * (x - tx) + (y - ty) * (y - ty)
      if (d < bestD) { bestD = d; best = { x, y } }
    }
  }
  return best
}

function labelInOutlineAndRegion(p, outline, region) {
  return !!(p && inside(p, outline) && inside(p, region))
}

// Centroid of the largest real piece. Reject it unless it sits in that piece,
// the original outline, and the region. Then a scanline of the piece, then
// the nearest clip grid cell that is inside both.
function labelFromPieces(pieces, outline, region, gridStep) {
  const best = pickLargestPiece(pieces)
  const pieceC = best ? { x: best.c.x, y: best.c.y } : null
  if (pieceC && inside(pieceC, best.poly) && labelInOutlineAndRegion(pieceC, outline, region)) {
    return { c: pieceC, pieceC }
  }
  if (best && pieceC) {
    const scan = interiorScanline(best.poly, pieceC)
    if (labelInOutlineAndRegion(scan, outline, region)) return { c: scan, pieceC }
  }
  return { c: nearestGridHit(outline, region, gridStep, pieceC), pieceC }
}

function bboxesOverlap(a, b) {
  return a.maxX > b.minX && b.maxX > a.minX && a.maxY > b.minY && b.maxY > a.minY
}

function fullyInsideRing(flat, region) {
  if (!region || region.length < 3 || !flat || flat.length < 3) return false
  if (!flat.every(p => inside(p, region))) return false
  if (outlineEdgesCross(flat, region)) return false
  if (region.some(v => inside(v, flat))) return false
  return true
}

// Region/folder overlap. Exact shoelace (straight) or the cubic integral is
// used only when the outline does not cross the region and no region vertex
// sits inside the shape. A concave bite fails that test and grid-samples the
// outline. Closed curved clips (step <= 4) use a 2px grid; straight partial
// overlaps stay on the caller's step. opts.labels === false skips piece and
// label work (folder panel and region MTO). A partial label is the centroid
// of the largest real piece after zero-width bridges are removed.
// Areas with only circular arcSegs stay on the chord polygon.
export function clipAreaPx2(area, region, step = 4, opts) {
  const poly = area?.poly || []
  const cubics = area?.cubicSegs
  if (!region || region.length < 3 || poly.length < 3) return { px2: 0, c: null }
  const wantLabels = !opts || opts.labels !== false
  const curved = areaIsCurved(area)
  const id = geomId(poly, cubics)
  const storeKey = clipStoreKey(area, region, step, wantLabels)
  let byRegion = clipCache.get(id)
  const cached = byRegion?.get(storeKey)
  if (cached) return cached
  clipWork++
  const flat = curved ? cachedFlatRecord(poly, cubics).flat : poly
  const gridStep = gridStepFor(area, step)
  let result
  if (!bboxesOverlap(bbox(flat), bbox(region))) {
    result = { px2: 0, c: null }
  } else if (fullyInsideRing(flat, region)) {
    result = {
      px2: curved ? shapeAreaPx(poly, cubics) : polyAreaPx(poly),
      c: wantLabels ? outlineLabelPoint(flat) : null,
    }
  } else if (!wantLabels) {
    result = { px2: clipPx2(flat, region, gridStep).px2, c: null }
  } else {
    const grid = clipPx2(flat, region, gridStep)
    const pieces = []
    for (const ring of intersectionPieces(flat, region)) {
      for (const part of splitBridgedRing(ring)) pieces.push(part)
    }
    const labeled = labelFromPieces(pieces, flat, region, gridStep)
    result = { px2: grid.px2, c: labeled.c, pieceC: labeled.pieceC }
  }
  if (!byRegion) {
    byRegion = new Map()
    clipCache.set(id, byRegion)
  }
  byRegion.set(storeKey, result)
  return result
}

// Sheet MTO and takeoff pass no region and get the full curve. A region MTO
// passes the folder polygon and clips that same flattened outline. Sq ft only:
// piece and label work stays on the canvas label path. When the outline sits
// entirely inside the region, both numbers are shapeAreaPx.
export function measuredAreaPx2(area, region) {
  if (region && region.length >= 3) return clipAreaPx2(area, region, 4, { labels: false }).px2
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

function flatEdgesSelfIntersect(flat) {
  const n = flat.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue
      if (properSegCross(flat[i], flat[(i + 1) % n], flat[j], flat[(j + 1) % n])) return true
    }
  }
  return false
}

// True when non-adjacent edges of the flattened outline properly cross.
// A cubic can cross at any vertex count, so the outline is flattened before
// the 4-vertex check. The boolean is stored on the geometry record.
export function outlineSelfIntersects(poly, cubicSegs) {
  if (!poly || poly.length < 2) return false
  const cubics = cubicSegs || {}
  const curved = Object.values(cubics).some(isCubicSeg)
  if (!curved && poly.length < 4) return false
  const rec = cachedFlatRecord(poly, cubics)
  const flat = rec.flat
  if (!flat || flat.length < 4) return false
  if (rec.selfX == null) rec.selfX = flatEdgesSelfIntersect(flat)
  return rec.selfX
}

export function areaSelfIntersects(area) {
  return outlineSelfIntersects(area?.poly, area?.cubicSegs)
}

// P1 on P0 is a zero-length edge. Reject only that coincidence (under half
// a sheet pixel). A 16px sheet radius is 4 ft at the default scale and
// silently drops a real click at every zoom.
export function cubicP1DuplicatesP0(p, p0) {
  if (!p || !p0) return false
  return dist(p, p0) < 0.5
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
