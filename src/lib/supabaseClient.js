// Supabase client singleton.
//
// The app is "no-cred safe": when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// are absent (the default for local dev / CI / e2e), `supabaseEnabled` is false
// and `supabase` is null. Every caller must guard on `supabaseEnabled` before
// touching the client. This lets the existing localStorage-only path keep
// working with zero configuration and never throw on a missing key.

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseEnabled =
  typeof url === 'string' && url.length > 0 &&
  typeof anonKey === 'string' && anonKey.length > 0

export const supabase = supabaseEnabled ? createClient(url, anonKey) : null
