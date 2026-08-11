// Manual smoke test for proposal versioning (change orders / revised plan sets).
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
  page.on('dialog', (d) => d.accept())
  // A fresh Playwright context already starts with empty storage — no need
  // to clear localStorage, and doing it via addInitScript would re-fire on
  // page.reload() below and wipe the very data we're checking persisted.

  await page.goto(`${BASE}/app/project/proj-1`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('text=Maple Grove Estates', { timeout: 15000 })
  await page.getByText('Essential only').click().catch(() => {})
  await page.getByRole('button', { name: 'Pricebook', exact: true }).click()
  await page.waitForTimeout(300)

  // Default state: no versions yet -> "Original Proposal — start typing to save"
  record('Version bar shows empty state', await page.getByText('Original Proposal — start typing to save').isVisible().catch(() => false))

  // Type into the "To" name field -> lazily creates version 1 ("Original Proposal").
  const toName = page.locator('input[placeholder="Customer\'s full business name"]').first()
  await toName.fill('Acme Corp')
  await page.waitForTimeout(500)
  record('Version selector appears after first edit', await page.locator('select[aria-label="Proposal version"]').isVisible().catch(() => false))
  const selVal1 = await page.locator('select[aria-label="Proposal version"]').inputValue().catch(() => null)
  record('Original version option reads "v1 — Original Proposal"', (await page.locator('select[aria-label="Proposal version"] option:checked').textContent().catch(() => '')).includes('Original Proposal'))

  // Create a new version ("Change Order 1") — should duplicate current content.
  await page.getByRole('button', { name: /^New version$/i }).click()
  await page.waitForTimeout(200)
  await page.locator('[role="dialog"] input').first().fill('Change Order 1')
  await page.getByRole('button', { name: /^Create version$/i }).click()
  await page.waitForTimeout(400)
  const optTexts = await page.locator('select[aria-label="Proposal version"] option').allTextContents()
  record('Two versions listed after creating one', optTexts.length === 2, JSON.stringify(optTexts))
  record('New version is now current and named Change Order 1', (await page.locator('select[aria-label="Proposal version"] option:checked').textContent()).includes('Change Order 1'))
  record('Duplicated content carried over (Acme Corp)', await toName.inputValue() === 'Acme Corp')

  // Edit the new version differently, then switch back to v1 and confirm isolation.
  await toName.fill('Acme Corp - Change Order')
  await page.waitForTimeout(500)
  await page.locator('select[aria-label="Proposal version"]').selectOption({ label: 'v1 — Original Proposal' })
  await page.waitForTimeout(400)
  record('Switching back to v1 restores original content', await toName.inputValue() === 'Acme Corp')

  await page.locator('select[aria-label="Proposal version"]').selectOption({ index: 1 })
  await page.waitForTimeout(400)
  record('Switching to v2 shows the change-order edit', await toName.inputValue() === 'Acme Corp - Change Order')

  // Rename current version.
  await page.getByRole('button', { name: /^Rename$/i }).click()
  await page.waitForTimeout(200)
  await page.locator('[role="dialog"] input').first().fill('Change Order 1 - Revised')
  await page.getByRole('button', { name: /^Save name$/i }).click()
  await page.waitForTimeout(300)
  record('Rename applied', (await page.locator('select[aria-label="Proposal version"] option:checked').textContent()).includes('Change Order 1 - Revised'))

  // Reload and confirm persistence of both versions + current selection.
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('text=Maple Grove Estates', { timeout: 15000 })
  await page.getByRole('button', { name: 'Pricebook', exact: true }).click()
  await page.waitForTimeout(500)
  const optsAfterReload = await page.locator('select[aria-label="Proposal version"] option').allTextContents()
  record('Both versions persisted after reload', optsAfterReload.length === 2, JSON.stringify(optsAfterReload))
  record('Current version (Change Order) still selected after reload', await toName.inputValue() === 'Acme Corp - Change Order')

  // Delete the current (change order) version -> should fall back to v1, and
  // the Delete button should be disabled once only one version remains.
  await page.getByRole('button', { name: /^Delete version$/i }).click()
  await page.waitForTimeout(400)
  const optsAfterDelete = await page.locator('select[aria-label="Proposal version"] option').allTextContents()
  record('One version remains after delete', optsAfterDelete.length === 1, JSON.stringify(optsAfterDelete))
  record('Fell back to remaining original version content', await toName.inputValue() === 'Acme Corp')
  record('Delete button disabled with a single version left', await page.getByRole('button', { name: /^Delete version$/i }).isDisabled())

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
