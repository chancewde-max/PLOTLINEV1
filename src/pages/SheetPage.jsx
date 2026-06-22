import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Minus, Plus, Hand, SquareDashed, Spline, MapPin,
  Ruler, Lasso, Eye, EyeOff, Check, TriangleAlert, Sun, Moon,
  Settings2, FileDown, Share2, ChevronRight, Eraser, Sparkles,
  X as XIcon, Map
} from 'lucide-react'
import { Button } from '../components/ui/Button.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Dialog } from '../components/ui/Dialog.jsx'
import { Input } from '../components/ui/Input.jsx'
import { Select } from '../components/ui/Select.jsx'
import { Checkbox } from '../components/ui/Checkbox.jsx'
import { Tabs } from '../components/ui/Tabs.jsx'
import { Tooltip } from '../components/ui/Tooltip.jsx'
import { PROJECTS, SHEETS, CATS, CAT_COLOR, SHEET_W, SHEET_H } from '../data/sampleData.js'
import { inside, polyAreaPx, perimPx, centroid, clipPx2, dist } from '../workspace/geometry.js'
import s from './SheetPage.module.css'

const TOOLS = [
  { id: 'pan',    label: 'Pan',          Icon: Hand,         k: 'H' },
  { id: 'region', label: 'Region count', Icon: Lasso,        k: 'R' },
  { id: 'measure',label: 'Measure',      Icon: Ruler,        k: 'M' },
  'sep',
  { id: 'area',   label: 'Area',         Icon: SquareDashed, k: 'A' },
  { id: 'linear', label: 'Linear',       Icon: Spline,       k: 'L' },
  { id: 'count',  label: 'Count',        Icon: MapPin,       k: 'C' },
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

export default function SheetPage() {
  const { projectId, sheetId } = useParams()
  const navigate = useNavigate()

  // All hooks must come before any early returns
  const [theme, setTheme]       = useState('light')
  const [accent, setAccent]     = useState('pine')
  const [fs, setFs]             = useState(1)
  const [settings, setSettings] = useState(false)
  const [zoom, setZoom]         = useState(100)
  const [activeTool, setActiveTool] = useState('region')
  const [leftPanel, setLeftPanel]   = useState('layers')
  const [hidden, setHidden]     = useState({})
  const [pxPerFt, setPxPerFt]   = useState(DEFAULT_PXFT)
  const [calib, setCalib]       = useState(null)
  const [scalePts, setScalePts]     = useState([])
  const [scaleDlg, setScaleDlg]     = useState(null)
  const [scaleVal, setScaleVal]     = useState('40')
  const [scaleUnit, setScaleUnit]   = useState('ft')
  const [regionVerts, setRegionVerts]   = useState([])
  const [regionClosed, setRegionClosed] = useState(null)
  const [regionCursor, setRegionCursor] = useState(null)
  const [catActive, setCatActive]   = useState(() => new Set(CATS.map(c => c.id)))
  const [measurePts, setMeasurePts]     = useState([])
  const [measureDone, setMeasureDone]   = useState(false)
  const [measureCursor, setMeasureCursor] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [toast, setToast]       = useState(null)
  const svgRef = useRef(null)

  const project = PROJECTS[projectId]
  const sheet   = SHEETS[sheetId]

  useEffect(() => {
    if (!project || !sheet) return
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const key = e.key.toUpperCase()
      if (key === 'H') setActiveTool('pan')
      if (key === 'R') setActiveTool('region')
      if (key === 'M') setActiveTool('measure')
      if (key === 'A') setActiveTool('area')
      if (key === 'L') setActiveTool('linear')
      if (key === 'C') setActiveTool('count')
      if (key === 'ESCAPE') {
        setRegionVerts([]); setRegionClosed(null); setRegionCursor(null)
        setScalePts([]); setScaleDlg(null)
        setMeasurePts([]); setMeasureDone(false); setMeasureCursor(null)
        setSettings(false)
      }
    }
    const onEnter = (e) => {
      if (e.key !== 'Enter') return
      setRegionClosed(v => v === null
        ? (regionVerts.length >= 3 && activeTool === 'region' ? regionVerts : null)
        : v)
      if (activeTool === 'measure' && !measureDone && measurePts.length >= 2) {
        setMeasureDone(true); setMeasureCursor(null)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keydown', onEnter)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keydown', onEnter)
    }
  }, [project, sheet, activeTool, regionVerts, measureDone, measurePts])

  if (!project || !sheet) {
    return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Sheet not found.</div>
  }

  // ---- coordinate transform ------------------------------------------------
  const toSheet = (e) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    const m = svg.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const p = pt.matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }

  // ---- canvas event handlers -----------------------------------------------
  const onMouseMove = (e) => {
    const p = toSheet(e)
    if (activeTool === 'region' && !regionClosed) setRegionCursor(p)
    if (activeTool === 'measure' && !measureDone && measurePts.length > 0) setMeasureCursor(p)
    if (activeTool === 'scale') setRegionCursor(p)
  }

  const onClick = (e) => {
    const p = toSheet(e)
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
      setMeasurePts(pts => [...pts, p])
    }
  }

  const onDblClick = () => {
    if (activeTool === 'region' && !regionClosed && regionVerts.length >= 3) {
      setRegionClosed(regionVerts); setRegionCursor(null)
    }
    if (activeTool === 'measure' && !measureDone && measurePts.length >= 2) {
      setMeasureDone(true); setMeasureCursor(null)
    }
  }

  // ---- derived geometry ----------------------------------------------------
  const regionPoly = regionClosed || regionVerts
  const hasRegion  = regionPoly.length >= 3
  const isDrawingRegion = activeTool === 'region' && !regionClosed

  const previewPoly = isDrawingRegion && regionVerts.length > 0
    ? [...regionVerts, ...(regionCursor ? [regionCursor] : [])]
    : regionPoly

  const sqft  = (px2) => px2 / (pxPerFt * pxPerFt)
  const lnft  = (px)  => px  / pxPerFt
  const fSq   = (n)   => (Math.round(n / 5) * 5).toLocaleString()
  const fLn   = (n)   => Math.round(n).toLocaleString()

  // Region count results
  const regionRes = {}
  const inPoints  = {}
  const areaClip  = {}
  const inLines   = {}
  CATS.forEach(c => { regionRes[c.id] = { count: 0, sqft: 0, lnft: 0 } })

  const clipStep = isDrawingRegion ? 6 : 4

  if (hasRegion && activeTool === 'region') {
    sheet.points.forEach(p => {
      if (catActive.has(p.type) && inside(p, regionPoly)) {
        regionRes[p.type].count++; inPoints[p.id] = true
      }
    })
    sheet.areas.forEach(a => {
      if (!catActive.has(a.type)) return
      const cp = clipPx2(a.poly, regionPoly, clipStep)
      if (cp.px2 > 0) { regionRes[a.type].count++; regionRes[a.type].sqft += sqft(cp.px2); areaClip[a.id] = cp }
    })
    sheet.lines.forEach(l => {
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

  // Measure segments
  const measureAllPts = !measureDone && measureCursor && measurePts.length > 0
    ? [...measurePts, measureCursor]
    : measurePts
  const measureSegments = []
  for (let i = 0; i < measureAllPts.length - 1; i++) {
    measureSegments.push({
      a: measureAllPts[i],
      b: measureAllPts[i + 1],
      ft: lnft(dist(measureAllPts[i], measureAllPts[i + 1]))
    })
  }
  const measureTotalFt = measureSegments.reduce((sum, seg) => sum + seg.ft, 0)

  // Layer list
  const layerItems = [
    ...sheet.areas.map(a => ({ id: a.id, type: a.type, kind: 'area',   label: CATS.find(c => c.id === a.type)?.name || a.type })),
    ...sheet.lines.map(l => ({ id: l.id, type: l.type, kind: 'linear', label: CATS.find(c => c.id === l.type)?.name || l.type })),
  ]

  const toggleCat   = (id) => setCatActive(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleLayer = (id) => setHidden(h => ({ ...h, [id]: !h[id] }))

  // Accent CSS vars
  const ac = ACCENTS[accent]
  const accentStyle = { '--brand-50': ac[50], '--brand-500': ac[500], '--brand-600': ac[600], '--brand-700': ac[700] }

  // Scale calibration confirm
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

  // Bubble positioning (absolute within canvas)
  const px2pct = (v, dim) => `calc(50% + ${(v - dim / 2) * (zoom / 100) * FIT}px)`

  return (
    <div className={s.root} data-theme={theme} style={{ '--rc-fs': fs, ...accentStyle }}>

      {/* ---- Topbar ---- */}
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
            <button className={s.zoomBtn} onClick={() => setZoom(z => Math.max(50, z - 25))}><Minus size={14} /></button>
            <span className={s.zoomVal}>{zoom}%</span>
            <button className={s.zoomBtn} onClick={() => setZoom(z => Math.min(200, z + 25))}><Plus size={14} /></button>
          </div>
          <Badge variant="success" dot>Synced</Badge>
          <button className={s.iconBtn} data-on={settings} title="Display settings" onClick={() => setSettings(v => !v)}>
            <Settings2 size={17} />
          </button>
          <Button size="sm" variant="secondary" iconLeft={<Share2 size={14} />}>Share</Button>
          <Button size="sm" variant="primary" iconLeft={<FileDown size={14} />} onClick={() => setExportOpen(true)}>Export</Button>
        </div>
      </header>

      {/* ---- Settings popover ---- */}
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
                <button key={k} title={a.label} data-on={accent === k}
                  style={{ background: a[600] }} onClick={() => setAccent(k)}>
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
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 38, textAlign: 'right' }}>
                {Math.round(fs * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}

      <div className={s.body}>

        {/* ---- Tool rail ---- */}
        <aside className={s.rail}>
          {TOOLS.map((t, i) => {
            if (t === 'sep') return <div key={'sep-' + i} className={s.railSep} />
            const { Icon } = t
            return (
              <Tooltip key={t.id} label={t.label} shortcut={t.k} side="right">
                <button
                  className={s.tool}
                  data-on={activeTool === t.id}
                  onClick={() => setActiveTool(t.id)}
                  aria-label={t.label}
                >
                  <Icon size={20} />
                  <span className={s.toolKbd}>{t.k}</span>
                </button>
              </Tooltip>
            )
          })}
          <div className={s.railSep} />
          <Tooltip label="Set scale" shortcut="S" side="right">
            <button
              className={s.tool}
              data-on={activeTool === 'scale'}
              onClick={() => { setActiveTool('scale'); setScalePts([]) }}
              aria-label="Set scale"
            >
              <Ruler size={20} />
              <span className={s.toolKbd}>S</span>
            </button>
          </Tooltip>
        </aside>

        {/* ---- Left panel ---- */}
        <div className={s.leftPanel}>
          <div className={s.leftPanelTabs}>
            <Tabs
              variant="pill"
              value={leftPanel}
              onChange={setLeftPanel}
              items={[
                { value: 'layers', label: 'Layers', count: layerItems.length },
                { value: 'sheets', label: 'Sheets', count: project.sheetIds.length },
              ]}
            />
          </div>
          {leftPanel === 'layers' ? (
            <div className={s.scroll}>
              {layerItems.map(item => (
                <div key={item.id} className={s.layerRow}>
                  <button className={s.eyeBtn} onClick={() => toggleLayer(item.id)} aria-label="Toggle">
                    {hidden[item.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <span
                    className={`${s.layerDot} ${item.kind === 'linear' ? s.layerLine : ''}`}
                    style={{ background: CAT_COLOR[item.type] }}
                  />
                  <span className={s.layerLabel}>{item.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className={s.scroll}>
              {project.sheetIds.map(sid => {
                const sh = SHEETS[sid]
                if (!sh) return null
                const isActive = sid === sheetId
                return (
                  <div key={sid}
                    className={`${s.sheetThumbRow} ${isActive ? s.sheetThumbActive : ''}`}
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

        {/* ---- Canvas ---- */}
        <main className={s.canvas}>

          {/* Hint bar */}
          <div className={s.hint}>
            {activeTool === 'scale' ? (
              scalePts.length === 0
                ? <><Ruler size={14} /><span><b>Set scale</b> — click the first end of a known distance</span></>
                : <><Ruler size={14} /><span>Now click the <b>other end</b> of that distance</span></>
            ) : activeTool === 'region' ? (
              isDrawingRegion
                ? regionVerts.length === 0
                  ? <><Lasso size={14} /><span><b>Click</b> to start drawing an area</span></>
                  : <><Lasso size={14} /><span>Keep clicking · click first point or <kbd>Enter</kbd> to close · <kbd>Esc</kbd> cancel</span></>
                : hasRegion
                  ? <><Check size={14} style={{ color: 'var(--brand-600)' }} /><b>{fSq(regionSqft)} sq ft</b><span> region · {totalPointCount} items. Draw again to recount.</span></>
                  : <><Lasso size={14} /><span>Draw a region to count items inside</span></>
            ) : activeTool === 'measure' ? (
              measureDone
                ? <><Ruler size={14} /><span><b>{fLn(measureTotalFt)} ln ft</b> total · {measureSegments.length} segment{measureSegments.length !== 1 ? 's' : ''}. <kbd>Esc</kbd> to clear.</span></>
                : measurePts.length === 0
                  ? <><Ruler size={14} /><span><b>Click</b> to start measuring. Double-click or <kbd>Enter</kbd> to finish.</span></>
                  : <><Ruler size={14} /><span>Click to add points · <kbd>Enter</kbd> to finish · <kbd>Esc</kbd> cancel</span></>
            ) : activeTool === 'pan' ? (
              <><Hand size={14} /><span>Drag to pan · scroll to zoom</span></>
            ) : (
              <><SquareDashed size={14} /><span><b>{TOOLS.find(t => t !== 'sep' && t.id === activeTool)?.label}</b> — coming soon</span></>
            )}
          </div>

          {/* Sheet */}
          <div className={s.sheetWrap} style={{ transform: `scale(${(zoom / 100) * FIT})` }}>
            <div className={s.sheet} style={{ width: SHEET_W, height: SHEET_H }}>
              <svg
                ref={svgRef}
                className={s.svg}
                width={SHEET_W}
                height={SHEET_H}
                viewBox={`0 0 ${SHEET_W} ${SHEET_H}`}
                style={{
                  cursor: activeTool === 'pan' ? 'grab'
                    : (activeTool === 'region' || activeTool === 'measure' || activeTool === 'scale') ? 'crosshair'
                    : 'default'
                }}
                onMouseMove={onMouseMove}
                onClick={onClick}
                onDoubleClick={onDblClick}
              >
                <defs>
                  {previewPoly.length >= 3 && (
                    <clipPath id="region-clip">
                      <polygon points={previewPoly.map(p => `${p.x},${p.y}`).join(' ')} />
                    </clipPath>
                  )}
                </defs>

                {/* Base area features */}
                {sheet.areas.map(a => {
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

                {/* Clipped area bright overlay (region tool only) */}
                {activeTool === 'region' && previewPoly.length >= 3 && (
                  <g clipPath="url(#region-clip)">
                    {sheet.areas.filter(a => catActive.has(a.type) && !hidden[a.id]).map(a => (
                      <polygon key={a.id}
                        points={a.poly.map(p => `${p.x},${p.y}`).join(' ')}
                        fill={CAT_COLOR[a.type]}
                        fillOpacity="0.34"
                        stroke={CAT_COLOR[a.type]}
                        strokeWidth="2"
                      />
                    ))}
                  </g>
                )}

                {/* Linear features */}
                {sheet.lines.map(l => {
                  if (hidden[l.id]) return null
                  const isIn = inLines[l.id]
                  const dim = (activeTool === 'region' && hasRegion && !isIn) || !catActive.has(l.type)
                  return (
                    <polyline key={l.id}
                      points={l.pts.map(p => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke={CAT_COLOR[l.type]}
                      strokeOpacity={dim ? 0.3 : 1}
                      strokeWidth={isIn ? 6 : 4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )
                })}

                {/* Point items */}
                {sheet.points.map(p => {
                  const isIn = inPoints[p.id]
                  const dim = (activeTool === 'region' && hasRegion && !isIn) || !catActive.has(p.type)
                  const col = CAT_COLOR[p.type]
                  return (
                    <g key={p.id} opacity={dim ? 0.26 : 1}>
                      {isIn && <circle cx={p.x} cy={p.y} r="12" fill={col} opacity="0.18" />}
                      <circle cx={p.x} cy={p.y} r={isIn ? 7 : 5.5}
                        fill={isIn ? col : '#fff'} stroke={col} strokeWidth={isIn ? 2.5 : 2} />
                      {isIn && <circle cx={p.x} cy={p.y} r="2.2" fill="#fff" />}
                    </g>
                  )
                })}

                {/* Region outline */}
                {activeTool === 'region' && previewPoly.length >= 2 && (
                  <polygon
                    points={previewPoly.map(p => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="var(--brand-600)"
                    strokeWidth="2.5"
                    strokeDasharray={isDrawingRegion ? '7 5' : '0'}
                    strokeLinejoin="round"
                  />
                )}

                {/* Drawing vertices */}
                {activeTool === 'region' && isDrawingRegion && regionVerts.map((v, i) => (
                  <circle key={i} cx={v.x} cy={v.y}
                    r={i === 0 && regionVerts.length >= 3 ? 7 : 4.5}
                    fill={i === 0 && regionVerts.length >= 3 ? '#fff' : 'var(--brand-600)'}
                    stroke="var(--brand-600)" strokeWidth="2.5"
                  />
                ))}

                {/* Closed region handles */}
                {activeTool === 'region' && !isDrawingRegion && regionPoly.map((v, i) => (
                  <rect key={i} x={v.x - 4} y={v.y - 4} width="8" height="8"
                    fill="#fff" stroke="var(--brand-600)" strokeWidth="2" />
                ))}

                {/* Measure tool */}
                {activeTool === 'measure' && (
                  <g>
                    {measureAllPts.length >= 2 && (
                      <polyline
                        points={measureAllPts.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke="var(--brand-600)"
                        strokeWidth="2.5"
                        strokeDasharray={measureDone ? '0' : '6 4'}
                        strokeLinecap="round"
                      />
                    )}
                    {measureSegments.map((seg, i) => {
                      const mx = (seg.a.x + seg.b.x) / 2
                      const my = (seg.a.y + seg.b.y) / 2
                      return (
                        <text key={i} x={mx} y={my - 8} textAnchor="middle"
                          fill="var(--brand-700)" fontFamily="var(--font-mono)" fontSize="11" fontWeight="600">
                          {fLn(seg.ft)} ft
                        </text>
                      )
                    })}
                    {measureAllPts.map((p, i) => (
                      <g key={i}>
                        <line x1={p.x} y1={p.y - 9} x2={p.x} y2={p.y + 9} stroke="var(--brand-600)" strokeWidth="2" />
                        <circle cx={p.x} cy={p.y} r="4" fill="var(--brand-600)" />
                      </g>
                    ))}
                  </g>
                )}

                {/* Scale calibration line */}
                {activeTool === 'scale' && (() => {
                  const pts = [...scalePts, ...(scalePts.length === 1 && regionCursor ? [regionCursor] : [])]
                  return (
                    <g>
                      {pts.length === 2 && (
                        <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y}
                          stroke="var(--brand-600)" strokeWidth="2.5" />
                      )}
                      {pts.map((p, i) => (
                        <g key={i}>
                          <line x1={p.x} y1={p.y - 9} x2={p.x} y2={p.y + 9} stroke="var(--brand-600)" strokeWidth="2.5" />
                          <circle cx={p.x} cy={p.y} r="4" fill="var(--brand-600)" />
                        </g>
                      ))}
                    </g>
                  )
                })()}
              </svg>

              {/* Clipped area sq ft labels */}
              {activeTool === 'region' && Object.entries(areaClip).map(([id, cp]) => {
                const a = sheet.areas.find(x => x.id === id)
                if (!a || !cp.c) return null
                return (
                  <div key={id} className={s.areaLabel}
                    style={{
                      left: `${(cp.c.x / SHEET_W) * 100}%`,
                      top: `${(cp.c.y / SHEET_H) * 100}%`,
                      color: CAT_COLOR[a.type],
                    }}>
                    {fSq(sqft(cp.px2))} sq ft
                  </div>
                )
              })}

              {/* Title block */}
              <div className={s.titleBlock}>
                <div className={s.tbRow}><b>{sheet.name.toUpperCase()}</b></div>
                <div className={s.tbRow}>{project.name}</div>
                <div className={s.tbRow}>SHEET {sheet.code}</div>
              </div>
            </div>
          </div>

          {/* Region count bubble */}
          {activeTool === 'region' && regionCen && hasRegion && (
            <div className={s.bubble} style={{ left: px2pct(regionCen.x, SHEET_W), top: px2pct(regionCen.y, SHEET_H) }}>
              {fSq(regionSqft)} sq ft
              <small>{totalPointCount} items · {fLn(regionPerim)} ln ft perim.</small>
            </div>
          )}

          {/* Measure total bubble */}
          {activeTool === 'measure' && measureAllPts.length >= 2 && (() => {
            const last = measureAllPts[measureAllPts.length - 1]
            return (
              <div className={s.bubble}
                style={{ left: px2pct(last.x, SHEET_W), top: px2pct(last.y - 28, SHEET_H) }}>
                {fLn(measureTotalFt)} ln ft
              </div>
            )
          })()}

          {/* Scale chip */}
          <div className={`${s.scaleChip} ${calib ? '' : s.scaleWarn}`}>
            {calib ? <Ruler size={13} /> : <TriangleAlert size={13} />}
            <span>
              {calib
                ? `Scale set · ${calib.feet} ${calib.unit} = ${Math.round(calib.px)} px`
                : 'Default scale — click "Set scale" to calibrate'}
            </span>
          </div>

          {/* Zoom panel */}
          <div className={s.zoomPanel}>
            <button className={s.zoomPanBtn} onClick={() => setZoom(z => Math.max(50, z - 25))}><Minus size={14} /></button>
            <span className={s.zoomPanVal}>{zoom}%</span>
            <button className={s.zoomPanBtn} onClick={() => setZoom(z => Math.min(200, z + 25))}><Plus size={14} /></button>
          </div>
        </main>

        {/* ---- Right panel ---- */}
        <aside className={s.rightPanel}>
          {activeTool === 'region' ? (
            <RegionPanel
              hasRegion={hasRegion}
              regionSqft={regionSqft}
              regionPerim={regionPerim}
              totalPointCount={totalPointCount}
              catActive={catActive}
              regionRes={regionRes}
              sheet={sheet}
              fSq={fSq}
              fLn={fLn}
              onToggleCat={toggleCat}
              onReset={() => { setRegionVerts([]); setRegionClosed(null); setRegionCursor(null) }}
              onSample={() => { setRegionVerts([]); setRegionCursor(null); setRegionClosed(SAMPLE_REGION) }}
              fs={fs}
            />
          ) : activeTool === 'measure' ? (
            <MeasurePanel
              segments={measureSegments}
              totalFt={measureTotalFt}
              fLn={fLn}
              onReset={() => { setMeasurePts([]); setMeasureDone(false); setMeasureCursor(null) }}
              fs={fs}
            />
          ) : (
            <DefaultPanel sheet={sheet} onExport={() => setExportOpen(true)} fs={fs} />
          )}
        </aside>
      </div>

      {/* ---- Scale dialog ---- */}
      <Dialog
        open={!!scaleDlg}
        onClose={() => { setScaleDlg(null); setScalePts([]); setActiveTool('region') }}
        title="Set the sheet scale"
        description="Enter the real-world distance between the two points you clicked."
        width={420}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setScaleDlg(null); setScalePts([]); setActiveTool('region') }}>Cancel</Button>
            <Button variant="primary" iconLeft={<Ruler size={15} />} onClick={confirmScale}>Set scale</Button>
          </>
        }
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', paddingBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <Input label="Known distance" type="number" value={scaleVal} onChange={e => setScaleVal(e.target.value)} />
          </div>
          <div style={{ width: 120 }}>
            <Select label="Unit" value={scaleUnit} onChange={e => setScaleUnit(e.target.value)}
              options={[
                { value: 'ft', label: 'feet' },
                { value: 'in', label: 'inches' },
                { value: 'yd', label: 'yards' },
                { value: 'm',  label: 'meters' },
              ]}
            />
          </div>
        </div>
        {scaleDlg && (
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Measured on sheet: {Math.round(scaleDlg.px)} px → 1 ft ≈ {(scaleDlg.px / ((parseFloat(scaleVal) || 1) * (UNIT_FT[scaleUnit] || 1))).toFixed(1)} px
          </p>
        )}
      </Dialog>

      {/* ---- Export dialog ---- */}
      <Dialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export estimate"
        description={`${project.name} · ${sheet.name}`}
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setExportOpen(false)}>Cancel</Button>
            <Button variant="primary" iconLeft={<FileDown size={15} />} onClick={doExport}>Export PDF</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
          <Select label="Format" options={['PDF — itemized estimate', 'PDF — proposal w/ cover', 'CSV — quantities only', 'Excel workbook']} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Checkbox label="Include sheet thumbnails" defaultChecked />
            <Checkbox label="Show unit prices" defaultChecked />
            <Checkbox label="Group by sheet" />
          </div>
        </div>
      </Dialog>

      {/* ---- Toast ---- */}
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

// ---- Region count right panel --------------------------------------------
function RegionPanel({ hasRegion, regionSqft, regionPerim, totalPointCount, catActive, regionRes, sheet, fSq, fLn, onToggleCat, onReset, onSample, fs }) {
  const totalOf = (id) => {
    const cat = CATS.find(c => c.id === id)
    if (!cat) return 0
    if (cat.kind === 'point') return sheet.points.filter(p => p.type === id).length
    if (cat.kind === 'area')  return sheet.areas.filter(a => a.type === id).length
    return sheet.lines.filter(l => l.type === id).length
  }

  const groups = [
    ['Counted items', CATS.filter(c => c.kind === 'point')],
    ['Areas · sq ft', CATS.filter(c => c.kind === 'area')],
    ['Linear · ln ft', CATS.filter(c => c.kind === 'linear')],
  ]

  return (
    <>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: `calc(18px * ${fs})`, fontWeight: 600, color: 'var(--text-strong)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.01em' }}>
          <Lasso size={18} style={{ color: 'var(--brand-600)', flexShrink: 0 }} /> Region takeoff
        </h2>
        <p style={{ margin: 0, fontSize: `calc(12.5px * ${fs})`, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Draw an area to count items, clip sq ft, and total walls inside.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        {[
          { unit: 'sq ft', label: 'Region area', val: hasRegion ? fSq(regionSqft) : '0', has: hasRegion },
          { unit: 'ln ft', label: 'Perimeter',   val: hasRegion ? fLn(regionPerim) : '0', has: hasRegion },
        ].map(({ unit, label, val, has }) => (
          <div key={unit} style={{ flex: 1, background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '11px 13px' }}>
            <div style={{ fontSize: `calc(11px * ${fs})`, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(23px * ${fs})`, fontWeight: 700, letterSpacing: '-0.02em', color: has ? 'var(--text-strong)' : 'var(--border-strong)', marginTop: 3, lineHeight: 1 }}>
              {val} <span style={{ fontSize: `calc(11px * ${fs})`, color: 'var(--text-muted)', fontWeight: 500 }}>{unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: '1 1 auto', overflow: 'auto', padding: '8px 12px 12px' }}>
        {groups.map(([label, groupCats]) => (
          <div key={label}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(10px * ${fs})`, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)', padding: '14px 8px 6px' }}>
              {label}
            </div>
            {groupCats.map(c => {
              const off = !catActive.has(c.id)
              const r = regionRes[c.id]
              const zero = !r.count
              const total = totalOf(c.id)
              let val
              if (c.kind === 'point') val = <>{r.count}<span style={{ color: 'var(--text-subtle)', fontWeight: 400, fontSize: `calc(11px * ${fs})` }}> / {total}</span></>
              else if (c.kind === 'area') val = <>{fSq(r.sqft)}<span style={{ color: 'var(--text-subtle)', fontWeight: 400, fontSize: `calc(11px * ${fs})` }}> sq ft{r.count ? ` · ${r.count}` : ''}</span></>
              else val = <>{fLn(r.lnft)}<span style={{ color: 'var(--text-subtle)', fontWeight: 400, fontSize: `calc(11px * ${fs})` }}> ln ft{r.count ? ` · ${r.count}` : ''}</span></>
              return (
                <div key={c.id} onClick={() => onToggleCat(c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', opacity: off ? 0.42 : 1 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${off ? 'var(--border-strong)' : 'var(--brand-600)'}`, background: off ? 'transparent' : 'var(--brand-600)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {!off && <Check size={12} style={{ color: '#fff' }} />}
                  </span>
                  <span style={{ width: 13, height: c.kind === 'linear' ? 5 : 13, borderRadius: c.kind === 'linear' ? 3 : 4, flexShrink: 0, background: CAT_COLOR[c.id] }} />
                  <span style={{ flex: 1, fontSize: `calc(13.5px * ${fs})`, fontWeight: 500, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(13.5px * ${fs})`, fontWeight: 600, color: (zero && !off) ? 'var(--text-subtle)' : 'var(--text-strong)', textAlign: 'right', whiteSpace: 'nowrap' }}>{val}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 10 }}>
        <Button variant="secondary" fullWidth iconLeft={<Sparkles size={14} />} onClick={onSample}>Try sample region</Button>
        <Button variant="ghost" iconLeft={<Eraser size={14} />} onClick={onReset}>Clear</Button>
      </div>
    </>
  )
}

// ---- Measure right panel -------------------------------------------------
function MeasurePanel({ segments, totalFt, fLn, onReset, fs }) {
  return (
    <>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: `calc(18px * ${fs})`, fontWeight: 600, color: 'var(--text-strong)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.01em' }}>
          <Ruler size={18} style={{ color: 'var(--brand-600)', flexShrink: 0 }} /> Measure
        </h2>
        <p style={{ margin: 0, fontSize: `calc(12.5px * ${fs})`, color: 'var(--text-muted)', lineHeight: 1.5 }}>
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
        ) : (
          segments.map((seg, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: `calc(13px * ${fs})`, color: 'var(--text-muted)' }}>Segment {i + 1}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(14px * ${fs})`, fontWeight: 600, color: 'var(--text-strong)' }}>{fLn(seg.ft)} ft</span>
            </div>
          ))
        )}
      </div>

      <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border-subtle)' }}>
        <Button variant="ghost" fullWidth iconLeft={<Eraser size={14} />} onClick={onReset}>Clear measurement</Button>
      </div>
    </>
  )
}

// ---- Default right panel (sheet summary) ---------------------------------
function DefaultPanel({ sheet, onExport, fs }) {
  return (
    <>
      <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: `calc(16px * ${fs})`, fontWeight: 600, color: 'var(--text-strong)' }}>
          Items on sheet
        </div>
        <div style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', marginTop: 2 }}>
          Use the Region tool to count items
        </div>
      </div>

      <div style={{ flex: '1 1 auto', overflow: 'auto', padding: '8px 12px 12px' }}>
        {CATS.map(cat => {
          const items = cat.kind === 'point' ? sheet.points.filter(p => p.type === cat.id)
            : cat.kind === 'area' ? sheet.areas.filter(a => a.type === cat.id)
            : sheet.lines.filter(l => l.type === cat.id)
          if (items.length === 0) return null
          return (
            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 'var(--radius-md)' }}>
              <span style={{ width: 12, height: cat.kind === 'linear' ? 4 : 12, borderRadius: cat.kind === 'linear' ? 2 : 3, background: CAT_COLOR[cat.id], flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: `calc(13.5px * ${fs})`, color: 'var(--text-strong)', fontWeight: 500 }}>{cat.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(13px * ${fs})`, fontWeight: 600, color: 'var(--text-muted)' }}>
                {items.length} {cat.kind === 'area' ? 'area' + (items.length !== 1 ? 's' : '') : cat.kind === 'linear' ? 'wall' + (items.length !== 1 ? 's' : '') : 'ea'}
              </span>
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
