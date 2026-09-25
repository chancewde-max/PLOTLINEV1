// Public /reset-password page.
//
// The Supabase client uses the default implicit flow. A recovery email lands
// as a hash (#access_token=…&type=recovery). The client parses that hash,
// strips it, and emits PASSWORD_RECOVERY; a session may already exist by the
// time this page subscribes. Both of those are the recovery form.
//
// A ?code= query is ignored. This client does not exchange PKCE codes, so
// that parameter does not count as recovery. Expired links and ordinary
// visits show the request form.

import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button.jsx'
import { Input } from '../components/ui/Input.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import { supabase } from '../lib/supabaseClient.js'
import {
  MIN_PASSWORD_LENGTH,
  RESET_SENT_MESSAGE,
  authCallbackAtLoad,
  isRecoveryPending,
  friendlyAuthMessage,
  validateNewPassword,
} from '../auth/authFlow.js'
import s from './ResetPasswordPage.module.css'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { cloudEnabled, recoveryPending, requestPasswordReset, clearPasswordRecovery } = useAuth()
  const [phase, setPhase] = useState('checking') // checking | form | no-session | saving | success
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [formError, setFormError] = useState(null)
  const [requestEmail, setRequestEmail] = useState('')
  const [requestState, setRequestState] = useState('idle') // idle | sending | sent | error
  const [requestError, setRequestError] = useState(null)

  useEffect(() => {
    if (!cloudEnabled || !supabase) {
      setPhase('no-session')
      return
    }
    let active = true
    let sawRecovery = false

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' && session) {
        sawRecovery = true
        setPhase((current) => (current === 'success' ? current : 'form'))
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (!active || sawRecovery) return
      const session = data?.session
      const recovery = authCallbackAtLoad.indicatesRecovery || recoveryPending || isRecoveryPending()
      if (!session && recovery) clearPasswordRecovery?.()
      setPhase((current) => {
        if (current === 'form' || current === 'success' || current === 'saving') return current
        if (session && recovery) return 'form'
        return 'no-session'
      })
    }).catch(() => {
      if (active && !sawRecovery) {
        setPhase((current) => (current === 'form' || current === 'success' ? current : 'no-session'))
      }
    })

    return () => {
      active = false
      sub?.subscription?.unsubscribe?.()
    }
    // recoveryPending is read when getSession resolves. A later flip (the
    // provider heard PASSWORD_RECOVERY before this page subscribed) is handled
    // below so this listener is not torn down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudEnabled])

  const sawRecoveryPending = useRef(recoveryPending)
  useEffect(() => {
    if (!recoveryPending) {
      sawRecoveryPending.current = false
      return
    }
    if (sawRecoveryPending.current) return
    sawRecoveryPending.current = true
    setPhase((current) => (current === 'success' || current === 'saving' ? current : 'form'))
  }, [recoveryPending])

  useEffect(() => {
    if (phase === 'checking') return
    const id = phase === 'form' || phase === 'saving' ? 'reset-new-password' : 'reset-password-heading'
    document.getElementById(id)?.focus()
  }, [phase])

  useEffect(() => {
    if (phase !== 'success') return
    const timer = setTimeout(() => navigate('/app', { replace: true }), 800)
    return () => clearTimeout(timer)
  }, [phase, navigate])

  const submitPassword = async (e) => {
    e.preventDefault()
    const problem = validateNewPassword(password, confirm)
    if (problem) {
      setFormError(problem)
      return
    }
    if (!supabase) {
      setFormError('Cloud not configured')
      return
    }
    setFormError(null)
    setPhase('saving')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      clearPasswordRecovery?.()
      setPhase('success')
    } catch (err) {
      setFormError(friendlyAuthMessage(err))
      setPhase('form')
    }
  }

  const requestLink = async (e) => {
    e.preventDefault()
    setRequestError(null)
    setRequestState('sending')
    try {
      await requestPasswordReset(requestEmail.trim())
      setRequestState('sent')
    } catch (err) {
      setRequestError(friendlyAuthMessage(err))
      setRequestState('error')
    }
  }

  return (
    <div className={s.page}>
      <div className={s.card}>
        <img src="/plotline-mark.svg" alt="" className={s.logo} />
        <h1 id="reset-password-heading" tabIndex={-1} className={s.heading}>Reset your password</h1>

        {phase === 'checking' && (
          <p className={s.muted} role="status" aria-live="polite">Checking your reset link…</p>
        )}

        {(phase === 'form' || phase === 'saving') && (
          <form onSubmit={submitPassword} className={s.form} noValidate>
            <p className={s.muted}>Choose a new password for your account.</p>
            <Input
              id="reset-new-password"
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={phase === 'saving'}
            />
            <Input
              id="reset-confirm-password"
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={phase === 'saving'}
            />
            <div role="alert" aria-live="assertive" className={formError ? s.error : s.live}>
              {formError || ''}
            </div>
            <Button variant="primary" fullWidth type="submit" disabled={phase === 'saving'}>
              {phase === 'saving' ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        )}

        {phase === 'success' && (
          <p className={s.muted} role="status" aria-live="polite">
            Your password has been updated. Taking you to your workspace…
          </p>
        )}

        {phase === 'no-session' && (
          <div className={s.form}>
            <p className={s.muted} role="status" aria-live="polite">
              This reset link is invalid or has expired. Request a new link below.
            </p>
            {!cloudEnabled && (
              <p className={s.note}>
                Cloud sync isn't configured in this build. Set VITE_SUPABASE_URL and
                VITE_SUPABASE_ANON_KEY to enable account recovery.
              </p>
            )}
            {requestState === 'sent' ? (
              <p className={s.muted} role="status" aria-live="polite">{RESET_SENT_MESSAGE}</p>
            ) : (
              <form onSubmit={requestLink} className={s.form}>
                <Input
                  id="reset-request-email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                  value={requestEmail}
                  onChange={(e) => setRequestEmail(e.target.value)}
                  disabled={requestState === 'sending'}
                />
                <div role="alert" aria-live="assertive" className={requestError ? s.error : s.live}>
                  {requestError || ''}
                </div>
                <Button variant="primary" fullWidth type="submit" disabled={requestState === 'sending'}>
                  {requestState === 'sending' ? 'Sending…' : 'Send a new link'}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
