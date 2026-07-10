// Playwright (Firefox) e2e for the rebuilt MTO feature:
//   template library + per-project versioning + heuristic auto-map + review.
// Exercises the full Phase-1 flow against the production build served by
// e2e/run-all.cjs (BASE). Not wired into run-all.cjs by default — run on demand.
const { firefox } = require('playwright')
const path = require('path')

const BASE = process.env.BASE || 'http://127.0.0.1:5191'
const SAMPLE = path.join(__dirname, 'sample-mto.xlsx')
const OUT = path.join(__dirname, 'shot-mto-v2.png')

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

  // Start from a clean slate so the assertions are deterministic.
  await page.addInitScript(() => { try { localStorage.clear() } catch {} })

  await page.goto(`${BASE}/app/project/proj-1`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('text=Maple Grove Estates', { timeout: 15000 })

  // --- Empty state ---
  await page.locator('button', { hasText: 'MTO' }).first().click()
  await page.waitForTimeout(500)
  record('Empty state shows "No MTO yet"', await page.getByText('No MTO yet').isVisible().catch(() => false))
  record('Empty state has "New MTO" button',
    await page.getByRole('button', { name: /New MTO/i }).isVisible().catch(() => false))

  // --- New MTO modal -> Blank ---
  await page.getByRole('button', { name: /New MTO/i }).click()
  await page.waitForTimeout(300)
  record('New MTO modal opens', await page.getByText('Blank take-off').isVisible().catch(() => false))

  // Create a blank version (the file input only appears once a version exists).
  await page.getByText('Blank take-off').click()
  await page.waitForTimeout(500)

  // --- Upload the sample xlsx ---
  const fileInput = page.locator('input[type=file]').first()
  await fileInput.setInputFiles(SAMPLE)
  await page.waitForTimeout(1000)

  // --- Heuristic auto-map + Review UI ---
  record('File name shown after upload', await page.getByText(/sample-mto/).first().isVisible().catch(() => false))
  record('Review mapping card visible', await page.getByText('Review mapping').isVisible().catch(() => false))

  // The review banner should mention the auto-detect heuristic.
  record('Heuristic review banner visible',
    await page.getByText(/auto-detected a column mapping/i).isVisible().catch(() => false))

  // Confidence badges should be present (green "high" at least for Part #->item).
  record('Confidence badges rendered',
    await page.locator('span:has-text("high")').first().isVisible().catch(() => false) ||
    await page.locator('span:has-text("weak")').first().isVisible().catch(() => false))

  // The select for the "Item / Code" field should be pre-selected to "Part #".
  const selects = page.locator('select')
  const itemSel = selects.nth(0)
  const itemVal = await itemSel.inputValue().catch(() => '')
  record('Heuristic mapped item -> "Part #"', itemVal === 'Part #', `value=${itemVal}`)

  const descVal = await selects.nth(1).inputValue().catch(() => '')
  record('Heuristic mapped description -> "Desc"', descVal === 'Desc', `value=${descVal}`)
  const qtyVal = await selects.nth(2).inputValue().catch(() => '')
  record('Heuristic mapped qty -> "Qty"', qtyVal === 'Qty', `value=${qtyVal}`)
  const unitVal = await selects.nth(3).inputValue().catch(() => '')
  record('Heuristic mapped unit -> "UOM"', unitVal === 'UOM', `value=${unitVal}`)
  const priceVal = await selects.nth(4).inputValue().catch(() => '')
  record('Heuristic mapped unitPrice -> "Unit Cost"', priceVal === 'Unit Cost', `value=${priceVal}`)
  const totalVal = await selects.nth(5).inputValue().catch(() => '')
  record('Heuristic mapped total -> "Total"', totalVal === 'Total', `value=${totalVal}`)

  // Save mapping -> persisted.
  await page.getByRole('button', { name: /Save mapping/i }).click()
  await page.waitForTimeout(600)
  record('Mapping persisted (Reviewed chip)', await page.getByText('Reviewed').isVisible().catch(() => false))

  // Mapped table should now render the rows.
  record('Mapped table rendered (Autumn Blaze)',
    await page.getByText('Autumn Blaze Maple 2.5" cal').isVisible().catch(() => false))

  // --- Version switcher: create a second (blank) version ---
  await page.getByRole('button', { name: /New version/i }).first().click().catch(async () => {
    await page.locator('button[title="New version"]').click()
  })
  await page.waitForTimeout(300)
  // Blank option in modal
  await page.getByText('Blank take-off').click()
  await page.waitForTimeout(500)
  const pills = await page.locator('button:has-text("v")').count()
  record('Version switcher shows >=2 versions', pills >= 2, `pills=${pills}`)

  // Switch back to v1.
  await page.locator('button', { hasText: /^v1/ }).first().click()
  await page.waitForTimeout(400)
  record('Switching to v1 restores rows',
    await page.getByText('Autumn Blaze Maple 2.5" cal').isVisible().catch(() => false))

  // --- Save as template from v1 (re-upload to get review again) ---
  // Re-open v1 (already current); upload again to trigger review, then save template.
  // Instead, just exercise save-as-template via the review card after re-upload.
  await page.locator('input[type=file]').first().setInputFiles(SAMPLE)
  await page.waitForTimeout(900)
  const tplName = 'Landscape Standard'
  await page.getByPlaceholder('Template name…').fill(tplName)
  await page.getByRole('button', { name: /Save as template/i }).click()
  await page.waitForTimeout(600)
  record('Save as template accepted (no crash)',
    consoleErrors.length === 0 && pageErrors.length === 0)

  // --- From Template flow on a fresh project (clean slate not required) ---
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
