import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './ui/Button.jsx'
import PdfCanvas from './PdfCanvas.jsx'
import { CATS, CAT_COLOR, SHEET_W, SHEET_H } from '../data/sampleData.js'
import { buildAreaPath, buildLinePath, polyAreaPx, linePathLenPx } from '../workspace/geometry.js'
import s from './SheetPrintView.module.css'

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
// layer) so the collision never surfaces there — but allAreas/allLines
// (passed in already merged) can't be rendered or summed as one flat list
// without double-drawing/double-counting every seeded shape. Dedupe by id,
// keeping the last occurrence so the richer addedAreas/addedLines entry wins.
function dedupeById(items) {
  const map = new Map()
  items.forEach((item) => map.set(item.id, item))
  return Array.from(map.values())
}

// Roll every measured feature on the sheet up into per-category totals —
// the same CATS taxonomy the Layers panel uses, so the printed legend
// matches what's on screen.
function categoryTotals(allAreas, allLines, allPoints, sqft, lnft) {
  const totals = {}
  CATS.forEach((c) => { totals[c.id] = { ...c, count: 0, sqft: 0, lnft: 0 } })
  allAreas.forEach((a) => {
    const t = totals[a.type]
    if (t) { t.count += 1; t.sqft += sqft(polyAreaPx(a.poly)) }
  })
  allLines.forEach((l) => {
    const t = totals[l.type]
    if (t) { t.count += 1; t.lnft += lnft(linePathLenPx(l.pts, l.arcSegs)) }
  })
  allPoints.forEach((p) => {
    const t = totals[p.type]
    if (t) t.count += 1
  })
  return Object.values(totals).filter((t) => t.count > 0)
}

export default function SheetPrintView({
  open,
  onClose,
  project,
  sheet,
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
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !project || !sheet) return null

  const areas = dedupeById(allAreas)
  const lines = dedupeById(allLines)
  const points = dedupeById(allPoints)

  const totals = categoryTotals(areas, lines, points, sqft, lnft)
  const scaleLabel = calib
    ? `1 : ${Math.round(calib.px / (calib.feet || 1))} px/ft · calibrated ${calib.feet} ${calib.unit}`
    : 'Default scale — not calibrated on this sheet'

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
            <Button variant="primary" size="sm" iconLeft={<span>🖨</span>} onClick={handlePrint}>Print / Save as PDF</Button>
          </div>
        </div>
      </div>

      <div className={`${s.scroll} plotline-print-scroll`}>
        <div className={`${s.doc} sheet-print-doc`}>
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
              <div><span className={s.metaLabel}>Sheet</span><span className={s.metaValue}>{sheet.code ? `${sheet.code} · ` : ''}{sheet.name}</span></div>
              {project.address && (
                <div><span className={s.metaLabel}>Location</span><span className={s.metaValue}>{project.address}</span></div>
              )}
              <div><span className={s.metaLabel}>Date</span><span className={s.metaValue}>{today()}</span></div>
            </div>
          </header>

          <div className={s.scaleNote}>{scaleLabel}</div>

          <div className={`${s.planFrame} sheet-print-plan`}>
            {pdfUrl ? (
              <PdfCanvas url={pdfUrl} width={SHEET_W} height={SHEET_H} pageNumber={pdfPage || 1} />
            ) : (
              <div className={s.blankSheet} />
            )}
            <svg className={s.overlaySvg} viewBox={`0 0 ${SHEET_W} ${SHEET_H}`} preserveAspectRatio="xMidYMid meet">
              {areas.map((a) => (
                <path key={a.id} d={buildAreaPath(a.poly, a.arcSegs)}
                  fill={CAT_COLOR[a.type]} fillOpacity="0.22" stroke={CAT_COLOR[a.type]} strokeWidth="2" />
              ))}
              {lines.map((l) => (
                <path key={l.id} d={buildLinePath(l.pts, l.arcSegs)}
                  fill="none" stroke={CAT_COLOR[l.type]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {points.map((p) => (
                <circle key={p.id} cx={p.x} cy={p.y} r="6"
                  fill="#ffffff" stroke={CAT_COLOR[p.type]} strokeWidth="2.5" />
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
                    <td className={s.num}>{t.sqft > 0 ? fSq(t.sqft) : '—'}</td>
                    <td className={s.num}>{t.lnft > 0 ? fLn(t.lnft) : '—'}</td>
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
      </div>
    </div>
  )

  if (!portalRoot) return content
  return createPortal(content, portalRoot)
}
