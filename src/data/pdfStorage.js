// PDF binary storage — Supabase Storage instead of embedding PDFs as base64
// text inside the app_data/org_data JSONB blob. See schema_add_storage.sql
// for why: one team's org_data row grew to ~49MB of embedded PDF text and
// started timing out on every save, blocking that whole team's cloud sync.
//
// Stored objects are referenced from pdfAssets[fileId] / sheet.pdfUrl as a
// `storage:<path>` string — the same prefix-tagged-string convention the
// codebase already uses for the `plotline-pdf:` scheme (see pdfCache.js) —
// so resolveSheetPdfUrl/sheetHasPdf need no changes at all; PdfCanvas.jsx and
// pdfDiff.js exchange the path for a fresh signed URL right before fetching,
// since the bucket is private (these are customers' site plans, not safe to
// expose via a guessable public URL).

import { supabase, supabaseEnabled } from '../lib/supabaseClient.js'

const BUCKET = 'sheet-pdfs'
export const STORAGE_PREFIX = 'storage:'

export const isStorageRef = (url) => typeof url === 'string' && url.startsWith(STORAGE_PREFIX)

export const personalPdfPath = (userId, fileId) => `personal/${userId}/${fileId}.pdf`
export const orgPdfPath = (orgId, fileId) => `org/${orgId}/${fileId}.pdf`

// Upload PDF bytes (Uint8Array/File/Blob) to Storage and return the
// `storage:<path>` reference string to store in pdfAssets/sheet.pdfUrl.
// Throws on failure — callers decide whether to fall back to embedding.
export async function uploadPdfAsset(bytes, path) {
  if (!supabaseEnabled || !supabase) throw new Error('Cloud not configured')
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'application/pdf', upsert: true })
  if (error) throw error
  return STORAGE_PREFIX + path
}

// Exchange a `storage:<path>` reference for a short-lived fetchable URL.
// Returns null on failure (caller treats the sheet as unavailable, same as
// a stale plotline-pdf: reference after a reload).
export async function resolveStoragePdfUrl(ref) {
  if (!supabaseEnabled || !supabase) return null
  const path = ref.slice(STORAGE_PREFIX.length)
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// Self-heal: scan a freshly-hydrated snapshot for PDFs still embedded as
// base64 data: URLs (legacy, from before Storage existed) and move them to
// Storage in the background. Sequential (not parallel) so an account with
// many legacy PDFs doesn't burst-upload all at once. Best-effort — a failed
// upload just leaves that PDF embedded (today's working behavior) and gets
// retried on the next sign-in, consistent with how the rest of the
// cloud-sync layer treats failures as soft/recoverable, not fatal.
export async function migrateLegacyPdfsToStorage({ sheets, pdfAssets }, pathPrefix, { updateSheet, addPdfAssets }) {
  if (!supabaseEnabled || !supabase) return

  const assetUpdates = {}
  for (const [fileId, value] of Object.entries(pdfAssets || {})) {
    if (typeof value !== 'string' || !value.startsWith('data:application/pdf')) continue
    try {
      assetUpdates[fileId] = await uploadPdfAsset(dataUrlToBytes(value), `${pathPrefix}/${fileId}.pdf`)
    } catch { /* leave embedded, retry next sign-in */ }
  }
  if (Object.keys(assetUpdates).length) addPdfAssets(assetUpdates)

  for (const sheet of Object.values(sheets || {})) {
    if (typeof sheet.pdfUrl !== 'string' || !sheet.pdfUrl.startsWith('data:application/pdf')) continue
    try {
      const ref = await uploadPdfAsset(dataUrlToBytes(sheet.pdfUrl), `${pathPrefix}/sheet-${sheet.id}.pdf`)
      updateSheet(sheet.id, { pdfUrl: ref })
    } catch { /* leave embedded, retry next sign-in */ }
  }
}
