// New-behavior check for password recovery UI.
// Loads /reset-password directly (SPA fallback should return the app shell)
// and opens the auth modal's reset view. Supabase hosts are stubbed so the
// check never depends on a live project. This is not a regression test:
// /reset-password and Forgot password did not exist before this change.
const { chromium, firefox } = require('playwright')

const BASE = process.env.BASE || 'http://127.0.0.1:5173'

function log(...args) { console.log(...args) }

async function launch() {
  const prefer = process.env.PW_BROWSER
  const order = prefer === 'firefox' ? [firefox, chromium] : [chromium, firefox]
  let lastError
  for (const browserType of order) {
    try {
      return await browserType.launch({ headless: true })
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

async function main() {
  const browser = await launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const pageErrors = []
  let stubbed = 0
  page.on('pageerror', (err) => pageErrors.push(String(err.message)))
  await page.route('**/*supabase.co/**', (route) => {
    stubbed += 1
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    })
  })

  const results = []
  function record(name, pass, detail) {
    results.push({ name, pass, detail })
    log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`)
  }

  try {
    const response = await page.goto(`${BASE}/reset-password`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const status = response ? response.status() : 0
    const contentType = response ? (response.headers()['content-type'] || '') : ''
    record('GET /reset-password status', status === 200, String(status))
    record('GET /reset-password content-type', contentType.includes('text/html'), contentType)
    await page.getByRole('heading', { name: 'Reset your password' }).waitFor({ timeout: 10000 })
    record('reset page renders', true)

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const signIn = page.getByRole('button', { name: 'Sign in' }).first()
    if (await signIn.isVisible().catch(() => false)) await signIn.click()
    else await page.getByRole('button', { name: /Start free trial/i }).first().click()
    await page.getByRole('dialog').waitFor({ timeout: 10000 })
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    await page.getByText("Enter your email and we'll send you a reset link.").waitFor({ timeout: 10000 })
    const send = page.getByRole('button', { name: 'Send reset link' })
    record('forgot password opens reset view', await send.isVisible())
    record('reset view has an email field', await page.getByLabel('Email').isVisible())
    record('reset view hides the password field', (await page.locator('input[type="password"]').count()) === 0)
  } catch (err) {
    record('fatal', false, err.message)
  } finally {
    log(`supabase routes stubbed: ${stubbed}`)
    if (pageErrors.length) {
      log('page errors:')
      pageErrors.forEach((line) => log('  ' + line))
    }
    await browser.close()
  }

  const ok = results.length > 0 && results.every((item) => item.pass) && pageErrors.length === 0
  log(ok ? 'AUTH RECOVERY CHECK: PASS' : 'AUTH RECOVERY CHECK: FAIL')
  process.exit(ok ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
