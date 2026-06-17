import { readdir, readFile, writeFile } from 'fs/promises'
import { join, basename } from 'path'
import { fileURLToPath } from 'url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const LYRICS_DIR = join(ROOT, 'public', 'lyrics-text')
const OUT_FILE = join(ROOT, 'public', 'songs-manifest.json')

// ── Malayalam → Roman transliteration ────────────────────────────────────────
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

function romanize(text) {
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
        out += con + 'a'; i++
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

function normalizeSearch(s) {
  return s.toLowerCase().replace(/(.)\1+/g, '$1').replace(/\s+/g, ' ').trim()
}

// ── Song parser ───────────────────────────────────────────────────────────────
function parseSong(content) {
  const lines = content.split(/\r?\n/)
  const title = lines[0]?.trim() || ''
  const voices = []
  const textParts = []

  for (let i = 2; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed === 'M' || trimmed === 'F' || trimmed === 'A') {
      voices.push(trimmed)
    } else if (trimmed && !trimmed.startsWith('=')) {
      textParts.push(trimmed)
    }
  }

  const text = textParts.join(' ').slice(0, 300)
  const r = normalizeSearch(romanize(text))
  return { title, voices, text, r }
}

async function main() {
  const files = (await readdir(LYRICS_DIR))
    .filter(f => f.endsWith('.txt'))
    .sort()

  const manifest = []
  for (const file of files) {
    const filename = basename(file, '.txt')
    try {
      const content = await readFile(join(LYRICS_DIR, file), 'utf-8')
      const { title, voices, text, r } = parseSong(content)
      manifest.push({ filename, title, voices, text, r })
    } catch (e) {
      console.warn('Failed to parse', file, e.message)
    }
  }

  await writeFile(OUT_FILE, JSON.stringify(manifest))
  console.log(`Generated manifest with ${manifest.length} songs → ${OUT_FILE}`)
}

main().catch(console.error)
