export function normalizeSpoken(s) {
  return s
    .trim()
    .replace(/\bchapter\b/gi, ' ')
    .replace(/\bverse\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function wordsToNumber(w) {
  const m = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  }
  if (!isNaN(Number(w))) return Number(w)
  return m[w.toLowerCase()] || null
}

export function parseReference(text, bookAliases = {}) {
  const s = normalizeSpoken(text)
  const tokens = s.split(/\s+/).filter(Boolean)

  for (let len = Math.min(3, tokens.length); len >= 1; len--) {
    const candidate = tokens.slice(0, len).join(' ')
    if (bookAliases[candidate]) {
      const book = bookAliases[candidate]
      let rest = tokens.slice(len).join(' ')
      const fillerPattern =
        /\b(chapter|chap|verse|v|was|that|the|number|num|of|and|please|read)\b/gi
      rest = rest
        .replace(fillerPattern, ' ')
        .replace(/[.,;!?]/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')

      const colon = rest.match(/(\d+):(\d+)/)
      if (colon) return { book, chapter: +colon[1], verse: +colon[2] }
      if (!rest) return null
      const nums = rest.split(/\s+/).filter(Boolean)
      if (nums.length >= 2) {
        const c = Number(nums[0]) || wordsToNumber(nums[0])
        const v = Number(nums[1]) || wordsToNumber(nums[1])
        if (Number.isFinite(c) && Number.isFinite(v) && c > 0 && v > 0)
          return { book, chapter: c, verse: v }
      }
      if (nums.length === 1) {
        const c = Number(nums[0]) || wordsToNumber(nums[0])
        if (Number.isFinite(c) && c > 0) return { book, chapter: c, verse: 1 }
      }
      return null
    }
  }
  return null
}

export function getSearchSuggestions(query, books, bibleMeta) {
  if (!query) return []
  const q = query.trim()
  const qLower = q.toLowerCase()
  const results = []

  // Book prefix mode
  const prefixMatches = books.filter(b => b.toLowerCase().startsWith(qLower))
  if (prefixMatches.length > 0) {
    return prefixMatches.slice(0, 15).map(book => ({
      ref: book,
      preview: '(book)',
      parsed: { book, chapter: 1, verse: 1 },
    }))
  }

  // Resolve full book name from start of query
  let resolvedBook = null
  let remainder = ''
  for (const book of books) {
    const bl = book.toLowerCase()
    if (qLower.startsWith(bl)) {
      const nextChar = qLower.charAt(bl.length)
      if (!nextChar || /\s/.test(nextChar)) {
        if (!resolvedBook || bl.length > resolvedBook.toLowerCase().length) {
          resolvedBook = book
          remainder = q.slice(book.length).trim()
        }
      }
    }
  }

  if (!resolvedBook) return []

  const maxCh = bibleMeta.maxChapter.get(resolvedBook) || 150

  if (!remainder) {
    results.push({ ref: resolvedBook, preview: '(book)', parsed: { book: resolvedBook, chapter: 1, verse: 1 } })
    for (let c = 1; c <= Math.min(5, maxCh); c++) {
      results.push({ ref: `${resolvedBook} ${c}`, preview: '(chapter)', parsed: { book: resolvedBook, chapter: c, verse: 1 } })
    }
    return results
  }

  const chapVerse = remainder.replace(/\s+/g, '')
  const m = chapVerse.match(/^(\d{1,3})(?::(\d{1,3}))?$/)
  if (!m) return []

  const chapter = Math.min(parseInt(m[1], 10), maxCh)
  const verseKey = `${resolvedBook}|${chapter}`
  const maxV = bibleMeta.maxVerse.get(verseKey) || 176
  const hasColon = chapVerse.includes(':')
  const verse = m[2] ? Math.min(parseInt(m[2], 10), maxV) : null

  if (!hasColon) {
    results.push({ ref: `${resolvedBook} ${chapter}`, preview: '(chapter)', parsed: { book: resolvedBook, chapter, verse: 1 } })
    for (let v = 1; v <= Math.min(5, maxV); v++) {
      results.push({ ref: `${resolvedBook} ${chapter}:${v}`, preview: '(verse)', parsed: { book: resolvedBook, chapter, verse: v } })
    }
    return results
  }

  if (verse == null) {
    for (let v = 1; v <= Math.min(10, maxV); v++) {
      results.push({ ref: `${resolvedBook} ${chapter}:${v}`, preview: '(verse)', parsed: { book: resolvedBook, chapter, verse: v } })
    }
    return results
  }

  results.push({ ref: `${resolvedBook} ${chapter}:${verse}`, preview: '(reference)', parsed: { book: resolvedBook, chapter, verse } })
  if (verse > 1)
    results.push({ ref: `${resolvedBook} ${chapter}:${verse - 1}`, preview: '(nearby)', parsed: { book: resolvedBook, chapter, verse: verse - 1 } })
  if (verse < maxV)
    results.push({ ref: `${resolvedBook} ${chapter}:${verse + 1}`, preview: '(nearby)', parsed: { book: resolvedBook, chapter, verse: verse + 1 } })

  return results
}
