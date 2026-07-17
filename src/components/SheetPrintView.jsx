import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './ui/Button.jsx'
import PdfCanvas from './PdfCanvas.jsx'
import { CAT_COLOR, SHEET_W, SHEET_H, categoryTotals } from '../data/sampleData.js'
import { buildAreaPath, buildLinePath } from '../workspace/geometry.js'
import { resolveSheetPdfUrl, sheetHasPdf } from './pdfCache.js'
import s from './SheetPrintView.module.css'

const FALLBACK_PXFT = 4 // matches SheetPage's DEFAULT_PXFT — used for sheets that aren't the live/open one

function today() {
  try {
    return new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return new Date().toDateString()
  }
}

// Seeded/demo sheets store each area & line twice under the same id: once as
// a bare {id,type,poly} thumbnail copy on sheet.areas/sheet.lines, and once
// as the richer, authoritative copy (with arcSegs/groupId/color) in
// addedAreas/addedLines. The live canvas renders both as two independent,
// separately-keyed layers (a faint "base" ghost under the editable "added"
// layer) so the collision never surfaces there — but a flat list can't be
// rendered or summed without double-drawing/double-counting every seeded
// shape. Dedupe by id, keeping the last occurrence so the richer
// addedAreas/addedLines entry wins.
function dedupeById(items) {
  const map = new Map()
  items.forEach((item) => map.set(item.id, item))
  return Array.from(map.values())
}

// Reconstruct {allAreas, allLines, allPoints} for any sheet from its
// persisted data — mirrors the derivation SheetPage.jsx does live for the
// sheet that's actually open (addedAreas/addedLines/addedPoints + base
// sheet.areas/lines/points).
function deriveSheetData(sh) {
  const addedAreas = sh.savedAreas || []
  const addedLines = sh.savedLines || []
  const addedPoints = (sh.savedCountGroups || []).flatMap((g) => g.points || [])
  return {
    allAreas: [...(sh.areas || []), ...addedAreas],
    allLines: [...(sh.lines || []), ...addedLines],
    allPoints: [...(sh.points || []), ...addedPoints],
  }
}

function makeFormatters(precision) {
  const sqft = (px2) => px2 / (FALLBACK_PXFT * FALLBACK_PXFT)
  const lnft = (px) => px / FALLBACK_PXFT
  const fmt = (n) => precision === 0
    ? Math.round(n).toLocaleString()
    : n.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision })
  return { sqft, lnft, fSq: fmt, fLn: fmt }
}

export default function SheetPrintView({
  open,
  onClose,
  project,
  sheet,
  sheetId,
  pdfUrl,
  pdfPage,
  allAreas,
  allLines,
  allPoints,
  sqft,
  lnft,
  fSq,
  fLn,
  calib,
  precision = 0,
  sheets,
  pdfAssets,
  sheetOrder,
}) {
  const [scope, setScope] = useState('current') // 'current' | 'all' | 'choose'
  const [chosenIds, setChosenIds] = useState(() => new Set())
  const [scalePointsEnabled, setScalePointsEnabled] = useState(false)
  const [pointScale, setPointScale] = useState('1')

  useEffect(() => {
    if (!open) return
    setScope('current')
    setChosenIds(new Set(sheetId ? [sheetId] : []))
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, sheetId])

  if (!open || !project || !sheet) return null

  const order = sheetOrder || []
  const idsToPrint = scope === 'current' ? [sheetId]
    : scope === 'all' ? order
    : order.filter((id) => chosenIds.has(id))

  const docs = idsToPrint.map((id) => {
    if (id === sheetId) {
      return {
        id, sheet, pdfUrl, pdfPage,
        areas: dedupeById(allAreas), lines: dedupeById(allLines), points: dedupeById(allPoints),
        sqft, lnft, fSq, fLn, calib,
      }
    }
    const sh = sheets?.[id]
    if (!sh) return null
    const { allAreas: a, allLines: l, allPoints: p } = deriveSheetData(sh)
    const f = makeFormatters(precision)
    return {
      id, sheet: sh,
      pdfUrl: sheetHasPdf(sh) ? resolveSheetPdfUrl(sh, pdfAssets) : null,
      pdfPage: sh.pdfPage || 1,
      areas: dedupeById(a), lines: dedupeById(l), points: dedupeById(p),
      sqft: f.sqft, lnft: f.lnft, fSq: f.fSq, fLn: f.fLn,
      calib: null,
    }
  }).filter(Boolean)

  const portalRoot = (typeof document !== 'undefined' && document.getElementById('print-sheet-root'))
    || (typeof document !== 'undefined' && (() => {
        const el = document.createElement('div')
        el.id = 'print-sheet-root'
        el.className = 'plotline-print-root'
        document.body.appendChild(el)
        return el
      })())

  const handlePrint = () => {
    window.requestAnimationFrame(() => window.print())
  }

  const toggleChosen = (id) => {
    setChosenIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const content = (
    <div className={`${s.overlay} plotline-print-overlay`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      {/* Screen-only toolbar (hidden in print via .printChrome) */}
      <div className={`${s.printChrome} printChrome`}>
        <div className={s.chromeInner}>
          <div className={s.chromeTitle}>
            <img src="/plotline-mark.svg" alt="" className={s.chromeLogo} />
            <span>Print sheet · {sheet.code ? `${sheet.code} · ` : ''}{sheet.name}</span>
          </div>
          <div className={s.chromeActions}>
            <span className={s.chromeHint}>Tip: pick Landscape in the print dialog for wide plans</span>
            <Button variant="ghost" size="sm" iconLeft={<span className={s.iconX}>✕</span>} onClick={onClose}>Close</Button>
            <Button variant="primary" size="sm" iconLeft={<span>🖨</span>} onClick={handlePrint} disabled={docs.length === 0}>Print / Save as PDF</Button>
          </div>
        </div>
        <div className={s.scopeBar}>
          <div className={s.seg}>
            <button data-on={scope === 'current'} onClick={() => setScope('current')}>This sheet</button>
            <button data-on={scope === 'all'} onClick={() => setScope('all')}>All sheets ({order.length})</button>
            <button data-on={scope === 'choose'} onClick={() => setScope('choose')}>Choose sheets</button>
          </div>
          {scope === 'choose' && (
            <div className={s.chooseList}>
              {order.map((id) => {
                const sh = id === sheetId ? sheet : sheets?.[id]
                if (!sh) return null
                return (
                  <label key={id} className={s.chooseItem}>
                    <input type="checkbox" checked={chosenIds.has(id)} onChange={() => toggleChosen(id)} />
                    <span>{sh.code ? `${sh.code} · ` : ''}{sh.name}</span>
                  </label>
                )
              })}
            </div>
          )}
          <label className={s.chooseItem}>
            <input type="checkbox" checked={scalePointsEnabled} onChange={(e) => setScalePointsEnabled(e.target.checked)} />
            <span>Scale count markers ×</span>
            <input type="number" min="0.25" max="5" step="0.25" placeholder="1.0" value={pointScale}
              disabled={!scalePointsEnabled}
              onChange={(e) => setPointScale(e.target.value)}
              className={s.pointScaleInput} />
          </label>
        </div>
      </div>

      <div className={`${s.scroll} plotline-print-scroll`}>
        {docs.length === 0 && (
          <p className={s.emptyNote}>Choose at least one sheet to print.</p>
        )}
        {docs.map((d, i) => {
          const totals = categoryTotals(d.areas, d.lines, d.points, d.sqft, d.lnft)
          const ptScale = scalePointsEnabled ? (parseFloat(pointScale) || 1) : 1
          const scaleLabel = d.calib
            ? `1 : ${Math.round(d.calib.px / (d.calib.feet || 1))} px/ft · calibrated ${d.calib.feet} ${d.calib.unit}`
            : 'Default scale — not calibrated on this sheet'
          return (
            <div key={d.id} className={`${s.doc} sheet-print-doc`} style={i > 0 ? { marginTop: 32 } : undefined}>
              <header className={s.head}>
                <div className={s.headLeft}>
                  <div className={s.brandRow}>
                    <img src="/plotline-mark.svg" alt="Plotline" className={s.brandMark} />
                    <span className={s.brandName}>Plotline<span className={s.dot}>.</span></span>
                  </div>
                  <div className={s.docType}>Takeoff Sheet</div>
                </div>
                <div className={s.headMeta}>
                  <div><span className={s.metaLabel}>Project</span><span className={s.metaValue}>{project.name}</span></div>
                  <div><span className={s.metaLabel}>Sheet</span><span className={s.metaValue}>{d.sheet.code ? `${d.sheet.code} · ` : ''}{d.sheet.name}</span></div>
                  {project.address && (
                    <div><span className={s.metaLabel}>Location</span><span className={s.metaValue}>{project.address}</span></div>
                  )}
                  <div><span className={s.metaLabel}>Date</span><span className={s.metaValue}>{today()}</span></div>
                </div>
              </header>

              <div className={s.scaleNote}>{scaleLabel}</div>

              <div className={`${s.planFrame} sheet-print-plan`}>
                {d.pdfUrl ? (
                  <PdfCanvas url={d.pdfUrl} width={SHEET_W} height={SHEET_H} pageNumber={d.pdfPage || 1} />
                ) : (
                  <div className={s.blankSheet} />
                )}
                <svg className={s.overlaySvg} viewBox={`0 0 ${SHEET_W} ${SHEET_H}`} preserveAspectRatio="xMidYMid meet">
                  {d.areas.map((a) => (
                    <path key={a.id} d={buildAreaPath(a.poly, a.arcSegs)}
                      fill={CAT_COLOR[a.type]} fillOpacity="0.22" stroke={CAT_COLOR[a.type]} strokeWidth="2" />
                  ))}
                  {d.lines.map((l) => (
                    <path key={l.id} d={buildLinePath(l.pts, l.arcSegs)}
                      fill="none" stroke={CAT_COLOR[l.type]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  ))}
                  {d.points.map((p) => (
                    <circle key={p.id} cx={p.x} cy={p.y} r={6 * ptScale}
                      fill="#ffffff" stroke={CAT_COLOR[p.type]} strokeWidth={2.5 * ptScale} />
                  ))}
                </svg>
              </div>

              <section className={s.block}>
                <h2 className={s.blockTitle}>Measured quantities</h2>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Layer</th>
                      <th>Kind</th>
                      <th className={s.num}>Count</th>
                      <th className={s.num}>Sq ft</th>
                      <th className={s.num}>Lin ft</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <span className={s.swatch} style={{ background: CAT_COLOR[t.id] }} />
                          {t.name}
                        </td>
                        <td className={s.kind}>{t.kind}</td>
                        <td className={s.num}>{t.count}</td>
                        <td className={s.num}>{t.sqft > 0 ? d.fSq(t.sqft) : '—'}</td>
                        <td className={s.num}>{t.lnft > 0 ? d.fLn(t.lnft) : '—'}</td>
                      </tr>
                    ))}
                    {totals.length === 0 && (
                      <tr><td colSpan={5} className={s.empty}>Nothing measured on this sheet yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </section>

              <footer className={s.foot}>
                Generated with Plotline — takeoff software for landscape &amp; irrigation. Quantities derived directly from measured plan data.
              </footer>
            </div>
          )
        })}
      </div>
    </div>
  )

  if (!portalRoot) return content
  return createPortal(content, portalRoot)
}
