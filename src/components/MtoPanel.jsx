import React, { useMemo } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { useAppData } from '../data/useAppData.jsx'
import { takeoffMaterialItems } from '../data/takeoff.js'
import s from './MtoPanel.module.css'

// Read-only list of quantities aggregated from the on-sheet takeoff (counts,
// areas, linear runs) for one plan/version set. This is what feeds the job's
// materials.
function TakeoffSection({ title, items }) {
  if (!items.length) return null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-subtle)' }}>{title || 'From takeoff'}</div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· counts, areas & linear measured on your sheets</span>
      </div>
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Code', 'Item', 'Qty', 'Unit'].map(h => (
                <th key={h} style={{ textAlign: h === 'Qty' ? 'right' : 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.key}>
                <td style={{ padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>{it.code || '—'}</td>
                <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-strong)', fontWeight: 500, borderBottom: '1px solid var(--border-subtle)' }}>{it.description}</td>
                <td style={{ padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, textAlign: 'right', borderBottom: '1px solid var(--border-subtle)' }}>{it.qty.toLocaleString()}</td>
                <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>{it.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quantities are broken out per plan/version set (project.sheetSets) instead
// of summed across the whole project — two revisions of the same sheet, or
// two unrelated phases, shouldn't silently combine into one number.
export default function MtoPanel({ project }) {
  const { sheets } = useAppData()
  const sheetSets = project?.sheetSets || []

  const assignedIds = useMemo(() => new Set(sheetSets.flatMap(set => set.sheetIds || [])), [sheetSets])
  const unassignedIds = useMemo(
    () => (project?.sheetIds || []).filter(id => !assignedIds.has(id)),
    [project, assignedIds]
  )

  const setSections = useMemo(() => sheetSets.map(set => ({
    id: set.id,
    title: set.name,
    items: takeoffMaterialItems(project, sheets, set.sheetIds || []),
  })), [sheetSets, project, sheets])

  const unassignedItems = useMemo(
    () => takeoffMaterialItems(project, sheets, unassignedIds),
    [project, sheets, unassignedIds]
  )

  const sections = [
    ...setSections,
    // Only label these "Unassigned sheets" when there's at least one real
    // plan set to distinguish them from — otherwise it's just every sheet
    // in the project and the generic "From takeoff" title reads better.
    { id: 'unassigned', title: sheetSets.length > 0 ? 'Unassigned sheets' : null, items: unassignedItems },
  ].filter(sec => sec.items.length > 0)

  return (
    <div className={s.root}>
      {sections.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyIcon}><FileSpreadsheet size={26} /></div>
          <div className={s.emptyTitle}>No materials yet</div>
          <div className={s.emptyHint}>Measure a count, area, or linear condition on your sheets to see materials here.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {sections.map(sec => <TakeoffSection key={sec.id} title={sec.title} items={sec.items} />)}
        </div>
      )}
    </div>
  )
}
