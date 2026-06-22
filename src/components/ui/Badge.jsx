import React from 'react'
import s from './Badge.module.css'

export function Badge({ variant = 'neutral', dot = false, children }) {
  return (
    <span className={`${s.badge} ${s[variant]}`}>
      {dot && <span className={s.dot} />}
      {children}
    </span>
  )
}
