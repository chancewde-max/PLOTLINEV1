import React, { useEffect, useId, useRef } from 'react'
import s from './Dialog.module.css'

export function Dialog({ open, onClose, title, description, children, footer, width = 480 }) {
  const panelRef = useRef(null)
  const previouslyFocused = useRef(null)
  const titleId = useId()
  const descId = useId()

  // Callers pass onClose as a fresh inline function every render (e.g.
  // `onClose={() => setOpen(false)}`), so it can't safely live in the effect
  // below's dependency array — that would re-run "move focus into the
  // dialog" on every keystroke in a form field, stealing focus to the first
  // focusable element (the ✕ close button) after each character typed.
  // Stash the latest one in a ref instead so the Escape handler stays
  // current without retriggering the effect.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement

    const onKey = (e) => {
      if (e.key === 'Escape') { onCloseRef.current?.(); return }
      if (e.key === 'Tab') {
        const panel = panelRef.current
        if (!panel) return
        const focusable = panel.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)

    // Move focus into the dialog.
    const panel = panelRef.current
    if (panel) {
      const focusable = panel.querySelector(
        'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
      )
      ;(focusable || panel).focus?.()
    }

    return () => {
      window.removeEventListener('keydown', onKey)
      // Restore focus to the trigger.
      if (previouslyFocused.current && previouslyFocused.current.focus) {
        previouslyFocused.current.focus()
      }
    }
  }, [open])

  if (!open) return null

  return (
    <div className={s.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div
        className={s.panel}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        ref={panelRef}
        tabIndex={-1}
      >
        <div className={s.head}>
          <div>
            {title && <div className={s.title} id={titleId}>{title}</div>}
            {description && <div className={s.desc} id={descId}>{description}</div>}
          </div>
          <button className={s.close} onClick={onClose} aria-label="Close dialog">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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
