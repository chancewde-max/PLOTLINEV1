import React, { useEffect } from 'react'
import s from './Dialog.module.css'

export function Dialog({ open, onClose, title, description, children, footer, width = 480 }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={s.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className={s.panel} style={{ width }} role="dialog" aria-modal>
        <div className={s.head}>
          <div>
            <div className={s.title}>{title}</div>
            {description && <div className={s.desc}>{description}</div>}
          </div>
          <button className={s.close} onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        {children && <div className={s.body}>{children}</div>}
        {footer && <div className={s.foot}>{footer}</div>}
      </div>
    </div>
  )
}
