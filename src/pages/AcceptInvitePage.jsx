import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getInvitePreview } from '../data/orgSync.js'

export default function AcceptInvitePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { user, cloudEnabled, openAuth, acceptInvite } = useAuth()

  const [preview, setPreview] = useState(undefined) // undefined = loading, null = not found
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!cloudEnabled || !user) {
      // Preview requires an authenticated call (RLS-gated RPC); wait for sign-in.
      setPreview(undefined)
      return
    }
    getInvitePreview(token).then(p => { if (!cancelled) setPreview(p) })
    return () => { cancelled = true }
  }, [token, cloudEnabled, user])

  const accept = async () => {
    setBusy(true); setErr(null)
    try {
      await acceptInvite(token)
      navigate('/app')
    } catch (e) {
      setErr(e?.message || 'Could not accept this invite')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-app)', padding: 24,
    }}>
      <div style={{
        maxWidth: 420, width: '100%', background: 'var(--surface-card)',
        border: '1px solid var(--border-default)', borderRadius: 16, padding: 32, textAlign: 'center',
      }}>
        <img src="/plotline-mark.svg" alt="Plotline" style={{ width: 32, height: 32, marginBottom: 16 }} />

        {!cloudEnabled ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Cloud sync isn't configured in this build, so invites can't be accepted here.
          </p>
        ) : !user ? (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-strong)', margin: '0 0 8px' }}>
              You've been invited to Plotline
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 20px', lineHeight: 1.5 }}>
              Sign in or create an account using the email address this invite was sent to,
              then come back to this link to join the team.
            </p>
            <Button variant="primary" fullWidth onClick={() => openAuth('signin')}>Sign in</Button>
          </>
        ) : preview === undefined ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading invite…</p>
        ) : preview === null ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            This invite link is invalid, expired, or already used.
          </p>
        ) : preview.status !== 'pending' ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            This invite has already been {preview.status}.
          </p>
        ) : (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-strong)', margin: '0 0 8px' }}>
              Join {preview.org_name}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 4px' }}>
              You're invited as <b>{preview.role === 'admin' ? 'an admin' : 'a member'}</b>.
            </p>
            <p style={{ color: 'var(--text-subtle)', fontSize: 12, margin: '0 0 20px' }}>
              Invite sent to {preview.email}
            </p>
            {err && (
              <div style={{
                fontSize: 13, color: 'var(--danger-500, #dc2626)', background: 'var(--danger-bg, rgba(220,38,38,0.08))',
                borderRadius: 8, padding: '8px 10px', marginBottom: 14, textAlign: 'left',
              }}>
                {err}
              </div>
            )}
            <Button variant="primary" fullWidth onClick={accept} disabled={busy}>
              {busy ? 'Joining…' : `Join ${preview.org_name}`}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
