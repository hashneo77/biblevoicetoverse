import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ref, set, push, onValue, get } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { ref as storageRef, getBytes, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, functions, storage, DB_URL } from './firebase';
import './App.css';

// PIN → Firebase path prefix mapping. '123456' keeps the existing 'remote' namespace
// (backward compatible); '654321' uses a separate 'session2' namespace.
const SESSIONS = { '123456': 'remote', '654321': 'session2' };
const SESSION_KEY = 'bv_remote_session';
const SESSION_TS_KEY = 'bv_remote_session_ts';
const SESSION_MS = 10 * 60 * 60 * 1000; // 10 hours

function getSavedSession() {
  const ts = Number(localStorage.getItem(SESSION_TS_KEY) || 0);
  if (Date.now() - ts > SESSION_MS) return null;
  return localStorage.getItem(SESSION_KEY);
}

const OT_BOOKS = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra',
  'Nehemiah','Tobit','Judith','Esther','1 Maccabees','2 Maccabees','Job','Psalms',
  'Proverbs','Ecclesiastes','Song of Solomon','Wisdom','Sirach','Isaiah','Jeremiah',
  'Lamentations','Baruch','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah',
  'Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi',
];

const NT_BOOKS = [
  'Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians',
  'Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians',
  '1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter',
  '1 John','2 John','3 John','Jude','Revelation',
];

const ALL_BOOKS = [...OT_BOOKS, ...NT_BOOKS];

// Malayalam book names, keyed by the exact English names used above.
// NOTE: the Malayalam Bible in Firebase uses the same b1..b73 key scheme as the
// English Bible, but the books are stored in a different order/count — so the
// keys do NOT line up across languages (e.g. malayalam/b69 is "1 John", while
// english/b69 is "Tobit"). A static name-keyed map avoids that mismatch entirely.
const BOOK_NAME_ML = {
  'Genesis': 'ഉല്പത്തി',
  'Exodus': 'പുറപ്പാടു്',
  'Leviticus': 'ലേവ്യ',
  'Numbers': 'സംഖ്യ',
  'Deuteronomy': 'നിയമവാർത്തനം',
  'Joshua': 'ജോഷ്വാ',
  'Judges': 'ന്യായാധിപന്മാർ',
  'Ruth': 'റൂത്ത്',
  '1 Samuel': '1 സാമുവേൽ',
  '2 Samuel': '2 സാമുവേൽ',
  '1 Kings': '1 രാജാക്കന്മാർ',
  '2 Kings': '2 രാജാക്കന്മാർ',
  '1 Chronicles': '1 ദിനവൃത്താന്തം',
  '2 Chronicles': '2 ദിനവൃത്താന്തം',
  'Ezra': 'എസ്രാ',
  'Nehemiah': 'നെഹമിയ',
  'Tobit': 'തോബിത്ത്',
  'Judith': 'യൂദിത്ത്',
  'Esther': 'എസ്തേർ',
  '1 Maccabees': '1 മക്കബായർ',
  '2 Maccabees': '2 മക്കബായർ',
  'Job': 'ജോബ്',
  'Psalms': 'സങ്കീർത്തനങ്ങൾ',
  'Proverbs': 'സുഭാഷിതങ്ങൾ',
  'Ecclesiastes': 'സഭാപ്രസംഗകൻ',
  'Song of Solomon': 'ഉത്തമഗീതം',
  'Wisdom': 'ജ്ഞാനം',
  'Sirach': 'പ്രഭാഷകൻ',
  'Isaiah': 'ഏശയ്യാ',
  'Jeremiah': 'ജെറെമിയ',
  'Lamentations': 'വിലാപങ്ങൾ',
  'Baruch': 'ബാറൂക്ക്',
  'Ezekiel': 'എസെക്കിയേല്‍',
  'Daniel': 'ദാനിയേൽ',
  'Hosea': 'ഹോസിയാ',
  'Joel': 'ജോയേൽ',
  'Amos': 'ആമോസ്',
  'Obadiah': 'ഓബദിയ',
  'Jonah': 'യോനാ',
  'Micah': 'മിക്കാ',
  'Nahum': 'നാഹും',
  'Habakkuk': 'ഹബക്കുക്ക്',
  'Zephaniah': 'സെഫാനിയ',
  'Haggai': 'ഹഗ്ഗായി',
  'Zechariah': 'സഖറിയാ',
  'Malachi': 'മലാക്കി',
  'Matthew': 'മത്തായി',
  'Mark': 'മർക്കോസ്',
  'Luke': 'ലൂക്കാ',
  'John': 'യോഹന്നാൻ',
  'Acts': 'അപ്പൊസ്തലന്മാരുടെ പ്രവർത്തനങ്ങൾ',
  'Romans': 'റോമാക്കാർക്ക്',
  '1 Corinthians': '1 കോറിന്തോസുകാർക്ക്',
  '2 Corinthians': '2 കോറിന്തോസുകാർക്ക്',
  'Galatians': 'ഗലാത്തിയാക്കാർക്ക്',
  'Ephesians': 'എഫേസോസുകാർക്ക്',
  'Philippians': 'ഫിലിപ്പിയർക്ക്',
  'Colossians': 'കൊളോസ്സുകാർക്ക്',
  '1 Thessalonians': '1 തെസ്സലോനിക്കാക്കാർക്ക്',
  '2 Thessalonians': '2 തെസ്സലോനിക്കാക്കാർക്ക്',
  '1 Timothy': '1 തിമോത്തേയോസിന്',
  '2 Timothy': '2 തിമോത്തേയോസിന്',
  'Titus': 'തീത്തോസിന്',
  'Philemon': 'ഫിലേമോന്',
  'Hebrews': 'ഹെബ്രായർക്ക്',
  'James': 'യാക്കോബ്',
  '1 Peter': '1 പത്രോസ്',
  '2 Peter': '2 പത്രോസ്',
  '1 John': '1 യോഹന്നാൻ',
  '2 John': '2 യോഹന്നാൻ',
  '3 John': '3 യോഹന്നാൻ',
  'Jude': 'യൂദാ',
  'Revelation': 'വെളിപാട്',
};

const restFetch = async (path, shallow = false) => {
  const qs = shallow ? '?shallow=true' : '';
  const res = await fetch(`${DB_URL}/${path}.json${qs}`);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
};

function normalizeSearch(s) {
  return s.toLowerCase().replace(/(.)\1+/g, '$1').replace(/\s+/g, ' ').trim();
}

function parseLyrics(content) {
  const lines = content.split(/\r?\n/);
  const title = lines[0]?.trim() || '';
  const slides = [];
  let current = null;
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === 'M' || trimmed === 'F' || trimmed === 'A') {
      if (current) { const text = current.text.trimEnd(); if (text) slides.push({ voice: current.voice, text }); }
      current = { voice: trimmed, text: '' };
    } else if (current) {
      current.text += line + '\n';
    }
  }
  if (current) { const text = current.text.trimEnd(); if (text) slides.push({ voice: current.voice, text }); }
  return { title, slides };
}

export default function App() {
  const [sessionPrefix, setSessionPrefix] = useState(() => getSavedSession());

  // Short alias — all Firebase paths use this prefix instead of hard-coded 'remote'
  const P = sessionPrefix || 'remote';

  const signOut = () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_TS_KEY);
    setSessionPrefix(null);
  };

  const [allBooks, setAllBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [nameToKey, setNameToKey] = useState({});

  const [view, setView] = useState('testament');
  const [testament, setTestament] = useState(null);
  const [bookSearch, setBookSearch] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedBookKey, setSelectedBookKey] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [verses, setVerses] = useState([]);
  const [versesLoading, setVersesLoading] = useState(false);

  // CCC navigation
  const CCC_TOTAL = 2865;
  const CCC_RANGE_SIZE = 100;
  const cccRanges = useMemo(() => Array.from(
    { length: Math.ceil(CCC_TOTAL / CCC_RANGE_SIZE) },
    (_, i) => ({ start: i * CCC_RANGE_SIZE + 1, end: Math.min((i + 1) * CCC_RANGE_SIZE, CCC_TOTAL) })
  ), []);
  const [selectedCccRange, setSelectedCccRange] = useState(null);

  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);
  const [frozen, setFrozen] = useState(false);

  // Recently sent items — synced via Firebase shared with the main webapp
  const RECENT_ITEMS_PATH = `${P}/recentItems`;
  const [recentSent, setRecentSent] = useState([]);

  useEffect(() => {
    return onValue(ref(db, RECENT_ITEMS_PATH), snap => {
      const val = snap.val() || {};
      const list = Object.entries(val)
        .map(([fbKey, data]) => ({ ...data, fbKey }))
        .filter(item => item.type !== 'song')
        .sort((a, b) => (b.ts || 0) - (a.ts || 0))
        .slice(0, 100);
      setRecentSent(list);
    });
  }, []);

  const pushRecentSent = (item) => {
    push(ref(db, RECENT_ITEMS_PATH), { ...item, ts: Date.now() });
  };

  const [language, setLanguage] = useState('EN');
  const [theme, setTheme] = useState('light');

  // AI search — calls searchVerses Cloud Function directly (same as the web app)
  const searchVersesCallable = useMemo(() => httpsCallable(functions, 'searchVerses'), []);
  const [searchView, setSearchView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState(null);

  // Songs
  const [songsView, setSongsView] = useState(false);
  const [songsManifest, setSongsManifest] = useState(null);
  const [songsManifestLoading, setSongsManifestLoading] = useState(false);
  const [songQuery, setSongQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState(null); // { filename, title, slides }
  const [songSlidesLoading, setSongSlidesLoading] = useState(false);
  const [songAiLoading, setSongAiLoading] = useState(false);
  const [songAiResults, setSongAiResults] = useState(null); // null = not run yet
  const searchSongsCallable = useMemo(() => httpsCallable(functions, 'searchSongs'), []);

  // Active slide tracking (for green glow highlight) — driven by remote/liveSlide
  // which the main app writes on every slide change including nav button presses.
  const [activeSongSlide, setActiveSongSlide] = useState(null); // { filename, slideIdx }
  const [activeVerse, setActiveVerse] = useState(null); // { book, chapter, verse }

  useEffect(() => {
    return onValue(ref(db, `${P}/liveSlide`), snap => {
      const val = snap.val();
      if (!val) return;
      if (val.type === 'song' && val.filename != null && val.slideIdx != null) {
        setActiveSongSlide({ filename: val.filename, slideIdx: val.slideIdx });
        setActiveVerse(null);
      } else if (val.type === 'verse' && val.book && val.chapter != null && val.verse != null) {
        setActiveVerse({ book: val.book, chapter: Number(val.chapter), verse: Number(val.verse) });
        setActiveSongSlide(null);
      }
    });
  }, []);

  // Media
  const [mediaView, setMediaView] = useState(false);
  const [mediaLibrary, setMediaLibrary] = useState([]); // [{ key, type, url?, name?, html?, text?, ts }]
  const [mediaUploading, setMediaUploading] = useState(false);

  // Holy Mass
  const [holyMassView, setHolyMassView] = useState(false);
  const [holyMassLibrary, setHolyMassLibrary] = useState([]);
  const [holyMassUploading, setHolyMassUploading] = useState(false);
  const [activeHolyMassKey, setActiveHolyMassKey] = useState(null);
  const [showTextForm, setShowTextForm] = useState(false);
  const [editingMediaKey, setEditingMediaKey] = useState(null);
  const textEditorRef = useRef(null);

  // Background image
  const [activeBg, setActiveBg] = useState(null); // { url, name, opacity }
  const [bgOpacityLocal, setBgOpacityLocal] = useState(20); // 0–100 %

  const fmt = (cmd, value) => {
    document.execCommand(cmd, false, value ?? null);
    textEditorRef.current?.focus();
  };

  const startEditText = (item) => {
    setEditingMediaKey(item.key);
    setShowTextForm(true);
    setTimeout(() => {
      if (textEditorRef.current) {
        textEditorRef.current.innerHTML = item.html || item.text || '';
        textEditorRef.current.focus();
      }
    }, 30);
  };

  useEffect(() => {
    return onValue(ref(db, `${P}/bgImage`), snap => {
      const val = snap.val();
      if (!val) { setActiveBg(null); return; }
      setActiveBg(val);
      setBgOpacityLocal(Math.round((val.opacity ?? 0.2) * 100));
    });
  }, []);

  const setAsBg = async (item) => {
    try {
      await set(ref(db, `${P}/bgImage`), { url: item.url, name: item.name, opacity: bgOpacityLocal / 100, ts: Date.now() });
    } catch (e) { setError('Set BG failed: ' + e.message); }
  };

  const clearBg = async () => {
    try { await set(ref(db, `${P}/bgImage`), null); }
    catch (e) { setError('Clear BG failed: ' + e.message); }
  };

  const updateBgOpacity = async (pct) => {
    setBgOpacityLocal(pct);
    if (!activeBg) return;
    try { await set(ref(db, `${P}/bgImage/opacity`), pct / 100); }
    catch { /* ignore */ }
  };

  useEffect(() => {
    return onValue(ref(db, `${P}/mediaLibrary`), snap => {
      const val = snap.val() || {};
      const items = Object.entries(val)
        .map(([key, data]) => ({ key, ...data }))
        .sort((a, b) => (b.ts || 0) - (a.ts || 0));
      setMediaLibrary(items);
    });
  }, []);

  useEffect(() => {
    return onValue(ref(db, `${P}/holyMassLibrary`), snap => {
      const val = snap.val() || {};
      const items = Object.entries(val)
        .map(([key, data]) => ({ key, ...data }))
        .sort((a, b) => (a.ts || 0) - (b.ts || 0));
      setHolyMassLibrary(items);
    });
  }, []);

  const uploadMedia = async (file) => {
    if (!file) return;
    setMediaUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const fileRef = storageRef(storage, `media/${filename}`);
      await uploadBytes(fileRef, file, { contentType: file.type });
      const url = await getDownloadURL(fileRef);
      await push(ref(db, `${P}/mediaLibrary`), { type: 'image', url, name: file.name, ts: Date.now() });
    } catch (e) {
      setError('Upload failed: ' + e.message);
    } finally {
      setMediaUploading(false);
    }
  };

  const addTextSlide = async () => {
    const el = textEditorRef.current;
    if (!el) return;
    const html = el.innerHTML.trim();
    const text = el.innerText.trim();
    if (!text) return;
    try {
      if (editingMediaKey) {
        await set(ref(db, `${P}/mediaLibrary/${editingMediaKey}`), { type: 'text', html, text, ts: Date.now() });
        setEditingMediaKey(null);
      } else {
        await push(ref(db, `${P}/mediaLibrary`), { type: 'text', html, text, ts: Date.now() });
      }
      el.innerHTML = '';
      setShowTextForm(false);
    } catch (e) { setError('Save failed: ' + e.message); }
  };

  const sendMedia = async (item) => {
    try {
      const payload = item.type === 'text'
        ? { type: 'text', html: item.html || item.text, text: item.text, ts: Date.now() }
        : { type: 'image', url: item.url, name: item.name, ts: Date.now() };
      await set(ref(db, `${P}/currentMedia`), payload);
      const label = item.type === 'text' ? item.text.slice(0, 30) : item.name;
      setSent(label);
      setTimeout(() => setSent(null), 2000);
    } catch (e) { setError('Send failed: ' + e.message); }
  };

  const clearMediaScreen = async () => {
    try { await set(ref(db, `${P}/currentMedia`), { type: 'clear', ts: Date.now() }); }
    catch (e) { setError('Clear failed: ' + e.message); }
  };

  const deleteMedia = async (item) => {
    try {
      if (item.type === 'image') {
        const path = decodeURIComponent(item.url.split('/o/')[1].split('?')[0]);
        await deleteObject(storageRef(storage, path));
      }
      await set(ref(db, `${P}/mediaLibrary/${item.key}`), null);
    } catch (e) { setError('Delete failed: ' + e.message); }
  };

  const uploadHolyMass = async (file) => {
    if (!file) return;
    setHolyMassUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const fileRef = storageRef(storage, `holy-mass/${filename}`);
      await uploadBytes(fileRef, file, { contentType: file.type });
      const url = await getDownloadURL(fileRef);
      await push(ref(db, `${P}/holyMassLibrary`), { type: 'image', url, name: file.name, ts: Date.now() });
    } catch (e) {
      setError('Upload failed: ' + e.message);
    } finally {
      setHolyMassUploading(false);
    }
  };

  const deleteHolyMass = async (item) => {
    try {
      const path = decodeURIComponent(item.url.split('/o/')[1].split('?')[0]);
      await deleteObject(storageRef(storage, path));
      await set(ref(db, `${P}/holyMassLibrary/${item.key}`), null);
      if (activeHolyMassKey === item.key) setActiveHolyMassKey(null);
    } catch (e) { setError('Delete failed: ' + e.message); }
  };

  const sendHolyMassImage = async (item) => {
    setActiveHolyMassKey(item.key);
    await sendMedia(item);
  };

  const navigateHolyMass = (dir) => {
    if (holyMassLibrary.length === 0) return;
    const idx = activeHolyMassKey
      ? holyMassLibrary.findIndex(i => i.key === activeHolyMassKey)
      : -1;
    const nextIdx = dir === 'prev'
      ? Math.max(0, idx === -1 ? 0 : idx - 1)
      : Math.min(holyMassLibrary.length - 1, idx + 1);
    if (nextIdx !== idx || idx === -1) sendHolyMassImage(holyMassLibrary[nextIdx]);
  };

  // Scroll active Holy Mass image into view when it changes
  useEffect(() => {
    if (!activeHolyMassKey || !holyMassView) return;
    requestAnimationFrame(() => {
      const el = document.querySelector('.holy-mass-active');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [activeHolyMassKey, holyMassView]);

  // ── Book loading ──────────────────────────────────────────────────────────
  const loadBooks = useCallback(async () => {
    setBooksLoading(true);
    setError(null);
    try {
      const bookKeys = await restFetch('english', true);
      const keys = Object.keys(bookKeys || {});
      const names = await Promise.all(keys.map(k => restFetch(`english/${k}/name`)));
      const map = {};
      const list = keys
        .map((k, i) => ({ key: k, name: names[i], nameML: BOOK_NAME_ML[names[i]] || '' }))
        .filter(b => typeof b.name === 'string');
      list.forEach(b => { map[b.name] = b.key; });
      setNameToKey(map);
      setAllBooks(list);
    } catch (e) {
      setError('Could not load books: ' + e.message);
    } finally {
      setBooksLoading(false);
    }
  }, []);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  // ── AI Search ─────────────────────────────────────────────────────────────
  // Calls searchVerses directly — same Cloud Function the web app uses.
  // No Firebase relay, no TF-IDF prefilter — full AI quality + CCC support.
  const submitSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;

    const wantsCCC = /\bccc\b/i.test(q);
    setSearchLoading(true);
    setSearchResults(null);

    try {
      const result = await searchVersesCallable({
        query: q,
        bookNames: ALL_BOOKS,
        includeCCC: wantsCCC,
      });

      const refs = result.data?.refs || [];

      // Fetch the actual text for each result in parallel (REST, no auth needed)
      const enriched = await Promise.all(refs.map(async r => {
        if (r.type === 'ccc') {
          let text = '';
          try { text = String(await restFetch(`ccc/${r.paragraph}`) ?? ''); } catch { /* offline */ }
          return { type: 'ccc', ref: `CCC #${r.paragraph}`, paragraph: r.paragraph, text, reason: r.reason };
        }
        // Bible verse
        const key = nameToKey[r.book];
        let text = '';
        if (key) {
          try {
            const val = await restFetch(`english/${key}/chapters/ch${r.chapter}/${r.verse}`);
            text = typeof val === 'string' ? val : '';
          } catch { /* offline */ }
        }
        return {
          type: 'bible',
          ref: `${r.book} ${r.chapter}:${r.verse}`,
          book: r.book, chapter: Number(r.chapter), verse: Number(r.verse),
          text, reason: r.reason,
        };
      }));

      setSearchResults(enriched.filter(Boolean));
    } catch (e) {
      setError('Search failed: ' + (e?.message || String(e)));
    } finally {
      setSearchLoading(false);
    }
  };

  // Project a search result onto the presentation screen
  const sendSearchResult = async (result) => {
    try {
      if (result.type === 'ccc') {
        await set(ref(db, `${P}/cccParagraph`), { paragraph: result.paragraph, ts: Date.now() });
        pushRecentSent({ key: result.ref, type: 'ccc', paragraph: result.paragraph, text: result.text || '' });
      } else {
        await set(ref(db, `${P}/currentVerse`), {
          book: result.book, chapter: result.chapter, verse: result.verse,
          timestamp: Date.now(),
        });
        pushRecentSent({ key: result.ref, type: 'bible', book: result.book, chapter: result.chapter, verse: result.verse, text: result.text || '' });
      }
      setSent(result.ref);
      setTimeout(() => setSent(null), 2000);
    } catch (e) {
      setError('Send failed: ' + e.message);
    }
  };

  // ── Bible navigation ──────────────────────────────────────────────────────
  const getBooksForTestament = (t) => {
    const order = t === 'OT' ? OT_BOOKS : NT_BOOKS;
    const nameSet = new Set(allBooks.map(b => b.name));
    return order
      .filter(name => nameSet.has(name))
      .map(name => allBooks.find(b => b.name === name))
      .filter(Boolean);
  };

  const selectTestament = (t) => { setTestament(t); setView('books'); setBookSearch(''); };

  const selectBook = async (name) => {
    const key = nameToKey[name];
    setSelectedBook(name);
    setSelectedBookKey(key);
    setChapters([]);
    setView('chapters');
    setChaptersLoading(true);
    setError(null);
    try {
      const chData = await restFetch(`english/${key}/chapters`, true);
      const chs = Object.keys(chData || {})
        .map(k => k.replace(/^ch/, ''))
        .sort((a, b) => +a - +b);
      setChapters(chs);
    } catch (e) { setError('Could not load chapters: ' + e.message); }
    finally { setChaptersLoading(false); }
  };

  const selectChapter = async (ch) => {
    setSelectedChapter(ch);
    setVerses([]);
    setView('verses');
    setVersesLoading(true);
    setError(null);
    try {
      const vData = await restFetch(`english/${selectedBookKey}/chapters/ch${ch}`, true);
      const vs = Object.keys(vData || {})
        .map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
      setVerses(vs);
    } catch (e) { setError('Could not load verses: ' + e.message); }
    finally { setVersesLoading(false); }
  };

  const sendVerse = async (verse) => {
    const label = `${selectedBook} ${selectedChapter}:${verse}`;
    try {
      await set(ref(db, `${P}/currentVerse`), {
        book: selectedBook, chapter: Number(selectedChapter), verse: Number(verse),
        timestamp: Date.now(),
      });
      let text = '';
      try {
        const val = await restFetch(`english/${selectedBookKey}/chapters/ch${selectedChapter}/${verse}`);
        text = typeof val === 'string' ? val : '';
      } catch { /* offline */ }
      pushRecentSent({ key: label, type: 'bible', book: selectedBook, chapter: Number(selectedChapter), verse: Number(verse), text });
      setSent(label);
      setTimeout(() => setSent(null), 2000);
    } catch (e) { setError('Send failed: ' + e.message); }
  };

  // ── Remote settings ───────────────────────────────────────────────────────
  const sendSetting = async (path, value) => {
    try { await set(ref(db, `${P}/settings/${path}`), value); }
    catch (e) { setError('Setting failed: ' + e.message); }
  };

  const toggleLanguage = () => {
    const next = language === 'EN' ? 'ML' : 'EN';
    setLanguage(next);
    sendSetting('language', next);
  };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    sendSetting('theme', next);
  };

  const sendFontSize = (delta) => sendSetting('fontSizeCmd', { delta, ts: Date.now() });
  const sendNav = (dir) => sendSetting('nav', { dir, ts: Date.now() });

  const sendCccParagraph = async (num) => {
    const label = `CCC #${num}`;
    try {
      await set(ref(db, `${P}/cccParagraph`), { paragraph: num, ts: Date.now() });
      let text = '';
      try { text = String(await restFetch(`ccc/${num}`) ?? ''); } catch { /* offline */ }
      pushRecentSent({ key: label, type: 'ccc', paragraph: num, text });
      setSent(label);
      setTimeout(() => setSent(null), 2000);
    } catch (e) { setError('Send failed: ' + e.message); }
  };

  // Scroll the active (green) verse into view after verse grid loads
  useEffect(() => {
    if (versesLoading || !activeVerse) return;
    requestAnimationFrame(() => {
      const el = document.querySelector('.verse-active');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [versesLoading, activeVerse]);

  // Scroll the active (green) slide into view after song loads
  useEffect(() => {
    if (songSlidesLoading || !selectedSong || !activeSongSlide) return;
    requestAnimationFrame(() => {
      const el = document.querySelector('.slide-active');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [songSlidesLoading, selectedSong, activeSongSlide]);

  // Load manifest eagerly so the locate button works immediately on reopen
  useEffect(() => {
    fetch('/songs-manifest.json', { cache: 'no-cache' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSongsManifest(data); })
      .catch(() => {});
  }, []);

  // ── Songs ─────────────────────────────────────────────────────────────────
  const openSongsView = async () => {
    setSongsView(true);
    setSelectedSong(null);
    setSongQuery('');
    if (!songsManifest) {
      setSongsManifestLoading(true);
      try {
        const res = await fetch('/songs-manifest.json', { cache: 'no-cache' });
        if (res.ok) setSongsManifest(await res.json());
      } catch { /* offline */ }
      finally { setSongsManifestLoading(false); }
    }
  };

  const songResults = useMemo(() => {
    if (!songsManifest || !songQuery.trim()) return songsManifest ? [] : null;
    const q = songQuery.toLowerCase();
    return songsManifest.filter(s => s.title.toLowerCase().includes(q)).slice(0, 20);
  }, [songsManifest, songQuery]);

  const songAiSearch = async () => {
    if (!songQuery.trim() || !songsManifest) return;
    setSongAiLoading(true);
    setSongAiResults(null);
    try {
      const titleList = songsManifest.map(s => ({ filename: s.filename, title: s.title }));
      const result = await searchSongsCallable({ query: songQuery.trim(), songs: titleList });
      const filenames = result.data?.filenames || [];
      const matched = filenames.map(fn => songsManifest.find(s => s.filename === fn)).filter(Boolean);
      setSongAiResults(matched);
      if (matched.length === 0) setError('No songs found. Try a different query.');
    } catch (e) {
      setError('AI search failed: ' + (e?.message || String(e)));
    } finally {
      setSongAiLoading(false);
    }
  };

  const selectSong = async (entry) => {
    setSongSlidesLoading(true);
    try {
      const fileRef = storageRef(storage, `lyrics-text/${entry.filename}.txt`);
      const bytes = await getBytes(fileRef);
      const { title, slides } = parseLyrics(new TextDecoder('utf-8').decode(bytes));
      setSelectedSong({ filename: entry.filename, title: title || entry.title, slides });
    } catch {
      setError('Could not load song: ' + entry.title);
    } finally {
      setSongSlidesLoading(false);
    }
  };

  const sendSongSlide = async (filename, slideIdx, slideText) => {
    const label = `♪ ${selectedSong?.title || filename} (${slideIdx + 1})`;
    try {
      await set(ref(db, `${P}/currentSong`), { filename, slideIdx, ts: Date.now() });
      setSent(label);
      setTimeout(() => setSent(null), 2000);
    } catch (e) { setError('Send failed: ' + e.message); }
  };

  // Re-send a song from the Recent view
  const resendSong = (item) => {
    set(ref(db, `${P}/currentSong`), { filename: item.filename, slideIdx: item.slideIdx ?? 0, ts: Date.now() });
    setSent(item.key);
    setTimeout(() => setSent(null), 2000);
  };

  // Re-send an item from the Recent view
  const resendRecent = (item) => {
    if (item.type === 'song') resendSong(item);
    else if (item.type === 'ccc') sendCccParagraph(item.paragraph);
    else sendSearchResult({ type: 'bible', ref: item.key, book: item.book, chapter: item.chapter, verse: item.verse });
  };

  // Settings view
  const [settingsView, setSettingsView] = useState(false);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goBack = () => {
    if (settingsView) { setSettingsView(false); return; }
    if (mediaView) { setMediaView(false); return; }
    if (holyMassView) { setHolyMassView(false); return; }
    if (songsView) {
      if (selectedSong) { setSelectedSong(null); return; }
      setSongsView(false); setSongQuery(''); return;
    }
    if (searchView) { setSearchView(false); setSearchResults(null); setSearchQuery(''); return; }
    if (view === 'recent')         { setView('testament'); return; }
    if (view === 'ccc-paragraphs') { setView('ccc-ranges'); setSelectedCccRange(null); return; }
    if (view === 'ccc-ranges')     { setView('testament'); return; }
    if (view === 'verses')         { setView('chapters'); return; }
    if (view === 'chapters')       { setView('books'); return; }
    if (view === 'books')          { setView('testament'); }
  };

  const goHome = () => {
    setSettingsView(false);
    setMediaView(false);
    setHolyMassView(false);
    setSongsView(false); setSelectedSong(null); setSongQuery('');
    setView('testament'); setTestament(null); setSelectedBook(null);
    setSelectedBookKey(null); setSelectedChapter(null);
    setChapters([]); setVerses([]); setSelectedCccRange(null);
  };

  const goToLive = async () => {
    if (!activeSongSlide && !activeVerse) return;

    // Reset all overlay views
    setSettingsView(false); setMediaView(false);
    setSearchView(false); setSearchResults(null); setSearchQuery('');

    if (activeSongSlide) {
      // Load manifest on-demand if not yet available
      let manifest = songsManifest;
      if (!manifest) {
        try {
          const res = await fetch('/songs-manifest.json', { cache: 'no-cache' });
          if (res.ok) { manifest = await res.json(); setSongsManifest(manifest); }
        } catch { /* offline */ }
      }
      const entry = manifest?.find(s => s.filename === activeSongSlide.filename);
      if (!entry) return;
      setSongsView(true);
      setSelectedSong(null);
      selectSong(entry);
    } else if (activeVerse) {
      const { book, chapter } = activeVerse;
      // Wait for books to finish loading if needed
      let key = nameToKey[book];
      if (!key && booksLoading) {
        // Books haven't loaded yet — nothing to navigate to
        setError('Still loading books, please try again.');
        setTimeout(() => setError(null), 2000);
        return;
      }
      if (!key) return;
      const t = OT_BOOKS.includes(book) ? 'OT' : 'NT';
      setSongsView(false); setSelectedSong(null); setSongQuery('');
      setTestament(t);
      setSelectedBook(book);
      setSelectedBookKey(key);
      setSelectedChapter(String(chapter));
      setChapters([]);
      setVerses([]);
      setView('verses');
      setVersesLoading(true);
      setError(null);
      try {
        const vData = await restFetch(`english/${key}/chapters/ch${chapter}`, true);
        const vs = Object.keys(vData || {}).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
        setVerses(vs);
      } catch (e) { setError('Could not load verses: ' + e.message); }
      finally { setVersesLoading(false); }
    }
  };

  const headerTitle =
    settingsView              ? 'Settings' :
    mediaView                 ? 'Media' :
    holyMassView              ? 'Holy Mass' :
    songsView && selectedSong ? selectedSong.title :
    songsView                 ? 'Songs' :
    searchView                ? 'AI Search' :
    view === 'recent'         ? 'Recent' :
    view === 'testament'      ? 'Bible Remote' :
    view === 'ccc-ranges'     ? 'Catechism (CCC)' :
    view === 'ccc-paragraphs' ? `CCC #${selectedCccRange?.start}–${selectedCccRange?.end}` :
    view === 'books'          ? (testament === 'OT' ? 'Old Testament' : 'New Testament') :
    view === 'chapters'       ? selectedBook :
    `${selectedBook} · Ch ${selectedChapter}`;

  if (!sessionPrefix) return <PinLogin onAuth={setSessionPrefix} />;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          {(view !== 'testament' || searchView || songsView || mediaView || settingsView || holyMassView) && (
            <button className="icon-btn" onClick={goBack} aria-label="Back" disabled={frozen}>
              <ChevronLeft />
            </button>
          )}
          <span className="header-title">{headerTitle}</span>
        </div>
        <div className="header-right">
          {(view !== 'testament' || searchView || songsView || mediaView || settingsView || holyMassView) && (
            <button className="icon-btn" onClick={goHome} aria-label="Home" disabled={frozen}>
              <HomeIcon />
            </button>
          )}
        </div>
      </header>

      {/* Floating settings bar */}
      <div className="settings-bar">
        <button className="settings-btn icon-only" onClick={() => holyMassView ? navigateHolyMass('prev') : sendNav('prev')} aria-label="Previous" disabled={frozen}>
          <ChevronLeft small />
        </button>
        <button className="settings-btn icon-only" onClick={() => holyMassView ? navigateHolyMass('next') : sendNav('next')} aria-label="Next" disabled={frozen}>
          <ChevronRight small />
        </button>
        <button
          className={`settings-btn icon-only${(activeSongSlide || activeVerse) ? ' live-pointer-btn' : ''}`}
          onClick={goToLive}
          aria-label="Go to current slide"
          title="Go to current slide"
          disabled={frozen}
        >
          <LocateIcon />
        </button>
        <button
          className="settings-btn icon-only"
          onClick={() => sendSetting('fullscreen', { ts: Date.now() })}
          aria-label="Toggle fullscreen"
          disabled={frozen}
        >
          <FullscreenIcon />
        </button>
        <div className="settings-row-break" />
        <button className={`settings-btn lang-btn${language === 'ML' ? ' active' : ''}`} onClick={toggleLanguage} disabled={frozen}>
          {language}
        </button>
        <div className="settings-divider" />
        <button className="settings-btn font-btn" onClick={() => sendFontSize(-1)} aria-label="Decrease font" disabled={frozen}>
          A<span className="font-sub">−</span>
        </button>
        <button className="settings-btn font-btn" onClick={() => sendFontSize(1)} aria-label="Increase font" disabled={frozen}>
          A<span className="font-sup">+</span>
        </button>
        <div className="settings-divider" />
        <button className="settings-btn" onClick={toggleTheme} aria-label="Toggle theme" disabled={frozen}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <div className="settings-divider" />
        <button
          className={`settings-btn freeze-btn${frozen ? ' freeze-btn-on' : ''}`}
          onClick={() => setFrozen(f => !f)}
          aria-label={frozen ? 'Unfreeze' : 'Freeze'}
          title={frozen ? 'Unfreeze controls' : 'Freeze controls'}
        >
          <LockIcon locked={frozen} />
        </button>
      </div>

      <main className="app-main">
        {frozen && (
          <div className="freeze-overlay">
            <LockIcon locked size={28} />
            <span className="freeze-overlay-label">Frozen</span>
            <span className="freeze-overlay-hint">Tap the lock button to unfreeze</span>
          </div>
        )}
        {error && (
          <div className="error-banner" onClick={() => setError(null)}>
            {error} · tap to dismiss
          </div>
        )}

        {/* ── AI Search view ── */}
        {searchView && (
          <div className="search-view">
            <div className="search-input-row">
              <input
                className="search-input"
                type="text"
                placeholder="e.g. forgiveness, hope, CCC grace…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitSearch()}
                autoFocus
              />
              <button
                className="search-go-btn"
                onClick={submitSearch}
                disabled={searchLoading || !searchQuery.trim()}
              >
                {searchLoading ? <span className="search-spinner" /> : <SearchSparkleIcon />}
              </button>
            </div>

            {searchLoading && <p className="search-status">Searching with AI…</p>}

            {searchResults !== null && searchResults.length === 0 && (
              <p className="search-status">No results found. Try different keywords.</p>
            )}

            {searchResults && searchResults.length > 0 && (
              <ul className="search-results">
                {searchResults.map((r, i) => (
                  <li key={i}>
                    <button
                      className={`search-result-btn${r.type === 'ccc' ? ' search-result-ccc' : ''}`}
                      onClick={() => sendSearchResult(r)}
                    >
                      <span className={`result-ref${r.type === 'ccc' ? ' result-ref-ccc' : ''}`}>
                        {r.ref}
                      </span>
                      {r.text && <span className="result-text">{r.text}</span>}
                      {r.reason && <span className="result-reason">{r.reason}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Songs view ── */}
        {songsView && !selectedSong && (
          <div className="search-view">
            <div className="search-input-row">
              <input
                className="search-input song-search-input"
                type="text"
                placeholder="Song title (English) or Manglish lyrics…"
                value={songQuery}
                onChange={e => { setSongQuery(e.target.value); setSongAiResults(null); }}
                onKeyDown={e => e.key === 'Enter' && songQuery.trim() && songAiSearch()}
                autoFocus
              />
              <button
                className="search-go-btn song-ai-go-btn"
                onClick={songAiSearch}
                disabled={songAiLoading || !songQuery.trim()}
                title="AI: search by Manglish lyrics"
              >
                {songAiLoading ? <span className="search-spinner" /> : <MusicAiIcon />}
              </button>
            </div>

            {songsManifestLoading && <p className="search-status">Loading songs…</p>}

            {!songsManifestLoading && songsManifest && !songQuery.trim() && (
              <p className="search-status">Type a title, or Manglish lyrics and tap ♪ AI to search.</p>
            )}

            {/* AI results */}
            {songAiResults !== null && (
              <>
                <p className="section-heading" style={{paddingTop:4}}>AI lyrics results</p>
                {songAiResults.length === 0
                  ? <p className="search-status">No matches found.</p>
                  : <ul className="search-results">
                      {songAiResults.map((s, i) => (
                        <li key={i}>
                          <button className="search-result-btn song-result-btn" onClick={() => selectSong(s)}>
                            <span className="result-ref song-result-ref">{s.title}</span>
                            <span className="result-text">{s.voices?.length} slides · {s.voices?.slice(0, 8).join(' ')}{s.voices?.length > 8 ? '…' : ''}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                }
              </>
            )}

            {/* Title results (instant) */}
            {songQuery.trim() !== '' && songAiResults === null && (
              <>
                {songResults && songResults.length === 0 && (
                  <p className="search-status">No title match. Tap ♪ AI to search by Manglish lyrics.</p>
                )}
                {songResults && songResults.length > 0 && (
                  <ul className="search-results">
                    {songResults.map((s, i) => (
                      <li key={i}>
                        <button className="search-result-btn song-result-btn" onClick={() => selectSong(s)}>
                          <span className="result-ref song-result-ref">{s.title}</span>
                          <span className="result-text">{s.voices?.length} slides · {s.voices?.slice(0, 8).join(' ')}{s.voices?.length > 8 ? '…' : ''}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Song slides picker ── */}
        {songsView && selectedSong && (
          <div className="search-view">
            {songSlidesLoading
              ? <CenterSpinner />
              : <>
                  <p className="section-heading">{selectedSong.slides.length} slides — tap to project</p>
                  <ul className="search-results">
                    {selectedSong.slides.map((slide, idx) => {
                      const nextSame = selectedSong.slides[idx + 1]?.text === slide.text;
                      const prevSame = selectedSong.slides[idx - 1]?.text === slide.text;
                      const isActive = activeSongSlide?.filename === selectedSong.filename && activeSongSlide?.slideIdx === idx;
                      return (
                      <li key={idx}>
                        <button
                          className={`search-result-btn song-slide-btn${prevSame ? ' song-slide-repeat' : ''}${isActive ? ' slide-active' : ''}`}
                          onClick={() => sendSongSlide(selectedSong.filename, idx, slide.text)}
                        >
                          <span className="result-ref">
                            <span className={`slide-voice-badge voice-${slide.voice.toLowerCase()}`}>{slide.voice}</span>
                            {' '}slide {idx + 1}
                            {nextSame && <span className="slide-repeat-badge">×2</span>}
                            {prevSame && <span className="slide-repeat-badge slide-repeat-2">↩</span>}
                          </span>
                          <span className="result-text song-slide-preview">
                            {prevSame ? '(same as above)' : `${slide.text.slice(0, 80)}${slide.text.length > 80 ? '…' : ''}`}
                          </span>
                        </button>
                      </li>
                      );
                    })}
                  </ul>
                </>
            }
          </div>
        )}

        {/* ── Settings view ── */}
        {settingsView && (
          <div className="search-view">
            <p className="section-heading">Background Image</p>

            {activeBg ? (
              <div className="settings-bg-active">
                <img src={activeBg.url} alt={activeBg.name} className="settings-bg-thumb" />
                <div className="settings-bg-info">
                  <span className="settings-bg-name">{activeBg.name}</span>
                  <div className="bg-opacity-row">
                    <span className="bg-opacity-label">Opacity</span>
                    <input
                      type="range" min={5} max={80} value={bgOpacityLocal}
                      className="bg-opacity-slider"
                      onChange={e => updateBgOpacity(Number(e.target.value))}
                    />
                    <span className="bg-opacity-val">{bgOpacityLocal}%</span>
                  </div>
                  <button className="settings-bg-clear-btn" onClick={clearBg}>Remove background</button>
                </div>
              </div>
            ) : (
              <p className="search-status" style={{marginBottom:12}}>No background image set</p>
            )}

            {mediaLibrary.filter(i => i.type === 'image').length > 0 && (
              <>
                <p className="section-heading" style={{marginTop:4}}>Choose background</p>
                <div className="settings-bg-picker">
                  {mediaLibrary.filter(i => i.type === 'image').map(item => {
                    const isActive = activeBg?.url === item.url;
                    return (
                      <button
                        key={item.key}
                        className={`settings-bg-pick-btn${isActive ? ' settings-bg-pick-active' : ''}`}
                        onClick={() => isActive ? clearBg() : setAsBg(item)}
                        title={item.name}
                      >
                        <img src={item.url} alt={item.name} />
                        {isActive && <div className="settings-bg-pick-check">✓</div>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {mediaLibrary.filter(i => i.type === 'image').length === 0 && (
              <p className="search-status">Upload images in Media to use as backgrounds</p>
            )}
          </div>
        )}

        {/* ── Media view ── */}
        {mediaView && (
          <div className="search-view">
            {/* Add buttons row */}
            <div className="media-add-row">
              <label className="media-upload-btn">
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  disabled={mediaUploading}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadMedia(f); e.target.value = ''; }}
                />
                {mediaUploading ? 'Uploading…' : <><span>🖼</span> Image</>}
              </label>
              <button
                className="media-upload-btn media-text-btn"
                onClick={() => { setShowTextForm(v => !v); setEditingMediaKey(null); if (textEditorRef.current) textEditorRef.current.innerHTML = ''; }}
              >
                <span>✏️</span> Text
              </button>
              <button className="media-upload-btn media-clear-btn" onClick={clearMediaScreen}>
                <span>⬜</span> Clear
              </button>
            </div>

            {/* Text slide form */}
            {showTextForm && (
              <div className="media-text-form">
                <div className="rich-toolbar">
                  <button className="rich-btn rich-bold" onMouseDown={e => { e.preventDefault(); fmt('bold'); }} title="Bold">B</button>
                  <button className="rich-btn rich-italic" onMouseDown={e => { e.preventDefault(); fmt('italic'); }} title="Italic">I</button>
                  <button className="rich-btn rich-underline" onMouseDown={e => { e.preventDefault(); fmt('underline'); }} title="Underline">U</button>
                  <span className="rich-divider" />
                  <button className="rich-btn" onMouseDown={e => { e.preventDefault(); fmt('justifyLeft'); }} title="Align left">
                    <AlignLeftIcon />
                  </button>
                  <button className="rich-btn" onMouseDown={e => { e.preventDefault(); fmt('justifyCenter'); }} title="Align center">
                    <AlignCenterIcon />
                  </button>
                  <button className="rich-btn" onMouseDown={e => { e.preventDefault(); fmt('justifyRight'); }} title="Align right">
                    <AlignRightIcon />
                  </button>
                </div>
                <div
                  ref={textEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="media-text-editor"
                  data-placeholder="Type your text here…"
                  autoFocus
                />
                <button
                  className="media-text-save-btn"
                  onClick={addTextSlide}
                >
                  {editingMediaKey ? 'Update' : 'Add to library'}
                </button>
              </div>
            )}

            {mediaLibrary.length === 0 && !mediaUploading && (
              <p className="section-heading" style={{textAlign:'center',marginTop:32}}>No slides yet — add an image or text above</p>
            )}

            <div className="media-list">
              {mediaLibrary.map(item => {
                const isSentItem = item.type === 'text'
                  ? sent === item.text?.slice(0, 30)
                  : sent === item.name;
                const isActiveBg = activeBg?.url === item.url;
                return (
                <div key={item.key} className={`media-list-item${isActiveBg ? ' media-list-item-bg' : ''}`}>
                  <button className="media-list-thumb-btn" onClick={() => sendMedia(item)}>
                    {item.type === 'text' ? (
                      <div className="media-list-text-preview" dangerouslySetInnerHTML={{ __html: item.html || item.text }} />
                    ) : (
                      <img src={item.url} alt={item.name} className="media-list-thumb" />
                    )}
                    {isSentItem && <div className="media-sent-overlay">✓ Sent</div>}
                  </button>
                  <div className="media-list-footer">
                    <span className="media-list-name">
                      {item.type === 'text' ? (item.text?.slice(0, 50) || 'Text slide') : item.name}
                    </span>
                    <div className="media-list-actions">
                      {item.type === 'image' && (
                        <button
                          className={`media-bg-btn${isActiveBg ? ' media-bg-btn-active' : ''}`}
                          onClick={() => isActiveBg ? clearBg() : setAsBg(item)}
                          title={isActiveBg ? 'Remove background' : 'Set as background'}
                        >
                          {isActiveBg ? 'BG ✓' : 'BG'}
                        </button>
                      )}
                      {item.type === 'text' && (
                        <button className="media-edit-btn" onClick={() => startEditText(item)}>Edit</button>
                      )}
                      <button className="media-delete-btn" onClick={() => deleteMedia(item)} title="Delete">✕</button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Holy Mass view ── */}
        {holyMassView && (
          <div className="search-view">
            <div className="holy-mass-add-row">
              <label className="media-upload-btn holy-mass-upload-btn">
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  disabled={holyMassUploading}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadHolyMass(f); e.target.value = ''; }}
                />
                {holyMassUploading ? 'Uploading…' : <><span>🖼</span> Add Image</>}
              </label>
              <button className="media-upload-btn media-clear-btn" onClick={clearMediaScreen}>
                <span>⬜</span> Clear
              </button>
            </div>

            {holyMassLibrary.length === 0 && !holyMassUploading && (
              <p className="section-heading" style={{ textAlign: 'center', marginTop: 32 }}>
                No images yet — add images above
              </p>
            )}

            <div className="holy-mass-grid">
              {holyMassLibrary.map(item => {
                const isSent = sent === item.name;
                const isActive = activeHolyMassKey === item.key;
                return (
                  <div key={item.key} className={`holy-mass-card${isActive ? ' holy-mass-active' : ''}`}>
                    <button className="media-list-thumb-btn" onClick={() => sendHolyMassImage(item)}>
                      <img src={item.url} alt={item.name} className="holy-mass-thumb" />
                      {isSent && <div className="media-sent-overlay">✓ Sent</div>}
                    </button>
                    <div className="holy-mass-card-footer">
                      <span className="holy-mass-img-name">{item.name.replace(/\.[^.]+$/, '')}</span>
                      <button className="media-delete-btn" onClick={() => deleteHolyMass(item)} title="Delete">✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Home picker ── */}
        {!songsView && !searchView && !mediaView && !settingsView && !holyMassView && view === 'testament' && (
          booksLoading
            ? <CenterSpinner />
            : <div className="testament-grid">
                <button className="testament-btn" onClick={() => selectTestament('OT')}>
                  <span className="testament-label">Old Testament</span>
                  <span className="testament-count">{getBooksForTestament('OT').length} books</span>
                </button>
                <button className="testament-btn" onClick={() => selectTestament('NT')}>
                  <span className="testament-label">New Testament</span>
                  <span className="testament-count">{getBooksForTestament('NT').length} books</span>
                </button>
                <button className="testament-btn ccc-testament-btn" onClick={() => setView('ccc-ranges')}>
                  <span className="testament-label" style={{ fontFamily: 'serif' }}>CCC</span>
                  <span className="testament-count">2865 paragraphs</span>
                </button>
                <button className="testament-btn recent-testament-btn" onClick={() => setView('recent')}>
                  <ClockIcon />
                  <span className="testament-label">Recent</span>
                  <span className="testament-count">
                    {recentSent.length > 0 ? `${recentSent.length} sent this session` : 'Nothing sent yet'}
                  </span>
                </button>
                <button
                  className="testament-btn search-testament-btn"
                  onClick={() => { setSearchView(true); setSearchResults(null); setSearchQuery(''); }}
                >
                  <SearchSparkleIcon />
                  <span className="testament-label">AI Search</span>
                  <span className="testament-count">Find by meaning</span>
                </button>
                <button className="testament-btn songs-testament-btn" onClick={openSongsView}>
                  <MusicNoteIcon />
                  <span className="testament-label">Songs</span>
                  <span className="testament-count">{songsManifest ? `${songsManifest.length} Malayalam songs` : 'Malayalam songs'}</span>
                </button>
                <button className="testament-btn media-testament-btn" onClick={() => setMediaView(true)}>
                  <MediaIcon />
                  <span className="testament-label">Media</span>
                  <span className="testament-count">
                    {mediaLibrary.length > 0 ? `${mediaLibrary.length} item${mediaLibrary.length !== 1 ? 's' : ''}` : 'Posters & images'}
                  </span>
                </button>
                <button className="testament-btn holy-mass-testament-btn" onClick={() => setHolyMassView(true)}>
                  <CrossIcon />
                  <span className="testament-label">Holy Mass</span>
                  <span className="testament-count">
                    {holyMassLibrary.length > 0 ? `${holyMassLibrary.length} image${holyMassLibrary.length !== 1 ? 's' : ''}` : 'Liturgical images'}
                  </span>
                </button>
                <button className="testament-btn settings-testament-btn" onClick={() => setSettingsView(true)}>
                  <SettingsIcon />
                  <span className="testament-label">Settings</span>
                  <span className="testament-count">
                    {activeBg ? `BG: ${activeBg.name.split('.')[0]}` : 'Background & display'}
                  </span>
                </button>
              </div>
        )}

        {/* ── Recent sent items ── */}
        {!songsView && !searchView && !mediaView && !settingsView && !holyMassView && view === 'recent' && (
          recentSent.length === 0
            ? <p className="search-status">Nothing sent yet this session.</p>
            : <ul className="search-results">
                {recentSent.map((r, i) => (
                  <li key={i}>
                    <button
                      className={`search-result-btn${r.type === 'ccc' ? ' search-result-ccc' : ''}`}
                      onClick={() => resendRecent(r)}
                    >
                      <span className={`result-ref${r.type === 'ccc' ? ' result-ref-ccc' : ''}`}>{r.key}</span>
                      {r.text && <span className="result-text recent-verse-text">{r.text}</span>}
                      <span className="result-reason">tap to send again</span>
                    </button>
                  </li>
                ))}
              </ul>
        )}

        {/* ── CCC range picker ── */}
        {!songsView && !searchView && !mediaView && !settingsView && !holyMassView && view === 'ccc-ranges' && (
          <div className="num-grid">
            {cccRanges.map(r => (
              <button
                key={r.start}
                className="num-btn ccc-range-btn"
                onClick={() => { setSelectedCccRange(r); setView('ccc-paragraphs'); }}
              >
                {r.start}–{r.end}
              </button>
            ))}
          </div>
        )}

        {/* ── CCC paragraph picker ── */}
        {!songsView && !searchView && !mediaView && !settingsView && !holyMassView && view === 'ccc-paragraphs' && selectedCccRange && (
          <div className="num-grid">
            {Array.from(
              { length: selectedCccRange.end - selectedCccRange.start + 1 },
              (_, i) => selectedCccRange.start + i
            ).map(n => (
              <button key={n} className="num-btn ccc-para-btn" onClick={() => sendCccParagraph(n)}>
                {n}
              </button>
            ))}
          </div>
        )}

        {/* ── Book list ── */}
        {!songsView && !searchView && !mediaView && !settingsView && !holyMassView && view === 'books' && (
          <div className="book-list-wrap">
            <input
              className="book-search-input"
              type="text"
              placeholder="Search books…"
              value={bookSearch}
              onChange={e => setBookSearch(e.target.value)}
              autoComplete="off"
            />
            <ul className="book-list">
              {getBooksForTestament(testament)
                .filter(b => {
                  const q = bookSearch.trim().toLowerCase();
                  if (!q) return true;
                  return b.name.toLowerCase().includes(q) || (b.nameML && b.nameML.includes(bookSearch.trim()));
                })
                .map(b => (
                  <li key={b.key}>
                    <button className="book-btn" onClick={() => selectBook(b.name)}>
                      <span className="book-btn-names">
                        <span className="book-name-en">{b.name}</span>
                        {b.nameML && <span className="book-name-ml">{b.nameML}</span>}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* ── Chapter picker ── */}
        {!songsView && !searchView && !mediaView && !settingsView && !holyMassView && view === 'chapters' && (
          chaptersLoading
            ? <CenterSpinner />
            : <>
                <p className="section-heading">Chapters</p>
                <div className="num-grid">
                  {chapters.map(ch => (
                    <button key={ch} className="num-btn" onClick={() => selectChapter(ch)}>{ch}</button>
                  ))}
                </div>
              </>
        )}

        {/* ── Verse picker ── */}
        {!songsView && !searchView && !mediaView && !settingsView && !holyMassView && view === 'verses' && (
          versesLoading
            ? <CenterSpinner />
            : <>
                <p className="section-heading">Verses</p>
                <div className="num-grid">
                  {verses.map(v => {
                    const isActive = activeVerse?.book === selectedBook && activeVerse?.chapter === Number(selectedChapter) && activeVerse?.verse === v;
                    return (
                      <button key={v} className={`num-btn verse-num${isActive ? ' verse-active' : ''}`} onClick={() => sendVerse(v)}>{v}</button>
                    );
                  })}
                </div>
              </>
        )}
      </main>

      {sent && (
        <div className="toast">
          <CheckIcon /> {sent}
        </div>
      )}
    </div>
  );
}

// ── PIN Login ─────────────────────────────────────────────────────────────
function PinLogin({ onAuth }) {
  const PIN_LENGTH = 6;
  const [digits, setDigits] = useState(Array(PIN_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  async function verifyPin(pin) {
    setLoading(true);
    setError('');
    try {
      let sessions = SESSIONS;
      try {
        const snap = await get(ref(db, 'config/sessions'));
        if (snap.val()) sessions = snap.val();
      } catch { /* use hardcoded fallback */ }
      const prefix = sessions[pin];
      if (prefix) {
        localStorage.setItem(SESSION_KEY, prefix);
        localStorage.setItem(SESSION_TS_KEY, String(Date.now()));
        onAuth(prefix);
      } else {
        triggerError('Incorrect PIN');
      }
    } finally {
      setLoading(false);
    }
  }

  function triggerError(msg) {
    setShake(true);
    setError(msg);
    setDigits(Array(PIN_LENGTH).fill(''));
    setTimeout(() => { setShake(false); inputRefs.current[0]?.focus(); }, 500);
  }

  function handleChange(i, e) {
    const val = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    setError('');
    if (val && i < PIN_LENGTH - 1) inputRefs.current[i + 1]?.focus();
    if (val && next.every(d => d !== '')) verifyPin(next.join(''));
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace') {
      if (digits[i]) { const n = [...digits]; n[i] = ''; setDigits(n); }
      else if (i > 0) { inputRefs.current[i - 1]?.focus(); const n = [...digits]; n[i - 1] = ''; setDigits(n); }
    } else if (e.key === 'ArrowLeft' && i > 0) inputRefs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < PIN_LENGTH - 1) inputRefs.current[i + 1]?.focus();
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(PIN_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, PIN_LENGTH - 1)]?.focus();
    if (pasted.length === PIN_LENGTH) verifyPin(pasted);
  }

  return (
    <div className="pin-login">
      <div className={`pin-card${shake ? ' pin-shake' : ''}`}>
        <div className="pin-cross">✝</div>
        <h1 className="pin-title">Bible Remote</h1>
        <p className="pin-subtitle">Enter your 6-digit PIN</p>
        <div className="pin-inputs" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => (inputRefs.current[i] = el)}
              type="tel"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e)}
              onKeyDown={e => handleKeyDown(i, e)}
              disabled={loading}
              className={`pin-digit${d ? ' pin-digit-filled' : ''}`}
            />
          ))}
        </div>
        <div className="pin-status">
          {loading
            ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, margin: '0 auto' }} />
            : <span className="pin-error">{error}</span>
          }
        </div>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────
function CenterSpinner() {
  return <div className="center-spinner"><div className="spinner" /></div>;
}
function ChevronLeft({ small } = {}) {
  const s = small ? 16 : 22;
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
}
function ChevronRight({ small } = {}) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
}
function HomeIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><polyline points="9 21 9 12 15 12 15 21"/></svg>;
}
function ClockIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>;
}
function CheckIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
function LocateIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <line x1="12" y1="2" x2="12" y2="6"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="6" y2="12"/>
      <line x1="18" y1="12" x2="22" y2="12"/>
    </svg>
  );
}
function FullscreenIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
      <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
    </svg>
  );
}
function MusicAiIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
      <path fill="currentColor" stroke="none" d="M20 3l.6 1.8L22 5l-1.4.2L20 7l-.6-1.8L18 5l1.4-.2L20 3z"/>
    </svg>
  );
}
function MusicNoteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
  );
}
function SearchSparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="6"/>
      <line x1="21" y1="21" x2="15.65" y2="15.65"/>
      <path fill="currentColor" stroke="none" d="M10 4l.9 2.7L14 8l-3.1.9L10 12l-.9-3.1L6 8l3.1-.9L10 4z"/>
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function AlignLeftIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>;
}
function AlignCenterIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>;
}
function AlignRightIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>;
}
function MediaIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="14" rx="2"/>
      <path d="M3 9l4-3 4 4 3-2 4 5"/>
      <circle cx="8" cy="7" r="1.2" fill="currentColor" stroke="none"/>
    </svg>
  );
}
function CrossIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="2" x2="12" y2="22"/>
      <line x1="5" y1="7" x2="19" y2="7"/>
    </svg>
  );
}
function SunIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
}
function MoonIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
}
function LockIcon({ locked, size = 17 }) {
  return locked
    ? <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    : <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>;
}
