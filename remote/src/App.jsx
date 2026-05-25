import { useState, useCallback, useRef, useEffect } from 'react';
import { ref, set, onValue } from 'firebase/database';
import { db, DB_URL } from './firebase';
import './App.css';

const OT_BOOKS = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra',
  'Nehemiah','Tobit','Judith','Esther','1 Maccabees','2 Maccabees','Job','Psalms',
  'Proverbs','Ecclesiastes','Song of Songs','Wisdom','Sirach','Isaiah','Jeremiah',
  'Lamentations','Baruch','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah',
  'Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi',
];

const NT_BOOKS = [
  'Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians',
  'Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians',
  '1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter',
  '1 John','2 John','3 John','Jude','Revelation',
];

async function restFetch(path, shallow = false) {
  const qs = shallow ? '?shallow=true' : '';
  const res = await fetch(`${DB_URL}/${path}.json${qs}`);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}

export default function App() {
  const [allBooks, setAllBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [nameToKey, setNameToKey] = useState({});

  const [view, setView] = useState('testament');
  const [testament, setTestament] = useState(null);
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
  const cccRanges = Array.from(
    { length: Math.ceil(CCC_TOTAL / CCC_RANGE_SIZE) },
    (_, i) => ({ start: i * CCC_RANGE_SIZE + 1, end: Math.min((i + 1) * CCC_RANGE_SIZE, CCC_TOTAL) })
  );
  const [selectedCccRange, setSelectedCccRange] = useState(null);

  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);

  // Settings state (mirrors what's active on the main display)
  const [language, setLanguage] = useState('EN');
  const [theme, setTheme] = useState('light');

  // AI keyword search
  const [searchView, setSearchView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const pendingSearchTs = useRef(null);

  const loadBooks = useCallback(async () => {
    setBooksLoading(true);
    setError(null);
    try {
      const bookKeys = await restFetch('english', true);
      const keys = Object.keys(bookKeys || {});
      const names = await Promise.all(keys.map(k => restFetch(`english/${k}/name`)));
      const map = {};
      const list = keys
        .map((k, i) => ({ key: k, name: names[i] }))
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

  // Listen for search results written back by the main display app
  useEffect(() => {
    const unsub = onValue(ref(db, 'remote/searchResults'), snap => {
      const val = snap.val();
      if (!val || val.ts !== pendingSearchTs.current) return;
      setSearchResults(val.results || []);
      setSearchLoading(false);
    });
    return unsub;
  }, []);

  async function submitSearch() {
    const q = searchQuery.trim();
    if (!q) return;
    const ts = Date.now();
    pendingSearchTs.current = ts;
    setSearchLoading(true);
    setSearchResults(null);
    try {
      await set(ref(db, 'remote/searchQuery'), { q, ts });
    } catch (e) {
      setError('Search failed: ' + e.message);
      setSearchLoading(false);
    }
  }

  async function sendSearchResult(result) {
    const match = result.ref.match(/^(.+)\s+(\d+):(\d+)$/);
    if (!match) return;
    try {
      await set(ref(db, 'remote/currentVerse'), {
        book: match[1],
        chapter: Number(match[2]),
        verse: Number(match[3]),
        timestamp: Date.now(),
      });
      setSent(result.ref);
      setTimeout(() => setSent(null), 2000);
    } catch (e) {
      setError('Send failed: ' + e.message);
    }
  }

  function getBooksForTestament(t) {
    const order = t === 'OT' ? OT_BOOKS : NT_BOOKS;
    const nameSet = new Set(allBooks.map(b => b.name));
    return order
      .filter(name => nameSet.has(name))
      .map(name => allBooks.find(b => b.name === name))
      .filter(Boolean);
  }

  function selectTestament(t) {
    setTestament(t);
    setView('books');
  }

  async function selectBook(name) {
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
    } catch (e) {
      setError('Could not load chapters: ' + e.message);
    } finally {
      setChaptersLoading(false);
    }
  }

  async function selectChapter(ch) {
    setSelectedChapter(ch);
    setVerses([]);
    setView('verses');
    setVersesLoading(true);
    setError(null);
    try {
      const vData = await restFetch(`english/${selectedBookKey}/chapters/ch${ch}`, true);
      const vs = Object.keys(vData || {})
        .map(Number)
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);
      setVerses(vs);
    } catch (e) {
      setError('Could not load verses: ' + e.message);
    } finally {
      setVersesLoading(false);
    }
  }

  async function sendVerse(verse) {
    const label = `${selectedBook} ${selectedChapter}:${verse}`;
    try {
      await set(ref(db, 'remote/currentVerse'), {
        book: selectedBook,
        chapter: Number(selectedChapter),
        verse: Number(verse),
        timestamp: Date.now(),
      });
      setSent(label);
      setTimeout(() => setSent(null), 2000);
    } catch (e) {
      setError('Send failed: ' + e.message);
    }
  }

  async function sendSetting(path, value) {
    try {
      await set(ref(db, `remote/settings/${path}`), value);
    } catch (e) {
      setError('Setting failed: ' + e.message);
    }
  }

  function toggleLanguage() {
    const next = language === 'EN' ? 'ML' : 'EN';
    setLanguage(next);
    sendSetting('language', next);
  }

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    sendSetting('theme', next);
  }

  function sendFontSize(delta) {
    sendSetting('fontSizeCmd', { delta, ts: Date.now() });
  }

  function sendNav(dir) {
    sendSetting('nav', { dir, ts: Date.now() });
  }

  async function sendCccParagraph(num) {
    try {
      await set(ref(db, 'remote/cccParagraph'), { paragraph: num, ts: Date.now() });
      setSent(`CCC #${num}`);
      setTimeout(() => setSent(null), 2000);
    } catch (e) {
      setError('Send failed: ' + e.message);
    }
  }

  function goBack() {
    if (searchView) { setSearchView(false); setSearchResults(null); setSearchQuery(''); return; }
    if (view === 'ccc-paragraphs') { setView('ccc-ranges'); setSelectedCccRange(null); return; }
    if (view === 'ccc-ranges')     { setView('testament'); return; }
    if (view === 'verses')        setView('chapters');
    else if (view === 'chapters') setView('books');
    else if (view === 'books')    setView('testament');
  }

  function goHome() {
    setView('testament');
    setTestament(null);
    setSelectedBook(null);
    setSelectedBookKey(null);
    setSelectedChapter(null);
    setChapters([]);
    setVerses([]);
    setSelectedCccRange(null);
  }

  const headerTitle =
    searchView               ? 'AI Search' :
    view === 'testament'     ? 'Bible Remote' :
    view === 'ccc-ranges'    ? 'Catechism (CCC)' :
    view === 'ccc-paragraphs' ? `CCC #${selectedCccRange?.start}–${selectedCccRange?.end}` :
    view === 'books'         ? (testament === 'OT' ? 'Old Testament' : 'New Testament') :
    view === 'chapters'      ? selectedBook :
    `${selectedBook} · Ch ${selectedChapter}`;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          {(view !== 'testament' || searchView) && (
            <button className="icon-btn" onClick={goBack} aria-label="Back">
              <ChevronLeft />
            </button>
          )}
          <span className="header-title">{headerTitle}</span>
        </div>
        <div className="header-right">
          {view !== 'testament' && (
            <button className="icon-btn" onClick={goHome} aria-label="Home">
              <HomeIcon />
            </button>
          )}
        </div>
      </header>

      {/* Floating settings bar */}
      <div className="settings-bar">
        <button className="settings-btn icon-only" onClick={() => sendNav('prev')} aria-label="Previous verse">
          <ChevronLeft small />
        </button>
        <button className="settings-btn icon-only" onClick={() => sendNav('next')} aria-label="Next verse">
          <ChevronRight small />
        </button>
        <button className="settings-btn icon-only" onClick={() => sendSetting('fullscreen', { ts: Date.now() })} aria-label="Toggle fullscreen">
          <FullscreenIcon />
        </button>
        <div className="settings-divider" />
        <button className={`settings-btn lang-btn${language === 'ML' ? ' active' : ''}`} onClick={toggleLanguage}>
          {language}
        </button>
        <div className="settings-divider" />
        <button className="settings-btn font-btn" onClick={() => sendFontSize(-1)} aria-label="Decrease font">
          A<span className="font-sub">−</span>
        </button>
        <button className="settings-btn font-btn" onClick={() => sendFontSize(1)} aria-label="Increase font">
          A<span className="font-sup">+</span>
        </button>
        <div className="settings-divider" />
        <button className="settings-btn" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      <main className="app-main">
        {error && (
          <div className="error-banner" onClick={() => setError(null)}>
            {error} · tap to dismiss
          </div>
        )}

        {/* AI keyword search view */}
        {searchView && (
          <div className="search-view">
            <div className="search-input-row">
              <input
                className="search-input"
                type="text"
                placeholder="e.g. forgiveness, hope, love…"
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

            {searchLoading && (
              <p className="search-status">Searching with AI…</p>
            )}

            {searchResults !== null && searchResults.length === 0 && (
              <p className="search-status">No results found. Try different keywords.</p>
            )}

            {searchResults && searchResults.length > 0 && (
              <ul className="search-results">
                {searchResults.map((r, i) => (
                  <li key={i}>
                    <button className="search-result-btn" onClick={() => sendSearchResult(r)}>
                      <span className="result-ref">{r.ref}</span>
                      <span className="result-text">{r.text}</span>
                      {r.reason && <span className="result-reason">{r.reason}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!searchView && view === 'testament' && (
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
                <button
                  className="testament-btn ccc-testament-btn"
                  onClick={() => setView('ccc-ranges')}
                >
                  <span className="testament-label" style={{ fontFamily: 'serif' }}>CCC</span>
                  <span className="testament-count">2865 paragraphs</span>
                </button>
                <button
                  className="testament-btn search-testament-btn"
                  onClick={() => { setSearchView(true); setSearchResults(null); setSearchQuery(''); }}
                >
                  <SearchSparkleIcon />
                  <span className="testament-label">AI Search</span>
                  <span className="testament-count">Find by meaning</span>
                </button>
              </div>
        )}

        {!searchView && view === 'ccc-ranges' && (
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

        {!searchView && view === 'ccc-paragraphs' && selectedCccRange && (
          <div className="num-grid">
            {Array.from({ length: selectedCccRange.end - selectedCccRange.start + 1 }, (_, i) => selectedCccRange.start + i).map(n => (
              <button key={n} className="num-btn ccc-para-btn" onClick={() => sendCccParagraph(n)}>
                {n}
              </button>
            ))}
          </div>
        )}

        {!searchView && view === 'books' && (
          <ul className="book-list">
            {getBooksForTestament(testament).map(b => (
              <li key={b.key}>
                <button className="book-btn" onClick={() => selectBook(b.name)}>
                  <span>{b.name}</span>
                  <ChevronRight />
                </button>
              </li>
            ))}
          </ul>
        )}

        {!searchView && view === 'chapters' && (
          chaptersLoading
            ? <CenterSpinner />
            : <div className="num-grid">
                {chapters.map(ch => (
                  <button key={ch} className="num-btn" onClick={() => selectChapter(ch)}>
                    {ch}
                  </button>
                ))}
              </div>
        )}

        {!searchView && view === 'verses' && (
          versesLoading
            ? <CenterSpinner />
            : <div className="num-grid">
                {verses.map(v => (
                  <button key={v} className="num-btn verse-num" onClick={() => sendVerse(v)}>
                    {v}
                  </button>
                ))}
              </div>
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

function CenterSpinner() {
  return <div className="center-spinner"><div className="spinner" /></div>;
}
function ChevronLeft({ small } = {}) {
  const s = small ? 16 : 22;
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
}
function ChevronRight({ small } = {}) {
  const s = small ? 16 : 16;
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
}
function HomeIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><polyline points="9 21 9 12 15 12 15 21"/></svg>;
}
function CheckIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
function FullscreenIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
      <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
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
function SunIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
}
function MoonIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
}
