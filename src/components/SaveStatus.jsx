import React from 'react'
import { useAppData } from '../data/useAppData.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'

// Optimistic-save indicator. Mutations flip the store's saveStatus to 'saving'
// instantly (UI already updated), then back to 'saved' when the background
// (local) persist resolves. For a signed-in user, this used to say "Saved"
// unconditionally even when the CLOUD save was silently failing (the root
// cause of a real data-loss incident — see AuthProvider's cloudSyncError) —
// it now shows a hard-to-miss failure state instead of lying about it.
export function SaveStatus() {
  const { saveStatus } = useAppData()
  const { user, cloudEnabled, cloudSyncError } = useAuth() || {}
  const saving = saveStatus === 'saving'
  const cloudFailed = !!(user && cloudEnabled && cloudSyncError)

  const label = cloudFailed ? 'Cloud sync failed' : saving ? 'Saving…' : 'Saved'
  const dotColor = cloudFailed
    ? 'var(--danger-500, #dc2626)'
    : saving ? 'var(--amber-500, #d97706)' : 'var(--brand-600)'
  const title = cloudFailed
    ? cloudSyncError
    : saving
      ? 'Saving your changes'
      : (user && cloudEnabled ? 'Saved and synced to the cloud' : 'All changes saved on this device')

  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: 999,
        border: cloudFailed ? '1px solid var(--danger-500, #dc2626)' : '1px solid var(--border-subtle)',
        background: cloudFailed ? 'var(--danger-bg, #fef2f2)' : 'var(--surface-sunken)',
        color: cloudFailed ? 'var(--danger-500, #dc2626)' : 'var(--text-subtle)',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: dotColor,
        }}
      />
      {label}
    </span>
  )
}

export default SaveStatus
