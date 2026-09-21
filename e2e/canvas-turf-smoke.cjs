const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://127.0.0.1:5173'

const results = []
function record(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`)
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium', headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await ctx.newPage()
  const consoleErrors = [], pageErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push(e.message))

  await page.goto(`${BASE}/app/project/proj-1/sheet/sheet-1`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.getByText('Essential only').click().catch(() => {})
  await page.waitForTimeout(800)

  record('Sheet canvas mounts', await page.locator('[class*="canvas"]').first().isVisible().catch(() => false))
  record('Pan tool present', await page.locator('button[aria-label="Pan"]').isVisible().catch(() => false))
  record('Select tool present', await page.locator('button[aria-label="Select"]').isVisible().catch(() => false))
  record('Turf tool present', await page.locator('button[aria-label="Synthetic turf"]').isVisible().catch(() => false))
  record('Zoom HUD present', await page.locator('[data-testid="zoom-hud"]').isVisible().catch(() => false))
  record('Left resize handle present', await page.locator('[data-testid="left-resize-handle"]').count().then(n => n > 0).catch(() => false))
  record('Right resize handle present', await page.locator('[data-testid="right-resize-handle"]').count().then(n => n > 0).catch(() => false))

  // Panel resize + persist
  const leftBefore = await page.evaluate(() => {
    const el = document.querySelector('[class*="leftPanel"]')
    return el ? el.getBoundingClientRect().width : 0
  })
  const handle = page.locator('[data-testid="left-resize-handle"]')
  const box = await handle.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + 40)
    await page.mouse.down()
    await page.mouse.move(box.x + 80, box.y + 40)
    await page.mouse.up()
  }
  const leftAfter = await page.evaluate(() => {
    const el = document.querySelector('[class*="leftPanel"]')
    return el ? el.getBoundingClientRect().width : 0
  })
  record('Left panel live-resizes wider', leftAfter > leftBefore + 20, `before=${leftBefore.toFixed(1)} after=${leftAfter.toFixed(1)}`)
  record('Panel width persisted', await page.evaluate(() => {
    const v = Number(sessionStorage.getItem('plotline-leftPanelW') || localStorage.getItem('plotline-leftPanelW'))
    return Number.isFinite(v) && v >= 200
  }))

  await handle.dblclick()
  const leftReset = await page.evaluate(() => {
    const el = document.querySelector('[class*="leftPanel"]')
    return el ? el.getBoundingClientRect().width : 0
  })
  record('Double-click resets left panel near default', Math.abs(leftReset - 264) < 8, `got ${leftReset.toFixed(1)}`)

  // Space-temp pan cursor
  await page.locator('button[aria-label="Select"]').click()
  await page.keyboard.down('Space')
  await page.waitForTimeout(50)
  const grab = await page.evaluate(() => {
    const el = document.querySelector('[class*="canvas"]')
    return el ? getComputedStyle(el).cursor : ''
  })
  record('Space hold uses grab cursor', grab === 'grab' || grab === 'grabbing', `cursor=${grab}`)
  await page.keyboard.up('Space')

  // Zoom to cursor keeps a world point (center of paper) from jumping wildly
  await page.locator('button[aria-label="Select"]').click()
  const before = await page.evaluate(() => {
    const paper = document.querySelector('[class*="paper"]')
    const r = paper.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, z: document.querySelector('[data-testid="zoom-hud"]')?.innerText }
  })
  await page.mouse.move(before.x, before.y)
  await page.mouse.wheel(0, -400)
  await page.waitForTimeout(400)
  const after = await page.evaluate(() => {
    const paper = document.querySelector('[class*="paper"]')
    const r = paper.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, z: document.querySelector('[data-testid="zoom-hud"]')?.innerText }
  })
  const dx = Math.abs(after.x - before.x)
  const dy = Math.abs(after.y - before.y)
  record('Wheel zoom changes HUD', before.z !== after.z, `${before.z} → ${after.z}`)
  record('Zoom-to-cursor keeps paper center near cursor (not recentered)', dx < 80 && dy < 80, `dx=${dx.toFixed(1)} dy=${dy.toFixed(1)}`)

  // Draw a soil area, inspect depth/cy
  await page.locator('button[aria-label="Area"]').click()
  await page.waitForTimeout(200)
  // New-area dialog may open
  const nameDlg = page.getByRole('heading', { name: /New area/i })
  if (await nameDlg.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /Start drawing/i }).click()
    await page.waitForTimeout(200)
  }
  const paper = page.locator('[class*="paper"]').first()
  const pb = await paper.boundingBox()
  if (pb) {
    const pts = [
      [pb.x + pb.width * 0.25, pb.y + pb.height * 0.25],
      [pb.x + pb.width * 0.55, pb.y + pb.height * 0.25],
      [pb.x + pb.width * 0.55, pb.y + pb.height * 0.55],
      [pb.x + pb.width * 0.25, pb.y + pb.height * 0.55],
    ]
    for (const [x, y] of pts) { await page.mouse.click(x, y); await page.waitForTimeout(80) }
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)
    await page.locator('button[aria-label="Select"]').click()
    await page.mouse.click(pts[0][0] + 40, pts[0][1] + 40)
    await page.waitForTimeout(200)
  }
  const inspector = page.locator('[data-testid="area-inspector"]')
  record('Area inspector appears after selecting a drawn area', await inspector.isVisible().catch(() => false))
  if (await inspector.isVisible().catch(() => false)) {
    await inspector.getByLabel('Custom depth inches').fill('12')
    await page.waitForTimeout(100)
    const cy = await page.locator('[data-testid="area-cy"]').innerText()
    record('Live cubic yards updates (X.XX cy)', /^\d+\.\d{2} cy$/.test(cy) && cy !== '0.00 cy', cy)
    const topsoil = inspector.getByLabel('Topsoil type')
    const labels = await topsoil.locator('option').allTextContents()
    record('Topsoil options match spec',
      ['Enriched', 'Sandy loam', '4-way mix', 'Custom', 'None'].every(l => labels.includes(l)),
      labels.join('|'))
    await topsoil.selectOption('custom')
    record('Custom topsoil field placeholder', await inspector.getByPlaceholder('Topsoil type').isVisible().catch(() => false))
  }

  // Turf tool
  await page.locator('button[aria-label="Synthetic turf"]').click()
  await page.waitForTimeout(200)
  record('Turf panel visible', await page.locator('[data-testid="turf-panel"]').isVisible().catch(() => false))
  record('Turf draw/stamp segmented control', await page.getByRole('tab', { name: 'Draw area' }).isVisible().catch(() => false)
    && await page.getByRole('tab', { name: 'Stamp rolls' }).isVisible().catch(() => false))

  if (pb) {
    await page.getByRole('tab', { name: 'Draw area' }).click()
    const tpts = [
      [pb.x + pb.width * 0.20, pb.y + pb.height * 0.60],
      [pb.x + pb.width * 0.70, pb.y + pb.height * 0.60],
      [pb.x + pb.width * 0.70, pb.y + pb.height * 0.90],
      [pb.x + pb.width * 0.20, pb.y + pb.height * 0.90],
    ]
    for (const [x, y] of tpts) { await page.mouse.click(x, y); await page.waitForTimeout(80) }
    await page.keyboard.press('Enter')
    await page.waitForTimeout(250)
    record('After close, stamp mode is hinted', await page.getByText(/Stamp rolls/i).first().isVisible().catch(() => false))
    await page.getByRole('tab', { name: 'Stamp rolls' }).click().catch(() => {})
    await page.mouse.move(pb.x + pb.width * 0.45, pb.y + pb.height * 0.75)
    await page.mouse.click(pb.x + pb.width * 0.45, pb.y + pb.height * 0.75)
    await page.waitForTimeout(200)
    const cov = await page.locator('[data-testid="turf-panel"]').innerText()
    record('Coverage panel shows rolls / coverage fields',
      /Area sq ft/.test(cov) && /Rolls placed/.test(cov) && /Coverage %/.test(cov) && /Gaps/.test(cov),
      cov.slice(0, 180))
  }

  record('No console/page errors', consoleErrors.length === 0 && pageErrors.length === 0,
    `console=${consoleErrors.length} page=${pageErrors.length} ${consoleErrors[0] || pageErrors[0] || ''}`)

  const failed = results.filter((x) => !x.pass)
  console.log(`\n=== ${failed.length === 0 ? 'ALL PASS' : 'FAILURES: ' + failed.length} ===`)
  if (failed.length) console.log('FAILED: ' + failed.map((f) => f.name).join(' | '))
  await browser.close()
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e); process.exit(2) })
