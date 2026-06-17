// Malayalam → Roman transliteration (sufficient for Manglish search)

const CONSONANTS = {
  'ക': 'k', 'ഖ': 'kh', 'ഗ': 'g', 'ഘ': 'gh', 'ങ': 'ng',
  'ച': 'ch', 'ഛ': 'chh', 'ജ': 'j', 'ഝ': 'jh', 'ഞ': 'nj',
  'ട': 't', 'ഠ': 'th', 'ഡ': 'd', 'ഢ': 'dh', 'ണ': 'n',
  'ത': 'th', 'ഥ': 'th', 'ദ': 'd', 'ധ': 'dh', 'ന': 'n',
  'പ': 'p', 'ഫ': 'ph', 'ബ': 'b', 'ഭ': 'bh', 'മ': 'm',
  'യ': 'y', 'ര': 'r', 'ല': 'l', 'വ': 'v',
  'ശ': 'sh', 'ഷ': 'sh', 'സ': 's', 'ഹ': 'h',
  'ള': 'l', 'ഴ': 'zh', 'റ': 'r',
}
const VOWELS = {
  'അ': 'a', 'ആ': 'aa', 'ഇ': 'i', 'ഈ': 'ee', 'ഉ': 'u', 'ഊ': 'oo',
  'ഋ': 'ri', 'എ': 'e', 'ഏ': 'e', 'ഐ': 'ai', 'ഒ': 'o', 'ഓ': 'o', 'ഔ': 'au',
}
const MATRAS = {
  'ാ': 'a', 'ി': 'i', 'ീ': 'i', 'ു': 'u', 'ൂ': 'oo',
  'ൃ': 'ri', 'െ': 'e', 'േ': 'e', 'ൈ': 'ai',
  'ൊ': 'o', 'ോ': 'o', 'ൌ': 'au', 'ൗ': 'au',
}
const VIRAMA = '്'
const CHILLU = { 'ൺ': 'n', 'ൻ': 'n', 'ർ': 'r', 'ൽ': 'l', 'ൾ': 'l', 'ൿ': 'k' }
const SPECIAL = { 'ം': 'm', 'ഃ': 'h', '‍': '', '‌': '' }

export function romanize(text) {
  let out = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (CONSONANTS[ch]) {
      const con = CONSONANTS[ch]
      const next = text[i + 1]
      if (next === VIRAMA) {
        out += con; i += 2
      } else if (MATRAS[next]) {
        out += con + MATRAS[next]; i += 2
      } else {
        out += con + 'a'; i++  // inherent 'a'
      }
    } else if (VOWELS[ch]) {
      out += VOWELS[ch]; i++
    } else if (CHILLU[ch]) {
      out += CHILLU[ch]; i++
    } else if (SPECIAL[ch] !== undefined) {
      out += SPECIAL[ch]; i++
    } else if (/\s/.test(ch)) {
      out += ' '; i++
    } else {
      if (/[a-zA-Z0-9]/.test(ch)) out += ch.toLowerCase()
      i++
    }
  }
  return out.replace(/\s+/g, ' ').trim()
}

// Normalize a Roman/Manglish string for fuzzy search:
// collapse doubled letters (aa→a, ee→e, oo→o, nn→n …)
export function normalizeSearch(s) {
  return s.toLowerCase()
    .replace(/(.)\1+/g, '$1')  // 'aa' → 'a', 'nn' → 'n', etc.
    .replace(/\s+/g, ' ')
    .trim()
}
