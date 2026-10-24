// Instant song search as you type: matches the title and the opening lyrics (Malayalam and
// Manglish), ignoring Manglish spelling differences (kandaalo = kandalo, yeshuve = yesuve,
// nadhane = nathane) and accepting queries typed in Malayalam script.
// NOTE: remote/src/songSearch.js is a copy of this file — keep the two in sync.

// Malayalam → Roman, same scheme as scripts/generate-songs-manifest.js (the manifest's `r` field)
const CONSONANTS = {
  'ക': 'k', 'ഖ': 'kh', 'ഗ': 'g', 'ഘ': 'gh', 'ങ': 'ng', 'ച': 'ch', 'ഛ': 'chh', 'ജ': 'j', 'ഝ': 'jh', 'ഞ': 'nj',
  'ട': 't', 'ഠ': 'th', 'ഡ': 'd', 'ഢ': 'dh', 'ണ': 'n', 'ത': 'th', 'ഥ': 'th', 'ദ': 'd', 'ധ': 'dh', 'ന': 'n',
  'പ': 'p', 'ഫ': 'ph', 'ബ': 'b', 'ഭ': 'bh', 'മ': 'm', 'യ': 'y', 'ര': 'r', 'ല': 'l', 'വ': 'v',
  'ശ': 'sh', 'ഷ': 'sh', 'സ': 's', 'ഹ': 'h', 'ള': 'l', 'ഴ': 'zh', 'റ': 'r',
}
const VOWELS = { 'അ': 'a', 'ആ': 'aa', 'ഇ': 'i', 'ഈ': 'ee', 'ഉ': 'u', 'ഊ': 'oo', 'ഋ': 'ri', 'എ': 'e', 'ഏ': 'e', 'ഐ': 'ai', 'ഒ': 'o', 'ഓ': 'o', 'ഔ': 'au' }
const MATRAS = { 'ാ': 'a', 'ി': 'i', 'ീ': 'i', 'ു': 'u', 'ൂ': 'oo', 'ൃ': 'ri', 'െ': 'e', 'േ': 'e', 'ൈ': 'ai', 'ൊ': 'o', 'ോ': 'o', 'ൌ': 'au', 'ൗ': 'au' }
const CHILLU = { 'ൺ': 'n', 'ൻ': 'n', 'ർ': 'r', 'ൽ': 'l', 'ൾ': 'l', 'ൿ': 'k', 'ം': 'm', 'ഃ': 'h' }

function romanize(text) {
  // Manglish writes ന്റ as "nt" (ente, ninte) and റ്റ as "tt" (kaattu)
  text = text.replace(/ന്റ/g, 'ന്ട').replace(/റ്റ/g, 'ട്ട')
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (CONSONANTS[ch]) {
      const next = text[i + 1]
      if (next === '്') { out += CONSONANTS[ch]; i++ }
      else if (MATRAS[next]) { out += CONSONANTS[ch] + MATRAS[next]; i++ }
      else out += CONSONANTS[ch] + 'a'
    } else if (VOWELS[ch]) out += VOWELS[ch]
    else if (CHILLU[ch]) out += CHILLU[ch]
    else if (ch === '‌' || ch === '‍' || ch === '​') continue
    else out += ch
  }
  return out
}

// Spelling-insensitive form: Malayalam → Roman, lowercase, letters/digits only, common Manglish
// variants folded together, doubled letters collapsed
export function canon(s) {
  return romanize(String(s || ''))
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .replace(/th/g, 't').replace(/dh/g, 'd').replace(/bh/g, 'b').replace(/gh/g, 'g').replace(/kh/g, 'k')
    .replace(/ph/g, 'f').replace(/sh/g, 's').replace(/zh/g, 'l').replace(/w/g, 'v').replace(/z/g, 's')
    .replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/aa/g, 'a')
    .replace(/(.)\1+/g, '$1')
}

const indexCache = new WeakMap()
function indexOf(songs) {
  let idx = indexCache.get(songs)
  if (!idx) {
    idx = songs.map(s => ({
      song: s,
      title: canon(s.title),
      lyrics: canon(s.r || '') + ' ' + canon(s.text || ''),   // opening lyrics, romanised + original
    }))
    indexCache.set(songs, idx)
  }
  return idx
}

// Best matches first: title starts with the query, title contains it, lyrics contain it,
// then every typed word appears somewhere in the title or lyrics.
export function searchSongs(songs, query, limit = 12) {
  if (!songs?.length || !query?.trim()) return []
  const q = canon(query)
  if (!q) return []
  const words = query.trim().split(/\s+/).map(canon).filter(w => w.length > 1)
  const hits = []
  for (const it of indexOf(songs)) {
    let score = 0
    if (it.title.startsWith(q)) score = 4
    else if (it.title.includes(q)) score = 3
    else if (it.lyrics.includes(q)) score = 2
    else if (words.length > 1 && words.every(w => it.title.includes(w) || it.lyrics.includes(w))) score = 1
    if (score) hits.push({ score, song: it.song })
  }
  hits.sort((a, b) => b.score - a.score || a.song.title.length - b.song.title.length)
  return hits.slice(0, limit).map(h => h.song)
}
