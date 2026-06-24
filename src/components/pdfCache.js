// In-memory cache for PDF bytes — survives React renders but not page reload.
// Sheets with pdfUrl starting with "plotline-pdf:" reference this cache.
// On reload PdfCanvas shows the "Re-upload PDF" prompt (stale handling).
export const pdfCache = new Map() // fileId → Uint8Array
