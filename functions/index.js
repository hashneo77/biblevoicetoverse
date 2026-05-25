const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

setGlobalOptions({ region: 'us-central1' });

const geminiKey = defineSecret('GEMINI_API_KEY');

exports.searchVerses = onCall(
  { secrets: [geminiKey], minInstances: 1 },
  async (request) => {
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
      const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      const parsed = JSON.parse(json);
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
