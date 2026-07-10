// Generate a tiny sample MTO .xlsx to confirm SheetJS round-trips end-to-end.
const XLSX = require('xlsx')
const path = require('path')

const a = path.join(__dirname, 'sample-mto.xlsx')
const data = [
  { Item: 'TURF-1', Description: 'Sod 2" Kentucky Bluegrass', Qty: 1200, Unit: 'SF', 'Unit Price': 0.85, Total: 1020 },
  { Item: 'TREE-7', Description: 'Autumn Blaze Maple 2.5" cal', Qty: 14, Unit: 'EA', 'Unit Price': 185, Total: 2590 },
  { Item: 'IRR-3', Description: 'Rain Bird 5004 Rotor', Qty: 32, Unit: 'EA', 'Unit Price': 18.5, Total: 592 },
]
const ws = XLSX.utils.json_to_sheet(data)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'MTO')
XLSX.writeFile(wb, a)

// Re-read to prove the round-trip.
const back = XLSX.readFile(a)
const rows = XLSX.utils.sheet_to_json(back.Sheets[back.SheetNames[0]], { defval: '' })
console.log('Wrote', a)
console.log('Headers:', Object.keys(rows[0]).join(', '))
console.log('Rows:', rows.length)
console.log('First row:', JSON.stringify(rows[0]))
