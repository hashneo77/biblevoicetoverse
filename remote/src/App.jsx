import { useState, useEffect, useCallback } from 'react';
import {
  GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, db, DB_URL } from './firebase';
import './App.css';

async function restFetch(path, shallow = false) {
  const token = await auth.currentUser.getIdToken();
  const qs = shallow ? '&shallow=true' : '';
  const res = await fetch(`${DB_URL}/${path}.json?auth=${token}${qs}`);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = checking auth
  const [authError, setAuthError] = useState(null);

  const [books, setBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [nameToKey, setNameToKey] = useState({});

  const [view, setView] = useState('books');
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedBookKey, setSelectedBookKey] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [verses, setVerses] = useState([]);
  const [versesLoading, setVersesLoading] = useState(false);

  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => onAuthStateChanged(auth, u => setUser(u || null)), []);

  const loadBooks = useCallback(async () => {
    if (!auth.currentUser) return;
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
      setBooks(list);
    } catch (e) {
      setError('Could not load books: ' + e.message);
    } finally {
      setBooksLoading(false);
    }
  }, []);

  useEffect(() => { if (user) loadBooks(); }, [user, loadBooks]);

  async function signIn() {
    setAuthError(null);
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { setAuthError(e.message); }
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

  function goBack() {
    if (view === 'verses') setView('chapters');
    else goHome();
  }

  function goHome() {
    setView('books');
    setSelectedBook(null);
    setSelectedBookKey(null);
    setSelectedChapter(null);
    setChapters([]);
    setVerses([]);
  }

  if (user === undefined) return <div className="splash"><div className="spinner" /></div>;

  if (!user) return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-icon">📖</div>
        <h1>Bible Remote</h1>
        <p>Control the display from your phone</p>
        <button className="google-btn" onClick={signIn}>
          <GoogleLogo /> Sign in with Google
        </button>
        {authError && <p className="auth-error">{authError}</p>}
      </div>
    </div>
  );

  const headerTitle =
    view === 'books' ? 'Books' :
    view === 'chapters' ? selectedBook :
    `${selectedBook} · Ch ${selectedChapter}`;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          {view !== 'books' && (
            <button className="icon-btn" onClick={goBack} aria-label="Back">
              <ChevronLeft />
            </button>
          )}
          <span className="header-title">{headerTitle}</span>
        </div>
        <div className="header-right">
          {view !== 'books' && (
            <button className="icon-btn" onClick={goHome} aria-label="Home">
              <HomeIcon />
            </button>
          )}
          <button className="sign-out-btn" onClick={() => signOut(auth)}>Out</button>
        </div>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-banner" onClick={() => setError(null)}>
            {error} · tap to dismiss
          </div>
        )}

        {view === 'books' && (
          booksLoading
            ? <CenterSpinner />
            : <ul className="book-list">
                {books.map(b => (
                  <li key={b.key}>
                    <button className="book-btn" onClick={() => selectBook(b.name)}>
                      <span>{b.name}</span>
                      <ChevronRight />
                    </button>
                  </li>
                ))}
              </ul>
        )}

        {view === 'chapters' && (
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

        {view === 'verses' && (
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

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 32.8 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 37 24 37c-5.2 0-9.5-3.2-11.3-7.7l-6.5 5C9.8 39.8 16.4 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.5-2.6 4.6-4.8 6l6.2 5.2C40.9 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
    </svg>
  );
}

function ChevronLeft() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
}
function ChevronRight() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
}
function HomeIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><polyline points="9 21 9 12 15 12 15 21"/></svg>;
}
function CheckIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
