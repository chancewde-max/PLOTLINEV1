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
  const pdfDataUrl = 'data:application/pdf;base64,' + fs.readFileSync(PDF_PATH).toString('base64')

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await ctx.newPage()
  const consoleErrors = [], pageErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message))

  // Seed a project + a sheet carrying a real (portrait A4, non-900:620-aspect) PDF,
  // bypassing the multi-step upload wizard so we can test the render fix directly.
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.evaluate((pdfUrl) => {
    const snapshot = {
      v: '6',
      projects: {
        'test-proj': {
          id: 'test-proj', name: 'Autosize Test', client: 'Test Client', status: 'draft',
          sheetIds: ['test-sheet'], proposalVersions: [], mtoVersions: [],
        },
      },
      sheets: {
        'test-sheet': {
          id: 'test-sheet', projectId: 'test-proj', name: 'A4 Portrait Sheet',
          pdfUrl,
          savedCountGroups: [], savedAreaGroups: [], savedLinearGroups: [],
          savedAreas: [], savedLines: [], savedTextAnnotations: [],
        },
      },
      clients: {}, mtoTemplates: {}, proposalTemplates: {}, phrases: {},
      pdfAssets: {}, vendors: {},
      company: { name: '', address: '', phone: '', email: '', logoDataUrl: '' },
    }
    localStorage.setItem('plotline-appdata', JSON.stringify(snapshot))
  }, pdfDataUrl)

  await page.goto(`${BASE}/app/project/test-proj/sheet/test-sheet`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('canvas', { timeout: 15000 })
  await page.getByText('Essential only').click().catch(() => {})
  // Let PdfCanvas render + the aspect-corrected re-layout settle.
  await page.waitForTimeout(1500)

  // ---- Measure the rendered "paper" box vs the desk margin ----
  const paperBox = await page.evaluate(() => {
    const el = document.querySelector('[class*="paper"]')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { w: r.width, h: r.height }
  })
  record('Paper element found', !!paperBox, JSON.stringify(paperBox))
  if (paperBox) {
    const aspect = paperBox.w / paperBox.h
    // A4 portrait = 595/842 = 0.707
    record('Paper aspect matches real A4 portrait page (~0.707)', Math.abs(aspect - 0.707) < 0.03, `got ${aspect.toFixed(3)}`)
  }

  // Canvas (the actual PDF raster) should fill the paper almost exactly — no
  // letterbox gap remaining once aspect-corrected.
  const canvasBox = await page.evaluate(() => {
    const el = document.querySelector('canvas')
    const r = el.getBoundingClientRect()
    return { w: r.width, h: r.height }
  })
  if (paperBox && canvasBox) {
    const wDiff = Math.abs(canvasBox.w - paperBox.w) / paperBox.w
    const hDiff = Math.abs(canvasBox.h - paperBox.h) / paperBox.h
    record('Canvas fills paper with no visible letterbox gap', wDiff < 0.03 && hDiff < 0.03,
      `paper=${JSON.stringify(paperBox)} canvas=${JSON.stringify(canvasBox)}`)
  }

  await page.screenshot({ path: path.join(__dirname, '..', '.tmp-autosize-screenshot.png') })

  // ---- Off-sheet placement: switch to Count tool, click well outside the paper (in the margin) ----
  await page.locator('button[aria-label="Count"]').click().catch(() => {})
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: /^Start counting$/i }).click().catch(() => {})
  await page.waitForTimeout(200)
  const svg = page.locator('svg[class*="svg"]').first()
  const svgBox = await svg.boundingBox()
  // Click near the top-left corner of the enlarged svg (desk margin), well
  // outside where the paper itself is rendered.
  await page.mouse.click(svgBox.x + 5, svgBox.y + 5)
  await page.waitForTimeout(1500)
  const countAfterOffPlacement = await page.evaluate(() => {
    const raw = localStorage.getItem('plotline-appdata')
    const d = JSON.parse(raw)
    return (d.sheets['test-sheet'].savedCountGroups || []).reduce((s, g) => s + (g.points || []).length, 0)
  })
  record('Off-sheet count placement saved (margin click accepted)', countAfterOffPlacement >= 1, `count=${countAfterOffPlacement}`)

  // Also place one clearly ON the page for a baseline/regression check.
  const paperEl = await page.locator('[class*="paper"]').first().boundingBox()
  await page.mouse.click(paperEl.x + paperEl.width / 2, paperEl.y + paperEl.height / 2)
  await page.waitForTimeout(1500)
  const countAfterOnPlacement = await page.evaluate(() => {
    const raw = localStorage.getItem('plotline-appdata')
    const d = JSON.parse(raw)
    return (d.sheets['test-sheet'].savedCountGroups || []).reduce((s, g) => s + (g.points || []).length, 0)
  })
  record('On-sheet count placement also saved', countAfterOnPlacement === countAfterOffPlacement + 1, `count=${countAfterOnPlacement}`)

  // ---- Reload and confirm both markers render at consistent screen positions ----
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('canvas', { timeout: 15000 })
  await page.waitForTimeout(1500)
  const dotsAfterReload = await page.evaluate(() => document.querySelectorAll('circle').length)
  record('Both count markers still render after reload', dotsAfterReload >= 2, `circles=${dotsAfterReload}`)

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
