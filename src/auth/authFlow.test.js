import { describe, expect, it } from 'vitest'
import {
  captureAuthCallback,
  landingRedirectTarget,
  validateNewPassword,
  MIN_PASSWORD_LENGTH,
} from './authFlow.js'

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
  it('recognizes an implicit recovery hash and a reset-password code link', () => {
    expect(captureAuthCallback('https://plotlinev-1.vercel.app/reset-password#access_token=abc&type=recovery').indicatesRecovery).toBe(true)
    expect(captureAuthCallback('https://plotlinev-1.vercel.app/reset-password?code=abc').indicatesRecovery).toBe(true)
  })

  it('ignores ordinary visits and error redirects', () => {
    expect(captureAuthCallback('https://plotlinev-1.vercel.app/reset-password').indicatesRecovery).toBe(false)
    expect(captureAuthCallback('https://plotlinev-1.vercel.app/?code=abc').indicatesRecovery).toBe(false)
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
})
