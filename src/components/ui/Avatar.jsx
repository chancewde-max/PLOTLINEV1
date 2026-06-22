import React from 'react'
import s from './Avatar.module.css'

function initials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const COLORS = ['#157a52', '#2563eb', '#7c3aed', '#e0700a', '#db2777', '#0891b2']
function color(name) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return COLORS[h % COLORS.length]
}

export function Avatar({ name, size = 'md', ring = false, status }) {
  return (
    <span className={`${s.root} ${s[size]} ${ring ? s.ring : ''}`}>
      <span className={s.circle} style={{ background: color(name) }}>
        {initials(name)}
      </span>
      {status === 'online' && <span className={s.online} />}
    </span>
  )
}
