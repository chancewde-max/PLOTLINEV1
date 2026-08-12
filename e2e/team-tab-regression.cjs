const { chromium } = require('playwright')
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

  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.getByText('Essential only').click().catch(() => {})
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Team', exact: true }).click().catch(() => {})
  await page.waitForTimeout(500)
  record('Team tab renders "Cloud sync not configured" notice (no creds in this sandbox)',
    await page.getByText(/Team features need cloud sync configured/i).isVisible().catch(() => false))

  record('No console/page errors', consoleErrors.length === 0 && pageErrors.length === 0,
    `console=${consoleErrors.length} page=${pageErrors.length}`)
  if (consoleErrors.length) console.log('console errors:\n' + consoleErrors.join('\n'))
  if (pageErrors.length) console.log('page errors:\n' + pageErrors.join('\n'))

  const failed = results.filter((x) => !x.pass)
  console.log(`\n=== ${failed.length === 0 ? 'ALL PASS' : 'FAILURES: ' + failed.length} ===`)
  await browser.close()
  process.exit(failed.length === 0 ? 0 : 1)
}
main().catch((e) => { console.error('SCRIPT ERROR:', e); process.exit(2) })
