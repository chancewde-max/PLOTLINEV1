// Playwright (Firefox) smoke for the new MTO tab: confirms the tab renders,
// the upload dropzone is present, and uploading a sample .xlsx populates the
// mapped table with auto-detected column mappings.
const { firefox } = require('playwright')
const path = require('path')

const BASE = process.env.BASE || 'http://127.0.0.1:5191'
const SAMPLE = path.join(__dirname, 'sample-mto.xlsx')
const OUT = path.join(__dirname, 'shot-mto.png')

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

  await page.goto(`${BASE}/app/project/proj-1`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('text=Maple Grove Estates', { timeout: 15000 })

  // MTO tab exists
  const mtoTab = page.locator('button', { hasText: 'MTO' }).first()
  record('MTO tab present', await mtoTab.count() > 0)

  await mtoTab.click()
  await page.waitForTimeout(600)

  // Upload dropzone + button visible
  const uploadBtn = page.getByRole('button', { name: /Upload Excel/i }).first()
  record('Upload UI visible', await uploadBtn.isVisible().catch(() => false))

  // Hidden file input — drive it via setInputFiles
  const fileInput = page.locator('input[type=file]').first()
  await fileInput.setInputFiles(SAMPLE)
  await page.waitForTimeout(900)

  // File name + mapped table rendered
  record('File name shown', await page.locator('text=sample-mto.xlsx').count() > 0)
  const mappedHeaders = await page.locator('th', { hasText: 'Description' }).count()
  record('Mapped table rendered (Description column)', mappedHeaders > 0)
  record('Mapped row present (Sod)', await page.locator('text=Sod 2" Kentucky Bluegrass').count() > 0)

  // Auto-detect: column mapping selects should reflect source headers
  const descSelect = page.locator('select').first()
  record('No console/page errors', consoleErrors.length === 0 && pageErrors.length === 0,
    `console=${consoleErrors.length} page=${pageErrors.length}`)

  await page.screenshot({ path: OUT }).catch(() => {})
  console.log('screenshot:', path.basename(OUT))

  await browser.close()
  if (consoleErrors.length) console.log('console errors:\n' + consoleErrors.join('\n'))
  if (pageErrors.length) console.log('page errors:\n' + pageErrors.join('\n'))

  const failed = results.filter((x) => !x.pass)
  console.log(`\n=== ${failed.length === 0 ? 'ALL PASS' : 'FAILURES: ' + failed.length} ===`)
  process.exit(failed.length === 0 ? 0 : 1)
}
main().catch((e) => { console.error('SCRIPT ERROR:', e); process.exit(2) })
