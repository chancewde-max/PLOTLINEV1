import React from 'react'
import styles from './Button.module.css'

export function Button({
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  fullWidth = false,
  disabled = false,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  const cls = [
    styles.btn,
    styles[variant],
    styles[size],
    fullWidth ? styles.full : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button type={type} className={cls} disabled={disabled} {...rest}>
      {iconLeft && <span className={styles.icon}>{iconLeft}</span>}
      {children != null && <span>{children}</span>}
      {iconRight && <span className={styles.icon}>{iconRight}</span>}
    </button>
  )
}
