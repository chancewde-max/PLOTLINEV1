import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Minus, Plus, Hand, SquareDashed, Spline, MapPin,
  Ruler, Lasso, Eye, EyeOff, Check, TriangleAlert, Sun, Moon,
  Settings2, FileDown, Share2, ChevronRight, Eraser, Sparkles,
  X as XIcon, Map, Pencil, Trash2, MousePointer2, Layers, Download,
} from 'lucide-react'
import { Button } from '../components/ui/Button.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Dialog } from '../components/ui/Dialog.jsx'
import { Input } from '../components/ui/Input.jsx'
import { Select } from '../components/ui/Select.jsx'
import { Checkbox } from '../components/ui/Checkbox.jsx'
import { Tabs } from '../components/ui/Tabs.jsx'
import { Tooltip } from '../components/ui/Tooltip.jsx'
import { useAppData } from '../data/useAppData.jsx'
import { useSettings } from '../data/useSettings.jsx'
import PdfCanvas from '../components/PdfCanvas.jsx'
import { CATS, CAT_COLOR, SHEET_W, SHEET_H } from '../data/sampleData.js'
import { inside, polyAreaPx, perimPx, centroid, clipPx2, dist } from '../workspace/geometry.js'
import s from './SheetPage.module.css'

const TOOLS = [
  { id: 'select', label: 'Select',       Icon: MousePointer2, k: 'V' },
  { id: 'pan',    label: 'Pan',          Icon: Hand,          k: 'H' },
  { id: 'region', label: 'Region count', Icon: Lasso,         k: 'R' },
  { id: 'measure',label: 'Measure',      Icon: Ruler,         k: 'M' },
  'sep',
  { id: 'area',   label: 'Area',         Icon: SquareDashed,  k: 'A' },
  { id: 'linear', label: 'Linear',       Icon: Spline,        k: 'L' },
  { id: 'count',  label: 'Count',        Icon: MapPin,        k: 'C' },
]

const ACCENTS = {
  // SheetPage keys — kept in sync with ProjectsPage accent ids
  green:  { 50:'#eef7f2', 500:'#258c62', 600:'#157a52', 700:'#0f6243', label:'Green' },
  blue:   { 50:'#e8f0fe', 500:'#3b82f6', 600:'#2563eb', 700:'#1d4ed8', label:'Blue' },
  violet: { 50:'#f1ebfe', 500:'#8b5cf6', 600:'#7c3aed', 700:'#6d28d9', label:'Violet' },
  rose:   { 50:'#fde8ef', 500:'#f43f5e', 600:'#e11d48', 700:'#be123c', label:'Rose' },
  amber:  { 50:'#fdf4e3', 500:'#f59e0b', 600:'#d97706', 700:'#b45309', label:'Amber' },
  // Legacy aliases so old localStorage values don't crash
  pine:   { 50:'#eef7f2', 500:'#258c62', 600:'#157a52', 700:'#0f6243', label:'Green' },
  ocean:  { 50:'#e8f0fe', 500:'#3b82f6', 600:'#2563eb', 700:'#1d4ed8', label:'Blue' },
  slate:  { 50:'#eef1f4', 500:'#64748b', 600:'#475569', 700:'#334155', label:'Slate' },
}

const UNIT_FT = { ft: 1, in: 1/12, yd: 3, m: 3.28084 }
const SAMPLE_REGION = [
  { x:150, y:120 }, { x:470, y:110 }, { x:560, y:360 }, { x:430, y:500 }, { x:160, y:470 }
]
const DEFAULT_PXFT = 4
const NEAR = 16
const FIT = 0.72
const FOLDER_PALETTE = ['#157a52','#2563eb','#7c3aed','#d97706','#dc2626','#0891b2']

const COUNT_COLORS = ['#258c62','#2563eb','#7c3aed','#d97706','#dc2626','#0891b2','#db2777','#65a30d','#ea580c','#6366f1']
const randColor = () => COUNT_COLORS[Math.floor(Math.random() * COUNT_COLORS.length)]

const AREA_CATS   = CATS.filter(c => c.kind === 'area')
const COUNT_CATS  = CATS.filter(c => c.kind === 'point')
const LINEAR_CATS = CATS.filter(c => c.kind === 'linear')

function singularize(name) {
  return name.replace(/s\s*$/, '').trim()
}

// True circular arc SVG segment through 3 points S, T (through-point), E
function circularArcSeg(S, T, E) {
  // Find circumcircle of S, T, E
  const ax = S.x, ay = S.y, bx = T.x, by = T.y, cx = E.x, cy = E.y
  const D = 2 * (ax*(by-cy) + bx*(cy-ay) + cx*(ay-by))
  if (Math.abs(D) < 1e-10) return ` L ${E.x} ${E.y}` // collinear → straight line
  const ux = ((ax*ax+ay*ay)*(by-cy) + (bx*bx+by*by)*(cy-ay) + (cx*cx+cy*cy)*(ay-by)) / D
  const uy = ((ax*ax+ay*ay)*(cx-bx) + (bx*bx+by*by)*(ax-cx) + (cx*cx+cy*cy)*(bx-ax)) / D
  const r = Math.hypot(ax-ux, ay-uy)
  // Determine sweep: cross product (S→T) × (S→E) > 0 → counter-clockwise
  const cross = (bx-ax)*(cy-ay) - (by-ay)*(cx-ax)
  const sweep = cross > 0 ? 1 : 0
  // Large arc: if T is on the major arc (center is on same side as T relative to SE)
  const midSE = { x: (ax+cx)/2, y: (ay+cy)/2 }
  const tSide = (bx-midSE.x)*(uy-midSE.y) - (by-midSE.y)*(ux-midSE.x)
  const large = tSide < 0 ? 0 : 1
  return ` A ${r} ${r} 0 ${large} ${sweep} ${E.x} ${E.y}`
}

function buildAreaPath(poly, arcSegs = {}) {
  if (!poly || poly.length < 2) return ''
  let d = `M ${poly[0].x} ${poly[0].y}`
  for (let i = 1; i < poly.length; i++) {
    const S = poly[i - 1], E = poly[i]
    if (arcSegs[i - 1]) d += circularArcSeg(S, arcSegs[i - 1], E)
    else d += ` L ${E.x} ${E.y}`
  }
  const last = poly[poly.length - 1], first = poly[0]
  const closeIdx = poly.length - 1
  if (arcSegs[closeIdx]) d += circularArcSeg(last, arcSegs[closeIdx], first)
  return d + ' Z'
}

function buildLinePath(pts, arcSegs = {}) {
  if (!pts || pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const S = pts[i - 1], E = pts[i]
    if (arcSegs[i - 1]) d += circularArcSeg(S, arcSegs[i - 1], E)
    else d += ` L ${E.x} ${E.y}`
  }
  return d
}

export default function SheetPage() {
  const { projectId, sheetId } = useParams()
  const navigate = useNavigate()
  const { projects, sheets, updateSheet, addRegion, updateRegion, deleteRegion } = useAppData()
  const { theme, setTheme, accent, setAccent } = useSettings()

  // ---- UI state ----
  const [fs, setFs]             = useState(1)
  const [settings, setSettings] = useState(false)
  const [zoom, setZoom]         = useState(100)
  const [panOffset, setPanOffset]   = useState({ x: 0, y: 0 })
  const [leftPanelW, setLeftPanelW]   = useState(264)
  const [rightPanelW, setRightPanelW] = useState(320)
  const [activeTool, setActiveTool] = useState('region')
  const [leftPanel, setLeftPanel]   = useState('layers')
  const [hidden, setHidden]     = useState({})
  // ---- Display settings ----
  const [dotSize, setDotSize]     = useState(3)   // count dot radius (svg units)
  const [strokeW, setStrokeW]     = useState(1)   // area/linear stroke multiplier
  const [measureSize, setMeasureSize] = useState(1) // measure label/tick size multiplier
  const [exportOpen, setExportOpen] = useState(false)
  const [quoteOpen, setQuoteOpen]   = useState(false)
  const [quoteVendor, setQuoteVendor] = useState('')
  const [quoteCopied, setQuoteCopied] = useState(false)
  const [toast, setToast]       = useState(null)

  // ---- Scale ----
  const [pxPerFt, setPxPerFt]   = useState(DEFAULT_PXFT)
  const [calib, setCalib]       = useState(null)
  const [scalePts, setScalePts]     = useState([])
  const [scaleDlg, setScaleDlg]     = useState(null)
  const [scaleVal, setScaleVal]     = useState('40')
  const [scaleUnit, setScaleUnit]   = useState('ft')

  // ---- Region tool ----
  const [regionVerts, setRegionVerts]   = useState([])
  const [regionClosed, setRegionClosed] = useState(null)
  const [regionCursor, setRegionCursor] = useState(null)
  const [catActive, setCatActive]   = useState(() => new Set(CATS.map(c => c.id)))
  // folders = project.regions enriched with this sheet's poly
  const [activeFolderId, setActiveFolderId] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameVal, setRenameVal]   = useState('')

  // ---- Measure tool ----
  const [measureSessions, setMeasureSessions] = useState([]) // completed measurement lines [{pts, color}]
  const [measurePts, setMeasurePts]     = useState([])
  const [measureDone, setMeasureDone]   = useState(false)
  const [measureCursor, setMeasureCursor] = useState(null)
  const [measureColor, setMeasureColor] = useState('#e11d48')

  // ---- Area tool ----
  const [areaVerts, setAreaVerts]   = useState([])
  const [areaCursor, setAreaCursor] = useState(null)
  const [areaType, setAreaType]     = useState(AREA_CATS[0]?.id || 'sod')
  const [addedAreas, setAddedAreas] = useState(() => sheets[sheetId]?.savedAreas || [])
  const [areaDepth, setAreaDepth]   = useState('') // inches
  const [topsoilType, setTopsoilType] = useState('none')
  const [topsoilCustom, setTopsoilCustom] = useState('')

  // ---- Linear tool ----
  const [linearVerts, setLinearVerts]   = useState([])
  const [linearCursor, setLinearCursor] = useState(null)
  const [linearType, setLinearType]     = useState(LINEAR_CATS[0]?.id || 'lime-wall')
  const [addedLines, setAddedLines]     = useState(() => sheets[sheetId]?.savedLines || [])

  // ---- Arc mode (shared for area + linear) ----
  const [arcMode, setArcMode]               = useState(false)
  const [pendingArcThrough, setPendingArcThrough] = useState(null)
  const arcSegsRef = useRef({})         // for current area drawing
  const linearArcSegsRef = useRef({})  // for current linear drawing

  // ---- Count tool ----
  const [addCountType, setAddCountType] = useState(COUNT_CATS[0]?.id || 'tree')
  const [countGroups, setCountGroups]   = useState(() => sheets[sheetId]?.savedCountGroups || [])
  const [activeCountGroupId, setActiveCountGroupId] = useState(null)
  const countGroupNumRef = useRef(0)
  // ---- Linear groups (like count groups) ----
  const [linearGroups, setLinearGroups] = useState(() => sheets[sheetId]?.savedLinearGroups || [])
  const [activeLinearGroupId, setActiveLinearGroupId] = useState(null)
  const linearGroupNumRef = useRef(0)
  // ---- Area groups ----
  const [areaGroups, setAreaGroups]     = useState(() => sheets[sheetId]?.savedAreaGroups || [])
  const [activeAreaGroupId, setActiveAreaGroupId] = useState(null)
  const areaGroupNumRef = useRef(0)
  // ---- New count/area/linear dialog ----
  const [newCountDlg, setNewCountDlg]   = useState(false)  // 'count' | 'area' | 'linear' | false
  const [newItemName, setNewItemName]   = useState('')
  const [newItemColor, setNewItemColor] = useState('#258c62')
  const [newItemShape, setNewItemShape] = useState('circle')
  // ---- Edit group popup ----
  const [editGroupDlg, setEditGroupDlg] = useState(null)  // { kind, group } | null
  const [eName, setEName] = useState('')
  const [eColor, setEColor] = useState('')
  const [eShape, setEShape] = useState('circle')
  const [eDepth, setEDepth] = useState('')
  const [eTopsoil, setETopsoil] = useState('none')
  const [eTopsoilCustom, setETopsoilCustom] = useState('')

  const openEditGroup = (kind, group) => {
    setEName(group.name)
    setEColor(group.color)
    setEShape(group.shape || 'circle')
    setEDepth(group.depth || '')
    setETopsoil(group.topsoil || 'none')
    setETopsoilCustom(group.topsoilCustom || '')
    setEditGroupDlg({ kind, group })
  }

  const saveEditGroup = () => {
    if (!editGroupDlg) return
    const { kind, group } = editGroupDlg
    if (kind === 'count') {
      setCountGroups(prev => prev.map(g => g.id === group.id
        ? { ...g, name: eName, color: eColor, shape: eShape, points: g.points.map(p => ({ ...p, color: eColor })) }
        : g))
    } else if (kind === 'linear') {
      setLinearGroups(prev => prev.map(g => g.id === group.id ? { ...g, name: eName, color: eColor } : g))
      setAddedLines(prev => prev.map(l => l.groupId === group.id ? { ...l, color: eColor, name: eName } : l))
    } else if (kind === 'area') {
      setAreaGroups(prev => prev.map(g => g.id === group.id ? { ...g, name: eName, color: eColor, depth: eDepth, topsoil: eTopsoil, topsoilCustom: eTopsoilCustom } : g))
      setAddedAreas(prev => prev.map(a => a.groupId === group.id ? { ...a, color: eColor, name: eName } : a))
    }
    setEditGroupDlg(null)
  }

  // ---- Snapping ----
  const [snapEnabled, setSnapEnabled]   = useState(false)
  const [orthoEnabled, setOrthoEnabled] = useState(false)

  // ---- Page overlay ----
  const [overlaySheetId, setOverlaySheetId] = useState(null)  // which sheet to overlay
  const [overlayOpacity, setOverlayOpacity] = useState(0.4)
  const [overlayOffset, setOverlayOffset]   = useState({ x: 0, y: 0 })
  const [overlayScale, setOverlayScale]     = useState(1)
  const [overlayDlg, setOverlayDlg]         = useState(false)
  const overlayDragRef = useRef(null)

  // ---- Undo stack ----
  const undoStackRef = useRef([])

  // flat list of all placed points from all count groups
  const addedPoints = countGroups.flatMap(g => g.points)

  // ---- Selection tool ----
  const [selectedId, setSelectedId]     = useState(null)
  const [selectedKind, setSelectedKind] = useState(null)
  const [selectedIds, setSelectedIds]   = useState([]) // multi-select from box drag
  const [boxSelect, setBoxSelect]       = useState(null) // { x1,y1,x2,y2 } in sheet coords
  const isDraggingRef    = useRef(false)
  const dragStartRef     = useRef(null)
  const origDragRef      = useRef(null)
  const dragVertIdxRef   = useRef(null)
  const dragAreaIdRef    = useRef(null)
  const dragRegionVertRef = useRef(null) // index of region vertex being dragged
  const panStartRef      = useRef(null) // for pan tool
  const panOriginRef     = useRef(null)
  const isPanningRef     = useRef(false)

  // ---- Name counters ----
  const nameCountRef = useRef({})

  // ---- Refs ----
  const svgRef    = useRef(null)
  const canvasRef = useRef(null)

  const project = projects[projectId]
  const sheet   = sheets[sheetId]

  // ---- Smooth zoom to cursor ----
  const zoomTargetRef   = useRef(100)
  const panTargetRef    = useRef({ x: 0, y: 0 })
  const zoomCurrentRef  = useRef(100)
  const panCurrentRef   = useRef({ x: 0, y: 0 })
  const zoomRafRef      = useRef(null)

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const delta = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaMode === 2 ? e.deltaY * 300 : e.deltaY
      const factor = Math.pow(0.999, delta)
      const oldZ = zoomTargetRef.current
      const newZ = Math.max(25, Math.min(1600, oldZ * factor))
      zoomTargetRef.current = newZ
      // Zoom to cursor: adjust pan target so point under cursor stays fixed
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left - rect.width / 2
      const cy = e.clientY - rect.top - rect.height / 2
      const ratio = newZ / oldZ
      panTargetRef.current = {
        x: cx - (cx - panTargetRef.current.x) * ratio,
        y: cy - (cy - panTargetRef.current.y) * ratio,
      }
      // Single RAF loop that animates zoom + pan together
      if (!zoomRafRef.current) {
        const animate = () => {
          const z  = zoomCurrentRef.current
          const px = panCurrentRef.current.x
          const py = panCurrentRef.current.y
          const tz = zoomTargetRef.current
          const tx = panTargetRef.current.x
          const ty = panTargetRef.current.y
          const EPS = 0.08
          const dz = Math.abs(tz - z), dx = Math.abs(tx - px), dy = Math.abs(ty - py)
          if (dz < EPS && dx < EPS && dy < EPS) {
            zoomCurrentRef.current = tz
            panCurrentRef.current  = { x: tx, y: ty }
            setZoom(tz)
            setPanOffset({ x: tx, y: ty })
            zoomRafRef.current = null
            return
          }
          const EASE = 0.18
          const nz = z + (tz - z) * EASE
          const nx = px + (tx - px) * EASE
          const ny = py + (ty - py) * EASE
          zoomCurrentRef.current = nz
          panCurrentRef.current  = { x: nx, y: ny }
          setZoom(nz)
          setPanOffset({ x: nx, y: ny })
          zoomRafRef.current = requestAnimationFrame(animate)
        }
        zoomRafRef.current = requestAnimationFrame(animate)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => { el.removeEventListener('wheel', onWheel); if (zoomRafRef.current) cancelAnimationFrame(zoomRafRef.current) }
  }, [])

  // Global mouseup to end pan/box-select
  useEffect(() => {
    const up = () => { isPanningRef.current = false }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  // Persist drawing data after every change
  useEffect(() => { if (sheetId) updateSheet(sheetId, { savedCountGroups: countGroups }) }, [countGroups])
  useEffect(() => { if (sheetId) updateSheet(sheetId, { savedLinearGroups: linearGroups }) }, [linearGroups])
  useEffect(() => { if (sheetId) updateSheet(sheetId, { savedAreaGroups: areaGroups }) }, [areaGroups])
  useEffect(() => { if (sheetId) updateSheet(sheetId, { savedAreas: addedAreas }) }, [addedAreas])
  useEffect(() => { if (sheetId) updateSheet(sheetId, { savedLines: addedLines }) }, [addedLines])

  // Save active region poly to sheet whenever regionClosed changes
  useEffect(() => {
    if (!sheetId || !activeFolderId) return
    updateSheet(sheetId, {
      regionPolys: { ...(sheet?.regionPolys || {}), [activeFolderId]: regionClosed },
    })
  }, [regionClosed, activeFolderId])

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    if (!project || !sheet) return
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const key = e.key.toUpperCase()
      if (key === 'V') setActiveTool('select')
      if (key === 'H') setActiveTool('pan')
      if (key === 'R') setActiveTool('region')
      if (key === 'M') setActiveTool('measure')
      if (key === 'L') {
        setNewItemName(`Linear ${linearGroupNumRef.current + 1}`)
        setNewItemColor(randColor()); setNewItemShape('circle')
        setNewCountDlg('linear')
      }
      if (key === 'C') {
        setNewItemName(`Count ${countGroupNumRef.current + 1}`)
        setNewItemColor(randColor())
        setNewCountDlg('count')
      }
      if (key === 'A' && activeTool !== 'area' && activeTool !== 'linear') {
        setNewItemName(`Area ${areaGroupNumRef.current + 1}`)
        setNewItemColor(randColor())
        setNewCountDlg('area')
      }
      if (e.key === 'F3') { e.preventDefault(); setSnapEnabled(v => !v) }
      if (e.key === 'F8') { e.preventDefault(); setOrthoEnabled(v => !v) }
      if (e.ctrlKey && key === 'Z') {
        e.preventDefault()
        const stack = undoStackRef.current
        if (stack.length > 0) {
          const last = stack[stack.length - 1]
          undoStackRef.current = stack.slice(0, -1)
          if (last.type === 'area') setAddedAreas(last.state)
          if (last.type === 'line') setAddedLines(last.state)
          if (last.type === 'countGroups') setCountGroups(last.state)
        }
      }
      if (key === 'A') {
        // If drawing area or linear: toggle arc mode; otherwise switch to area tool
        if ((activeTool === 'area' && areaVerts.length > 0) ||
            (activeTool === 'linear' && linearVerts.length > 0)) {
          setArcMode(v => {
            if (v) setPendingArcThrough(null)
            return !v
          })
        } else {
          setActiveTool('area')
        }
      }
      if (key === 'ESCAPE') {
        setRegionVerts([]); setRegionClosed(null); setRegionCursor(null)
        setScalePts([]); setScaleDlg(null)
        setMeasurePts([]); setMeasureDone(false); setMeasureCursor(null); setMeasureSessions([])
        setAreaVerts([]); setAreaCursor(null)
        setLinearVerts([]); setLinearCursor(null)
        setArcMode(false); setPendingArcThrough(null)
        arcSegsRef.current = {}; linearArcSegsRef.current = {}
        setSettings(false)
        setSelectedId(null); setSelectedKind(null)
      }
    }
    const onEnter = (e) => {
      if (e.key !== 'Enter') return
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (activeTool === 'region') {
        setRegionClosed(v => v === null
          ? (regionVerts.length >= 3 ? regionVerts : null)
          : v)
      }
      if (activeTool === 'measure' && !measureDone && measurePts.length >= 2) {
        // Save current session and start a new one
        setMeasureSessions(prev => [...prev, { pts: measurePts, color: measureColor }])
        setMeasurePts([]); setMeasureCursor(null)
      }
      if (activeTool === 'area' && areaVerts.length >= 3) finishArea()
      if (activeTool === 'linear' && linearVerts.length >= 2) finishLine()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keydown', onEnter)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keydown', onEnter)
    }
  }, [project, sheet, activeTool, regionVerts, measureDone, measurePts, areaVerts, areaType, linearVerts, linearType, arcMode])

  if (!project || !sheet) {
    return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Sheet not found.</div>
  }

  // ---- Helpers ----
  const genName = (catId) => {
    const cat = CATS.find(c => c.id === catId)
    if (!cat) return catId
    nameCountRef.current[catId] = (nameCountRef.current[catId] || 0) + 1
    return `${singularize(cat.name)} ${nameCountRef.current[catId]}`
  }

  const allAreas  = [...(sheet.areas  || []), ...addedAreas]
  const allPoints = [...(sheet.points || []), ...addedPoints]
  const allLines  = [...(sheet.lines  || []), ...addedLines]

  const toSheet = (e) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    const m = svg.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    return pt.matrixTransform(m.inverse())
  }

  const applySnap = (p, prevPt) => {
    let { x, y } = p
    // Ortho snap: lock to horizontal or vertical from last point
    if (orthoEnabled && prevPt) {
      const dx = Math.abs(x - prevPt.x), dy = Math.abs(y - prevPt.y)
      if (dx > dy) y = prevPt.y; else x = prevPt.x
    }
    // Snap to placed vertices (area verts, linear verts, existing poly vertices)
    if (snapEnabled) {
      const SNAP_DIST = 12
      const snapCandidates = [
        ...addedAreas.flatMap(a => a.poly),
        ...addedLines.flatMap(l => l.pts || []),
        ...countGroups.flatMap(g => g.points),
        ...areaVerts,
        ...linearVerts,
      ]
      let best = null, bestD = SNAP_DIST
      for (const c of snapCandidates) {
        const d = Math.hypot(c.x - x, c.y - y)
        if (d < bestD) { bestD = d; best = c }
      }
      if (best) { x = best.x; y = best.y }
    }
    return { x, y }
  }

  const finishArea = () => {
    if (areaVerts.length < 3) return
    const capturedArcSegs = { ...arcSegsRef.current }
    const capturedVerts = [...areaVerts]
    const grp = areaGroups.find(g => g.id === activeAreaGroupId)
    setAddedAreas(prev => {
      undoStackRef.current = [...undoStackRef.current.slice(-19), { type: 'area', state: prev }]
      return [...prev, {
        id: `ua-${Date.now()}`,
        groupId: activeAreaGroupId || null,
        type: areaType,
        name: grp?.name || genName(areaType),
        color: grp?.color || null,
        poly: capturedVerts,
        arcSegs: capturedArcSegs,
      }]
    })
    setAreaVerts([]); setAreaCursor(null)
    setArcMode(false); setPendingArcThrough(null)
    arcSegsRef.current = {}
  }

  const finishLine = () => {
    if (linearVerts.length < 2) return
    const capturedArcSegs = { ...linearArcSegsRef.current }
    const capturedVerts = [...linearVerts]
    const grp = linearGroups.find(g => g.id === activeLinearGroupId)
    setAddedLines(prev => {
      undoStackRef.current = [...undoStackRef.current.slice(-19), { type: 'line', state: prev }]
      return [...prev, {
        id: `ul-${Date.now()}`,
        groupId: activeLinearGroupId || null,
        type: linearType,
        name: grp?.name || genName(linearType),
        color: grp?.color || null,
        pts: capturedVerts,
        arcSegs: capturedArcSegs,
      }]
    })
    setLinearVerts([]); setLinearCursor(null)
    setArcMode(false); setPendingArcThrough(null)
    linearArcSegsRef.current = {}
  }

  // ---- Event handlers ----
  const onContextMenu = (e) => { e.preventDefault() }
  const onMouseDown = (e) => {
    // Right-click always pans (except pan tool uses left click)
    if (e.button === 2) {
      isPanningRef.current = true
      panStartRef.current = { x: e.clientX, y: e.clientY }
      panOriginRef.current = { x: panOffset.x, y: panOffset.y }
      return
    }
    if (activeTool === 'pan') {
      isPanningRef.current = true
      panStartRef.current = { x: e.clientX, y: e.clientY }
      panOriginRef.current = { ...panOffset }
      return
    }
    if (activeTool !== 'select') return
    const p = toSheet(e)
    // Check added points first
    for (let i = addedPoints.length - 1; i >= 0; i--) {
      const pt = addedPoints[i]
      if (dist(p, { x: pt.x, y: pt.y }) < 10) {
        setSelectedId(pt.id); setSelectedKind('point')
        isDraggingRef.current = true
        dragStartRef.current = p
        origDragRef.current = { x: pt.x, y: pt.y }
        return
      }
    }
    // Check added area vertices, then interiors
    for (let i = addedAreas.length - 1; i >= 0; i--) {
      const a = addedAreas[i]
      for (let j = 0; j < a.poly.length; j++) {
        if (dist(p, a.poly[j]) < 8) {
          setSelectedId(a.id); setSelectedKind('area')
          isDraggingRef.current = true
          dragStartRef.current = p
          origDragRef.current = a.poly[j]
          dragVertIdxRef.current = j
          dragAreaIdRef.current = a.id
          return
        }
      }
      if (inside(p, a.poly)) {
        setSelectedId(a.id); setSelectedKind('area')
        isDraggingRef.current = true
        dragStartRef.current = p
        origDragRef.current = a.poly.map(v => ({ ...v }))
        dragVertIdxRef.current = null
        dragAreaIdRef.current = a.id
        return
      }
    }
    // Check added lines
    for (let i = addedLines.length - 1; i >= 0; i--) {
      const l = addedLines[i]
      for (let j = 0; j < l.pts.length; j++) {
        if (dist(p, l.pts[j]) < 10) {
          setSelectedId(l.id); setSelectedKind('line')
          isDraggingRef.current = true
          dragStartRef.current = p
          origDragRef.current = l.pts[j]
          dragVertIdxRef.current = j
          dragAreaIdRef.current = l.id
          return
        }
      }
    }
    // Start box select on empty space
    setSelectedId(null); setSelectedKind(null)
    setBoxSelect({ x1: p.x, y1: p.y, x2: p.x, y2: p.y })
  }

  const onMouseMove = (e) => {
    // Pan: right-button drag or pan tool left-button drag
    if (isPanningRef.current && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x
      const dy = e.clientY - panStartRef.current.y
      const np = { x: panOriginRef.current.x + dx, y: panOriginRef.current.y + dy }
      panTargetRef.current = np; panCurrentRef.current = np
      setPanOffset(np)
      if (activeTool === 'pan' || e.buttons === 2) return
    }
    const rawP = toSheet(e)
    const prevMove = activeTool === 'area' && areaVerts.length > 0 ? areaVerts[areaVerts.length - 1]
      : activeTool === 'linear' && linearVerts.length > 0 ? linearVerts[linearVerts.length - 1] : null
    const p = applySnap(rawP, prevMove)
    // Region vertex drag
    if (dragRegionVertRef.current !== null && regionClosed) {
      const idx = dragRegionVertRef.current
      const updated = regionClosed.map((v, i) => i === idx ? { x: rawP.x, y: rawP.y } : v)
      setRegionClosed(updated)
      return
    }
    if (activeTool === 'region' && !regionClosed) setRegionCursor(p)
    if (activeTool === 'measure' && !measureDone && measurePts.length > 0) setMeasureCursor(p)
    if (activeTool === 'scale') setRegionCursor(p)
    if (activeTool === 'area' && (areaVerts.length > 0 || pendingArcThrough)) setAreaCursor(p)
    if (activeTool === 'linear' && (linearVerts.length > 0 || pendingArcThrough)) setLinearCursor(p)

    // Update box select
    if (activeTool === 'select' && boxSelect && !isDraggingRef.current) {
      setBoxSelect(b => b ? { ...b, x2: rawP.x, y2: rawP.y } : null)
    }
    if (activeTool === 'select' && isDraggingRef.current && dragStartRef.current) {
      const dx = p.x - dragStartRef.current.x
      const dy = p.y - dragStartRef.current.y
      if (selectedKind === 'point') {
        const orig = origDragRef.current
        setCountGroups(prev => prev.map(g => ({
          ...g, points: g.points.map(pt =>
            pt.id === selectedId ? { ...pt, x: orig.x + dx, y: orig.y + dy } : pt
          )
        })))
      } else if (selectedKind === 'area') {
        if (dragVertIdxRef.current !== null) {
          // Move single vertex
          const orig = origDragRef.current
          setAddedAreas(prev => prev.map(a =>
            a.id === dragAreaIdRef.current
              ? { ...a, poly: a.poly.map((v, i) => i === dragVertIdxRef.current ? { x: orig.x + dx, y: orig.y + dy } : v) }
              : a
          ))
        } else {
          // Move whole area
          const origPoly = origDragRef.current
          setAddedAreas(prev => prev.map(a =>
            a.id === dragAreaIdRef.current
              ? { ...a, poly: origPoly.map(v => ({ x: v.x + dx, y: v.y + dy })) }
              : a
          ))
        }
      } else if (selectedKind === 'line') {
        const orig = origDragRef.current
        setAddedLines(prev => prev.map(l =>
          l.id === dragAreaIdRef.current
            ? { ...l, pts: l.pts.map((v, i) => i === dragVertIdxRef.current ? { x: orig.x + dx, y: orig.y + dy } : v) }
            : l
        ))
      }
    }
  }

  const onMouseUp = () => {
    isPanningRef.current = false
    isDraggingRef.current = false
    dragVertIdxRef.current = null
    dragAreaIdRef.current = null
    dragRegionVertRef.current = null
    // Finalize box select
    if (boxSelect && activeTool === 'select') {
      const minX = Math.min(boxSelect.x1, boxSelect.x2), maxX = Math.max(boxSelect.x1, boxSelect.x2)
      const minY = Math.min(boxSelect.y1, boxSelect.y2), maxY = Math.max(boxSelect.y1, boxSelect.y2)
      if (maxX - minX > 4 || maxY - minY > 4) {
        const inBox = (pt) => pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY
        const ptIds = addedPoints.filter(p => inBox(p)).map(p => p.id)
        const areaIds = addedAreas.filter(a => a.poly.some(v => inBox(v))).map(a => a.id)
        setSelectedIds([...ptIds, ...areaIds])
      }
      setBoxSelect(null)
    }
  }

  const onClick = (e) => {
    if (isDraggingRef.current) return
    const rawP = toSheet(e)
    const prevPt = activeTool === 'area' && areaVerts.length > 0 ? areaVerts[areaVerts.length - 1]
      : activeTool === 'linear' && linearVerts.length > 0 ? linearVerts[linearVerts.length - 1]
      : null
    const p = applySnap(rawP, prevPt)

    if (activeTool === 'scale') {
      const np = [...scalePts, p]
      if (np.length >= 2) { setScaleDlg({ px: dist(np[0], np[1]) }); setScalePts(np.slice(0, 2)) }
      else setScalePts(np)
      return
    }

    if (activeTool === 'region' && !regionClosed) {
      if (regionVerts.length >= 3 && dist(p, regionVerts[0]) < NEAR) {
        setRegionClosed(regionVerts); setRegionCursor(null)
      } else {
        setRegionVerts(v => [...v, p])
      }
      return
    }

    if (activeTool === 'measure' && !measureDone) {
      setMeasurePts(pts => [...pts, p]); return
    }

    if (activeTool === 'area') {
      // Close on near first vertex
      if (areaVerts.length >= 3 && dist(p, areaVerts[0]) < NEAR && !pendingArcThrough) {
        finishArea(); return
      }
      // Arc: collect through-point
      if (arcMode && !pendingArcThrough && areaVerts.length > 0) {
        setPendingArcThrough(p); return
      }
      // Arc: set endpoint after through-point
      if (pendingArcThrough && areaVerts.length > 0) {
        arcSegsRef.current[areaVerts.length - 1] = pendingArcThrough
        setPendingArcThrough(null); setArcMode(false)
        if (areaVerts.length >= 2 && dist(p, areaVerts[0]) < NEAR) { finishArea(); return }
        setAreaVerts(v => [...v, p]); return
      }
      setAreaVerts(v => [...v, p]); return
    }

    if (activeTool === 'linear') {
      if (arcMode && !pendingArcThrough && linearVerts.length > 0) {
        setPendingArcThrough(p); return
      }
      if (pendingArcThrough && linearVerts.length > 0) {
        linearArcSegsRef.current[linearVerts.length - 1] = pendingArcThrough
        setPendingArcThrough(null); setArcMode(false)
        setLinearVerts(v => [...v, p]); return
      }
      setLinearVerts(v => [...v, p]); return
    }

    if (activeTool === 'count') {
      const newPt = { id: `up-${Date.now()}`, type: addCountType, name: genName(addCountType), x: p.x, y: p.y }
      if (activeCountGroupId) {
        setCountGroups(prev => prev.map(g =>
          g.id === activeCountGroupId ? { ...g, points: [...g.points, newPt] } : g
        ))
      } else {
        // create a new group if none active
        const gid = `cg-${Date.now()}`
        countGroupNumRef.current += 1
        const newGroup = { id: gid, name: `Count ${countGroupNumRef.current}`, type: addCountType, points: [newPt] }
        setCountGroups(prev => [...prev, newGroup])
        setActiveCountGroupId(gid)
      }
    }
  }

  const onDblClick = (e) => {
    if (activeTool === 'region' && !regionClosed && regionVerts.length >= 3) {
      setRegionClosed(regionVerts); setRegionCursor(null)
    }
    if (activeTool === 'measure' && !measureDone && measurePts.length >= 2) {
      setMeasureSessions(prev => [...prev, { pts: measurePts, color: measureColor }])
      setMeasurePts([]); setMeasureCursor(null)
    }
    if (activeTool === 'linear' && linearVerts.length >= 2) finishLine()
    // Insert vertex on double-click near edge of selected area
    if (activeTool === 'select' && selectedArea) {
      const p = toSheet(e)
      const poly = selectedArea.poly
      const threshold = 12 / ((zoom / 100) * FIT)
      let bestDist = Infinity, bestIdx = -1, bestPt = null
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length]
        const dx = b.x - a.x, dy = b.y - a.y
        const len2 = dx*dx + dy*dy
        if (len2 === 0) continue
        const t = Math.max(0, Math.min(1, ((p.x-a.x)*dx + (p.y-a.y)*dy) / len2))
        const nx = a.x + t*dx, ny = a.y + t*dy
        const d = Math.hypot(p.x - nx, p.y - ny)
        if (d < bestDist) { bestDist = d; bestIdx = i; bestPt = { x: nx, y: ny } }
      }
      if (bestIdx !== -1 && bestDist < threshold) {
        const newPoly = [...poly.slice(0, bestIdx + 1), bestPt, ...poly.slice(bestIdx + 1)]
        setAddedAreas(prev => prev.map(a => a.id === selectedId ? { ...a, poly: newPoly } : a))
        e.stopPropagation()
      }
    }
  }

  // ---- Selection callbacks ----
  const renameSelected = (id, kind, newName) => {
    if (kind === 'area') setAddedAreas(prev => prev.map(a => a.id === id ? { ...a, name: newName } : a))
    else if (kind === 'point') setCountGroups(prev => prev.map(g => ({ ...g, points: g.points.map(p => p.id === id ? { ...p, name: newName } : p) })))
    else if (kind === 'line') setAddedLines(prev => prev.map(l => l.id === id ? { ...l, name: newName } : l))
  }
  const deleteSelected = (id, kind) => {
    if (kind === 'area') setAddedAreas(prev => prev.filter(a => a.id !== id))
    else if (kind === 'point') setCountGroups(prev => prev.map(g => ({ ...g, points: g.points.filter(p => p.id !== id) })))
    else if (kind === 'line') setAddedLines(prev => prev.filter(l => l.id !== id))
    setSelectedId(null); setSelectedKind(null)
  }

  // ---- Tool activation from panel ----
  const activateType = (kind, typeId) => {
    if (kind === 'point') { setAddCountType(typeId); setActiveTool('count') }
    else if (kind === 'area') { setAreaType(typeId); setActiveTool('area') }
    else if (kind === 'linear') { setLinearType(typeId); setActiveTool('linear') }
  }

  // ---- Geometry ----
  const regionPoly = regionClosed || regionVerts
  const hasRegion  = regionPoly.length >= 3
  const isDrawingRegion = activeTool === 'region' && !regionClosed

  const previewPoly = isDrawingRegion && regionVerts.length > 0
    ? [...regionVerts, ...(regionCursor ? [regionCursor] : [])]
    : regionPoly

  const sqft = (px2) => px2 / (pxPerFt * pxPerFt)
  const lnft = (px)  => px  / pxPerFt
  const fSq  = (n)   => (Math.round(n / 5) * 5).toLocaleString()
  const fLn  = (n)   => Math.round(n).toLocaleString()
  // Scale marker sizes proportionally to plan scale so they look right at any calibration
  const mk = pxPerFt * 0.25
  // Zoom-invariant unit: 1 screen pixel in SVG coords regardless of CSS zoom
  const u = 1 / ((zoom / 100) * FIT)

  const regionRes = {}
  const inPoints  = {}
  const areaClip  = {}
  const inLines   = {}
  CATS.forEach(c => { regionRes[c.id] = { count: 0, sqft: 0, lnft: 0 } })

  const clipStep = isDrawingRegion ? 6 : 4

  if (hasRegion && activeTool === 'region') {
    allPoints.forEach(p => {
      if (catActive.has(p.type) && inside(p, regionPoly)) {
        regionRes[p.type].count++; inPoints[p.id] = true
      }
    })
    allAreas.forEach(a => {
      if (!catActive.has(a.type)) return
      const cp = clipPx2(a.poly, regionPoly, clipStep)
      if (cp.px2 > 0) { regionRes[a.type].count++; regionRes[a.type].sqft += sqft(cp.px2); areaClip[a.id] = cp }
    })
    allLines.forEach(l => {
      const lc = centroid(l.pts)
      if (catActive.has(l.type) && inside(lc, regionPoly)) {
        regionRes[l.type].count++; regionRes[l.type].lnft += lnft(perimPx(l.pts)); inLines[l.id] = true
      }
    })
  }

  const totalPointCount = CATS.filter(c => c.kind === 'point').reduce((sum, c) => sum + regionRes[c.id].count, 0)
  const regionSqft  = hasRegion ? sqft(polyAreaPx(regionPoly)) : 0
  const regionPerim = hasRegion ? lnft(perimPx(regionPoly, true)) : 0
  const regionCen   = hasRegion ? centroid(regionPoly) : null

  const measureAllPts = !measureDone && measureCursor && measurePts.length > 0
    ? [...measurePts, measureCursor] : measurePts
  const measureSegments = []
  for (let i = 0; i < measureAllPts.length - 1; i++) {
    measureSegments.push({ a: measureAllPts[i], b: measureAllPts[i+1], ft: lnft(dist(measureAllPts[i], measureAllPts[i+1])) })
  }
  const measureTotalFt = measureSegments.reduce((sum, seg) => sum + seg.ft, 0)

  // Area preview path builder
  const buildAreaPreviewPath = () => {
    if (areaVerts.length === 0) return ''
    let d = `M ${areaVerts[0].x} ${areaVerts[0].y}`
    for (let i = 1; i < areaVerts.length; i++) {
      const S = areaVerts[i-1], E = areaVerts[i]
      if (arcSegsRef.current[i-1]) d += circularArcSeg(S, arcSegsRef.current[i-1], E)
      else d += ` L ${E.x} ${E.y}`
    }
    if (areaCursor) {
      const lastV = areaVerts[areaVerts.length - 1]
      if (pendingArcThrough) d += circularArcSeg(lastV, pendingArcThrough, areaCursor)
      else d += ` L ${areaCursor.x} ${areaCursor.y}`
    }
    return d
  }

  const buildLinearPreviewPath = () => {
    if (linearVerts.length === 0) return ''
    let d = `M ${linearVerts[0].x} ${linearVerts[0].y}`
    for (let i = 1; i < linearVerts.length; i++) {
      const S = linearVerts[i-1], E = linearVerts[i]
      if (linearArcSegsRef.current[i-1]) d += circularArcSeg(S, linearArcSegsRef.current[i-1], E)
      else d += ` L ${E.x} ${E.y}`
    }
    if (linearCursor) {
      const lastV = linearVerts[linearVerts.length - 1]
      if (pendingArcThrough) d += circularArcSeg(lastV, pendingArcThrough, linearCursor)
      else d += ` L ${linearCursor.x} ${linearCursor.y}`
    }
    return d
  }

  const layerItems = [
    ...countGroups.map(g => ({ id: g.id, color: g.color, kind: 'countGroup', label: g.name, count: g.points.length })),
    ...linearGroups.map(g => ({ id: g.id, color: g.color, kind: 'linearGroup', label: g.name, count: addedLines.filter(l => l.groupId === g.id).length })),
    ...areaGroups.map(g => ({ id: g.id, color: g.color, kind: 'areaGroup', label: g.name, count: addedAreas.filter(a => a.groupId === g.id).length })),
  ]

  // Project-wide totals aggregated across all sheets, with per-sheet breakdown for hover
  const projectLayers = (() => {
    const byName = {}
    ;(project.sheetIds || []).forEach(sid => {
      const sh = sheets[sid]
      if (!sh) return
      ;(sh.savedCountGroups || []).forEach(g => {
        const key = `count::${g.name}`
        if (!byName[key]) byName[key] = { label: g.name, kind: 'count', color: g.color || 'var(--takeoff-count)', count: 0, sheets: 0, sheetList: [] }
        byName[key].count += g.points?.length || 0
        byName[key].sheets += 1
        byName[key].sheetList.push({ sid, name: sh.name, code: sh.code, count: g.points?.length || 0 })
      })
      ;(sh.savedAreaGroups || []).forEach(g => {
        const key = `area::${g.name}`
        if (!byName[key]) byName[key] = { label: g.name, kind: 'area', color: g.color || 'var(--takeoff-area)', count: 0, sheets: 0, sheetList: [] }
        const n = (sh.savedAreas || []).filter(a => a.groupId === g.id).length
        byName[key].count += n
        byName[key].sheets += 1
        byName[key].sheetList.push({ sid, name: sh.name, code: sh.code, count: n })
      })
      ;(sh.savedLinearGroups || []).forEach(g => {
        const key = `linear::${g.name}`
        if (!byName[key]) byName[key] = { label: g.name, kind: 'linear', color: g.color || 'var(--takeoff-linear)', count: 0, sheets: 0, sheetList: [] }
        const n = (sh.savedLines || []).filter(l => l.groupId === g.id).length
        byName[key].count += n
        byName[key].sheets += 1
        byName[key].sheetList.push({ sid, name: sh.name, code: sh.code, count: n })
      })
    })
    return Object.values(byName)
  })()

  const toggleCat   = (id) => setCatActive(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleLayer = (id) => setHidden(h => ({ ...h, [id]: !h[id] }))

  const ac = ACCENTS[accent] || ACCENTS.green
  const accentStyle = { '--brand-50': ac[50], '--brand-500': ac[500], '--brand-600': ac[600], '--brand-700': ac[700] }

  const confirmScale = () => {
    const feetVal = parseFloat(scaleVal) * (UNIT_FT[scaleUnit] || 1)
    if (feetVal > 0 && scaleDlg) {
      setPxPerFt(scaleDlg.px / feetVal)
      setCalib({ feet: parseFloat(scaleVal), unit: scaleUnit, px: scaleDlg.px })
    }
    setScaleDlg(null); setScalePts([]); setActiveTool('region')
  }

  const doExport = () => {
    setExportOpen(false)
    setToast({ message: 'Estimate exported · Saved to Downloads.' })
    setTimeout(() => setToast(null), 4000)
  }

  const exportMTO = () => {
    const rows = []
    rows.push(['Material Takeoff', project.name, sheet.name, new Date().toLocaleDateString()])
    rows.push([])
    rows.push(['Category', 'Group / Item', 'Count', 'Sq Ft', 'Lin Ft', 'Notes'])
    // Count groups
    countGroups.forEach(g => {
      rows.push(['Count', g.name, g.points.length, '', '', ''])
    })
    // Area groups
    areaGroups.forEach(g => {
      const totalSqFt = addedAreas.filter(a => a.groupId === g.id).reduce((s, a) => s + sqft(polyAreaPx(a.poly)), 0)
      const depth = g.depth ? `Depth: ${g.depth}"` : ''
      const topsoil = g.topsoil && g.topsoil !== 'none' ? `Topsoil: ${g.topsoil}` : ''
      rows.push(['Area', g.name, addedAreas.filter(a => a.groupId === g.id).length, Math.round(totalSqFt), '', [depth, topsoil].filter(Boolean).join('; ')])
    })
    // Linear groups
    linearGroups.forEach(g => {
      const totalLnFt = addedLines.filter(l => l.groupId === g.id).reduce((s, l) => s + lnft(perimPx(l.pts)), 0)
      rows.push(['Linear', g.name, addedLines.filter(l => l.groupId === g.id).length, '', Math.round(totalLnFt), ''])
    })
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `MTO-${project.name}-${sheet.name}.csv`.replace(/\s+/g, '_')
    a.click(); URL.revokeObjectURL(url)
    setToast({ message: 'MTO exported as CSV.' })
    setTimeout(() => setToast(null), 3000)
  }

  const exportRegionMTO = () => {
    const rows = []
    rows.push(['Region MTO', project.name, sheet.name, new Date().toLocaleDateString()])
    rows.push([])
    rows.push(['Region', 'Category', 'Item', 'Count', 'Sq Ft', 'Lin Ft'])
    folders.forEach(folder => {
      const poly = folder.poly
      if (!poly || poly.length < 3) return
      const res = {}
      CATS.forEach(c => { res[c.id] = { count: 0, sqft: 0, lnft: 0 } })
      allPoints.forEach(p => { if (inside(p, poly)) res[p.type].count++ })
      allAreas.forEach(a => { const cp = clipPx2(a.poly, poly, 4); if (cp.px2 > 0) { res[a.type].count++; res[a.type].sqft += sqft(cp.px2) } })
      allLines.forEach(l => { const lc = centroid(l.pts); if (inside(lc, poly)) { res[l.type].count++; res[l.type].lnft += lnft(perimPx(l.pts)) } })
      CATS.forEach(c => {
        const r = res[c.id]
        if (r.count > 0 || r.sqft > 0 || r.lnft > 0)
          rows.push([folder.name, c.kind, c.name, r.count || '', r.sqft > 0 ? Math.round(r.sqft) : '', r.lnft > 0 ? Math.round(r.lnft) : ''])
      })
    })
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `Region-MTO-${project.name}-${sheet.name}.csv`.replace(/\s+/g, '_')
    a.click(); URL.revokeObjectURL(url)
    setToast({ message: 'Region MTO exported.' })
    setTimeout(() => setToast(null), 3000)
  }

  const px2pct = (v, dim) => `calc(50% + ${(v - dim / 2) * (zoom / 100) * FIT}px)`

  // Derive folders from project-level regions + this sheet's polys
  const projectRegions = project?.regions || []
  // Seed a default region if none exist yet
  const folders = projectRegions.length > 0
    ? projectRegions.map(r => ({ ...r, poly: (sheet?.regionPolys || {})[r.id] || null }))
    : [{ id: 'default-r1', name: 'Region 1', color: FOLDER_PALETTE[0], poly: null }]

  // Bootstrap: if project has no regions yet, ensure at least one exists
  useEffect(() => {
    if (projectId && (project?.regions || []).length === 0) {
      addRegion(projectId, { id: 'default-r1', name: 'Region 1', color: FOLDER_PALETTE[0] })
    }
  }, [projectId])

  // Ensure activeFolderId is always valid
  const safeFolderId = activeFolderId && folders.find(f => f.id === activeFolderId)
    ? activeFolderId
    : folders[0]?.id || null

  const activeFolder = folders.find(f => f.id === safeFolderId)

  const switchFolder = (folderId) => {
    if (folderId === safeFolderId) return
    const target = folders.find(f => f.id === folderId)
    setActiveFolderId(folderId)
    setRegionClosed(target?.poly || null)
    setRegionVerts([]); setRegionCursor(null)
  }
  const addFolder = () => {
    const id = `r${Date.now()}`
    const color = FOLDER_PALETTE[folders.length % FOLDER_PALETTE.length]
    const name = `Region ${folders.length + 1}`
    addRegion(projectId, { id, name, color })
    setActiveFolderId(id)
    setRegionClosed(null); setRegionVerts([]); setRegionCursor(null)
  }
  const deleteFolder = (folderId) => {
    if (folders.length <= 1) return
    deleteRegion(projectId, folderId)
    if (folderId === safeFolderId) {
      const next = folders.find(f => f.id !== folderId)
      if (next) { setActiveFolderId(next.id); setRegionClosed(next.poly || null) }
      setRegionVerts([]); setRegionCursor(null)
    }
  }
  const startRename = (folder) => { setRenamingId(folder.id); setRenameVal(folder.name) }
  const commitRename = () => {
    if (renameVal.trim()) updateRegion(projectId, renamingId, { name: renameVal.trim() })
    setRenamingId(null)
  }

  // Save the active region's poly to the sheet whenever regionClosed changes
  const saveRegionPoly = (folderId, poly) => {
    if (!sheetId || !folderId) return
    updateSheet(sheetId, {
      regionPolys: { ...(sheet?.regionPolys || {}), [folderId]: poly },
    })
  }

  const selectedArea  = selectedKind === 'area'  ? addedAreas.find(a => a.id === selectedId) : null
  const selectedPoint = selectedKind === 'point' ? addedPoints.find(p => p.id === selectedId) : null
  const selectedLine  = selectedKind === 'line'  ? addedLines.find(l => l.id === selectedId) : null

  const canvasCursor = activeTool === 'pan' ? 'grab'
    : activeTool === 'select' ? (isDraggingRef.current ? 'grabbing' : 'default')
    : ['region','measure','scale','area','linear','count'].includes(activeTool) ? 'crosshair'
    : 'default'

  const confirmNewItem = () => {
    const name = newItemName.trim() || `${newCountDlg === 'count' ? 'Count' : newCountDlg === 'linear' ? 'Linear' : 'Area'} ${(newCountDlg === 'count' ? countGroupNumRef : newCountDlg === 'linear' ? linearGroupNumRef : areaGroupNumRef).current + 1}`
    if (newCountDlg === 'count') {
      countGroupNumRef.current++
      const newGroup = { id: `cg-${Date.now()}`, name, color: newItemColor, shape: newItemShape, points: [] }
      setCountGroups(prev => [...prev, newGroup])
      setActiveCountGroupId(newGroup.id)
      setActiveTool('count')
    } else if (newCountDlg === 'linear') {
      linearGroupNumRef.current++
      const newGroup = { id: `lg-${Date.now()}`, name, color: newItemColor, lines: [] }
      setLinearGroups(prev => [...prev, newGroup])
      setActiveLinearGroupId(newGroup.id)
      setActiveTool('linear')
    } else {
      areaGroupNumRef.current++
      const newGroup = { id: `ag-${Date.now()}`, name, color: newItemColor, areas: [] }
      setAreaGroups(prev => [...prev, newGroup])
      setActiveAreaGroupId(newGroup.id)
      setActiveTool('area')
    }
    setNewCountDlg(false)
  }

  return (
    <div className={s.root} data-theme={theme} style={{ '--rc-fs': fs, ...accentStyle }}>

      <header className={s.top}>
        <div className={s.brand}>
          <img src="/plotline-mark.svg" alt="" className={s.logo} />
          <b className={s.wordmark}>Plotline<span className={s.dot}>.</span></b>
        </div>
        <div className={s.breadcrumb}>
          <span className={s.crumbLink} onClick={() => navigate('/')}>Projects</span>
          <ChevronRight size={13} className={s.crumbSep} />
          <span className={s.crumbLink} onClick={() => navigate(`/project/${projectId}`)}>{project.name}</span>
          <ChevronRight size={13} className={s.crumbSep} />
          <span className={s.crumbCurrent}>{sheet.code} · {sheet.name}</span>
        </div>
        <div className={s.topRight}>
          <div className={s.zoomCtrl}>
            <button className={s.zoomBtn} onClick={() => setZoom(z => Math.max(25, z - 25))}><Minus size={14} /></button>
            <span className={s.zoomVal}>{Math.round(zoom)}%</span>
            <button className={s.zoomBtn} onClick={() => setZoom(z => Math.min(1600, z + 25))}><Plus size={14} /></button>
          </div>
          <Badge variant="success" dot>Synced</Badge>
          <button className={s.iconBtn} data-on={settings} onClick={() => setSettings(v => !v)}>
            <Settings2 size={17} />
          </button>
          <Button size="sm" variant="secondary" iconLeft={<Share2 size={14} />}>Share</Button>
          <Button size="sm" variant="ghost" iconLeft={<Share2 size={14} />} onClick={() => { setQuoteVendor(''); setQuoteCopied(false); setQuoteOpen(true) }}>Quote email</Button>
          <Button size="sm" variant="ghost" iconLeft={<Download size={14} />} onClick={exportMTO}>MTO</Button>
          <Button size="sm" variant="primary" iconLeft={<FileDown size={14} />} onClick={() => setExportOpen(true)}>Export</Button>
        </div>
      </header>

      {settings && (
        <div className={s.settingsPop}>
          <div>
            <div className={s.popHead}>Theme</div>
            <div className={s.seg}>
              <button data-on={theme === 'light'} onClick={() => setTheme('light')}><Sun size={14} /> Light</button>
              <button data-on={theme === 'dark'}  onClick={() => setTheme('dark')}><Moon size={14} /> Dark</button>
            </div>
          </div>
          <div>
            <div className={s.popHead}>Accent color</div>
            <div className={s.swatches}>
              {['green','blue','violet','rose','amber'].map(k => { const a = ACCENTS[k]; return (
                <button key={k} title={a.label} data-on={accent === k} style={{ background: a[600] }} onClick={() => setAccent(k)}>
                  {accent === k && <Check size={13} />}
                </button>
              )})}
            </div>
          </div>
          <div>
            <div className={s.popHead}>Text size</div>
            <div className={s.fsRow}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>A</span>
              <input type="range" min="0.85" max="1.6" step="0.05" value={fs}
                style={{ flex: 1, accentColor: 'var(--brand-600)' }}
                onChange={e => setFs(parseFloat(e.target.value))} />
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-strong)' }}>A</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 38, textAlign: 'right' }}>{Math.round(fs * 100)}%</span>
            </div>
          </div>
          <div>
            <div className={s.popHead}>Icon size</div>
            <div className={s.fsRow}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>●</span>
              <input type="range" min="1.5" max="7" step="0.5" value={dotSize}
                style={{ flex: 1, accentColor: 'var(--brand-600)' }}
                onChange={e => setDotSize(parseFloat(e.target.value))} />
              <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>●</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 38, textAlign: 'right' }}>{dotSize.toFixed(1)}</span>
            </div>
          </div>
          <div>
            <div className={s.popHead}>Line weight</div>
            <div className={s.fsRow}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1 }}>—</span>
              <input type="range" min="0.4" max="3" step="0.2" value={strokeW}
                style={{ flex: 1, accentColor: 'var(--brand-600)' }}
                onChange={e => setStrokeW(parseFloat(e.target.value))} />
              <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-muted)', lineHeight: 1 }}>—</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 38, textAlign: 'right' }}>{strokeW.toFixed(1)}×</span>
            </div>
          </div>
          <div>
            <div className={s.popHead}>Measure label size</div>
            <div className={s.fsRow}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ft</span>
              <input type="range" min="0.3" max="3" step="0.1" value={measureSize}
                style={{ flex: 1, accentColor: 'var(--brand-600)' }}
                onChange={e => setMeasureSize(parseFloat(e.target.value))} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>ft</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 38, textAlign: 'right' }}>{measureSize.toFixed(1)}×</span>
            </div>
          </div>
        </div>
      )}

      <div className={s.body}>

        <div className={s.leftPanel} style={{ width: leftPanelW, minWidth: 180, maxWidth: 500 }}>
          <div className={s.resizeHandle} style={{ right: -3 }}
            onMouseDown={e => { e.preventDefault(); const startX = e.clientX, startW = leftPanelW; const move = ev => setLeftPanelW(Math.max(180, Math.min(500, startW + ev.clientX - startX))); const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }; window.addEventListener('mousemove', move); window.addEventListener('mouseup', up) }} />
          {/* Always show Layers / Sheets */}
          <div className={s.leftPanelTabs}>
            <Tabs variant="pill" value={leftPanel} onChange={setLeftPanel}
              items={[
                { value: 'layers', label: 'Layers', count: projectLayers.length },
                { value: 'regions', label: 'Regions', count: projectRegions.length },
                { value: 'sheets', label: 'Sheets', count: (project.sheetIds || []).length },
              ]}
            />
          </div>
          {leftPanel === 'layers' ? (
            <div className={s.scroll}>
              <div style={{ padding: '8px 10px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>Project totals</div>
              {projectLayers.length === 0 && (
                <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12 }}>No takeoffs yet</div>
              )}
              {projectLayers.map((item, i) => (
                <div key={i} className={s.layerRow} style={{ position: 'relative' }}
                  onMouseEnter={e => e.currentTarget.querySelector('[data-flyout]').style.display = 'block'}
                  onMouseLeave={e => e.currentTarget.querySelector('[data-flyout]').style.display = 'none'}>
                  <span className={`${s.layerDot} ${item.kind === 'linear' ? s.layerLine : ''}`}
                    style={{ background: item.color, borderRadius: item.kind === 'count' ? '50%' : '3px', flexShrink: 0 }} />
                  <span className={s.layerLabel}>{item.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginLeft: 'auto', paddingRight: 4, flexShrink: 0 }}>
                    {item.count}
                    {item.sheets > 1 && <span style={{ fontWeight: 400, color: 'var(--text-subtle)', marginLeft: 3 }}>({item.sheets})</span>}
                  </span>
                  {/* Hover flyout — sheet list */}
                  <div data-flyout="" style={{
                    display: 'none', position: 'absolute', left: '100%', top: 0, zIndex: 200,
                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.14)', minWidth: 200, padding: '6px 0',
                  }}>
                    <div style={{ padding: '4px 12px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-subtle)', borderBottom: '1px solid var(--border)', marginBottom: 2 }}>
                      {item.label}
                    </div>
                    {item.sheetList.map(sh => (
                      <div key={sh.sid}
                        onClick={() => navigate(`/project/${projectId}/sheet/${sh.sid}`)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                          cursor: 'pointer', fontSize: 12,
                          background: sh.sid === sheetId ? 'var(--brand-50)' : 'transparent',
                        }}
                        onMouseEnter={e => { if (sh.sid !== sheetId) e.currentTarget.style.background = 'var(--surface-hover)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = sh.sid === sheetId ? 'var(--brand-50)' : 'transparent' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', minWidth: 28 }}>{sh.code}</span>
                        <span style={{ flex: 1, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sh.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{sh.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : leftPanel === 'regions' ? (
            <div className={s.scroll}>
              <div style={{ padding: '8px 10px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>Project regions</div>
              {projectRegions.length === 0 && (
                <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12 }}>No regions yet — use the Region tool to draw one</div>
              )}
              {projectRegions.map(r => (
                <div key={r.id} style={{ position: 'relative' }}
                  onMouseEnter={e => e.currentTarget.querySelector('[data-flyout]').style.display = 'block'}
                  onMouseLeave={e => e.currentTarget.querySelector('[data-flyout]').style.display = 'none'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer',
                    background: r.id === safeFolderId ? 'var(--surface-muted)' : 'transparent',
                    borderLeft: `3px solid ${r.id === safeFolderId ? r.color : 'transparent'}` }}
                    onClick={() => { setActiveTool('region'); switchFolder(r.id) }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: r.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, fontWeight: r.id === safeFolderId ? 700 : 500, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>
                      {(project.sheetIds || []).filter(sid => sheets[sid]?.regionPolys?.[r.id]?.length >= 3).length} sheets
                    </span>
                  </div>
                  {/* Per-sheet flyout */}
                  <div data-flyout="" style={{
                    display: 'none', position: 'absolute', left: '100%', top: 0, zIndex: 200,
                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.14)', minWidth: 200, padding: '6px 0',
                  }}>
                    <div style={{ padding: '4px 12px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-subtle)', borderBottom: '1px solid var(--border)', marginBottom: 2 }}>
                      {r.name}
                    </div>
                    {(project.sheetIds || []).map(sid => {
                      const sh = sheets[sid]
                      if (!sh) return null
                      const hasPoly = (sh.regionPolys?.[r.id] || []).length >= 3
                      return (
                        <div key={sid}
                          onClick={() => { navigate(`/project/${projectId}/sheet/${sid}`); setActiveFolderId(r.id); setActiveTool('region') }}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                            background: sid === sheetId ? 'var(--brand-50)' : 'transparent' }}
                          onMouseEnter={e => { if (sid !== sheetId) e.currentTarget.style.background = 'var(--surface-hover)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = sid === sheetId ? 'var(--brand-50)' : 'transparent' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', minWidth: 28 }}>{sh.code}</span>
                          <span style={{ flex: 1, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sh.name}</span>
                          <span style={{ fontSize: 10, color: hasPoly ? r.color : 'var(--text-subtle)' }}>{hasPoly ? '●' : '○'}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              <button onClick={addFolder} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '7px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add region
              </button>
            </div>
          ) : (
            <div className={s.scroll}>
              {(project.sheetIds || []).map(sid => {
                const sh = sheets[sid]
                if (!sh) return null
                return (
                  <div key={sid}
                    className={`${s.sheetThumbRow} ${sid === sheetId ? s.sheetThumbActive : ''}`}
                    onClick={() => navigate(`/project/${projectId}/sheet/${sid}`)}>
                    <div className={s.sheetThumbMini}><Map size={12} /></div>
                    <div>
                      <div className={s.sheetThumbCode}>{sh.code}</div>
                      <div className={s.sheetThumbName}>{sh.name}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <main className={s.canvas} ref={canvasRef}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}>
          <div className={s.hint}>
            {activeTool === 'scale' ? (
              scalePts.length === 0
                ? <><Ruler size={14} /><span><b>Set scale</b> — click the first end of a known distance</span></>
                : <><Ruler size={14} /><span>Now click the <b>other end</b> of that distance</span></>
            ) : activeTool === 'select' ? (
              selectedId
                ? <><MousePointer2 size={14} /><span>Drag to move · drag vertex to reshape · <kbd>Esc</kbd> to deselect</span></>
                : <><MousePointer2 size={14} /><span>Click an item to select it. Drag vertices to reshape areas.</span></>
            ) : activeTool === 'region' ? (
              isDrawingRegion
                ? regionVerts.length === 0
                  ? <><Lasso size={14} /><span><b>Click</b> to start drawing an area</span></>
                  : <><Lasso size={14} /><span>Keep clicking · click first point or <kbd>Enter</kbd> to close · <kbd>Esc</kbd> to cancel</span></>
                : hasRegion
                  ? <><Check size={14} style={{ color: 'var(--brand-600)' }} /><b>{fSq(regionSqft)} sq ft</b><span> · {totalPointCount} items. Draw again to recount.</span></>
                  : <><Lasso size={14} /><span>Draw a region to count items inside</span></>
            ) : activeTool === 'measure' ? (
              measurePts.length === 0 && measureSessions.length === 0
                ? <><Ruler size={14} /><span><b>Click</b> to start measuring · <kbd>Enter</kbd> or double-click to save and start new · <kbd>Esc</kbd> to clear all</span></>
                : measurePts.length === 0
                  ? <><Ruler size={14} style={{ color: measureColor }} /><span>Click to start a new measurement · <kbd>Esc</kbd> to clear all · <b>{measureSessions.length}</b> saved</span></>
                  : <><Ruler size={14} style={{ color: measureColor }} /><span>Click to add points · <kbd>Enter</kbd> to save &amp; start new · <b>{fLn(measureTotalFt)}</b> ft so far</span></>
            ) : activeTool === 'area' ? (
              arcMode && pendingArcThrough
                ? <><SquareDashed size={14} /><span>Arc: now click the <b>endpoint</b> of the arc</span></>
                : arcMode
                ? <><SquareDashed size={14} /><span>Arc mode — click the <b>through-point</b> of the curve · <kbd>A</kbd> to cancel</span></>
                : areaVerts.length === 0
                  ? <><SquareDashed size={14} /><span><b>Click</b> to start drawing — <kbd>A</kbd> for arc segment</span></>
                  : <><SquareDashed size={14} /><span>Keep clicking · <kbd>A</kbd> for arc · click first point or <kbd>Enter</kbd> to close</span></>
            ) : activeTool === 'linear' ? (
              arcMode && pendingArcThrough
                ? <><Spline size={14} /><span>Arc: now click the <b>endpoint</b> of the arc</span></>
                : arcMode
                ? <><Spline size={14} /><span>Arc mode — click the <b>through-point</b> · <kbd>A</kbd> to cancel</span></>
                : linearVerts.length === 0
                  ? <><Spline size={14} /><span><b>Click</b> to start drawing a line · <kbd>A</kbd> for arc segment</span></>
                  : <><Spline size={14} /><span>Keep clicking · <kbd>A</kbd> for arc · double-click or <kbd>Enter</kbd> to finish</span></>
            ) : activeTool === 'count' ? (
              <><MapPin size={14} /><span><b>Click</b> to place a {COUNT_CATS.find(c => c.id === addCountType)?.name || addCountType} — change type in the right panel</span></>
            ) : activeTool === 'pan' ? (
              <><Hand size={14} /><span>Drag to pan · scroll to zoom</span></>
            ) : (
              <><SquareDashed size={14} /><span><b>{TOOLS.find(t => t !== 'sep' && t.id === activeTool)?.label}</b></span></>
            )}
          </div>

          <div className={s.sheetWrap} style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${(zoom / 100) * FIT})` }}>
            <div className={s.sheet} style={{ width: SHEET_W, height: SHEET_H, backgroundImage: sheet.pdfUrl ? 'none' : undefined }}>
              {sheet.pdfUrl && (
                <PdfCanvas url={sheet.pdfUrl} width={SHEET_W} height={SHEET_H} pageNumber={sheet.pdfPage || 1}
                  onReuploadNeeded={() => {
                    const input = document.createElement('input')
                    input.type = 'file'; input.accept = 'application/pdf'
                    input.onchange = (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = (ev) => updateSheet(sheetId, { pdfUrl: ev.target.result })
                      reader.readAsDataURL(file)
                    }
                    input.click()
                  }}
                />
              )}
              <svg ref={svgRef} className={s.svg} width={SHEET_W} height={SHEET_H}
                viewBox={`0 0 ${SHEET_W} ${SHEET_H}`}
                style={{ cursor: canvasCursor }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onClick={onClick}
                onDoubleClick={onDblClick}
                onContextMenu={onContextMenu}>
                <defs>
                  {previewPoly.length >= 3 && (
                    <clipPath id="region-clip">
                      <polygon points={previewPoly.map(p => `${p.x},${p.y}`).join(' ')} />
                    </clipPath>
                  )}
                </defs>

                {/* Page overlay */}
                {overlaySheetId && (() => {
                  const ovSheet = sheets[overlaySheetId]
                  if (!ovSheet) return null
                  return (
                    <g transform={`translate(${overlayOffset.x},${overlayOffset.y}) scale(${overlayScale})`}
                      opacity={overlayOpacity} style={{ cursor: 'move' }}
                      onMouseDown={e => { e.stopPropagation(); overlayDragRef.current = { startX: e.clientX - overlayOffset.x, startY: e.clientY - overlayOffset.y } }}
                      onMouseMove={e => { if (overlayDragRef.current) setOverlayOffset({ x: e.clientX - overlayDragRef.current.startX, y: e.clientY - overlayDragRef.current.startY }) }}
                      onMouseUp={() => { overlayDragRef.current = null }}>
                      {(ovSheet.areas || []).map(a => (
                        <polygon key={a.id} points={a.poly.map(p => `${p.x},${p.y}`).join(' ')}
                          fill={CAT_COLOR[a.type]} fillOpacity="0.2" stroke={CAT_COLOR[a.type]} strokeWidth="0.75" />
                      ))}
                      {(ovSheet.lines || []).map(l => (
                        <polyline key={l.id} points={l.pts.map(p => `${p.x},${p.y}`).join(' ')}
                          fill="none" stroke={CAT_COLOR[l.type]} strokeWidth="1.5" strokeLinecap="round" />
                      ))}
                      {(ovSheet.points || []).map(p => (
                        <circle key={p.id} cx={p.x} cy={p.y} r="3"
                          fill="white" stroke={CAT_COLOR[p.type]} strokeWidth="1" />
                      ))}
                    </g>
                  )
                })()}

                {/* Ghost polygons for non-active folders */}
                {activeTool === 'region' && folders.filter(f => f.id !== safeFolderId && f.poly).map(f => (
                  <polygon key={f.id}
                    points={f.poly.map(p => `${p.x},${p.y}`).join(' ')}
                    fill={f.color} fillOpacity="0.06"
                    stroke={f.color} strokeWidth="1.5" strokeDasharray="5 3" />
                ))}

                {/* Base area features (sample data) */}
                {(sheet.areas || []).map(a => {
                  if (hidden[a.id]) return null
                  const inRegionMode = activeTool === 'region' && hasRegion
                  return (
                    <polygon key={a.id}
                      points={a.poly.map(p => `${p.x},${p.y}`).join(' ')}
                      fill={CAT_COLOR[a.type]}
                      fillOpacity={catActive.has(a.type) ? (inRegionMode ? 0.05 : 0.15) : 0.03}
                      stroke={CAT_COLOR[a.type]}
                      strokeOpacity={catActive.has(a.type) ? (inRegionMode ? 0.3 : 0.85) : 0.2}
                      strokeWidth="0.75"
                    />
                  )
                })}

                {/* Added areas (may have arc segs) */}
                {addedAreas.map(a => {
                  if (hidden[a.id]) return null
                  const inRegionMode = activeTool === 'region' && hasRegion
                  const isSelected = selectedId === a.id
                  const hasArcs = a.arcSegs && Object.keys(a.arcSegs).length > 0
                  const areaColor = a.color || CAT_COLOR[a.type]
                  const fillOp = inRegionMode ? 0.05 : 0.18
                  const strokeOp = inRegionMode ? 0.3 : 0.85
                  const sharedProps = {
                    fill: areaColor, fillOpacity: fillOp,
                    stroke: isSelected ? '#000' : areaColor,
                    strokeOpacity: strokeOp, strokeWidth: isSelected ? strokeW * mk * 2 : strokeW * mk * 0.75,
                    strokeDasharray: isSelected ? '0' : undefined,
                  }
                  return hasArcs
                    ? <path key={a.id} d={buildAreaPath(a.poly, a.arcSegs)} {...sharedProps} />
                    : <polygon key={a.id} points={a.poly.map(p => `${p.x},${p.y}`).join(' ')} {...sharedProps} />
                })}

                {/* Clipped area bright overlay */}
                {activeTool === 'region' && previewPoly.length >= 3 && (
                  <g clipPath="url(#region-clip)">
                    {allAreas.filter(a => catActive.has(a.type) && !hidden[a.id]).map(a => {
                      const hasArcs = a.arcSegs && Object.keys(a.arcSegs).length > 0
                      return hasArcs
                        ? <path key={a.id} d={buildAreaPath(a.poly, a.arcSegs)}
                            fill={CAT_COLOR[a.type]} fillOpacity="0.28"
                            stroke={CAT_COLOR[a.type]} strokeWidth={mk} />
                        : <polygon key={a.id} points={a.poly.map(p => `${p.x},${p.y}`).join(' ')}
                            fill={CAT_COLOR[a.type]} fillOpacity="0.28"
                            stroke={CAT_COLOR[a.type]} strokeWidth={mk} />
                    })}
                  </g>
                )}

                {/* Base linear features */}
                {(sheet.lines || []).map(l => {
                  if (hidden[l.id]) return null
                  const isIn = inLines[l.id]
                  const dim = (activeTool === 'region' && hasRegion && !isIn) || !catActive.has(l.type)
                  return (
                    <polyline key={l.id}
                      points={l.pts.map(p => `${p.x},${p.y}`).join(' ')}
                      fill="none" stroke={CAT_COLOR[l.type]}
                      strokeOpacity={dim ? 0.25 : 1} strokeWidth={strokeW * mk * (isIn ? 2.5 : 1.5)}
                      strokeLinecap="round" strokeLinejoin="round" />
                  )
                })}

                {/* Added linear features */}
                {addedLines.map(l => {
                  if (hidden[l.id]) return null
                  const isIn = inLines[l.id]
                  const isSelected = selectedId === l.id
                  const dim = (activeTool === 'region' && hasRegion && !isIn) || !catActive.has(l.type)
                  const lineColor = l.color || CAT_COLOR[l.type]
                  const hasArcs = l.arcSegs && Object.keys(l.arcSegs).length > 0
                  const pathD = hasArcs ? buildLinePath(l.pts, l.arcSegs) : null
                  const sharedProps = {
                    fill: 'none', stroke: lineColor,
                    strokeOpacity: dim ? 0.25 : 1,
                    strokeWidth: strokeW * mk * (isSelected ? 2.5 : (isIn ? 2.5 : 1.5)),
                    strokeLinecap: 'round', strokeLinejoin: 'round',
                    strokeDasharray: isSelected ? '6 3' : undefined,
                  }
                  return hasArcs
                    ? <path key={l.id} d={pathD} {...sharedProps} />
                    : <polyline key={l.id} points={l.pts.map(p => `${p.x},${p.y}`).join(' ')} {...sharedProps} />
                })}

                {/* Point items (sample/base) */}
                {allPoints.map(p => {
                  const isIn = inPoints[p.id]
                  const isSelected = selectedId === p.id
                  const dim = (activeTool === 'region' && hasRegion && !isIn) || !catActive.has(p.type)
                  const col = p.color || CAT_COLOR[p.type]
                  const dr = dotSize * mk
                  return (
                    <g key={p.id} opacity={dim ? 0.22 : 1}>
                      {(isIn || isSelected) && <circle cx={p.x} cy={p.y} r={dr * 2.3} fill={col} opacity="0.15" />}
                      <circle cx={p.x} cy={p.y} r={isIn || isSelected ? dr * 1.33 : dr}
                        fill={(isIn || isSelected) ? col : '#fff'} stroke={isSelected ? '#000' : col}
                        strokeWidth={(isIn || isSelected) ? strokeW * mk * 1.5 : strokeW * mk} />
                      {(isIn || isSelected) && <circle cx={p.x} cy={p.y} r={dr * 0.4} fill="#fff" />}
                    </g>
                  )
                })}

                {/* Selection vertex handles for selected area */}
                {activeTool === 'select' && selectedArea && selectedArea.poly.map((v, i) => (
                  <rect key={i} x={v.x - 5*u} y={v.y - 5*u} width={10*u} height={10*u}
                    fill="#fff" stroke="#000" strokeWidth={1.5*u} style={{ cursor: 'move' }} />
                ))}

                {/* Region outline */}
                {activeTool === 'region' && previewPoly.length >= 2 && (
                  <polygon
                    points={previewPoly.map(p => `${p.x},${p.y}`).join(' ')}
                    fill={activeFolder?.color || 'var(--brand-600)'} fillOpacity="0.04"
                    stroke={activeFolder?.color || 'var(--brand-600)'}
                    strokeWidth={2.5*mk} strokeDasharray={isDrawingRegion ? `${7*mk} ${5*mk}` : '0'} strokeLinejoin="round" />
                )}
                {activeTool === 'region' && isDrawingRegion && regionVerts.map((v, i) => (
                  <circle key={i} cx={v.x} cy={v.y}
                    r={i === 0 && regionVerts.length >= 3 ? 7*mk : 4.5*mk}
                    fill={i === 0 && regionVerts.length >= 3 ? '#fff' : (activeFolder?.color || 'var(--brand-600)')}
                    stroke={activeFolder?.color || 'var(--brand-600)'} strokeWidth={2.5*mk} />
                ))}
                {activeTool === 'region' && !isDrawingRegion && regionPoly.map((v, i) => (
                  <rect key={i} x={v.x - 6*mk} y={v.y - 6*mk} width={12*mk} height={12*mk}
                    fill="#fff" stroke={activeFolder?.color || 'var(--brand-600)'} strokeWidth={2*mk}
                    style={{ cursor: 'move' }}
                    onMouseDown={e => { e.stopPropagation(); dragRegionVertRef.current = i }}
                  />
                ))}

                {/* Area drawing overlay */}
                {activeTool === 'area' && areaVerts.length >= 1 && (() => {
                  const pathD = buildAreaPreviewPath()
                  return (
                    <>
                      <path d={pathD}
                        fill={CAT_COLOR[areaType] || '#888'} fillOpacity="0.15"
                        stroke={CAT_COLOR[areaType] || '#888'} strokeWidth={2*mk}
                        strokeDasharray={`${6*mk} ${4*mk}`} strokeLinejoin="round" />
                      {pendingArcThrough && (
                        <circle cx={pendingArcThrough.x} cy={pendingArcThrough.y} r={6*mk}
                          fill={CAT_COLOR[areaType] || '#888'} opacity="0.8" />
                      )}
                      {arcMode && !pendingArcThrough && areaCursor && (
                        <circle cx={areaCursor.x} cy={areaCursor.y} r={5*mk}
                          fill="none" stroke={CAT_COLOR[areaType] || '#888'} strokeWidth={2*mk} strokeDasharray={`${3*mk} ${2*mk}`} />
                      )}
                    </>
                  )
                })()}
                {activeTool === 'area' && areaVerts.map((v, i) => (
                  <circle key={i} cx={v.x} cy={v.y}
                    r={i === 0 && areaVerts.length >= 3 ? 7*mk : 4*mk}
                    fill={i === 0 && areaVerts.length >= 3 ? '#fff' : (CAT_COLOR[areaType] || '#888')}
                    stroke={CAT_COLOR[areaType] || '#888'} strokeWidth={2*mk} />
                ))}

                {/* Linear drawing overlay */}
                {activeTool === 'linear' && linearVerts.length >= 1 && (() => {
                  const pathD = buildLinearPreviewPath()
                  return (
                    <>
                      <path d={pathD}
                        fill="none"
                        stroke={CAT_COLOR[linearType] || '#888'} strokeWidth={3*mk}
                        strokeDasharray={`${6*mk} ${4*mk}`} strokeLinecap="round" strokeLinejoin="round" />
                      {pendingArcThrough && (
                        <circle cx={pendingArcThrough.x} cy={pendingArcThrough.y} r={6*mk}
                          fill={CAT_COLOR[linearType] || '#888'} opacity="0.8" />
                      )}
                    </>
                  )
                })()}
                {activeTool === 'linear' && linearVerts.map((v, i) => (
                  <g key={i}>
                    <line x1={v.x} y1={v.y - 7*mk} x2={v.x} y2={v.y + 7*mk} stroke={CAT_COLOR[linearType] || '#888'} strokeWidth={2*mk} />
                    <circle cx={v.x} cy={v.y} r={4*mk} fill={CAT_COLOR[linearType] || '#888'} />
                  </g>
                ))}

                {/* Measure tool — completed sessions */}
                {activeTool === 'measure' && measureSessions.map((sess, si) => {
                  const col = sess.color
                  const ms = measureSize * mk
                  const segs = sess.pts.slice(0, -1).map((a, k) => ({ a, b: sess.pts[k+1], ft: lnft(dist(a, sess.pts[k+1])) }))
                  const total = segs.reduce((s, sg) => s + sg.ft, 0)
                  return (
                    <g key={si}>
                      <polyline points={sess.pts.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none" stroke={col} strokeWidth={2.5 * ms} strokeLinecap="round" />
                      {segs.map((seg, i) => (
                        <text key={i} x={(seg.a.x+seg.b.x)/2} y={(seg.a.y+seg.b.y)/2 - 8*ms}
                          textAnchor="middle" fill={col}
                          fontFamily="var(--font-mono)" fontSize={10 * ms} fontWeight="600">
                          {fLn(seg.ft)} ft
                        </text>
                      ))}
                      {sess.pts.map((p, i) => (
                        <g key={i}>
                          <line x1={p.x} y1={p.y - 8*ms} x2={p.x} y2={p.y + 8*ms} stroke={col} strokeWidth={1.5 * ms} />
                          <circle cx={p.x} cy={p.y} r={3.5 * ms} fill={col} />
                        </g>
                      ))}
                      {segs.length > 1 && (() => {
                        const last = sess.pts[sess.pts.length - 1]
                        return <text x={last.x + 6*ms} y={last.y - 6*ms} fill={col} fontFamily="var(--font-mono)" fontSize={11 * ms} fontWeight="700">Σ {fLn(total)} ft</text>
                      })()}
                    </g>
                  )
                })}

                {/* Measure tool — current in-progress */}
                {activeTool === 'measure' && (() => {
                  const ms = measureSize * mk
                  return (
                    <g>
                      {measureAllPts.length >= 2 && (
                        <polyline points={measureAllPts.map(p => `${p.x},${p.y}`).join(' ')}
                          fill="none" stroke={measureColor} strokeWidth={2.5 * ms}
                          strokeDasharray={`${6*ms} ${4*ms}`} strokeLinecap="round" />
                      )}
                      {measureSegments.map((seg, i) => (
                        <text key={i} x={(seg.a.x+seg.b.x)/2} y={(seg.a.y+seg.b.y)/2 - 8*ms}
                          textAnchor="middle" fill={measureColor}
                          fontFamily="var(--font-mono)" fontSize={11 * ms} fontWeight="600">
                          {fLn(seg.ft)} ft
                        </text>
                      ))}
                      {measureAllPts.map((p, i) => (
                        <g key={i}>
                          <line x1={p.x} y1={p.y - 9*ms} x2={p.x} y2={p.y + 9*ms} stroke={measureColor} strokeWidth={2 * ms} />
                          <circle cx={p.x} cy={p.y} r={4 * ms} fill={measureColor} />
                        </g>
                      ))}
                    </g>
                  )
                })()}

                {/* Scale line */}
                {activeTool === 'scale' && (() => {
                  const pts = [...scalePts, ...(scalePts.length === 1 && regionCursor ? [regionCursor] : [])]
                  const u = 1 / ((zoom / 100) * FIT)
                  return (
                    <g>
                      {pts.length === 2 && <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} stroke="var(--brand-600)" strokeWidth={1.5*u} />}
                      {pts.map((p, i) => (
                        <g key={i}>
                          <line x1={p.x} y1={p.y-8*u} x2={p.x} y2={p.y+8*u} stroke="var(--brand-600)" strokeWidth={1.5*u} />
                          <line x1={p.x-8*u} y1={p.y} x2={p.x+8*u} y2={p.y} stroke="var(--brand-600)" strokeWidth={1.5*u} />
                          <circle cx={p.x} cy={p.y} r={3*u} fill="var(--brand-600)" />
                        </g>
                      ))}
                    </g>
                  )
                })()}

                {/* Count group dots — SVG so they scale with plan zoom/scale */}
                {countGroups.map(g =>
                  g.points.map(p => {
                    const isSelected = selectedId === p.id
                    const r = dotSize * mk * (isSelected ? 1.5 : 1)
                    const sw = strokeW * mk * (isSelected ? 1.5 : 1)
                    const col = g.color
                    const bdr = isSelected ? '#000' : col
                    if (g.shape === 'circle') {
                      return (
                        <circle key={p.id} cx={p.x} cy={p.y} r={r}
                          fill={col} stroke={bdr} strokeWidth={sw}
                          style={{ filter: 'drop-shadow(0 0 1px #fff)' }} />
                      )
                    } else if (g.shape === 'square') {
                      return (
                        <rect key={p.id} x={p.x - r} y={p.y - r} width={r*2} height={r*2}
                          fill={col} stroke={bdr} strokeWidth={sw}
                          style={{ filter: 'drop-shadow(0 0 1px #fff)' }} />
                      )
                    } else { // diamond
                      return (
                        <rect key={p.id} x={p.x - r} y={p.y - r} width={r*2} height={r*2}
                          fill={col} stroke={bdr} strokeWidth={sw}
                          transform={`rotate(45,${p.x},${p.y})`}
                          style={{ filter: 'drop-shadow(0 0 1px #fff)' }} />
                      )
                    }
                  })
                )}

                {/* Box select rectangle */}
                {boxSelect && (
                  <rect x={Math.min(boxSelect.x1, boxSelect.x2)} y={Math.min(boxSelect.y1, boxSelect.y2)}
                    width={Math.abs(boxSelect.x2 - boxSelect.x1)} height={Math.abs(boxSelect.y2 - boxSelect.y1)}
                    fill="var(--brand-500)" fillOpacity="0.08" stroke="var(--brand-500)" strokeWidth="1.5" strokeDasharray="5 3" />
                )}
              </svg>

              {activeTool === 'region' && Object.entries(areaClip).map(([id, cp]) => {
                const a = allAreas.find(x => x.id === id)
                if (!a || !cp.c) return null
                return (
                  <div key={id} className={s.areaLabel}
                    style={{ left: `${(cp.c.x/SHEET_W)*100}%`, top: `${(cp.c.y/SHEET_H)*100}%`, color: CAT_COLOR[a.type] }}>
                    {fSq(sqft(cp.px2))} sq ft
                  </div>
                )
              })}


            </div>
          </div>

          {activeTool === 'region' && regionCen && hasRegion && (
            <div className={s.bubble} style={{
              left: px2pct(regionCen.x, SHEET_W), top: px2pct(regionCen.y, SHEET_H),
              background: activeFolder?.color || 'var(--brand-600)'
            }}>
              {fSq(regionSqft)} sq ft
              <small>{totalPointCount} items · {fLn(regionPerim)} ln ft perim.</small>
            </div>
          )}

          {activeTool === 'measure' && measureAllPts.length >= 2 && (() => {
            const last = measureAllPts[measureAllPts.length - 1]
            return (
              <div className={s.bubble} style={{ left: px2pct(last.x, SHEET_W), top: px2pct(last.y - 28, SHEET_H), background: measureColor }}>
                {fLn(measureTotalFt)} ln ft
              </div>
            )
          })()}

          {(arcMode && (activeTool === 'area' || activeTool === 'linear')) && (
            <div className={s.arcBadge}>
              ⌒ ARC MODE
            </div>
          )}

          <div className={`${s.scaleChip} ${calib ? '' : s.scaleWarn}`}>
            {calib ? <Ruler size={13} /> : <TriangleAlert size={13} />}
            <span>{calib ? `Scale set · ${calib.feet} ${calib.unit} = ${Math.round(calib.px)} px` : 'Default scale — click "Set scale" to calibrate'}</span>
          </div>

          <div className={s.zoomPanel}>
            <button className={s.zoomPanBtn} onClick={() => setZoom(z => Math.max(25, z - 25))}><Minus size={14} /></button>
            <span className={s.zoomPanVal}>{Math.round(zoom)}%</span>
            <button className={s.zoomPanBtn} onClick={() => setZoom(z => Math.min(1600, z + 25))}><Plus size={14} /></button>
          </div>
        </main>

        {/* Tool detail panel - always visible on right */}
        <aside className={s.rightPanel} style={{ width: rightPanelW, minWidth: 240, maxWidth: 600 }}>
          <div className={s.resizeHandle} style={{ left: -3 }}
            onMouseDown={e => { e.preventDefault(); const startX = e.clientX, startW = rightPanelW; const move = ev => setRightPanelW(Math.max(240, Math.min(600, startW - (ev.clientX - startX)))); const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }; window.addEventListener('mousemove', move); window.addEventListener('mouseup', up) }} />
          {activeTool === 'measure' ? (
            <MeasurePanel
              sessions={measureSessions}
              segments={measureSegments}
              totalFt={measureTotalFt}
              fLn={fLn} lnft={lnft} dist={dist}
              color={measureColor} onColorChange={setMeasureColor}
              measureSize={measureSize} onMeasureSizeChange={setMeasureSize}
              onReset={() => { setMeasurePts([]); setMeasureDone(false); setMeasureCursor(null); setMeasureSessions([]) }}
              fs={fs}
            />
          ) : activeTool === 'region' ? (
            <RegionPanel
              folders={folders} activeFolderId={safeFolderId} renamingId={renamingId} renameVal={renameVal}
              onSwitch={switchFolder} onAdd={addFolder} onDelete={deleteFolder}
              onStartRename={startRename} onCommitRename={commitRename} onRenameVal={setRenameVal}
              regionRes={regionRes} hasRegion={hasRegion} regionSqft={regionSqft} regionPerim={regionPerim}
              fSq={fSq} fLn={fLn} isDrawingRegion={isDrawingRegion}
              onExportMTO={exportRegionMTO}
              countGroups={countGroups} areaGroups={areaGroups} linearGroups={linearGroups}
              addedAreas={addedAreas} addedLines={addedLines}
              sqft={sqft} lnft={lnft}
            />
          ) : (
            <ConditionsPanel
              countGroups={countGroups} activeCountGroupId={activeCountGroupId}
              onSetActiveCountGroup={id => { setActiveCountGroupId(id); setActiveTool('count') }}
              linearGroups={linearGroups} activeLinearGroupId={activeLinearGroupId}
              onSetActiveLinearGroup={id => { setActiveLinearGroupId(id); setActiveTool('linear') }}
              areaGroups={areaGroups} activeAreaGroupId={activeAreaGroupId}
              onSetActiveAreaGroup={id => { setActiveAreaGroupId(id); setActiveTool('area') }}
              addedAreas={addedAreas} addedPoints={addedPoints} addedLines={addedLines}
              sqft={sqft} fSq={fSq} lnft={lnft} fLn={fLn}
              areaDepth={areaDepth} topsoilType={topsoilType} topsoilCustom={topsoilCustom}
              onNewCount={() => { setNewItemName(`Count ${countGroupNumRef.current + 1}`); setNewItemColor(randColor()); setNewItemShape('circle'); setNewCountDlg('count') }}
              onNewArea={() => { setNewItemName(`Area ${areaGroupNumRef.current + 1}`); setNewItemColor(randColor()); setNewItemShape('circle'); setNewCountDlg('area') }}
              onNewLinear={() => { setNewItemName(`Linear ${linearGroupNumRef.current + 1}`); setNewItemColor(randColor()); setNewItemShape('circle'); setNewCountDlg('linear') }}
              onDeleteCountGroup={id => setCountGroups(prev => prev.filter(g => g.id !== id))}
              onDeleteAreaGroup={id => setAreaGroups(prev => prev.filter(g => g.id !== id))}
              onDeleteLinearGroup={id => setLinearGroups(prev => prev.filter(g => g.id !== id))}
              onEditGroup={openEditGroup}
              fs={fs}
            />
          )}
        </aside>
      </div>

      {/* Bottom toolbar rail */}
      <div className={s.bottomRail}>
        {TOOLS.map((t, i) => {
          if (t === 'sep') return <div key={'sep-' + i} className={s.railSepH} />
          const { Icon } = t
          return (
            <Tooltip key={t.id} label={t.label} shortcut={t.k} side="top">
              <button className={s.tool} data-on={activeTool === t.id}
                onClick={() => {
                  if (t.id === 'count') {
                    setNewItemName(`Count ${countGroupNumRef.current + 1}`)
                    setNewItemColor(randColor()); setNewItemShape('circle')
                    setNewCountDlg('count')
                  } else if (t.id === 'area') {
                    setNewItemName(`Area ${areaGroupNumRef.current + 1}`)
                    setNewItemColor(randColor()); setNewItemShape('circle')
                    setNewCountDlg('area')
                  } else if (t.id === 'linear') {
                    setNewItemName(`Linear ${linearGroupNumRef.current + 1}`)
                    setNewItemColor(randColor()); setNewItemShape('circle')
                    setNewCountDlg('linear')
                  } else {
                    setActiveTool(t.id)
                  }
                }} aria-label={t.label}>
                <Icon size={20} />
                <span className={s.toolKbd}>{t.k}</span>
              </button>
            </Tooltip>
          )
        })}
        <div className={s.railSepH} />
        <Tooltip label="Set scale" shortcut="S" side="top">
          <button className={s.tool} data-on={activeTool === 'scale'}
            onClick={() => { setActiveTool('scale'); setScalePts([]) }} aria-label="Set scale">
            <Ruler size={20} />
            <span className={s.toolKbd}>S</span>
          </button>
        </Tooltip>
        <div className={s.railSepH} />
        <Tooltip label={`Snap ${snapEnabled ? 'ON' : 'OFF'} (F3)`} side="top">
          <button className={s.tool} data-on={snapEnabled} onClick={() => setSnapEnabled(v => !v)} aria-label="Toggle snap">
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '-0.02em' }}>SNAP</span>
          </button>
        </Tooltip>
        <Tooltip label={`Ortho ${orthoEnabled ? 'ON' : 'OFF'} (F8)`} side="top">
          <button className={s.tool} data-on={orthoEnabled} onClick={() => setOrthoEnabled(v => !v)} aria-label="Toggle ortho">
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '-0.02em' }}>ORTH</span>
          </button>
        </Tooltip>
        <Tooltip label="Page overlay" side="top">
          <button className={s.tool} data-on={!!overlaySheetId} onClick={() => setOverlayDlg(true)} aria-label="Page overlay">
            <Layers size={18} />
          </button>
        </Tooltip>
        {/* Tool detail inline (current tool indicator) */}
        <div className={s.railSepH} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', paddingLeft: 4 }}>
          <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{TOOLS.find(t => t !== 'sep' && t.id === activeTool)?.label || activeTool}</span>
          {activeTool === 'area' && <span style={{ color: 'var(--brand-600)' }}>· {areaGroups.find(g => g.id === activeAreaGroupId)?.name || 'No group'}</span>}
          {activeTool === 'count' && <span style={{ color: 'var(--brand-600)' }}>· {countGroups.find(g => g.id === activeCountGroupId)?.name || 'No group'}</span>}
        </div>
      </div>

      <Dialog open={!!scaleDlg}
        onClose={() => { setScaleDlg(null); setScalePts([]); setActiveTool('region') }}
        title="Set the sheet scale"
        description="Enter the real-world distance between the two points you clicked."
        width={420}
        footer={<>
          <Button variant="ghost" onClick={() => { setScaleDlg(null); setScalePts([]); setActiveTool('region') }}>Cancel</Button>
          <Button variant="primary" iconLeft={<Ruler size={15} />} onClick={confirmScale}>Set scale</Button>
        </>}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', paddingBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <Input label="Known distance" type="number" value={scaleVal} onChange={e => setScaleVal(e.target.value)} />
          </div>
          <div style={{ width: 120 }}>
            <Select label="Unit" value={scaleUnit} onChange={e => setScaleUnit(e.target.value)}
              options={[{ value:'ft',label:'feet' },{ value:'in',label:'inches' },{ value:'yd',label:'yards' },{ value:'m',label:'meters' }]} />
          </div>
        </div>
        {scaleDlg && (
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Measured: {Math.round(scaleDlg.px)} px → 1 ft ≈ {(scaleDlg.px / ((parseFloat(scaleVal)||1) * (UNIT_FT[scaleUnit]||1))).toFixed(1)} px
          </p>
        )}
      </Dialog>

      <Dialog open={exportOpen} onClose={() => setExportOpen(false)}
        title="Export estimate" description={`${project.name} · ${sheet.name}`} width={440}
        footer={<>
          <Button variant="ghost" onClick={() => setExportOpen(false)}>Cancel</Button>
          <Button variant="primary" iconLeft={<FileDown size={15} />} onClick={doExport}>Export PDF</Button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
          <Select label="Format" options={['PDF — itemized estimate','PDF — proposal w/ cover','CSV — quantities only','Excel workbook']} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Checkbox label="Include sheet thumbnails" defaultChecked />
            <Checkbox label="Show unit prices" defaultChecked />
            <Checkbox label="Group by sheet" />
          </div>
        </div>
      </Dialog>

      {/* Page Overlay Dialog */}
      <Dialog open={overlayDlg} onClose={() => setOverlayDlg(false)} title="Page overlay"
        description="Overlay another sheet transparently for comparison." width={420}
        footer={<>
          <Button variant="ghost" onClick={() => { setOverlaySheetId(null); setOverlayDlg(false) }}>Clear overlay</Button>
          <Button variant="primary" onClick={() => setOverlayDlg(false)}>Done</Button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Select sheet to overlay</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
              {(project.sheetIds || []).filter(id => id !== sheetId).map(id => {
                const sh = sheets[id]
                if (!sh) return null
                return (
                  <button key={id} onClick={() => setOverlaySheetId(id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${overlaySheetId === id ? 'var(--brand-500)' : 'var(--border-subtle)'}`, background: overlaySheetId === id ? 'var(--surface-muted)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                    <Map size={14} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-strong)' }}>{sh.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sh.code}</span>
                    {overlaySheetId === id && <Check size={13} style={{ color: 'var(--brand-600)' }} />}
                  </button>
                )
              })}
              {(project.sheetIds || []).filter(id => id !== sheetId).length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>No other sheets in this project.</p>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Opacity: {Math.round(overlayOpacity * 100)}%</div>
            <input type="range" min="0.1" max="1" step="0.05" value={overlayOpacity}
              onChange={e => setOverlayOpacity(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--brand-600)' }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Scale: {Math.round(overlayScale * 100)}%</div>
            <input type="range" min="0.5" max="2" step="0.05" value={overlayScale}
              onChange={e => setOverlayScale(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--brand-600)' }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Drag the overlay on the canvas to reposition it.</span>
          </div>
        </div>
      </Dialog>

      {/* Quote Email Dialog */}
      <Dialog open={quoteOpen} onClose={() => setQuoteOpen(false)} title="Generate quote email" width={560}
        footer={<>
          <Button variant="ghost" onClick={() => setQuoteOpen(false)}>Close</Button>
          <Button variant="primary" onClick={() => {
            const txt = generateQuoteEmail(project, sheet, allAreas, allLines, allPoints, quoteVendor, sqft, fSq, lnft, fLn, topsoilType, topsoilCustom, areaDepth)
            navigator.clipboard.writeText(txt).then(() => setQuoteCopied(true))
          }}>{quoteCopied ? '✓ Copied!' : 'Copy to clipboard'}</Button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Vendor / Supplier name</label>
            <input value={quoteVendor} onChange={e => { setQuoteVendor(e.target.value); setQuoteCopied(false) }}
              placeholder="e.g. Green Valley Nursery"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 13, background: 'var(--surface-card)', color: 'var(--text-strong)', boxSizing: 'border-box' }} />
          </div>
          <div style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', padding: '14px 16px', fontSize: 13, color: 'var(--text-body)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 340, overflowY: 'auto', lineHeight: 1.6 }}>
            {generateQuoteEmail(project, sheet, allAreas, allLines, allPoints, quoteVendor, sqft, fSq, lnft, fLn, topsoilType, topsoilCustom, areaDepth)}
          </div>
        </div>
      </Dialog>

      {/* Edit Group popup */}
      {editGroupDlg && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setEditGroupDlg(null)}>
          <div style={{ background: 'var(--surface-paper)', borderRadius: 12, padding: 28, width: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 18px', fontSize: 17, fontWeight: 700, color: 'var(--text-strong)' }}>Edit — {editGroupDlg.group.name}</h3>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Name</div>
              <input value={eName} onChange={e => setEName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEditGroup() }}
                style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--border-default)', borderRadius: 8, fontSize: 14, fontWeight: 600, color: 'var(--text-strong)', background: 'var(--surface-card)', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Color</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COUNT_COLORS.map(c => (
                  <button key={c} onClick={() => setEColor(c)}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: `3px solid ${eColor === c ? 'var(--text-strong)' : 'transparent'}`, cursor: 'pointer', padding: 0 }} />
                ))}
              </div>
            </div>
            {editGroupDlg.kind === 'count' && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Shape</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['circle','●'],['square','■'],['diamond','◆'],['triangle','▲']].map(([sh, icon]) => (
                    <button key={sh} onClick={() => setEShape(sh)}
                      style={{ width: 40, height: 40, borderRadius: 8, border: `2px solid ${eShape === sh ? eColor : 'var(--border-default)'}`, background: eShape === sh ? `${eColor}22` : 'transparent', cursor: 'pointer', fontSize: 20, color: eShape === sh ? eColor : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {editGroupDlg.kind === 'area' && (
              <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', minWidth: 60 }}>Depth</label>
                  <input type="number" min="0" step="0.5" value={eDepth} onChange={e => setEDepth(e.target.value)}
                    style={{ width: 64, padding: '5px 8px', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 13, background: 'var(--surface-card)', color: 'var(--text-strong)' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>inches</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', minWidth: 60 }}>Topsoil</label>
                  <select value={eTopsoil} onChange={e => setETopsoil(e.target.value)}
                    style={{ flex: 1, padding: '5px 8px', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 13, background: 'var(--surface-card)', color: 'var(--text-strong)' }}>
                    {TOPSOIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {eTopsoil === 'custom' && (
                  <input placeholder="Describe topsoil…" value={eTopsoilCustom} onChange={e => setETopsoilCustom(e.target.value)}
                    style={{ padding: '5px 8px', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 13, background: 'var(--surface-card)', color: 'var(--text-strong)' }} />
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setEditGroupDlg(null)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'transparent', fontSize: 14, cursor: 'pointer', color: 'var(--text-muted)' }}>Cancel</button>
              <button onClick={saveEditGroup}
                style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: eColor, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Count / Area naming dialog */}
      {newCountDlg && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setNewCountDlg(false)}>
          <div style={{ background: 'var(--surface-paper)', borderRadius: 12, padding: 28, width: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 700, color: 'var(--text-strong)' }}>
              Name this {newCountDlg === 'count' ? 'count' : 'area'}
            </h3>
            <input autoFocus value={newItemName} onChange={e => setNewItemName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmNewItem(); if (e.key === 'Escape') setNewCountDlg(false) }}
              placeholder={newCountDlg === 'count' ? 'e.g. Trees, Shrubs…' : 'e.g. Sod area, Mulch bed…'}
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border-default)', borderRadius: 8, fontSize: 15, fontWeight: 600, color: 'var(--text-strong)', background: 'var(--surface-card)', boxSizing: 'border-box', marginBottom: 18 }} />
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>Color</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COUNT_COLORS.map(c => (
                  <button key={c} onClick={() => setNewItemColor(c)}
                    style={{ width: 30, height: 30, borderRadius: '50%', background: c, border: `3px solid ${newItemColor === c ? 'var(--text-strong)' : 'transparent'}`, cursor: 'pointer', padding: 0, outline: 'none' }} />
                ))}
              </div>
            </div>
            {newCountDlg === 'count' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>Shape</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[['circle','●'],['square','■'],['diamond','◆'],['triangle','▲']].map(([sh, icon]) => (
                    <button key={sh} onClick={() => setNewItemShape(sh)}
                      style={{ width: 44, height: 44, borderRadius: 8, border: `2px solid ${newItemShape === sh ? newItemColor : 'var(--border-default)'}`, background: newItemShape === sh ? `${newItemColor}22` : 'transparent', cursor: 'pointer', fontSize: 22, color: newItemShape === sh ? newItemColor : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setNewCountDlg(false)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'transparent', fontSize: 14, cursor: 'pointer', color: 'var(--text-muted)' }}>Cancel</button>
              <button onClick={confirmNewItem}
                style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: newItemColor, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Start {newCountDlg === 'count' ? 'counting' : 'drawing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={s.toast}>
          <Check size={15} style={{ color: 'var(--success-500)', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'inline-flex', cursor: 'pointer' }}>
            <XIcon size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

// ---- Quote email generator -------------------------------------------------
function generateQuoteEmail(project, sheet, allAreas, allLines, allPoints, vendor, sqft, fSq, lnft, fLn, topsoilType, topsoilCustom, areaDepth) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const addr = project.address || 'address on file'
  const vendorName = vendor || '[Vendor Name]'
  const topsoilLabel = topsoilType === 'custom' ? topsoilCustom || 'custom topsoil' : topsoilType === 'none' ? null : { enriched: 'Enriched topsoil', sandy_loam: 'Sandy loam', '4way': '4-way mix' }[topsoilType]
  const depthIn = parseFloat(areaDepth) || 0

  const areaLines = allAreas.map(a => {
    const sf = sqft(polyAreaPx(a.poly))
    const cy = depthIn > 0 ? ((sf * (depthIn/12))/27).toFixed(1) : null
    return `  - ${a.name || a.type}: ${fSq(sf)} sq ft${cy ? ` / ${cy} CY` : ''}${depthIn ? ` @ ${depthIn}" depth` : ''}`
  })
  const lineLines = allLines.map(l => `  - ${l.name || l.type}: ${fLn(lnft(perimPx(l.pts)))} ln ft`)
  const ptLines = allPoints.length > 0 ? [`  - ${allPoints.length} item(s): ${allPoints.map(p => p.type).join(', ')}`] : []

  return `Subject: Quote Request – ${project.name} – ${sheet.name}

${today}

To: ${vendorName}

Re: Quote Request for ${project.name}
Job Site Address: ${addr}
Sheet: ${sheet.code} – ${sheet.name}

Hello,

We are currently estimating the above project and would like to request a quote for the following materials/services:

SCOPE OF WORK:
${[...areaLines, ...lineLines, ...ptLines].join('\n') || '  (No items recorded)'}
${topsoilLabel ? `\nTopsoil type requested: ${topsoilLabel}` : ''}
${depthIn > 0 ? `Installation depth: ${depthIn} inches` : ''}

Please provide pricing per unit as well as availability. Let us know if you have any questions or need additional information.

Thank you for your time,

${project.client || '[Your Name]'}
${project.name}`
}

// ---- Select panel ----------------------------------------------------------
function SelectPanel({ selectedArea, selectedPoint, selectedLine, selectedId, selectedKind, onRename, onDelete, onDeselect, sqft, fSq, fLn, lnft, fs }) {
  const [editName, setEditName] = useState('')
  const [editing, setEditing] = useState(false)
  const item = selectedArea || selectedPoint || selectedLine
  const cat = item ? CATS.find(c => c.id === item.type) : null

  useEffect(() => {
    if (item) { setEditName(item.name || ''); setEditing(false) }
  }, [selectedId])

  if (!item) {
    return (
      <>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: `calc(18px * ${fs})`, fontWeight: 600, color: 'var(--text-strong)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MousePointer2 size={18} style={{ color: 'var(--brand-600)' }} /> Select
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)' }}>
            Click any item you drew to select and move it.
          </p>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8, color: 'var(--text-subtle)' }}>
          <MousePointer2 size={32} style={{ opacity: 0.25 }} />
          <span style={{ fontSize: `calc(13px * ${fs})` }}>Nothing selected</span>
        </div>
      </>
    )
  }

  const commitName = () => {
    if (editName.trim()) onRename(selectedId, selectedKind, editName.trim())
    setEditing(false)
  }

  return (
    <>
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: `calc(18px * ${fs})`, fontWeight: 600, color: 'var(--text-strong)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <MousePointer2 size={18} style={{ color: 'var(--brand-600)' }} /> Selected item
        </h2>
      </div>

      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: selectedKind === 'line' ? 20 : 14,
            height: selectedKind === 'line' ? 4 : 14,
            borderRadius: selectedKind === 'line' ? 2 : 3,
            background: CAT_COLOR[item.type],
            flexShrink: 0,
          }} />
          <span style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', fontWeight: 500 }}>
            {cat?.name || item.type}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: `calc(11px * ${fs})`, fontFamily: 'var(--font-mono)', color: 'var(--text-subtle)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '1px 6px' }}>
            {selectedKind === 'area' ? 'area' : selectedKind === 'line' ? 'linear' : 'item'}
          </span>
        </div>

        <div>
          <div style={{ fontSize: `calc(11px * ${fs})`, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>Name</div>
          {editing ? (
            <input
              value={editName}
              autoFocus
              onChange={e => setEditName(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setEditName(item.name || ''); setEditing(false) } }}
              style={{ width: '100%', fontFamily: 'var(--font-sans)', fontSize: `calc(14px * ${fs})`, fontWeight: 600, border: 'none', outline: '1.5px solid var(--brand-600)', borderRadius: 6, padding: '6px 10px', background: 'var(--surface-paper)', color: 'var(--text-strong)', boxSizing: 'border-box' }}
            />
          ) : (
            <div onClick={() => setEditing(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'text', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--surface-sunken)' }}>
              <span style={{ flex: 1, fontSize: `calc(14px * ${fs})`, fontWeight: 600, color: 'var(--text-strong)' }}>{item.name || '—'}</span>
              <Pencil size={13} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
            </div>
          )}
        </div>

        {selectedKind === 'area' && selectedArea?.poly && (
          <div style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {fSq(sqft(polyAreaPx(selectedArea.poly)))} ft² · {selectedArea.poly.length} vertices
          </div>
        )}
        {selectedKind === 'point' && selectedPoint && (
          <div style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            x: {Math.round(selectedPoint.x)} · y: {Math.round(selectedPoint.y)}
          </div>
        )}
        {selectedKind === 'line' && selectedLine?.pts && (
          <div style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {fLn(lnft(perimPx(selectedLine.pts)))} ln ft · {selectedLine.pts.length} points
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button variant="ghost" fullWidth onClick={onDeselect}>Deselect</Button>
        <Button variant="ghost" fullWidth iconLeft={<Trash2 size={14} />}
          onClick={() => onDelete(selectedId, selectedKind)}
          style={{ color: 'var(--error-500)' }}>
          Delete item
        </Button>
      </div>
    </>
  )
}

// ---- Region panel (legacy - replaced) --------------------------------------
function _OldRegionPanel_UNUSED({ hasRegion, regionSqft, regionPerim, totalPointCount, catActive, regionRes, allPoints, allAreas, sheet, fSq, fLn, sqft, onToggleCat, onReset, onSample, fs, folders, activeFolderId, renamingId, renameVal, onSwitchFolder, onAddFolder, onDeleteFolder, onStartRename, onRenameChange, onCommitRename }) {
  const totalOf = (id) => {
    const cat = CATS.find(c => c.id === id)
    if (!cat) return 0
    if (cat.kind === 'point') return allPoints.filter(p => p.type === id).length
    if (cat.kind === 'area')  return allAreas.filter(a => a.type === id).length
    return (sheet.lines || []).filter(l => l.type === id).length
  }

  const groups = [
    ['Counted items', CATS.filter(c => c.kind === 'point')],
    ['Areas · sq ft', CATS.filter(c => c.kind === 'area')],
    ['Linear · ln ft', CATS.filter(c => c.kind === 'linear')],
  ]

  return (
    <>
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: `calc(18px * ${fs})`, fontWeight: 600, color: 'var(--text-strong)', margin: '0 0 3px', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.01em' }}>
          <Lasso size={18} style={{ color: 'var(--brand-600)', flexShrink: 0 }} /> Region takeoff
        </h2>
        <p style={{ margin: 0, fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Draw an area to count items, clip sq ft, and total walls inside.
        </p>
      </div>

      <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px 4px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(10px * ${fs})`, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)', fontWeight: 600, flex: 1 }}>Breakouts</span>
          <button onClick={onAddFolder} title="Add breakout" className={s.folderAddBtn}><Plus size={12} /></button>
        </div>
        <div style={{ padding: '2px 8px 8px' }}>
          {folders.map(f => {
            const isActive = f.id === activeFolderId
            const area = f.poly ? fSq(sqft(polyAreaPx(f.poly))) : null
            return (
              <div key={f.id} className={s.folderRow} data-active={isActive}
                style={{ '--fc': f.color }} onClick={() => onSwitchFolder(f.id)}>
                <span className={s.folderDot} style={{ background: f.color }} />
                {renamingId === f.id ? (
                  <input className={s.folderRenameInput} value={renameVal} autoFocus
                    onChange={e => onRenameChange(e.target.value)}
                    onBlur={onCommitRename}
                    onKeyDown={e => { if (e.key === 'Enter') onCommitRename(); if (e.key === 'Escape') onCommitRename() }}
                    onClick={e => e.stopPropagation()} />
                ) : (
                  <span className={s.folderName}>{f.name}</span>
                )}
                {area && <span className={s.folderArea}>{area} ft²</span>}
                <span className={s.folderActions}>
                  <button className={s.folderActionBtn} title="Rename"
                    onClick={e => { e.stopPropagation(); onStartRename(f) }}><Pencil size={11} /></button>
                  {folders.length > 1 && (
                    <button className={s.folderActionBtn} title="Delete"
                      onClick={e => { e.stopPropagation(); onDeleteFolder(f.id) }}><Trash2 size={11} /></button>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        {[
          { unit: 'sq ft', label: 'Region area', val: hasRegion ? fSq(regionSqft) : '—', has: hasRegion },
          { unit: 'ln ft', label: 'Perimeter',   val: hasRegion ? fLn(regionPerim) : '—', has: hasRegion },
        ].map(({ unit, label, val, has }) => (
          <div key={unit} style={{ flex: 1, background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
            <div style={{ fontSize: `calc(11px * ${fs})`, color: 'var(--text-muted)' }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(21px * ${fs})`, fontWeight: 700, letterSpacing: '-0.02em', color: has ? 'var(--text-strong)' : 'var(--border-strong)', marginTop: 2, lineHeight: 1 }}>
              {val} <span style={{ fontSize: `calc(10px * ${fs})`, color: 'var(--text-muted)', fontWeight: 500 }}>{unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: '1 1 auto', overflow: 'auto', padding: '4px 12px 12px' }}>
        {groups.map(([label, groupCats]) => (
          <div key={label}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(10px * ${fs})`, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)', padding: '12px 8px 4px' }}>
              {label}
            </div>
            {groupCats.map(c => {
              const off = !catActive.has(c.id)
              const r = regionRes[c.id]
              const zero = !r.count
              const total = totalOf(c.id)
              let val
              if (c.kind === 'point') val = <>{r.count}<span style={{ color: 'var(--text-subtle)', fontWeight: 400, fontSize: `calc(11px * ${fs})` }}> / {total}</span></>
              else if (c.kind === 'area') val = <>{fSq(r.sqft)}<span style={{ color: 'var(--text-subtle)', fontWeight: 400, fontSize: `calc(11px * ${fs})` }}> ft²{r.count ? ` · ${r.count}` : ''}</span></>
              else val = <>{fLn(r.lnft)}<span style={{ color: 'var(--text-subtle)', fontWeight: 400, fontSize: `calc(11px * ${fs})` }}> ft{r.count ? ` · ${r.count}` : ''}</span></>
              return (
                <div key={c.id} onClick={() => onToggleCat(c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', opacity: off ? 0.42 : 1 }}>
                  <span style={{ width: 17, height: 17, borderRadius: 4, border: `1.5px solid ${off ? 'var(--border-strong)' : 'var(--brand-600)'}`, background: off ? 'transparent' : 'var(--brand-600)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {!off && <Check size={11} style={{ color: '#fff' }} />}
                  </span>
                  <span style={{ width: 12, height: c.kind === 'linear' ? 4 : 12, borderRadius: c.kind === 'linear' ? 2 : 3, flexShrink: 0, background: CAT_COLOR[c.id] }} />
                  <span style={{ flex: 1, fontSize: `calc(13px * ${fs})`, fontWeight: 500, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(13px * ${fs})`, fontWeight: 600, color: (zero && !off) ? 'var(--text-subtle)' : 'var(--text-strong)', textAlign: 'right', whiteSpace: 'nowrap' }}>{val}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 10 }}>
        <Button variant="secondary" fullWidth iconLeft={<Sparkles size={14} />} onClick={onSample}>Try sample region</Button>
        <Button variant="ghost" iconLeft={<Eraser size={14} />} onClick={onReset}>Clear</Button>
      </div>
    </>
  )
}

// ---- Area draw panel -------------------------------------------------------
const TOPSOIL_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'enriched', label: 'Enriched topsoil' },
  { value: 'sandy_loam', label: 'Sandy loam' },
  { value: '4way', label: '4 way mix' },
  { value: 'custom', label: 'Custom…' },
]

function RegionPanel({ folders, activeFolderId, renamingId, renameVal, onSwitch, onAdd, onDelete,
  onStartRename, onCommitRename, onRenameVal, hasRegion, regionSqft, regionPerim,
  fSq, fLn, isDrawingRegion, onExportMTO,
  countGroups, areaGroups, linearGroups, addedAreas, addedLines, sqft, lnft }) {
  const activeFolder = folders.find(f => f.id === activeFolderId)
  const poly = activeFolder?.poly

  // Per-group breakdown for the active region polygon
  const countResults = (countGroups || []).map(g => ({
    id: g.id, name: g.name, color: g.color,
    count: poly && poly.length >= 3 ? g.points.filter(p => inside(p, poly)).length : 0,
  })).filter(r => r.count > 0)

  const areaResults = (areaGroups || []).map(g => {
    const groupAreas = (addedAreas || []).filter(a => a.groupId === g.id)
    const totalSqft = poly && poly.length >= 3
      ? groupAreas.reduce((s, a) => { const cp = clipPx2(a.poly, poly, 4); return s + sqft(cp.px2) }, 0)
      : 0
    return { id: g.id, name: g.name, color: g.color, sqft: totalSqft }
  }).filter(r => r.sqft > 0)

  const linearResults = (linearGroups || []).map(g => {
    const groupLines = (addedLines || []).filter(l => l.groupId === g.id)
    const totalLnft = poly && poly.length >= 3
      ? groupLines.reduce((s, l) => { const lc = centroid(l.pts); return inside(lc, poly) ? s + lnft(perimPx(l.pts)) : s }, 0)
      : 0
    return { id: g.id, name: g.name, color: g.color, lnft: totalLnft }
  }).filter(r => r.lnft > 0)

  const activeHasData = countResults.length > 0 || areaResults.length > 0 || linearResults.length > 0
  const totalItems = countResults.reduce((s, r) => s + r.count, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', letterSpacing: 0.2 }}>Regions</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onExportMTO}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'transparent', fontSize: 12, fontWeight: 600, color: 'var(--text-body)', cursor: 'pointer' }}>
            <Download size={12} /> Export MTO
          </button>
          <button onClick={onAdd}
            style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: 'var(--brand-600)', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Region</button>
        </div>
      </div>

      {/* Region list */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', maxHeight: 160, overflowY: 'auto' }}>
        {folders.map(f => (
          <div key={f.id}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', background: f.id === activeFolderId ? 'var(--surface-muted)' : 'transparent', borderLeft: `3px solid ${f.id === activeFolderId ? f.color : 'transparent'}` }}
            onClick={() => onSwitch(f.id)}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: f.color, flexShrink: 0 }} />
            {renamingId === f.id ? (
              <input autoFocus value={renameVal} onChange={e => onRenameVal(e.target.value)}
                onBlur={onCommitRename} onKeyDown={e => { if (e.key === 'Enter') onCommitRename(); if (e.key === 'Escape') onRenameVal(f.name) }}
                style={{ flex: 1, fontSize: 12, fontWeight: 600, border: '1px solid var(--brand-500)', borderRadius: 4, padding: '2px 6px', background: 'var(--surface-card)', color: 'var(--text-strong)' }}
                onClick={e => e.stopPropagation()} />
            ) : (
              <span style={{ flex: 1, fontSize: 12, fontWeight: f.id === activeFolderId ? 700 : 500, color: 'var(--text-strong)' }}
                onDoubleClick={e => { e.stopPropagation(); onStartRename(f) }}>{f.name}</span>
            )}
            {f.poly && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>✓</span>}
            {folders.length > 1 && (
              <button onClick={e => { e.stopPropagation(); onDelete(f.id) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: 2, display: 'flex' }}>
                <Trash2 size={11} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Active region results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {isDrawingRegion ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
            <Lasso size={24} style={{ marginBottom: 10, opacity: 0.4 }} />
            <div>Click to draw region boundary</div>
            <div style={{ marginTop: 4, opacity: 0.7 }}>Click first point or press Enter to close</div>
          </div>
        ) : !activeFolder?.poly ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
            <Lasso size={24} style={{ marginBottom: 10, opacity: 0.4 }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{activeFolder?.name}</div>
            <div>Draw a boundary on the canvas to count items inside</div>
          </div>
        ) : activeHasData ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              <div style={{ background: 'var(--surface-sunken)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-strong)' }}>{fSq(regionSqft)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>sq ft area</div>
              </div>
              <div style={{ background: 'var(--surface-sunken)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-strong)' }}>{fLn(regionPerim)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>ln ft perim</div>
              </div>
              <div style={{ background: 'var(--surface-sunken)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-strong)' }}>{totalItems}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>items</div>
              </div>
            </div>
            {countResults.length > 0 && <>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Counts</div>
              {countResults.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color || 'var(--brand-500)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text-body)' }}>{r.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}>×{r.count}</span>
                </div>
              ))}
            </>}
            {areaResults.length > 0 && <>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, margin: '12px 0 6px' }}>Areas</div>
              {areaResults.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: r.color || 'var(--brand-500)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text-body)' }}>{r.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}>{fSq(r.sqft)} sf</span>
                </div>
              ))}
            </>}
            {linearResults.length > 0 && <>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, margin: '12px 0 6px' }}>Linear</div>
              {linearResults.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ width: 14, height: 4, borderRadius: 2, background: r.color || 'var(--brand-500)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text-body)' }}>{r.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-strong)' }}>{fLn(r.lnft)} lf</span>
                </div>
              ))}
            </>}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
            <Check size={24} style={{ marginBottom: 10, opacity: 0.4 }} />
            <div>Region drawn — no items found inside</div>
          </div>
        )}
      </div>
    </div>
  )
}

function AreaPanel({ areaType, onSetAreaType, addedAreas, sqft, fSq, onClearAdded, fs,
  areaDepth, onSetDepth, topsoilType, onSetTopsoil, topsoilCustom, onSetTopsoilCustom }) {
  const totalSqft = addedAreas.reduce((s, a) => s + sqft(polyAreaPx(a.poly)), 0)
  const depthIn = parseFloat(areaDepth) || 0
  const totalCY = depthIn > 0 ? (totalSqft * (depthIn / 12)) / 27 : 0

  return (
    <>
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: `calc(18px * ${fs})`, fontWeight: 600, color: 'var(--text-strong)', margin: '0 0 3px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <SquareDashed size={18} style={{ color: 'var(--brand-600)', flexShrink: 0 }} /> Draw area
        </h2>
        <p style={{ margin: 0, fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Click to place vertices · <b>A</b> for arc segment · click first point or <b>Enter</b> to close.
        </p>
      </div>

      {/* Depth & Topsoil */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', fontWeight: 600, minWidth: 52 }}>Depth</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
            <input type="number" min="0" step="0.5" placeholder="0" value={areaDepth}
              onChange={e => onSetDepth(e.target.value)}
              style={{ width: 64, padding: '5px 8px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: `calc(13px * ${fs})`, background: 'var(--surface-card)', color: 'var(--text-strong)' }} />
            <span style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)' }}>inches</span>
            {totalCY > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(12px * ${fs})`, fontWeight: 700, color: 'var(--brand-600)', marginLeft: 'auto' }}>{totalCY.toFixed(1)} CY</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', fontWeight: 600, minWidth: 52 }}>Topsoil</label>
          <select value={topsoilType} onChange={e => onSetTopsoil(e.target.value)}
            style={{ flex: 1, padding: '5px 8px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: `calc(13px * ${fs})`, background: 'var(--surface-card)', color: 'var(--text-strong)' }}>
            {TOPSOIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {topsoilType === 'custom' && (
          <input placeholder="Describe topsoil type…" value={topsoilCustom} onChange={e => onSetTopsoilCustom(e.target.value)}
            style={{ padding: '5px 8px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: `calc(13px * ${fs})`, background: 'var(--surface-card)', color: 'var(--text-strong)' }} />
        )}
      </div>

      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: `calc(11px * ${fs})`, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>Area type</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {AREA_CATS.map(c => (
            <button key={c.id} onClick={() => onSetAreaType(c.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${areaType === c.id ? CAT_COLOR[c.id] : 'transparent'}`, background: areaType === c.id ? `${CAT_COLOR[c.id]}1a` : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: CAT_COLOR[c.id], flexShrink: 0 }} />
              <span style={{ fontSize: `calc(13px * ${fs})`, fontWeight: 500, color: 'var(--text-strong)', flex: 1 }}>{c.name}</span>
              {areaType === c.id && <Check size={13} style={{ color: CAT_COLOR[c.id] }} />}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: '1 1 auto', overflow: 'auto', padding: '8px 12px 12px' }}>
        {addedAreas.length === 0 ? (
          <div style={{ padding: '28px 8px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: `calc(13px * ${fs})` }}>
            No areas added yet — draw on the plan.
          </div>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(10px * ${fs})`, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)', padding: '8px 8px 4px' }}>
              Added · {addedAreas.length}
            </div>
            {addedAreas.map(a => {
              const cat = CATS.find(c => c.id === a.type)
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ width: 13, height: 13, borderRadius: 3, background: CAT_COLOR[a.type], flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: `calc(13px * ${fs})`, color: 'var(--text-strong)', fontWeight: 500 }}>{a.name || cat?.name || a.type}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)' }}>
                    {fSq(sqft(polyAreaPx(a.poly)))} ft²
                    {depthIn > 0 && <span style={{ color: 'var(--brand-600)', display: 'block', fontSize: `calc(11px * ${fs})` }}>{((sqft(polyAreaPx(a.poly)) * (depthIn/12))/27).toFixed(1)} CY</span>}
                  </span>
                </div>
              )
            })}
          </>
        )}
      </div>

      {addedAreas.length > 0 && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-subtle)' }}>
          <Button variant="ghost" fullWidth iconLeft={<Eraser size={14} />} onClick={onClearAdded}>Clear added areas</Button>
        </div>
      )}
    </>
  )
}

// ---- Linear draw panel -----------------------------------------------------
function LinearPanel({ linearType, onSetLinearType, addedLines, lnft, fLn, onClearAdded, fs }) {
  return (
    <>
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: `calc(18px * ${fs})`, fontWeight: 600, color: 'var(--text-strong)', margin: '0 0 3px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Spline size={18} style={{ color: 'var(--brand-600)', flexShrink: 0 }} /> Draw linear
        </h2>
        <p style={{ margin: 0, fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Click to place points · <b>A</b> for arc segment · double-click or <b>Enter</b> to finish.
        </p>
      </div>

      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: `calc(11px * ${fs})`, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>Line type</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {LINEAR_CATS.map(c => (
            <button key={c.id} onClick={() => onSetLinearType(c.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${linearType === c.id ? CAT_COLOR[c.id] : 'transparent'}`, background: linearType === c.id ? `${CAT_COLOR[c.id]}1a` : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ width: 20, height: 4, borderRadius: 2, background: CAT_COLOR[c.id], flexShrink: 0 }} />
              <span style={{ fontSize: `calc(13px * ${fs})`, fontWeight: 500, color: 'var(--text-strong)', flex: 1 }}>{c.name}</span>
              {linearType === c.id && <Check size={13} style={{ color: CAT_COLOR[c.id] }} />}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: '1 1 auto', overflow: 'auto', padding: '8px 12px 12px' }}>
        {addedLines.length === 0 ? (
          <div style={{ padding: '28px 8px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: `calc(13px * ${fs})` }}>
            No lines added yet — draw on the plan.
          </div>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(10px * ${fs})`, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)', padding: '8px 8px 4px' }}>
              Added · {addedLines.length}
            </div>
            {addedLines.map(l => {
              const cat = CATS.find(c => c.id === l.type)
              return (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ width: 20, height: 4, borderRadius: 2, background: CAT_COLOR[l.type], flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: `calc(13px * ${fs})`, color: 'var(--text-strong)', fontWeight: 500 }}>{l.name || cat?.name || l.type}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)' }}>
                    {fLn(lnft(perimPx(l.pts)))} ft
                  </span>
                </div>
              )
            })}
          </>
        )}
      </div>

      {addedLines.length > 0 && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-subtle)' }}>
          <Button variant="ghost" fullWidth iconLeft={<Eraser size={14} />} onClick={onClearAdded}>Clear added lines</Button>
        </div>
      )}
    </>
  )
}

// ---- Count placement panel -------------------------------------------------
function CountPanel({ countType, onSetCountType, addedPoints, countGroups, activeCountGroupId, onSetActiveGroup, onClearAdded, fs }) {
  const byType = {}
  COUNT_CATS.forEach(c => { byType[c.id] = 0 })
  addedPoints.forEach(p => { if (byType[p.type] !== undefined) byType[p.type]++ })
  const activeGroup = countGroups.find(g => g.id === activeCountGroupId)

  return (
    <>
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: `calc(18px * ${fs})`, fontWeight: 600, color: 'var(--text-strong)', margin: '0 0 3px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={18} style={{ color: 'var(--brand-600)', flexShrink: 0 }} /> Place items
        </h2>
        <p style={{ margin: 0, fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Each time you activate Count, a new count group is created.
        </p>
      </div>

      {/* Count Groups List */}
      {countGroups.length > 0 && (
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: `calc(11px * ${fs})`, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Count groups</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 160, overflowY: 'auto' }}>
            {countGroups.map(g => (
              <button key={g.id} onClick={() => onSetActiveGroup(g.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${g.id === activeCountGroupId ? 'var(--brand-500)' : 'transparent'}`, background: g.id === activeCountGroupId ? 'var(--surface-muted)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: CAT_COLOR[g.type] || 'var(--brand-500)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: `calc(12px * ${fs})`, fontWeight: 500, color: 'var(--text-strong)' }}>{g.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(12px * ${fs})`, fontWeight: 700, color: 'var(--text-muted)' }}>{g.points.length}</span>
                {g.id === activeCountGroupId && <Check size={12} style={{ color: 'var(--brand-600)', flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: `calc(11px * ${fs})`, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>Item type {activeGroup ? `(for ${activeGroup.name})` : ''}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {COUNT_CATS.map(c => (
            <button key={c.id} onClick={() => onSetCountType(c.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${countType === c.id ? CAT_COLOR[c.id] : 'transparent'}`, background: countType === c.id ? `${CAT_COLOR[c.id]}1a` : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: CAT_COLOR[c.id], flexShrink: 0 }} />
              <span style={{ fontSize: `calc(13px * ${fs})`, fontWeight: 500, color: 'var(--text-strong)', flex: 1 }}>{c.name}</span>
              {byType[c.id] > 0 && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(11px * ${fs})`, fontWeight: 700, color: CAT_COLOR[c.id] }}>+{byType[c.id]}</span>
              )}
              {countType === c.id && <Check size={13} style={{ color: CAT_COLOR[c.id], flexShrink: 0 }} />}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: '1 1 auto', overflow: 'auto', padding: '16px 20px' }}>
        {addedPoints.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-subtle)', fontSize: `calc(13px * ${fs})`, paddingTop: 20 }}>
            No items placed yet — click on the plan.
          </div>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(32px * ${fs})`, fontWeight: 700, color: 'var(--text-strong)', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {addedPoints.length}
            </div>
            <div style={{ fontSize: `calc(13px * ${fs})`, color: 'var(--text-muted)', marginTop: 4, marginBottom: 16 }}>
              total items placed
            </div>
            {COUNT_CATS.filter(c => byType[c.id] > 0).map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: CAT_COLOR[c.id], flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: `calc(13px * ${fs})`, color: 'var(--text-strong)', fontWeight: 500 }}>{c.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(14px * ${fs})`, fontWeight: 700, color: 'var(--text-strong)' }}>{byType[c.id]}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {addedPoints.length > 0 && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-subtle)' }}>
          <Button variant="ghost" fullWidth iconLeft={<Eraser size={14} />} onClick={onClearAdded}>Clear all count groups</Button>
        </div>
      )}
    </>
  )
}

const MEASURE_COLORS = ['#e11d48','#2563eb','#16a34a','#d97706','#7c3aed','#0891b2','#ea580c','#0f172a']

// ---- Measure panel ---------------------------------------------------------
function MeasurePanel({ sessions, segments, totalFt, fLn, lnft, dist, onReset, fs, color, onColorChange, measureSize, onMeasureSizeChange }) {
  const grandTotal = sessions.reduce((s, sess) => {
    const segs = sess.pts.slice(0, -1).map((a, k) => lnft(dist(a, sess.pts[k+1])))
    return s + segs.reduce((x, v) => x + v, 0)
  }, 0) + totalFt

  return (
    <>
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: `calc(18px * ${fs})`, fontWeight: 600, color: 'var(--text-strong)', margin: '0 0 3px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Ruler size={18} style={{ color, flexShrink: 0 }} /> Measure
        </h2>
        <p style={{ margin: 0, fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Click points · <b>Enter</b> to save &amp; start new · <b>Esc</b> to clear all
        </p>
      </div>

      {/* Color + size controls */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: `calc(11px * ${fs})`, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 42 }}>Color</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MEASURE_COLORS.map(c => (
              <button key={c} onClick={() => onColorChange(c)}
                style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: `3px solid ${color === c ? 'var(--text-strong)' : 'transparent'}`, cursor: 'pointer', padding: 0, outline: 'none', flexShrink: 0 }} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: `calc(11px * ${fs})`, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 42 }}>Size</span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ft</span>
          <input type="range" min="0.3" max="3" step="0.1" value={measureSize}
            style={{ flex: 1, accentColor: color }}
            onChange={e => onMeasureSizeChange(parseFloat(e.target.value))} />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-muted)' }}>ft</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(11px * ${fs})`, minWidth: 28, textAlign: 'right', color: 'var(--text-strong)' }}>{measureSize.toFixed(1)}×</span>
        </div>
      </div>

      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(30px * ${fs})`, fontWeight: 700, color: grandTotal > 0 ? 'var(--text-strong)' : 'var(--border-strong)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {fLn(grandTotal)}
        </div>
        <div style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', marginTop: 3 }}>
          total ln ft · {sessions.length + (segments.length > 0 ? 1 : 0)} measurement{sessions.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div style={{ flex: '1 1 auto', overflow: 'auto', padding: '8px 12px 12px' }}>
        {/* Completed sessions */}
        {sessions.map((sess, si) => {
          const segs = sess.pts.slice(0, -1).map((a, k) => ({ a, b: sess.pts[k+1], ft: lnft(dist(a, sess.pts[k+1])) }))
          const total = segs.reduce((s, sg) => s + sg.ft, 0)
          return (
            <div key={si} style={{ marginBottom: 8, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--surface-sunken)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: sess.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: `calc(12px * ${fs})`, fontWeight: 600, color: 'var(--text-muted)' }}>Measurement {si + 1}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(13px * ${fs})`, fontWeight: 700, color: 'var(--text-strong)' }}>{fLn(total)} ft</span>
              </div>
              {segs.map((seg, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', borderTop: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: `calc(11px * ${fs})`, color: 'var(--text-subtle)' }}>Seg {i + 1}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)' }}>{fLn(seg.ft)} ft</span>
                </div>
              ))}
            </div>
          )
        })}

        {/* In-progress */}
        {segments.length > 0 && (
          <div style={{ borderRadius: 'var(--radius-md)', border: `1.5px dashed ${color}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: `${color}12` }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: `calc(12px * ${fs})`, fontWeight: 600, color: 'var(--text-muted)' }}>In progress…</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(13px * ${fs})`, fontWeight: 700, color }}>
                {fLn(totalFt)} ft
              </span>
            </div>
            {segments.map((seg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: `calc(11px * ${fs})`, color: 'var(--text-subtle)' }}>Seg {i + 1}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)' }}>{fLn(seg.ft)} ft</span>
              </div>
            ))}
          </div>
        )}

        {sessions.length === 0 && segments.length === 0 && (
          <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: `calc(13px * ${fs})` }}>
            No measurements yet — click on the plan to start.
          </div>
        )}
      </div>

      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-subtle)' }}>
        <Button variant="ghost" fullWidth iconLeft={<Eraser size={14} />} onClick={onReset}>Clear all measurements</Button>
      </div>
    </>
  )
}

// ---- Default panel (click to activate) ------------------------------------
function DefaultPanel({ sheet, allAreas, allPoints, allLines, onActivate, onExport, fs }) {
  return (
    <>
      <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: `calc(16px * ${fs})`, fontWeight: 600, color: 'var(--text-strong)' }}>Items on sheet</div>
        <div style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', marginTop: 2 }}>Click a type to start drawing with it</div>
      </div>
      <div style={{ flex: '1 1 auto', overflow: 'auto', padding: '8px 12px 12px' }}>
        {CATS.map(cat => {
          const items = cat.kind === 'point' ? allPoints.filter(p => p.type === cat.id)
            : cat.kind === 'area' ? allAreas.filter(a => a.type === cat.id)
            : allLines.filter(l => l.type === cat.id)
          if (items.length === 0) return null
          return (
            <div key={cat.id}
              onClick={() => onActivate(cat.kind, cat.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'background var(--dur-fast)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-sunken)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <span style={{ width: 12, height: cat.kind === 'linear' ? 4 : 12, borderRadius: cat.kind === 'linear' ? 2 : 3, background: CAT_COLOR[cat.id], flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: `calc(13.5px * ${fs})`, color: 'var(--text-strong)', fontWeight: 500 }}>{cat.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(13px * ${fs})`, fontWeight: 600, color: 'var(--text-muted)' }}>
                {items.length} {cat.kind === 'area' ? 'area'+(items.length!==1?'s':'') : cat.kind === 'linear' ? 'wall'+(items.length!==1?'s':'') : 'ea'}
              </span>
              <ChevronRight size={13} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
            </div>
          )
        })}
      </div>
      <div style={{ padding: 'var(--space-6)', borderTop: '1px solid var(--border-subtle)' }}>
        <Button variant="primary" fullWidth iconLeft={<FileDown size={15} />} onClick={onExport}>Export estimate</Button>
      </div>
    </>
  )
}

// ---- Conditions (always-visible counts/areas) panel ------------------------
function ConditionsPanel({ countGroups, activeCountGroupId, onSetActiveCountGroup, linearGroups, activeLinearGroupId, onSetActiveLinearGroup, areaGroups, activeAreaGroupId, onSetActiveAreaGroup, addedAreas, addedPoints, addedLines, sqft, fSq, lnft, fLn, areaDepth, topsoilType, topsoilCustom, onNewCount, onNewArea, onNewLinear, onDeleteCountGroup, onDeleteAreaGroup, onDeleteLinearGroup, onEditGroup, fs }) {
  const depthIn = parseFloat(areaDepth) || 0
  const totalCountItems = addedPoints.length
  const totalAreaSqft = addedAreas.reduce((s, a) => s + sqft(polyAreaPx(a.poly)), 0)
  const totalLinearFt = addedLines.reduce((s, l) => s + (l.pts ? perimPx(l.pts) / 4 : 0), 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ fontSize: `calc(11px * ${fs})`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', marginBottom: 10 }}>Conditions</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onNewCount}
            style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1.5px dashed var(--border-default)', background: 'transparent', fontSize: `calc(11px * ${fs})`, fontWeight: 600, color: 'var(--brand-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <MapPin size={12} /> Count
          </button>
          <button onClick={onNewLinear}
            style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1.5px dashed var(--border-default)', background: 'transparent', fontSize: `calc(11px * ${fs})`, fontWeight: 600, color: 'var(--brand-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Spline size={12} /> Linear
          </button>
          <button onClick={onNewArea}
            style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1.5px dashed var(--border-default)', background: 'transparent', fontSize: `calc(11px * ${fs})`, fontWeight: 600, color: 'var(--brand-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <SquareDashed size={12} /> Area
          </button>
        </div>
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 12px' }}>
        {/* Count groups */}
        {countGroups.length > 0 && (
          <>
            <div style={{ fontSize: `calc(10px * ${fs})`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', padding: '8px 4px 4px' }}>Counts</div>
            {countGroups.map(g => (
              <div key={g.id} onClick={() => onSetActiveCountGroup(g.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, marginBottom: 2, border: `1.5px solid ${g.id === activeCountGroupId ? g.color : 'transparent'}`, background: g.id === activeCountGroupId ? `${g.color}18` : 'transparent', cursor: 'pointer' }}>
                <span style={{ width: 12, height: 12, borderRadius: g.shape === 'square' ? 2 : g.shape === 'diamond' ? 0 : '50%', background: g.color, flexShrink: 0, rotate: g.shape === 'diamond' ? '45deg' : undefined }} />
                <span style={{ flex: 1, fontSize: `calc(13px * ${fs})`, fontWeight: 600, color: 'var(--text-strong)' }}>{g.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(13px * ${fs})`, fontWeight: 700, color: g.color }}>{g.points.length}</span>
                <button onClick={e => { e.stopPropagation(); onEditGroup('count', g) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: 2, display: 'inline-flex' }}>
                  <Pencil size={11} />
                </button>
                <button onClick={e => { e.stopPropagation(); onDeleteCountGroup(g.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: 2, display: 'inline-flex' }}>
                  <XIcon size={12} />
                </button>
              </div>
            ))}
          </>
        )}

        {/* Linear groups */}
        {linearGroups.length > 0 && (
          <>
            <div style={{ fontSize: `calc(10px * ${fs})`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', padding: '8px 4px 4px' }}>Linear</div>
            {linearGroups.map(g => {
              const groupLines = addedLines.filter(l => l.groupId === g.id)
              const groupLnft = groupLines.reduce((s, l) => s + (l.pts ? perimPx(l.pts) / 4 : 0), 0)
              return (
                <div key={g.id} onClick={() => onSetActiveLinearGroup(g.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, marginBottom: 2, border: `1.5px solid ${g.id === activeLinearGroupId ? g.color : 'transparent'}`, background: g.id === activeLinearGroupId ? `${g.color}18` : 'transparent', cursor: 'pointer' }}>
                  <span style={{ width: 20, height: 4, borderRadius: 2, background: g.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: `calc(13px * ${fs})`, fontWeight: 600, color: 'var(--text-strong)' }}>{g.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(11px * ${fs})`, fontWeight: 700, color: g.color }}>{groupLnft > 0 ? `${groupLnft.toFixed(0)} ft` : '0'}</span>
                  <button onClick={e => { e.stopPropagation(); onEditGroup('linear', g) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: 2, display: 'inline-flex' }}>
                    <Pencil size={11} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); onDeleteLinearGroup(g.id) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: 2, display: 'inline-flex' }}>
                    <XIcon size={12} />
                  </button>
                </div>
              )
            })}
          </>
        )}

        {/* Area groups */}
        {areaGroups.length > 0 && (
          <>
            <div style={{ fontSize: `calc(10px * ${fs})`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', padding: '8px 4px 4px' }}>Areas</div>
            {areaGroups.map(g => {
              const groupAreas = addedAreas.filter(a => a.groupId === g.id)
              const groupSqft = groupAreas.reduce((s, a) => s + sqft(polyAreaPx(a.poly)), 0)
              return (
                <div key={g.id} onClick={() => onSetActiveAreaGroup(g.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, marginBottom: 2, border: `1.5px solid ${g.id === activeAreaGroupId ? g.color : 'transparent'}`, background: g.id === activeAreaGroupId ? `${g.color}18` : 'transparent', cursor: 'pointer' }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: g.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: `calc(13px * ${fs})`, fontWeight: 600, color: 'var(--text-strong)' }}>{g.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(11px * ${fs})`, fontWeight: 700, color: g.color }}>{groupSqft > 0 ? `${fSq(groupSqft)} ft²` : '0'}</span>
                  <button onClick={e => { e.stopPropagation(); onEditGroup('area', g) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: 2, display: 'inline-flex' }}>
                    <Pencil size={11} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); onDeleteAreaGroup(g.id) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: 2, display: 'inline-flex' }}>
                    <XIcon size={12} />
                  </button>
                </div>
              )
            })}
          </>
        )}

        {countGroups.length === 0 && areaGroups.length === 0 && linearGroups.length === 0 && (
          <div style={{ padding: '32px 8px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: `calc(13px * ${fs})` }}>
            No conditions yet.<br />Use the buttons above to start.
          </div>
        )}

        {/* Summary totals */}
        {(totalCountItems > 0 || totalAreaSqft > 0) && (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}>
            {totalCountItems > 0 && <div style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)' }}><b style={{ color: 'var(--text-strong)' }}>{totalCountItems}</b> total items</div>}
            {totalAreaSqft > 0 && <div style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', marginTop: 3 }}><b style={{ color: 'var(--text-strong)' }}>{fSq(totalAreaSqft)}</b> sq ft total</div>}
            {depthIn > 0 && totalAreaSqft > 0 && <div style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--brand-600)', marginTop: 3, fontWeight: 700 }}>{((totalAreaSqft * (depthIn/12))/27).toFixed(1)} CY</div>}
          </div>
        )}
      </div>
    </div>
  )
}
