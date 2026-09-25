import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthModal } from './AuthModal.jsx'

const auth = vi.hoisted(() => ({
  user: null,
  loading: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  authError: null,
  cloudEnabled: true,
  requestPasswordReset: vi.fn(),
  resendSignupConfirmation: vi.fn(),
}))

vi.mock('./AuthProvider.jsx', () => ({
  useAuth: () => auth,
}))

const EXISTING = 'An account with this email already exists. Sign in instead, or use Forgot password.'

beforeEach(() => {
  auth.user = null
  auth.loading = false
  auth.authError = null
  auth.cloudEnabled = true
  auth.signIn.mockReset()
  auth.signUp.mockReset()
  auth.signOut.mockReset()
  auth.requestPasswordReset.mockReset()
  auth.resendSignupConfirmation.mockReset()
})

async function fillCredentials(user, email = 'person@example.com', password = 'secret12') {
  await user.type(screen.getByLabelText('Email'), email)
  if (screen.queryByLabelText('Password')) {
    await user.type(screen.getByLabelText('Password'), password)
  }
}

describe('AuthModal recovery and sign-in errors', () => {
  it('forgot password calls reset and shows the neutral confirmation', async () => {
    auth.requestPasswordReset.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AuthModal open onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Forgot password?' }))
    const email = screen.getByLabelText('Email')
    expect(document.activeElement).toBe(email)
    expect(screen.queryByLabelText('Password')).toBeNull()

    await user.type(email, 'person@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(auth.requestPasswordReset).toHaveBeenCalledWith('person@example.com')
    expect(screen.getByRole('status').textContent).toContain(
      'If an account exists for that email, we sent a reset link.'
    )

    await user.click(screen.getByRole('button', { name: 'Back to sign in' }))
    expect(screen.getByRole('button', { name: 'Continue with email' })).toBeTruthy()
    expect(screen.getByLabelText('Email')).toHaveProperty('value', 'person@example.com')
  })

  it('email_not_confirmed offers a resend that reports sent and cooldown', async () => {
    auth.signIn.mockRejectedValue(Object.assign(new Error('Email not confirmed'), { code: 'email_not_confirmed' }))
    auth.resendSignupConfirmation.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AuthModal open onClose={vi.fn()} />)
    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: 'Continue with email' }))

    const status = await screen.findByRole('status')
    expect(status.textContent).toContain('Please confirm your email first. Check your inbox for the confirmation link.')

    await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
    expect(auth.resendSignupConfirmation).toHaveBeenCalledWith('person@example.com')
    expect(await screen.findByText('Confirmation email sent.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Resend confirmation email' }).disabled).toBe(true)
    expect(status.textContent).toMatch(/60s/)
  })

  it('treats the Email not confirmed message as unconfirmed when code is missing', async () => {
    auth.signIn.mockRejectedValue(new Error('Email not confirmed'))
    const user = userEvent.setup()
    render(<AuthModal open onClose={vi.fn()} />)
    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: 'Continue with email' }))
    expect((await screen.findByRole('status')).textContent).toContain(
      'Please confirm your email first. Check your inbox for the confirmation link.'
    )
  })

  it('maps invalid_credentials to a friendly message', async () => {
    auth.signIn.mockRejectedValue(Object.assign(new Error('Invalid login credentials'), { code: 'invalid_credentials' }))
    const user = userEvent.setup()
    render(<AuthModal open onClose={vi.fn()} />)
    await fillCredentials(user, 'person@example.com', 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Continue with email' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Email or password is incorrect.')
  })

  it('maps the Invalid login credentials message when code is missing', async () => {
    auth.signIn.mockRejectedValue(new Error('Invalid login credentials'))
    const user = userEvent.setup()
    render(<AuthModal open onClose={vi.fn()} />)
    await fillCredentials(user, 'person@example.com', 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Continue with email' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Email or password is incorrect.')
  })

  it('leaves other sign-in errors unchanged', async () => {
    auth.signIn.mockRejectedValue(new Error('Network down'))
    const user = userEvent.setup()
    render(<AuthModal open onClose={vi.fn()} />)
    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: 'Continue with email' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Network down')
  })

  it('shows resend errors and keeps the button enabled', async () => {
    auth.signIn.mockRejectedValue(Object.assign(new Error('Email not confirmed'), { code: 'email_not_confirmed' }))
    auth.resendSignupConfirmation.mockRejectedValue(new Error('Rate limit'))
    const user = userEvent.setup()
    render(<AuthModal open onClose={vi.fn()} />)
    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: 'Continue with email' }))
    await user.click(await screen.findByRole('button', { name: 'Resend confirmation email' }))
    expect(await screen.findByText('Rate limit')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Resend confirmation email' }).disabled).toBe(false)
  })

  it('links an existing account to sign-in and forgot-password with the email kept', async () => {
    auth.signUp.mockResolvedValue({ existingAccount: true })
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<AuthModal open onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Create one' }))
    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret12')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    const status = await screen.findByRole('status')
    expect(status.textContent).toBe(EXISTING)
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Forgot password' }))
    expect(document.activeElement).toBe(screen.getByLabelText('Email'))
    expect(screen.getByLabelText('Email')).toHaveProperty('value', 'ada@example.com')
    expect(screen.queryByLabelText('Password')).toBeNull()
  })

  it('switches an existing account to sign-in with the email kept', async () => {
    auth.signUp.mockResolvedValue({ existingAccount: true })
    const user = userEvent.setup()
    render(<AuthModal open onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Create one' }))
    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret12')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    const status = await screen.findByRole('status')
    await user.click(status.querySelector('button'))
    expect(screen.getByLabelText('Password')).toBeTruthy()
    expect(screen.getByLabelText('Email')).toHaveProperty('value', 'ada@example.com')
  })
})
