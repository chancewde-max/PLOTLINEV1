import { ownRecord } from './ownRecord.js'

// Same state when the id is missing or inherited. Callers that spread
// `sheets[id]` used to store Object.prototype under __proto__ and a blank
// object under constructor / toString.
export function nextSheetsAfterUpdate(sheets, sheetId, updates) {
  const current = ownRecord(sheets, sheetId)
  if (!current) return sheets
  return { ...sheets, [sheetId]: { ...current, ...updates } }
}
