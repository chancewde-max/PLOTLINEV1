// AuthModal — global login / sign-up dialog.
//
// Uses the existing design-system primitives (Dialog, Button, Input, Avatar).
// While the initial session check is in flight (useAuth().loading), renders a
// skeleton in place of the real form/account panel — otherwise a returning
// signed-in user would see a flash of the sign-in form immediately swapped
// for "Your account" once the async check resolves. When cloud is not
// configured it shows a short note and the actions reject with
// "Cloud not configured" (handled gracefully by AuthProvider).

import React, { useState, useEffect } from 'react'
import { ShieldCheck, Mail, Lock } from 'lucide-react'
import { Dialog } from '../components/ui/Dialog.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Input } from '../components/ui/Input.jsx'
import { Avatar } from '../components/ui/Avatar.jsx'
import { useAuth } from './AuthProvider.jsx'
import s from './AuthModal.module.css'

export function AuthModal({ open, onClose }) {
  const { user, loading, signIn, signUp, signOut, authError, cloudEnabled } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  // Reset transient form state whenever the modal opens.
  useEffect(() => {
    if (open) {
      setErr(null)
      setBusy(false)
    }
  }, [open])

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password)
      } else {
        await signUp(email.trim(), password)
      }
      onClose?.()
    } catch (e) {
      setErr(e?.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const header = loading ? (
    <div className={s.skelHeader}>
      <span className={`${s.skelBox} ${s.skelAvatar}`} />
      <div>
        <span className={`${s.skelLine} ${s.skelTitle}`} />
        <span className={`${s.skelLine} ${s.skelSub}`} style={{ display: 'block' }} />
      </div>
    </div>
  ) : (
    <div className={s.header}>
      <img src="/plotline-mark.svg" alt="" className={s.logo} />
      <div>
        <div className={s.heading}>
          {user ? 'Your account' : mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </div>
        <div className={s.subheading}>
          {user
            ? 'Signed in and synced to your private cloud workspace.'
            : mode === 'signin'
              ? 'Sign in to sync your projects across devices.'
              : 'Start your free trial — no card required.'}
        </div>
      </div>
    </div>
  )

  const footer = loading ? null : user ? (
    <Button variant="secondary" fullWidth onClick={async () => { await signOut(); onClose?.() }}>
      Sign out
    </Button>
  ) : (
    <Button variant="primary" fullWidth type="submit" form="auth-form" disabled={busy}>
      {busy ? 'Please wait…' : mode === 'signin' ? 'Continue with email' : 'Create account'}
    </Button>
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={header}
      footer={footer}
      width={420}
    >
      {loading ? (
        <div className={s.skelForm}>
          <div>
            <span className={`${s.skelLine} ${s.skelFieldLabel}`} style={{ display: 'block' }} />
            <span className={`${s.skelBox} ${s.skelInput}`} style={{ display: 'block' }} />
          </div>
          <div>
            <span className={`${s.skelLine} ${s.skelFieldLabel}`} style={{ display: 'block' }} />
            <span className={`${s.skelBox} ${s.skelInput}`} style={{ display: 'block' }} />
          </div>
          <span className={`${s.skelBox} ${s.skelButton}`} />
        </div>
      ) : user ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className={s.accountCard}>
            <Avatar name={user.email} status="online" />
            <div style={{ minWidth: 0 }}>
              <div className={s.accountEmail}>{user.email}</div>
              <div className={s.accountNote}>Personal &amp; team workspaces sync automatically</div>
            </div>
          </div>
        </div>
      ) : (
        <form id="auth-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leadingIcon={<Mail size={14} />}
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leadingIcon={<Lock size={14} />}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
          />

          {(err || authError) && (
            <div style={{
              fontSize: 13, color: 'var(--danger-500)', background: 'var(--danger-bg)',
              borderRadius: 8, padding: '8px 10px',
            }}>
              {err || authError}
            </div>
          )}

          {!cloudEnabled && (
            <div style={{
              fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface-sunken)',
              borderRadius: 8, padding: '8px 10px', lineHeight: 1.4,
            }}>
              Cloud sync isn't configured in this build. Set VITE_SUPABASE_URL and
              VITE_SUPABASE_ANON_KEY to enable account sync. You can keep using
              Plotline locally in the meantime.
            </div>
          )}

          <div className={s.trustRow}>
            <ShieldCheck size={13} />
            Your projects stay private — only you (and teammates you invite) can see them.
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {mode === 'signin' ? (
              <>No account?{' '}
                <button type="button" onClick={() => setMode('signup')}
                  style={linkStyle}>Create one</button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button type="button" onClick={() => setMode('signin')}
                  style={linkStyle}>Sign in</button>
              </>
            )}
          </div>
        </form>
      )}
    </Dialog>
  )
}

const linkStyle = {
  background: 'none',
  border: 'none',
  color: 'var(--brand-700)',
  cursor: 'pointer',
  fontWeight: 600,
  padding: 0,
  font: 'inherit',
}
