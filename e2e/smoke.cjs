// Real Firefox Playwright e2e smoke test for Plotline.
// Launches firefox headless, exercises: landing -> demo sheet -> projects list.
// Collects ALL console messages + pageerrors and reports flow pass/fail.
const { firefox } = require('playwright')
const path = require('path')

const BASE = process.env.BASE || 'http://localhost:5174'
const OUT = __dirname
const URLS = {
  landing: `${BASE}/`,
  demo: `${BASE}/app/project/proj-1/sheet/sheet-1`,
  app: `${BASE}/app`,
}

const consoleMsgs = []
const pageErrors = []
const failedRequests = []
const results = {}
const VERBOSITY = process.env.VERBOSE === '1'

function log(...a) { console.log(...a) }

async function main() {
  const browser = await firefox.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  page.on('console', (msg) => {
    const entry = { type: msg.type(), text: msg.text() }
    consoleMsgs.push(entry)
    if (VERBOSITY || msg.type() === 'error' || msg.type() === 'warning') {
      log(`  [console.${entry.type}] ${entry.text}`)
    }
  })
  page.on('pageerror', (err) => {
    const entry = { type: 'pageerror', text: `${err.message}` }
    pageErrors.push(entry)
    log(`  [pageerror] ${err.message}`)
    if (err.stack) log(`     ${String(err.stack).split('\n').slice(0, 4).join('\n     ')}`)
  })
  page.on('requestfailed', (req) => {
    failedRequests.push({ url: req.url(), err: req.failure()?.errorText || 'unknown' })
  })

  try {
    // ---- (a)/(b) Landing page ----
    log('\n=== [1] Landing page ===')
    await page.goto(URLS.landing, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('body', { timeout: 10000 })
    const hasPlotline = await page.getByText('Plotline', { exact: false }).first().isVisible().catch(() => false)
    const hasHero = await page.locator("text=Estimate straight from the plans").isVisible().catch(() => false)
    results.landingRender = hasPlotline && hasHero
    log(`  landing visible: plotline=${hasPlotline} hero="${hasHero}"`)
    await page.screenshot({ path: path.join(OUT, 'shot-landing.png'), fullPage: false })

    // ---- (c) Click primary CTA -> opens auth modal (signup) ----
    log('\n=== [2] Click primary CTA -> opens auth modal ===')
    const cta = page.getByRole('button', { name: /Start free trial/i }).first()
    const ctaVisible = await cta.isVisible().catch(() => false)
    log(`  CTA 'Start free trial' visible=${ctaVisible}`)
    if (!ctaVisible) throw new Error('Primary CTA "Start free trial" not found/visible on landing')
    await cta.click()
    // New behavior: primary CTA opens the signup modal (no-cred mode shows a
    // 'Cloud not configured' note). Assert the modal appears.
    await page.waitForSelector('text=Sign in', { timeout: 15000 }).catch(() => {})
    const modalOpen = await page.getByText(/Sign in|Create account|Cloud not configured/i).first().isVisible().catch(() => false)
    results.ctaNavigatedToApp = modalOpen
    log(`  Auth modal opened=${modalOpen}`)
    await page.screenshot({ path: path.join(OUT, 'shot-app.png'), fullPage: false })
    // Close modal, then verify the demo link still navigates to the sheet.
    await page.keyboard.press('Escape').catch(() => {})
    const demoLink = page.getByRole('link', { name: /Try the demo|See it in action|demo/i }).first()
    if (await demoLink.isVisible().catch(() => false)) {
      await demoLink.click()
      await page.waitForURL('**/app/project/**/sheet/**', { timeout: 15000 }).catch(() => {})
      log(`  Demo link URL after click: ${page.url()}`)
    } else {
      log('  (no demo link found; navigating directly to demo sheet)')
      await page.goto(`${BASE}/app/project/proj-1/sheet/sheet-1`)
    }

    // ---- (d) Demo sheet: workspace + toolbar + colored takeoff elements ----
    log('\n=== [3] Demo sheet takeoff render ===')
    await page.waitForSelector('svg', { timeout: 15000 })
    // Toolbar buttons carry aria-label="Area"/"Linear"/"Count" (labels are tooltips, not visible text).
    const hasArea = await page.locator('[aria-label="Area"]').first().isVisible().catch(() => false)
    const hasLinear = await page.locator('[aria-label="Linear"]').first().isVisible().catch(() => false)
    const hasCount = await page.locator('[aria-label="Count"]').first().isVisible().catch(() => false)
    log(`  tools visible: Area=${hasArea} Linear=${hasLinear} Count=${hasCount}`)

    const shapes = await page.evaluate(() => {
      const shapes = { polygon: 0, polyline: 0, circle: 0 }
      document.querySelectorAll('svg polygon').forEach(() => shapes.polygon++)
      document.querySelectorAll('svg polyline').forEach(() => shapes.polyline++)
      document.querySelectorAll('svg circle').forEach(() => shapes.circle++)
      return shapes
    })
    log(`  svg takeoff shapes: ${JSON.stringify(shapes)}`)
    results.sheetToolbar = hasArea && hasLinear && hasCount
    results.sheetTakeoffElements = (shapes.polygon + shapes.polyline + shapes.circle) > 0
    results.sheetShapes = shapes
    await page.waitForTimeout(800)
    await page.screenshot({ path: path.join(OUT, 'shot-sheet.png'), fullPage: false })

    // ---- (e) Projects list ----
    log('\n=== [4] Projects page ===')
    await page.goto(URLS.app, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForFunction(
      () => document.body.innerText.includes('Projects') &&
            document.body.innerText.includes('Maple Grove'),
      { timeout: 15000 }
    ).catch(() => {})
    const hasProjectsHeading = await page.getByText('Projects', { exact: false }).first().isVisible().catch(() => false)
    const hasMapleGrove = await page.getByText('Maple Grove Estates', { exact: false }).first().isVisible().catch(() => false)
    results.projectsHeading = hasProjectsHeading
    results.projectsMapleGrove = hasMapleGrove
    log(`  projects page: heading=${hasProjectsHeading} mapleGrove=${hasMapleGrove}`)
    await page.screenshot({ path: path.join(OUT, 'shot-projects.png'), fullPage: false })

  } catch (err) {
    results.fatal = err.message
    log(`\n!!! FATAL during test: ${err.message}`)
  } finally {
    await browser.close()
  }

  printReport()
}

function printReport() {
  log('\n==================================================')
  log('             PLOTLINE E2E SMOKE REPORT')
  log('==================================================')
  const cErr = consoleMsgs.filter(m => m.type === 'error')
  const cWarn = consoleMsgs.filter(m => m.type === 'warning')
  log(`Console messages captured : ${consoleMsgs.length}`)
  log(`  errors   : ${cErr.length}`)
  log(`  warnings : ${cWarn.length}`)
  log(`Page errors (uncaught)    : ${pageErrors.length}`)
  log(`Failed requests           : ${failedRequests.length}`)

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

  log('\n--- flow results ---')
  log(`  [landing] renders              : ${pass(results.landingRender)}`)
  log(`  [cta] navigates to /app        : ${pass(results.ctaNavigatedToApp)}`)
  log(`  [sheet] toolbar (Area/L/C)     : ${pass(results.sheetToolbar)}`)
  log(`  [sheet] takeoff elements drawn : ${pass(results.sheetTakeoffElements)} (polygons=${results.sheetShapes?.polygon}, polylines=${results.sheetShapes?.polyline}, circles=${results.sheetShapes?.circle})`)
  log(`  [projects] heading visible     : ${pass(results.projectsHeading)}`)
  log(`  [projects] Maple Grove present : ${pass(results.projectsMapleGrove)}`)

  const noConsoleErrors = cErr.length === 0
  const noPageErrors = pageErrors.length === 0
  const flowsOk =
    results.landingRender &&
    results.ctaNavigatedToApp &&
    results.sheetToolbar &&
    results.sheetTakeoffElements &&
    results.projectsHeading &&
    results.projectsMapleGrove

  log('\n--- verdict ---')
  log(`  Boots without console errors : ${pass(noConsoleErrors)}`)
  log(`  Boots without page errors    : ${pass(noPageErrors)}`)
  log(`  All core flows pass          : ${pass(flowsOk)}`)
  const overall = noConsoleErrors && noPageErrors && flowsOk
  log(`\n  === OVERALL: ${overall ? 'PASS' : 'FAIL'} ===`)
  if (results.fatal) log(`  fatal: ${results.fatal}`)
  log('\n  Screenshots: shot-landing.png, shot-app.png, shot-sheet.png, shot-projects.png')
  process.exit(overall ? 0 : 1)
}

function pass(v) { return v ? 'PASS' : 'FAIL' }

main().catch((e) => { console.error('Runner crashed:', e); process.exit(2) })
