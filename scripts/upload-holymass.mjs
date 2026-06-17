/**
 * Uploads all images from public/holymass/ to Firebase Storage (holy-mass/)
 * and registers them in RTDB at remote/holyMassLibrary.
 * Keyed by filename stem (page_001 … page_544) so re-runs are idempotent.
 * Run: node scripts/upload-holymass.mjs
 */
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename, extname } from 'path';

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
const storage = getStorage(app);

const HOLYMASS_DIR = './public/holymass';
const CONCURRENCY = 4;

async function main() {
  const files = readdirSync(HOLYMASS_DIR)
    .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .sort();

  console.log(`Found ${files.length} images in public/holymass/`);

  // Fetch existing RTDB keys to skip already-uploaded files
  const existingSnap = await get(ref(db, 'remote/holyMassLibrary'));
  const existing = new Set(Object.keys(existingSnap.val() || {}));
  const toUpload = files.filter(f => !existing.has(basename(f, extname(f))));
  console.log(`Already uploaded: ${existing.size}  |  To upload: ${toUpload.length}`);

  let done = 0;

  // Process in batches of CONCURRENCY
  for (let i = 0; i < toUpload.length; i += CONCURRENCY) {
    const batch = toUpload.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (filename) => {
      const key = basename(filename, extname(filename)); // e.g. "page_001"
      const pageNum = parseInt(key.replace(/\D+/g, ''), 10);
      const localPath = join(HOLYMASS_DIR, filename);
      const bytes = readFileSync(localPath);
      const ext = extname(filename).slice(1).toLowerCase();
      const contentType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/webp';

      const fileRef = storageRef(storage, `holy-mass/${filename}`);
      await uploadBytes(fileRef, bytes, { contentType });
      const url = await getDownloadURL(fileRef);
      await set(ref(db, `remote/holyMassLibrary/${key}`), {
        type: 'image',
        url,
        name: filename,
        ts: pageNum,
      });
      done++;
      process.stdout.write(`\r  ${done}/${toUpload.length} uploaded (${filename})`);
    }));
  }

  console.log(`\n\nDone! ${files.length} Holy Mass images registered.`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
