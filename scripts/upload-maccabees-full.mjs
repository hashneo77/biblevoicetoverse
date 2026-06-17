import { readFileSync } from 'fs';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';

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

async function main() {
  const [mac1, mac2] = data;
  console.log(`Uploading "${mac1.name}" to english/b72...`);
  await set(ref(db, 'english/b72'), mac1);
  console.log('Done.');

  console.log(`Uploading "${mac2.name}" to english/b73...`);
  await set(ref(db, 'english/b73'), mac2);
  console.log('Done.');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
