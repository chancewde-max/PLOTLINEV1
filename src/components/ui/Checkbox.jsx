import React from 'react'
import s from './Checkbox.module.css'

export function Checkbox({ label, checked, defaultChecked, onChange, disabled }) {
  return (
    <label className={`${s.root} ${disabled ? s.disabled : ''}`}>
      <input
        type="checkbox"
        className={s.input}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className={s.box} />
      {label && <span className={s.label}>{label}</span>}
    </label>
  )
}
