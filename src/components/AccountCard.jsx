import React, { useState } from 'react'
import { Mail, Users, Cloud, CloudOff, Settings, LogOut, LogIn } from 'lucide-react'
import { Avatar } from './ui/Avatar.jsx'
import { Button } from './ui/Button.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import s from './AccountCard.module.css'

// Interactive account avatar: hover to preview who's signed in, which
// workspace is active, and cloud-sync status, with quick actions (Settings /
// sign out, or sign in if logged out).
export function AccountCard({ onOpenSettings }) {
  const [show, setShow] = useState(false)
  const { user, cloudEnabled, orgName, orgRole, signOut, openAuth } = useAuth()

  const name = user?.email || 'Guest'
  const subtitle = !user
    ? 'Not signed in'
    : orgName
      ? `${orgName} · ${orgRole === 'admin' ? 'Admin' : 'Member'}`
      : 'Personal workspace'

  return (
    <span
      className={s.root}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setShow(false) }}
    >
      <button type="button" className={s.trigger} aria-label="Account">
        <Avatar name={name} status={user ? 'online' : undefined} />
      </button>

      {show && (
        <div className={s.card} role="dialog" aria-label="Account">
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
                <Button variant="secondary" size="sm" iconLeft={<Settings size={14} />} fullWidth onClick={onOpenSettings}>
                  Settings
                </Button>
                <Button variant="ghost" size="sm" iconLeft={<LogOut size={14} />} fullWidth onClick={signOut}>
                  Sign out
                </Button>
              </>
            ) : (
              <Button variant="primary" size="sm" iconLeft={<LogIn size={14} />} fullWidth onClick={() => openAuth('signin')}>
                Sign in
              </Button>
            )}
          </div>
        </div>
      )}
    </span>
  )
}
