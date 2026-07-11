import React, { useId } from 'react'
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
  id,
  ...rest
}) {
  const autoId = useId()
  const inputId = id || autoId
  const errorId = `${inputId}-error`
  return (
    <div className={s.root}>
      {label && <label className={s.label} htmlFor={inputId}>{label}</label>}
      <div className={`${s.wrap} ${s[size]} ${leadingIcon ? s.hasIcon : ''} ${error ? s.hasError : ''}`}>
        {leadingIcon && <span className={s.icon} aria-hidden="true">{leadingIcon}</span>}
        <input
          id={inputId}
          className={s.input}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          {...rest}
        />
      </div>
      {error && <span className={s.error} id={errorId}>{error}</span>}
    </div>
  )
}
