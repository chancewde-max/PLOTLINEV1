import { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthProvider.jsx'
import { setRecoveryPending } from './authFlow.js'

const stableApp = {
  projects: {},
  sheets: {},
  customCats: [],
  company: {},
  proposalTemplates: [],
  mtoTemplates: [],
  clients: [],
  pdfAssets: {},
  ocrMemory: {},
  phrases: [],
  vendors: [],
  hydrate: vi.fn(),
  reset: vi.fn(),
  hasLocalEdits: () => false,
  updateSheet: vi.fn(),
  addPdfAssets: vi.fn(),
}

const client = vi.hoisted(() => ({
  enabled: true,
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    resetPasswordForEmail: vi.fn(),
    resend: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
  },
}))

vi.mock('../data/useAppData.jsx', () => ({
  useAppData: () => stableApp,
}))

vi.mock('../lib/supabaseClient.js', () => ({
  get supabaseEnabled() { return client.enabled },
  get supabase() { return client.enabled ? { auth: client.auth } : null },
}))

function Harness() {
  const { signUp, signIn, requestPasswordReset, resendSignupConfirmation, authError } = useAuth()
  const [out, setOut] = useState('')
  const run = (fn) => async () => {
    try {
      setOut(JSON.stringify(await fn() ?? null))
    } catch (error) {
      setOut(`ERR:${error.message}`)
    }
  }
  return (
    <div>
      <button type="button" onClick={run(() => signUp('ada@example.com', 'secret12'))}>signup</button>
      <button type="button" onClick={run(() => requestPasswordReset('ada@example.com'))}>reset</button>
      <button type="button" onClick={run(() => resendSignupConfirmation('ada@example.com'))}>resend</button>
      <button type="button" onClick={run(() => signIn('ada@example.com', 'nope'))}>signin</button>
      <pre data-testid="out">{out}</pre>
      <pre data-testid="auth-error">{authError || ''}</pre>
    </div>
  )
}

function renderAuth() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Harness />
      </AuthProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  client.enabled = true
  setRecoveryPending(false)
  client.auth.signUp.mockReset()
  client.auth.signInWithPassword.mockReset()
  client.auth.resetPasswordForEmail.mockReset()
  client.auth.resend.mockReset()
  client.auth.getSession.mockClear()
  client.auth.getSession.mockImplementation(() => Promise.resolve({ data: { session: null } }))
})

describe('AuthProvider signup and recovery helpers', () => {
  it('flags a repeated signup when identities is empty', async () => {
    client.auth.signUp.mockResolvedValue({
      data: { user: { id: 'user-1', identities: [] }, session: null },
      error: null,
    })
    const user = userEvent.setup()
    renderAuth()
    await user.click(screen.getByRole('button', { name: 'signup' }))
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('out').textContent).existingAccount).toBe(true)
    })
    expect(client.auth.signUp).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'secret12' })
  })

  it('flags user_already_exists and email_exists without treating them as generic failures', async () => {
    const user = userEvent.setup()
    for (const code of ['user_already_exists', 'email_exists']) {
      cleanup()
      client.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { code, message: 'User already registered' },
      })
      renderAuth()
      await user.click(screen.getByRole('button', { name: 'signup' }))
      await waitFor(() => {
        expect(JSON.parse(screen.getByTestId('out').textContent).existingAccount).toBe(true)
      })
      expect(screen.getByTestId('auth-error').textContent).toBe('')
    }
  })

  it('does not flag a first-time signup that returns an identity', async () => {
    client.auth.signUp.mockResolvedValue({
      data: { user: { id: 'user-1', identities: [{ id: 'identity-1' }] }, session: null },
      error: null,
    })
    const user = userEvent.setup()
    renderAuth()
    await user.click(screen.getByRole('button', { name: 'signup' }))
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('out').textContent).existingAccount).toBe(false)
    })
  })

  it('calls resetPasswordForEmail with the reset-password redirect', async () => {
    client.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
    const user = userEvent.setup()
    renderAuth()
    await user.click(screen.getByRole('button', { name: 'reset' }))
    await waitFor(() => expect(screen.getByTestId('out').textContent).toBe('null'))
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith('ada@example.com', {
      redirectTo: `${window.location.origin}/reset-password`,
    })
  })

  it('calls auth.resend for signup confirmation', async () => {
    client.auth.resend.mockResolvedValue({ data: {}, error: null })
    const user = userEvent.setup()
    renderAuth()
    await user.click(screen.getByRole('button', { name: 'resend' }))
    await waitFor(() => expect(screen.getByTestId('out').textContent).toBe('null'))
    expect(client.auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'ada@example.com',
      options: { emailRedirectTo: window.location.origin },
    })
  })

  it('keeps Cloud not configured on the new helpers', async () => {
    client.enabled = false
    const user = userEvent.setup()
    renderAuth()
    await user.click(screen.getByRole('button', { name: 'reset' }))
    await waitFor(() => expect(screen.getByTestId('out').textContent).toBe('ERR:Cloud not configured'))
    expect(client.auth.resetPasswordForEmail).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'resend' }))
    await waitFor(() => expect(screen.getByTestId('out').textContent).toBe('ERR:Cloud not configured'))
    expect(client.auth.resend).not.toHaveBeenCalled()
  })

  it('stores the friendly invalid_credentials message', async () => {
    client.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: Object.assign(new Error('Invalid login credentials'), { code: 'invalid_credentials' }),
    })
    const user = userEvent.setup()
    renderAuth()
    await user.click(screen.getByRole('button', { name: 'signin' }))
    await waitFor(() => {
      expect(screen.getByTestId('auth-error').textContent).toBe('Email or password is incorrect.')
    })
  })
})
