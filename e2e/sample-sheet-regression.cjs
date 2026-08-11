const { chromium } = require('playwright')
const path = require('path')
const BASE = process.env.BASE || 'http://127.0.0.1:5173'

const results = []
function record(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`)
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await ctx.newPage()
  const consoleErrors = [], pageErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message))

  await page.goto(`${BASE}/app/project/proj-1`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('text=Maple Grove Estates', { timeout: 15000 })
  await page.getByText('Essential only').click().catch(() => {})
  await page.getByRole('button', { name: /Sheets \(/i }).click()
  await page.waitForTimeout(500)
  const firstSheet = page.locator('[class*="sheetThumb"]').first()
  record('Sheet thumbnail visible', await firstSheet.isVisible().catch(() => false))
  await firstSheet.click()
  await page.waitForTimeout(1500)

  const paperBox = await page.evaluate(() => {
    const el = document.querySelector('[class*="paper"]')
    return el ? { w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height } : null
  })
  record('Paper renders for a no-PDF sample sheet (falls back to default 900:620)', !!paperBox, JSON.stringify(paperBox))
  if (paperBox) {
    const aspect = paperBox.w / paperBox.h
    record('Falls back to the original 900:620 aspect (~1.4516) when no real page is known', Math.abs(aspect - (900/620)) < 0.01, `got ${aspect.toFixed(4)}`)
  }

  // Click the region tool and draw so the base interaction path still works.
  await page.locator('button[aria-label="Region count"]').click().catch(() => {})
  await page.waitForTimeout(1000)

  record('No console/page errors', consoleErrors.length === 0 && pageErrors.length === 0,
    `console=${consoleErrors.length} page=${pageErrors.length}`)
  if (consoleErrors.length) console.log('console errors:\n' + consoleErrors.join('\n'))
  if (pageErrors.length) console.log('page errors:\n' + pageErrors.join('\n'))

  const failed = results.filter((x) => !x.pass)
  console.log(`\n=== ${failed.length === 0 ? 'ALL PASS' : 'FAILURES: ' + failed.length} ===`)
  if (failed.length) console.log('FAILED: ' + failed.map((f) => f.name).join(' | '))
  await browser.close()
  process.exit(failed.length === 0 ? 0 : 1)
}
main().catch((e) => { console.error('SCRIPT ERROR:', e); process.exit(2) })
