// "Add song": turn pasted text, PDF text, photos or a web page into a Malayalam song file plus a
// Manglish file with the same slides, then save both to Storage and list the song for search.
//
// Song file format (read by src/utils/parseLyrics.js):
//   <Title>
//   ==================
//   Artist: <artist>          (optional)
//
//   M
//   <line>
//
//   <line>
//   ...
// A line that is exactly M, F or A starts a slide. The .manglish.txt file has the same slides,
// markers and line counts, so the ML/EN switch keeps the slide index.
const { HttpsError } = require('firebase-functions/v2/https');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const admin = require('firebase-admin');
const dns = require('dns');
const http = require('http');
const https = require('https');
const net = require('net');
const zlib = require('zlib');

const BUCKET = 'biblevoicetoverse.firebasestorage.app';
const ML_RE = /[ഀ-ൿ]/;
const MODEL = 'gemini-2.5-flash';

// ── Malayalam → Roman (same scheme as scripts/generate-songs-manifest.js — keep in sync) ──
const CONSONANTS = {
  'ക': 'k', 'ഖ': 'kh', 'ഗ': 'g', 'ഘ': 'gh', 'ങ': 'ng',
  'ച': 'ch', 'ഛ': 'chh', 'ജ': 'j', 'ഝ': 'jh', 'ഞ': 'nj',
  'ട': 't', 'ഠ': 'th', 'ഡ': 'd', 'ഢ': 'dh', 'ണ': 'n',
  'ത': 'th', 'ഥ': 'th', 'ദ': 'd', 'ധ': 'dh', 'ന': 'n',
  'പ': 'p', 'ഫ': 'ph', 'ബ': 'b', 'ഭ': 'bh', 'മ': 'm',
  'യ': 'y', 'ര': 'r', 'ല': 'l', 'വ': 'v',
  'ശ': 'sh', 'ഷ': 'sh', 'സ': 's', 'ഹ': 'h',
  'ള': 'l', 'ഴ': 'zh', 'റ': 'r',
};
const VOWELS = {
  'അ': 'a', 'ആ': 'aa', 'ഇ': 'i', 'ഈ': 'ee', 'ഉ': 'u', 'ഊ': 'oo',
  'ഋ': 'ri', 'എ': 'e', 'ഏ': 'e', 'ഐ': 'ai', 'ഒ': 'o', 'ഓ': 'o', 'ഔ': 'au',
};
const MATRAS = {
  'ാ': 'a', 'ി': 'i', 'ീ': 'i', 'ു': 'u', 'ൂ': 'oo',
  'ൃ': 'ri', 'െ': 'e', 'േ': 'e', 'ൈ': 'ai',
  'ൊ': 'o', 'ോ': 'o', 'ൌ': 'au', 'ൗ': 'au',
};
const VIRAMA = '്';
const CHILLU = { 'ൺ': 'n', 'ൻ': 'n', 'ർ': 'r', 'ൽ': 'l', 'ൾ': 'l', 'ൿ': 'k' };
const SPECIAL = { 'ം': 'm', 'ഃ': 'h', '‍': '', '‌': '' };

function romanize(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (CONSONANTS[ch]) {
      const con = CONSONANTS[ch];
      const next = text[i + 1];
      if (next === VIRAMA) { out += con; i += 2; }
      else if (MATRAS[next]) { out += con + MATRAS[next]; i += 2; }
      else { out += con + 'a'; i++; }
    } else if (VOWELS[ch]) { out += VOWELS[ch]; i++; }
    else if (CHILLU[ch]) { out += CHILLU[ch]; i++; }
    else if (SPECIAL[ch] !== undefined) { out += SPECIAL[ch]; i++; }
    else if (/\s/.test(ch)) { out += ' '; i++; }
    else { if (/[a-zA-Z0-9]/.test(ch)) out += ch.toLowerCase(); i++; }
  }
  return out.replace(/\s+/g, ' ').trim();
}

function normalizeSearch(s) {
  return s.toLowerCase().replace(/(.)\1+/g, '$1').replace(/\s+/g, ' ').trim();
}

// romanize() keeps only letters; for a fallback Manglish line keep punctuation-free words, capitalised
const romanLine = (line) => romanize(line).split(' ').filter(Boolean)
  .map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

// ── Manglish alignment: pick each Malayalam line's closest Manglish line ──────────────────
function skeleton(s) {
  return s.toLowerCase().replace(/[^a-z]/g, '').replace(/h/g, '').replace(/[aeiouyw]/g, '')
    .replace(/z/g, 'l').replace(/d/g, 't').replace(/g/g, 'k').replace(/b/g, 'p')
    .replace(/j/g, 'c').replace(/f/g, 'p').replace(/(.)\1+/g, '$1');
}

function bigramDice(a, b) {
  if (a.length < 2 || b.length < 2) return a === b && a ? 1 : 0;
  const grams = new Map();
  for (let i = 0; i < a.length - 1; i++) { const g = a.slice(i, i + 2); grams.set(g, (grams.get(g) || 0) + 1); }
  let hits = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const g = b.slice(i, i + 2); const n = grams.get(g);
    if (n) { hits++; grams.set(g, n - 1); }
  }
  return (2 * hits) / (a.length - 1 + b.length - 1);
}

// slides: [{ voice, lines }] in Malayalam; manglishLines: the source's Manglish lines (any order/structure)
function alignManglish(slides, manglishLines) {
  const cands = manglishLines.map(t => t.trim()).filter(Boolean).map(t => ({ text: t, key: skeleton(t) }));
  let matched = 0, total = 0;
  const out = slides.map(s => ({
    voice: s.voice,
    lines: s.lines.map(line => {
      if (!ML_RE.test(line)) return line;               // 🎵🎵🎵, English lines: unchanged
      total++;
      const key = skeleton(romanize(line));
      let best = null, bestScore = 0;
      for (const c of cands) {
        const sc = bigramDice(key, c.key);
        if (sc > bestScore) { bestScore = sc; best = c; }
      }
      if (best && bestScore >= 0.5) { matched++; return best.text; }
      return romanLine(line);
    }),
  }));
  return { slides: out, matched, total };
}

// ── File text ⇄ slides ────────────────────────────────────────────────────────────────────
function slidesToFile(title, artist, slides, { blankBetweenLines = true } = {}) {
  let out = `${title.trim()}\n==================\n`;
  if (artist && artist.trim()) out += `Artist: ${artist.trim()}\n`;
  for (const s of slides) out += `\n${s.voice}\n${s.lines.join(blankBetweenLines ? '\n\n' : '\n')}\n`;
  return out;
}

// Body text as edited in the remote: marker lines (M/F/A) followed by that slide's lines
function parseBody(text) {
  const slides = [];
  let cur = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const t = raw.trim();
    if (t === 'M' || t === 'F' || t === 'A') { cur = { voice: t, lines: [] }; slides.push(cur); }
    else if (t && cur) cur.lines.push(t);
  }
  return slides.filter(s => s.lines.length);
}

// Returns a list of problems (empty = OK). Same checks as remote/src/songFile.js.
function validateSong({ title, english, ml, en }) {
  const errs = [];
  if (!String(title || '').trim()) errs.push('The title is empty.');
  if (!ml.length) errs.push('There are no slides.');
  if (english) return errs;
  ml.forEach((s, i) => { if (!s.lines.some(l => ML_RE.test(l))) errs.push(`Malayalam slide ${i + 1} has no Malayalam text.`); });
  if (en.some(s => s.lines.some(l => ML_RE.test(l)))) errs.push('The Manglish file contains Malayalam letters.');
  if (ml.length !== en.length) errs.push(`Slide count differs: Malayalam ${ml.length}, Manglish ${en.length}.`);
  else ml.forEach((s, i) => {
    if (s.voice !== en[i].voice) errs.push(`Slide ${i + 1}: voice ${s.voice} in Malayalam but ${en[i].voice} in Manglish.`);
    if (s.lines.length !== en[i].lines.length) errs.push(`Slide ${i + 1}: ${s.lines.length} lines in Malayalam but ${en[i].lines.length} in Manglish.`);
  });
  return errs;
}

// ── Fetching web pages (server side: no CORS; public http(s) hosts only) ─────────────────
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b, c] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
      || (a === 198 && (b === 18 || b === 19)) || (a === 192 && b === 0 && (c === 0 || c === 2));
  }
  const v = ip.toLowerCase();
  // loopback, unspecified, unique-local, link/site-local, IPv4-mapped, NAT64 and 6to4 (which wrap IPv4)
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe')
    || v.startsWith('::ffff:') || v.startsWith('64:ff9b:') || v.startsWith('2002:');
}

const BLOCKED = 'That address cannot be fetched.';
const MAX_PAGE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;

// Used as the socket's DNS lookup, so the address that is checked is the address connected to
// (a hostname can't resolve to a public IP for a check and a private one for the connection)
function publicLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addrs) => {
    if (err) return callback(err);
    if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) {
      return callback(Object.assign(new Error(BLOCKED), { code: 'EBLOCKED' }));
    }
    if (options?.all) callback(null, addrs);
    else callback(null, addrs[0].address, addrs[0].family);
  });
}

// One GET without following redirects; the body is streamed, decompressed and capped
function getOnce(u, signal) {
  return new Promise((resolve, reject) => {
    const host = u.hostname.replace(/^\[|\]$/g, '');
    // IP literals skip DNS lookup entirely, so check them here
    if (net.isIP(host) && isPrivateIp(host)) return reject(new HttpsError('invalid-argument', BLOCKED));
    const req = (u.protocol === 'https:' ? https : http).get(u, {
      lookup: publicLookup,
      signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BibleVoiceSongImport/1.0)',
        Accept: 'text/html,*/*',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    }, (res) => {
      const status = res.statusCode;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        return resolve({ status, location: res.headers.location });
      }
      const enc = String(res.headers['content-encoding'] || '').toLowerCase();
      const body = enc === 'gzip' ? res.pipe(zlib.createGunzip())
        : enc === 'deflate' ? res.pipe(zlib.createInflate())
        : enc === 'br' ? res.pipe(zlib.createBrotliDecompress())
        : res;
      const chunks = [];
      let size = 0;
      body.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_PAGE_BYTES) {
          req.destroy();
          reject(new HttpsError('failed-precondition', 'That page is too large.'));
        } else chunks.push(chunk);
      });
      body.on('end', () => resolve({ status, buf: Buffer.concat(chunks) }));
      body.on('error', reject);
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

async function fetchPage(url) {
  let u;
  try { u = new URL(url); } catch { throw new HttpsError('invalid-argument', 'That is not a valid web address.'); }
  const signal = AbortSignal.timeout(20000);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!/^https?:$/.test(u.protocol)) throw new HttpsError('invalid-argument', 'Only http and https addresses are supported.');
    let res;
    try {
      res = await getOnce(u, signal);
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      if (e.code === 'EBLOCKED') throw new HttpsError('invalid-argument', BLOCKED);
      // Don't pass network error details back: they would say which hosts and ports exist
      throw new HttpsError('failed-precondition', 'That page could not be fetched.');
    }
    if (res.location) {
      try { u = new URL(res.location, u); } catch { throw new HttpsError('failed-precondition', 'That page could not be fetched.'); }
      continue;   // the next hop is checked again, protocol and address
    }
    if (res.status < 200 || res.status >= 300) throw new HttpsError('failed-precondition', `The page returned ${res.status}.`);
    return { html: res.buf.toString('utf8'), finalUrl: u.href };
  }
  throw new HttpsError('failed-precondition', 'That page redirects too many times.');
}

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'");
}

const stripTags = (s) => decodeEntities(s.replace(/<[^>]+>/g, ''));

// Main text of an arbitrary page: drop scripts/styles/nav/header/footer, keep line breaks
function htmlToText(html) {
  let h = html
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const main = h.match(/<(article|main)\b[\s\S]*?<\/\1>/i);
  if (main) h = main[0];
  h = h.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6]|tr|section|pre|blockquote)>/gi, '\n');
  return decodeEntities(h.replace(/<[^>]+>/g, ' '))
    .split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim()
    .slice(0, 60000);
}

// madely.us/lyrics/…: deterministic, no AI. Malayalam table rows: first cell = role, second = lines.
function parseMadely(html) {
  const titleM = html.match(/id="SongTitleName"[^>]*>([\s\S]*?)<\/a>/);
  const title = titleM ? stripTags(titleM[1].replace(/<span[^>]*display:\s*none[\s\S]*?<\/span>/i, '')).trim() : '';
  const artistM = html.match(/Artist\s*:\s*(?:<[^>]+>\s*)*<a[^>]*>([\s\S]*?)<\/a>/i) || html.match(/>\s*(?:&nbsp;)?\s*Artist\s*:\s*([^<]+)</i);
  const artist = artistM ? stripTags(artistM[1]).replace(/^\s*Artist\s*:\s*/i, '').trim() : '';

  const start = html.search(/id=\s*"div-lyric-text"/);
  const slides = [];
  if (start >= 0) {
    const block = html.slice(start, html.indexOf('</table>', start) + 8);
    for (const row of block.match(/<tr\b[\s\S]*?<\/tr>/gi) || []) {
      const cells = row.match(/<td\b[^>]*>([\s\S]*?)<\/td>/gi) || [];
      if (cells.length < 2) continue;
      const cell = (c) => c.replace(/^<td\b[^>]*>/i, '').replace(/<\/td>$/i, '');
      const role = stripTags(cell(cells[0])).trim().toUpperCase();
      const lines = cell(cells[cells.length - 1]).split(/<br\s*\/?>/i)
        .map(l => stripTags(l).replace(/\s+/g, ' ').trim())
        .filter(l => l && !/^[-—–_=\s]+$/.test(l));
      if (!lines.length) continue;
      const voice = role.startsWith('M') ? 'M' : role.startsWith('F') ? 'F' : 'A';
      slides.push({ voice, lines });
    }
  }

  let manglish = [];
  const ms = html.search(/<span class=['"]spanManglish/);
  if (ms >= 0) {
    // drop the hidden keyword block, then take the span up to its closing tag
    const rest = html.slice(ms).replace(/<div style="display:\s*none;?"[\s\S]*?<\/div>/i, '');
    const span = rest.slice(0, rest.indexOf('</span>'));
    manglish = span.split(/<br\s*\/?>/i).map(l => stripTags(l).replace(/\s+/g, ' ').trim())
      .filter(l => l && !/^-{3,}$/.test(l) && !/^[-—–_=\s]+$/.test(l));
  }
  return { title, artist, slides, manglish };
}

// ── Gemini ─────────────────────────────────────────────────────────────────────────────────
const SLIDES_SCHEMA = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      voice: { type: SchemaType.STRING, enum: ['M', 'F', 'A'] },
      lines: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    },
    required: ['voice', 'lines'],
  },
};

const STRUCTURE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    artist: { type: SchemaType.STRING },
    english: { type: SchemaType.BOOLEAN, description: 'true if the song is in English (not Malayalam)' },
    malayalam: { ...SLIDES_SCHEMA, nullable: true, description: 'Slides in Malayalam script, or the English slides for an English song; null if the source has no Malayalam script' },
    manglish: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true, description: 'The romanised Malayalam (Manglish) lines exactly as in the source, in order, without slide structure; null if none' },
  },
  required: ['title', 'english', 'malayalam', 'manglish'],
};

const STRUCTURE_RULES = `Rules:
- Never invent, translate or "correct" lyric words. Copy every word exactly as written.
- Keep the singer labels when the source has them: Male/Men → M, Female/Women → F, All/Chorus/Choir/Group → A. With no labels, use A.
- One slide per stanza. Split stanzas longer than about 6 lines into slides of 2–4 lines.
- Drop page numbers, chords, headers/footers, website menus/ads/boilerplate, and repeat marks such as "x2", "(2)", "2 times". Only write a repeat as its own slide when the source writes it out in full.
- title: the song's title as given (the first line if no title is given). artist: singer/composer if stated, else "".
- If the song is in English, set english=true and put its slides in "malayalam"; manglish=null.
- If the source has Malayalam script, put it in "malayalam". If it also has Manglish (Malayalam written in English letters), list those lines in "manglish", in order, without slides.
- If the source has only Manglish, set malayalam=null and list the Manglish lines in "manglish".`;

// Reading photos/scans: 3.1 Pro read a Malayalam page word-for-word in tests where 2.5 Flash misread
// words and invented text for an unreadable image; 3.8 Flash is the fallback if the preview model goes away
const VISION_MODELS = ['gemini-3.1-pro-preview', 'gemini-3.8-flash'];

function gemini(key, schema, maxOutputTokens = 8192, model = MODEL) {
  return new GoogleGenerativeAI(key).getGenerativeModel({
    model,
    generationConfig: {
      ...(model === MODEL ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      temperature: 0,
      maxOutputTokens,
      ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}),
    },
  });
}

async function geminiJson(key, schema, parts) {
  const result = await gemini(key, schema).generateContent(parts);
  try { return JSON.parse(result.response.text()); }
  catch { throw new HttpsError('internal', 'The AI returned an unreadable answer. Please try again.'); }
}

// Photos / scanned pages → exact text, keeping line breaks and singer labels
async function transcribeImages(key, images) {
  const parts = [
    { text: `Transcribe the text in these images exactly as written, page by page, keeping every line break and any singer labels (M, F, A, Male, Female, All, Chorus). Malayalam must stay in Malayalam script. Do not translate, correct, complete or add anything.
Only write words you can actually read. If a line is too blurry or small to read, write [unreadable] for it. If you cannot read the text at all, output exactly: UNREADABLE
Output only the transcribed text.` },
    ...images.map(im => ({ inlineData: { mimeType: im.mimeType, data: im.data } })),
  ];
  let text = '', lastErr = null;
  for (const model of VISION_MODELS) {
    try { text = (await gemini(key, null, 16384, model).generateContent(parts)).response.text().trim(); lastErr = null; break; }
    catch (e) { lastErr = e; }
  }
  if (lastErr) throw lastErr;
  if (!text || /^UNREADABLE\b/.test(text)) {
    throw new HttpsError('failed-precondition', 'The lyrics in the image could not be read. Try a clearer, closer photo.');
  }
  return text;
}

async function structureText(key, text) {
  return geminiJson(key, STRUCTURE_SCHEMA, [{ text: `Turn these song lyrics into slides for a church projector.\n\n${STRUCTURE_RULES}\n\nLyrics:\n"""\n${text}\n"""` }]);
}

// Slides longer than 6 lines are split into balanced slides of at most 4 lines
function splitLong(slide) {
  const { voice, lines } = slide;
  if (lines.length <= 6) return [slide];
  const n = Math.ceil(lines.length / 4), size = Math.ceil(lines.length / n), out = [];
  for (let i = 0; i < lines.length; i += size) out.push({ voice, lines: lines.slice(i, i + size) });
  return out;
}

const cleanSlides = (slides) => (Array.isArray(slides) ? slides : [])
  .map(s => ({ voice: ['M', 'F', 'A'].includes(s?.voice) ? s.voice : 'A', lines: (s?.lines || []).map(l => String(l).trim()).filter(Boolean) }))
  .filter(s => s.lines.length)
  .flatMap(splitLong);

// Malayalam only → natural Manglish with the same slides and line counts; romanize() fills any gap
async function writeManglish(key, slides) {
  const schema = { type: SchemaType.OBJECT, properties: { slides: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { lines: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } } }, required: ['lines'] } } }, required: ['slides'] };
  const input = slides.map((s, i) => `Slide ${i + 1}:\n${s.lines.join('\n')}`).join('\n\n');
  const out = await geminiJson(key, schema, [{ text: `Write these Malayalam song lines in Manglish (Malayalam in English letters, the natural spelling people use for song lyrics, e.g. "Ente Daivame", "Yeshuve Nee"). Keep exactly the same slides and exactly one Manglish line per Malayalam line, in order. Do not translate to English.\n\n${input}` }]);
  let filled = 0;
  const en = slides.map((s, i) => ({
    voice: s.voice,
    lines: s.lines.map((line, j) => {
      const g = out?.slides?.[i]?.lines?.[j];
      if (!ML_RE.test(line)) return line;
      if (g && String(g).trim() && !ML_RE.test(g)) return String(g).trim();
      filled++;
      return romanLine(line);
    }),
  }));
  return { slides: en, filled };
}

// Manglish only → Malayalam script, slide by slide (the Manglish lines are kept as given)
async function writeMalayalam(key, manglishLines) {
  const schema = { type: SchemaType.OBJECT, properties: { slides: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { voice: { type: SchemaType.STRING, enum: ['M', 'F', 'A'] }, manglish: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }, malayalam: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } } }, required: ['voice', 'manglish', 'malayalam'] } } }, required: ['slides'] };
  const out = await geminiJson(key, schema, [{ text: `These are Malayalam Christian song lyrics written in Manglish (English letters). Group them into slides (one per stanza, 2–4 lines when a stanza is long; voice A unless the text has M/F/A labels). For each slide give the Manglish lines exactly as written and the same lines in Malayalam script, one Malayalam line per Manglish line. Do not translate, add or drop lines.\n\n${manglishLines.join('\n')}` }]);
  const rows = (out?.slides || []).map(s => {
    const en = (s.manglish || []).map(l => String(l).trim()).filter(Boolean);
    const ml = (s.malayalam || []).map(l => String(l).trim()).filter(Boolean);
    return { voice: ['M', 'F', 'A'].includes(s.voice) ? s.voice : 'A', en, ml };
  }).filter(r => r.en.length && r.en.length === r.ml.length);
  const split = rows.flatMap(r => {   // both languages split the same way, line counts match
    const en = splitLong({ voice: r.voice, lines: r.en });
    return splitLong({ voice: r.voice, lines: r.ml }).map((s, i) => ({ ml: s, en: en[i] }));
  });
  return { ml: split.map(x => x.ml), en: split.map(x => x.en) };
}

// ── prepareSong: any source → { title, artist, english, ml, en, notes } (nothing saved) ─────
async function prepareSong(key, data) {
  const notes = [];
  let structured;

  if (data.url) {
    const { html, finalUrl } = await fetchPage(String(data.url).trim());
    if (/(^|\.)madely\.us$/i.test(new URL(finalUrl).hostname) && /\/lyrics\//.test(new URL(finalUrl).pathname)) {
      const m = parseMadely(html);
      if (!m.slides.length) throw new HttpsError('not-found', 'No lyrics found on that madely page.');
      structured = { title: m.title, artist: m.artist, english: false, malayalam: m.slides, manglish: m.manglish.length ? m.manglish : null };
      notes.push('Read directly from madely.us (no AI).');
    } else {
      const text = htmlToText(html);
      if (text.length < 20) throw new HttpsError('not-found', 'No text found on that page.');
      structured = await structureText(key, text);
    }
  } else if (Array.isArray(data.images) && data.images.length) {
    if (data.images.length > 8) throw new HttpsError('invalid-argument', 'Up to 8 images at a time.');
    const text = await transcribeImages(key, data.images.map(im => ({ mimeType: String(im.mimeType || 'image/jpeg'), data: String(im.data || '') })));
    if (!text) throw new HttpsError('not-found', 'No text could be read from the images.');
    structured = await structureText(key, text);
    notes.push('Read from images by AI — check every line against the source.');
  } else if (typeof data.text === 'string' && data.text.trim()) {
    structured = await structureText(key, data.text.slice(0, 60000));
  } else {
    throw new HttpsError('invalid-argument', 'Give lyrics text, images or a web address.');
  }

  const title = String(structured.title || '').trim();
  const artist = String(structured.artist || '').trim();
  const english = !!structured.english;
  let ml = cleanSlides(structured.malayalam);
  const manglish = (structured.manglish || []).map(l => String(l).trim()).filter(Boolean);
  let en = null;
  let malayalamAuto = false;

  if (english) {
    en = null;
  } else if (ml.length && manglish.length) {
    const a = alignManglish(ml, manglish);
    en = a.slides;
    notes.push(`Manglish from the source: ${a.matched} of ${a.total} lines matched${a.matched < a.total ? '; the rest were transliterated automatically' : ''}.`);
  } else if (ml.length) {
    const w = await writeManglish(key, ml);
    en = w.slides;
    notes.push(`Manglish was written automatically${w.filled ? ` (${w.filled} lines by simple transliteration)` : ''} — please check it.`);
  } else if (manglish.length) {
    const w = await writeMalayalam(key, manglish);
    ml = w.ml; en = w.en; malayalamAuto = true;
    notes.push('The source had only Manglish. The Malayalam was written automatically — review every line before saving.');
  } else {
    throw new HttpsError('not-found', 'No song lyrics were found.');
  }
  return { title, artist, english, ml, en, malayalamAuto, notes };
}

// ── saveSong: validate, write lyrics-text/<filename>.txt (+ .manglish.txt), list for search ──
function slugify(title) {
  const base = ML_RE.test(title) ? romanize(title) : title;
  return base.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'song';
}

async function saveSong(data, email) {
  const title = String(data.title || '').trim().replace(/\s+/g, ' ');
  const artist = String(data.artist || '').trim().replace(/\s+/g, ' ');
  const english = !!data.english;
  const ml = parseBody(data.mlBody);
  const en = english ? [] : parseBody(data.enBody);
  const errs = validateSong({ title, english, ml, en });
  if (errs.length) throw new HttpsError('invalid-argument', errs.join(' '));
  if (ml.length > 200 || JSON.stringify(data).length > 150000) throw new HttpsError('invalid-argument', 'That song is too long.');

  const bucket = admin.storage().bucket(BUCKET);
  const base = slugify(title);
  let filename = base;
  for (let n = 2; ; n++) {
    const [exists] = await bucket.file(`lyrics-text/${filename}.txt`).exists();
    if (!exists) break;
    filename = `${base}-${n}`;
    if (n > 50) throw new HttpsError('already-exists', 'Too many songs with this title.');
  }

  const opts = { contentType: 'text/plain; charset=utf-8', resumable: false };
  await bucket.file(`lyrics-text/${filename}.txt`).save(slidesToFile(title, artist, ml, { blankBetweenLines: !english }), opts);
  if (!english) await bucket.file(`lyrics-text/${filename}.manglish.txt`).save(slidesToFile(title, artist, en), opts);

  // Search entry, same fields as public/songs-manifest.json (scripts/generate-songs-manifest.js)
  // text: opening lyrics for previews; r: every distinct line, so search finds any verse or chorus
  const lines = ml.flatMap(s => s.lines);
  const entry = {
    filename, title, voices: ml.map(s => s.voice), text: lines.join(' ').slice(0, 150),
    r: normalizeSearch(romanize([...new Set(lines)].join(' '))),
    addedBy: email, ts: Date.now(),
  };
  await admin.database().ref(`songsAdded/${filename}`).set(entry);
  return { filename, entry };
}

module.exports = { prepareSong, saveSong, romanize, alignManglish, parseMadely, parseBody, validateSong, slidesToFile, htmlToText };
