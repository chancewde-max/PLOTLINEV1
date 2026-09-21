import React from 'react'
import { Sprout } from 'lucide-react'
import { DEFAULT_ROLL_W_FT, DEFAULT_ROLL_L_FT, parseRollFt, estimateRollsNeeded } from '../workspace/turf.js'

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
  const wFt = parseRollFt(rollW, DEFAULT_ROLL_W_FT)
  const lFt = parseRollFt(rollL, DEFAULT_ROLL_L_FT)
  const rollSqFt = wFt * lFt
  const stillNeeded = estimateRollsNeeded(cov.gapsSqFt, wFt, lFt)
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
              ? 'Hover to preview · snap locks to a neighbor · click to stamp · Shift snaps 15°'
              : 'Select or draw a turf area first')}
        </p>
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: `calc(10px * ${fs})`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)' }}>Roll size</div>
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
              min={unit === '°' ? undefined : 0.1}
              step={unit === '°' ? 1 : 0.1}
              style={{ flex: 1, padding: '5px 8px', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: `calc(13px * ${fs})`, background: 'var(--surface-card)', color: 'var(--text-strong)' }}
            />
            <span style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', minWidth: 18 }}>{unit}</span>
          </div>
        ))}
        <p style={{ margin: 0, fontSize: `calc(11px * ${fs})`, color: 'var(--text-subtle)', lineHeight: 1.4 }}>
          {DEFAULT_ROLL_W_FT}×{DEFAULT_ROLL_L_FT} ft is a starting default — width and length are both free-form.
        </p>
      </div>

      <div style={{ padding: '12px 16px', flex: 1, overflow: 'auto' }}>
        <div style={{ fontSize: `calc(10px * ${fs})`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', marginBottom: 8 }}>Count &amp; estimate</div>
        <div data-testid="turf-roll-count" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', fontWeight: 600 }}>Rolls placed</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(28px * ${fs})`, fontWeight: 800, color: 'var(--text-strong)', lineHeight: 1 }}>{cov.rollsPlaced}</span>
        </div>
        {hasActiveArea && stillNeeded > 0 && (
          <div data-testid="turf-rolls-needed" style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', fontSize: `calc(12px * ${fs})`, color: 'var(--text-body)', fontWeight: 600 }}>
            ~{stillNeeded} more {stillNeeded === 1 ? 'roll' : 'rolls'} to cover remaining gaps
          </div>
        )}
        {row('Roll size', `${wFt} × ${lFt} ft (${rollSqFt.toFixed(0)} sq ft)`)}
        {row('Area sq ft', cov.areaSqFt.toFixed(1))}
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
