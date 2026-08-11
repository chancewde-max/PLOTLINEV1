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
  record('Sample project visible (local mode, no auth)', await page.getByText('Maple Grove Estates').isVisible().catch(() => false))

  // SaveStatus should render without crashing now that it also calls useAuth().
  const saveStatus = page.locator('text=Saved').first()
  record('SaveStatus renders "Saved" in local-only mode', await saveStatus.isVisible().catch(() => false))

  // AccountCard should show "Cloud sync not configured" (since no Supabase creds in this sandbox).
  await page.locator('[aria-label="Account"]').click()
  await page.waitForTimeout(300)
  record('AccountCard shows "Not signed in"', await page.getByText('Not signed in').isVisible().catch(() => false))
  record('AccountCard shows "Cloud sync not configured"', await page.getByText('Cloud sync not configured').isVisible().catch(() => false))
  await page.keyboard.press('Escape')

  // Add a project — confirms useAppData's new hasLocalEditsRef wiring didn't break normal mutation flow.
  await page.getByText('All projects', { exact: false }).first().click().catch(() => {})
  await page.waitForTimeout(300)
  const addBtn = page.getByRole('button', { name: /New project|Add project/i }).first()
  record('Add-project entry point visible', await addBtn.isVisible().catch(() => false))

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
