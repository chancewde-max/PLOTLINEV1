// E2E: PDF upload + persistence after reload (consumer-critical).
// Firefox (Playwright). Tests the real SheetUploadWizard.handleImport flow.
const { firefox } = require('playwright')
const path = require('path')
const fs = require('fs')

const BASE = process.env.BASE || 'http://127.0.0.1:5191'
const OUT = 'C:\\Users\\Administrator\\PLOTLINEV1\\e2e'
const PROJECT_ID = 'proj-1'
const FIREFOX_EXE =
  'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\firefox-1532\\firefox\\firefox.exe'

const consoleMsgs = []
const pageErrors = []
const failedRequests = []
const results = {}
const screenshots = []

function log(...a) { console.log(...a) }

async function getSheetIds(page) {
  return await page.evaluate(() => {
    try {
      const d = JSON.parse(localStorage.getItem('plotline-appdata') || '{}')
      return Object.keys(d.sheets || {})
    } catch { return [] }
  })
}
async function lsSheets(page) {
  return await page.evaluate(() => {
    try {
      const d = JSON.parse(localStorage.getItem('plotline-appdata') || '{}')
      return d.sheets || {}
    } catch { return {} }
  })
}

async function main() {
  const browser = await firefox.launch({ headless: true, executablePath: FIREFOX_EXE })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  page.on('console', (msg) => {
    consoleMsgs.push({ type: msg.type(), text: msg.text() })
  })
  page.on('pageerror', (err) => {
    pageErrors.push({ type: 'pageerror', text: String(err.message) })
  })
  page.on('requestfailed', (req) => {
    failedRequests.push({ url: req.url(), err: req.failure()?.errorText || 'unknown' })
  })

  try {
    // ---- Open project ----
    log('\n=== [1] Open project ' + PROJECT_ID + ' ===')
    await page.goto(`${BASE}/app/project/${PROJECT_ID}`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('body', { timeout: 10000 })
    const idsBefore = await getSheetIds(page)
    results.sheetIdsBefore = idsBefore.length
    log(`  sheet IDs before import: ${idsBefore.length} (${idsBefore.join(', ')})`)

    // ---- Open wizard ----
    log('\n=== [2] Open "Add sheet" wizard ===')
    const addBtn = page.getByRole('button', { name: /Add sheet/i }).first()
    if (!(await addBtn.isVisible().catch(() => false))) throw new Error('"Add sheet" button not visible')
    await addBtn.click()
    await page.waitForSelector('text=Drag PDF files here or click to browse', { timeout: 10000 })
    log('  wizard opened')

    // ---- Set file input to the PDF ----
    log('\n=== [3] Set hidden <input type=file> to PDF ===')
    const pdfPath = path.join(OUT, 'test-sample.pdf')
    const fileInput = page.locator('input[type=file]').first()
    await fileInput.setInputFiles(pdfPath)
    log('  setInputFiles done, waiting for processing…')

    // Wait for wizard to advance to step with "Next to titles"
    await page.waitForSelector('button:has-text("Next to titles")', { timeout: 30000 })
    log('  processing complete → sheet rows present')

    // ---- Next to titles ----
    log('\n=== [4] Next to titles → Import ===')
    await page.getByRole('button', { name: /Next to titles/i }).click()
    await page.waitForSelector('button:has-text("Import")', { timeout: 15000 })
    const importBtn = page.getByRole('button', { name: /Import \d+ sheet/i }).first()
    const importLabel = await importBtn.innerText().catch(() => '(n/a)')
    log(`  import button: "${importLabel}"`)
    await importBtn.click()

    // ---- Wait for import to finish (wizard closes, new sheet appears) ----
    await page.waitForSelector('text=Drag PDF files here or click to browse', { state: 'detached', timeout: 20000 })
    await page.waitForTimeout(1500) // allow localStorage debounce (500ms) + render

    const idsAfter = await getSheetIds(page)
    const newIds = idsAfter.filter((id) => !idsBefore.includes(id))
    results.newSheetCount = newIds.length
    results.newSheetIds = newIds
    log(`  sheet IDs after import: ${idsAfter.length}; NEW: ${newIds.join(', ') || '(none)'}`)

    if (newIds.length === 0) throw new Error('No new sheet card appeared after import')
    await page.screenshot({ path: path.join(OUT, 'shot-wizard-imported.png'), fullPage: false })
    screenshots.push('shot-wizard-imported.png')

    // Identify the new sheet + its pdfUrl scheme
    const sheets = await lsSheets(page)
    const newSheet = sheets[newIds[0]]
    results.newSheetPdfUrlScheme = newSheet?.pdfUrl ? newSheet.pdfUrl.slice(0, 30) : '(none)'
    results.newSheetPdfUrlIsData = (newSheet?.pdfUrl || '').startsWith('data:')
    log(`  new sheet pdfUrl scheme: "${results.newSheetPdfUrlScheme}…" isDataUrl=${results.newSheetPdfUrlIsData}`)

    // ---- Open the new sheet ----
    log('\n=== [5] Open new sheet (pre-reload) ===')
    await page.goto(`${BASE}/app/project/${PROJECT_ID}/sheet/${newIds[0]}`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('canvas', { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(2500) // allow pdfjs to parse + render

    const pre = await evaluateSheetState(page)
    results.preReload = pre
    log(`  pre-reload: canvas=${pre.canvasCount} content=${pre.canvasHasContent} staleText=${pre.staleVisible} errorText=${pre.errorVisible}`)
    await page.screenshot({ path: path.join(OUT, 'shot-sheet-pre-reload.png'), fullPage: false })
    screenshots.push('shot-sheet-pre-reload.png')

    // ---- RELOAD ----
    log('\n=== [6] RELOAD page (the key persistence test) ===')
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('canvas', { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(2500)

    const post = await evaluateSheetState(page)
    results.postReload = post
    log(`  post-reload: canvas=${post.canvasCount} content=${post.canvasHasContent} staleText=${post.staleVisible} errorText=${post.errorVisible}`)
    await page.screenshot({ path: path.join(OUT, 'shot-sheet-after-reload.png'), fullPage: false })
    screenshots.push('shot-sheet-after-reload.png')

    // ---- Verdict ----
    results.uploadWorked = results.newSheetCount > 0 && results.newSheetPdfUrlIsData
    // The consumer-critical check: after reload the sheet must still show the PDF
    // (a rendered <canvas>, and NOT the "PDF unavailable after reload" / stale message).
    results.pdfPersisted =
      post.canvasCount > 0 && !post.staleVisible

  } catch (err) {
    results.fatal = err.message
    log(`\n!!! FATAL during test: ${err.message}`)
    try { await page.screenshot({ path: path.join(OUT, 'shot-fatal.png'), fullPage: false }) } catch {}
    screenshots.push('shot-fatal.png')
  } finally {
    await browser.close()
  }

  printReport()
}

async function evaluateSheetState(page) {
  return await page.evaluate(() => {
    const c = document.querySelectorAll('canvas')
    let canvasHasContent = false
    let canvasCount = c.length
    for (const cv of c) {
      if (cv.width > 0 && cv.height > 0) {
        try {
          const ctx = cv.getContext('2d')
          const data = ctx.getImageData(0, 0, Math.min(cv.width, 50), Math.min(cv.height, 50)).data
          for (let i = 3; i < data.length; i += 4) { if (data[i] !== 0) { canvasHasContent = true; break } }
        } catch { /* tainted canvas (data URL image) is fine for size check */ }
      }
    }
    const bodyText = document.body.innerText || ''
    const staleVisible = bodyText.includes('PDF unavailable after reload')
    const errorVisible = bodyText.includes('PDF error')
    return {
      canvasCount,
      canvasHasContent,
      staleVisible,
      errorVisible,
      bodyHasPdfUnavailable: staleVisible,
    }
  })
}

function pass(v) { return v ? 'PASS' : 'FAIL' }

function printReport() {
  log('\n==================================================')
  log('     PLOTLINE PDF-PERSISTENCE E2E REPORT')
  log('==================================================')
  const cErr = consoleMsgs.filter((m) => m.type === 'error')
  const cWarn = consoleMsgs.filter((m) => m.type === 'warning')
  log(`Console messages : ${consoleMsgs.length} (error=${cErr.length}, warning=${cWarn.length})`)
  log(`Page errors      : ${pageErrors.length}`)
  log(`Failed requests  : ${failedRequests.length}`)

  log('\n--- details ---')
  log(`  sheets before import     : ${results.sheetIdsBefore}`)
  log(`  new sheet count          : ${results.newSheetCount}`)
  log(`  new sheet ids            : ${(results.newSheetIds || []).join(', ') || '(none)'}`)
  log(`  new pdfUrl is data: URL  : ${results.newSheetPdfUrlIsData}`)
  log(`  new pdfUrl scheme        : ${results.newSheetPdfUrlScheme}`)
  log(`  PRE-reload  : canvas=${results.preReload?.canvasCount} content=${results.preReload?.canvasHasContent} stale=${results.preReload?.staleVisible} error=${results.preReload?.errorVisible}`)
  log(`  POST-reload : canvas=${results.postReload?.canvasCount} content=${results.postReload?.canvasHasContent} stale=${results.postReload?.staleVisible} error=${results.postReload?.errorVisible}`)

  if (cErr.length) {
    log('\n--- console.error (verbatim) ---')
    cErr.forEach((m, i) => log(`  ${i + 1}. ${m.text}`))
  }
  if (pageErrors.length) {
    log('\n--- pageerror (verbatim) ---')
    pageErrors.forEach((m, i) => log(`  ${i + 1}. ${m.text}`))
  }
  if (failedRequests.length) {
    log('\n--- failed requests ---')
    failedRequests.forEach((r, i) => log(`  ${i + 1}. ${r.url} :: ${r.err}`))
  }
  if (cWarn.length) {
    log('\n--- console.warning (verbatim) ---')
    cWarn.forEach((m, i) => log(`  ${i + 1}. ${m.text}`))
  }

  log('\n--- verdict ---')
  log(`  Upload worked (new data: sheet) : ${pass(results.uploadWorked)}`)
  log(`  PDF persisted after reload      : ${pass(results.pdfPersisted)}  <-- CONSUMER-CRITICAL`)
  log(`  No console errors               : ${pass(cErr.length === 0)}`)
  log(`  No page errors                  : ${pass(pageErrors.length === 0)}`)
  if (results.fatal) log(`  fatal: ${results.fatal}`)
  log(`\n  Screenshots: ${screenshots.join(', ')}`)

  const overall = results.uploadWorked && results.pdfPersisted && pageErrors.length === 0
  log(`\n  === PERSISTENCE OVERALL: ${overall ? 'PASS' : 'FAIL'} ===`)
  process.exit(overall ? 0 : 1)
}

main().catch((e) => { console.error('Runner crashed:', e); process.exit(2) })
