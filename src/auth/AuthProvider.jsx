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
//   - A user can belong to any number of organizations. `memberships` holds
//     all of them; `orgId`/`orgRole`/`orgName` describe whichever ONE is the
//     active "workspace" right now (null orgId = the user's personal
//     workspace). `switchWorkspace(orgId | null)` moves between them.
//   - On login: loads memberships, restores the last-used workspace for this
//     user (localStorage), and hydrates from that workspace's snapshot
//     (org_data if in a team, app_data if personal). Replaces local state
//     (keeps local data if the cloud snapshot is empty).
//   - While on a workspace: debounced (~800ms) subscription to useAppData
//     state saves the snapshot back to whichever source is currently active.
//   - switchWorkspace / createOrganization / acceptInvite / leaveOrganization
//     all flush any pending edits to the OUTGOING workspace first (so a
//     switch never leaks one workspace's edits into another's row), then
//     hydrate from the new one.
//   - On logout: resets state to defaults and clears the session.

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react'
import { useNavigate } from 'react-router-dom'
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

// Remember which workspace a user was last on, per-browser, so a reload (or
// the invite-accept redirect) lands them back where they left off.
const WORKSPACE_KEY_PREFIX = 'plotline-workspace-'
function getWorkspacePref(userId) {
  try { return localStorage.getItem(WORKSPACE_KEY_PREFIX + userId) || null } catch { return null }
}
function setWorkspacePref(userId, orgId) {
  try {
    if (orgId) localStorage.setItem(WORKSPACE_KEY_PREFIX + userId, orgId)
    else localStorage.removeItem(WORKSPACE_KEY_PREFIX + userId)
  } catch { /* ignore */ }
}

// Flatten the org_members(+organizations) join into a simple list the UI can
// render directly: [{ org_id, role, name }, ...]
function flattenMemberships(rows) {
  return (rows || []).map(r => ({
    org_id: r.org_id,
    role: r.role,
    name: r.organizations?.name || 'Untitled team',
  }))
}

export function AuthProvider({ children }) {
  const app = useAppData()
  const navigate = useNavigate()
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

  // ---- Organization membership ----
  // `memberships` = every org the user belongs to. `orgId` (+ role/name) =
  // the ONE currently-active workspace (null = personal).
  const [memberships, setMemberships] = useState([])
  const [orgId, setOrgId] = useState(null)
  const [orgRole, setOrgRole] = useState(null)
  const [orgName, setOrgName] = useState(null)
  const [orgLoading, setOrgLoading] = useState(false)
  // True from the moment a user is known (session restored or just signed
  // in) until their workspace snapshot has been fetched and merged into
  // local state. Pages consume this (as `dataLoading`) to show a skeleton
  // instead of flashing stale/sample data or a false "not found".
  const [hydrating, setHydrating] = useState(false)
  // Mirrors orgId but readable synchronously inside async flows, so
  // flushCurrent() always saves to whichever source is *actually* current,
  // even mid-switch.
  const orgIdRef = useRef(null)

  const refreshMemberships = useCallback(async (uid) => {
    const rows = await listMyOrgMemberships(uid)
    const flat = flattenMemberships(rows)
    setMemberships(flat)
    return flat
  }, [])

  // Save whatever's currently in useAppData to the workspace we're LEAVING
  // (org_data or app_data, whichever orgIdRef.current currently points at)
  // before we swap the data source out from under it.
  const flushCurrent = useCallback(async () => {
    if (!user || !hydratedRef.current) return
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    const payload = {
      projects: app.projects,
      sheets: app.sheets,
      customCats: app.customCats,
      company: app.company,
      proposalTemplates: app.proposalTemplates,
      mtoTemplates: app.mtoTemplates,
      clients: app.clients,
      pdfAssets: app.pdfAssets,
    }
    if (orgIdRef.current) {
      await saveOrgSnapshot(orgIdRef.current, payload).catch(() => {})
    } else {
      await saveUserSnapshot(user.id, payload).catch(() => {})
    }
  }, [user, app.projects, app.sheets, app.customCats, app.company, app.proposalTemplates, app.mtoTemplates, app.clients, app.pdfAssets])

  // Point the active workspace at `targetOrgId` (or personal, if null) and
  // hydrate from it. `membershipsList` lets callers pass a just-refreshed
  // list so role/name are correct immediately (state updates are async).
  const applyWorkspace = useCallback(async (targetOrgId, membershipsList) => {
    const membership = targetOrgId
      ? (membershipsList || memberships).find(m => m.org_id === targetOrgId)
      : null
    orgIdRef.current = targetOrgId
    setOrgId(targetOrgId)
    setOrgRole(membership?.role ?? null)
    setOrgName(membership?.name ?? null)
    if (user) setWorkspacePref(user.id, targetOrgId)

    const snap = targetOrgId
      ? await loadOrgSnapshot(targetOrgId)
      : (user ? await loadUserSnapshot(user.id) : null)
    // undefined = the fetch failed (network/RLS) — not "this workspace is
    // empty". Leave whatever's currently on screen alone rather than
    // blanking it out; the membership change (e.g. leaving an org) has
    // already happened by the time this runs, so there's no clean "abort"
    // here, just avoid compounding it with a data wipe.
    if (snap === undefined) {
      setAuthError('Could not load your data for this workspace. Reload to retry.')
      return
    }
    app.hydrate?.(snap || emptySnapshot(), false)
  }, [user, app, memberships])

  // Flush the outgoing workspace's edits and load the incoming workspace's
  // snapshot at the same time. The two calls write/read different DB rows,
  // so serializing them (as flushCurrent(); applyWorkspace() used to) only
  // adds latency — each full snapshot round trip can take a second or more,
  // and doing them back-to-back made every workspace switch feel like it
  // hung. Running them concurrently roughly halves the wait.
  const switchToWorkspace = useCallback(async (targetOrgId, membershipsList) => {
    // Surface loading feedback (pages gate a skeleton on dataLoading) instead
    // of leaving the previous workspace's stale data on screen for the
    // duration of the swap.
    setHydrating(true)
    try {
      const [, snap] = await Promise.all([
        flushCurrent(),
        targetOrgId ? loadOrgSnapshot(targetOrgId) : (user ? loadUserSnapshot(user.id) : Promise.resolve(null)),
      ])
      // undefined = the fetch failed (network/RLS), not "this workspace is
      // empty". Abort the switch rather than hydrating with an empty
      // snapshot, which would blank out real data on screen (and risk the
      // debounced autosave persisting that emptiness back to the cloud).
      if (snap === undefined) {
        throw new Error('Could not load that workspace. Check your connection and try again.')
      }
      const membership = targetOrgId
        ? (membershipsList || memberships).find(m => m.org_id === targetOrgId)
        : null
      orgIdRef.current = targetOrgId
      setOrgId(targetOrgId)
      setOrgRole(membership?.role ?? null)
      setOrgName(membership?.name ?? null)
      if (user) setWorkspacePref(user.id, targetOrgId)
      app.hydrate?.(snap || emptySnapshot(), false)
    } finally {
      setHydrating(false)
    }
  }, [user, app, memberships, flushCurrent])

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

  // ---- On login: resolve memberships, restore last workspace, hydrate ----
  // Deliberately keyed on user?.id, NOT the user object itself: Supabase
  // fires onAuthStateChange (and hands back a new `user` object) on
  // background token refreshes too, not just real sign-in. If this effect
  // re-ran on every one of those, it would re-fetch whatever's currently in
  // the cloud and hard-replace local state (hydrate(..., false)) with it —
  // silently clobbering any local edit made in the few hundred ms before the
  // debounced autosave had a chance to persist it (e.g. a just-added sheet).
  useEffect(() => {
    if (!supabaseEnabled || !supabase) return
    if (!user) {
      hydratedRef.current = false
      orgIdRef.current = null
      setMemberships([])
      setOrgId(null)
      setOrgRole(null)
      setOrgName(null)
      setHydrating(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setOrgLoading(true)
      setHydrating(true)
      const flat = await refreshMemberships(user.id)
      if (cancelled) return
      const pref = getWorkspacePref(user.id)
      const target = pref && flat.some(m => m.org_id === pref) ? pref : null
      const membership = target ? flat.find(m => m.org_id === target) : null
      orgIdRef.current = target
      setOrgId(target)
      setOrgRole(membership?.role ?? null)
      setOrgName(membership?.name ?? null)
      setOrgLoading(false)

      const snap = target
        ? await loadOrgSnapshot(target)
        : await loadUserSnapshot(user.id)
      if (cancelled) return
      // undefined = the fetch itself failed (network/RLS) — treat as
      // "unknown", NOT as "confirmed empty". Never push local state over an
      // unknown cloud state: on a fresh browser/device local is often empty,
      // and doing so would silently blank out real cloud data on a mere
      // network hiccup.
      if (snap === undefined) {
        setAuthError('Could not load your saved data from the cloud. Showing what’s stored on this device — reload to retry.')
        hydratedRef.current = true
        setHydrating(false)
        return
      }
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
      // Local edits but confirmed-empty cloud → push them up so they persist.
      if (!hasCloudData) flushCurrent()
      setHydrating(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // ---- While logged in: debounced cloud save on state change ----
  useEffect(() => {
    if (!supabaseEnabled || !supabase) return
    if (!user || !hydratedRef.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      flushCurrent()
    }, 800)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.projects, app.sheets, app.customCats, app.company, app.proposalTemplates, app.mtoTemplates, app.clients, app.pdfAssets, user])

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

  // Personal profile fields (name, job title) — stored on the Supabase auth
  // user itself (user_metadata), not in the project/org data model, since
  // they describe the PERSON regardless of which workspace they're in.
  const updateProfile = useCallback(async (updates) => {
    if (!supabaseEnabled || !supabase) {
      throw new Error('Cloud not configured')
    }
    const { data, error } = await supabase.auth.updateUser({ data: updates })
    if (error) throw error
    if (data?.user) setUser(data.user)
  }, [])

  const signOut = useCallback(async () => {
    if (supabaseEnabled && supabase) {
      await supabase.auth.signOut().catch(() => {})
    }
    setUser(null)
    orgIdRef.current = null
    setMemberships([])
    setOrgId(null)
    setOrgRole(null)
    setOrgName(null)
    app.reset?.()
    setAuthError(null)
    navigate('/', { replace: true })
  }, [app, navigate])

  // ---- Workspace / organization actions ----

  // Switch between the personal workspace (null) and any org the user is
  // already a member of. Flushes pending edits to the outgoing workspace
  // first so nothing leaks across the boundary.
  const switchWorkspace = useCallback(async (targetOrgId) => {
    if (!supabaseEnabled || !supabase || !user) return
    if (targetOrgId === orgIdRef.current) return
    try {
      await switchToWorkspace(targetOrgId)
      setAuthError(null)
    } catch (err) {
      setAuthError(err.message || 'Could not switch workspace')
    }
  }, [user, switchToWorkspace])

  // Create a team and switch to it immediately, starting from an empty
  // shared snapshot — local personal projects are NOT copied in, so nothing
  // leaks into a brand-new org by accident.
  const createOrganization = useCallback(async (name) => {
    if (!supabaseEnabled || !supabase || !user) throw new Error('Cloud not configured')
    const newOrgId = await createOrganizationApi(name)
    // Flushing/loading the workspace and refreshing the membership list hit
    // independent tables, so run them together instead of one after another.
    const [, flat] = await Promise.all([
      switchToWorkspace(newOrgId),
      refreshMemberships(user.id),
    ])
    const membership = flat.find(m => m.org_id === newOrgId)
    setOrgRole(membership?.role ?? null)
    setOrgName(membership?.name ?? null)
    return newOrgId
  }, [user, switchToWorkspace, refreshMemberships])

  const acceptInvite = useCallback(async (token) => {
    if (!supabaseEnabled || !supabase || !user) throw new Error('Cloud not configured')
    const newOrgId = await acceptInviteApi(token)
    const [, flat] = await Promise.all([
      switchToWorkspace(newOrgId),
      refreshMemberships(user.id),
    ])
    const membership = flat.find(m => m.org_id === newOrgId)
    setOrgRole(membership?.role ?? null)
    setOrgName(membership?.name ?? null)
    return newOrgId
  }, [user, switchToWorkspace, refreshMemberships])

  // Leave the currently-active org and fall back to the personal workspace.
  const leaveOrganization = useCallback(async () => {
    if (!supabaseEnabled || !supabase || !user || !orgIdRef.current) return
    const leftOrgId = orgIdRef.current
    // Save any pending edits to the org before giving up write access to it.
    // This must finish (and the membership removal after it) before we're
    // safe to read the org row again, so these two stay sequential.
    await flushCurrent()
    await leaveOrganizationApi(leftOrgId, user.id)
    setHydrating(true)
    try {
      // Refreshing memberships and loading the personal snapshot are
      // independent of each other, so run them concurrently.
      await Promise.all([
        refreshMemberships(user.id),
        applyWorkspace(null),
      ])
    } finally {
      setHydrating(false)
    }
  }, [user, flushCurrent, refreshMemberships, applyWorkspace])

  const value = {
    ...app,
    user,
    loading,
    hydrating,
    // Single flag pages can gate a skeleton on: true from mount (if a
    // session might exist) until both the session check and, if signed in,
    // the workspace snapshot fetch have finished.
    dataLoading: loading || hydrating,
    authError,
    authOpen,
    openAuth,
    closeAuth,
    signIn,
    signUp,
    signOut,
    updateProfile,
    cloudEnabled: supabaseEnabled,
    // Organization / team / workspace context
    memberships,
    orgId,
    orgRole,
    orgName,
    orgLoading,
    isOrgAdmin: orgRole === 'admin',
    switchWorkspace,
    createOrganization,
    acceptInvite,
    leaveOrganization,
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
