import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../components/ui/Button.jsx'
import { CATS, CAT_COLOR } from '../data/sampleData.js'
import s from './BidProposal.module.css'

function today() {
  try {
    return new Date().toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch {
    return new Date().toDateString()
  }
}

// Flatten every measured item on a sheet into { type, kind } records.
function itemsOnSheet(sheet) {
  const out = []
  ;(sheet.areas || []).forEach((a) => out.push({ type: a.type || 'sod', kind: 'area' }))
  ;(sheet.lines || []).forEach((l) => out.push({ type: l.type || 'lime-wall', kind: 'linear' }))
  ;(sheet.points || []).forEach((p) => out.push({ type: p.type || 'irrigation', kind: 'point' }))
  // Count-groups (the seeded SheetPage model) — include their points too.
  ;(sheet.savedCountGroups || []).forEach((g) => {
    ;(g.points || []).forEach(() => out.push({ type: g.type || g.id?.replace('cg-', '') || 'irrigation', kind: 'point' }))
  })
  return out
}

function countsForSheet(sheet) {
  const items = itemsOnSheet(sheet)
  return {
    areas: items.filter((i) => i.kind === 'area').length,
    lines: items.filter((i) => i.kind === 'linear').length,
    points: items.filter((i) => i.kind === 'point').length,
    items,
  }
}

// Aggregate material quantities by category across all sheets.
function materialsByCat(sheetList) {
  const byType = {}
  sheetList.forEach((sh) => {
    countsForSheet(sh).items.forEach((it) => {
      byType[it.type] = (byType[it.type] || 0) + 1
    })
  })
  return CATS.map((cat) => ({
    ...cat,
    qty: byType[cat.id] || 0,
    color: CAT_COLOR[cat.id],
  })).filter((c) => c.qty > 0 || true) // keep all categories for a complete takeoff
}

export default function BidProposal({
  open,
  onClose,
  project,
  sheetList,
  folderGroups, // [{ name, sheets: [...] }]
  unassignedSheets,
}) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !project) return null

  const materials = materialsByCat(sheetList)
  const totalItems = sheetList.reduce((sum, sh) => {
    const c = countsForSheet(sh)
    return sum + c.areas + c.lines + c.points
  }, 0)

  const portalRoot = (typeof document !== 'undefined' && document.getElementById('print-proposal-root'))
    || (typeof document !== 'undefined' && (() => {
        const el = document.createElement('div')
        el.id = 'print-proposal-root'
        document.body.appendChild(el)
        return el
      })())

  const handlePrint = () => {
    // Give the portal a tick to paint, then print.
    window.requestAnimationFrame(() => window.print())
  }

  const buildCsv = () => {
    const rows = []
    rows.push(['Plotline Bid Export'])
    rows.push(['Project', project.name])
    rows.push(['Client', project.client || ''])
    rows.push(['Address', project.address || ''])
    rows.push(['Date', today()])
    rows.push([])
    rows.push(['SHEET SUMMARY'])
    rows.push(['Code', 'Name', 'Areas', 'Lines', 'Items'])
    sheetList.forEach((sh) => {
      const c = countsForSheet(sh)
      rows.push([sh.code || '', sh.name || '', c.areas, c.lines, c.points])
    })
    rows.push([])
    rows.push(['MATERIALS TAKEOFF'])
    rows.push(['Category', 'Kind', 'Quantity'])
    materials.forEach((m) => rows.push([m.name, m.kind, m.qty]))
    return rows.map((r) => r.map((v) => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
  }

  const handleCsv = () => {
    const blob = new Blob([buildCsv()], { type: 'text/csv;charset=utf-8' })
    downloadBlob(blob, `${slug(project.name)}-bid.csv`)
  }

  const handleJson = () => {
    const payload = {
      project: { name: project.name, client: project.client, address: project.address, date: today() },
      sheets: sheetList.map((sh) => {
        const c = countsForSheet(sh)
        return { code: sh.code, name: sh.name, areas: c.areas, lines: c.lines, points: c.points }
      }),
      materials: materials.map((m) => ({ category: m.id, name: m.name, kind: m.kind, qty: m.qty })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `${slug(project.name)}-bid.json`)
  }

  const content = (
    <div className={s.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      {/* Screen-only toolbar (hidden in print via .printChrome) */}
      <div className={s.printChrome}>
        <div className={s.chromeInner}>
          <div className={s.chromeTitle}>
            <img src="/plotline-mark.svg" alt="" className={s.chromeLogo} />
            <span>Bid proposal · {project.name}</span>
          </div>
          <div className={s.chromeActions}>
            <Button variant="ghost" size="sm" iconLeft={<span className={s.iconX}>✕</span>} onClick={onClose}>Close</Button>
            <Button variant="secondary" size="sm" iconLeft={<span>⤓</span>} onClick={handleCsv}>CSV</Button>
            <Button variant="secondary" size="sm" iconLeft={<span>⤓</span>} onClick={handleJson}>JSON</Button>
            <Button variant="primary" size="sm" iconLeft={<span>🖨</span>} onClick={handlePrint}>Print / Save as PDF</Button>
          </div>
        </div>
      </div>

      <div className={s.scroll}>
        <div className={`${s.proposal} proposal`}>
          {/* Header */}
          <header className={s.head}>
            <div className={s.headLeft}>
              <div className={s.brandRow}>
                <img src="/plotline-mark.svg" alt="Plotline" className={s.brandMark} />
                <span className={s.brandName}>Plotline<span className={s.dot}>.</span></span>
              </div>
              <div className={s.docType}>Bid Proposal &amp; Materials Takeoff</div>
            </div>
            <div className={s.headMeta}>
              <div><span className={s.metaLabel}>Client</span><span className={s.metaValue}>{project.client || '—'}</span></div>
              <div><span className={s.metaLabel}>Project</span><span className={s.metaValue}>{project.name}</span></div>
              {project.address && (
                <div><span className={s.metaLabel}>Location</span><span className={s.metaValue}>{project.address}</span></div>
              )}
              <div><span className={s.metaLabel}>Date</span><span className={s.metaValue}>{today()}</span></div>
            </div>
          </header>

          {/* Summary stats */}
          <div className={s.statRow}>
            <div className={s.statBox}>
              <div className={s.statNum}>{sheetList.length}</div>
              <div className={s.statLabel}>Sheets</div>
            </div>
            <div className={s.statBox}>
              <div className={s.statNum}>{totalItems}</div>
              <div className={s.statLabel}>Measured items</div>
            </div>
            <div className={s.statBox}>
              <div className={s.statNum}>{materials.length}</div>
              <div className={s.statLabel}>Material categories</div>
            </div>
            {project.bidValue > 0 && (
              <div className={s.statBox}>
                <div className={s.statNum}>${project.bidValue.toLocaleString()}</div>
                <div className={s.statLabel}>Bid value</div>
              </div>
            )}
          </div>

          {/* Sheet summary */}
          <section className={s.block}>
            <h2 className={s.blockTitle}>Sheet summary</h2>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Sheet</th>
                  <th className={s.num}>Areas</th>
                  <th className={s.num}>Lines</th>
                  <th className={s.num}>Items</th>
                </tr>
              </thead>
              <tbody>
                {sheetList.map((sh) => {
                  const c = countsForSheet(sh)
                  return (
                    <tr key={sh.id}>
                      <td className={s.code}>{sh.code}</td>
                      <td>{sh.name}</td>
                      <td className={s.num}>{c.areas}</td>
                      <td className={s.num}>{c.lines}</td>
                      <td className={s.num}>{c.points}</td>
                    </tr>
                  )
                })}
                <tr className={s.totalsRow}>
                  <td colSpan={2}>Total</td>
                  <td className={s.num}>{sheetList.reduce((s2, sh) => s2 + countsForSheet(sh).areas, 0)}</td>
                  <td className={s.num}>{sheetList.reduce((s2, sh) => s2 + countsForSheet(sh).lines, 0)}</td>
                  <td className={s.num}>{sheetList.reduce((s2, sh) => s2 + countsForSheet(sh).points, 0)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Folder / region breakdown */}
          {(folderGroups.length > 0 || unassignedSheets.length > 0) && (
            <section className={s.block}>
              <h2 className={s.blockTitle}>Region &amp; folder breakdown</h2>
              {folderGroups.map((grp) => (
                <div key={grp.name} className={s.region}>
                  <div className={s.regionHead}>{grp.name}</div>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Sheet</th>
                        <th className={s.num}>Areas</th>
                        <th className={s.num}>Lines</th>
                        <th className={s.num}>Items</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grp.sheets.map((sh) => {
                        const c = countsForSheet(sh)
                        return (
                          <tr key={sh.id}>
                            <td className={s.code}>{sh.code}</td>
                            <td>{sh.name}</td>
                            <td className={s.num}>{c.areas}</td>
                            <td className={s.num}>{c.lines}</td>
                            <td className={s.num}>{c.points}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
              {unassignedSheets.length > 0 && (
                <div className={s.region}>
                  <div className={s.regionHead}>Unassigned</div>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Sheet</th>
                        <th className={s.num}>Areas</th>
                        <th className={s.num}>Lines</th>
                        <th className={s.num}>Items</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unassignedSheets.map((sh) => {
                        const c = countsForSheet(sh)
                        return (
                          <tr key={sh.id}>
                            <td className={s.code}>{sh.code}</td>
                            <td>{sh.name}</td>
                            <td className={s.num}>{c.areas}</td>
                            <td className={s.num}>{c.lines}</td>
                            <td className={s.num}>{c.points}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Materials takeoff */}
          <section className={s.block}>
            <h2 className={s.blockTitle}>Materials takeoff</h2>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Kind</th>
                  <th className={s.num}>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span className={s.swatch} style={{ background: m.color }} />
                      {m.name}
                    </td>
                    <td className={s.kind}>{m.kind}</td>
                    <td className={s.num}>{m.qty}</td>
                  </tr>
                ))}
                {materials.length === 0 && (
                  <tr><td colSpan={3} className={s.empty}>No measured quantities yet.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          <footer className={s.foot}>
            Generated with Plotline — takeoff software for landscape &amp; irrigation. Quantities derived directly from measured plan sheets.
          </footer>
        </div>
      </div>
    </div>
  )

  if (!portalRoot) return content
  return createPortal(content, portalRoot)
}

function slug(str = '') {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'plotline'
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
