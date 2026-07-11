// Targeted e2e: verify Pricebook -> Proposal editable + MTO auto-populate +
// proposal template save/load/import round-trip. Run against dist served on 5191.
const { firefox } = require('playwright')
const path = require('path')
const fs = require('fs')

const BASE = process.env.BASE || 'http://127.0.0.1:5191'
const SAMPLE = path.join(__dirname, 'sample-mto.xlsx')

const results = []
function record(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`)
}

// Build a template JSON fixture for import.
const TPL = {
  name: 'Imported Template',
  structure: {
    title: 'Imported Proposal',
    intro: 'Imported intro.',
    notes: 'Imported notes.',
    company: 'Acme Irrigation',
    lineItems: [{ item: 'I1', description: 'Imported item', qty: '3', unit: 'ea', unitPrice: '10' }],
  },
}
const TPL_PATH = path.join(__dirname, 'import-tpl.json')
fs.writeFileSync(TPL_PATH, JSON.stringify(TPL))

async function main() {
  const browser = await firefox.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await ctx.newPage()
  const consoleErrors = [], pageErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message))
  // Auto-accept confirm() dialogs (used by "Refresh from MTO").
  page.on('dialog', (d) => d.accept())
  await page.addInitScript(() => { try { localStorage.clear() } catch {} })

  await page.goto(`${BASE}/app/project/proj-1`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('text=Maple Grove Estates', { timeout: 15000 })

  // Default Pricebook view = Proposal editor (Word-like doc)
  record('Proposal editor visible by default', await page.getByText('Proposal editor').isVisible().catch(() => false))
  record('Proposal title editable', await page.locator('input[placeholder="Proposal title"]').first().isVisible().catch(() => false))

  // Switch to MTO sub-view and upload the sample so we have a current MTO version.
  await page.locator('button', { hasText: 'MTO' }).first().click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /New MTO/i }).click()
  await page.waitForTimeout(300)
  await page.getByText('Blank take-off').click()
  await page.waitForTimeout(400)
  await page.locator('input[type=file]').first().setInputFiles(SAMPLE)
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: /Save mapping/i }).click()
  await page.waitForTimeout(600)
  record('MTO mapped (Sod row)', await page.getByText('Sod 2" Kentucky Bluegrass').isVisible().catch(() => false))

  // Back to Proposal; click "Refresh from MTO" (dialog auto-accepted).
  await page.locator('button', { hasText: 'Proposal' }).first().click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /Refresh from MTO/i }).click()
  await page.waitForTimeout(600)

  // The first MTO row (Sod) should now appear as a proposal line-item description.
  record('Auto-populate from MTO (Sod line)', await page.locator('input[value="Sod 2\\" Kentucky Bluegrass"]').first().isVisible().catch(() => false))

  // Save as template
  await page.getByRole('button', { name: /Save as template/i }).click()
  await page.waitForTimeout(300)
  await page.getByPlaceholder('Template name…').fill('Verify Template')
  await page.getByRole('button', { name: /^Save template$/i }).click()
  await page.waitForTimeout(400)

  // Import a template JSON
  const importInput = page.locator('input[type=file]').nth(1) // the ProposalEditor import input
  // The import input is hidden (display:none); use the Import button to trigger it.
  await page.getByRole('button', { name: /^Import$/i }).click()
  await page.waitForTimeout(300)
  const hiddenImport = page.locator('input[type=file]').nth(1)
  await hiddenImport.setInputFiles(TPL_PATH).catch(async () => {
    // fallback: the only file input on proposal view
    await page.locator('input[type=file]').first().setInputFiles(TPL_PATH)
  })
  await page.waitForTimeout(500)
  record('Imported template applied (Acme Irrigation)', await page.getByDisplayValue('Acme Irrigation').first().isVisible().catch(() => false))
  record('Imported line item present', await page.getByDisplayValue('Imported item').first().isVisible().catch(() => false))

  // Persistence: reload and confirm proposal survived
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('text=Maple Grove Estates', { timeout: 15000 })
  await page.waitForTimeout(400)
  record('Proposal persisted after reload (Imported item)', await page.getByDisplayValue('Imported item').first().isVisible().catch(() => false))

  record('No console/page errors', consoleErrors.length === 0 && pageErrors.length === 0,
    `console=${consoleErrors.length} page=${pageErrors.length}`)

  const failed = results.filter((x) => !x.pass)
  console.log(`\n=== ${failed.length === 0 ? 'ALL PASS' : 'FAILURES: ' + failed.length} ===`)
  if (failed.length) console.log('FAILED: ' + failed.map((f) => f.name).join(' | '))
  if (consoleErrors.length) console.log('console errors:\n' + consoleErrors.join('\n'))
  if (pageErrors.length) console.log('page errors:\n' + pageErrors.join('\n'))
  await browser.close()
  process.exit(failed.length === 0 ? 0 : 1)
}
main().catch((e) => { console.error('SCRIPT ERROR:', e); process.exit(2) })
