import React from 'react'
import s from './Tabs.module.css'

export function Tabs({ items = [], value, onChange, variant = 'pill' }) {
  return (
    <div className={`${s.root} ${s[variant]}`}>
      {items.map(item => (
        <button
          key={item.value}
          className={`${s.tab} ${value === item.value ? s.active : ''}`}
          onClick={() => onChange?.(item.value)}
        >
          {item.label}
          {item.count != null && (
            <span className={s.count}>{item.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}
