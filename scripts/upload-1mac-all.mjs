/**
 * Uploads all 16 chapters of 1 Maccabees to english/b72 with real English text.
 * Run: node scripts/upload-1mac-all.mjs
 */
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';
import { readFileSync } from 'fs';

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

const data = JSON.parse(readFileSync('./scripts/maccabees.json', 'utf-8'));
const mac1 = data.find(b => b.name === '1 Maccabees');
if (!mac1) { console.error('1 Maccabees not found in JSON'); process.exit(1); }

async function main() {
  const chKeys = Object.keys(mac1.chapters).sort((a, b) =>
    parseInt(a.replace('ch','')) - parseInt(b.replace('ch',''))
  );
  console.log(`Uploading 1 Maccabees (${chKeys.length} chapters)...`);
  for (const chKey of chKeys) {
    const verses = mac1.chapters[chKey];
    const count = Object.keys(verses).length;
    await set(ref(db, `english/b72/chapters/${chKey}`), verses);
    console.log(`  ${chKey}: ${count} verses done`);
  }
  console.log('\n1 Maccabees upload complete.');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
