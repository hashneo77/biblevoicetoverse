/**
 * Uploads 1 Maccabees and 2 Maccabees to the English Firebase Realtime Database.
 *
 * Strategy:
 *   1. Fetch the chapter/verse structure from the Malayalam DB (b20 = 1 Mac, b21 = 2 Mac)
 *      since Malayalam already has these books with correct verse counts.
 *   2. Build English entries with matching structure, using placeholder verse text
 *      ("1 Maccabees 1:1" etc.) since the remote shows Malayalam text when language=ML.
 *   3. Upload to english/b72 (1 Maccabees) and english/b73 (2 Maccabees).
 *
 * Run: node scripts/upload-maccabees.mjs
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyBkg__6ueuUWRGYZRF8-iqWmzb3OfKn8Mw',
  authDomain: 'biblevoicetoverse.firebaseapp.com',
  databaseURL: 'https://biblevoicetoverse-default-rtdb.firebaseio.com',
  projectId: 'biblevoicetoverse',
  storageBucket: 'biblevoicetoverse.firebasestorage.app',
  messagingSenderId: '817133011749',
  appId: '1:817133011749:web:efc22d1c1ebc54a42790cc',
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function mirrorStructure(mlKey, enKey, englishName) {
  console.log(`\nFetching Malayalam ${mlKey} (${englishName}) chapter structure...`);
  const mlSnap = await get(ref(db, `malayalam/${mlKey}/chapters`));
  const mlChapters = mlSnap.val();
  if (!mlChapters) {
    console.error(`  No Malayalam data found at malayalam/${mlKey}/chapters`);
    return false;
  }

  const chapterKeys = Object.keys(mlChapters).sort((a, b) => {
    return parseInt(a.replace('ch', '')) - parseInt(b.replace('ch', ''));
  });

  console.log(`  Found ${chapterKeys.length} chapters`);

  // Build English entry with matching verse structure, placeholder text
  const chaptersEn = {};
  for (const chKey of chapterKeys) {
    const verseKeys = Object.keys(mlChapters[chKey] || {})
      .filter(k => !isNaN(Number(k)))
      .sort((a, b) => Number(a) - Number(b));

    chaptersEn[chKey] = {};
    const chNum = chKey.replace('ch', '');
    for (const v of verseKeys) {
      chaptersEn[chKey][v] = `${englishName} ${chNum}:${v}`;
    }
    console.log(`  ${chKey}: ${verseKeys.length} verses`);
  }

  const entry = { name: englishName, chapters: chaptersEn };

  console.log(`Uploading to english/${enKey}...`);
  await set(ref(db, `english/${enKey}`), entry);
  console.log(`  Done: english/${enKey} = ${englishName}`);
  return true;
}

async function main() {
  try {
    // Check what keys are already used in English
    const enSnap = await get(ref(db, 'english'));
    const enKeys = enSnap.val() ? Object.keys(enSnap.val()) : [];
    console.log(`English DB has ${enKeys.length} books`);

    const usedNums = new Set(enKeys.map(k => parseInt(k.replace('b', ''))));

    // Find two free keys starting at 72
    let next = 72;
    while (usedNums.has(next)) next++;
    const key1Mac = `b${next}`;
    next++;
    while (usedNums.has(next)) next++;
    const key2Mac = `b${next}`;

    console.log(`Using ${key1Mac} for 1 Maccabees, ${key2Mac} for 2 Maccabees`);

    // Malayalam b20 = 1 Maccabees, b21 = 2 Maccabees
    await mirrorStructure('b20', key1Mac, '1 Maccabees');
    await mirrorStructure('b21', key2Mac, '2 Maccabees');

    console.log('\nAll done!');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
