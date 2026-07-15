// "Correction memory" for the sheet-upload wizard's OCR guesses.
//
// This is NOT machine learning — no model is retrained, and OCR accuracy
// itself never improves. What it does: remembers which sheet-number/title
// values a user has confirmed or corrected a bad guess into, learns the
// FORMAT those values follow (e.g. "L-###"), and uses that format to
// predict the next value in a sequence when OCR comes up empty or garbage
// on a page — a lightweight, explainable heuristic, not a black box.

const MAX_SAMPLES = 300
const MAX_CORRECTIONS = 100

export function emptyOcrMemory() {
  return {
    sheetNum: { samples: [], corrections: [] },
    title: { samples: [], corrections: [] },
  }
}

// Abstract a string into a shape signature: letters -> 'A', digits -> '9',
// everything else kept as-is. "L001" -> "A999", "A2.10" -> "A9.99".
export function shapeOf(str) {
  if (!str) return ''
  return str.replace(/[a-zA-Z]/g, 'A').replace(/[0-9]/g, '9')
}

// Most common shape among recent samples. Requires at least 3 occurrences
// before trusting it — a couple of one-off samples shouldn't lock in a
// "pattern" for the whole account.
export function dominantShape(samples) {
  if (!samples || samples.length < 3) return null
  const counts = new Map()
  for (const s of samples) {
    const shape = shapeOf(s)
    counts.set(shape, (counts.get(shape) || 0) + 1)
  }
  let best = null, bestCount = 0
  for (const [shape, count] of counts) {
    if (count > bestCount) { best = shape; bestCount = count }
  }
  return bestCount >= 3 ? best : null
}

// If `prev` matches `shape` and ends in digits, return the same value with
// the trailing number incremented by 1 (zero-padded to match). Used to
// guess "page N" from a confirmed "page N-1" when OCR fails.
export function predictNext(prev, shape) {
  if (!prev || !shape || shapeOf(prev) !== shape) return null
  const m = prev.match(/^(.*?)(\d+)$/)
  if (!m) return null
  const [, prefix, digits] = m
  const next = String(Number(digits) + 1).padStart(digits.length, '0')
  return prefix + next
}

// Find the nearest earlier page from the same source file that already has
// a confirmed value matching the account's learned shape, and predict this
// page's value from it.
export function predictFromNeighbors(allPages, page, field, memory) {
  const shape = dominantShape(memory?.[field]?.samples)
  if (!shape) return null
  const siblings = allPages
    .filter(p => p.fileId === page.fileId && p.pageIndex < page.pageIndex && p[field])
    .sort((a, b) => b.pageIndex - a.pageIndex)
  for (const sib of siblings) {
    const predicted = predictNext(sib[field], shape)
    if (predicted) return predicted
  }
  return null
}

export function addSample(memory, field, value) {
  if (!value || !value.trim()) return memory
  const bucket = memory[field]
  const samples = [value, ...bucket.samples.filter(s => s !== value)].slice(0, MAX_SAMPLES)
  return { ...memory, [field]: { ...bucket, samples } }
}

export function addCorrection(memory, field, guess, corrected) {
  if (!guess || !corrected || guess === corrected) return memory
  const bucket = memory[field]
  const corrections = [{ guess, corrected, at: Date.now() }, ...bucket.corrections].slice(0, MAX_CORRECTIONS)
  return { ...memory, [field]: { ...bucket, corrections } }
}
