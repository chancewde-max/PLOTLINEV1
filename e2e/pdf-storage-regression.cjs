const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const BASE = process.env.BASE || 'http://127.0.0.1:5173'
const PDF_PATH = path.join(__dirname, 'test-sample.pdf')

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
  await page.waitForTimeout(300)

  // Upload a new sheet via the wizard (local-only mode: no Supabase creds in
  // this sandbox, so this should still produce a base64 data: URL exactly
  // as before — Storage upload is gated behind signed-in + cloud enabled).
  await page.getByRole('button', { name: /Add sheet/i }).first().click()
  await page.waitForTimeout(400)
  const fileInput = page.locator('input[type=file]').first()
  await fileInput.setInputFiles(PDF_PATH)
  await page.waitForTimeout(1500)
  record('Wizard step advanced past file upload', await page.getByRole('button', { name: /Next to sheet numbers/i }).isVisible().catch(() => false))

  await page.getByRole('button', { name: /Next to sheet numbers/i }).click().catch(() => {})
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /Next to titles/i }).click().catch(() => {})
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /Next: Version Set/i }).click().catch(() => {})
  await page.waitForTimeout(500)
  const importBtn = page.getByRole('button', { name: /^Import/i })
  record('Import button reached', await importBtn.isVisible().catch(() => false))
  await importBtn.click().catch(() => {})
  await page.waitForTimeout(1000)

  // Confirm the new sheet's pdfUrl is a data: URL (local-only fallback path
  // still works unchanged) — check via localStorage.
  const state = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('plotline-appdata') || '{}')
    const sheets = Object.values(d.sheets || {})
    return sheets.map(s => ({ id: s.id, pdfUrlPrefix: (s.pdfUrl || '').slice(0, 20), pdfAssetId: s.pdfAssetId }))
  })
  console.log('sheets:', JSON.stringify(state))
  const hasNewSheet = state.some(s => s.pdfAssetId || (s.pdfUrlPrefix || '').startsWith('data:') || (s.pdfUrlPrefix || '').startsWith('plotline-pdf'))
  record('New sheet uses local base64/plotline-pdf fallback (not storage:)', hasNewSheet, JSON.stringify(state))
  record('No sheet accidentally got a storage: reference in local-only mode',
    !state.some(s => (s.pdfUrlPrefix || '').startsWith('storage:')))

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
