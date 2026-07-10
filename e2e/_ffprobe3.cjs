const { firefox } = require('playwright')
;(async () => {
  const b = await firefox.launch({ headless: true })
  const p = await b.newPage()
  console.log('goto commit...')
  try {
    await p.goto('http://127.0.0.1:5215/', { waitUntil: 'commit', timeout: 20000 })
    console.log('committed, url=', p.url())
  } catch(e){ console.log('goto err:', e.message) }
  for (let i=0;i<5;i++){
    await p.waitForTimeout(1000)
    try {
      const t = await p.evaluate(()=>document.readyState+'|'+(document.body?document.body.childElementCount:-1))
      console.log('t'+i+':', t)
    } catch(e){ console.log('t'+i+' eval err:', e.message) }
  }
  await b.close()
  console.log('DONE')
})().catch(e => { console.error('ERR:', e.message); process.exit(1) })
