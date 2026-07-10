const { firefox } = require('playwright')
const BASE = 'http://localhost:5196'
;(async () => {
  const b = await firefox.launch({ headless: true })
  const p = await b.newContext().then(c => c.newPage())
  const errs = []
  p.on('pageerror', e => errs.push(e.message))
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  await p.goto(`${BASE}/pricing`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  const body = await p.evaluate(() => document.body.innerText.slice(0, 500))
  console.log('BODY:', JSON.stringify(body))
  console.log('URL:', p.url())
  console.log('errs:', errs)
  await b.close()
})()
