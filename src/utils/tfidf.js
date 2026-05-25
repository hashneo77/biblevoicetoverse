const STOPWORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'is','are','was','were','be','been','being','have','has','had','do','does',
  'did','will','would','could','should','may','might','shall','can','need',
  'that','this','these','those','it','its','he','she','they','we','you','i',
  'him','her','them','us','me','my','your','his','their','our',
  'not','no','nor','so','yet','both','either','neither','as','if','then',
  'than','because','while','although','though','since','until','unless',
  'from','into','through','during','before','after','above','below',
  'between','out','up','down','off','over','under','again','further',
  'once','here','there','when','where','why','how','all','each','every',
  'some','any','few','more','most','other','such','own','same','just',
  'said','unto','thee','thou','thy','ye','hath','doth','thereof','also',
])

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t))
}

export function tfidfSearch(bibleEN, query, topN = 40) {
  if (!bibleEN?.data) return []
  const queryTerms = [...new Set(tokenize(query))]
  if (queryTerms.length === 0) return []

  const data = bibleEN.data
  const results = []

  for (const book of Object.keys(data)) {
    for (const ch of Object.keys(data[book])) {
      for (const v of Object.keys(data[book][ch])) {
        const text = data[book][ch][v]
        if (!text || typeof text !== 'string') continue

        const words = tokenize(text)
        const wordSet = new Set(words)

        let score = 0
        let exactMatches = 0

        for (const term of queryTerms) {
          if (wordSet.has(term)) {
            score += 2
            exactMatches++
          } else {
            for (const w of wordSet) {
              if (w.includes(term) || term.includes(w)) { score += 0.5; break }
            }
          }
        }

        if (exactMatches > 1) score += exactMatches * 1.5
        if (score > 0) {
          results.push({
            ref: `${book} ${ch}:${v}`,
            text,
            score,
            parsed: { book, chapter: Number(ch), verse: Number(v) },
          })
        }
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, topN)
}
