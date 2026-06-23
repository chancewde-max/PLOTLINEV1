import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Minus, Plus, Hand, SquareDashed, Spline, MapPin,
  Ruler, Lasso, Eye, EyeOff, Check, TriangleAlert, Sun, Moon,
  Settings2, FileDown, Share2, ChevronRight, Eraser, Sparkles,
  X as XIcon, Map, Pencil, Trash2, MousePointer2, Layers,
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
  pine:   { 50:'#eef7f2', 500:'#258c62', 600:'#157a52', 700:'#0f6243', label:'Pine' },
  ocean:  { 50:'#e8f0fe', 500:'#3b82f6', 600:'#2563eb', 700:'#1d4ed8', label:'Ocean' },
  violet: { 50:'#f1ebfe', 500:'#8b5cf6', 600:'#7c3aed', 700:'#6d28d9', label:'Violet' },
  amber:  { 50:'#fdf4e3', 500:'#f59e0b', 600:'#d97706', 700:'#b45309', label:'Amber' },
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

const AREA_CATS   = CATS.filter(c => c.kind === 'area')
const COUNT_CATS  = CATS.filter(c => c.kind === 'point')
const LINEAR_CATS = CATS.filter(c => c.kind === 'linear')

function singularize(name) {
  return name.replace(/s\s*$/, '').trim()
}

function buildAreaPath(poly, arcSegs = {}) {
  if (!poly || poly.length < 2) return ''
  let d = `M ${poly[0].x} ${poly[0].y}`
  for (let i = 1; i < poly.length; i++) {
    const S = poly[i - 1], E = poly[i]
    if (arcSegs[i - 1]) {
      const T = arcSegs[i - 1]
      const cx = 2 * T.x - 0.5 * S.x - 0.5 * E.x
      const cy = 2 * T.y - 0.5 * S.y - 0.5 * E.y
      d += ` Q ${cx} ${cy} ${E.x} ${E.y}`
    } else {
      d += ` L ${E.x} ${E.y}`
    }
  }
  const last = poly[poly.length - 1], first = poly[0]
  const closeIdx = poly.length - 1
  if (arcSegs[closeIdx]) {
    const T = arcSegs[closeIdx]
    const cx = 2 * T.x - 0.5 * last.x - 0.5 * first.x
    const cy = 2 * T.y - 0.5 * last.y - 0.5 * first.y
    d += ` Q ${cx} ${cy} ${first.x} ${first.y}`
  }
  return d + ' Z'
}

function buildLinePath(pts, arcSegs = {}) {
  if (!pts || pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const S = pts[i - 1], E = pts[i]
    if (arcSegs[i - 1]) {
      const T = arcSegs[i - 1]
      const cx = 2 * T.x - 0.5 * S.x - 0.5 * E.x
      const cy = 2 * T.y - 0.5 * S.y - 0.5 * E.y
      d += ` Q ${cx} ${cy} ${E.x} ${E.y}`
    } else {
      d += ` L ${E.x} ${E.y}`
    }
  }
  return d
}

export default function SheetPage() {
  const { projectId, sheetId } = useParams()
  const navigate = useNavigate()
  const { projects, sheets } = useAppData()

  // ---- UI state ----
  const [theme, setTheme]       = useState('light')
  const [accent, setAccent]     = useState('pine')
  const [fs, setFs]             = useState(1)
  const [settings, setSettings] = useState(false)
  const [zoom, setZoom]         = useState(100)
  const [panOffset, setPanOffset]   = useState({ x: 0, y: 0 })
  const [leftPanelW, setLeftPanelW]   = useState(264)
  const [rightPanelW, setRightPanelW] = useState(320)
  const [activeTool, setActiveTool] = useState('region')
  const [leftPanel, setLeftPanel]   = useState('layers')
  const [hidden, setHidden]     = useState({})
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
  const [folders, setFolders]       = useState([{ id: 'f1', name: 'Region 1', poly: null, color: FOLDER_PALETTE[0] }])
  const [activeFolderId, setActiveFolderId] = useState('f1')
  const [renamingId, setRenamingId] = useState(null)
  const [renameVal, setRenameVal]   = useState('')

  // ---- Measure tool ----
  const [measurePts, setMeasurePts]     = useState([])
  const [measureDone, setMeasureDone]   = useState(false)
  const [measureCursor, setMeasureCursor] = useState(null)

  // ---- Area tool ----
  const [areaVerts, setAreaVerts]   = useState([])
  const [areaCursor, setAreaCursor] = useState(null)
  const [areaType, setAreaType]     = useState(AREA_CATS[0]?.id || 'sod')
  const [addedAreas, setAddedAreas] = useState([])
  const [areaDepth, setAreaDepth]   = useState('') // inches
  const [topsoilType, setTopsoilType] = useState('none')
  const [topsoilCustom, setTopsoilCustom] = useState('')

  // ---- Linear tool ----
  const [linearVerts, setLinearVerts]   = useState([])
  const [linearCursor, setLinearCursor] = useState(null)
  const [linearType, setLinearType]     = useState(LINEAR_CATS[0]?.id || 'lime-wall')
  const [addedLines, setAddedLines]     = useState([])

  // ---- Arc mode (shared for area + linear) ----
  const [arcMode, setArcMode]               = useState(false)
  const [pendingArcThrough, setPendingArcThrough] = useState(null)
  const arcSegsRef = useRef({})         // for current area drawing
  const linearArcSegsRef = useRef({})  // for current linear drawing

  // ---- Count tool ---- (each activation creates a new count group)
  const [addCountType, setAddCountType] = useState(COUNT_CATS[0]?.id || 'tree')
  const [countGroups, setCountGroups]   = useState([])           // { id, name, type, points[] }
  const [activeCountGroupId, setActiveCountGroupId] = useState(null)
  const countGroupNumRef = useRef(0)

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
  const zoomTargetRef = useRef(100)
  const zoomRafRef = useRef(null)
  const zoomCurrentRef = useRef(100) // tracks actual zoom for pan calc
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const delta = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaMode === 2 ? e.deltaY * 300 : e.deltaY
      const factor = Math.pow(0.999, delta)
      const oldZ = zoomTargetRef.current
      const newZ = Math.max(25, Math.min(400, oldZ * factor))
      zoomTargetRef.current = newZ
      // Zoom to cursor: adjust pan so point under cursor stays fixed
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left - rect.width / 2
      const cy = e.clientY - rect.top - rect.height / 2
      const scale = FIT / 100
      setPanOffset(p => ({
        x: cx - (cx - p.x) * (newZ / oldZ),
        y: cy - (cy - p.y) * (newZ / oldZ),
      }))
      if (!zoomRafRef.current) {
        const animate = () => {
          setZoom(z => {
            const next = z + (zoomTargetRef.current - z) * 0.18
            zoomCurrentRef.current = next
            if (Math.abs(next - zoomTargetRef.current) < 0.1) { zoomRafRef.current = null; return zoomTargetRef.current }
            zoomRafRef.current = requestAnimationFrame(animate)
            return next
          })
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

  // Sync active folder's poly whenever regionClosed changes
  useEffect(() => {
    setFolders(prev => prev.map(f => f.id === activeFolderId ? { ...f, poly: regionClosed } : f))
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
      if (key === 'L') setActiveTool('linear')
      if (key === 'C') {
        countGroupNumRef.current += 1
        const gid = `cg-${Date.now()}`
        const newGroup = { id: gid, name: `Count ${countGroupNumRef.current}`, type: addCountType, points: [] }
        setCountGroups(prev => [...prev, newGroup])
        setActiveCountGroupId(gid)
        setActiveTool('count')
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
        setMeasurePts([]); setMeasureDone(false); setMeasureCursor(null)
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
        setMeasureDone(true); setMeasureCursor(null)
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
    // Grid snap: snap to nearest 10px grid
    if (snapEnabled) {
      const GRID = 10
      x = Math.round(x / GRID) * GRID
      y = Math.round(y / GRID) * GRID
    }
    return { x, y }
  }

  const finishArea = () => {
    if (areaVerts.length < 3) return
    setAddedAreas(prev => {
      undoStackRef.current = [...undoStackRef.current.slice(-19), { type: 'area', state: prev }]
      return [...prev, {
        id: `ua-${Date.now()}`,
        type: areaType,
        name: genName(areaType),
        poly: [...areaVerts],
        arcSegs: { ...arcSegsRef.current },
      }]
    })
    setAreaVerts([]); setAreaCursor(null)
    setArcMode(false); setPendingArcThrough(null)
    arcSegsRef.current = {}
  }

  const finishLine = () => {
    if (linearVerts.length < 2) return
    setAddedLines(prev => {
      undoStackRef.current = [...undoStackRef.current.slice(-19), { type: 'line', state: prev }]
      return [...prev, {
        id: `ul-${Date.now()}`,
        type: linearType,
        name: genName(linearType),
        pts: [...linearVerts],
        arcSegs: { ...linearArcSegsRef.current },
      }]
    })
    setLinearVerts([]); setLinearCursor(null)
    setArcMode(false); setPendingArcThrough(null)
    linearArcSegsRef.current = {}
  }

  // ---- Event handlers ----
  const onMouseDown = (e) => {
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
    // Pan tool
    if (activeTool === 'pan' && isPanningRef.current && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x
      const dy = e.clientY - panStartRef.current.y
      setPanOffset({ x: panOriginRef.current.x + dx, y: panOriginRef.current.y + dy })
      return
    }
    const rawP = toSheet(e)
    const prevMove = activeTool === 'area' && areaVerts.length > 0 ? areaVerts[areaVerts.length - 1]
      : activeTool === 'linear' && linearVerts.length > 0 ? linearVerts[linearVerts.length - 1] : null
    const p = applySnap(rawP, prevMove)
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
      setMeasureDone(true); setMeasureCursor(null)
    }
    if (activeTool === 'linear' && linearVerts.length >= 2) finishLine()
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
      if (arcSegsRef.current[i-1]) {
        const T = arcSegsRef.current[i-1]
        const cx = 2*T.x - 0.5*S.x - 0.5*E.x
        const cy = 2*T.y - 0.5*S.y - 0.5*E.y
        d += ` Q ${cx} ${cy} ${E.x} ${E.y}`
      } else {
        d += ` L ${E.x} ${E.y}`
      }
    }
    if (areaCursor) {
      const lastV = areaVerts[areaVerts.length - 1]
      if (pendingArcThrough) {
        const cx = 2*pendingArcThrough.x - 0.5*lastV.x - 0.5*areaCursor.x
        const cy = 2*pendingArcThrough.y - 0.5*lastV.y - 0.5*areaCursor.y
        d += ` Q ${cx} ${cy} ${areaCursor.x} ${areaCursor.y}`
      } else {
        d += ` L ${areaCursor.x} ${areaCursor.y}`
      }
    }
    return d
  }

  const buildLinearPreviewPath = () => {
    if (linearVerts.length === 0) return ''
    let d = `M ${linearVerts[0].x} ${linearVerts[0].y}`
    for (let i = 1; i < linearVerts.length; i++) {
      const S = linearVerts[i-1], E = linearVerts[i]
      if (linearArcSegsRef.current[i-1]) {
        const T = linearArcSegsRef.current[i-1]
        const cx = 2*T.x - 0.5*S.x - 0.5*E.x
        const cy = 2*T.y - 0.5*S.y - 0.5*E.y
        d += ` Q ${cx} ${cy} ${E.x} ${E.y}`
      } else {
        d += ` L ${E.x} ${E.y}`
      }
    }
    if (linearCursor) {
      const lastV = linearVerts[linearVerts.length - 1]
      if (pendingArcThrough) {
        const cx = 2*pendingArcThrough.x - 0.5*lastV.x - 0.5*linearCursor.x
        const cy = 2*pendingArcThrough.y - 0.5*lastV.y - 0.5*linearCursor.y
        d += ` Q ${cx} ${cy} ${linearCursor.x} ${linearCursor.y}`
      } else {
        d += ` L ${linearCursor.x} ${linearCursor.y}`
      }
    }
    return d
  }

  const layerItems = [
    ...allAreas.map(a => ({ id: a.id, type: a.type, kind: 'area',   label: a.name || CATS.find(c => c.id === a.type)?.name || a.type })),
    ...allLines.map(l => ({ id: l.id, type: l.type, kind: 'linear', label: l.name || CATS.find(c => c.id === l.type)?.name || l.type })),
    ...countGroups.map(g => ({ id: g.id, type: g.type, kind: 'countGroup', label: g.name, count: g.points.length })),
  ]

  const toggleCat   = (id) => setCatActive(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleLayer = (id) => setHidden(h => ({ ...h, [id]: !h[id] }))

  const ac = ACCENTS[accent]
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

  const px2pct = (v, dim) => `calc(50% + ${(v - dim / 2) * (zoom / 100) * FIT}px)`

  const activeFolder = folders.find(f => f.id === activeFolderId)

  const switchFolder = (folderId) => {
    if (folderId === activeFolderId) return
    const target = folders.find(f => f.id === folderId)
    setActiveFolderId(folderId)
    setRegionClosed(target?.poly || null)
    setRegionVerts([]); setRegionCursor(null)
  }
  const addFolder = () => {
    const id = `f${Date.now()}`
    const color = FOLDER_PALETTE[folders.length % FOLDER_PALETTE.length]
    setFolders(prev => [...prev, { id, name: `Region ${prev.length + 1}`, poly: null, color }])
    setActiveFolderId(id)
    setRegionClosed(null); setRegionVerts([]); setRegionCursor(null)
  }
  const deleteFolder = (folderId) => {
    if (folders.length <= 1) return
    const remaining = folders.filter(f => f.id !== folderId)
    setFolders(remaining)
    if (folderId === activeFolderId) {
      const next = remaining[0]
      setActiveFolderId(next.id)
      setRegionClosed(next.poly)
      setRegionVerts([]); setRegionCursor(null)
    }
  }
  const startRename = (folder) => { setRenamingId(folder.id); setRenameVal(folder.name) }
  const commitRename = () => {
    if (renameVal.trim()) setFolders(prev => prev.map(f => f.id === renamingId ? { ...f, name: renameVal.trim() } : f))
    setRenamingId(null)
  }

  const selectedArea  = selectedKind === 'area'  ? addedAreas.find(a => a.id === selectedId) : null
  const selectedPoint = selectedKind === 'point' ? addedPoints.find(p => p.id === selectedId) : null
  const selectedLine  = selectedKind === 'line'  ? addedLines.find(l => l.id === selectedId) : null

  const canvasCursor = activeTool === 'pan' ? 'grab'
    : activeTool === 'select' ? (isDraggingRef.current ? 'grabbing' : 'default')
    : ['region','measure','scale','area','linear','count'].includes(activeTool) ? 'crosshair'
    : 'default'

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
            <span className={s.zoomVal}>{zoom}%</span>
            <button className={s.zoomBtn} onClick={() => setZoom(z => Math.min(400, z + 25))}><Plus size={14} /></button>
          </div>
          <Badge variant="success" dot>Synced</Badge>
          <button className={s.iconBtn} data-on={settings} onClick={() => setSettings(v => !v)}>
            <Settings2 size={17} />
          </button>
          <Button size="sm" variant="secondary" iconLeft={<Share2 size={14} />}>Share</Button>
          <Button size="sm" variant="ghost" iconLeft={<Share2 size={14} />} onClick={() => { setQuoteVendor(''); setQuoteCopied(false); setQuoteOpen(true) }}>Quote email</Button>
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
              {Object.entries(ACCENTS).map(([k, a]) => (
                <button key={k} title={a.label} data-on={accent === k} style={{ background: a[600] }} onClick={() => setAccent(k)}>
                  {accent === k && <Check size={13} />}
                </button>
              ))}
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
        </div>
      )}

      <div className={s.body}>

        <aside className={s.rail}>
          {TOOLS.map((t, i) => {
            if (t === 'sep') return <div key={'sep-' + i} className={s.railSep} />
            const { Icon } = t
            return (
              <Tooltip key={t.id} label={t.label} shortcut={t.k} side="right">
                <button className={s.tool} data-on={activeTool === t.id}
                  onClick={() => {
                    if (t.id === 'count') {
                      // create new count group on each press
                      countGroupNumRef.current += 1
                      const gid = `cg-${Date.now()}`
                      const newGroup = { id: gid, name: `Count ${countGroupNumRef.current}`, type: addCountType, points: [] }
                      setCountGroups(prev => [...prev, newGroup])
                      setActiveCountGroupId(gid)
                    }
                    setActiveTool(t.id)
                  }} aria-label={t.label}>
                  <Icon size={20} />
                  <span className={s.toolKbd}>{t.k}</span>
                </button>
              </Tooltip>
            )
          })}
          <div className={s.railSep} />
          <Tooltip label="Set scale" shortcut="S" side="right">
            <button className={s.tool} data-on={activeTool === 'scale'}
              onClick={() => { setActiveTool('scale'); setScalePts([]) }} aria-label="Set scale">
              <Ruler size={20} />
              <span className={s.toolKbd}>S</span>
            </button>
          </Tooltip>
          <div className={s.railSep} />
          <Tooltip label={`Snap ${snapEnabled ? 'ON' : 'OFF'} (F3)`} side="right">
            <button className={s.tool} data-on={snapEnabled} onClick={() => setSnapEnabled(v => !v)} aria-label="Toggle snap">
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '-0.02em' }}>SNAP</span>
            </button>
          </Tooltip>
          <Tooltip label={`Ortho ${orthoEnabled ? 'ON' : 'OFF'} (F8)`} side="right">
            <button className={s.tool} data-on={orthoEnabled} onClick={() => setOrthoEnabled(v => !v)} aria-label="Toggle ortho">
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '-0.02em' }}>ORTH</span>
            </button>
          </Tooltip>
          <Tooltip label="Page overlay" side="right">
            <button className={s.tool} data-on={!!overlaySheetId} onClick={() => setOverlayDlg(true)} aria-label="Page overlay">
              <Layers size={18} />
            </button>
          </Tooltip>
        </aside>

        <div className={s.leftPanel} style={{ width: leftPanelW, minWidth: 180, maxWidth: 500 }}>
          <div className={s.resizeHandle} style={{ right: -3 }}
            onMouseDown={e => { e.preventDefault(); const startX = e.clientX, startW = leftPanelW; const move = ev => setLeftPanelW(Math.max(180, Math.min(500, startW + ev.clientX - startX))); const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }; window.addEventListener('mousemove', move); window.addEventListener('mouseup', up) }} />
          <div className={s.leftPanelTabs}>
            <Tabs variant="pill" value={leftPanel} onChange={setLeftPanel}
              items={[
                { value: 'layers', label: 'Layers', count: layerItems.length },
                { value: 'sheets', label: 'Sheets', count: (project.sheetIds || []).length },
              ]}
            />
          </div>
          {leftPanel === 'layers' ? (
            <div className={s.scroll}>
              {layerItems.length === 0 && (
                <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12 }}>
                  No layers yet
                </div>
              )}
              {layerItems.map(item => (
                <div key={item.id} className={s.layerRow}
                  style={{ background: item.kind === 'countGroup' && item.id === activeCountGroupId ? 'var(--brand-50)' : undefined }}
                  onClick={item.kind === 'countGroup' ? () => { setActiveCountGroupId(item.id); setActiveTool('count') } : undefined}>
                  <button className={s.eyeBtn} onClick={e => { e.stopPropagation(); toggleLayer(item.id) }}>
                    {hidden[item.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <span className={`${s.layerDot} ${item.kind === 'linear' ? s.layerLine : item.kind === 'countGroup' ? '' : ''}`}
                    style={{ background: CAT_COLOR[item.type] || 'var(--brand-500)', borderRadius: item.kind === 'countGroup' ? '3px' : undefined }} />
                  <span className={s.layerLabel}>{item.label}</span>
                  {item.kind === 'countGroup' && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginLeft: 'auto', paddingRight: 4 }}>{item.count}</span>
                  )}
                </div>
              ))}
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
          onMouseMove={activeTool === 'pan' ? onMouseMove : undefined}
          onMouseUp={activeTool === 'pan' ? onMouseUp : undefined}>
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
              measureDone
                ? <><Ruler size={14} /><span><b>{fLn(measureTotalFt)} ln ft</b> total · {measureSegments.length} seg. <kbd>Esc</kbd> to clear.</span></>
                : measurePts.length === 0
                  ? <><Ruler size={14} /><span><b>Click</b> to start measuring. Double-click or <kbd>Enter</kbd> to finish.</span></>
                  : <><Ruler size={14} /><span>Click to add points · <kbd>Enter</kbd> to finish</span></>
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

          <div className={s.sheetWrap} style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${(zoom / 100) * FIT})`, transition: isPanningRef.current ? 'none' : undefined }}>
            <div className={s.sheet} style={{ width: SHEET_W, height: SHEET_H }}>
              {sheet.pdfUrl && (
                <iframe src={`${sheet.pdfUrl}#view=FitH&toolbar=0&navpanes=0`}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', opacity: 0.6, pointerEvents: 'none', zIndex: 0 }} title="PDF background" />
              )}
              <svg ref={svgRef} className={s.svg} width={SHEET_W} height={SHEET_H}
                viewBox={`0 0 ${SHEET_W} ${SHEET_H}`}
                style={{ cursor: canvasCursor }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onClick={onClick}
                onDoubleClick={onDblClick}>
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
                          fill={CAT_COLOR[a.type]} fillOpacity="0.3" stroke={CAT_COLOR[a.type]} strokeWidth="1.5" />
                      ))}
                      {(ovSheet.lines || []).map(l => (
                        <polyline key={l.id} points={l.pts.map(p => `${p.x},${p.y}`).join(' ')}
                          fill="none" stroke={CAT_COLOR[l.type]} strokeWidth="2" strokeLinecap="round" />
                      ))}
                      {(ovSheet.points || []).map(p => (
                        <circle key={p.id} cx={p.x} cy={p.y} r="5"
                          fill="white" stroke={CAT_COLOR[p.type]} strokeWidth="1.5" />
                      ))}
                    </g>
                  )
                })()}

                {/* Ghost polygons for non-active folders */}
                {activeTool === 'region' && folders.filter(f => f.id !== activeFolderId && f.poly).map(f => (
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
                      fillOpacity={catActive.has(a.type) ? (inRegionMode ? 0.07 : 0.2) : 0.04}
                      stroke={CAT_COLOR[a.type]}
                      strokeOpacity={catActive.has(a.type) ? (inRegionMode ? 0.35 : 0.9) : 0.25}
                      strokeWidth="1.5"
                    />
                  )
                })}

                {/* Added areas (may have arc segs) */}
                {addedAreas.map(a => {
                  if (hidden[a.id]) return null
                  const inRegionMode = activeTool === 'region' && hasRegion
                  const isSelected = selectedId === a.id
                  const hasArcs = a.arcSegs && Object.keys(a.arcSegs).length > 0
                  const fillOp = catActive.has(a.type) ? (inRegionMode ? 0.07 : 0.22) : 0.04
                  const strokeOp = catActive.has(a.type) ? (inRegionMode ? 0.35 : 0.9) : 0.25
                  const sharedProps = {
                    fill: CAT_COLOR[a.type], fillOpacity: fillOp,
                    stroke: isSelected ? '#000' : CAT_COLOR[a.type],
                    strokeOpacity: strokeOp, strokeWidth: isSelected ? '2.5' : '1.5',
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
                            fill={CAT_COLOR[a.type]} fillOpacity="0.34"
                            stroke={CAT_COLOR[a.type]} strokeWidth="2" />
                        : <polygon key={a.id} points={a.poly.map(p => `${p.x},${p.y}`).join(' ')}
                            fill={CAT_COLOR[a.type]} fillOpacity="0.34"
                            stroke={CAT_COLOR[a.type]} strokeWidth="2" />
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
                      strokeOpacity={dim ? 0.3 : 1} strokeWidth={isIn ? 6 : 4}
                      strokeLinecap="round" strokeLinejoin="round" />
                  )
                })}

                {/* Added linear features */}
                {addedLines.map(l => {
                  if (hidden[l.id]) return null
                  const isIn = inLines[l.id]
                  const isSelected = selectedId === l.id
                  const dim = (activeTool === 'region' && hasRegion && !isIn) || !catActive.has(l.type)
                  const hasArcs = l.arcSegs && Object.keys(l.arcSegs).length > 0
                  const pathD = hasArcs ? buildLinePath(l.pts, l.arcSegs) : null
                  const sharedProps = {
                    fill: 'none', stroke: CAT_COLOR[l.type],
                    strokeOpacity: dim ? 0.3 : 1,
                    strokeWidth: isSelected ? 6 : (isIn ? 6 : 4),
                    strokeLinecap: 'round', strokeLinejoin: 'round',
                    strokeDasharray: isSelected ? '8 4' : undefined,
                  }
                  return hasArcs
                    ? <path key={l.id} d={pathD} {...sharedProps} />
                    : <polyline key={l.id} points={l.pts.map(p => `${p.x},${p.y}`).join(' ')} {...sharedProps} />
                })}

                {/* Point items */}
                {allPoints.map(p => {
                  const isIn = inPoints[p.id]
                  const isSelected = selectedId === p.id
                  const dim = (activeTool === 'region' && hasRegion && !isIn) || !catActive.has(p.type)
                  const col = CAT_COLOR[p.type]
                  return (
                    <g key={p.id} opacity={dim ? 0.26 : 1}>
                      {(isIn || isSelected) && <circle cx={p.x} cy={p.y} r="12" fill={col} opacity="0.18" />}
                      <circle cx={p.x} cy={p.y} r={isIn || isSelected ? 7 : 5.5}
                        fill={(isIn || isSelected) ? col : '#fff'} stroke={isSelected ? '#000' : col}
                        strokeWidth={(isIn || isSelected) ? 2.5 : 2} />
                      {(isIn || isSelected) && <circle cx={p.x} cy={p.y} r="2.2" fill="#fff" />}
                    </g>
                  )
                })}

                {/* Selection vertex handles for selected area */}
                {activeTool === 'select' && selectedArea && selectedArea.poly.map((v, i) => (
                  <rect key={i} x={v.x - 5} y={v.y - 5} width="10" height="10"
                    fill="#fff" stroke="#000" strokeWidth="2" style={{ cursor: 'move' }} />
                ))}

                {/* Region outline */}
                {activeTool === 'region' && previewPoly.length >= 2 && (
                  <polygon
                    points={previewPoly.map(p => `${p.x},${p.y}`).join(' ')}
                    fill={activeFolder?.color || 'var(--brand-600)'} fillOpacity="0.04"
                    stroke={activeFolder?.color || 'var(--brand-600)'}
                    strokeWidth="2.5" strokeDasharray={isDrawingRegion ? '7 5' : '0'} strokeLinejoin="round" />
                )}
                {activeTool === 'region' && isDrawingRegion && regionVerts.map((v, i) => (
                  <circle key={i} cx={v.x} cy={v.y}
                    r={i === 0 && regionVerts.length >= 3 ? 7 : 4.5}
                    fill={i === 0 && regionVerts.length >= 3 ? '#fff' : (activeFolder?.color || 'var(--brand-600)')}
                    stroke={activeFolder?.color || 'var(--brand-600)'} strokeWidth="2.5" />
                ))}
                {activeTool === 'region' && !isDrawingRegion && regionPoly.map((v, i) => (
                  <rect key={i} x={v.x - 4} y={v.y - 4} width="8" height="8"
                    fill="#fff" stroke={activeFolder?.color || 'var(--brand-600)'} strokeWidth="2" />
                ))}

                {/* Area drawing overlay */}
                {activeTool === 'area' && areaVerts.length >= 1 && (() => {
                  const pathD = buildAreaPreviewPath()
                  return (
                    <>
                      <path d={pathD}
                        fill={CAT_COLOR[areaType] || '#888'} fillOpacity="0.15"
                        stroke={CAT_COLOR[areaType] || '#888'} strokeWidth="2"
                        strokeDasharray="6 4" strokeLinejoin="round" />
                      {pendingArcThrough && (
                        <circle cx={pendingArcThrough.x} cy={pendingArcThrough.y} r="6"
                          fill={CAT_COLOR[areaType] || '#888'} opacity="0.8" />
                      )}
                      {arcMode && !pendingArcThrough && areaCursor && (
                        <circle cx={areaCursor.x} cy={areaCursor.y} r="5"
                          fill="none" stroke={CAT_COLOR[areaType] || '#888'} strokeWidth="2" strokeDasharray="3 2" />
                      )}
                    </>
                  )
                })()}
                {activeTool === 'area' && areaVerts.map((v, i) => (
                  <circle key={i} cx={v.x} cy={v.y}
                    r={i === 0 && areaVerts.length >= 3 ? 7 : 4}
                    fill={i === 0 && areaVerts.length >= 3 ? '#fff' : (CAT_COLOR[areaType] || '#888')}
                    stroke={CAT_COLOR[areaType] || '#888'} strokeWidth="2" />
                ))}

                {/* Linear drawing overlay */}
                {activeTool === 'linear' && linearVerts.length >= 1 && (() => {
                  const pathD = buildLinearPreviewPath()
                  return (
                    <>
                      <path d={pathD}
                        fill="none"
                        stroke={CAT_COLOR[linearType] || '#888'} strokeWidth="3"
                        strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" />
                      {pendingArcThrough && (
                        <circle cx={pendingArcThrough.x} cy={pendingArcThrough.y} r="6"
                          fill={CAT_COLOR[linearType] || '#888'} opacity="0.8" />
                      )}
                    </>
                  )
                })()}
                {activeTool === 'linear' && linearVerts.map((v, i) => (
                  <g key={i}>
                    <line x1={v.x} y1={v.y - 7} x2={v.x} y2={v.y + 7} stroke={CAT_COLOR[linearType] || '#888'} strokeWidth="2" />
                    <circle cx={v.x} cy={v.y} r="4" fill={CAT_COLOR[linearType] || '#888'} />
                  </g>
                ))}

                {/* Measure tool */}
                {activeTool === 'measure' && (
                  <g>
                    {measureAllPts.length >= 2 && (
                      <polyline points={measureAllPts.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none" stroke="var(--brand-600)" strokeWidth="2.5"
                        strokeDasharray={measureDone ? '0' : '6 4'} strokeLinecap="round" />
                    )}
                    {measureSegments.map((seg, i) => (
                      <text key={i} x={(seg.a.x+seg.b.x)/2} y={(seg.a.y+seg.b.y)/2 - 8}
                        textAnchor="middle" fill="var(--brand-700)"
                        fontFamily="var(--font-mono)" fontSize="11" fontWeight="600">
                        {fLn(seg.ft)} ft
                      </text>
                    ))}
                    {measureAllPts.map((p, i) => (
                      <g key={i}>
                        <line x1={p.x} y1={p.y-9} x2={p.x} y2={p.y+9} stroke="var(--brand-600)" strokeWidth="2" />
                        <circle cx={p.x} cy={p.y} r="4" fill="var(--brand-600)" />
                      </g>
                    ))}
                  </g>
                )}

                {/* Scale line */}
                {activeTool === 'scale' && (() => {
                  const pts = [...scalePts, ...(scalePts.length === 1 && regionCursor ? [regionCursor] : [])]
                  return (
                    <g>
                      {pts.length === 2 && <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} stroke="var(--brand-600)" strokeWidth="2.5" />}
                      {pts.map((p, i) => (
                        <g key={i}>
                          <line x1={p.x} y1={p.y-9} x2={p.x} y2={p.y+9} stroke="var(--brand-600)" strokeWidth="2.5" />
                          <circle cx={p.x} cy={p.y} r="4" fill="var(--brand-600)" />
                        </g>
                      ))}
                    </g>
                  )
                })()}

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

              {/* Item name labels for added items */}
              {(activeTool === 'select' || activeTool === 'area' || activeTool === 'count' || activeTool === 'linear') && addedPoints.map(p => (
                <div key={p.id + '-lbl'} style={{
                  position: 'absolute',
                  left: `${(p.x/SHEET_W)*100}%`,
                  top: `${(p.y/SHEET_H)*100}%`,
                  transform: 'translate(-50%, -120%)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  fontWeight: 600,
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: 'color-mix(in srgb, var(--surface-card) 90%, transparent)',
                  color: CAT_COLOR[p.type],
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  border: `1px solid ${CAT_COLOR[p.type]}40`,
                }}>
                  {p.name}
                </div>
              ))}

              <div className={s.titleBlock}>
                <div className={s.tbRow}><b>{sheet.name.toUpperCase()}</b></div>
                <div className={s.tbRow}>{project.name}</div>
                <div className={s.tbRow}>SHEET {sheet.code}</div>
              </div>
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
              <div className={s.bubble} style={{ left: px2pct(last.x, SHEET_W), top: px2pct(last.y - 28, SHEET_H) }}>
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
            <span className={s.zoomPanVal}>{zoom}%</span>
            <button className={s.zoomPanBtn} onClick={() => setZoom(z => Math.min(400, z + 25))}><Plus size={14} /></button>
          </div>
        </main>

        <aside className={s.rightPanel} style={{ width: rightPanelW, minWidth: 240, maxWidth: 600 }}>
          <div className={s.resizeHandle} style={{ left: -3 }}
            onMouseDown={e => { e.preventDefault(); const startX = e.clientX, startW = rightPanelW; const move = ev => setRightPanelW(Math.max(240, Math.min(600, startW - (ev.clientX - startX)))); const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }; window.addEventListener('mousemove', move); window.addEventListener('mouseup', up) }} />
          {activeTool === 'select' ? (
            <SelectPanel
              selectedArea={selectedArea} selectedPoint={selectedPoint} selectedLine={selectedLine}
              selectedId={selectedId} selectedKind={selectedKind}
              onRename={renameSelected} onDelete={deleteSelected}
              onDeselect={() => { setSelectedId(null); setSelectedKind(null) }}
              sqft={sqft} fSq={fSq} fLn={fLn} lnft={lnft}
              fs={fs} />
          ) : activeTool === 'region' ? (
            <RegionPanel
              hasRegion={hasRegion} regionSqft={regionSqft} regionPerim={regionPerim}
              totalPointCount={totalPointCount} catActive={catActive} regionRes={regionRes}
              allPoints={allPoints} allAreas={allAreas} sheet={sheet}
              fSq={fSq} fLn={fLn} sqft={sqft}
              onToggleCat={toggleCat}
              onReset={() => { setRegionVerts([]); setRegionClosed(null); setRegionCursor(null) }}
              onSample={() => { setRegionVerts([]); setRegionCursor(null); setRegionClosed(SAMPLE_REGION) }}
              fs={fs}
              folders={folders} activeFolderId={activeFolderId}
              renamingId={renamingId} renameVal={renameVal}
              onSwitchFolder={switchFolder} onAddFolder={addFolder} onDeleteFolder={deleteFolder}
              onStartRename={startRename} onRenameChange={setRenameVal} onCommitRename={commitRename}
            />
          ) : activeTool === 'measure' ? (
            <MeasurePanel segments={measureSegments} totalFt={measureTotalFt} fLn={fLn}
              onReset={() => { setMeasurePts([]); setMeasureDone(false); setMeasureCursor(null) }} fs={fs} />
          ) : activeTool === 'area' ? (
            <AreaPanel areaType={areaType} onSetAreaType={setAreaType}
              addedAreas={addedAreas} sqft={sqft} fSq={fSq}
              areaDepth={areaDepth} onSetDepth={setAreaDepth}
              topsoilType={topsoilType} onSetTopsoil={setTopsoilType}
              topsoilCustom={topsoilCustom} onSetTopsoilCustom={setTopsoilCustom}
              onClearAdded={() => setAddedAreas([])} fs={fs} />
          ) : activeTool === 'linear' ? (
            <LinearPanel linearType={linearType} onSetLinearType={setLinearType}
              addedLines={addedLines} lnft={lnft} fLn={fLn}
              onClearAdded={() => setAddedLines([])} fs={fs} />
          ) : activeTool === 'count' ? (
            <CountPanel countType={addCountType} onSetCountType={setAddCountType}
              addedPoints={addedPoints} countGroups={countGroups} activeCountGroupId={activeCountGroupId}
              onSetActiveGroup={setActiveCountGroupId}
              onClearAdded={() => setCountGroups([])} fs={fs} />
          ) : (
            <DefaultPanel sheet={sheet} allAreas={allAreas} allPoints={allPoints} allLines={allLines}
              onActivate={activateType} onExport={() => setExportOpen(true)} fs={fs} />
          )}
        </aside>
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
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${overlaySheetId === id ? 'var(--brand-500)' : 'var(--border-subtle)'}`, background: overlaySheetId === id ? 'var(--brand-50)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
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

// ---- Region panel with breakout folders ------------------------------------
function RegionPanel({ hasRegion, regionSqft, regionPerim, totalPointCount, catActive, regionRes, allPoints, allAreas, sheet, fSq, fLn, sqft, onToggleCat, onReset, onSample, fs, folders, activeFolderId, renamingId, renameVal, onSwitchFolder, onAddFolder, onDeleteFolder, onStartRename, onRenameChange, onCommitRename }) {
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
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${g.id === activeCountGroupId ? 'var(--brand-500)' : 'transparent'}`, background: g.id === activeCountGroupId ? 'var(--brand-50)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
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

// ---- Measure panel ---------------------------------------------------------
function MeasurePanel({ segments, totalFt, fLn, onReset, fs }) {
  return (
    <>
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: `calc(18px * ${fs})`, fontWeight: 600, color: 'var(--text-strong)', margin: '0 0 3px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Ruler size={18} style={{ color: 'var(--brand-600)', flexShrink: 0 }} /> Measure
        </h2>
        <p style={{ margin: 0, fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Click to place points. Double-click or <b>Enter</b> to finish.
        </p>
      </div>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(32px * ${fs})`, fontWeight: 700, color: segments.length > 0 ? 'var(--text-strong)' : 'var(--border-strong)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {fLn(totalFt)}
        </div>
        <div style={{ fontSize: `calc(13px * ${fs})`, color: 'var(--text-muted)', marginTop: 4 }}>
          total ln ft · {segments.length} segment{segments.length !== 1 ? 's' : ''}
        </div>
      </div>
      <div style={{ flex: '1 1 auto', overflow: 'auto', padding: '8px 12px 12px' }}>
        {segments.length === 0 ? (
          <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: `calc(13px * ${fs})` }}>
            No segments yet — click on the plan to start.
          </div>
        ) : segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: `calc(13px * ${fs})`, color: 'var(--text-muted)' }}>Segment {i + 1}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(14px * ${fs})`, fontWeight: 600, color: 'var(--text-strong)' }}>{fLn(seg.ft)} ft</span>
          </div>
        ))}
      </div>
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-subtle)' }}>
        <Button variant="ghost" fullWidth iconLeft={<Eraser size={14} />} onClick={onReset}>Clear measurement</Button>
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
