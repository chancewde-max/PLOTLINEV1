import React, { useState, useRef, useEffect } from 'react'
import { Mail, Users, Cloud, CloudOff, Settings, LogOut, LogIn } from 'lucide-react'
import { Avatar } from './ui/Avatar.jsx'
import { Button } from './ui/Button.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import s from './AccountCard.module.css'

// Interactive account avatar: hover (mouse) or tap (touch) to preview who's
// signed in, which workspace is active, and cloud-sync status, with quick
// actions (Settings / sign out, or sign in if logged out).
export function AccountCard({ onOpenSettings }) {
  const [show, setShow] = useState(false)
  const rootRef = useRef(null)
  const { user, cloudEnabled, orgName, orgRole, signOut, openAuth } = useAuth()

  const name = user?.email || 'Guest'
  const subtitle = !user
    ? 'Not signed in'
    : orgName
      ? `${orgName} · ${orgRole === 'admin' ? 'Admin' : 'Member'}`
      : 'Personal workspace'

  // Hover opens/closes on desktop. On touch devices there's no hover, so the
  // trigger's onClick below toggles it directly — close-on-outside-tap makes
  // that a complete interaction instead of something with no way to dismiss.
  useEffect(() => {
    if (!show) return
    const onOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setShow(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setShow(false) }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [show])

  return (
    <span
      ref={rootRef}
      className={s.root}
      // Pointer events (not mouse events) so pointerType lets us restrict
      // hover-open/hover-close to real mice. Touch interactions synthesize
      // compatibility mouseenter/mouseleave too — with plain onMouseLeave, a
      // tap would open the card via onClick and then immediately close it
      // again via the synthesized mouseleave from that same tap.
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setShow(true) }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setShow(false) }}
      onFocus={() => setShow(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setShow(false) }}
    >
      <button
        type="button"
        className={s.trigger}
        aria-label="Account"
        aria-expanded={show}
        onClick={() => setShow(true)}
      >
        <Avatar name={name} status={user ? 'online' : undefined} />
      </button>

      {show && (
        // .card spans the visual gap between the trigger and the visible
        // panel too (via padding-top on this element, not margin on
        // .cardInner) so the pointer never crosses "dead" space that isn't
        // part of this hoverable subtree — otherwise mouseleave fires before
        // the cursor reaches the panel.
        <div className={s.card}>
          <div className={s.cardInner} role="dialog" aria-label="Account">
            <div className={s.head}>
              <Avatar name={name} size="lg" status={user ? 'online' : undefined} />
              <div className={s.headText}>
                <div className={s.headName}>{user ? name : 'Guest'}</div>
                <div className={s.headSub}>{subtitle}</div>
              </div>
            </div>

            <div className={s.rows}>
              <div className={s.row}>
                <Mail size={14} className={s.rowIcon} />
                <span>{user ? user.email : 'Sign in to sync your projects'}</span>
              </div>
              <div className={s.row}>
                <Users size={14} className={s.rowIcon} />
                <span>{orgName || 'Personal workspace'}</span>
              </div>
              <div className={s.row}>
                {cloudEnabled ? <Cloud size={14} className={s.rowIcon} /> : <CloudOff size={14} className={s.rowIcon} />}
                <span>{cloudEnabled ? 'Cloud sync on' : 'Cloud sync not configured'}</span>
              </div>
            </div>

            <div className={s.foot}>
              {user ? (
                <>
                  <Button variant="secondary" size="sm" iconLeft={<Settings size={14} />} fullWidth onClick={() => { onOpenSettings?.(); setShow(false) }}>
                    Settings
                  </Button>
                  <Button variant="ghost" size="sm" iconLeft={<LogOut size={14} />} fullWidth onClick={() => { signOut(); setShow(false) }}>
                    Sign out
                  </Button>
                </>
              ) : (
                <Button variant="primary" size="sm" iconLeft={<LogIn size={14} />} fullWidth onClick={() => { openAuth('signin'); setShow(false) }}>
                  Sign in
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </span>
  )
}
