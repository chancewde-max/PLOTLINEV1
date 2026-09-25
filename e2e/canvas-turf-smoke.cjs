const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://127.0.0.1:5173'

const results = []
function record(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`)
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME || '/usr/local/bin/google-chrome',
    headless: true,
  })
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

  // HUD +/- must update zoomTargetRef (same source as wheel/pinch)
  const hud = page.locator('[data-testid="zoom-hud"]')
  const parseHud = async () => parseInt(String(await hud.innerText()).replace(/[^\d]/g, ''), 10) || 0
  for (let i = 0; i < 12; i++) await hud.getByLabel('Zoom out').click()
  await page.waitForTimeout(80)
  const atMin = await parseHud()
  await hud.getByLabel('Zoom in').click()
  await page.waitForTimeout(80)
  const afterHudPlus = await parseHud()
  record('HUD + steps zoom from min', afterHudPlus === 50 && atMin === 25, `min=${atMin} plus=${afterHudPlus}`)
  await page.mouse.move(before.x, before.y)
  await page.mouse.wheel(0, -400)
  await page.waitForTimeout(400)
  const afterHudWheel = await parseHud()
  record('Wheel after HUD + continues from HUD zoom (not stale target)',
    afterHudWheel > 55 && afterHudWheel < 130,
    `hud=${afterHudPlus} wheel=${afterHudWheel}`)

  // Draw a soil area, inspect depth/cy + topsoil
  await page.locator('button[aria-label="Area"]').click()
  await page.waitForTimeout(200)
  // New-area dialog may open
  const nameDlg = page.getByRole('heading', { name: /New area/i })
  if (await nameDlg.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /Start drawing/i }).click()
    await page.waitForTimeout(200)
  }
  const paper = page.locator('[class*="paper"]').first()
  let pb = await paper.boundingBox()
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
    const closeHud = await page.locator('[data-testid="area-close-sqft"]').innerText().catch(() => '')
    record('Soil close shows sq ft immediately in HUD', /\d+\.\d+ sq ft/.test(closeHud), closeHud)
    record('Soil close shows inspector without later Select',
      await page.locator('[data-testid="area-inspector"]').isVisible().catch(() => false))
    const closeInsp = await page.locator('[data-testid="area-sqft"]').innerText().catch(() => '')
    record('Soil close shows inspector sq ft immediately',
      /\d+\.\d+ sq ft/.test(closeInsp) && closeInsp !== '0.0 sq ft', closeInsp)
    await page.locator('button[aria-label="Select"]').click()
    await page.mouse.click(pts[0][0] + 40, pts[0][1] + 40)
    await page.waitForTimeout(200)
  }
  const inspector = page.locator('[data-testid="area-inspector"]')
  record('Area inspector appears after selecting a drawn area', await inspector.isVisible().catch(() => false))
  if (await inspector.isVisible().catch(() => false)) {
    const sqftText = await page.locator('[data-testid="area-sqft"]').innerText().catch(() => '')
    record('Inspector shows closed-area sq ft', /\d+\.\d+ sq ft/.test(sqftText) && sqftText !== '0.0 sq ft', sqftText)
    const cyBefore = await page.locator('[data-testid="area-cy"]').innerText().catch(() => '')
    record('Inspector CY stays 0.00 until area depth is set', cyBefore === '0.00 cy', cyBefore)
    await page.getByRole('button', { name: /Quote email/i }).click()
    await page.waitForTimeout(150)
    const quoteBeforeDepth = await page.getByTestId('quote-email-body').innerText().catch(() => '')
    record('Quote scope has no CY until area depth is set',
      /sq ft/.test(quoteBeforeDepth) && !/ CY/.test(quoteBeforeDepth),
      quoteBeforeDepth.replace(/\s+/g, ' ').slice(0, 220))
    await page.keyboard.press('Escape')
    await page.getByTestId('quote-email-body').waitFor({ state: 'hidden', timeout: 3000 }).catch(async () => {
      await page.getByRole('button', { name: 'Close dialog' }).click()
    })
    await page.waitForTimeout(80)
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
    await inspector.getByPlaceholder('Topsoil type').fill('Test mix')
    await page.waitForTimeout(80)
    page.once('download', () => {})
    await page.getByTestId('mto-export').click()
    await page.waitForTimeout(200)
    const mtoNotes = await page.getByTestId('mto-last-notes').innerText().catch(() => '')
    record('Inspector depth/topsoil flows into MTO notes',
      /Depth: 12"/.test(mtoNotes) && /cy/.test(mtoNotes) && /Test mix/.test(mtoNotes),
      mtoNotes)
    await page.getByRole('button', { name: /Quote email/i }).click()
    await page.waitForTimeout(150)
    const quoteBody = await page.getByTestId('quote-email-body').innerText().catch(() => '')
    record('Quote header falls back to inspector depth/topsoil',
      /Installation depth: 12/.test(quoteBody) && /Test mix/.test(quoteBody),
      quoteBody.replace(/\s+/g, ' ').slice(0, 220))
    await page.keyboard.press('Escape')
    await page.getByTestId('quote-email-body').waitFor({ state: 'hidden', timeout: 3000 }).catch(async () => {
      await page.getByRole('button', { name: 'Close dialog' }).click()
    })
    await page.waitForTimeout(80)
  }

  // Ungrouped soil: delete the user Area 1 group so the polygon is orphaned.
  // takeoff.js must still emit it with the same description + Notes suffix.
  if (pb) {
    await page.locator('button[aria-label="Select"]').click().catch(() => {})
    await page.waitForTimeout(120)
    const area1Name = page.locator('[class*="rightPanel"]').locator('span').filter({ hasText: /^Area 1$/ })
    const area1Visible = await area1Name.isVisible().catch(() => false)
    if (area1Visible) await area1Name.locator('xpath=..').locator('button').last().click()
    record('Area 1 group deleted (orphan polygon is ungrouped)', area1Visible)
    await page.waitForTimeout(250)
    page.once('download', () => {})
    await page.getByTestId('mto-export').click()
    await page.waitForTimeout(200)
    const orphanMto = await page.getByTestId('mto-last-notes').innerText().catch(() => '')
    record('exportMTO includes orphaned soil notes',
      /Depth: 12"/.test(orphanMto) && /Test mix/.test(orphanMto),
      orphanMto)
    await page.goto(`${BASE}/app/project/proj-1`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.getByText('Essential only').click().catch(() => {})
    await page.waitForTimeout(200)
    await page.getByRole('button', { name: /^Pricebook$/ }).click()
    await page.waitForTimeout(150)
    await page.getByRole('button', { name: /Material List/i }).click()
    await page.waitForTimeout(250)
    const listText = await page.locator('body').innerText()
    record('Ungrouped soil appears in canonical takeoff Material List',
      /Area 1/.test(listText) && /Test mix/.test(listText) && /Depth: 12"/.test(listText),
      listText.includes('Test mix')
        ? 'found Area 1 + Test mix + Depth: 12" after group delete'
        : listText.replace(/\s+/g, ' ').slice(0, 500))
    await page.goto(`${BASE}/app/project/proj-1/sheet/sheet-1`, { waitUntil: 'networkidle', timeout: 45000 })
    await page.getByText('Essential only').click().catch(() => {})
    await page.waitForTimeout(600)
    pb = await page.locator('[class*="paper"]').first().boundingBox()
  }

  // Area cubic bezier (§5.1) — not turf, not circular arc.
  if (pb) {
    await page.locator('button[aria-label="Area"]').click()
    await page.waitForTimeout(200)
    const cubicDlg = page.getByRole('heading', { name: /New area/i })
    if (await cubicDlg.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /Start drawing/i }).click()
      await page.waitForTimeout(200)
    }
    const hintTool = () => page.locator('[data-testid="canvas-hint"]').getAttribute('data-active-tool')
    const hintPhase = () => page.locator('[data-testid="canvas-hint"]').getAttribute('data-curve-phase')
    const v0 = [pb.x + pb.width * 0.62, pb.y + pb.height * 0.20]
    const c1 = [pb.x + pb.width * 0.74, pb.y + pb.height * 0.08]
    const c2 = [pb.x + pb.width * 0.90, pb.y + pb.height * 0.16]
    const p1 = [pb.x + pb.width * 0.88, pb.y + pb.height * 0.36]
    const v2 = [pb.x + pb.width * 0.62, pb.y + pb.height * 0.36]
    await page.mouse.click(v0[0], v0[1])
    await page.waitForTimeout(80)
    await page.keyboard.press('a')
    await page.waitForTimeout(80)
    await page.mouse.move(c1[0], c1[1])
    await page.waitForTimeout(80)
    const bandC1 = await page.locator('[data-testid="area-draw-preview"]').getAttribute('d').catch(() => '')
    record('Live rubber-band while placing C1',
      (await hintPhase()) === 'c1' && /\sL\s/.test(bandC1 || '') && await page.locator('[data-testid="bezier-handle-ghost"]').count() > 0,
      `phase=${await hintPhase()} d=${bandC1}`)
    await page.mouse.click(c1[0], c1[1])
    await page.waitForTimeout(60)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(80)
    record('Esc keeps Area tool and prior point',
      (await hintTool()) === 'area' && (await hintPhase()) === '',
      `tool=${await hintTool()} phase=${await hintPhase()}`)
    await page.keyboard.press('a')
    await page.waitForTimeout(60)
    record('A still starts a cubic after Esc (point kept)', (await hintPhase()) === 'c1', `phase=${await hintPhase()}`)
    await page.mouse.move(c1[0], c1[1])
    await page.mouse.click(c1[0], c1[1])
    await page.waitForTimeout(60)
    await page.mouse.move(c2[0], c2[1])
    await page.waitForTimeout(60)
    const bandC2 = await page.locator('[data-testid="area-draw-preview"]').getAttribute('d').catch(() => '')
    record('Live rubber-band while placing C2',
      (await hintPhase()) === 'c2' && /\sC\s/.test(bandC2 || ''),
      `phase=${await hintPhase()} d=${bandC2}`)
    await page.mouse.click(c2[0], c2[1])
    await page.waitForTimeout(60)
    await page.mouse.move(p1[0], p1[1])
    await page.waitForTimeout(60)
    const bandP1 = await page.locator('[data-testid="area-draw-preview"]').getAttribute('d').catch(() => '')
    record('Live rubber-band while placing P1',
      (await hintPhase()) === 'p1' && /\sC\s/.test(bandP1 || '') && await page.locator('[data-testid="bezier-p1-ghost"]').count() > 0,
      `phase=${await hintPhase()} d=${bandP1}`)
    await page.mouse.click(p1[0], p1[1])
    await page.waitForTimeout(80)
    await page.mouse.click(v2[0], v2[1])
    await page.waitForTimeout(80)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)
    const cubicArea = page.locator('[data-testid="soil-area"][data-cubic-count="1"]').last()
    const cubicD = await cubicArea.locator('path').getAttribute('d').catch(() => '')
    const arcCount = await cubicArea.getAttribute('data-arc-count').catch(() => '')
    record('Closed Area uses cubic C and not a circular A',
      /\sC\s/.test(cubicD || '') && !/\sA\s/.test(cubicD || '') && arcCount === '0',
      `arcs=${arcCount} d=${cubicD}`)
    const px2 = Number(await cubicArea.getAttribute('data-area-px2'))
    const chord = Number(await cubicArea.getAttribute('data-chord-px2'))
    const insp = await page.locator('[data-testid="area-sqft"]').innerText().catch(() => '')
    const expected = `${(px2 / 16).toFixed(1)} sq ft`
    record('Closed mixed straight+cubic sq ft matches the cubic integral',
      px2 > chord + 1 && insp === expected,
      `insp=${insp} expected=${expected} px2=${px2.toFixed(1)} chord=${chord.toFixed(1)}`)
    await page.locator('button[aria-label="Select"]').click()
    await page.waitForTimeout(120)
    const diamonds = page.locator('[data-testid="bezier-handle"][data-pending="false"]')
    record('Placed cubic has editable C1/C2 diamonds', await diamonds.count() === 2, `n=${await diamonds.count()}`)
    const beforePx = px2
    const beforeInsp = insp
    const handle = diamonds.first()
    const hb = await handle.boundingBox()
    if (hb) {
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
      await page.mouse.down()
      await page.mouse.move(hb.x + hb.width / 2 + 36, hb.y + hb.height / 2 + 28)
      await page.mouse.up()
      await page.waitForTimeout(150)
    }
    const afterHandlePx = Number(await cubicArea.getAttribute('data-area-px2'))
    const afterHandleInsp = await page.locator('[data-testid="area-sqft"]').innerText().catch(() => '')
    record('Dragging C1/C2 updates the curve and live sq ft',
      Number.isFinite(afterHandlePx) && Math.abs(afterHandlePx - beforePx) > 1 && afterHandleInsp !== beforeInsp,
      `${beforePx.toFixed(1)}→${afterHandlePx.toFixed(1)} ${beforeInsp}→${afterHandleInsp}`)
    const vertex = page.locator('[data-testid="area-vertex"]').first()
    const vb = await vertex.boundingBox()
    const beforeVert = afterHandlePx
    const beforeVertInsp = afterHandleInsp
    if (vb) {
      await page.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2)
      await page.mouse.down()
      await page.mouse.move(vb.x + vb.width / 2 - 30, vb.y + vb.height / 2 + 24)
      await page.mouse.up()
      await page.waitForTimeout(150)
    }
    const afterVertPx = Number(await cubicArea.getAttribute('data-area-px2'))
    const afterVertInsp = await page.locator('[data-testid="area-sqft"]').innerText().catch(() => '')
    const stillCubic = await cubicArea.locator('path').getAttribute('d').catch(() => '')
    record('Dragging P0/P1 updates the curve and live sq ft',
      Number.isFinite(afterVertPx) && Math.abs(afterVertPx - beforeVert) > 1
      && afterVertInsp !== beforeVertInsp && /\sC\s/.test(stillCubic || ''),
      `${beforeVert.toFixed(1)}→${afterVertPx.toFixed(1)} ${beforeVertInsp}→${afterVertInsp}`)
  }

  // Exact QA repro: 100×100 px square, cubic on the right edge, C1(180,0) C2(180,100).
  // At 4 px/ft the curve is 925 sf and the chord is 625 sf. MouseEvent clientX is
  // whole pixels in this Chrome, so the click names the sheet point directly.
  if (pb) {
    const hud = page.locator('[data-testid="zoom-hud"]')
    const parseHud = async () => parseInt(String(await hud.innerText()).replace(/[^\d]/g, ''), 10) || 0
    for (let i = 0; i < 16 && await parseHud() < 90; i++) {
      await hud.getByLabel('Zoom in').click()
      await page.waitForTimeout(30)
    }
    for (let i = 0; i < 16 && await parseHud() > 140; i++) {
      await hud.getByLabel('Zoom out').click()
      await page.waitForTimeout(30)
    }
    await page.waitForTimeout(80)
    const clickSheet = async (x, y, { dbl = false } = {}) => {
      await page.evaluate(({ x, y, dbl }) => {
        const svg = [...document.querySelectorAll('svg')].find(s => (s.getAttribute('viewBox') || '').includes('-160'))
        window.__plotlineSheetPoint = { x, y }
        const fire = (type, detail) => svg.dispatchEvent(new MouseEvent(type, {
          bubbles: true, cancelable: true, view: window, button: 0,
          buttons: type === 'mousedown' ? 1 : 0, detail,
        }))
        const once = (detail) => { fire('mousedown', detail); fire('mouseup', detail); fire('click', detail) }
        once(1)
        if (dbl) { once(2); fire('dblclick', 2) }
        window.__plotlineSheetPoint = null
      }, { x, y, dbl })
    }
    await page.locator('button[aria-label="Area"]').click()
    await page.waitForTimeout(200)
    const reproDlg = page.getByRole('heading', { name: /New area/i })
    if (await reproDlg.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /Start drawing/i }).click()
      await page.waitForTimeout(200)
    }
    const phase = () => page.locator('[data-testid="canvas-hint"]').getAttribute('data-curve-phase')
    await clickSheet(0, 0)
    await page.waitForTimeout(60)
    await clickSheet(100, 0)
    await page.waitForTimeout(60)
    await page.keyboard.press('a')
    await page.waitForTimeout(60)
    await clickSheet(180, 0)
    await page.waitForTimeout(60)
    await clickSheet(180, 100)
    await page.waitForTimeout(60)
    await clickSheet(100, 0)
    await page.waitForTimeout(80)
    record('P1 on P0 is ignored and the cubic stays in progress', (await phase()) === 'p1', `phase=${await phase()}`)
    await clickSheet(100, 100)
    await page.waitForTimeout(60)
    await clickSheet(0, 100)
    await page.waitForTimeout(60)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(250)
    const reproArea = () => page.locator('[data-testid="soil-area"]').evaluateAll((nodes) => {
      const hit = nodes
        .map(n => ({
          count: n.getAttribute('data-cubic-count'),
          px2: Number(n.getAttribute('data-area-px2')),
        }))
        .filter(n => Number.isFinite(n.px2) && Math.abs(n.px2 - 14800) < 1)
      return hit[0] || null
    })
    const drawn = await reproArea()
    const drawnInsp = await page.locator('[data-testid="area-sqft"]').innerText().catch(() => '')
    record('Inspector sq ft of the bulged square is 925',
      !!drawn && drawn.count === '1' && drawnInsp === '925.0 sq ft',
      `insp=${drawnInsp} area=${JSON.stringify(drawn)}`)
    await page.locator('button[aria-label="Region count"]').click()
    await page.waitForTimeout(150)
    const uShape = [[-50, -50], [20, -50], [20, 50], [80, 50], [80, -50], [250, -50], [250, 250], [-50, 250]]
    for (const [x, y] of uShape) {
      await clickSheet(x, y)
      await page.waitForTimeout(40)
    }
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)
    const uLabels = await page.locator('[data-testid="region-area-label"]').evaluateAll((nodes) =>
      nodes.map(n => ({ sqft: Number(n.getAttribute('data-sqft')), text: n.textContent })))
    const uPanel = await page.locator('[data-testid="region-folder-sqft"]').evaluateAll((nodes) =>
      nodes.map(n => ({ sqft: Number(n.getAttribute('data-sqft')), text: n.textContent })))
    const nearest5 = (n) => String(Math.round(n / 5) * 5)
    const near737 = (row) => row && Number.isFinite(row.sqft) && Math.abs(row.sqft - 737.5) < 1
      && String(row.text).includes(nearest5(row.sqft))
      && !String(row.text).includes('737.5')
    record('Concave U region clips the bulge to about 737.5 sf',
      uLabels.some(near737) && uPanel.some(near737),
      `labels=${JSON.stringify(uLabels)} panel=${JSON.stringify(uPanel)}`)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    record('Deselected area has no vertex handles', await page.locator('[data-testid="area-vertex"]').count() === 0)
    await clickSheet(180, 0)
    await page.waitForTimeout(150)
    record('Hidden C1 on an unselected area is not hit-testable',
      await page.locator('[data-testid="area-vertex"]').count() === 0
      && await page.locator('[data-testid="bezier-handle"][data-pending="false"]').count() === 0)
    // The miss above arms a zero-size marquee; its mouseup only sees that box
    // after the next press. Clear it before the bulge click.
    await clickSheet(-120, -120)
    await page.waitForTimeout(120)
    await clickSheet(140, 50)
    await page.waitForTimeout(200)
    record('Click in the bulge selects the area',
      await page.locator('[data-testid="area-vertex"]').count() === 4,
      `verts=${await page.locator('[data-testid="area-vertex"]').count()}`)
    await clickSheet(100, 50, { dbl: true })
    await page.waitForTimeout(200)
    const afterChord = await reproArea()
    const afterChordInsp = await page.locator('[data-testid="area-sqft"]').innerText().catch(() => '')
    record('Dbl-click on the chord inside the bulge does not drop the curve',
      !!afterChord && afterChord.count === '1' && afterChordInsp === '925.0 sq ft',
      `insp=${afterChordInsp} area=${JSON.stringify(afterChord)}`)
    // 4px inside the apex, still within the edge threshold, so the click is on the curve.
    await clickSheet(156, 50, { dbl: true })
    await page.waitForTimeout(250)
    const afterSplit = await reproArea()
    const afterSplitInsp = await page.locator('[data-testid="area-sqft"]').innerText().catch(() => '')
    record('Dbl-click on the curve splits it and keeps 925 sf',
      !!afterSplit && afterSplit.count === '2' && afterSplitInsp === '925.0 sq ft',
      `insp=${afterSplitInsp} area=${JSON.stringify(afterSplit)}`)
    await page.locator('button[aria-label="Region count"]').click()
    await page.waitForTimeout(200)
    for (const [x, y] of [[-50, -50], [250, -50], [250, 250], [-50, 250]]) {
      await clickSheet(x, y)
      await page.waitForTimeout(60)
    }
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    const labels = await page.locator('[class*="areaLabel"]').allInnerTexts().catch(() => [])
    const panel = await page.locator('aside').last().innerText().catch(() => '')
    record('Region enclosing the bulge shows 925 sf',
      labels.some(t => t.replace(/\s+/g, ' ').includes('925 sq ft')) || /925 sf/.test(panel),
      `labels=${JSON.stringify(labels)} panel=${panel.replace(/\s+/g, ' ').slice(0, 400)}`)
    await page.locator('button[aria-label="Area"]').click()
    await page.waitForTimeout(150)
    const shortDlg = page.getByRole('heading', { name: /New area/i })
    if (await shortDlg.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /Start drawing/i }).click()
      await page.waitForTimeout(150)
    }
    for (let i = 0; i < 40 && await parseHud() < 400; i++) {
      await hud.getByLabel('Zoom in').click()
      await page.waitForTimeout(20)
    }
    await clickSheet(420, 420)
    await page.waitForTimeout(40)
    await page.keyboard.press('a')
    await page.waitForTimeout(40)
    await clickSheet(428, 400)
    await page.waitForTimeout(30)
    await clickSheet(428, 440)
    await page.waitForTimeout(30)
    await clickSheet(428, 420)
    await page.waitForTimeout(50)
    const shortPhase = await phase()
    const shortZoom = await parseHud()
    await clickSheet(428, 460)
    await page.waitForTimeout(30)
    await clickSheet(420, 460)
    await page.waitForTimeout(30)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)
    record('High zoom short cubic P1 finishes',
      shortPhase !== 'p1' && shortZoom >= 400,
      `phase=${shortPhase} zoom=${shortZoom}`)
    for (let i = 0; i < 40; i++) {
      const z = await parseHud()
      if (z >= 95 && z <= 130) break
      await hud.getByLabel(z > 130 ? 'Zoom out' : 'Zoom in').click()
      await page.waitForTimeout(20)
    }
    await page.evaluate(() => { window.__plotlineSheetPoint = null })
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
    record('After close, stamp mode is hinted',
      await page.getByRole('tab', { name: 'Stamp rolls' }).getAttribute('aria-selected').then(v => v === 'true').catch(() => false)
      || await page.getByText(/Stamp rolls/i).first().isVisible().catch(() => false))
    await page.getByRole('tab', { name: 'Stamp rolls' }).click().catch(() => {})
    // R in stamp = rotate hold, must not switch to Region (hk.region defaults to R)
    await page.locator('[data-testid="turf-panel"]').click()
    await page.waitForTimeout(80)
    await page.keyboard.down('r')
    await page.waitForTimeout(80)
    const stampTool = await page.locator('[data-testid="canvas-hint"]').getAttribute('data-active-tool')
    const stampMode = await page.locator('[data-testid="canvas-hint"]').getAttribute('data-turf-submode')
    record('R in turf stamp does not steal Region tool', stampTool === 'turf' && stampMode === 'stamp',
      `tool=${stampTool} submode=${stampMode}`)
    await page.keyboard.up('r')
    await page.keyboard.press('a')
    await page.waitForTimeout(80)
    const afterA = await page.locator('[data-testid="canvas-hint"]').getAttribute('data-active-tool')
    record('A in turf stamp does not steal soil Area tool', afterA === 'turf', `tool=${afterA}`)
    const widthInput = page.getByLabel('Roll width')
    record('Width input is free-form (no max)', await widthInput.evaluate((el) => el.max === '').catch(() => false))
    await widthInput.fill('8')
    await page.getByLabel('Roll length').fill('12')
    await page.getByLabel('Roll rotation').fill('0')
    const cov = await page.locator('[data-testid="turf-panel"]').innerText()
    record('Coverage panel shows rolls / coverage fields',
      /Area sq ft/.test(cov) && /Rolls placed/.test(cov) && /Coverage %/.test(cov) && /Gaps/.test(cov),
      cov.slice(0, 180))
    record('Core coverage metrics present',
      /Area sq ft/.test(cov) && /Rolls placed/.test(cov) && /Covered sq ft/.test(cov) && /Coverage %/.test(cov) && /Gaps/.test(cov),
      cov.slice(0, 220))
    record('Free-form roll size shown', /8 × 12 ft/.test(cov), cov.slice(0, 220))

    await widthInput.fill('5')
    await page.getByLabel('Roll length').fill('6')
    const stampCandidates = [
      [pb.x + pb.width * 0.45, pb.y + pb.height * 0.75],
      [pb.x + pb.width * 0.38, pb.y + pb.height * 0.72],
      [pb.x + pb.width * 0.50, pb.y + pb.height * 0.78],
      [pb.x + pb.width * 0.42, pb.y + pb.height * 0.68],
    ]
    for (const [x, y] of stampCandidates) {
      await page.mouse.move(x, y)
      await page.waitForTimeout(80)
      await page.mouse.click(x, y)
      await page.waitForTimeout(150)
      if (await page.locator('[data-testid="turf-roll"]').count() > 0) break
    }

    const firstRoll = page.locator('[data-testid="turf-roll"]').first()
    const placedFirst = await page.locator('[data-testid="turf-roll"]').count() > 0
    record('First stamp placed', placedFirst)
    const handle = firstRoll.locator('circle').first()
    const hb = placedFirst ? await handle.boundingBox() : null
    const firstBox = placedFirst ? await firstRoll.boundingBox() : null
    if (hb && firstBox) {
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
      await page.mouse.down()
      await page.mouse.move(firstBox.x + firstBox.width + 30, firstBox.y + firstBox.height * 0.15)
      await page.mouse.up()
      await page.waitForTimeout(150)
    }
    if (!placedFirst) {
      record('Free-rotate after place changes angle (no sticky lock)', false, 'no first roll')
      record('Adjacent preview inherits neighbor angle + flush', false, 'no first roll')
      record('Second stamp locks at inherited neighbor angle', false, 'no first roll')
    } else {
    const neighborRot = Number(await firstRoll.getAttribute('data-rotation'))
    record('Free-rotate after place changes angle (no sticky lock)', Number.isFinite(neighborRot) && Math.abs(neighborRot) > 5, `rot=${neighborRot}`)
    // Rotate uses mouseup-without-click, so the next canvas click is ignored.
    await page.mouse.click(pb.x + 8, pb.y + 8)
    await page.waitForTimeout(80)
    await page.getByLabel('Roll rotation').fill('0')
    await page.waitForTimeout(80)

    const seats = await page.evaluate(() => {
      const g = document.querySelector('[data-testid="turf-roll"]')
      const poly = g?.querySelector('polygon')
      const svg = poly?.ownerSVGElement
      if (!poly || !svg) return []
      const pts = poly.getAttribute('points').trim().split(/\s+/).map((pair) => {
        const [x, y] = pair.split(',').map(Number)
        return { x, y }
      })
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
      const toScreen = (x, y) => {
        const pt = svg.createSVGPoint()
        pt.x = x
        pt.y = y
        const s = pt.matrixTransform(poly.getScreenCTM())
        return { x: s.x, y: s.y }
      }
      return pts.map((a, i) => {
        const b = pts[(i + 1) % pts.length]
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        return toScreen(cx + 2 * (mx - cx), cy + 2 * (my - cy))
      })
    })
    let inheritHint = false
    let inheritClick = null
    let inheritHintText = ''
    for (const seat of seats) {
      await page.mouse.move(seat.x, seat.y)
      await page.waitForTimeout(60)
      const hint = await page.locator('[data-testid="canvas-hint"]').innerText().catch(() => '')
      const preview = await page.locator('[data-testid="turf-roll-preview"]').first()
      const snapped = await preview.getAttribute('data-snapped').catch(() => 'false')
      const prevRot = await preview.getAttribute('data-rotation').catch(() => '')
      if (snapped === 'true' && Math.abs(Number(prevRot) - neighborRot) < 0.2) {
        inheritHint = true
        inheritHintText = hint
        inheritClick = [seat.x, seat.y]
        break
      }
    }
    record('Adjacent preview inherits neighbor angle + flush', inheritHint,
      inheritHintText.slice(0, 140) || `seats=${seats.length} neighbor=${neighborRot}`)
    const highlighted = inheritHint
      ? await page.locator('[data-testid="turf-roll"][data-snap-target="true"]').count().catch(() => 0)
      : 0
    record('Hover preview highlights the winning neighbor', highlighted === 1, `targets=${highlighted}`)
    if (inheritClick) {
      const lockPt = await page.evaluate(() => {
        const poly = document.querySelector('[data-testid="turf-roll-preview"]')
        const svg = poly?.ownerSVGElement
        if (!poly || !svg) return null
        const pts = poly.getAttribute('points').trim().split(/\s+/).map((pair) => {
          const [x, y] = pair.split(',').map(Number)
          return { x, y }
        })
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
        const pt = svg.createSVGPoint()
        pt.x = cx
        pt.y = cy
        const s = pt.matrixTransform(poly.getScreenCTM())
        return { x: s.x, y: s.y }
      })
      const target = lockPt || { x: inheritClick[0], y: inheritClick[1] }
      await page.mouse.click(target.x, target.y)
      await page.waitForTimeout(250)
    }
    const rots = await page.locator('[data-testid="turf-roll"]').evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-rotation'))))
    record('Second stamp locks at inherited neighbor angle',
      rots.length >= 2 && rots.slice(1).some((r) => Math.abs(r - neighborRot) < 0.15),
      JSON.stringify(rots))

    // Hold-R rotate on the roll body while still in stamp (must stay on turf)
    const rollBox = await firstRoll.boundingBox()
    if (rollBox) {
      const beforeRot = Number(await firstRoll.getAttribute('data-rotation'))
      await page.locator('[data-testid="turf-panel"]').click()
      await page.waitForTimeout(60)
      await page.keyboard.down('r')
      await page.mouse.move(rollBox.x + rollBox.width * 0.45, rollBox.y + rollBox.height * 0.45)
      await page.mouse.down()
      await page.mouse.move(rollBox.x + rollBox.width + 40, rollBox.y + 10)
      await page.mouse.up()
      await page.keyboard.up('r')
      await page.waitForTimeout(120)
      const afterRot = Number(await firstRoll.getAttribute('data-rotation'))
      const stillTurf = await page.locator('[data-testid="canvas-hint"]').getAttribute('data-active-tool')
      record('Hold-R rotates stamp without leaving turf',
        stillTurf === 'turf' && Number.isFinite(afterRot) && Math.abs(afterRot - beforeRot) > 2,
        `tool=${stillTurf} ${beforeRot}→${afterRot}`)
    }

    await page.locator('button[aria-label="Select"]').click()
    await page.waitForTimeout(80)
    const beforeCx = Number(await firstRoll.getAttribute('data-cx'))
    const turfBox = await page.locator('[data-testid="turf-area"]').first().boundingBox()
    if (turfBox && Number.isFinite(beforeCx)) {
      await page.mouse.move(turfBox.x + 36, turfBox.y + 22)
      await page.mouse.down()
      await page.mouse.move(turfBox.x + 96, turfBox.y + 22)
      await page.mouse.up()
      await page.waitForTimeout(120)
      const afterCx = Number(await page.locator('[data-testid="turf-roll"]').first().getAttribute('data-cx'))
      record('Moving turf polygon moves child stamps', Number.isFinite(afterCx) && Math.abs(afterCx - beforeCx) > 2,
        `${beforeCx}→${afterCx}`)
    }
    }

    // Persist circular-arc segs on turf close (same as soil finishArea)
    await page.locator('button[aria-label="Synthetic turf"]').click()
    await page.waitForTimeout(120)
    await page.getByRole('tab', { name: 'Draw area' }).click()
    await page.waitForTimeout(120)
    const arcPts = [
      [pb.x + pb.width * 0.22, pb.y + pb.height * 0.18],
      [pb.x + pb.width * 0.38, pb.y + pb.height * 0.12],
      [pb.x + pb.width * 0.48, pb.y + pb.height * 0.28],
      [pb.x + pb.width * 0.22, pb.y + pb.height * 0.32],
    ]
    await page.mouse.click(arcPts[0][0], arcPts[0][1])
    await page.waitForTimeout(80)
    await page.keyboard.press('a')
    await page.waitForTimeout(60)
    await page.mouse.click(arcPts[1][0], arcPts[1][1])
    await page.waitForTimeout(80)
    await page.mouse.click(arcPts[2][0], arcPts[2][1])
    await page.waitForTimeout(80)
    await page.mouse.click(arcPts[3][0], arcPts[3][1])
    await page.keyboard.press('Enter')
    await page.waitForTimeout(250)
    const arcCounts = await page.locator('[data-testid="turf-area"]').evaluateAll((els) =>
      els.map((el) => Number(el.getAttribute('data-arc-count') || 0)))
    record('Turf close persists circular-arc segments', arcCounts.some((n) => n > 0),
      JSON.stringify(arcCounts))
  }

  // Outside stamp, R still opens Region (deselect roll first — selected roll also holds R)
  await page.locator('button[aria-label="Select"]').click()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(80)
  await page.mouse.click(pb ? pb.x + 16 : 200, pb ? pb.y + 16 : 200)
  await page.waitForTimeout(80)
  await page.keyboard.press('r')
  await page.waitForTimeout(80)
  const regionTool = await page.locator('[data-testid="canvas-hint"]').getAttribute('data-active-tool')
  record('R outside stamp still selects Region tool', regionTool === 'region', `tool=${regionTool}`)

  // Sheet save is 400ms and app data hits localStorage 500ms after that.
  await page.waitForTimeout(1000)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText('Essential only').click().catch(() => {})
  await page.waitForTimeout(700)
  const reloaded = await page.locator('[data-testid="soil-area"]').evaluateAll((nodes) => {
    const hit = nodes
      .map(n => ({
        count: Number(n.getAttribute('data-cubic-count') || 0),
        px2: Number(n.getAttribute('data-area-px2')),
      }))
      .find(n => Number.isFinite(n.px2) && Math.abs(n.px2 - 14800) < 1 && n.count >= 1)
    return hit || null
  }).catch(() => null)
  await page.locator('button[aria-label="Select"]').click()
  await page.waitForTimeout(150)
  await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find(s => (s.getAttribute('viewBox') || '').includes('-160'))
    window.__plotlineSheetPoint = { x: 50, y: 50 }
    const fire = (type) => svg.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true, view: window, button: 0,
      buttons: type === 'mousedown' ? 1 : 0, detail: 1,
    }))
    fire('mousedown'); fire('mouseup'); fire('click')
    window.__plotlineSheetPoint = null
  })
  await page.waitForTimeout(250)
  const reloadedInsp = await page.locator('[data-testid="area-sqft"]').innerText().catch(() => '')
  record('Save and reload keeps the cubic segments and 925 sf',
    !!reloaded && reloaded.count >= 1 && reloadedInsp === '925.0 sq ft',
    `area=${JSON.stringify(reloaded)} insp=${reloadedInsp}`)

  // Release a region-vertex drag over the right panel. The canvas mouseup
  // never fires there; the window listener has to save, restore labels, and
  // publish the exact clip.
  {
    const fresh = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const page2 = await fresh.newPage()
    await page2.goto(`${BASE}/app/project/proj-1/sheet/sheet-1`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    const hud = page2.locator('[data-testid="zoom-hud"]')
    await hud.getByRole('button', { name: 'Zoom in' }).waitFor({ timeout: 20000 })
    await page2.getByText('Essential only').click().catch(() => {})
    await page2.locator('button[aria-label="Region count"]').click()
    await page2.waitForTimeout(200)
    const clickSheet = async (x, y) => {
      await page2.evaluate(({ x, y }) => {
        const svg = [...document.querySelectorAll('svg')].find(s => (s.getAttribute('viewBox') || '').includes('-160'))
        window.__plotlineSheetPoint = { x, y }
        const fire = (type) => svg.dispatchEvent(new MouseEvent(type, {
          bubbles: true, cancelable: true, view: window, button: 0,
          buttons: type === 'mousedown' ? 1 : 0, detail: 1,
        }))
        fire('mousedown'); fire('mouseup'); fire('click')
        window.__plotlineSheetPoint = null
      }, { x, y })
    }
    for (const [x, y] of [[80, 60], [750, 60], [750, 450], [80, 400]]) {
      await clickSheet(x, y)
      await page2.waitForTimeout(40)
    }
    await page2.keyboard.press('Enter')
    await page2.waitForTimeout(400)
    await page2.getByRole('button', { name: '+ Region' }).click()
    await page2.waitForTimeout(200)
    await page2.getByText('Region 1', { exact: true }).click()
    await page2.waitForTimeout(400)
    const rockSqft = () => page2.locator('[data-testid="region-folder-sqft"]').evaluateAll((nodes) => {
      const rock = nodes.find(n => /rock/i.test(n.parentElement?.innerText || ''))
      return rock ? Number(rock.getAttribute('data-sqft')) : null
    })
    const beforeRock = await rockSqft()
    const beforeLabels = await page2.locator('[data-testid="region-area-label"]').count()
    const fitHandle = async () => {
      for (let i = 0; i < 8; i++) {
        const visible = await page2.evaluate(() => {
          const hit = [...document.querySelectorAll('[data-testid="region-vertex"]')]
            .find(el => Math.abs(Number(el.getAttribute('data-x')) - 750) < 1
              && Math.abs(Number(el.getAttribute('data-y')) - 450) < 1)
          const main = document.querySelector('main')
          if (!hit || !main) return false
          const b = hit.getBoundingClientRect()
          const m = main.getBoundingClientRect()
          const x = b.x + b.width / 2
          const y = b.y + b.height / 2
          return x > m.left + 8 && x < m.right - 8 && y > m.top + 8 && y < m.bottom - 8
        })
        if (visible) return true
        await hud.getByRole('button', { name: 'Zoom out' }).click()
        await page2.waitForTimeout(40)
      }
      return false
    }
    await fitHandle()
    const handle = await page2.evaluate(() => {
      const hit = [...document.querySelectorAll('[data-testid="region-vertex"]')]
        .find(el => Math.abs(Number(el.getAttribute('data-x')) - 750) < 1
          && Math.abs(Number(el.getAttribute('data-y')) - 450) < 1)
      const b = hit.getBoundingClientRect()
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    })
    const dest = await page2.evaluate(() => {
      const svg = [...document.querySelectorAll('svg')].find(s => (s.getAttribute('viewBox') || '').includes('-160'))
      const rect = svg.getBoundingClientRect()
      const vb = svg.viewBox.baseVal
      return {
        x: rect.left + ((690 - vb.x) / vb.width) * rect.width,
        y: rect.top + ((530 - vb.y) / vb.height) * rect.height,
      }
    })
    const panel = await page2.locator('aside').boundingBox()
    const release = { x: panel.x + panel.width * 0.55, y: panel.y + 120 }
    await page2.evaluate(() => {
      window.__plotlineCountSheetCommits = true
      window.__plotlineSheetCommits = 0
    })
    await page2.mouse.move(handle.x, handle.y)
    await page2.mouse.down()
    await page2.mouse.move(dest.x, dest.y)
    await page2.waitForTimeout(80)
    const duringLabels = await page2.locator('[data-testid="region-area-label"]').count()
    const duringRock = await rockSqft()
    await page2.evaluate(() => { window.__plotlineSheetCommits = 0 })
    await page2.mouse.move(release.x, release.y)
    await page2.mouse.up()
    await page2.waitForTimeout(900)
    const mouseupCommits = await page2.evaluate(() => window.__plotlineSheetCommits)
    const afterLabels = await page2.locator('[data-testid="region-area-label"]').count()
    const afterRock = await rockSqft()
    const verts = await page2.locator('[data-testid="region-vertex"]').evaluateAll((nodes) =>
      nodes.map(n => ({ x: Number(n.getAttribute('data-x')), y: Number(n.getAttribute('data-y')) })))
    const dragged = verts.find(v => Math.hypot(v.x - 690, v.y - 530) < 8)
    const stuck = verts.some(v => Math.hypot(v.x - 750, v.y - 450) < 1)
    const saved = await page2.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('plotline-appdata') || 'null')
      const polys = d?.sheets?.['sheet-1']?.regionPolys || {}
      return Object.values(polys).flat()
    })
    const savedHit = saved.some(p => p && Math.hypot(p.x - 690, p.y - 530) < 8)
    const savedStuck = saved.some(p => p && Math.hypot(p.x - 750, p.y - 450) < 1)
    let csvRock = null
    try {
      const [download] = await Promise.all([
        page2.waitForEvent('download', { timeout: 8000 }),
        page2.getByRole('button', { name: 'Export MTO' }).click(),
      ])
      const csv = require('fs').readFileSync(await download.path(), 'utf8')
      const row = csv.split('\n').find(line => /rock/i.test(line))
      const cells = row ? row.split(',').map(c => c.replace(/^"|"$/g, '')) : []
      csvRock = Number(cells[4])
    } catch (err) {
      csvRock = NaN
    }
    const pass = beforeLabels > 0
      && duringLabels === 0
      && duringRock === beforeRock
      && afterLabels > 0
      && !!dragged
      && !stuck
      && savedHit
      && !savedStuck
      && Number.isFinite(afterRock)
      && Math.abs(afterRock - beforeRock) > 1
      && csvRock === Math.round(afterRock)
    record('Region vertex released outside the canvas commits the polygon', pass,
      `labels ${beforeLabels}->${duringLabels}->${afterLabels} rock ${beforeRock}->${duringRock}->${afterRock} csv=${csvRock} mouseupCommits=${mouseupCommits} vert=${dragged ? dragged.x.toFixed(2) + ',' + dragged.y.toFixed(2) : 'missing'} savedHit=${savedHit}`)
    console.log(`OUTSIDE_RELEASE mouseupCommits=${mouseupCommits} rockBefore=${beforeRock} rockAfter=${afterRock} csv=${csvRock}`)
    await fresh.close()
  }

  record('No console/page errors', consoleErrors.length === 0 && pageErrors.length === 0,
    `console=${consoleErrors.length} page=${pageErrors.length} ${consoleErrors[0] || pageErrors[0] || ''}`)

  const failed = results.filter((x) => !x.pass)
  console.log(`\n=== ${failed.length === 0 ? 'ALL PASS' : 'FAILURES: ' + failed.length} ===`)
  if (failed.length) console.log('FAILED: ' + failed.map((f) => f.name).join(' | '))
  const fs = require('fs')
  if (failed.length === 0 && fs.existsSync('/opt/cursor/artifacts')) {
    await page.screenshot({ path: '/opt/cursor/artifacts/turf_adjacent_inherit_flush.png' })
  }
  await browser.close()
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error('SCRIPT ERROR:', e); process.exit(2) })
