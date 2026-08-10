// Page-overlay diff — renders two sheets' PDF pages into a shared coordinate
// space and highlights the difference (PlanSwift-style: additions in red,
// deletions in blue) instead of just alpha-blending one page over the other.
import * as pdfjsLib from 'pdfjs-dist'
import { pdfCache } from './pdfCache.js'

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// Render one PDF page into a canvas of EXACTLY targetW x targetH, the page
// fit inside it (aspect preserved, white-padded, anchored top-left) — the
// same "contain" placement PdfCanvas uses for the live sheet view, so pixel
// (x, y) here means the same plan-space point in both the base and overlay
// renders.
async function renderPdfPageToCanvas(url, pageNumber, targetW, targetH) {
  if (!url) return null
  let resolvedBytes = null
  let resolvedPage = pageNumber || 1
  if (url.startsWith('plotline-pdf:')) {
    const [, fileId, pageStr] = url.split(':')
    const bytes = pdfCache.get(fileId)
    if (!bytes) return null
    resolvedBytes = bytes.slice(0)
    resolvedPage = parseInt(pageStr) || 1
  } else if (url.startsWith('blob:')) {
    return null // stale after reload, same as PdfCanvas's handling
  }
  const src = resolvedBytes ? { data: resolvedBytes } : url.startsWith('data:') ? { data: dataUrlToUint8Array(url) } : url
  const pdf = await pdfjsLib.getDocument(src).promise
  const page = await pdf.getPage(resolvedPage)
  const vp0 = page.getViewport({ scale: 1 })
  const scale = Math.min(targetW / vp0.width, targetH / vp0.height)
  const vp = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, targetW, targetH)
  await page.render({ canvasContext: ctx, viewport: vp }).promise
  return canvas
}

// Bounded so a huge multi-page-set diff never renders an unreasonably large
// pair of canvases — plenty of resolution to catch real revision changes.
const DIFF_W = 1400

// A pixel counts as "ink" (part of the drawing, not blank paper) once it's
// noticeably darker than white — catches line work and fills without
// flagging JPEG/PDF-render antialiasing noise on an otherwise blank sheet.
const INK_LUMA_THRESHOLD = 235

function luma(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b }

// Renders `baseSheet` and `overlaySheet`'s pages, applies the same
// translate/scale the live overlay uses to align the overlay page onto the
// base, then returns a canvas the same size as the sheet box where every
// pixel is either transparent (unchanged) or a red/blue highlight —
// additions (ink on the overlay page with nothing underneath) in red,
// deletions (ink on the base page missing from the overlay) in blue.
export async function computeOverlayDiff({ baseUrl, basePage, overlayUrl, overlayPage, offset, scale, sheetW, sheetH }) {
  const diffH = Math.round(DIFF_W * (sheetH / sheetW))
  const [baseCanvas, overlayCanvasRaw] = await Promise.all([
    renderPdfPageToCanvas(baseUrl, basePage, DIFF_W, diffH),
    renderPdfPageToCanvas(overlayUrl, overlayPage, DIFF_W, diffH),
  ])
  if (!baseCanvas || !overlayCanvasRaw) return null

  // Composite the overlay page onto a same-size canvas using the SAME
  // transform the live raster overlay applies (translate/scale in
  // plan-space units, scaled here to this canvas's own pixel basis) so the
  // two renders line up exactly where the user dragged them into alignment.
  const aligned = document.createElement('canvas')
  aligned.width = DIFF_W; aligned.height = diffH
  const actx = aligned.getContext('2d')
  actx.setTransform(scale, 0, 0, scale, offset.x * (DIFF_W / sheetW), offset.y * (diffH / sheetH))
  actx.drawImage(overlayCanvasRaw, 0, 0)
  actx.setTransform(1, 0, 0, 1, 0, 0)

  const baseData = baseCanvas.getContext('2d').getImageData(0, 0, DIFF_W, diffH)
  const overlayData = aligned.getContext('2d').getImageData(0, 0, DIFF_W, diffH)
  const out = document.createElement('canvas')
  out.width = DIFF_W; out.height = diffH
  const outCtx = out.getContext('2d')
  const outData = outCtx.createImageData(DIFF_W, diffH)

  const bd = baseData.data, od = overlayData.data, xd = outData.data
  for (let i = 0; i < bd.length; i += 4) {
    // Outside the overlay canvas's actual (transformed) bounds, alpha is 0 —
    // treated as "no ink" there rather than a false deletion.
    const hasInkBase = luma(bd[i], bd[i + 1], bd[i + 2]) < INK_LUMA_THRESHOLD
    const hasInkOverlay = od[i + 3] > 10 && luma(od[i], od[i + 1], od[i + 2]) < INK_LUMA_THRESHOLD
    if (hasInkOverlay && !hasInkBase) {
      // Addition — new ink introduced by the overlay sheet.
      xd[i] = 220; xd[i + 1] = 38; xd[i + 2] = 38; xd[i + 3] = 200
    } else if (hasInkBase && !hasInkOverlay) {
      // Deletion — ink on the base sheet with nothing there in the overlay.
      xd[i] = 37; xd[i + 1] = 99; xd[i + 2] = 235; xd[i + 3] = 200
    } else {
      xd[i + 3] = 0
    }
  }
  outCtx.putImageData(outData, 0, 0)
  return out
}
