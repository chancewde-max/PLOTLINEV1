// AuthProvider — wraps the existing AppDataProvider to add Supabase auth,
// cloud persistence, and organization ("team") membership WITHOUT changing
// useAppData's function signatures.
//
// No-cred (localStorage-only) path:
//   When supabaseEnabled is false, this provider is a transparent pass-through:
//   it exposes the same useAppData context unchanged, user === null, and
//   signIn/signUp reject with a friendly "Cloud not configured" error. The app
//   boots and behaves exactly as before.
//
// Cloud path (when creds are present):
//   - Tracks the Supabase session via onAuthStateChange.
//   - On login: resolves which organization (if any) the user belongs to —
//     v1 assumes at most one — then loads that org's SHARED snapshot
//     (org_data) if in an org, or the user's PERSONAL snapshot (app_data)
//     otherwise, and REPLACES local state (keeps local data if the cloud
//     snapshot is empty).
//   - While logged in: debounced (~800ms) subscription to useAppData state
//     saves the snapshot back to whichever source is currently active
//     (org_data vs app_data).
//   - createOrganization / acceptInvite / leaveOrganization switch the active
//     data source live and re-hydrate from the new source.
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
import { loadUserSnapshot, saveUserSnapshot, emptySnapshot } from '../data/cloudSync.js'
import {
  listMyOrgMemberships,
  createOrganization as createOrganizationApi,
  acceptInvite as acceptInviteApi,
  leaveOrganization as leaveOrganizationApi,
  loadOrgSnapshot,
  saveOrgSnapshot,
} from '../data/orgSync.js'

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

  // ---- Organization membership (v1: at most one org per user) ----
  const [orgId, setOrgId] = useState(null)
  const [orgRole, setOrgRole] = useState(null)
  const [orgName, setOrgName] = useState(null)
  const [orgLoading, setOrgLoading] = useState(false)
  // Mirrors orgId but readable synchronously inside async flows, so flush()
  // always saves to whichever source is *actually* current, even mid-switch.
  const orgIdRef = useRef(null)

  const loadOrgContext = useCallback(async (uid) => {
    setOrgLoading(true)
    const memberships = await listMyOrgMemberships(uid)
    const primary = memberships[0] || null
    const nextOrgId = primary?.org_id ?? null
    orgIdRef.current = nextOrgId
    setOrgId(nextOrgId)
    setOrgRole(primary?.role ?? null)
    setOrgName(primary?.organizations?.name ?? null)
    setOrgLoading(false)
    return nextOrgId
  }, [])

  // Debounced push of the current local state to the cloud (org or personal).
  const flush = useCallback(() => {
    if (!supabaseEnabled || !supabase || !user) return
    const payload = {
      projects: app.projects,
      sheets: app.sheets,
      customCats: app.customCats,
      company: app.company,
    }
    if (orgIdRef.current) {
      saveOrgSnapshot(orgIdRef.current, payload).catch(() => {})
    } else {
      saveUserSnapshot(user.id, payload).catch(() => {})
    }
  }, [app.projects, app.sheets, app.customCats, app.company, user])

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

  // ---- On login: resolve org membership, then load the right snapshot ----
  useEffect(() => {
    if (!supabaseEnabled || !supabase) return
    if (!user) {
      hydratedRef.current = false
      orgIdRef.current = null
      setOrgId(null)
      setOrgRole(null)
      setOrgName(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const nextOrgId = await loadOrgContext(user.id)
      if (cancelled) return
      const snap = nextOrgId
        ? await loadOrgSnapshot(nextOrgId)
        : await loadUserSnapshot(user.id)
      if (cancelled) return
      const hasCloudData =
        snap &&
        ((snap.projects && Object.keys(snap.projects).length) ||
          (snap.sheets && Object.keys(snap.sheets).length) ||
          (snap.customCats && snap.customCats.length) ||
          (snap.company && snap.company.name))
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
  }, [app.projects, app.sheets, app.customCats, app.company, user])

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
    orgIdRef.current = null
    setOrgId(null)
    setOrgRole(null)
    setOrgName(null)
    app.reset?.()
    setAuthError(null)
  }, [app])

  // ---- Organization actions ----
  // Create a team, switch the active data source to it immediately (starting
  // from an empty shared snapshot — local personal projects are NOT copied
  // in, so nothing leaks into a brand-new org by accident).
  const createOrganization = useCallback(async (name) => {
    if (!supabaseEnabled || !supabase || !user) throw new Error('Cloud not configured')
    const newOrgId = await createOrganizationApi(name)
    await loadOrgContext(user.id)
    const snap = await loadOrgSnapshot(newOrgId)
    app.hydrate?.(snap || emptySnapshot(), false)
    return newOrgId
  }, [user, app, loadOrgContext])

  const acceptInvite = useCallback(async (token) => {
    if (!supabaseEnabled || !supabase || !user) throw new Error('Cloud not configured')
    const newOrgId = await acceptInviteApi(token)
    await loadOrgContext(user.id)
    const snap = await loadOrgSnapshot(newOrgId)
    app.hydrate?.(snap || emptySnapshot(), false)
    return newOrgId
  }, [user, app, loadOrgContext])

  // Leave the current org and fall back to the user's personal workspace.
  const leaveOrganization = useCallback(async () => {
    if (!supabaseEnabled || !supabase || !user || !orgIdRef.current) return
    await leaveOrganizationApi(orgIdRef.current, user.id)
    orgIdRef.current = null
    setOrgId(null)
    setOrgRole(null)
    setOrgName(null)
    const snap = await loadUserSnapshot(user.id)
    app.hydrate?.(snap || emptySnapshot(), false)
  }, [user, app])

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
    // Organization / team context
    orgId,
    orgRole,
    orgName,
    orgLoading,
    isOrgAdmin: orgRole === 'admin',
    createOrganization,
    acceptInvite,
    leaveOrganization,
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
