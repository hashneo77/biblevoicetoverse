const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');

setGlobalOptions({ region: 'us-central1' });
admin.initializeApp();

// ── Access: the owner + emails listed under config/access in the Realtime Database ──
const OWNER_EMAIL = 'josephgeorge7797@gmail.com';
const emailKey = email => email.trim().toLowerCase().replace(/\./g, ',');

async function isAllowedEmail(email) {
  if (!email) return false;
  if (email.toLowerCase() === OWNER_EMAIL) return true;
  const snap = await admin.database().ref(`config/access/${emailKey(email)}`).get();
  return snap.exists();
}

// Every function requires a signed-in, verified Google account on the allow-list.
async function requireAllowed(request) {
  const token = request.auth?.token;
  if (!token || !token.email_verified || !(await isAllowedEmail(token.email))) {
    throw new HttpsError('permission-denied', 'This account does not have access.');
  }
  return token.email.toLowerCase();
}

// Sets the `allowed` custom claim that Storage rules check (Storage can't read the allow-list).
// The apps call this after sign-in, then refresh their ID token.
exports.syncAccess = onCall(async (request) => {
  const token = request.auth?.token;
  if (!token) throw new HttpsError('unauthenticated', 'Sign in first.');
  const allowed = !!token.email_verified && (await isAllowedEmail(token.email));
  await admin.auth().setCustomUserClaims(request.auth.uid, { allowed });
  return { allowed };
});

// Owner only: add or remove an allowed email. Removing also clears the claim and signs them out.
exports.manageAccess = onCall(async (request) => {
  const token = request.auth?.token;
  if (!token || !token.email_verified || token.email.toLowerCase() !== OWNER_EMAIL) {
    throw new HttpsError('permission-denied', 'Only the owner can manage access.');
  }
  const email = String(request.data?.email || '').trim().toLowerCase();
  const action = request.data?.action;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email === OWNER_EMAIL) {
    throw new HttpsError('invalid-argument', 'Enter a valid email (not the owner).');
  }
  const ref = admin.database().ref(`config/access/${emailKey(email)}`);
  if (action === 'add') {
    await ref.set({ email, addedAt: Date.now() });
  } else if (action === 'remove') {
    await ref.remove();
    try {
      const user = await admin.auth().getUserByEmail(email);
      await admin.auth().setCustomUserClaims(user.uid, { allowed: false });
      await admin.auth().revokeRefreshTokens(user.uid);
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
    }
  } else {
    throw new HttpsError('invalid-argument', "action must be 'add' or 'remove'");
  }
  return { ok: true };
});

const geminiKey = defineSecret('GEMINI_API_KEY');

exports.searchSongs = onCall(
  { secrets: [geminiKey] },
  async (request) => {
    await requireAllowed(request);
    const { query, songs } = request.data;
    if (!query || typeof query !== 'string' || !query.trim()) {
      throw new HttpsError('invalid-argument', 'query is required');
    }
    if (!Array.isArray(songs) || songs.length === 0) {
      throw new HttpsError('invalid-argument', 'songs list is required');
    }

    const genAI = new GoogleGenerativeAI(geminiKey.value());
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 300,
        temperature: 0,
      },
    });

    const songList = songs.map(s => `${s.title} [${s.filename}]`).join('\n');

    const prompt = `You are helping search a library of Malayalam Christian songs.

User query: "${query.trim()}"

The query may be:
- A song title in English or Manglish (romanized Malayalam)
- A lyric line in Manglish (e.g. "snehaagniyay padarnnidasane")
- A description of the song's theme

Songs (format: "Title [filename]"):
${songList}

Return a JSON array of up to 5 matching filenames (exact filename from brackets), best match first.
Return [] if nothing matches. Return ONLY the JSON array, no other text.`;

    try {
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim();
      const start = raw.indexOf('[');
      const end = raw.lastIndexOf(']');
      if (start === -1 || end === -1) return { filenames: [] };
      const filenames = JSON.parse(raw.slice(start, end + 1));
      return { filenames: Array.isArray(filenames) ? filenames.slice(0, 5) : [] };
    } catch (e) {
      throw new HttpsError('internal', 'Song search failed: ' + e.message);
    }
  }
);

exports.parseVoiceRef = onCall(
  { secrets: [geminiKey] },
  async (request) => {
    await requireAllowed(request);
    const { transcript, bookNames } = request.data;
    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      throw new HttpsError('invalid-argument', 'transcript is required');
    }

    const genAI = new GoogleGenerativeAI(geminiKey.value());
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 150,
        temperature: 0,
      },
    });

    const books = Array.isArray(bookNames) && bookNames.length > 0
      ? bookNames.join(', ')
      : 'Genesis, Exodus, Psalms, Proverbs, Isaiah, Matthew, Mark, Luke, John, Acts, Romans, 1 Corinthians, Galatians, Ephesians, Philippians, Colossians, Hebrews, James, Revelation';

    const prompt = `You are a Bible reference parser. The user spoke a Bible verse reference using voice input. The speech may be in English, Malayalam, Manglish (romanized Malayalam), or a mix.

Extract the Bible book, chapter, and verse from this transcript.

Transcript: "${transcript.trim()}"

Rules:
- Return the book name in ENGLISH, using ONLY names from this list: ${books}
- Malayalam book names must be mapped to their English equivalent (e.g. ഉല്പത്തി → Genesis, യോഹന്നാൻ → John, സങ്കീർത്തനങ്ങൾ → Psalms)
- If the transcript says a chapter but no verse, default verse to 1
- If you cannot identify a valid Bible reference, return null

Return ONLY a JSON object: {"book":"English Name","chapter":1,"verse":1}
Or null if not parseable. No other text.`;

    try {
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim();
      if (raw === 'null' || raw === '{}') return { ref: null };
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start === -1 || end === -1) return { ref: null };
      const parsed = JSON.parse(raw.slice(start, end + 1));
      if (!parsed?.book || !parsed?.chapter) return { ref: null };
      return {
        ref: {
          book: parsed.book,
          chapter: Number(parsed.chapter),
          verse: Number(parsed.verse) || 1,
        },
      };
    } catch (e) {
      throw new HttpsError('internal', 'Voice parse failed: ' + e.message);
    }
  }
);

exports.searchVerses = onCall(
  { secrets: [geminiKey], minInstances: 1 },
  async (request) => {
    await requireAllowed(request);
    const { query, bookNames, includeCCC } = request.data;

    if (!query || typeof query !== 'string' || !query.trim()) {
      throw new HttpsError('invalid-argument', 'query is required.');
    }

    const genAI = new GoogleGenerativeAI(geminiKey.value());
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 768,
        temperature: 0.1,
      },
    });

    const books = Array.isArray(bookNames) && bookNames.length > 0
      ? bookNames.join(', ')
      : 'Genesis, Exodus, Psalms, Proverbs, Isaiah, Matthew, Mark, Luke, John, Acts, Romans, 1 Corinthians, Galatians, Ephesians, Philippians, Colossians, Hebrews, James, Revelation';

    const cccInstruction = includeCCC
      ? `\n\nIf the query is specifically about the Catechism of the Catholic Church (CCC) or doctrine, also include relevant CCC paragraphs (numbered 1–2865). For CCC results use: {"type":"ccc","paragraph":NNN,"reason":"..."}`
      : '';

    const prompt = `You are a Catholic Bible scholar with deep knowledge of all 73 books of the Catholic canon, including the deuterocanonical books: Tobit, Judith, 1 Maccabees, 2 Maccabees, Wisdom, Sirach, and Baruch.

Find the 5 most spiritually relevant results for this search query. Actively consider deuterocanonical books when relevant.${cccInstruction}

Query: "${query.trim()}"

For Bible results use ONLY book names from this list: ${books}
Bible result format: {"type":"bible","book":"Exact Book Name","chapter":1,"verse":1,"reason":"one sentence"}

Return ONLY a JSON array, no markdown, no extra text.`;

    try {
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim();
      const start = raw.indexOf('[');
      const end = raw.lastIndexOf(']');
      if (start === -1 || end === -1) throw new Error('No JSON array in response');
      const parsed = JSON.parse(raw.slice(start, end + 1));
      if (!Array.isArray(parsed)) throw new Error('Response was not a JSON array');
      // Normalise older format (no type field) to bible
      const normalised = parsed.slice(0, 7).map(r => ({
        type: r.type || 'bible',
        ...r,
      }));
      return { refs: normalised };
    } catch (e) {
      throw new HttpsError('internal', 'AI search failed: ' + e.message);
    }
  }
);
