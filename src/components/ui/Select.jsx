import React from 'react'
import s from './Select.module.css'

export function Select({ label, value, onChange, options = [], size = 'md' }) {
  return (
    <div className={s.root}>
      {label && <label className={s.label}>{label}</label>}
      <div className={`${s.wrap} ${s[size]}`}>
        <select className={s.select} value={value} onChange={onChange}>
          {options.map((o, i) => {
            const val = typeof o === 'string' ? o : o.value
            const lbl = typeof o === 'string' ? o : o.label
            return <option key={i} value={val}>{lbl}</option>
          })}
        </select>
        <span className={s.caret}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </div>
    </div>
  )
}
