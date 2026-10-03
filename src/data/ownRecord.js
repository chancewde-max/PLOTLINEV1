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
