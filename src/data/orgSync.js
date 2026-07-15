// Organization ("team") data-access layer for Plotline.
//
// Mirrors the shape/guard style of cloudSync.js: every function is gated on
// `supabaseEnabled` and fails soft (returns null/[]/false) rather than
// throwing, except where the caller needs to know a mutation failed. See
// supabase/schema_teams.sql for the tables and RLS these calls depend on.

import { supabase, supabaseEnabled } from '../lib/supabaseClient.js'
import { emptyOcrMemory } from './ocrLearning.js'

// ---- Membership -----------------------------------------------------------

// The org(s) the current user belongs to, most-recently-joined first. v1
// treats a user as belonging to at most one org, so callers take [0].
export async function listMyOrgMemberships(userId) {
  if (!supabaseEnabled || !supabase) return []
  const { data, error } = await supabase
    .from('org_members')
    .select('org_id, role, joined_at, organizations ( name )')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
  if (error) {
    console.warn('[orgSync] listMyOrgMemberships failed:', error.message)
    return []
  }
  return data ?? []
}

export async function createOrganization(name) {
  if (!supabaseEnabled || !supabase) throw new Error('Cloud not configured')
  const { data, error } = await supabase.rpc('create_organization', { org_name: name })
  if (error) throw error
  return data // new org id
}

export async function listOrgMembers(orgId) {
  if (!supabaseEnabled || !supabase || !orgId) return []
  const { data, error } = await supabase
    .from('org_members')
    .select('user_id, role, email, full_name, joined_at')
    .eq('org_id', orgId)
    .order('joined_at', { ascending: true })
  if (error) {
    console.warn('[orgSync] listOrgMembers failed:', error.message)
    return []
  }
  return data ?? []
}

export async function changeMemberRole(orgId, userId, role) {
  if (!supabaseEnabled || !supabase) throw new Error('Cloud not configured')
  const { error } = await supabase
    .from('org_members')
    .update({ role })
    .match({ org_id: orgId, user_id: userId })
  if (error) throw error
}

export async function removeMember(orgId, userId) {
  if (!supabaseEnabled || !supabase) throw new Error('Cloud not configured')
  const { error } = await supabase
    .from('org_members')
    .delete()
    .match({ org_id: orgId, user_id: userId })
  if (error) throw error
}

export async function leaveOrganization(orgId, userId) {
  return removeMember(orgId, userId)
}

// ---- Invites ----------------------------------------------------------

export async function listOrgInvites(orgId) {
  if (!supabaseEnabled || !supabase || !orgId) return []
  const { data, error } = await supabase
    .from('org_invites')
    .select('id, email, role, status, token, created_at, expires_at')
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('[orgSync] listOrgInvites failed:', error.message)
    return []
  }
  return data ?? []
}

export async function inviteMember(orgId, email, role, invitedBy) {
  if (!supabaseEnabled || !supabase) throw new Error('Cloud not configured')
  const { data, error } = await supabase
    .from('org_invites')
    .insert({
      org_id: orgId,
      email: email.trim().toLowerCase(),
      role,
      invited_by: invitedBy,
    })
    .select('id, email, role, status, token, created_at, expires_at')
    .single()
  if (error) throw error
  return data
}

export async function revokeInvite(inviteId) {
  if (!supabaseEnabled || !supabase) throw new Error('Cloud not configured')
  const { error } = await supabase
    .from('org_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
  if (error) throw error
}

export async function getInvitePreview(token) {
  if (!supabaseEnabled || !supabase) return null
  const { data, error } = await supabase.rpc('get_invite_preview', { invite_token: token })
  if (error) {
    console.warn('[orgSync] getInvitePreview failed:', error.message)
    return null
  }
  return data?.[0] ?? null
}

export async function acceptInvite(token) {
  if (!supabaseEnabled || !supabase) throw new Error('Cloud not configured')
  const { data, error } = await supabase.rpc('accept_org_invite', { invite_token: token })
  if (error) throw error
  return data // org id
}

export function inviteLink(token) {
  return `${window.location.origin}/invite/${token}`
}

// ---- Shared org project/sheet storage (parallels cloudSync.js) -----------

export async function loadOrgSnapshot(orgId) {
  if (!supabaseEnabled || !supabase || !orgId) return null
  const { data, error } = await supabase
    .from('org_data')
    .select('projects, sheets, custom_cats, company, proposal_templates, mto_templates, clients, pdf_assets, ocr_memory')
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    console.warn('[orgSync] loadOrgSnapshot failed:', error.message)
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
    pdfAssets: data.pdf_assets ?? {},
    ocrMemory: data.ocr_memory ?? emptyOcrMemory(),
  }
}

export async function saveOrgSnapshot(orgId, snapshot) {
  if (!supabaseEnabled || !supabase) {
    throw new Error('Cloud not configured')
  }
  const { error } = await supabase
    .from('org_data')
    .upsert(
      {
        org_id: orgId,
        projects: snapshot.projects ?? {},
        sheets: snapshot.sheets ?? {},
        custom_cats: snapshot.customCats ?? [],
        company: snapshot.company ?? null,
        proposal_templates: snapshot.proposalTemplates ?? {},
        mto_templates: snapshot.mtoTemplates ?? {},
        clients: snapshot.clients ?? {},
        pdf_assets: snapshot.pdfAssets ?? {},
        ocr_memory: snapshot.ocrMemory ?? emptyOcrMemory(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' }
    )

  if (error) {
    console.warn('[orgSync] saveOrgSnapshot failed:', error.message)
    return false
  }
  return true
}
