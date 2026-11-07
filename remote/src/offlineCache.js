// Per-device IndexedDB cache for the large data the apps reuse — the Holy Mass books, the song
// list and song lyrics — so they aren't downloaded again on every visit or on a weak connection.
// NOTE: copy of src/offlineCache.js — keep the two in sync.
import { ref, get, set } from 'firebase/database'
import { ref as storageRef, getBytes } from 'firebase/storage'
import { db, storage } from './firebase'

const DB_NAME = 'bv-offline-cache'
const STORE = 'kv'

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function run(mode, fn) {
  return open().then(idb => new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { idb.close(); resolve(req?.result) }
    tx.onerror = tx.onabort = () => { idb.close(); reject(tx.error) }
  }))
}

// Never reject (private mode, blocked storage…): the apps then just download as before
const getCached = (key) => run('readonly', s => s.get(key)).catch(() => null).then(r => r ?? null)
const putCached = (key, value) => run('readwrite', s => s.put(value, key)).catch(() => {})

// ── Holy Mass books ──────────────────────────────────────────────────────────
// holyMassVersion/<book> changes whenever that book is edited; the saved copy is used while it matches.
export const massVersionPath = (path) => `holyMassVersion/${path.split('/').pop()}`
export const bumpMassVersion = (path) => set(ref(db, massVersionPath(path)), Date.now()).catch(() => {})

export async function loadMassBook(path, version) {
  const key = `mass:${path}`
  const cached = await getCached(key)
  if (cached && version != null && cached.version === version) return cached.data
  const data = (await get(ref(db, path))).val() || {}
  putCached(key, { version, data })
  return data
}

// ── Song list ────────────────────────────────────────────────────────────────
// Returns the saved copy at once and checks the server in the background (a tiny "not modified"
// reply when unchanged); onUpdate gets the new list if songs were added. First visit downloads it.
export async function loadSongsManifest(onUpdate) {
  const cached = await getCached('songs-manifest')
  const refresh = (async () => {
    try {
      const res = await fetch('/songs-manifest.json', { cache: 'no-cache' })
      if (!res.ok) return null
      const etag = res.headers.get('etag')
      if (cached && etag && cached.etag === etag) return null
      const data = await res.json()
      putCached('songs-manifest', { etag, data })
      return data
    } catch { return null }   // offline
  })()
  if (cached) {
    refresh.then(data => { if (data) onUpdate?.(data) })
    return cached.data
  }
  return refresh
}

// ── Song lyrics ──────────────────────────────────────────────────────────────
// The saved copy is shown at once and refreshed from Storage in the background for next time.
// Rejects when the file doesn't exist (e.g. no Manglish version) and nothing is saved.
export async function loadLyrics(path) {
  const key = `lyrics:${path}`
  const fresh = getBytes(storageRef(storage, path)).then(bytes => {
    const text = new TextDecoder('utf-8').decode(bytes)
    putCached(key, text)
    return text
  })
  const cached = await getCached(key)
  if (cached != null) { fresh.catch(() => {}); return cached }
  return fresh
}

export const saveLyricsCopy = (path, text) => putCached(`lyrics:${path}`, text)
