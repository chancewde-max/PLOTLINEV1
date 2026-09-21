import React from 'react'
import { Sprout } from 'lucide-react'

export default function TurfPanel({
  submode,
  onSubmode,
  rollW,
  rollL,
  rollRot,
  onRollW,
  onRollL,
  onRollRot,
  coverage,
  hint,
  hasActiveArea,
  fs = 1,
}) {
  const cov = coverage || { areaSqFt: 0, rollsPlaced: 0, coveredSqFt: 0, coveragePct: 0, gapsSqFt: 0, hasOverlap: false }
  const row = (label, value, warn) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: `calc(12px * ${fs})` }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: warn ? '#d97706' : 'var(--text-strong)' }}>{value}</span>
    </div>
  )

  return (
    <div data-testid="turf-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: `calc(13px * ${fs})`, fontWeight: 700, color: 'var(--text-strong)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Sprout size={16} style={{ color: '#15803d' }} /> Synthetic turf
        </div>
        <div role="tablist" aria-label="Turf modes" style={{ display: 'flex', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
          {[['draw', 'Draw area'], ['stamp', 'Stamp rolls']].map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={submode === id}
              data-on={submode === id}
              onClick={() => onSubmode(id)}
              style={{
                flex: 1, padding: '7px 8px', border: 'none', cursor: 'pointer',
                fontSize: `calc(12px * ${fs})`, fontWeight: 700,
                background: submode === id ? 'var(--brand-600)' : 'transparent',
                color: submode === id ? '#fff' : 'var(--text-body)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', lineHeight: 1.45 }}>
          {hint || (submode === 'draw'
            ? 'Click vertices · double-click or Enter to close · Esc cancel'
            : hasActiveArea
              ? 'Hover to preview · click to stamp inside the turf area · Shift snaps 15°'
              : 'Select or draw a turf area first')}
        </p>
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: `calc(10px * ${fs})`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)' }}>Roll defaults</div>
        {[
          ['Width', rollW, onRollW, 'ft'],
          ['Length', rollL, onRollL, 'ft'],
          ['Rotation', rollRot, onRollRot, '°'],
        ].map(([label, val, set, unit]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', fontWeight: 600, minWidth: 68 }}>{label}</label>
            <input
              type="number"
              aria-label={`Roll ${label.toLowerCase()}`}
              value={val}
              onChange={e => set(e.target.value)}
              step={unit === '°' ? 1 : 0.5}
              style={{ flex: 1, padding: '5px 8px', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: `calc(13px * ${fs})`, background: 'var(--surface-card)', color: 'var(--text-strong)' }}
            />
            <span style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', minWidth: 18 }}>{unit}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px', flex: 1, overflow: 'auto' }}>
        <div style={{ fontSize: `calc(10px * ${fs})`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', marginBottom: 8 }}>Coverage</div>
        {row('Area sq ft', cov.areaSqFt.toFixed(1))}
        {row('Rolls placed', String(cov.rollsPlaced))}
        {row('Covered sq ft', cov.coveredSqFt.toFixed(1))}
        {row('Coverage %', `${cov.coveragePct.toFixed(1)}%`)}
        {row('Gaps', `${cov.gapsSqFt.toFixed(1)} sq ft`)}
        {cov.hasOverlap && (
          <div data-testid="turf-overlap-warn" style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', fontSize: `calc(12px * ${fs})`, fontWeight: 600 }}>
            Overlapping rolls — counted once for coverage
          </div>
        )}
      </div>
    </div>
  )
}
