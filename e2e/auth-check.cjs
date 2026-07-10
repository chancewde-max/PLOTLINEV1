// Auth-modal e2e check (conversion-critical).
// Firefox (Playwright). Verifies a visitor can open the signup/auth modal
// from BOTH the landing page primary CTA and a Pricing page tier CTA,
// in the NO-CRED (localStorage-only) path. Asserts the AuthModal appears
// and that the app emits zero console/page errors during the flow.
const { firefox } = require('playwright')

const BASE = process.env.BASE || 'http://127.0.0.1:5215'
const OUT = __dirname

const consoleMsgs = []
const pageErrors = []
const failedRequests = []
const results = {}
const screenshots = []

function log(...a) { console.log(...a) }

async function runFor(page, label, origin, openModal, modalAssert) {
  log(`\n=== [${label}] goto ${origin} ===`)
  await page.goto(origin, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('body', { timeout: 10000 })
  await openModal()
  // Modal should appear within a few seconds.
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 })
  const ok = await modalAssert()
  results[label] = ok
  log(`  auth modal opened: ${ok ? 'PASS' : 'FAIL'}`)
  try { await page.screenshot({ path: `${OUT}/shot-auth-${label}.png` }) } catch {}
  screenshots.push(`shot-auth-${label}.png`)
  // close it again so next run starts clean (Escape)
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(400)
}

async function main() {
  const browser = await firefox.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  page.on('console', (msg) => consoleMsgs.push({ type: msg.type(), text: msg.text() }))
  page.on('pageerror', (err) => pageErrors.push({ type: 'pageerror', text: String(err.message) }))
  page.on('requestfailed', (req) => failedRequests.push({ url: req.url(), err: req.failure()?.errorText || 'unknown' }))

  try {
    // ---- Landing page: primary "Start free trial" CTA ----
    await runFor(page, 'landing', `${BASE}/`, async () => {
      const cta = page.getByRole('button', { name: /Start free trial/i }).first()
      if (!(await cta.isVisible().catch(() => false))) throw new Error('Landing "Start free trial" CTA not visible')
      await cta.click()
    }, async () => {
      const dialog = page.locator('[role="dialog"]')
      const txt = (await dialog.innerText().catch(() => '')).toLowerCase()
      const hasSignIn = txt.includes('sign in') || txt.includes('create your plotline account')
      const hasCloudNote = txt.includes('cloud sync') || txt.includes('cloud not configured') || txt.includes('configured in this build')
      const hasEmail = await dialog.locator('input[type="email"]').count()
      const hasPwd = await dialog.locator('input[type="password"]').count()
      log(`    dialog text fragment hasSignIn=${hasSignIn} hasCloudNote=${hasCloudNote} emailInputs=${hasEmail} pwdInputs=${hasPwd}`)
      return (hasSignIn || hasCloudNote) && (hasEmail > 0 || hasPwd > 0)
    })

    // ---- Pricing page: a tier "Get started"/"Start free" CTA ----
    await runFor(page, 'pricing', `${BASE}/pricing`, async () => {
      // Try the most specific tier CTA first, fall back to "Start free trial"/"Start free".
      const selectors = [
        page.getByRole('button', { name: /Start free trial/i }).first(),
        page.getByRole('button', { name: /Start free/i }).first(),
        page.getByRole('button', { name: /Get started/i }).first(),
      ]
      let clicked = false
      for (const sel of selectors) {
        if (await sel.isVisible().catch(() => false)) { await sel.click(); clicked = true; break }
      }
      if (!clicked) throw new Error('No pricing tier CTA visible (Start free / Start free trial / Get started)')
    }, async () => {
      const dialog = page.locator('[role="dialog"]')
      const txt = (await dialog.innerText().catch(() => '')).toLowerCase()
      const hasSignIn = txt.includes('sign in') || txt.includes('create your plotline account')
      const hasCloudNote = txt.includes('cloud sync') || txt.includes('cloud not configured') || txt.includes('configured in this build')
      const hasEmail = await dialog.locator('input[type="email"]').count()
      const hasPwd = await dialog.locator('input[type="password"]').count()
      log(`    dialog text fragment hasSignIn=${hasSignIn} hasCloudNote=${hasCloudNote} emailInputs=${hasEmail} pwdInputs=${hasPwd}`)
      return (hasSignIn || hasCloudNote) && (hasEmail > 0 || hasPwd > 0)
    })

  } catch (err) {
    results.fatal = err.message
    log(`\n!!! FATAL during test: ${err.message}`)
    try { await page.screenshot({ path: `${OUT}/shot-auth-fatal.png` }) } catch {}
    screenshots.push('shot-auth-fatal.png')
  } finally {
    await browser.close()
  }
  printReport()
}

function pass(v) { return v ? 'PASS' : 'FAIL' }

function printReport() {
  log('\n==================================================')
  log('        PLOTLINE AUTH-MODAL E2E REPORT')
  log('==================================================')
  const cErr = consoleMsgs.filter(m => m.type === 'error')
  const cWarn = consoleMsgs.filter(m => m.type === 'warning')
  log(`Console messages : ${consoleMsgs.length} (error=${cErr.length}, warning=${cWarn.length})`)
  log(`Page errors      : ${pageErrors.length}`)
  log(`Failed requests  : ${failedRequests.length}`)

  log('\n--- flow results ---')
  log(`  [landing] primary CTA opens AuthModal : ${pass(results.landing)}`)
  log(`  [pricing] tier CTA opens AuthModal    : ${pass(results.pricing)}`)
  log(`  No console errors                     : ${pass(cErr.length === 0)}`)
  log(`  No page errors                        : ${pass(pageErrors.length === 0)}`)

  if (cErr.length) { log('\n--- console.error (verbatim) ---'); cErr.forEach((m, i) => log(`  ${i + 1}. ${m.text}`)) }
  if (pageErrors.length) { log('\n--- pageerror (verbatim) ---'); pageErrors.forEach((m, i) => log(`  ${i + 1}. ${m.text}`)) }
  if (failedRequests.length) { log('\n--- failed requests ---'); failedRequests.forEach((r, i) => log(`  ${i + 1}. ${r.url} :: ${r.err}`)) }

  const overall = results.landing && results.pricing && cErr.length === 0 && pageErrors.length === 0
  log(`\n  === AUTH-MODAL OVERALL: ${overall ? 'PASS' : 'FAIL'} ===`)
  if (results.fatal) log(`  fatal: ${results.fatal}`)
  log(`\n  Screenshots: ${screenshots.join(', ')}`)
  process.exit(overall ? 0 : 1)
}

main().catch((e) => { console.error('Runner crashed:', e); process.exit(2) })
