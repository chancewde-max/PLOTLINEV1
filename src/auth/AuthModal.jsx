// AuthModal — global login / sign-up dialog.
//
// Uses the existing design-system primitives (Dialog, Button, Input, Avatar).
// While the initial session check is in flight (useAuth().loading), renders a
// skeleton in place of the real form/account panel — otherwise a returning
// signed-in user would see a flash of the sign-in form immediately swapped
// for "Your account" once the async check resolves. When cloud is not
// configured it shows a short note and the actions reject with
// "Cloud not configured" (handled gracefully by AuthProvider).

import React, { useState, useEffect, useRef } from 'react'
import { ShieldCheck, Mail, Lock } from 'lucide-react'
import { Dialog } from '../components/ui/Dialog.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Input } from '../components/ui/Input.jsx'
import { Avatar } from '../components/ui/Avatar.jsx'
import { useAuth } from './AuthProvider.jsx'
import {
  EMAIL_NOT_CONFIRMED_MESSAGE,
  MIN_PASSWORD_LENGTH,
  RESET_SENT_MESSAGE,
  RESEND_COOLDOWN_SECONDS,
  friendlySignInMessage,
  isEmailNotConfirmed,
} from './authFlow.js'
import s from './AuthModal.module.css'

export function AuthModal({ open, onClose }) {
  const {
    user, loading, signIn, signUp, signOut, authError, cloudEnabled,
    requestPasswordReset, resendSignupConfirmation,
  } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'reset' | 'reset-sent'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  // 'confirm' (email not confirmed) | 'exists' (repeated signup) | null
  const [notice, setNotice] = useState(null)
  const [resendState, setResendState] = useState('idle') // idle | sending | sent | error
  const [resendError, setResendError] = useState(null)
  const [cooldown, setCooldown] = useState(0)
  const viewRef = useRef(null)
  const modeRef = useRef(mode)

  // Reset transient form state whenever the modal opens.
  useEffect(() => {
    if (open) {
      setErr(null)
      setNotice(null)
      setBusy(false)
      setResendState('idle')
      setResendError(null)
      modeRef.current = mode
    }
  }, [open]) // mode is intentionally read only as the baseline when opening

  // Move focus into the newly shown view. The dialog's own focus effect runs
  // only when it opens, so switching sign-in / sign-up / reset would otherwise
  // leave focus on the control that was just clicked.
  useEffect(() => {
    if (!open) return
    if (modeRef.current === mode) return
    modeRef.current = mode
    const root = viewRef.current
    const target = root?.querySelector('[data-autofocus], input')
    target?.focus()
  }, [mode, open])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const goToMode = (next) => {
    setErr(null)
    setNotice(null)
    setResendState('idle')
    setResendError(null)
    setMode(next)
  }

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'reset') {
        await requestPasswordReset(email.trim())
        setMode('reset-sent')
        return
      }
      if (mode === 'signin') {
        await signIn(email.trim(), password)
      } else {
        const result = await signUp(email.trim(), password)
        if (result?.existingAccount) {
          setNotice('exists')
          return
        }
      }
      onClose?.()
    } catch (error) {
      if (mode === 'signin' && isEmailNotConfirmed(error)) {
        setNotice('confirm')
        setErr(null)
      } else if (mode === 'signin') {
        setErr(friendlySignInMessage(error))
      } else {
        setErr(error?.message || 'Something went wrong')
      }
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setResendError(null)
    setResendState('sending')
    try {
      await resendSignupConfirmation(email.trim())
      setResendState('sent')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (error) {
      setResendError(error?.message || 'Something went wrong')
      setResendState('error')
    }
  }

  const heading = user
    ? 'Your account'
    : mode === 'signup'
      ? 'Create your account'
      : mode === 'signin'
        ? 'Welcome back'
        : 'Reset your password'
  const subheading = user
    ? 'Signed in and synced to your private cloud workspace.'
    : mode === 'signup'
      ? 'Start your free trial — no card required.'
      : mode === 'signin'
        ? 'Sign in to sync your projects across devices.'
        : mode === 'reset-sent'
          ? 'Check your inbox for the reset link.'
          : "Enter your email and we'll send you a reset link."

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
        <div className={s.heading}>{heading}</div>
        <div className={s.subheading}>{subheading}</div>
      </div>
    </div>
  )

  const footer = loading ? null : user ? (
    <Button variant="secondary" fullWidth onClick={async () => { await signOut(); onClose?.() }}>
      Sign out
    </Button>
  ) : mode === 'reset-sent' ? (
    <Button variant="primary" fullWidth type="button" onClick={() => goToMode('signin')}>
      Back to sign in
    </Button>
  ) : (
    <Button variant="primary" fullWidth type="submit" form="auth-form" disabled={busy}>
      {busy
        ? 'Please wait…'
        : mode === 'signin'
          ? 'Continue with email'
          : mode === 'reset'
            ? 'Send reset link'
            : 'Create account'}
    </Button>
  )

  const showBanner = notice !== 'confirm' && notice !== 'exists' && (err || authError)

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
        <div ref={viewRef}>
          {mode === 'reset-sent' ? (
            <div
              role="status"
              aria-live="polite"
              tabIndex={-1}
              data-autofocus
              className={s.status}
            >
              {RESET_SENT_MESSAGE}
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
              {mode !== 'reset' && (
                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leadingIcon={<Lock size={14} />}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  minLength={mode === 'signup' ? MIN_PASSWORD_LENGTH : undefined}
                  required
                />
              )}

              {mode === 'signin' && (
                <div style={{ marginTop: -6, textAlign: 'right' }}>
                  <button type="button" onClick={() => goToMode('reset')} style={linkStyle}>
                    Forgot password?
                  </button>
                </div>
              )}

              {showBanner && (
                <div role="alert" style={errorStyle}>
                  {err || authError}
                </div>
              )}

              {notice === 'confirm' && (
                <div role="status" aria-live="polite" className={s.status}>
                  <p style={{ margin: 0 }}>{EMAIL_NOT_CONFIRMED_MESSAGE}</p>
                  {resendState === 'sent' && (
                    <p style={{ margin: '8px 0 0' }}>Confirmation email sent.</p>
                  )}
                  {resendState === 'error' && resendError && (
                    <p style={{ margin: '8px 0 0' }}>{resendError}</p>
                  )}
                  {cooldown > 0 && (
                    <p style={{ margin: '8px 0 0' }}>
                      You can request another confirmation email in {cooldown}s.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={resend}
                    disabled={resendState === 'sending' || cooldown > 0}
                    style={{ ...linkStyle, marginTop: 8, display: 'inline-block' }}
                  >
                    {resendState === 'sending' ? 'Sending…' : 'Resend confirmation email'}
                  </button>
                </div>
              )}

              {notice === 'exists' && (
                <div role="status" aria-live="polite" className={s.status}>
                  An account with this email already exists. <button type="button" onClick={() => goToMode('signin')} style={linkStyle}>Sign in</button> instead, or use <button type="button" onClick={() => goToMode('reset')} style={linkStyle}>Forgot password</button>.
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
                    <button type="button" onClick={() => goToMode('signup')}
                      style={linkStyle}>Create one</button>
                  </>
                ) : (
                  <>Already have an account?{' '}
                    <button type="button" onClick={() => goToMode('signin')}
                      style={linkStyle}>Sign in</button>
                  </>
                )}
              </div>
            </form>
          )}
        </div>
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

const errorStyle = {
  fontSize: 13,
  color: 'var(--danger-500)',
  background: 'var(--danger-bg)',
  borderRadius: 8,
  padding: '8px 10px',
}
