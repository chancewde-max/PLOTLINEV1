// AuthModal — global login / sign-up dialog.
//
// Uses the existing design-system primitives (Dialog, Button, Input). Kept
// self-contained with a small inline style block so it slots into any page
// without touching their CSS modules. When cloud is not configured it shows a
// short note and the actions reject with "Cloud not configured" (handled
// gracefully by AuthProvider).

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog } from '../components/ui/Dialog.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Input } from '../components/ui/Input.jsx'
import { useAuth } from './AuthProvider.jsx'
import { loadSubscription, hasActiveAccess } from '../data/subscription.js'

export function AuthModal({ open, onClose }) {
  const navigate = useNavigate()
  const { user, signIn, signUp, signOut, authError, cloudEnabled } = useAuth()
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

  // If already signed in, show the account panel.
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
      // Route to the app if there's an active subscription, otherwise send
      // them to pick a plan. (Simulated, per-browser subscription state —
      // see src/data/subscription.js.)
      navigate(hasActiveAccess(loadSubscription()) ? '/app' : '/pricing')
    } catch (e) {
      setErr(e?.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const footer = user ? (
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
      title={user ? 'Your account' : (mode === 'signin' ? 'Sign in to Plotline' : 'Create your Plotline account')}
      description={user ? null : 'Your projects, sheets, and categories sync to your private cloud workspace.'}
      footer={footer}
      width={420}
    >
      {user ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 14, color: 'var(--slate-600)' }}>Signed in as</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--slate-900)' }}>{user.email}</div>
          <div style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: 4 }}>
            Your data is synced to your private cloud workspace.
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
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
              fontSize: 12, color: 'var(--slate-500)', background: 'var(--slate-50)',
              borderRadius: 8, padding: '8px 10px', lineHeight: 1.4,
            }}>
              Cloud sync isn't configured in this build. Set VITE_SUPABASE_URL and
              VITE_SUPABASE_ANON_KEY to enable account sync. You can keep using
              Plotline locally in the meantime.
            </div>
          )}

          <div style={{ fontSize: 13, color: 'var(--slate-500)' }}>
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
