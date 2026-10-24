import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ref, set, push, onValue, get, update } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { ref as storageRef, getBytes, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { EventFrame, FRAME_FONTS, defaultFrameItems, frameItems } from './EventFrame';
import { THEMES, getTheme } from './themes';
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut, GoogleAuthProvider } from 'firebase/auth';
import { auth, db, functions, storage, DB_URL, OWNER_EMAIL, emailKey, sessionForEmail } from './firebase';
import { convertToSlides, slideFileKind, SLIDE_ACCEPT } from './slideConvert';
import './App.css';

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

// Holy Mass collections: page lists shared by every PIN session (not under <session>/)
const HOLY_MASS_SECTIONS = {
  ml: { label: 'Malayalam Mass', path: 'holyMass/malayalam', lang: 'ML' },
  en: { label: 'Manglish Mass', path: 'holyMass/manglish', lang: 'EN' },
};

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
  const token = await auth.currentUser?.getIdToken();  // database reads require an allowed account
  const params = new URLSearchParams();
  if (shallow) params.set('shallow', 'true');
  if (token) params.set('auth', token);
  const res = await fetch(`${DB_URL}/${path}.json?${params}`);
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

// The owner can join any user's session; their pick is remembered on this device.
const OWNER_SESSION_KEY = 'bv_owner_session'
function ownerSession() {
  try { return localStorage.getItem(OWNER_SESSION_KEY) || 'remote' } catch { return 'remote' }
}
function rememberOwnerSession(session) {
  try { localStorage.setItem(OWNER_SESSION_KEY, session) } catch { /* private mode */ }
}

// ── Sign-in gate: Google account; the owner + emails listed under config/access.
// Each user has a private session, shared by their own display and remote.
async function syncClaims(user) {
  try {
    await httpsCallable(functions, 'syncAccess')();
    await user.getIdToken(true);
  } catch { /* Storage may refuse until next sign-in; the database still works */ }
}

async function resolveAccess(user) {
  const access = await checkAccess(user);
  if (access.status === 'allowed') await syncClaims(user);
  return access;
}

async function checkAccess(user) {
  if (!user) return { status: 'signedOut' };
  const email = (user.email || '').toLowerCase();
  if (!user.emailVerified) return { status: 'denied', email };
  if (email === OWNER_EMAIL) return { status: 'allowed', email, session: ownerSession(), isOwner: true };
  try {
    const snap = await get(ref(db, `config/access/${emailKey(email)}`));
    return snap.exists() ? { status: 'allowed', email, session: sessionForEmail(email) } : { status: 'denied', email };
  } catch {
    return { status: 'denied', email };
  }
}

export default function App() {
  const [access, setAccess] = useState({ status: 'checking' });
  useEffect(() => onAuthStateChanged(auth, async user => setAccess(await resolveAccess(user))), []);
  const switchSession = (session) => { rememberOwnerSession(session); setAccess(a => ({ ...a, session })); };
  if (access.status !== 'allowed') return <GoogleLogin access={access} />;
  return (
    <RemoteApp
      key={access.session} sessionPrefix={access.session} userEmail={access.email}
      isOwner={!!access.isOwner} onSwitchSession={access.isOwner ? switchSession : null}
    />
  );
}

function RemoteApp({ sessionPrefix, userEmail, isOwner, onSwitchSession }) {
  // Short alias — all Firebase paths use this prefix instead of hard-coded 'remote'
  const P = sessionPrefix;
  const signOut = () => fbSignOut(auth);

  const [allBooks, setAllBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [nameToKey, setNameToKey] = useState({});
  const [nameToKeyML, setNameToKeyML] = useState({});

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

  const [language, setLanguage] = useState('ML');
  const [theme, setTheme] = useState('light');
  const [themeMenu, setThemeMenu] = useState(false);   // theme picker open

  // Follow the session's language (the display resets it to ML when it opens)
  useEffect(() => {
    return onValue(ref(db, `${P}/settings/language`), snap => {
      const val = snap.val();
      if (val === 'EN' || val === 'ML') setLanguage(val);
    });
  }, []);

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
  const [holyMassSection, setHolyMassSection] = useState(null); // null = Holy Mass menu; else a HOLY_MASS_SECTIONS key
  const [holyMassLibraries, setHolyMassLibraries] = useState({ ml: [], en: [] });
  const holyMassLibrary = holyMassLibraries[holyMassSection] || [];
  const [holyMassUploading, setHolyMassUploading] = useState(false);
  const [activeHolyMassKey, setActiveHolyMassKey] = useState(null);
  const [holyMassPageInput, setHolyMassPageInput] = useState('');
  const [holyMassOpenKey, setHolyMassOpenKey] = useState(null);      // page whose speaker parts are listed
  const [activeHolyMassPart, setActiveHolyMassPart] = useState(0);   // part of the active page on the display
  const [activeHolyMassSlide, setActiveHolyMassSlide] = useState(0); // slide of that part on the display
  // Favourite Holy Mass pages, per session and per Mass: { ml: { page_028: ts }, en: {...} }
  const [massFavPages, setMassFavPages] = useState({});
  // Mass plans: named running orders of slides, per session: { id: { name, section, path, items: [{key, part, slide}], ts } }
  const [massPlans, setMassPlans] = useState({});
  const [activePlanId, setActivePlanId] = useState(null);   // plan ◀ ▶ follow on the display
  const [planViewId, setPlanViewId] = useState(null);       // plan whose slide list is open
  const [planEditId, setPlanEditId] = useState(null);       // plan being filled with ＋ on slides
  const [newPlanName, setNewPlanName] = useState('');

  // Slides: decks made from a PDF / PowerPoint / images, tagged, sent one slide at a time
  const [slidesView, setSlidesView] = useState(false);
  const [slideDecks, setSlideDecks] = useState([]);
  const [openDeckKey, setOpenDeckKey] = useState(null);
  const [activeSlide, setActiveSlide] = useState(null); // { deckKey, idx }
  const [slideTagFilter, setSlideTagFilter] = useState('');
  const [deckDraft, setDeckDraft] = useState(null); // { files?, editKey?, name, tag, author }
  const [slideProgress, setSlideProgress] = useState(null);
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
    const unsubs = Object.entries(HOLY_MASS_SECTIONS).map(([section, { path }]) =>
      onValue(ref(db, path), snap => {
        const val = snap.val() || {};
        const items = Object.entries(val)
          .map(([key, data]) => ({ key, ...data }))
          .sort((a, b) => (a.ts || 0) - (b.ts || 0));
        setHolyMassLibraries(prev => ({ ...prev, [section]: items }));
      }));
    return () => unsubs.forEach(u => u());
  }, []);

  useEffect(() => {
    return onValue(ref(db, `${P}/slideDecks`), snap => {
      const val = snap.val() || {};
      const decks = Object.entries(val)
        .map(([key, data]) => ({ key, ...data, slides: data.slides || [] }))
        .sort((a, b) => (b.ts || 0) - (a.ts || 0));
      setSlideDecks(decks);
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
        : { type: 'image', url: item.url, name: item.name, ts: Date.now(), ...(item.seq ? { seq: item.seq } : {}) };
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

  // Upload one or more pages to the open Mass, in filename order (page_001, page_002, …)
  const uploadHolyMass = async (fileList) => {
    const files = [...(fileList || [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const section = HOLY_MASS_SECTIONS[holyMassSection];
    if (!files.length || !section) return;
    setHolyMassUploading(true);
    try {
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const fileRef = storageRef(storage, `holy-mass/${filename}`);
        await uploadBytes(fileRef, file, { contentType: file.type });
        const url = await getDownloadURL(fileRef);
        await push(ref(db, section.path), { type: 'image', url, name: file.name, ts: Date.now() });
      }
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
      await set(ref(db, `${HOLY_MASS_SECTIONS[holyMassSection].path}/${item.key}`), null);
      if (activeHolyMassKey === item.key) setActiveHolyMassKey(null);
    } catch (e) { setError('Delete failed: ' + e.message); }
  };

  // seq lets the display's ◀ ▶ step through this Mass's pages
  // A page's speaker parts that have words (rubric-only parts aren't shown on the display)
  const holyMassTextParts = (item) => (item?.parts || []).filter(pt => pt.text);

  // ── Mass plans ──
  useEffect(() => onValue(ref(db, `${P}/massPlans`), snap => setMassPlans(snap.val() || {})), []);
  useEffect(() => onValue(ref(db, `${P}/massActivePlan`), snap => setActivePlanId(snap.val() || null)), []);
  const sectionPlans = Object.entries(massPlans)
    .filter(([, pl]) => pl.section === holyMassSection)
    .map(([id, pl]) => ({ id, ...pl, items: pl.items || [] }))
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const planById = (id) => sectionPlans.find(pl => pl.id === id) || null;
  const planErr = e => setError('Could not save plan: ' + e.message);
  const massOrder = (it) => [holyMassLibrary.findIndex(i => i.key === it.key), it.part, it.slide];
  const before = (a, b) => { const x = massOrder(a), y = massOrder(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
  const createPlan = async (e) => {
    e.preventDefault();
    const name = newPlanName.trim();
    if (!name) return;
    const r = push(ref(db, `${P}/massPlans`));
    await set(r, { name, section: holyMassSection, path: HOLY_MASS_SECTIONS[holyMassSection].path, items: [], ts: Date.now() }).catch(planErr);
    setNewPlanName('');
    setPlanEditId(r.key);                                    // straight into adding slides
  };
  const savePlanItems = (id, items) => set(ref(db, `${P}/massPlans/${id}/items`), items).catch(planErr);
  const inPlan = (pl, key, part, slide) => !!pl?.items.some(it => it.key === key && it.part === part && it.slide === slide);
  const togglePlanItem = (key, part, slide) => {
    const pl = planById(planEditId);
    if (!pl) return;
    const it = { key, part, slide };
    if (inPlan(pl, key, part, slide)) {
      savePlanItems(pl.id, pl.items.filter(x => !(x.key === key && x.part === part && x.slide === slide)));
    } else {                                                 // insert in Mass order
      const at = pl.items.findIndex(x => before(x, it) > 0);
      const items = [...pl.items];
      items.splice(at < 0 ? items.length : at, 0, it);
      savePlanItems(pl.id, items);
    }
  };
  const movePlanItem = (pl, i, d) => {
    const items = [...pl.items];
    if (i + d < 0 || i + d >= items.length) return;
    [items[i], items[i + d]] = [items[i + d], items[i]];
    savePlanItems(pl.id, items);
  };
  const removePlanItem = (pl, i) => savePlanItems(pl.id, pl.items.filter((_, j) => j !== i));
  const planItemPage = (it) => holyMassLibrary.find(i => i.key === it.key);
  const sendPlanItem = (it) => { const page = planItemPage(it); if (page) sendHolyMassPart(page, it.part, it.slide); };
  const startPlan = (pl) => {
    set(ref(db, `${P}/massActivePlan`), pl.id).catch(planErr);
    if (pl.items[0]) sendPlanItem(pl.items[0]);
  };
  const stopPlan = () => set(ref(db, `${P}/massActivePlan`), null).catch(planErr);
  const copyPlan = (pl) => {
    const r = push(ref(db, `${P}/massPlans`));
    set(r, { name: `${pl.name} (copy)`, section: pl.section, path: pl.path, items: pl.items, ts: Date.now() })
      .then(() => setPlanViewId(r.key)).catch(planErr);
  };
  const deletePlan = (pl) => {
    if (!window.confirm(`Delete the plan "${pl.name}"?`)) return;
    if (activePlanId === pl.id) stopPlan();
    set(ref(db, `${P}/massPlans/${pl.id}`), null).catch(planErr);
    setPlanViewId(null);
  };
  const planItemInfo = (it) => {
    const page = planItemPage(it);
    const pt = page ? holyMassTextParts(page)[it.part] : null;
    const slides = pt ? (pt.slides?.length ? pt.slides : [pt.text]) : [];
    return {
      page: page ? holyMassPageLabel(page, holyMassLibrary.indexOf(page)) : 'Missing page',
      role: pt?.role || '',
      text: (slides[it.slide] || '').split('\n')[0],
    };
  };
  const editingPlan = planById(planEditId);
  const runningPlan = planById(activePlanId);
  const planEditBanner = editingPlan && (
    <div className="mass-plan-banner">
      <span>Adding to <b>{editingPlan.name}</b> · {editingPlan.items.length} slides — tap ＋ on slides</span>
      <button className="mass-plan-btn mass-plan-btn-primary" onClick={() => { setPlanEditId(null); setHolyMassOpenKey(null); setPlanViewId(editingPlan.id); }}>Done</button>
    </div>
  );
  const planRunningChip = runningPlan && !editingPlan && (
    <div className="mass-plan-running">
      <span>▶ Plan running: <b>{runningPlan.name}</b> — ◀ ▶ follow it</span>
      <button className="mass-plan-btn" onClick={() => { setHolyMassOpenKey(null); setPlanViewId(runningPlan.id); }}>Open</button>
      <button className="mass-plan-btn" onClick={stopPlan}>Stop</button>
    </div>
  );
  const plansPanel = !editingPlan && (
    <div className="mass-plans">
      <p className="section-heading">Mass plans</p>
      {sectionPlans.map(pl => (
        <div key={pl.id} className={`mass-plan-row${activePlanId === pl.id ? ' mass-plan-row-active' : ''}`}>
          <button className="mass-plan-name" onClick={() => setPlanViewId(pl.id)}>
            {pl.name} <span className="mass-plan-count">· {pl.items.length} slides</span>
          </button>
          {activePlanId === pl.id
            ? <button className="mass-plan-btn" onClick={stopPlan}>■ Stop</button>
            : <button className="mass-plan-btn mass-plan-btn-primary" disabled={!pl.items.length} onClick={() => startPlan(pl)}>▶ Start</button>}
        </div>
      ))}
      <form className="mass-plan-new" onSubmit={createPlan}>
        <input className="search-input" placeholder="New plan name, e.g. Sunday Mass" value={newPlanName} onChange={e => setNewPlanName(e.target.value)} />
        <button type="submit" className="search-go-btn" disabled={!newPlanName.trim()}>Create</button>
      </form>
    </div>
  );

  // ── Favourite pages: star a page, then jump between starred pages in page order ──
  useEffect(() => onValue(ref(db, `${P}/massFavPages`), snap => setMassFavPages(snap.val() || {})), []);
  const sectionFavPages = massFavPages[holyMassSection] || {};
  const isFavPage = (key) => !!sectionFavPages[key];
  const toggleFavPage = (key) => {
    set(ref(db, `${P}/massFavPages/${holyMassSection}/${key}`), sectionFavPages[key] ? null : Date.now())
      .catch(e => setError('Could not save favourite: ' + e.message));
  };
  const favPageIdxs = holyMassLibrary.map((item, i) => (sectionFavPages[item.key] ? i : -1)).filter(i => i >= 0);
  // Next/Prev ★: from the page that's open (or on the display), open the next starred page and show its first slide
  const gotoFavPage = (dir) => {
    if (!favPageIdxs.length) return;
    const cur = holyMassLibrary.findIndex(i => i.key === (holyMassOpenKey || activeHolyMassKey));
    const targetIdx = dir > 0
      ? (favPageIdxs.find(i => i > cur) ?? favPageIdxs[0])                          // wrap to the first
      : ([...favPageIdxs].reverse().find(i => i < cur) ?? favPageIdxs[favPageIdxs.length - 1]);
    const page = holyMassLibrary[targetIdx];
    setHolyMassOpenKey(page.key);
    sendHolyMassPart(page, 0, 0);
  };
  const favNav = favPageIdxs.length > 0 && (
    <div className="holy-mass-add-row holy-mass-fav-row">
      <button className="media-upload-btn holy-mass-fav-btn" onClick={() => gotoFavPage(-1)}>◀ Prev ★</button>
      <span className="holy-mass-fav-count">★ {favPageIdxs.length}</span>
      <button className="media-upload-btn holy-mass-fav-btn" onClick={() => gotoFavPage(1)}>Next ★ ▶</button>
    </div>
  );

  // Sends one speaker part of a page to the display (speaker + words). A page without text goes
  // as its image. seq lets the display's ◀ ▶ step through the part's screens, then parts, then pages.
  const sendHolyMassPart = async (item, partIdx, slideIdx = 0) => {
    setActiveHolyMassKey(item.key);
    setActiveHolyMassPart(partIdx);
    const section = HOLY_MASS_SECTIONS[holyMassSection];
    const name = holyMassSentName(item);
    const seq = { kind: 'holyMass', path: section.path, key: item.key, part: partIdx, slide: slideIdx, title: section.label, lang: section.lang };
    const part = holyMassTextParts(item)[partIdx];
    if (!part) { await sendMedia({ ...item, name, seq }); return; }
    const slideText = (part.slides?.length ? part.slides : [part.text])[slideIdx] ?? part.text;
    try {
      await set(ref(db, `${P}/currentMedia`), {
        type: 'text', text: slideText, role: part.role || null,
        label: name, lang: section.lang, ts: Date.now(), seq,
      });
      setSent(name);
      setTimeout(() => setSent(null), 2000);
    } catch (e) { setError('Send failed: ' + e.message); }
  };

  // Follow pages/slides the display stepped to with its own ◀ ▶
  useEffect(() => {
    return onValue(ref(db, `${P}/currentMedia/seq`), snap => {
      const seq = snap.val();
      if (seq?.kind === 'holyMass') {
        setActiveHolyMassKey(seq.key);
        setActiveHolyMassPart(seq.part ?? 0);
        setActiveHolyMassSlide(seq.slide ?? 0);
        setHolyMassOpenKey(open => (open ? seq.key : open));
      }
      else if (seq?.kind === 'slides') setActiveSlide({ deckKey: seq.deckKey, idx: Number(seq.key) });
    });
  }, []);


  // Jump straight to page N (1-based, in list order)
  // Pages can carry the book's printed page number as `label` (e.g. PDF page 22 = page 8);
  // without labels, page N is the Nth image in the list.
  const holyMassHasLabels = holyMassLibrary.some(i => i.label !== undefined);
  const holyMassNumbered = holyMassHasLabels
    ? holyMassLibrary.map(i => Number(i.label)).filter(n => Number.isInteger(n) && n > 0)
    : [];
  const holyMassPageRange = holyMassHasLabels
    ? (holyMassNumbered.length ? `${Math.min(...holyMassNumbered)}–${Math.max(...holyMassNumbered)}` : '')
    : `1–${holyMassLibrary.length}`;
  const holyMassPageLabel = (item, idx) =>
    holyMassHasLabels ? (item.label ? `Page ${item.label}` : 'Unnumbered') : `${idx + 1} · ${item.name.replace(/\.[^.]+$/, '')}`;
  const holyMassOpenPage = holyMassLibrary.find(i => i.key === holyMassOpenKey) || null;
  const holyMassSentName = (item) =>
    `${HOLY_MASS_SECTIONS[holyMassSection]?.label} · ${holyMassPageLabel(item, holyMassLibrary.findIndex(i => i.key === item.key))}`;

  const gotoForm = (
    <form
      className="holy-mass-goto-row"
      onSubmit={e => { e.preventDefault(); goToHolyMassPage(); }}
    >
      <label className="holy-mass-goto-label" htmlFor="holy-mass-goto">Go to page</label>
      <input
        id="holy-mass-goto"
        className="search-input holy-mass-goto-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder={holyMassPageRange}
        value={holyMassPageInput}
        onChange={e => setHolyMassPageInput(e.target.value.replace(/\D/g, ''))}
      />
      <button type="submit" className="search-go-btn holy-mass-goto-btn" disabled={!holyMassPageInput}>
        Go
      </button>
    </form>
  );

  const goToHolyMassPage = () => {
    const n = parseInt(holyMassPageInput, 10);
    const target = holyMassHasLabels
      ? holyMassLibrary.find(i => i.label === String(n))
      : holyMassLibrary[n - 1];
    if (!Number.isInteger(n) || !target) {
      setError(`No page ${holyMassPageInput} — pages are ${holyMassPageRange}`);
      return;
    }
    setHolyMassOpenKey(target.key);
    setHolyMassPageInput('');
  };

  // Scroll active Holy Mass image into view when it changes
  useEffect(() => {
    if (!activeHolyMassKey || !holyMassView || !holyMassSection) return;
    requestAnimationFrame(() => {
      const el = document.querySelector('.holy-mass-active');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [activeHolyMassKey, holyMassView, holyMassSection]);

  // ── Slides ────────────────────────────────────────────────────────────────
  const slideTags = useMemo(
    () => [...new Set(slideDecks.map(d => d.tag).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [slideDecks]
  );
  const openDeck = slideDecks.find(d => d.key === openDeckKey) || null;
  const visibleDecks = slideTagFilter ? slideDecks.filter(d => d.tag === slideTagFilter) : slideDecks;

  const pickSlideFiles = (fileList) => {
    const files = [...(fileList || [])];
    if (!files.length) return;
    if (!slideFileKind(files)) { setError('Choose one PDF, one PowerPoint (.pptx), or one or more images'); return; }
    setDeckDraft({
      files,
      name: files.length === 1 ? files[0].name.replace(/\.[^.]+$/, '') : '',
      tag: slideTagFilter,
      author: '',
    });
  };

  const saveDeck = async () => {
    const d = deckDraft;
    const fields = { name: d.name.trim(), tag: d.tag.trim(), author: d.author.trim() };
    if (!fields.name) { setError('Give the slides a name'); return; }
    if (d.editKey) {
      try { await update(ref(db, `${P}/slideDecks/${d.editKey}`), fields); setDeckDraft(null); }
      catch (e) { setError('Save failed: ' + e.message); }
      return;
    }
    // Convert to images, upload each as slides/<deckKey>/NNN.<ext>, then save the deck
    const deckKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const uploaded = [];
    setSlideProgress('Preparing…');
    try {
      const images = await convertToSlides(d.files, setSlideProgress);
      const slides = [];
      for (let i = 0; i < images.length; i++) {
        setSlideProgress(`Uploading slide ${i + 1} of ${images.length}…`);
        const { blob, ext } = images[i];
        const path = `slides/${deckKey}/${String(i + 1).padStart(3, '0')}.${ext}`;
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, blob, { contentType: blob.type || 'image/jpeg' });
        uploaded.push(path);
        slides.push({ url: await getDownloadURL(fileRef), path });
      }
      await set(ref(db, `${P}/slideDecks/${deckKey}`), { ...fields, slides, ts: Date.now() });
      setDeckDraft(null);
      setOpenDeckKey(deckKey);
    } catch (e) {
      await Promise.all(uploaded.map(p => deleteObject(storageRef(storage, p)).catch(() => {})));
      setError('Slides upload failed: ' + e.message);
    } finally {
      setSlideProgress(null);
    }
  };

  const deleteDeck = async (deck) => {
    if (!window.confirm(`Delete "${deck.name}" (${deck.slides.length} slides)?`)) return;
    try {
      await Promise.all(deck.slides.map(s => deleteObject(storageRef(storage, s.path)).catch(() => {})));
      await set(ref(db, `${P}/slideDecks/${deck.key}`), null);
      if (openDeckKey === deck.key) setOpenDeckKey(null);
    } catch (e) { setError('Delete failed: ' + e.message); }
  };

  const sendSlide = async (deck, idx) => {
    const slide = deck.slides[idx];
    if (!slide) return;
    setActiveSlide({ deckKey: deck.key, idx });
    await sendMedia({ type: 'image', url: slide.url, name: `${deck.name} · ${idx + 1}`, seq: { kind: 'slides', deckKey: deck.key, key: String(idx) } });
  };

  const navigateSlides = (dir) => {
    if (!openDeck?.slides.length) return;
    const idx = activeSlide?.deckKey === openDeck.key ? activeSlide.idx : -1;
    const nextIdx = dir === 'prev'
      ? Math.max(0, idx - 1)
      : Math.min(openDeck.slides.length - 1, idx + 1);
    if (nextIdx !== idx) sendSlide(openDeck, nextIdx);
  };

  // Scroll the slide on screen into view when it changes
  useEffect(() => {
    if (!slidesView || !activeSlide || activeSlide.deckKey !== openDeckKey) return;
    requestAnimationFrame(() => {
      const el = document.querySelector('.slides-grid .holy-mass-active');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [activeSlide, slidesView, openDeckKey]);

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

  // Malayalam Bible uses its own b1..b73 key scheme (not aligned with English keys),
  // but each book node carries a `shortName` set to the English book name — use that
  // to map English name -> Malayalam book key for fetching Malayalam verse text.
  useEffect(() => {
    (async () => {
      try {
        const bookKeys = await restFetch('malayalam', true);
        const keys = Object.keys(bookKeys || {});
        const shortNames = await Promise.all(keys.map(k => restFetch(`malayalam/${k}/shortName`)));
        const map = {};
        keys.forEach((k, i) => { if (typeof shortNames[i] === 'string') map[shortNames[i]] = k; });
        setNameToKeyML(map);
      } catch { /* Malayalam text fetch will just fail per-verse if this doesn't load */ }
    })();
  }, []);

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
        // Bible verse — show Malayalam text (the remote app's own preview language)
        const keyML = nameToKeyML[r.book];
        let text = '';
        if (keyML) {
          try {
            const val = await restFetch(`malayalam/${keyML}/chapters/ch${r.chapter}/${r.verse}`);
            text = typeof val === 'string' ? val : '';
          } catch { /* offline */ }
        }
        const mlBook = BOOK_NAME_ML[r.book] || '';
        const ref = mlBook
          ? `${r.book} ${r.chapter}:${r.verse} / ${mlBook} ${r.chapter}:${r.verse}`
          : `${r.book} ${r.chapter}:${r.verse}`;
        return {
          type: 'bible',
          ref,
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

  const pickTheme = (id) => {
    setTheme(id);
    sendSetting('theme', id);
    setThemeMenu(false);
  };
  // follow the theme chosen on the display or another remote
  useEffect(() => onValue(ref(db, `${P}/settings/theme`), snap => { if (snap.val()) setTheme(snap.val()); }), []);

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
      // EN previews songs in Manglish (same slide layout), falling back to Malayalam
      let bytes;
      if (language === 'EN') {
        try { bytes = await getBytes(storageRef(storage, `lyrics-text/${entry.filename}.manglish.txt`)); } catch { /* no Manglish version */ }
      }
      if (!bytes) bytes = await getBytes(storageRef(storage, `lyrics-text/${entry.filename}.txt`));
      const { title, slides } = parseLyrics(new TextDecoder('utf-8').decode(bytes));
      setSelectedSong({ filename: entry.filename, title: title || entry.title, slides });
    } catch {
      setError('Could not load song: ' + entry.title);
    } finally {
      setSongSlidesLoading(false);
    }
  };

  // Reload an open song's preview when the language changes (EN = Manglish, ML = Malayalam)
  useEffect(() => {
    if (selectedSong) selectSong({ filename: selectedSong.filename, title: selectedSong.title });
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (holyMassView) {
      if (holyMassOpenKey) { setHolyMassOpenKey(null); return; }
      if (planViewId) { setPlanViewId(null); return; }
      if (holyMassSection) { setHolyMassSection(null); return; }
      setHolyMassView(false); return;
    }
    if (slidesView) {
      if (deckDraft && !slideProgress) { setDeckDraft(null); return; }
      if (openDeckKey) { setOpenDeckKey(null); return; }
      setSlidesView(false); return;
    }
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
    setHolyMassView(false); setHolyMassSection(null); setHolyMassOpenKey(null); setPlanViewId(null); setPlanEditId(null);
    setSlidesView(false); setOpenDeckKey(null); setDeckDraft(null);
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
    holyMassView && planViewId && !holyMassOpenPage && planById(planViewId) ? `Plan · ${planById(planViewId).name}` :
    holyMassView && holyMassOpenPage ? `${HOLY_MASS_SECTIONS[holyMassSection].label} · ${holyMassPageLabel(holyMassOpenPage, holyMassLibrary.indexOf(holyMassOpenPage))}` :
    holyMassView && holyMassSection ? HOLY_MASS_SECTIONS[holyMassSection].label :
    holyMassView              ? 'Holy Mass' :
    slidesView && openDeck    ? openDeck.name :
    slidesView                ? 'Slides' :
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


  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          {(view !== 'testament' || searchView || songsView || mediaView || settingsView || holyMassView || slidesView) && (
            <button className="icon-btn" onClick={goBack} aria-label="Back" disabled={frozen}>
              <ChevronLeft />
            </button>
          )}
          <span className="header-title">{headerTitle}</span>
        </div>
        <div className="header-right">
          {(view !== 'testament' || searchView || songsView || mediaView || settingsView || holyMassView || slidesView) && (
            <button className="icon-btn" onClick={goHome} aria-label="Home" disabled={frozen}>
              <HomeIcon />
            </button>
          )}
        </div>
      </header>

      {/* Floating settings bar */}
      <div className="settings-bar">
        <button className="settings-btn icon-only" onClick={() => slidesView && openDeck ? navigateSlides('prev') : sendNav('prev')} aria-label="Previous" disabled={frozen}>
          <ChevronLeft small />
        </button>
        <button className="settings-btn icon-only" onClick={() => slidesView && openDeck ? navigateSlides('next') : sendNav('next')} aria-label="Next" disabled={frozen}>
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
        <button className={`settings-btn${themeMenu ? ' active' : ''}`} onClick={() => setThemeMenu(m => !m)} aria-label="Choose theme" disabled={frozen}>
          <span className="theme-dot" style={{ background: getTheme(theme).bg }} />
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

      {/* Theme picker */}
      {themeMenu && (
        <div className="theme-picker">
          {THEMES.map(t => (
            <button key={t.id} className={`theme-swatch${getTheme(theme).id === t.id ? ' selected' : ''}`}
              style={{ background: t.bg }} onClick={() => pickTheme(t.id)}>
              <span className="theme-swatch-text" style={{ color: t.text }}>Aa</span>
              <span className="theme-swatch-ref" style={{ color: t.ref }}>{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Holy Mass controls: page, favourites, go to page, clear, running plan */}
      {holyMassView && holyMassSection && (() => {
        const curPage = holyMassOpenPage || holyMassLibrary.find(i => i.key === activeHolyMassKey) || null;
        const curIdx = curPage ? holyMassLibrary.indexOf(curPage) : -1;
        const openPageAt = (idx) => { const pg = holyMassLibrary[idx]; if (pg) { setPlanViewId(null); setHolyMassOpenKey(pg.key); } };
        const fav = curPage && isFavPage(curPage.key);
        return (
          <div className="mass-bar">
            <div className="mass-bar-group">
              <span className="mass-bar-label">Page</span>
              <button className="mass-bar-btn" disabled={curIdx <= 0} onClick={() => openPageAt(curIdx - 1)} aria-label="Previous page">‹</button>
              <span className="mass-bar-page">{curPage ? (curPage.label || '–') : '–'}</span>
              <button className="mass-bar-btn" disabled={curIdx >= holyMassLibrary.length - 1} onClick={() => openPageAt(curIdx + 1)} aria-label="Next page">›</button>
              <button
                className={`mass-bar-btn mass-bar-star${fav ? ' mass-bar-star-on' : ''}`}
                disabled={!curPage}
                onClick={() => curPage && toggleFavPage(curPage.key)}
                title={fav ? 'Remove page from favourites' : 'Mark page as favourite'}
              >{fav ? '★' : '☆'}</button>
            </div>
            {favPageIdxs.length > 0 && (
              <div className="mass-bar-group mass-bar-fav">
                <button className="mass-bar-btn" onClick={() => { setPlanViewId(null); gotoFavPage(-1); }} aria-label="Previous favourite page">◀★</button>
                <span className="mass-bar-count">{favPageIdxs.length}</span>
                <button className="mass-bar-btn" onClick={() => { setPlanViewId(null); gotoFavPage(1); }} aria-label="Next favourite page">★▶</button>
              </div>
            )}
            <form className="mass-bar-group" onSubmit={e => { e.preventDefault(); setPlanViewId(null); goToHolyMassPage(); }}>
              <span className="mass-bar-label">Go to</span>
              <input
                className="mass-bar-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={holyMassPageRange}
                value={holyMassPageInput}
                onChange={e => setHolyMassPageInput(e.target.value.replace(/\D/g, ''))}
                aria-label="Go to page"
              />
              <button type="submit" className="mass-bar-btn mass-bar-go" disabled={!holyMassPageInput}>Go</button>
            </form>
            <div className="mass-bar-group">
              <button className="mass-bar-btn mass-bar-clear" onClick={clearMediaScreen} title="Clear the display">⬜ Clear</button>
            </div>
            {runningPlan && !editingPlan && (
              <div className="mass-bar-group mass-bar-plan">
                <button className="mass-bar-btn mass-bar-plan-name" onClick={() => { setHolyMassOpenKey(null); setPlanViewId(runningPlan.id); }} title="Open the running plan">
                  ▶ {runningPlan.name}
                </button>
                <button className="mass-bar-btn" onClick={stopPlan} title="Stop the plan">■</button>
              </div>
            )}
          </div>
        );
      })()}

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
            <p className="section-heading">Account</p>
            <div className="access-account-row">
              <span className="access-email">{userEmail}</span>
              <button className="access-signout-btn" onClick={signOut}>Sign out</button>
            </div>

            {isOwner && <AllowedUsers currentSession={P} onJoin={onSwitchSession} />}

            {isOwner && <EventFrameSettings P={P} />}

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
        {holyMassView && !holyMassSection && (
          <div className="testament-grid">
            {Object.entries(HOLY_MASS_SECTIONS).map(([key, { label }]) => {
              const count = holyMassLibraries[key].length;
              return (
                <button key={key} className="testament-btn holy-mass-testament-btn" onClick={() => setHolyMassSection(key)}>
                  <CrossIcon />
                  <span className="testament-label">{label}</span>
                  <span className="testament-count">{count > 0 ? `${count} page${count !== 1 ? 's' : ''}` : 'No pages yet'}</span>
                </button>
              );
            })}
          </div>
        )}

        {holyMassView && holyMassSection && !holyMassOpenPage && !planViewId && (
          <div className="search-view">
            {planEditBanner}
            {plansPanel}
            <div className="holy-mass-add-row">
              <label className="media-upload-btn holy-mass-upload-btn">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  disabled={holyMassUploading}
                  onChange={e => { uploadHolyMass(e.target.files); e.target.value = ''; }}
                />
                {holyMassUploading ? 'Uploading…' : <><span>🖼</span> Add Images</>}
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
              {holyMassLibrary.map((item, pageIdx) => {
                const isSent = sent === holyMassSentName(item);
                const isActive = activeHolyMassKey === item.key;
                return (
                  <div key={item.key} className={`holy-mass-card${isActive ? ' holy-mass-active' : ''}`}>
                    <button className="media-list-thumb-btn" onClick={() => setHolyMassOpenKey(item.key)}>
                      <img src={item.url} alt={item.name} className="holy-mass-thumb" />
                      {isSent && <div className="media-sent-overlay">✓ Sent</div>}
                    </button>
                    <div className="holy-mass-card-footer">
                      <span className="holy-mass-img-name">{holyMassPageLabel(item, pageIdx)}</span>
                      <button
                        className={`holy-mass-star${isFavPage(item.key) ? ' holy-mass-star-on' : ''}`}
                        onClick={() => toggleFavPage(item.key)}
                        title={isFavPage(item.key) ? 'Remove from favourites' : 'Add to favourites'}
                      >{isFavPage(item.key) ? '★' : '☆'}</button>
                      <button className="media-delete-btn" onClick={() => deleteHolyMass(item)} title="Delete">✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {holyMassView && holyMassSection && planViewId && !holyMassOpenPage && (() => {
          const pl = planById(planViewId);
          if (!pl) return null;
          const running = activePlanId === pl.id;
          return (
            <div className="search-view">
              <div className="mass-plan-actions">
                {running
                  ? <button className="mass-plan-btn" onClick={stopPlan}>■ Stop plan</button>
                  : <button className="mass-plan-btn mass-plan-btn-primary" disabled={!pl.items.length} onClick={() => startPlan(pl)}>▶ Start plan</button>}
                <button className="mass-plan-btn" onClick={() => { setPlanEditId(pl.id); setPlanViewId(null); }}>＋ Add slides</button>
                <button className="mass-plan-btn" onClick={() => copyPlan(pl)}>Copy</button>
                <button className="mass-plan-btn mass-plan-btn-danger" onClick={() => deletePlan(pl)}>Delete</button>
              </div>
              {pl.items.length === 0 && <p className="section-heading">No slides yet — tap ＋ Add slides, then ＋ on the slides you use</p>}
              <div className="holy-mass-parts">
                {pl.items.map((it, i) => {
                  const info = planItemInfo(it);
                  const isActive = activeHolyMassKey === it.key && activeHolyMassPart === it.part && activeHolyMassSlide === it.slide;
                  return (
                    <div key={`${it.key}-${it.part}-${it.slide}`} role="button" tabIndex={0}
                      className={`holy-mass-part-btn${isActive ? ' holy-mass-part-active' : ''}`}
                      onClick={() => sendPlanItem(it)}
                      onKeyDown={e => { if (e.key === 'Enter') sendPlanItem(it); }}
                    >
                      <span className="holy-mass-part-num">{i + 1}</span>
                      <span className="holy-mass-part-body">
                        <span className="holy-mass-part-role">{info.page}{info.role ? ` · ${info.role}` : ''}</span>
                        <span className="holy-mass-part-text">{info.text}</span>
                      </span>
                      <span className="mass-plan-item-tools" onClick={e => e.stopPropagation()}>
                        <button className="mass-plan-icon" disabled={i === 0} onClick={() => movePlanItem(pl, i, -1)} title="Move up">▲</button>
                        <button className="mass-plan-icon" disabled={i === pl.items.length - 1} onClick={() => movePlanItem(pl, i, 1)} title="Move down">▼</button>
                        <button className="mass-plan-icon" onClick={() => removePlanItem(pl, i)} title="Remove">✕</button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {holyMassView && holyMassSection && holyMassOpenPage && (() => {
          const page = holyMassOpenPage;
          const pageIdx = holyMassLibrary.indexOf(page);
          const parts = holyMassTextParts(page);
          const goPage = (d) => { const p = holyMassLibrary[pageIdx + d]; if (p) setHolyMassOpenKey(p.key); };
          return (
            <div className="search-view">
              {planEditBanner}

              <img src={page.url} alt={holyMassPageLabel(page, pageIdx)} className="holy-mass-page-full" style={{ marginBottom: 12 }} />

              {parts.length === 0 && <p className="section-heading">No text on this page</p>}
              <div className="holy-mass-parts">
                {parts.length === 0 && (
                  <button className="holy-mass-part-btn" onClick={() => sendHolyMassPart(page, 0)}>
                    <span className="holy-mass-part-text">Show the page image</span>
                  </button>
                )}
                {parts.flatMap((pt, i) => {
                  const screens = pt.slides?.length ? pt.slides : [pt.text];  // same slides as the display
                  return screens.map((text, j) => {
                    const isActive = activeHolyMassKey === page.key && activeHolyMassPart === i && activeHolyMassSlide === j;
                    return (
                      <div
                        key={`${i}-${j}`}
                        role="button"
                        tabIndex={0}
                        className={`holy-mass-part-btn${isActive ? ' holy-mass-part-active' : ''}${j > 0 ? ' holy-mass-part-cont' : ''}`}
                        onClick={() => sendHolyMassPart(page, i, j)}
                        onKeyDown={e => { if (e.key === 'Enter') sendHolyMassPart(page, i, j); }}
                      >
                        <span className="holy-mass-part-num">{screens.length > 1 ? `${i + 1}.${j + 1}` : i + 1}</span>
                        <span className="holy-mass-part-body">
                          {pt.role && (
                            <span className="holy-mass-part-role">
                              {pt.role}{pt.roleName ? ` · ${pt.roleName}` : ''}
                              {screens.length > 1 ? ` · ${j + 1} of ${screens.length}` : ''}
                            </span>
                          )}
                          {!pt.role && screens.length > 1 && <span className="holy-mass-part-role">{j + 1} of {screens.length}</span>}
                          <span className="holy-mass-part-text">{text}</span>
                        </span>
                        {editingPlan && (
                          <button
                            className={`holy-mass-star mass-plan-tick${inPlan(editingPlan, page.key, i, j) ? ' mass-plan-tick-on' : ''}`}
                            onClick={e => { e.stopPropagation(); togglePlanItem(page.key, i, j); }}
                            title={inPlan(editingPlan, page.key, i, j) ? 'Remove from plan' : 'Add to plan'}
                          >{inPlan(editingPlan, page.key, i, j) ? '✓' : '＋'}</button>
                        )}
                      </div>
                    );
                  });
                })}
              </div>
            </div>
          );
        })()}

        {/* ── Slides view ── */}
        {slidesView && !openDeck && (
          <div className="search-view">
            <div className="holy-mass-add-row">
              <label className={`media-upload-btn slides-upload-btn${deckDraft ? ' slides-upload-btn-disabled' : ''}`}>
                <input
                  type="file"
                  accept={SLIDE_ACCEPT}
                  multiple
                  style={{ display: 'none' }}
                  disabled={!!deckDraft}
                  onChange={e => { pickSlideFiles(e.target.files); e.target.value = ''; }}
                />
                <span>⬆</span> Upload
              </label>
              <button className="media-upload-btn media-clear-btn" onClick={clearMediaScreen}>
                <span>⬜</span> Clear
              </button>
            </div>

            {deckDraft && (
              <div className="media-text-form slides-form">
                {deckDraft.files && (
                  <p className="slides-form-files">
                    {deckDraft.files.length === 1 ? deckDraft.files[0].name : `${deckDraft.files.length} images`}
                  </p>
                )}
                <input
                  className="search-input"
                  placeholder="Name"
                  value={deckDraft.name}
                  onChange={e => setDeckDraft(d => ({ ...d, name: e.target.value }))}
                  disabled={!!slideProgress}
                />
                <input
                  className="search-input"
                  list="slide-tag-options"
                  placeholder="Tag Name (e.g. Christmas)"
                  value={deckDraft.tag}
                  onChange={e => setDeckDraft(d => ({ ...d, tag: e.target.value }))}
                  disabled={!!slideProgress}
                />
                <datalist id="slide-tag-options">
                  {slideTags.map(t => <option key={t} value={t} />)}
                </datalist>
                <input
                  className="search-input"
                  placeholder="Author (optional)"
                  value={deckDraft.author}
                  onChange={e => setDeckDraft(d => ({ ...d, author: e.target.value }))}
                  disabled={!!slideProgress}
                />
                <div className="holy-mass-add-row" style={{ marginBottom: 0 }}>
                  <button className="media-text-save-btn" onClick={saveDeck} disabled={!!slideProgress}>
                    {slideProgress || (deckDraft.editKey ? 'Save' : 'Upload')}
                  </button>
                  <button className="media-upload-btn media-clear-btn" onClick={() => setDeckDraft(null)} disabled={!!slideProgress}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {slideTags.length > 0 && (
              <div className="slides-tag-row">
                {['', ...slideTags].map(t => (
                  <button
                    key={t || '__all'}
                    className={`slides-tag-chip${slideTagFilter === t ? ' slides-tag-chip-active' : ''}`}
                    onClick={() => setSlideTagFilter(t)}
                  >
                    {t || 'All'}
                  </button>
                ))}
              </div>
            )}

            {visibleDecks.length === 0 && !deckDraft && (
              <p className="section-heading" style={{ textAlign: 'center', marginTop: 32 }}>
                No slides yet — upload a PowerPoint (.pptx), a PDF, or images.
                <br />From Google Slides: File → Download → PDF or .pptx.
              </p>
            )}

            <div className="slides-deck-list">
              {visibleDecks.map(deck => (
                <div key={deck.key} className="slides-deck-card">
                  <button className="slides-deck-open" onClick={() => setOpenDeckKey(deck.key)}>
                    {deck.slides[0]
                      ? <img src={deck.slides[0].url} alt="" className="slides-deck-thumb" loading="lazy" />
                      : <div className="slides-deck-thumb" />}
                    <div className="slides-deck-info">
                      <span className="slides-deck-name">{deck.name}</span>
                      <span className="slides-deck-meta">
                        {deck.slides.length} slide{deck.slides.length !== 1 ? 's' : ''}{deck.author ? ` · ${deck.author}` : ''}
                      </span>
                      {deck.tag && <span className="slides-tag-chip slides-tag-chip-static">{deck.tag}</span>}
                    </div>
                  </button>
                  <div className="slides-deck-actions">
                    <button
                      className="media-edit-btn"
                      onClick={() => setDeckDraft({ editKey: deck.key, name: deck.name || '', tag: deck.tag || '', author: deck.author || '' })}
                      title="Edit name, tag, author"
                      disabled={!!deckDraft}
                    >✎</button>
                    <button className="media-delete-btn" onClick={() => deleteDeck(deck)} title="Delete">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {slidesView && openDeck && (
          <div className="search-view">
            {(openDeck.tag || openDeck.author) && (
              <div className="slides-open-meta">
                {openDeck.tag && <span className="slides-tag-chip slides-tag-chip-static">{openDeck.tag}</span>}
                {openDeck.author && <span className="slides-deck-meta">by {openDeck.author}</span>}
              </div>
            )}
            <button className="media-upload-btn media-clear-btn" style={{ marginBottom: 12 }} onClick={clearMediaScreen}>
              <span>⬜</span> Clear screen
            </button>
            <div className="holy-mass-grid slides-grid">
              {openDeck.slides.map((slide, i) => {
                const isActive = activeSlide?.deckKey === openDeck.key && activeSlide.idx === i;
                return (
                  <div key={slide.path} className={`holy-mass-card${isActive ? ' holy-mass-active' : ''}`}>
                    <button className="media-list-thumb-btn" onClick={() => sendSlide(openDeck, i)}>
                      <img src={slide.url} alt={`Slide ${i + 1}`} className="holy-mass-thumb slides-thumb" loading="lazy" />
                      {sent === `${openDeck.name} · ${i + 1}` && <div className="media-sent-overlay">✓ Sent</div>}
                    </button>
                    <div className="holy-mass-card-footer">
                      <span className="holy-mass-img-name">Slide {i + 1}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Home picker ── */}
        {!songsView && !searchView && !mediaView && !settingsView && !holyMassView && !slidesView && view === 'testament' && (
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
                    Liturgical images
                  </span>
                </button>
                <button className="testament-btn slides-testament-btn" onClick={() => setSlidesView(true)}>
                  <SlidesIcon />
                  <span className="testament-label">Slides</span>
                  <span className="testament-count">
                    {slideDecks.length > 0 ? `${slideDecks.length} deck${slideDecks.length !== 1 ? 's' : ''}` : 'PowerPoint & PDF'}
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
        {!songsView && !searchView && !mediaView && !settingsView && !holyMassView && !slidesView && view === 'recent' && (
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
        {!songsView && !searchView && !mediaView && !settingsView && !holyMassView && !slidesView && view === 'ccc-ranges' && (
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
        {!songsView && !searchView && !mediaView && !settingsView && !holyMassView && !slidesView && view === 'ccc-paragraphs' && selectedCccRange && (
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
        {!songsView && !searchView && !mediaView && !settingsView && !holyMassView && !slidesView && view === 'books' && (
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
        {!songsView && !searchView && !mediaView && !settingsView && !holyMassView && !slidesView && view === 'chapters' && (
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
        {!songsView && !searchView && !mediaView && !settingsView && !holyMassView && !slidesView && view === 'verses' && (
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

// ── Event frame editor (owner only): drag text and logos on a 16:9 preview of the display ──
const newItemId = () => `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function EventFrameSettings({ P }) {
  const [frame, setFrame] = useState(null);       // saved state
  const [items, setItems] = useState({});         // working copy (moves live while dragging)
  const [sel, setSel] = useState(null);
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const boxRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => onValue(ref(db, `${P}/eventFrame`), snap => {
    const v = snap.val();
    setFrame(v);
    if (!dragRef.current) setItems(frameItems(v));
  }), [P]);

  const enabled = !!frame?.enabled;
  const border = frame?.border !== false;
  const save = (patch) => update(ref(db, `${P}/eventFrame`), patch).catch(e => setMsg('Could not save: ' + e.message));
  const saveItems = (next) => { setItems(next); save({ items: next }); };
  const setItem = (id, patch) => saveItems({ ...items, [id]: { ...items[id], ...patch } });

  const onItemPointerDown = (id, e) => {
    e.preventDefault();
    setSel(id);
    const rect = boxRef.current.getBoundingClientRect();
    const it = items[id];
    dragRef.current = { id, dx: e.clientX - (rect.left + rect.width * it.x / 100), dy: e.clientY - (rect.top + rect.height * it.y / 100), moved: false };
    const move = (ev) => {
      const d = dragRef.current;
      const x = Math.min(100, Math.max(0, ((ev.clientX - d.dx - rect.left) / rect.width) * 100));
      const y = Math.min(100, Math.max(0, ((ev.clientY - d.dy - rect.top) / rect.height) * 100));
      d.moved = true;
      setItems(cur => ({ ...cur, [d.id]: { ...cur[d.id], x: +x.toFixed(1), y: +y.toFixed(1) } }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const d = dragRef.current;
      dragRef.current = null;
      if (d?.moved) setItems(cur => { save({ items: cur }); return cur; });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const addText = () => {
    const id = newItemId();
    saveItems({ ...items, [id]: { type: 'text', text: 'New text', x: 50, y: 50, size: 2, font: 'bold', color: '' } });
    setSel(id);
  };
  const addLogo = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `event-frame/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const r = storageRef(storage, path);
      await uploadBytes(r, file, { contentType: file.type });
      const url = await getDownloadURL(r);
      const id = newItemId();
      saveItems({ ...items, [id]: { type: 'image', url, path, x: 8, y: 50, size: 10 } });
      setSel(id);
    } catch (e) { setMsg('Upload failed: ' + e.message); }
    finally { setUploading(false); }
  };
  const removeItem = (id) => {
    const it = items[id];
    const next = { ...items };
    delete next[id];
    saveItems(next);
    setSel(null);
    if (it?.path) deleteObject(storageRef(storage, it.path)).catch(() => {});
  };
  const resetLayout = () => {
    if (!window.confirm('Reset the frame to the Encounter layout? Your text and logo positions will be replaced.')) return;
    saveItems(defaultFrameItems());
    setSel(null);
  };

  const it = sel && items[sel];
  return (
    <>
      <p className="section-heading">Event frame</p>
      <div className="event-frame-box">
        <div className="access-account-row">
          <span className="access-email">Show the event frame on the display</span>
          <button className={`event-frame-toggle${enabled ? ' on' : ''}`} onClick={() => save({ enabled: !enabled, items })}>
            {enabled ? 'On' : 'Off'}
          </button>
        </div>

        <div className="ef-toolbar">
          <button className="ef-btn" onClick={addText}>＋ Text</button>
          <label className={`ef-btn${uploading ? ' ef-disabled' : ''}`}>
            <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading}
              onChange={e => { addLogo(e.target.files?.[0]); e.target.value = ''; }} />
            {uploading ? 'Uploading…' : '＋ Logo'}
          </label>
          <button className={`ef-btn${border ? ' ef-on' : ''}`} onClick={() => save({ border: !border })}>Border {border ? 'on' : 'off'}</button>
          <button className="ef-btn" onClick={resetLayout}>Reset</button>
        </div>

        <div ref={boxRef} className="ef-preview" onPointerDown={e => { if (e.target === e.currentTarget) setSel(null); }}>
          <div className="ef-preview-sample">Verse text appears here</div>
          <EventFrame frame={{ ...(frame || {}), items }} isDark selectedId={sel} onItemPointerDown={onItemPointerDown} />
        </div>
        <p className="access-hint" style={{ margin: 0 }}>{msg || 'Drag items to place them. Tap an item to edit it.'}</p>

        {it && (
          <div className="ef-panel">
            {it.type === 'text' && (
              <label className="event-frame-field">
                <span>Text</span>
                <textarea className="search-input ef-text" rows={2} value={it.text}
                  onChange={e => setItems(cur => ({ ...cur, [sel]: { ...cur[sel], text: e.target.value } }))}
                  onBlur={() => save({ items })} />
              </label>
            )}
            <label className="event-frame-field">
              <span>Size · {it.size}</span>
              <input type="range" min={it.type === 'image' ? 3 : 0.5} max={it.type === 'image' ? 40 : 8} step={it.type === 'image' ? 0.5 : 0.1}
                value={it.size} onChange={e => setItems(cur => ({ ...cur, [sel]: { ...cur[sel], size: +e.target.value } }))}
                onPointerUp={() => save({ items })} onKeyUp={() => save({ items })} />
            </label>
            {it.type === 'text' && (
              <div className="ef-row">
                <label className="event-frame-field">
                  <span>Font</span>
                  <select className="search-input" value={it.font || 'normal'} onChange={e => setItem(sel, { font: e.target.value })}>
                    {Object.entries(FRAME_FONTS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
                  </select>
                </label>
                <label className="event-frame-field">
                  <span>Colour</span>
                  <span className="ef-colour">
                    <input type="color" value={it.color || '#fdf6e3'} onChange={e => setItem(sel, { color: e.target.value })} />
                    <button className="ef-btn ef-small" onClick={() => setItem(sel, { color: '' })}>Auto</button>
                  </span>
                </label>
                <label className="event-frame-field">
                  <span>Style</span>
                  <select className="search-input" value={it.style || 'plain'} onChange={e => setItem(sel, { style: e.target.value })}>
                    <option value="plain">Plain</option>
                    <option value="ribbon">Ribbon</option>
                  </select>
                </label>
              </div>
            )}
            <button className="ef-btn ef-danger" onClick={() => removeItem(sel)}>Delete {it.type === 'image' ? 'logo' : 'text'}</button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Owner-only: emails allowed to sign in (each gets its own private session) ──
function AllowedUsers({ currentSession, onJoin }) {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => onValue(ref(db, 'config/access'), snap => {
    setUsers(Object.entries(snap.val() || {}).map(([key, v]) => ({ key, ...v })).sort((a, b) => (a.email || '').localeCompare(b.email || '')));
  }), []);

  const add = async (e) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setMsg('Enter a valid email'); return; }
    if (em === OWNER_EMAIL) { setMsg('That is the owner account'); return; }
    try {
      await httpsCallable(functions, 'manageAccess')({ email: em, action: 'add' });
      setEmail(''); setMsg(`Added ${em}`);
    } catch (err) { setMsg('Could not add: ' + err.message); }
  };
  const remove = async (u) => {
    if (!window.confirm(`Remove access for ${u.email}?`)) return;
    try { await httpsCallable(functions, 'manageAccess')({ email: u.email, action: 'remove' }); setMsg(`Removed ${u.email} and signed them out`); }
    catch (err) { setMsg('Could not remove: ' + err.message); }
  };

  return (
    <>
      <p className="section-heading">Allowed users</p>
      <div className="access-list">
        <div className="access-user">
          <span className="access-email">{OWNER_EMAIL} <span className="access-owner-tag">Owner</span></span>
          <JoinButton session={sessionForEmail(OWNER_EMAIL)} currentSession={currentSession} onJoin={onJoin} />
        </div>
        {users.map(u => (
          <div key={u.key} className="access-user">
            <span className="access-email">{u.email}</span>
            <span className="access-actions">
              <JoinButton session={sessionForEmail(u.email)} currentSession={currentSession} onJoin={onJoin} />
              <button className="media-delete-btn" onClick={() => remove(u)} title="Remove access">✕</button>
            </span>
          </div>
        ))}
      </div>
      <form className="access-add-row" onSubmit={add}>
        <input
          className="search-input"
          type="email"
          placeholder="Add a Google account email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button type="submit" className="search-go-btn" disabled={!email.trim()}>Add</button>
      </form>
      <p className="access-hint">{msg || 'Each person signs in with Google on their own display and remote and gets their own private screen. Join controls that person\'s screen from this remote.'}</p>
    </>
  );
}

function JoinButton({ session, currentSession, onJoin }) {
  const joined = session === currentSession;
  return (
    <button className={`access-join-btn${joined ? ' access-joined' : ''}`} disabled={joined} onClick={() => onJoin?.(session)}>
      {joined ? 'Joined' : 'Join'}
    </button>
  );
}

// ── Google sign-in screen ─────────────────────────────────────────────────
function GoogleLogin({ access }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSignIn() {
    setError('');
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') setError(e.message || 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pin-login">
      <div className="pin-card">
        <div className="pin-cross">✝</div>
        <h1 className="pin-title">Bible Remote</h1>
        {access.status === 'checking' ? (
          <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, margin: '24px auto' }} />
        ) : access.status === 'denied' ? (
          <>
            <p className="pin-subtitle">{access.email || 'This account'} doesn't have access. Ask the owner to add it.</p>
            <button className="auth-btn auth-btn-secondary" onClick={() => fbSignOut(auth)}>Use a different account</button>
          </>
        ) : (
          <>
            <p className="pin-subtitle">Sign in to continue</p>
            <button className="auth-btn" onClick={handleSignIn} disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in with Google'}
            </button>
          </>
        )}
        <div className="pin-status"><span className="pin-error">{error}</span></div>
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
function SlidesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="13" rx="2"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
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
