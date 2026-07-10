// Verify nav anchors scroll to real sections + social icons are real URLs.
// Playwright Firefox against the Vite dev server.
const { firefox } = require('playwright')
const BASE = process.env.BASE || 'http://127.0.0.1:5225'

const results = []
function record(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`)
}

async function scrollY(page) {
  return page.evaluate(() => Math.round(window.scrollY))
}
async function urlHasHash(page, hash) {
  return page.url().includes(hash)
}
// A section is "visible/resolved" if it exists in the DOM AND either the URL
// carries the hash or the viewport actually scrolled to it (scrollY > 0).
async function sectionResolved(page, id, hashLabel) {
  const exists = await page.locator(`#${id}`).count()
  if (!exists) return { ok: false, reason: `no element with id="${id}"` }
  const urlOk = await urlHasHash(page, hashLabel)
  const sy = await scrollY(page)
  const visible = await page.locator(`#${id}`).first().isVisible().catch(() => false)
  const ok = urlOk || sy > 0 || visible
  return { ok, reason: `exists=${exists > 0} urlHasHash=${urlOk} scrollY=${sy} visible=${visible}` }
}

async function main() {
  const browser = await firefox.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  const consoleErrors = []
  const pageErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message))

  // ---- a) /pricing -> click nav "Customers" ----
  await page.goto(`${BASE}/pricing`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('text=Starter', { timeout: 15000 })
  const pricingCustomers = page.locator('header nav a', { hasText: 'Customers' }).first()
  await pricingCustomers.click()
  await page.waitForTimeout(1200)
  let r = await sectionResolved(page, 'customers', '#customers')
  record('pricing -> Customers resolves to #customers', r.ok, r.reason)
  record('pricing -> Customers URL has #customers', page.url().includes('#customers'), page.url())

  // ---- b) /pricing -> click nav "Docs" ----
  await page.goto(`${BASE}/pricing`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('text=Starter', { timeout: 15000 })
  const pricingDocs = page.locator('header nav a', { hasText: 'Docs' }).first()
  await pricingDocs.click()
  await page.waitForTimeout(1200)
  r = await sectionResolved(page, 'docs', '#docs')
  record('pricing -> Docs resolves to #docs', r.ok, r.reason)
  record('pricing -> Docs URL has #docs', page.url().includes('#docs'), page.url())

  // ---- c) /pricing -> click nav "Product" ----
  await page.goto(`${BASE}/pricing`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('text=Starter', { timeout: 15000 })
  const pricingProduct = page.locator('header nav a', { hasText: 'Product' }).first()
  await pricingProduct.click()
  await page.waitForTimeout(1500)
  const productUrl = page.url()
  const onLanding = productUrl.replace(/\/$/, '') === BASE || productUrl.includes('#product') || productUrl.endsWith('/')
  const productExists = await page.locator('#product').count()
  record('pricing -> Product navigates to "/" (or /#product)', onLanding, productUrl)
  record('landing has #product section', productExists > 0, `count=${productExists}`)

  // ---- d) landing '/' -> click nav Customers and Docs ----
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('#product', { timeout: 15000 })
  const landingCustomers = page.locator('nav a', { hasText: 'Customers' }).first()
  await landingCustomers.click()
  await page.waitForTimeout(1200)
  r = await sectionResolved(page, 'customers', '#customers')
  record('landing -> Customers resolves to #customers', r.ok, r.reason)

  const landingDocs = page.locator('nav a', { hasText: 'Docs' }).first()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(500)
  await landingDocs.click()
  await page.waitForTimeout(1200)
  r = await sectionResolved(page, 'docs', '#docs')
  record('landing -> Docs resolves to #docs', r.ok, r.reason)

  // ---- e) /pricing footer social icons are real external URLs ----
  await page.goto(`${BASE}/pricing`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('text=Starter', { timeout: 15000 })
  for (const label of ['Twitter', 'LinkedIn', 'GitHub']) {
    const link = page.locator(`footer a[aria-label="${label}"]`).first()
    const count = await link.count()
    if (!count) { record(`social ${label} present`, false, 'link not found'); continue }
    const href = await link.getAttribute('href')
    const target = await link.getAttribute('target')
    const isHttp = !!href && /^https?:\/\//.test(href)
    const isBlank = target === '_blank'
    record(`social ${label} real URL + _blank`, isHttp && isBlank, `href=${href} target=${target}`)
  }

  // ---- f) console / page errors ----
  const allErrors = [...consoleErrors, ...pageErrors]
  record('no console/page errors', allErrors.length === 0, `console=${consoleErrors.length} page=${pageErrors.length}`)

  await browser.close()

  console.log('\n--- console errors (verbatim) ---')
  console.log(consoleErrors.length ? consoleErrors.join('\n') : '(none)')
  console.log('--- page errors (verbatim) ---')
  console.log(pageErrors.length ? pageErrors.join('\n') : '(none)')

  const failed = results.filter((x) => !x.pass)
  console.log(`\n=== ${failed.length === 0 ? 'ALL PASS' : 'FAILURES: ' + failed.length} ===`)
  if (failed.length) console.log('FAILED: ' + failed.map((f) => f.name).join(' | '))
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e); process.exit(2) })
