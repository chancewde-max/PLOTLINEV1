import React, { useMemo } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { useAppData } from '../data/useAppData.jsx'
import { takeoffMaterialItems } from '../data/takeoff.js'
import s from './MtoPanel.module.css'

// Read-only list of quantities aggregated from the on-sheet takeoff (counts,
// areas, linear runs) across the project. This is what feeds the job's
// materials.
function TakeoffSection({ items }) {
  if (!items.length) return null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-subtle)' }}>From takeoff</div>
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
export default function MtoPanel({ project }) {
  const { sheets } = useAppData()
  const takeoffItems = useMemo(() => takeoffMaterialItems(project, sheets), [project, sheets])

  return (
    <div className={s.root}>
      {takeoffItems.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyIcon}><FileSpreadsheet size={26} /></div>
          <div className={s.emptyTitle}>No materials yet</div>
          <div className={s.emptyHint}>Measure a count, area, or linear condition on your sheets to see materials here.</div>
        </div>
      ) : (
        <TakeoffSection items={takeoffItems} />
      )}
    </div>
  )
}
