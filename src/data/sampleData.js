// Sheet canvas dimensions
export const SHEET_W = 900
export const SHEET_H = 620

// Helper: array pairs → points
const P = (arr) => arr.map(([x, y]) => ({ x, y }))

// Seeded RNG for deterministic item placement
function seededRng(seed) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296 }
}

function makePoints(rng, counts) {
  const out = []
  let id = 0
  for (const [type, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i++) {
      out.push({ id: `pt-${id++}`, type, x: 64 + rng() * (SHEET_W - 128), y: 62 + rng() * (SHEET_H - 128) })
    }
  }
  return out
}

// ---- Sheet items (fixed plan elements) -----------------------------------

const PLANTING_AREAS = [
  { id: 'a1', type: 'sod',       poly: P([[130,108],[400,98],[420,288],[150,308]]) },
  { id: 'a2', type: 'sod',       poly: P([[560,348],[772,360],[776,512],[576,506]]) },
  { id: 'a3', type: 'rock',      poly: P([[452,120],[592,128],[582,250],[444,242]]) },
  { id: 'a4', type: 'rock',      poly: P([[172,360],[322,360],[322,470],[172,470]]) },
  { id: 'a5', type: 'hydroseed', poly: P([[622,108],[800,120],[800,300],[642,300]]) },
  { id: 'a6', type: 'hydroseed', poly: P([[360,378],[520,388],[512,520],[372,512]]) },
]

const PLANTING_LINES = [
  { id: 'w1', type: 'lime-wall', pts: P([[112,326],[112,544],[300,544]]) },
  { id: 'w2', type: 'lime-wall', pts: P([[558,330],[804,330]]) },
  { id: 'w3', type: 'lime-wall', pts: P([[150,150],[150,70],[390,70]]) },
]

const PLANTING_POINTS = makePoints(seededRng(20260622), { tree: 9, shrub: 14, 'lime-block': 7, irrigation: 18 })

// A second sheet with different items
const IRRIGATION_AREAS = [
  { id: 'a1', type: 'sod',       poly: P([[80,80],[380,70],[400,260],[100,280]]) },
  { id: 'a2', type: 'hydroseed', poly: P([[420,100],[700,90],[720,310],[440,320]]) },
  { id: 'a3', type: 'rock',      poly: P([[200,330],[480,330],[490,530],[210,530]]) },
  { id: 'a4', type: 'sod',       poly: P([[530,380],[780,370],[790,540],[550,550]]) },
]

const IRRIGATION_LINES = [
  { id: 'w1', type: 'lime-wall', pts: P([[80,280],[80,560],[300,560]]) },
  { id: 'w2', type: 'lime-wall', pts: P([[640,300],[820,300]]) },
]

const IRRIGATION_POINTS = makePoints(seededRng(20260623), { tree: 6, shrub: 10, irrigation: 24, 'lime-block': 4 })

// A third sheet
const GRADING_AREAS = [
  { id: 'a1', type: 'sod',       poly: P([[60,60],[320,50],[340,200],[80,220]]) },
  { id: 'a2', type: 'rock',      poly: P([[350,60],[620,55],[640,250],[370,265]]) },
  { id: 'a3', type: 'hydroseed', poly: P([[640,60],[850,55],[860,280],[660,285]]) },
  { id: 'a4', type: 'sod',       poly: P([[80,280],[340,270],[360,450],[100,460]]) },
  { id: 'a5', type: 'rock',      poly: P([[360,290],[600,280],[620,470],[380,480]]) },
]

const GRADING_LINES = [
  { id: 'w1', type: 'lime-wall', pts: P([[60,220],[60,500],[280,500]]) },
  { id: 'w2', type: 'lime-wall', pts: P([[620,260],[820,260],[820,460]]) },
  { id: 'w3', type: 'lime-wall', pts: P([[340,460],[600,460]]) },
]

const GRADING_POINTS = makePoints(seededRng(20260624), { tree: 12, shrub: 18, 'lime-block': 9, irrigation: 14 })

// ---- Projects and sheets --------------------------------------------------

export const PROJECTS = {
  'proj-1': {
    id: 'proj-1',
    name: 'Maple Grove Estates',
    client: 'Hilltop Developments',
    status: 'bid_sent',
    bidValue: 48210,
    createdAt: '2026-03-15',
    sheetIds: ['sheet-1', 'sheet-2', 'sheet-3'],
  },
  'proj-2': {
    id: 'proj-2',
    name: 'Riverside Commons',
    client: 'City of Fairview',
    status: 'draft',
    bidValue: 182400,
    createdAt: '2026-04-02',
    sheetIds: ['sheet-4', 'sheet-5', 'sheet-6'],
  },
  'proj-3': {
    id: 'proj-3',
    name: 'Oakmont Clubhouse',
    client: 'Oakmont HOA',
    status: 'won',
    bidValue: 96750,
    createdAt: '2026-02-10',
    sheetIds: ['sheet-7', 'sheet-8'],
  },
  'proj-4': {
    id: 'proj-4',
    name: 'Cedar Park Trailhead',
    client: 'Parks & Rec Dept.',
    status: 'bid_sent',
    bidValue: 31900,
    createdAt: '2026-05-01',
    sheetIds: ['sheet-9'],
  },
  'proj-5': {
    id: 'proj-5',
    name: 'Lakeshore Townhomes',
    client: 'Beacon Living',
    status: 'archived',
    bidValue: 124000,
    createdAt: '2025-11-20',
    sheetIds: ['sheet-10', 'sheet-11'],
  },
}

export const SHEETS = {
  'sheet-1': {
    id: 'sheet-1',
    projectId: 'proj-1',
    name: 'Planting Plan',
    code: 'L-2',
    pxPerFt: null,
    areas: [],
    lines: [],
    points: [],
  },
  'sheet-2': {
    id: 'sheet-2',
    projectId: 'proj-1',
    name: 'Irrigation Plan',
    code: 'I-1',
    pxPerFt: null,
    areas: [],
    lines: [],
    points: [],
  },
  'sheet-3': {
    id: 'sheet-3',
    projectId: 'proj-1',
    name: 'Grading & Drainage',
    code: 'G-1',
    pxPerFt: null,
    areas: [],
    lines: [],
    points: [],
  },
  'sheet-4': {
    id: 'sheet-4',
    projectId: 'proj-2',
    name: 'Planting Plan',
    code: 'L-1',
    pxPerFt: null,
    areas: [],
    lines: [],
    points: [],
  },
  'sheet-5': {
    id: 'sheet-5',
    projectId: 'proj-2',
    name: 'Irrigation Plan',
    code: 'I-1',
    pxPerFt: null,
    areas: [],
    lines: [],
    points: [],
  },
  'sheet-6': {
    id: 'sheet-6',
    projectId: 'proj-2',
    name: 'Site Details',
    code: 'D-1',
    pxPerFt: null,
    areas: [],
    lines: [],
    points: [],
  },
  'sheet-7': {
    id: 'sheet-7',
    projectId: 'proj-3',
    name: 'Planting Plan',
    code: 'L-1',
    pxPerFt: null,
    areas: [],
    lines: [],
    points: [],
  },
  'sheet-8': {
    id: 'sheet-8',
    projectId: 'proj-3',
    name: 'Grading',
    code: 'G-1',
    pxPerFt: null,
    areas: [],
    lines: [],
    points: [],
  },
  'sheet-9': {
    id: 'sheet-9',
    projectId: 'proj-4',
    name: 'Site Plan',
    code: 'SP-1',
    pxPerFt: null,
    areas: [],
    lines: [],
    points: [],
  },
  'sheet-10': {
    id: 'sheet-10',
    projectId: 'proj-5',
    name: 'Planting Plan',
    code: 'L-1',
    pxPerFt: null,
    areas: [],
    lines: [],
    points: [],
  },
  'sheet-11': {
    id: 'sheet-11',
    projectId: 'proj-5',
    name: 'Irrigation',
    code: 'I-1',
    pxPerFt: null,
    areas: [],
    lines: [],
    points: [],
  },
}

export const STATUS_LABEL = {
  draft: 'Draft',
  bid_sent: 'Bid sent',
  won: 'Won',
  archived: 'Archived',
}

export const STATUS_VARIANT = {
  draft: 'warning',
  bid_sent: 'success',
  won: 'brand',
  archived: 'neutral',
}

// Material categories
export const CATS = [
  { id: 'tree',       name: 'Trees',            kind: 'point'  },
  { id: 'shrub',      name: 'Shrubs',           kind: 'point'  },
  { id: 'lime-block', name: 'Limestone blocks', kind: 'point'  },
  { id: 'irrigation', name: 'Irrigation items', kind: 'point'  },
  { id: 'sod',        name: 'Sod areas',        kind: 'area'   },
  { id: 'rock',       name: 'Rock areas',       kind: 'area'   },
  { id: 'hydroseed',  name: 'Hydroseed areas',  kind: 'area'   },
  { id: 'lime-wall',  name: 'Limestone walls',  kind: 'linear' },
]

export const CAT_COLOR = {
  tree:       'var(--mat-tree)',
  shrub:      'var(--mat-shrub)',
  'lime-block': 'var(--mat-lime-block)',
  irrigation: 'var(--mat-irrigation)',
  sod:        'var(--mat-sod)',
  rock:       'var(--mat-rock)',
  hydroseed:  'var(--mat-hydroseed)',
  'lime-wall': 'var(--mat-lime-wall)',
}

// ---- Seed the demo sheets with the sample plan geometry -------------------
// The PLANTING_*/IRRIGATION_*/GRADING_* constants above are defined but unused.
// Wire them into the matching sheets so a customer sees a real, colored takeoff
// the instant a sheet opens. We populate BOTH the top-level areas/lines/points
// (used by sheet thumbnails + base canvas layers) AND the group-model fields
// (savedAreas / savedLines / savedCountGroups) that SheetPage actually renders
// on the main canvas, along with their groups for the layers/MTO panels.

const CAT_NAME = Object.fromEntries(CATS.map(c => [c.id, c.name]))

function buildSheetSeed(areas, lines, points) {
  const areaTypes = [...new Set(areas.map(a => a.type))]
  const lineTypes = [...new Set(lines.map(l => l.type))]
  const pointTypes = [...new Set(points.map(p => p.type))]

  const savedAreaGroups = areaTypes.map(t => ({
    id: `ag-${t}`, name: CAT_NAME[t] || t, color: CAT_COLOR[t], areas: [],
  }))
  const savedLinearGroups = lineTypes.map(t => ({
    id: `lg-${t}`, name: CAT_NAME[t] || t, color: CAT_COLOR[t], lines: [],
  }))
  // Use a distinct id namespace (sp-) for the seeded count-group points so they
  // never collide with sheet.points (pt-) when SheetPage renders allPoints and
  // triggers React "duplicate key" warnings.
  const spPoints = points.map((p, i) => ({
    id: `sp-${i}`, type: p.type, x: p.x, y: p.y,
  }))
  const savedCountGroups = pointTypes.map(t => ({
    id: `cg-${t}`,
    name: CAT_NAME[t] || t,
    color: CAT_COLOR[t],
    shape: 'circle',
    points: spPoints
      .filter(p => p.type === t)
      .map(p => ({ id: p.id, type: p.type, name: CAT_NAME[t] || t, x: p.x, y: p.y })),
  }))

  const savedAreas = areas.map(a => ({
    id: a.id, groupId: `ag-${a.type}`, type: a.type,
    name: CAT_NAME[a.type] || a.type, color: CAT_COLOR[a.type],
    poly: a.poly, arcSegs: {},
  }))
  const savedLines = lines.map(l => ({
    id: l.id, groupId: `lg-${l.type}`, type: l.type,
    name: CAT_NAME[l.type] || l.type, color: CAT_COLOR[l.type],
    pts: l.pts, arcSegs: {},
  }))

  return {
    // Top-level fields → thumbnails + base canvas layers.
    // Use a SEPARATE id namespace (bp-) from the count-group points (sp-) so
    // that when SheetPage renders allPoints = sheet.points + addedPoints, the
    // two collections never share a React key.
    areas:  areas.map(a => ({ id: a.id, type: a.type, poly: a.poly })),
    lines:  lines.map(l => ({ id: l.id, type: l.type, pts: l.pts })),
    points: points.map((p, i) => ({ id: `bp-${i}`, type: p.type, x: p.x, y: p.y })),
    // Group-model fields → main SheetPage canvas + layers/MTO panels
    savedAreaGroups,
    savedAreas,
    savedLinearGroups,
    savedLines,
    savedCountGroups,
  }
}

SHEETS['sheet-1'] = { ...SHEETS['sheet-1'], ...buildSheetSeed(PLANTING_AREAS, PLANTING_LINES, PLANTING_POINTS) }
SHEETS['sheet-2'] = { ...SHEETS['sheet-2'], ...buildSheetSeed(IRRIGATION_AREAS, IRRIGATION_LINES, IRRIGATION_POINTS) }
SHEETS['sheet-3'] = { ...SHEETS['sheet-3'], ...buildSheetSeed(GRADING_AREAS, GRADING_LINES, GRADING_POINTS) }
