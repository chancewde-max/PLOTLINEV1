const { firefox } = require('playwright')
const path = require('path')
const BASE='http://127.0.0.1:5191'
;(async()=>{
const b=await firefox.launch({headless:true})
const p=await b.newContext({viewport:{width:1440,height:1000}}).then(c=>c.newPage())
p.on('dialog',d=>d.accept())
await p.addInitScript(()=>{try{localStorage.clear()}catch{}})
await p.goto(`${BASE}/app/project/proj-1`,{waitUntil:'networkidle'})
await p.waitForSelector('text=Maple Grove Estates')
const btn=p.getByRole('button',{name:/Save as template/i})
console.log('btn count', await btn.count())
await btn.first().click(); await p.waitForTimeout(500)
console.log('dialog present', await p.locator('[role=dialog]').count())
console.log('body text snippet:', (await p.locator('[role=dialog]').innerText().catch(()=>'(none)')).slice(0,200))
const inps=await p.locator('input').allInnerTexts?.() ?? []
console.log('all inputs in dialog:', await p.locator('[role=dialog] input').count())
await b.close()
})().catch(e=>{console.error(e);process.exit(2)})
