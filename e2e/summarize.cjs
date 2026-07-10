// Quick parser: re-run smoke, summarize console errors by category (no stack dump).
const { firefox } = require('playwright')
const path = require('path')
const BASE = process.env.BASE || 'http://localhost:5174'
const OUT = __dirname

async function main() {
  const browser = await firefox.launch({ headless: true })
  const page = await browser.newContext({ viewport: { width: 1440, height: 900 } }).then(c => c.newPage())
  const errs = []
  const warns = []
  page.on('console', m => {
    if (m.type() === 'error') errs.push(m.text())
    else if (m.type() === 'warning') warns.push(m.text())
  })
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.locator('button:has-text("Start free trial")').first().click()
  await page.waitForURL('**/app/project/**/sheet/**')
  await page.waitForSelector('svg')
  await page.waitForTimeout(1500)

  // Categorize
  const cat = (list) => {
    const m = {}
    for (const t of list) {
      const k = t.replace(/pt-\d+/g, 'pt-N').replace(/default-r\d+/g, 'default-rN').replace(/\s+/g, ' ').slice(0, 90)
      m[k] = (m[k] || 0) + 1
    }
    return m
  }
  console.log('CONSOLE ERRORS total (incl. repeats):', errs.length)
  const ec = cat(errs)
  for (const [k, v] of Object.entries(ec)) console.log(`  x${v}: ${k}`)
  console.log('CONSOLE WARNINGS total:', warns.length)
  const wc = cat(warns)
  for (const [k, v] of Object.entries(wc)) console.log(`  x${v}: ${k}`)
  await browser.close()
}
main().catch(e => { console.error(e); process.exit(2) })
