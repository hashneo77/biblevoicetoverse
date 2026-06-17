// Uploads all .txt files from public/lyrics-text/ to Firebase Storage.
// Run: node scripts/upload-lyrics-to-storage.mjs
// Requires Node.js 18+ (uses built-in fetch).

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadString } from 'firebase/storage';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = initializeApp({
  apiKey: 'AIzaSyBkg__6ueuUWRGYZRF8-iqWmzb3OfKn8Mw',
  authDomain: 'biblevoicetoverse.firebaseapp.com',
  projectId: 'biblevoicetoverse',
  storageBucket: 'biblevoicetoverse.firebasestorage.app',
  appId: '1:817133011749:web:efc22d1c1ebc54a42790cc',
});

const storage = getStorage(app);
const lyricsDir = join(__dirname, '../public/lyrics-text');
const files = readdirSync(lyricsDir).filter(f => f.endsWith('.txt'));

console.log(`Uploading ${files.length} files to Firebase Storage…`);

let done = 0;
let failed = 0;
const BATCH = 20;

for (let i = 0; i < files.length; i += BATCH) {
  const batch = files.slice(i, i + BATCH);
  await Promise.all(batch.map(async (filename) => {
    try {
      const content = readFileSync(join(lyricsDir, filename), 'utf-8');
      const fileRef = ref(storage, `lyrics-text/${filename}`);
      await uploadString(fileRef, content, 'raw', { contentType: 'text/plain; charset=utf-8' });
      done++;
    } catch (e) {
      failed++;
      console.error(`\nFailed: ${filename} — ${e.message}`);
    }
  }));
  process.stdout.write(`\r${done}/${files.length} uploaded, ${failed} failed`);
}

console.log(`\nDone! ${done} uploaded, ${failed} failed.`);
