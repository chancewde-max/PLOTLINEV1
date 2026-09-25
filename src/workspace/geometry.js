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

// Drop the cubic on the split edge and shift later edge indexes by +1.
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
