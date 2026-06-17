/**
 * Uploads chapters 1-10 of 2 Maccabees to english/b73 with real English text.
 * Run: node scripts/upload-2mac-ch1-10.mjs
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
const mac2 = data.find(b => b.name === '2 Maccabees');
if (!mac2) { console.error('2 Maccabees not found in JSON'); process.exit(1); }

async function main() {
  const target = ['ch1','ch2','ch3','ch4','ch5','ch6','ch7','ch8','ch9','ch10'];
  console.log('Uploading 2 Maccabees ch1–10...');
  for (const chKey of target) {
    const verses = mac2.chapters[chKey];
    if (!verses) { console.log(`  ${chKey}: NOT FOUND in JSON, skipping`); continue; }
    const count = Object.keys(verses).length;
    await set(ref(db, `english/b73/chapters/${chKey}`), verses);
    console.log(`  ${chKey}: ${count} verses done`);
  }
  console.log('\n2 Maccabees ch1–10 upload complete.');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
