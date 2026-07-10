// Inline /pricing verification (lazy-chunk aware): wait for 'Starter', confirm 200 + tiers + 0 console errors.
const { firefox } = require('playwright')
const BASE = process.env.BASE || 'http://127.0.0.1:5200'

async function main() {
  const browser = await firefox.launch({ headless: true })
  const page = await browser.newContext({ viewport: { width: 1440, height: 900 } }).then(c => c.newPage())
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))

  let httpStatus = 'n/a'
  page.on('response', r => { if (r.url().replace(/\/$/, '') === BASE + '/pricing') httpStatus = r.status() })

  await page.goto(`${BASE}/pricing`, { waitUntil: 'networkidle', timeout: 30000 })
  // Lazy chunk: wait for the tier heading, don't assert immediately.
  await page.waitForSelector('text=Starter', { timeout: 15000 })
  const hasPro = await page.locator('text=$49').first().isVisible().catch(() => false)
  const hasCrew = await page.locator('text=$149').first().isVisible().catch(() => false)
  const hasFaq = await page.getByText('Pricing, answered').first().isVisible().catch(() => false)
  const tierCount = await page.locator('text=Starter').count()

  console.log(`[pricing] http=${httpStatus} Starter=${tierCount > 0} Pro($49)=${hasPro} Crew($149)=${hasCrew} FAQ=${hasFaq}`)
  console.log(`consoleErrors=${errs.length}`)
  if (errs.length) console.log(errs.join('\n'))

  await browser.close()
  const ok = httpStatus === 200 && tierCount > 0 && hasPro && hasCrew && hasFaq && errs.length === 0
  console.log(`\n=== ${ok ? 'PASS' : 'FAIL'} ===`)
  process.exit(ok ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(2) })
