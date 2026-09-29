// Bracket access walks Object.prototype, so bag['__proto__'] and
// bag['constructor'] are truthy even when that id was never stored.
// Unknown ids and those prototype names must stay absent.
export function ownRecord(bag, id) {
  if (bag == null || typeof bag !== 'object') return undefined
  if (!Object.hasOwn(bag, id)) return undefined
  const value = bag[id]
  if (value == null || typeof value !== 'object') return undefined
  return value
}

// A sheet belongs to the project in the URL when its projectId matches and,
// if the project lists sheet ids, that list includes this sheet.
export function sheetBelongsToProject(project, sheet, projectId, sheetId) {
  if (!project || !sheet || projectId == null || sheetId == null) return false
  if (project.id != null && project.id !== projectId) return false
  if (sheet.projectId !== projectId) return false
  if (Array.isArray(project.sheetIds) && !project.sheetIds.includes(sheetId)) return false
  return true
}
