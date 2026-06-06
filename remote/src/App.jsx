import { useState, useCallback, useEffect, useMemo } from 'react';
import { ref, set } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { db, functions, DB_URL } from './firebase';
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
  'Song of Songs': 'ഉത്തമഗീതം',
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
  const cccRanges = useMemo(() => Array.from(
    { length: Math.ceil(CCC_TOTAL / CCC_RANGE_SIZE) },
    (_, i) => ({ start: i * CCC_RANGE_SIZE + 1, end: Math.min((i + 1) * CCC_RANGE_SIZE, CCC_TOTAL) })
  ), []);
  const [selectedCccRange, setSelectedCccRange] = useState(null);

  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);

  // Recently sent items — viewable & re-sendable from the 'recent' view
  const RECENT_SENT_KEY = 'bv_remote_recent_sent';
  const [recentSent, setRecentSent] = useState(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_SENT_KEY) || '[]'); } catch { return []; }
  });
  const pushRecentSent = (item) => {
    setRecentSent(prev => {
      const filtered = prev.filter(r => r.key !== item.key);
      const next = [{ ...item, ts: Date.now() }, ...filtered].slice(0, 50);
      localStorage.setItem(RECENT_SENT_KEY, JSON.stringify(next));
      return next;
    });
  };

  const [language, setLanguage] = useState('EN');
  const [theme, setTheme] = useState('light');

  // AI search — calls searchVerses Cloud Function directly (same as the web app)
  const searchVersesCallable = useMemo(() => httpsCallable(functions, 'searchVerses'), []);
  const [searchView, setSearchView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState(null);

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
        await set(ref(db, 'remote/cccParagraph'), { paragraph: result.paragraph, ts: Date.now() });
        pushRecentSent({ key: result.ref, type: 'ccc', paragraph: result.paragraph });
      } else {
        await set(ref(db, 'remote/currentVerse'), {
          book: result.book, chapter: result.chapter, verse: result.verse,
          timestamp: Date.now(),
        });
        pushRecentSent({ key: result.ref, type: 'bible', book: result.book, chapter: result.chapter, verse: result.verse });
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

  const selectTestament = (t) => { setTestament(t); setView('books'); };

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
      await set(ref(db, 'remote/currentVerse'), {
        book: selectedBook, chapter: Number(selectedChapter), verse: Number(verse),
        timestamp: Date.now(),
      });
      pushRecentSent({ key: label, type: 'bible', book: selectedBook, chapter: Number(selectedChapter), verse: Number(verse) });
      setSent(label);
      setTimeout(() => setSent(null), 2000);
    } catch (e) { setError('Send failed: ' + e.message); }
  };

  // ── Remote settings ───────────────────────────────────────────────────────
  const sendSetting = async (path, value) => {
    try { await set(ref(db, `remote/settings/${path}`), value); }
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
      await set(ref(db, 'remote/cccParagraph'), { paragraph: num, ts: Date.now() });
      pushRecentSent({ key: label, type: 'ccc', paragraph: num });
      setSent(label);
      setTimeout(() => setSent(null), 2000);
    } catch (e) { setError('Send failed: ' + e.message); }
  };

  // Re-send an item from the Recent view
  const resendRecent = (item) => {
    if (item.type === 'ccc') sendCccParagraph(item.paragraph);
    else sendSearchResult({ type: 'bible', ref: item.key, book: item.book, chapter: item.chapter, verse: item.verse });
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const goBack = () => {
    if (searchView) { setSearchView(false); setSearchResults(null); setSearchQuery(''); return; }
    if (view === 'recent')         { setView('testament'); return; }
    if (view === 'ccc-paragraphs') { setView('ccc-ranges'); setSelectedCccRange(null); return; }
    if (view === 'ccc-ranges')     { setView('testament'); return; }
    if (view === 'verses')         { setView('chapters'); return; }
    if (view === 'chapters')       { setView('books'); return; }
    if (view === 'books')          { setView('testament'); }
  };

  const goHome = () => {
    setView('testament'); setTestament(null); setSelectedBook(null);
    setSelectedBookKey(null); setSelectedChapter(null);
    setChapters([]); setVerses([]); setSelectedCccRange(null);
  };

  const headerTitle =
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
        <button
          className="settings-btn icon-only"
          onClick={() => sendSetting('fullscreen', { ts: Date.now() })}
          aria-label="Toggle fullscreen"
        >
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

        {/* ── Home picker ── */}
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
                <button className="testament-btn ccc-testament-btn" onClick={() => setView('ccc-ranges')}>
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
                <button className="testament-btn recent-testament-btn" onClick={() => setView('recent')}>
                  <ClockIcon />
                  <span className="testament-label">Recent</span>
                  <span className="testament-count">
                    {recentSent.length > 0 ? `${recentSent.length} sent this session` : 'Nothing sent yet'}
                  </span>
                </button>
              </div>
        )}

        {/* ── Recent sent items ── */}
        {!searchView && view === 'recent' && (
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
                      <span className="result-reason">tap to send again</span>
                    </button>
                  </li>
                ))}
              </ul>
        )}

        {/* ── CCC range picker ── */}
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

        {/* ── CCC paragraph picker ── */}
        {!searchView && view === 'ccc-paragraphs' && selectedCccRange && (
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
        {!searchView && view === 'books' && (
          <ul className="book-list">
            {getBooksForTestament(testament).map(b => (
              <li key={b.key}>
                <button className="book-btn" onClick={() => selectBook(b.name)}>
                  <span className="book-btn-names">
                    <span className="book-name-en">{b.name}</span>
                    {b.nameML && <span className="book-name-ml">{b.nameML}</span>}
                  </span>
                  <ChevronRight />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* ── Chapter picker ── */}
        {!searchView && view === 'chapters' && (
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
        {!searchView && view === 'verses' && (
          versesLoading
            ? <CenterSpinner />
            : <>
                <p className="section-heading">Verses</p>
                <div className="num-grid">
                  {verses.map(v => (
                    <button key={v} className="num-btn verse-num" onClick={() => sendVerse(v)}>{v}</button>
                  ))}
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
