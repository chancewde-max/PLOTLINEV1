// Quick verification of /pricing route + Export bid overlay on ProjectPage.
const { firefox } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:5196'

async function main() {
  const browser = await firefox.launch({ headless: true })
  const page = await browser.newContext({ viewport: { width: 1440, height: 900 } }).then(c => c.newPage())
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', e => errs.push(e.message))

  // 1) /pricing route
  await page.goto(`${BASE}/pricing`, { waitUntil: 'networkidle' })
  const tierCount = await page.locator('text=Starter').count()
  const hasPro = await page.locator('text=$49').first().isVisible().catch(() => false)
  const hasCrew = await page.locator('text=$149').first().isVisible().catch(() => false)
  const hasFaq = await page.getByText('Pricing, answered').first().isVisible().catch(() => false)
  console.log(`[pricing] Starter=${tierCount>0} Pro($49)=${hasPro} Crew($149)=${hasCrew} FAQ=${hasFaq}`)

  // 2) Export bid overlay on ProjectPage
  await page.goto(`${BASE}/app/project/proj-1`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Export bid/i }).first().click()
  await page.waitForTimeout(500)
  const opened = await page.getByText('Bid Proposal & Materials Takeoff').first().isVisible().catch(() => false)
  const hasSheetSummary = await page.getByText('Sheet summary').first().isVisible().catch(() => false)
  const hasMaterials = await page.getByText('Materials takeoff').first().isVisible().catch(() => false)
  const hasClient = await page.getByText('Hilltop Developments').first().isVisible().catch(() => false)
  console.log(`[export] overlay=${opened} sheetSummary=${hasSheetSummary} materials=${hasMaterials} client=${hasClient}`)

  await browser.close()
  const ok = tierCount > 0 && hasPro && hasCrew && hasFaq && opened && hasSheetSummary && hasMaterials && hasClient && errs.length === 0
  console.log(`consoleErrors=${errs.length}`)
  if (errs.length) console.log(errs.join('\n'))
  console.log(`\n=== ${ok ? 'PASS' : 'FAIL'} ===`)
  process.exit(ok ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(2) })
