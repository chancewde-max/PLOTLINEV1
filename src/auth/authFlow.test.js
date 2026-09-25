import { describe, expect, it } from 'vitest'
import {
  captureAuthCallback,
  friendlySignInMessage,
  landingRedirectTarget,
  validateNewPassword,
  MIN_PASSWORD_LENGTH,
} from './authFlow.js'

const GENERIC_AUTH_ERROR = 'Something went wrong. Please check your connection and try again.'
const RATE_LIMIT_MESSAGE = 'Too many attempts, please wait a few minutes and try again.'

describe('landingRedirectTarget', () => {
  it('sends a recovery session to /reset-password instead of /app', () => {
    expect(landingRedirectTarget({
      user: { id: 'user-1' },
      recoveryPending: true,
    })).toBe('/reset-password')
  })

  it('sends a normal signed-in visit to /app', () => {
    expect(landingRedirectTarget({
      user: { id: 'user-1' },
      recoveryPending: false,
    })).toBe('/app')
  })

  it('leaves signed-out visitors on the landing page', () => {
    expect(landingRedirectTarget({ user: null, recoveryPending: false })).toBeNull()
  })
})

describe('captureAuthCallback', () => {
  it('recognizes an implicit recovery hash', () => {
    expect(captureAuthCallback('https://plotlinev-1.vercel.app/reset-password#access_token=abc&type=recovery').indicatesRecovery).toBe(true)
  })

  it('ignores a ?code= query because this client does not exchange PKCE codes', () => {
    expect(captureAuthCallback('https://plotlinev-1.vercel.app/reset-password?code=abc').indicatesRecovery).toBe(false)
    expect(captureAuthCallback('https://plotlinev-1.vercel.app/?code=abc').indicatesRecovery).toBe(false)
  })

  it('ignores ordinary visits and error redirects', () => {
    expect(captureAuthCallback('https://plotlinev-1.vercel.app/reset-password').indicatesRecovery).toBe(false)
    expect(captureAuthCallback('https://plotlinev-1.vercel.app/reset-password#error=access_denied&error_code=otp_expired').indicatesRecovery).toBe(false)
  })
})

describe('validateNewPassword', () => {
  it('uses the same minimum length as signup and requires a match', () => {
    expect(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1), 'a'.repeat(MIN_PASSWORD_LENGTH - 1)))
      .toMatch(/at least 6/)
    expect(validateNewPassword('secret1', 'secret2')).toBe('Passwords do not match.')
    expect(validateNewPassword('secret1', 'secret1')).toBeNull()
  })

  it('rejects a password that is only spaces', () => {
    expect(validateNewPassword('      ', '      ')).toMatch(/at least 6/)
  })
})

describe('friendlySignInMessage', () => {
  it('maps a 500 and a network TypeError to the fallback with no raw text', () => {
    const server = { status: 500, code: 'unexpected_failure', message: '{}' }
    const network = new TypeError('Failed to fetch')
    for (const error of [server, network]) {
      const text = friendlySignInMessage(error)
      expect(text).toBe(GENERIC_AUTH_ERROR)
      expect(text).not.toContain('{}')
      expect(text).not.toContain('Failed to fetch')
      expect(text).not.toContain('unexpected_failure')
      expect(text).not.toContain('Internal Server Error')
    }
    const supabaseText = Object.assign(new Error('Internal Server Error'), { status: 500 })
    const text = friendlySignInMessage(supabaseText)
    expect(text).toBe(GENERIC_AUTH_ERROR)
    expect(text).not.toContain('Internal Server Error')
    expect(text).not.toContain('{}')
  })

  it('hides a network TypeError behind the connection fallback', () => {
    const error = new TypeError('Failed to fetch')
    expect(friendlySignInMessage(error)).toBe(GENERIC_AUTH_ERROR)
    expect(friendlySignInMessage(error)).not.toContain('Failed to fetch')
  })

  it('hides an empty server payload behind the connection fallback', () => {
    expect(friendlySignInMessage({})).toBe(GENERIC_AUTH_ERROR)
    expect(friendlySignInMessage({ message: '{}' })).toBe(GENERIC_AUTH_ERROR)
    expect(friendlySignInMessage({ message: '{}' })).not.toContain('{}')
  })

  it('hides a banned-user message behind the connection fallback', () => {
    const error = Object.assign(new Error('User is banned'), { code: 'user_banned' })
    expect(friendlySignInMessage(error)).toBe(GENERIC_AUTH_ERROR)
    expect(friendlySignInMessage(error)).not.toContain('banned')
  })

  it('maps an email rate-limit message to the wait copy', () => {
    const error = Object.assign(new Error('email rate limit exceeded'), { code: 'over_email_send_rate_limit' })
    expect(friendlySignInMessage(error)).toBe(RATE_LIMIT_MESSAGE)
    expect(friendlySignInMessage(error)).not.toContain('email rate limit exceeded')
    expect(friendlySignInMessage(new Error('For security purposes, you can only request this after 42 seconds.'))).toBe(RATE_LIMIT_MESSAGE)
  })

  it('maps known password codes without echoing the server text', () => {
    expect(friendlySignInMessage(Object.assign(new Error('Password should be at least 6 characters.'), { code: 'weak_password' })))
      .toMatch(/at least 6/)
    expect(friendlySignInMessage(Object.assign(new Error('New password should be different from the old password.'), { code: 'same_password' })))
      .toBe('Choose a different password than your current one.')
  })

  it('keeps the app-authored cloud message', () => {
    expect(friendlySignInMessage(new Error('Cloud not configured'))).toBe('Cloud not configured')
  })
})
