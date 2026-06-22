import React, { useState } from 'react'
import s from './Tooltip.module.css'

export function Tooltip({ label, shortcut, side = 'right', children }) {
  const [show, setShow] = useState(false)
  return (
    <span
      className={s.root}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span className={`${s.tip} ${s[side]}`}>
          {label}
          {shortcut && <kbd className={s.kbd}>{shortcut}</kbd>}
        </span>
      )}
    </span>
  )
}
