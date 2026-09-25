// Shared auth-flow decisions for the modal, the provider, and /reset-password.
//
// Password length matches the signup field (Supabase Auth's default minimum).
// Recovery URL details are captured at module load: the client parses and then
// strips the hash/code asynchronously, so a later read of window.location
// cannot tell a recovery callback from a normal visit.

export const MIN_PASSWORD_LENGTH = 6

export const RESET_SENT_MESSAGE =
  'If an account exists for that email, we sent a reset link.'

export const EMAIL_NOT_CONFIRMED_MESSAGE =
  'Please confirm your email first. Check your inbox for the confirmation link.'

export const INVALID_CREDENTIALS_MESSAGE = 'Email or password is incorrect.'

export const EXISTING_ACCOUNT_MESSAGE =
  'An account with this email already exists. Sign in instead, or use Forgot password.'

export const RESEND_COOLDOWN_SECONDS = 60

export function isEmailNotConfirmed(error) {
  return error?.code === 'email_not_confirmed' || error?.message === 'Email not confirmed'
}

export function isInvalidCredentials(error) {
  return error?.code === 'invalid_credentials' || error?.message === 'Invalid login credentials'
}

export function friendlySignInMessage(error) {
  if (isEmailNotConfirmed(error)) return EMAIL_NOT_CONFIRMED_MESSAGE
  if (isInvalidCredentials(error)) return INVALID_CREDENTIALS_MESSAGE
  return error?.message || 'Something went wrong'
}

export function isExistingAccountError(error) {
  return error?.code === 'user_already_exists' || error?.code === 'email_exists'
}

// Email confirmation on: Supabase returns 200 with an empty identities array
// for an address that already has an account (user_repeated_signup).
export function isRepeatedSignupUser(data) {
  return !!(
    data?.user &&
    Array.isArray(data.user.identities) &&
    data.user.identities.length === 0
  )
}

export function validateNewPassword(password, confirm) {
  if ((password || '').length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (password !== confirm) return 'Passwords do not match.'
  return null
}

export function captureAuthCallback(href) {
  let url
  try {
    url = new URL(href)
  } catch {
    return { indicatesRecovery: false, hasError: false }
  }
  const hash = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
  const type = hash.get('type') || url.searchParams.get('type')
  const hasError = Boolean(
    hash.get('error') ||
    hash.get('error_code') ||
    url.searchParams.get('error') ||
    url.searchParams.get('error_code')
  )
  const hasCode = url.searchParams.has('code')
  const path = url.pathname.replace(/\/$/, '') || '/'
  // Implicit recovery links carry type=recovery. PKCE recovery links land on
  // /reset-password?code=… (the redirect type itself is stored with the verifier).
  const indicatesRecovery = !hasError && (
    type === 'recovery' ||
    (hasCode && path === '/reset-password')
  )
  return { indicatesRecovery, hasError, type }
}

export const authCallbackAtLoad = captureAuthCallback(
  typeof window !== 'undefined' ? window.location.href : 'http://localhost/'
)

// The recovery hash/code is removed once the client parses it. Remember the
// in-progress recovery for this tab so a refresh still shows the new-password
// form instead of treating the restored session as a normal sign-in.
const RECOVERY_KEY = 'plotline-password-recovery'

function readStoredRecovery() {
  try { return sessionStorage.getItem(RECOVERY_KEY) === '1' } catch { return false }
}

function writeStoredRecovery(value) {
  try {
    if (value) sessionStorage.setItem(RECOVERY_KEY, '1')
    else sessionStorage.removeItem(RECOVERY_KEY)
  } catch { /* private mode / unavailable */ }
}

let recoveryPending = readStoredRecovery()
const recoveryListeners = new Set()

export function isRecoveryPending() {
  return recoveryPending
}

export function setRecoveryPending(value) {
  const next = Boolean(value)
  writeStoredRecovery(next)
  if (next === recoveryPending) return
  recoveryPending = next
  recoveryListeners.forEach((listener) => listener(recoveryPending))
}

export function subscribeRecoveryPending(listener) {
  recoveryListeners.add(listener)
  return () => recoveryListeners.delete(listener)
}

// Where a signed-in visit to "/" should go. A recovery session must not be
// sent into the app before a new password is chosen.
export function landingRedirectTarget({ user, recoveryPending: pending }) {
  if (pending) return '/reset-password'
  if (user) return '/app'
  return null
}
