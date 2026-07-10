// Generate a sample MTO .xlsx using the headers from the spec
// (Part #, Desc, Qty, UOM, Unit Cost, Total) to verify heuristic auto-mapping.
const XLSX = require('xlsx')
const path = require('path')

const out = path.join(__dirname, 'sample-mto.xlsx')
const data = [
  { 'Part #': 'TURF-1', Desc: 'Sod 2" Kentucky Bluegrass', Qty: 1200, UOM: 'SF', 'Unit Cost': 0.85, Total: 1020 },
  { 'Part #': 'TREE-7', Desc: 'Autumn Blaze Maple 2.5" cal', Qty: 14, UOM: 'EA', 'Unit Cost': 185, Total: 2590 },
  { 'Part #': 'IRR-3', Desc: 'Rain Bird 5004 Rotor', Qty: 32, UOM: 'EA', 'Unit Cost': 18.5, Total: 592 },
  { 'Part #': 'MULCH-2', Desc: 'Shredded Hardwood Mulch', Qty: 60, UOM: 'CY', 'Unit Cost': 42, Total: 2520 },
]
const ws = XLSX.utils.json_to_sheet(data)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'MTO')
XLSX.writeFile(wb, out)

const back = XLSX.readFile(out)
const rows = XLSX.utils.sheet_to_json(back.Sheets[back.SheetNames[0]], { defval: '' })
console.log('Wrote', out)
console.log('Headers:', Object.keys(rows[0]).join(', '))
console.log('Rows:', rows.length)
