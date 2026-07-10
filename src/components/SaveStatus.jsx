import React from 'react'
import { useAppData } from '../data/useAppData.jsx'

// Optimistic-save indicator. Mutations flip the store's saveStatus to 'saving'
// instantly (UI already updated), then back to 'saved' when the background
// persist resolves — the classic optimistic pattern surfaced to the user.
export function SaveStatus() {
  const { saveStatus } = useAppData()
  const saving = saveStatus === 'saving'
  return (
    <span
      title={saving ? 'Saving your changes' : 'All changes saved'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: 999,
        border: '1px solid var(--border-subtle)',
        background: 'var(--surface-sunken)',
        color: 'var(--text-subtle)',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: saving ? 'var(--amber-500, #d97706)' : 'var(--brand-600)',
        }}
      />
      {saving ? 'Saving…' : 'Saved'}
    </span>
  )
}

export default SaveStatus
