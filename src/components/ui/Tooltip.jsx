import React, { useState } from 'react'
import s from './Tooltip.module.css'

// Reusable hover/focus tooltip for icon-only buttons — keeps icons clean while
// explaining exactly what each action does. Supports keyboard focus for a11y.
export function Tooltip({ label, shortcut, side = 'right', children }) {
  const [show, setShow] = useState(false)
  return (
    <span
      className={s.root}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <span className={`${s.tip} ${s[side]}`} role="tooltip">
          {label}
          {shortcut && <kbd className={s.kbd}>{shortcut}</kbd>}
        </span>
      )}
    </span>
  )
}
