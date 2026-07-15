// In-memory cache for PDF bytes — survives React renders but not page reload.
// Sheets with pdfUrl starting with "plotline-pdf:" reference this cache.
// On reload PdfCanvas shows the "Re-upload PDF" prompt (stale handling).
export const pdfCache = new Map() // fileId → Uint8Array

// Sheets split from a multi-page PDF carry `pdfAssetId`, pointing at a
// SHARED entry in the app's `pdfAssets` map (one copy of the source file's
// bytes, regardless of how many sheets it was split into) instead of each
// sheet embedding its own duplicate copy in `pdfUrl`. Legacy sheets (and the
// single-file "Add sheet" / re-upload paths, which are always 1:1 anyway)
// still carry `pdfUrl` directly and resolve unchanged.
export function resolveSheetPdfUrl(sheet, pdfAssets) {
  if (!sheet) return null
  if (sheet.pdfAssetId) return pdfAssets?.[sheet.pdfAssetId] || null
  return sheet.pdfUrl || null
}

export function sheetHasPdf(sheet) {
  return !!(sheet?.pdfAssetId || sheet?.pdfUrl)
}
