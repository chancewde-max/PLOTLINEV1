import { useState } from 'react'
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
  auth.clearAuthError = vi.fn(() => { auth.authError = null })
  auth.signIn.mockReset()
  auth.signUp.mockReset()
  auth.signOut.mockReset()
  auth.requestPasswordReset.mockReset()
  auth.resendSignupConfirmation.mockReset()
})

function rejectSignIn(error, message) {
  auth.signIn.mockImplementation(async () => {
    auth.authError = message
    throw error
  })
}

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
    expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeTruthy()
    expect(screen.queryByText(/Already have an account/)).toBeNull()
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

  it('shows the fallback for a 500 and for Failed to fetch, with no raw text', async () => {
    const fallback = 'Something went wrong. Please check your connection and try again.'
    const user = userEvent.setup()
    render(<AuthModal open onClose={vi.fn()} />)
    await fillCredentials(user)

    auth.signIn.mockRejectedValueOnce({ status: 500, code: 'unexpected_failure', message: '{}' })
    await user.click(screen.getByRole('button', { name: 'Continue with email' }))
    let alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(fallback)
    expect(alert.textContent).not.toContain('{}')
    expect(alert.textContent).not.toContain('unexpected_failure')

    auth.signIn.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await user.click(screen.getByRole('button', { name: 'Continue with email' }))
    alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(fallback)
    expect(alert.textContent).not.toContain('Failed to fetch')
    expect(screen.queryByText('{}')).toBeNull()
  })

  it('rejects a whitespace-only signup password', async () => {
    const user = userEvent.setup()
    render(<AuthModal open onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Create one' }))
    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), '      ')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Password must be at least 6 characters.')
    expect(auth.signUp).not.toHaveBeenCalled()
  })

  it('hides a network TypeError behind the connection fallback', async () => {
    auth.signIn.mockRejectedValue(new TypeError('Failed to fetch'))
    const user = userEvent.setup()
    render(<AuthModal open onClose={vi.fn()} />)
    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: 'Continue with email' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Something went wrong. Please check your connection and try again.')
    expect(alert.textContent).not.toContain('Failed to fetch')
  })

  it('hides an empty server payload behind the connection fallback', async () => {
    auth.signUp.mockRejectedValue({ message: '{}' })
    const user = userEvent.setup()
    render(<AuthModal open onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Create one' }))
    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret12')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Something went wrong. Please check your connection and try again.')
    expect(alert.textContent).not.toContain('{}')
  })

  it('hides a banned-user message behind the connection fallback', async () => {
    auth.requestPasswordReset.mockRejectedValue(new Error('User is banned'))
    const user = userEvent.setup()
    render(<AuthModal open onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }))
    await user.type(screen.getByLabelText('Email'), 'person@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Something went wrong. Please check your connection and try again.')
    expect(alert.textContent).not.toContain('User is banned')
  })

  it('maps an email rate-limit message to the wait copy', async () => {
    auth.signIn.mockRejectedValue(new Error('email rate limit exceeded'))
    const user = userEvent.setup()
    render(<AuthModal open onClose={vi.fn()} />)
    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: 'Continue with email' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Too many attempts, please wait a few minutes and try again.')
    expect(alert.textContent).not.toContain('email rate limit exceeded')
  })

  it('resends confirmation to the email that failed and clears the notice when that field changes', async () => {
    const message = 'Please confirm your email first. Check your inbox for the confirmation link.'
    rejectSignIn(
      Object.assign(new Error('Email not confirmed'), { code: 'email_not_confirmed' }),
      message,
    )
    auth.resendSignupConfirmation.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AuthModal open onClose={vi.fn()} />)
    await fillCredentials(user, 'first@example.com')
    await user.click(screen.getByRole('button', { name: 'Continue with email' }))
    expect(await screen.findByText(/Please confirm your email first/)).toBeTruthy()

    const email = screen.getByLabelText('Email')
    await user.clear(email)
    await user.type(email, 'other@example.com')
    expect(screen.queryByText(/Please confirm your email first/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Resend confirmation email' })).toBeNull()

    await user.clear(email)
    await user.type(email, 'first@example.com')
    await user.click(screen.getByRole('button', { name: 'Continue with email' }))
    await user.click(await screen.findByRole('button', { name: 'Resend confirmation email' }))
    expect(auth.resendSignupConfirmation).toHaveBeenCalledWith('first@example.com')
  })

  it('returns to the sign-in view after Escape and Sign in', async () => {
    auth.requestPasswordReset.mockResolvedValue(undefined)
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Sign in</button>
          <AuthModal open={open} onClose={() => setOpen(false)} />
        </>
      )
    }
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }))
    await user.type(screen.getByLabelText('Email'), 'person@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByText(/If an account exists for that email/)).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByRole('button', { name: 'Continue with email' })).toBeTruthy()
    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.queryByText(/If an account exists for that email/)).toBeNull()
  })

  it('replaces an unknown sign-in error with the connection fallback', async () => {
    auth.signIn.mockRejectedValue(new Error('Network down'))
    const user = userEvent.setup()
    render(<AuthModal open onClose={vi.fn()} />)
    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: 'Continue with email' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Something went wrong. Please check your connection and try again.')
    expect(alert.textContent).not.toContain('Network down')
  })

  it('shows resend errors and keeps the button enabled', async () => {
    auth.signIn.mockRejectedValue(Object.assign(new Error('Email not confirmed'), { code: 'email_not_confirmed' }))
    auth.resendSignupConfirmation.mockRejectedValue(new Error('Rate limit'))
    const user = userEvent.setup()
    render(<AuthModal open onClose={vi.fn()} />)
    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: 'Continue with email' }))
    await user.click(await screen.findByRole('button', { name: 'Resend confirmation email' }))
    expect(await screen.findByText('Too many attempts, please wait a few minutes and try again.')).toBeTruthy()
    expect(screen.queryByText('Rate limit')).toBeNull()
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

  it('clears a failed sign-in when switching to reset or sign-up, and when the dialog closes', async () => {
    const message = 'Email or password is incorrect.'
    rejectSignIn(
      Object.assign(new Error('Invalid login credentials'), { code: 'invalid_credentials' }),
      message,
    )
    const user = userEvent.setup()
    const onClose = vi.fn()
    const view = render(<AuthModal open onClose={onClose} />)
    await fillCredentials(user, 'person@example.com', 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Continue with email' }))
    expect((await screen.findByRole('alert')).textContent).toBe(message)

    await user.click(screen.getByRole('button', { name: 'Forgot password?' }))
    expect(screen.queryByText(message)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(auth.authError).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Back to sign in' }))
    await user.click(screen.getByRole('button', { name: 'Continue with email' }))
    expect((await screen.findByRole('alert')).textContent).toBe(message)
    await user.click(screen.getByRole('button', { name: 'Create one' }))
    expect(screen.queryByText(message)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await user.click(screen.getByRole('button', { name: 'Continue with email' }))
    expect((await screen.findByRole('alert')).textContent).toBe(message)
    await user.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(screen.queryByText(message)).toBeNull()
    expect(auth.authError).toBeNull()
    expect(onClose).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Continue with email' }))
    expect((await screen.findByRole('alert')).textContent).toBe(message)
    view.rerender(<AuthModal open={false} onClose={onClose} />)
    expect(auth.authError).toBeNull()
    view.rerender(<AuthModal open onClose={onClose} />)
    expect(screen.queryByText(message)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('clears the email_not_confirmed message when leaving sign-in', async () => {
    const message = 'Please confirm your email first. Check your inbox for the confirmation link.'
    rejectSignIn(
      Object.assign(new Error('Email not confirmed'), { code: 'email_not_confirmed' }),
      message,
    )
    const user = userEvent.setup()
    render(<AuthModal open onClose={vi.fn()} />)
    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: 'Continue with email' }))
    expect((await screen.findByRole('status')).textContent).toContain(message)

    await user.click(screen.getByRole('button', { name: 'Forgot password?' }))
    expect(screen.queryByText(message)).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText('Resend confirmation email')).toBeNull()
    expect(auth.authError).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Back to sign in' }))
    await user.click(screen.getByRole('button', { name: 'Continue with email' }))
    expect((await screen.findByRole('status')).textContent).toContain(message)
    await user.click(screen.getByRole('button', { name: 'Create one' }))
    expect(screen.queryByText(message)).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(auth.authError).toBeNull()
  })

  it('clears the repeated-signup message when switching to sign-in or reset', async () => {
    const user = userEvent.setup()
    auth.signUp.mockImplementation(async () => {
      auth.authError = EXISTING
      return { existingAccount: true }
    })
    render(<AuthModal open onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Create one' }))
    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret12')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect((await screen.findByRole('status')).textContent).toBe(EXISTING)

    await user.click(screen.getByRole('button', { name: 'Forgot password' }))
    expect(screen.queryByText(/already exists/)).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(auth.authError).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Back to sign in' }))
    await user.click(screen.getByRole('button', { name: 'Create one' }))
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect((await screen.findByRole('status')).textContent).toBe(EXISTING)
    await user.click(screen.getByRole('status').querySelector('button'))
    expect(screen.queryByText(/already exists/)).toBeNull()
    expect(screen.getByLabelText('Password')).toBeTruthy()
    expect(auth.authError).toBeNull()
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
