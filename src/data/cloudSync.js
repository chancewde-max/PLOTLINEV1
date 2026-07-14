// Cloud persistence layer for Plotline.
//
// Each user owns exactly one row in `app_data`, keyed by the Supabase auth
// user id. The row stores the client-side collections as JSONB:
//   - projects           (object keyed by project id)
//   - sheets             (object keyed by sheet id)
//   - customCats         (array)
//   - company            (object: name/address/phone/email/logoDataUrl)
//   - proposalTemplates  (object keyed by template id)
//   - mtoTemplates       (object keyed by template id)
//   - clients            (object keyed by client id)
//
// All functions are guarded by `supabaseEnabled`. When cloud is not configured
// they return null (or reject, for the save path) so callers can fall back to
// localStorage without erroring. Nothing here ever throws on a missing key.

import { supabase, supabaseEnabled } from '../lib/supabaseClient.js'

// Default snapshot used when a row does not yet exist.
export function emptySnapshot() {
  return {
    projects: {}, sheets: {}, customCats: [], company: null,
    proposalTemplates: {}, mtoTemplates: {}, clients: {},
  }
}

// Pull a user's full snapshot from the cloud.
// Returns null when cloud is disabled or the row is missing — callers treat
// null as "no cloud data; use local state".
export async function loadUserSnapshot(userId) {
  if (!supabaseEnabled || !supabase) return null
  const { data, error } = await supabase
    .from('app_data')
    .select('projects, sheets, custom_cats, company, proposal_templates, mto_templates, clients')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    // RLS / missing table / network — fail soft, keep local state.
    console.warn('[cloudSync] loadUserSnapshot failed:', error.message)
    return null
  }
  if (!data) return null

  return {
    projects: data.projects ?? {},
    sheets: data.sheets ?? {},
    customCats: data.custom_cats ?? [],
    company: data.company ?? null,
    proposalTemplates: data.proposal_templates ?? {},
    mtoTemplates: data.mto_templates ?? {},
    clients: data.clients ?? {},
  }
}

// Upsert a user's snapshot into the cloud.
// Resolves to true on success, false on failure. Rejects only if cloud is
// disabled, so callers can surface a "Cloud not configured" message.
export async function saveUserSnapshot(userId, snapshot) {
  if (!supabaseEnabled || !supabase) {
    throw new Error('Cloud not configured')
  }
  const { error } = await supabase
    .from('app_data')
    .upsert(
      {
        user_id: userId,
        projects: snapshot.projects ?? {},
        sheets: snapshot.sheets ?? {},
        custom_cats: snapshot.customCats ?? [],
        company: snapshot.company ?? null,
        proposal_templates: snapshot.proposalTemplates ?? {},
        mto_templates: snapshot.mtoTemplates ?? {},
        clients: snapshot.clients ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.warn('[cloudSync] saveUserSnapshot failed:', error.message)
    return false
  }
  return true
}
