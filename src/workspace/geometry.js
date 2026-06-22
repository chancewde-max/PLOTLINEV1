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
