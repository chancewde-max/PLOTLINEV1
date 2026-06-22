import React from 'react'
import s from './Input.module.css'

export function Input({
  label,
  placeholder,
  value,
  onChange,
  size = 'md',
  leadingIcon,
  error,
  disabled,
  type = 'text',
  ...rest
}) {
  return (
    <div className={s.root}>
      {label && <label className={s.label}>{label}</label>}
      <div className={`${s.wrap} ${s[size]} ${leadingIcon ? s.hasIcon : ''} ${error ? s.hasError : ''}`}>
        {leadingIcon && <span className={s.icon}>{leadingIcon}</span>}
        <input
          className={s.input}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          {...rest}
        />
      </div>
      {error && <span className={s.error}>{error}</span>}
    </div>
  )
}
