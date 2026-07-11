const { firefox } = require('playwright')
const path = require('path')
const BASE = process.env.BASE || 'http://127.0.0.1:5191'
const OUT = __dirname

async function main() {
  const browser = await firefox.launch({ headless: true })
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))

  await page.goto(`${BASE}/app/project/proj-1/sheet/sheet-1`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('svg', { timeout: 15000 })

  await page.locator('[aria-label="Linear"]').first().click()
  await page.waitForTimeout(400)
  const start = page.getByRole('button', { name: /^Start drawing$/i }).first()
  if (await start.isVisible().catch(() => false)) { await start.click(); await page.waitForTimeout(400) }

  // Pick the takeoff canvas svg = the largest svg on the page.
  const svgHandle = await page.evaluateHandle(() => {
    const svgs = [...document.querySelectorAll('svg')]
    return svgs.sort((a,b) => (b.clientWidth*b.clientHeight)-(a.clientWidth*a.clientHeight))[0]
  })
  const svg = svgHandle.asElement()
  const box = await svg.boundingBox()
  console.log('takeoff svg box:', JSON.stringify(box))
  const topAt = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y)
    return el ? (el.tagName + '.' + (el.getAttribute('class')||'').slice(0,30)) : 'none'
  }, [box.x + box.width*0.32, box.y + box.height*0.60])
  console.log('topmost element at click pt:', topAt)

  // Click using svg locator with position (relative to svg box)
  const circlesBefore = await page.locator('svg circle').count()
  await svg.click({ position: { x: box.width*0.32, y: box.height*0.60 } }); await page.waitForTimeout(300)
  const circlesAfter = await page.locator('svg circle').count()
  console.log('circles before/after:', circlesBefore, circlesAfter)

  await page.keyboard.press('a'); await page.waitForTimeout(250)
  await svg.click({ position: { x: box.width*0.50, y: box.height*0.32 } }); await page.waitForTimeout(250)
  await svg.click({ position: { x: box.width*0.68, y: box.height*0.60 } }); await page.waitForTimeout(250)
  await page.keyboard.press('Enter'); await page.waitForTimeout(500)

  const arcInCanvas = await page.evaluate(() => {
    // only look at the takeoff drawing svg (largest svg), exclude toolbar icon svgs
    const svgs = [...document.querySelectorAll('svg')]
    const big = svgs.sort((a,b) => (b.clientWidth*b.clientHeight)-(a.clientWidth*a.clientHeight))[0]
    return [...big.querySelectorAll('path')].some(p => /[Aa][\s\d]/.test(p.getAttribute('d')||''))
  })
  const linear1 = await page.evaluate(() => {
    const m = document.body.innerText.match(/Linear 1[\s\S]{0,40}?([\d,.]+)\s*ft/)
    return m ? m[1] + ' ft' : '(not found)'
  })
  await page.screenshot({ path: path.join(OUT, 'shot-arc.png') })
  console.log('arc path in takeoff canvas:', arcInCanvas, '| Linear 1:', linear1)
  console.log('errors:', errs.length ? errs.join('\n') : '(none)')
  await browser.close()
  const ok = arcInCanvas && errs.length === 0
  console.log(`\n=== ARC CHECK: ${ok ? 'PASS' : 'FAIL'} ===`)
  process.exit(ok ? 0 : 1)
}
main().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(2) })
