import { nextSheetsAfterUpdate } from '../src/data/sheetUpdate.js'

const base = {
  'sheet-1': { id: 'sheet-1', name: 'Maple Grove', projectId: 'proj-1' },
  'sheet-2': { id: 'sheet-2', name: 'Other', projectId: 'proj-1' },
}

let failed = 0
function check(name, pass, detail) {
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`)
  if (!pass) failed += 1
}

const ids = ['missing-sheet-xyz', '__proto__', 'constructor', 'toString']
for (const id of ids) {
  const next = nextSheetsAfterUpdate(base, id, { name: 'should-not-stick' })
  const own = Object.hasOwn(next, id)
  check(
    `nextSheetsAfterUpdate('${id}') returns the same state`,
    next === base && !own,
    `same=${next === base} own=${own}`,
  )
}

const updated = nextSheetsAfterUpdate(base, 'sheet-1', { name: 'Renamed' })
check(
  'nextSheetsAfterUpdate writes an own sheet',
  updated !== base
    && updated['sheet-1'].name === 'Renamed'
    && updated['sheet-1'].projectId === 'proj-1'
    && updated['sheet-2'] === base['sheet-2'],
  `same=${updated === base} name=${updated['sheet-1'] && updated['sheet-1'].name}`,
)

console.log(`\n=== ${failed === 0 ? 'ALL PASS' : 'FAILURES: ' + failed} ===`)
process.exit(failed === 0 ? 0 : 1)
