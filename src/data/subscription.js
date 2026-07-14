// Self-contained, per-browser subscription simulation — no billing backend.
// Used to gate the post-login redirect (pricing vs. projects) and drive the
// Settings billing panel. NOT tied to the Supabase account or a real payment
// provider: it's localStorage only, so it won't follow a user across
// devices/browsers and doesn't actually charge anyone. See SUPABASE_SETUP.md
// / ask before treating this as real billing enforcement.

export const SUB_KEY = 'plotline-subscription'

// Load persisted subscription, or seed a default Pro trial on first run —
// matches the "Start free trial, no card required" marketing copy.
export function loadSubscription() {
  try {
    const raw = localStorage.getItem(SUB_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore corrupt storage */ }
  const next = new Date()
  next.setDate(next.getDate() + 30)
  return {
    status: 'active',
    plan: 'Pro',
    nextBilling: next.toISOString(),
    cancelledAt: null,
    cancelEffective: null,
  }
}

// True while the account should still have app access: actively subscribed,
// or cancelled but still inside the paid-through period.
export function hasActiveAccess(sub) {
  if (!sub) return false
  if (sub.status === 'active') return true
  if (sub.status === 'cancelled' && sub.cancelEffective) {
    return new Date(sub.cancelEffective).getTime() > Date.now()
  }
  return false
}
