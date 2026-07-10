// Playwright (Firefox) regression for the rebuilt MTO tab (versioned + templated,
// heuristic auto-map + human review). Confirms the empty state, New MTO -> Blank,
// upload, auto-mapping, and the Save-mapping confirmation render and persist.
const { firefox } = require('playwright')
const path = require('path')

const BASE = process.env.BASE || 'http://127.0.0.1:5191'
const SAMPLE = path.join(__dirname, 'sample-mto.xlsx')
const OUT = path.join(__dirname, 'shot-mto.png')

const results = []
function record(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`)
}

async function main() {
  const browser = await firefox.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await ctx.newPage()
  const consoleErrors = []
  const pageErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message))

  await page.addInitScript(() => { try { localStorage.clear() } catch {} })

  await page.goto(`${BASE}/app/project/proj-1`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('text=Maple Grove Estates', { timeout: 15000 })

  // MTO tab
  const mtoTab = page.locator('button', { hasText: 'MTO' }).first()
  record('MTO tab present', await mtoTab.count() > 0)
  await mtoTab.click()
  await page.waitForTimeout(500)

  // Empty state
  record('Empty state visible', await page.getByText('No MTO yet').isVisible().catch(() => false))

  // New MTO -> Blank
  await page.getByRole('button', { name: /New MTO/i }).click()
  await page.waitForTimeout(300)
  await page.getByText('Blank take-off').click()
  await page.waitForTimeout(400)

  // Upload
  const fileInput = page.locator('input[type=file]').first()
  await fileInput.setInputFiles(SAMPLE)
  await page.waitForTimeout(900)

  record('File name shown', await page.getByText(/sample-mto/).first().isVisible().catch(() => false))
  record('Review mapping visible', await page.getByText('Review mapping').isVisible().catch(() => false))

  // Auto-detected: Item/Code select pre-selected to "Part #"
  const selects = page.locator('select')
  const itemVal = await selects.nth(0).inputValue().catch(() => '')
  record('Auto-map item -> Part #', itemVal === 'Part #', `value=${itemVal}`)

  // Save mapping
  await page.getByRole('button', { name: /Save mapping/i }).click()
  await page.waitForTimeout(600)

  // Mapped table rendered
  record('Mapped row present (Sod)', await page.getByText('Sod 2" Kentucky Bluegrass').isVisible().catch(() => false))
  const descHeader = await page.locator('th', { hasText: 'Description' }).count()
  record('Mapped table has Description column', descHeader > 0)

  record('No console/page errors', consoleErrors.length === 0 && pageErrors.length === 0,
    `console=${consoleErrors.length} page=${pageErrors.length}`)

  await page.screenshot({ path: OUT }).catch(() => {})
  console.log('screenshot:', path.basename(OUT))

  await browser.close()
  if (consoleErrors.length) console.log('console errors:\n' + consoleErrors.join('\n'))
  if (pageErrors.length) console.log('page errors:\n' + pageErrors.join('\n'))

  const failed = results.filter((x) => !x.pass)
  console.log(`\n=== ${failed.length === 0 ? 'ALL PASS' : 'FAILURES: ' + failed.length} ===`)
  if (failed.length) console.log('FAILED: ' + failed.map((f) => f.name).join(' | '))
  process.exit(failed.length === 0 ? 0 : 1)
}
main().catch((e) => { console.error('SCRIPT ERROR:', e); process.exit(2) })
