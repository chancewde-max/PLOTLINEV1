// AuthProvider — wraps the existing AppDataProvider to add Supabase auth and
// cloud persistence WITHOUT changing useAppData's function signatures.
//
// No-cred (localStorage-only) path:
//   When supabaseEnabled is false, this provider is a transparent pass-through:
//   it exposes the same useAppData context unchanged, user === null, and
//   signIn/signUp reject with a friendly "Cloud not configured" error. The app
//   boots and behaves exactly as before.
//
// Cloud path (when creds are present):
//   - Tracks the Supabase session via onAuthStateChange.
//   - On login: loads the user's cloud snapshot and REPLACES local state
//     (keeps local data if the cloud snapshot is empty).
//   - While logged in: debounced (~800ms) subscription to useAppData state
//     saves the snapshot back to the cloud.
//   - On logout: resets state to defaults and clears the session.

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react'
import { useAppData } from '../data/useAppData.jsx'
import { supabase, supabaseEnabled } from '../lib/supabaseClient.js'
import { loadUserSnapshot, saveUserSnapshot } from '../data/cloudSync.js'

const AuthCtx = createContext(null)

export function useAuth() {
  return useContext(AuthCtx)
}

export function AuthProvider({ children }) {
  const app = useAppData()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(supabaseEnabled)
  const [authError, setAuthError] = useState(null)
  // Global modal open-state, so any component can trigger the auth modal.
  const [authOpen, setAuthOpen] = useState(false)
  const openAuth = useCallback((mode) => {
    setAuthOpen(true)
  }, [])
  const closeAuth = useCallback(() => setAuthOpen(false), [])
  // Flag to avoid echoing our own cloud-save back into another save, and to
  // gate the debounced save until after the initial cloud load has landed.
  const hydratedRef = useRef(false)
  const saveTimer = useRef(null)

  // Debounced push of the current local state to the cloud.
  const flush = useCallback(() => {
    if (!supabaseEnabled || !supabase || !user) return
    saveUserSnapshot(user.id, {
      projects: app.projects,
      sheets: app.sheets,
      customCats: app.customCats,
    }).catch(() => {})
  }, [app.projects, app.sheets, app.customCats, user])

  // ---- Track auth session ----
  useEffect(() => {
    if (!supabaseEnabled || !supabase) {
      setLoading(false)
      return
    }

    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setUser(data.session?.user ?? null)
      setLoading(false)
    }).catch(() => {
      if (active) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      active = false
      sub?.subscription?.unsubscribe?.()
    }
  }, [])

  // ---- On login: load cloud snapshot and hydrate ----
  useEffect(() => {
    if (!supabaseEnabled || !supabase) return
    if (!user) {
      hydratedRef.current = false
      return
    }
    let cancelled = false
    ;(async () => {
      const snap = await loadUserSnapshot(user.id)
      if (cancelled) return
      const hasCloudData =
        snap &&
        ((snap.projects && Object.keys(snap.projects).length) ||
          (snap.sheets && Object.keys(snap.sheets).length) ||
          (snap.customCats && snap.customCats.length))
      // Replace local state with cloud data (merge=false). If the cloud row is
      // empty, keep whatever local edits already exist.
      if (hasCloudData) app.hydrate?.(snap, false)
      hydratedRef.current = true
      // Local edits but empty cloud → push them up so they persist.
      if (!hasCloudData) flush()
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // ---- While logged in: debounced cloud save on state change ----
  useEffect(() => {
    if (!supabaseEnabled || !supabase) return
    if (!user || !hydratedRef.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      flush()
    }, 800)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.projects, app.sheets, app.customCats, user])

  // ---- Auth actions ----
  const signIn = useCallback(async (email, password) => {
    if (!supabaseEnabled || !supabase) {
      throw new Error('Cloud not configured')
    }
    setAuthError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setAuthError(error.message)
      throw error
    }
  }, [])

  const signUp = useCallback(async (email, password) => {
    if (!supabaseEnabled || !supabase) {
      throw new Error('Cloud not configured')
    }
    setAuthError(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setAuthError(error.message)
      throw error
    }
  }, [])

  const signOut = useCallback(async () => {
    if (supabaseEnabled && supabase) {
      await supabase.auth.signOut().catch(() => {})
    }
    setUser(null)
    app.reset?.()
    setAuthError(null)
  }, [app])

  const value = {
    ...app,
    user,
    loading,
    authError,
    authOpen,
    openAuth,
    closeAuth,
    signIn,
    signUp,
    signOut,
    cloudEnabled: supabaseEnabled,
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
