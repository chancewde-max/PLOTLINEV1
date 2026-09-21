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
