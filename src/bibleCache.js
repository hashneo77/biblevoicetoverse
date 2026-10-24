// Per-device IndexedDB cache for the processed Bible stores, so the ~18 MB
// Firebase download only happens when bibleVersion/<lang> changes.
const DB_NAME = 'bv-bible-cache'
const STORE = 'bibles'

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function run(mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(req?.result) }
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error) }
  }))
}

// Resolves to { version, store } or null. Never rejects (private mode, blocked storage…).
export function getCachedBible(lang) {
  return run('readonly', s => s.get(lang)).catch(() => null).then(r => r ?? null)
}

export function putCachedBible(lang, version, store) {
  return run('readwrite', s => s.put({ version, store }, lang)).catch(() => {})
}
