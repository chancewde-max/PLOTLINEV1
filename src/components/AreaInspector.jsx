import React from 'react'
import { SquareDashed } from 'lucide-react'
import {
  TOPSOIL_OPTIONS, volumeCy, formatCy, mixedValue,
  areaDepthOf, areaTopsoilOf, areaTopsoilCustomOf,
} from '../workspace/areaProps.js'
import { polyAreaPx } from '../workspace/geometry.js'

export default function AreaInspector({
  areas,
  areaGroups = [],
  sqft,
  onApply,
  fs = 1,
}) {
  if (!areas?.length) return null

  const depths = areas.map(a => areaDepthOf(a, areaGroups))
  const soils = areas.map(a => areaTopsoilOf(a, areaGroups))
  const customs = areas.map(a => areaTopsoilCustomOf(a, areaGroups))
  const depthMix = mixedValue(depths)
  const soilMix = mixedValue(soils)
  const customMix = mixedValue(customs)

  const totalCy = areas.reduce((sum, a) => {
    const sf = sqft(polyAreaPx(a.poly || []))
    return sum + volumeCy(sf, areaDepthOf(a, areaGroups))
  }, 0)

  const soilSelectValue = soilMix.mixed ? '__multiple__' : (soilMix.value || 'none')

  // TODO(HOLD): depth→cy + topsoil UI already started; Agency Manager has
  // not confirmed whether soil Area depth→cy is dropped with presets.
  // Depth-inch PRESET dropdown stripped (Chance: dropped from V1).
  return (
    <div data-testid="area-inspector" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: `calc(11px * ${fs})`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <SquareDashed size={12} /> Area{areas.length > 1 ? ` · ${areas.length}` : ''}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', fontWeight: 600, minWidth: 56 }}>Depth</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
          <input
            type="number"
            min="0"
            step="0.5"
            aria-label="Custom depth inches"
            placeholder={depthMix.mixed ? 'Multiple' : '0'}
            value={depthMix.mixed ? '' : depthMix.value}
            onChange={e => onApply({ depth: e.target.value })}
            style={{ width: 64, padding: '5px 8px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: `calc(13px * ${fs})`, background: 'var(--surface-card)', color: 'var(--text-strong)' }}
          />
          <span style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)' }}>inches</span>
          <span data-testid="area-cy" style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(12px * ${fs})`, fontWeight: 700, color: 'var(--brand-600)', marginLeft: 'auto' }}>
            {formatCy(totalCy)}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{ fontSize: `calc(12px * ${fs})`, color: 'var(--text-muted)', fontWeight: 600, minWidth: 56 }}>Topsoil</label>
        <select
          aria-label="Topsoil type"
          value={soilSelectValue}
          onChange={e => {
            if (e.target.value === '__multiple__') return
            onApply({ topsoil: e.target.value, ...(e.target.value !== 'custom' ? { topsoilCustom: '' } : {}) })
          }}
          style={{ flex: 1, padding: '5px 8px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: `calc(13px * ${fs})`, background: 'var(--surface-card)', color: 'var(--text-strong)' }}
        >
          {soilMix.mixed && <option value="__multiple__">Multiple</option>}
          {TOPSOIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {(!soilMix.mixed && soilMix.value === 'custom') && (
        <input
          aria-label="Custom topsoil type"
          placeholder="Topsoil type"
          value={customMix.mixed ? '' : customMix.value}
          onChange={e => onApply({ topsoil: 'custom', topsoilCustom: e.target.value })}
          style={{ padding: '5px 8px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: `calc(13px * ${fs})`, background: 'var(--surface-card)', color: 'var(--text-strong)' }}
        />
      )}
    </div>
  )
}
