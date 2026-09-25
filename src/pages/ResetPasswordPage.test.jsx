import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResetPasswordPage from './ResetPasswordPage.jsx'
import { authCallbackAtLoad } from '../auth/authFlow.js'

const auth = vi.hoisted(() => ({
  cloudEnabled: true,
  recoveryPending: false,
  requestPasswordReset: vi.fn(),
  clearPasswordRecovery: vi.fn(),
}))

const supabase = vi.hoisted(() => ({
  auth: {
    updateUser: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn((cb) => {
      supabase.listeners.push(cb)
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
  },
  listeners: [],
}))

const navigate = vi.hoisted(() => vi.fn())

vi.mock('../lib/supabaseClient.js', () => ({
  get supabaseEnabled() { return auth.cloudEnabled },
  supabase: { auth: supabase.auth },
}))

vi.mock('../auth/AuthProvider.jsx', () => ({
  useAuth: () => auth,
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => navigate }
})

beforeEach(() => {
  auth.cloudEnabled = true
  auth.recoveryPending = false
  auth.requestPasswordReset.mockReset()
  auth.requestPasswordReset.mockResolvedValue(undefined)
  auth.clearPasswordRecovery.mockReset()
  supabase.listeners = []
  supabase.auth.updateUser.mockReset()
  supabase.auth.updateUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  supabase.auth.getSession.mockReset()
  supabase.auth.getSession.mockResolvedValue({ data: { session: null } })
  supabase.auth.onAuthStateChange.mockClear()
  supabase.auth.onAuthStateChange.mockImplementation((cb) => {
    supabase.listeners.push(cb)
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  navigate.mockReset()
  authCallbackAtLoad.indicatesRecovery = false
  authCallbackAtLoad.hasError = false
})

describe('ResetPasswordPage', () => {
  it('calls updateUser for a matching password after PASSWORD_RECOVERY', async () => {
    supabase.auth.onAuthStateChange.mockImplementation((cb) => {
      cb('PASSWORD_RECOVERY', { user: { id: 'user-1' } })
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    await user.type(await screen.findByLabelText('New password'), 'secret1')
    await user.type(screen.getByLabelText('Confirm password'), 'secret1')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    await waitFor(() => {
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'secret1' })
    })
    expect(auth.clearPasswordRecovery).toHaveBeenCalled()
    expect(await screen.findByText(/Your password has been updated/)).toBeTruthy()
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/app', { replace: true })
    }, { timeout: 2500 })
  })

  it('shows the form when a session already exists for a recovery link', async () => {
    authCallbackAtLoad.indicatesRecovery = true
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    render(<ResetPasswordPage />)
    expect(await screen.findByLabelText('New password')).toBeTruthy()
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('shows the form when recovery is already pending and a session exists', async () => {
    auth.recoveryPending = true
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    render(<ResetPasswordPage />)
    expect(await screen.findByLabelText('New password')).toBeTruthy()
  })

  it('sends the typed reset password to updateUser, including surrounding spaces', async () => {
    supabase.auth.onAuthStateChange.mockImplementation((cb) => {
      cb('PASSWORD_RECOVERY', { user: { id: 'user-1' } })
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    await user.type(await screen.findByLabelText('New password'), '  secret1  ')
    await user.type(screen.getByLabelText('Confirm password'), '  secret1  ')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    await waitFor(() => {
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: '  secret1  ' })
    })
  })

  it('rejects a confirm password that differs only by surrounding spaces', async () => {
    supabase.auth.onAuthStateChange.mockImplementation((cb) => {
      cb('PASSWORD_RECOVERY', { user: { id: 'user-1' } })
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    await user.type(await screen.findByLabelText('New password'), 'NewPass1')
    await user.type(screen.getByLabelText('Confirm password'), ' NewPass1 ')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Passwords do not match.')
    })
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('rejects a whitespace-only password before updateUser', async () => {
    supabase.auth.onAuthStateChange.mockImplementation((cb) => {
      cb('PASSWORD_RECOVERY', { user: { id: 'user-1' } })
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    await user.type(await screen.findByLabelText('New password'), '      ')
    await user.type(screen.getByLabelText('Confirm password'), '      ')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Password must be at least 6 characters.')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('rejects a short password and a mismatch before updateUser', async () => {
    supabase.auth.onAuthStateChange.mockImplementation((cb) => {
      cb('PASSWORD_RECOVERY', { user: { id: 'user-1' } })
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    const password = await screen.findByLabelText('New password')
    const confirm = screen.getByLabelText('Confirm password')

    await user.type(password, 'short')
    await user.type(confirm, 'short')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Password must be at least 6 characters.')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()

    await user.clear(password)
    await user.clear(confirm)
    await user.type(password, 'secret1')
    await user.type(confirm, 'secret2')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Passwords do not match.')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('explains a missing recovery session and can request a new link', async () => {
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    expect(await screen.findByText(/invalid or has expired/)).toBeTruthy()
    expect(screen.queryByLabelText('New password')).toBeNull()

    await user.type(screen.getByLabelText('Email'), 'person@example.com')
    await user.click(screen.getByRole('button', { name: 'Send a new link' }))
    expect(auth.requestPasswordReset).toHaveBeenCalledWith('person@example.com')
    expect(await screen.findByText('If an account exists for that email, we sent a reset link.')).toBeTruthy()
  })

  it('hides a network failure and a dumped server payload', async () => {
    supabase.auth.onAuthStateChange.mockImplementation((cb) => {
      cb('PASSWORD_RECOVERY', { user: { id: 'user-1' } })
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    supabase.auth.updateUser.mockResolvedValue({
      data: { user: null },
      error: new TypeError('Failed to fetch'),
    })
    const user = userEvent.setup()
    const view = render(<ResetPasswordPage />)
    await user.type(await screen.findByLabelText('New password'), 'secret1')
    await user.type(screen.getByLabelText('Confirm password'), 'secret1')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Something went wrong. Please check your connection and try again.')
    })
    expect(screen.getByRole('alert').textContent).not.toContain('Failed to fetch')

    view.unmount()
    supabase.auth.onAuthStateChange.mockImplementation((cb) => {
      supabase.listeners.push(cb)
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })
    auth.requestPasswordReset.mockRejectedValue({ message: '{}' })
    render(<ResetPasswordPage />)
    await user.type(await screen.findByLabelText('Email'), 'person@example.com')
    await user.click(screen.getByRole('button', { name: 'Send a new link' }))
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Something went wrong. Please check your connection and try again.')
    })
    expect(screen.queryByText('{}')).toBeNull()
    expect(screen.queryByText('User is banned')).toBeNull()
  })

  it('does not treat an ordinary signed-in session as recovery', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    render(<ResetPasswordPage />)
    expect(await screen.findByText(/invalid or has expired/)).toBeTruthy()
    expect(screen.queryByLabelText('New password')).toBeNull()
  })
})
