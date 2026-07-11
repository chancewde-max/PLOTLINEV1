const { firefox } = require('playwright')
const path = require('path')
const FIREFOX_EXE = 'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\firefox-1532\\firefox\\firefox.exe'
const BASE = process.env.BASE || 'http://127.0.0.1:5191'
const OUT = 'C:\\Users\\Administrator\\PLOTLINEV1\\e2e'
const PROJECT_ID = 'proj-1'

async function main() {
  const browser = await firefox.launch({ headless: true, executablePath: FIREFOX_EXE })
  const page = await browser.newContext({ viewport: { width: 1440, height: 900 } }).then(c => c.newPage())
  page.on('console', m => console.log('CONSOLE', m.type(), m.text()))
  page.on('pageerror', e => console.log('PAGEERROR', e.message))
  await page.goto(`${BASE}/app/project/${PROJECT_ID}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Add sheet/i }).first().click()
  await page.waitForSelector('text=Drag PDF files here or click to browse')
  await page.locator('input[type=file]').first().setInputFiles(path.join(OUT, 'test-sample.pdf'))
  await page.waitForSelector('button:has-text("Next to titles")')
  await page.getByRole('button', { name: /Next to titles/i }).click()
  await page.waitForSelector('button:has-text("Next: Version Set")')
  await page.getByRole('button', { name: /Next: Version Set/i }).click()
  await page.waitForSelector('button:has-text("Import")')
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({ ph: i.placeholder, val: i.value, type: i.type }))
  })
  console.log('INPUTS', JSON.stringify(inputs, null, 2))
  const labels = await page.evaluate(() => Array.from(document.querySelectorAll('label')).map(l => l.textContent))
  console.log('LABELS', JSON.stringify(labels))
  await browser.close()
}
main().catch(e => { console.error(e); process.exit(1) })
