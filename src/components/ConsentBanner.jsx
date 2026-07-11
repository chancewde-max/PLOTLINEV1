{/* ============================================================
  Cookie / local-storage consent banner.
  Lightweight + dismissible. Stores the dismissal in localStorage.
  Not legal advice — the dismissal itself is just a UI acknowledgment.
  ============================================================ */}
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from './ui/Button.jsx'
import s from './ConsentBanner.module.css'

const STORAGE_KEY = 'plotline.consent.storage'

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (!stored) setVisible(true)
    } catch {
      // If localStorage is unavailable, show the banner anyway.
      setVisible(true)
    }
  }, [])

  const dismiss = (choice) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice)
    } catch {
      /* ignore storage errors */
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className={s.root} role="region" aria-label="Storage and cookie notice" aria-live="polite">
      <p className={s.text}>
        Plotline stores your sign-in session in cookies and uses local storage to remember
        preferences and cache your project data. See our{' '}
        <Link to="/privacy">Privacy Policy</Link> and{' '}
        <Link to="/terms">Terms of Service</Link>.
      </p>
      <div className={s.actions}>
        <Button variant="secondary" size="sm" onClick={() => dismiss('necessary')}>
          Essential only
        </Button>
        <Button variant="primary" size="sm" onClick={() => dismiss('accepted')}>
          Accept
        </Button>
      </div>
    </div>
  )
}
