import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ref as dbRef, get, set, onValue } from 'firebase/database'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase'
import { parseReference } from '../utils/parseReference'
import { tfidfSearch } from '../utils/tfidf'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { Header } from './Header'
import { VerseStage } from './VerseStage'
import { RecentVerses } from './RecentVerses'

const RECENT_KEY = 'bv_recent_verses'
const PAGE_LOAD_TIME = Date.now()

async function fetchBibleFromFirebase(path) {
  try {
    const snapshot = await get(dbRef(db, path))
    const fbData = snapshot.val()
    if (!fbData) throw new Error('Empty data for ' + path)

    const data = {}
    const englishToKeyMap = {}
    const nameToFirebaseKey = {}

    for (const bookKey of Object.keys(fbData)) {
      const book = fbData[bookKey]
      if (!book) continue
      const xmlKey = book.name || bookKey
      const shortName = book.shortName || ''
      data[xmlKey] = {}
      nameToFirebaseKey[xmlKey] = bookKey
      if (shortName) englishToKeyMap[shortName.toLowerCase()] = xmlKey
      if (book.chapters) {
        for (const chKey of Object.keys(book.chapters)) {
          const verses = book.chapters[chKey]
          if (!verses || typeof verses !== 'object') continue
          const ch = chKey.replace(/^ch/, '')
          data[xmlKey][ch] = {}
          for (const v of Object.keys(verses)) {
            if (verses[v] != null) data[xmlKey][ch][v] = verses[v]
          }
        }
      }
    }

    return { data, bookNames: Object.keys(data), englishToKeyMap, nameToFirebaseKey }
  } catch (e) {
    console.warn('Firebase fetch failed for', path, e)
    return null
  }
}

function lookupVerse(store, book, ch, v) {
  if (!store?.data) return { text: null, resolvedBook: book }
  const { data, englishToKeyMap: map } = store
  const lower = book.toLowerCase()
  let key = book
  if (!data[key]) {
    if (map?.[lower] && data[map[lower]]) key = map[lower]
    else for (const k of Object.keys(data)) { if (k.toLowerCase() === lower) { key = k; break } }
    if (!data[key]) for (const k of Object.keys(data)) { if (k.toLowerCase().startsWith(lower)) { key = k; break } }
  }
  return { text: data[key]?.[String(ch)]?.[String(v)] ?? null, resolvedBook: key }
}

export function MainApp({ isDark, onToggleTheme, onSetTheme, onSignOut }) {
  const [displayMode, setDisplayMode] = useState('EN')
  const [bibleEN, setBibleEN] = useState(null)
  const [bibleML, setBibleML] = useState(null)
  const [bookAliases, setBookAliases] = useState({})
  const [currentRef, setCurrentRef] = useState(null)
  const [verseText, setVerseText] = useState('')
  const [verseRefLabel, setVerseRefLabel] = useState('Jesus Loves You')
  const [fontSize, setFontSize] = useState(44)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [status, setStatus] = useState('Loading…')
  const [cccData, setCccData] = useState(null) // { "1": "text", ... }
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResults, setAiResults] = useState(null) // null=hidden, array=visible
  const [recentVerses, setRecentVerses] = useState(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
  })

  const verseStageRef = useRef(null)
  // Always-current ref pattern for stable callbacks
  const stateRef = useRef({})
  stateRef.current = { displayMode, bibleEN, bibleML, cccData, currentRef, isDark, onSetTheme, toggleFullscreen: () => toggleFullscreenRef.current?.() }

  // Load book aliases
  useEffect(() => {
    fetch('/book_aliases.json')
      .then(r => r.ok ? r.json() : {})
      .then(setBookAliases)
      .catch(() => {})
  }, [])

  // Load Bible data from Firebase
  useEffect(() => {
    async function load() {
      setStatus('Loading Bible data…')
      const [en, ml] = await Promise.all([
        fetchBibleFromFirebase('english'),
        fetchBibleFromFirebase('malayalam'),
      ])
      if (en) setBibleEN(en)
      if (ml) setBibleML(ml)
      setStatus(en ? 'Ready' : 'Could not load Bible data')
    }
    load()
  }, [])

  // Listen for remote verse selections
  useEffect(() => {
    const unsub = onValue(dbRef(db, 'remote/currentVerse'), snap => {
      const val = snap.val()
      if (!val?.book || !val?.timestamp || val.timestamp < PAGE_LOAD_TIME) return
      showVerseRef.current({ book: val.book, chapter: val.chapter, verse: val.verse })
    })
    return unsub
  }, [])

  // Listen for remote settings (language, theme, font size, nav)
  useEffect(() => {
    const seen = { fontSizeTs: 0, navTs: 0 }
    const unsub = onValue(dbRef(db, 'remote/settings'), snap => {
      const val = snap.val()
      if (!val) return
      const { displayMode: dm, isDark: dark, onSetTheme: setTheme } = stateRef.current

      if (val.language && val.language !== dm) setDisplayMode(val.language)

      if (val.theme !== undefined) {
        const wantDark = val.theme === 'dark'
        if (wantDark !== dark) setTheme?.(wantDark)
      }

      if (val.fontSizeCmd?.ts > PAGE_LOAD_TIME && val.fontSizeCmd.ts > seen.fontSizeTs) {
        seen.fontSizeTs = val.fontSizeCmd.ts
        if (val.fontSizeCmd.delta > 0) setFontSize(s => Math.min(160, s + Math.max(6, Math.round(s * 0.12))))
        else setFontSize(s => Math.max(12, s - Math.max(4, Math.round(s * 0.12))))
      }

      if (val.nav?.ts > PAGE_LOAD_TIME && val.nav.ts > seen.navTs) {
        seen.navTs = val.nav.ts
        if (val.nav.dir === 'prev') {
          const cr = stateRef.current.currentRef
          if (cr?.verse > 1) showVerseRef.current({ ...cr, verse: cr.verse - 1 }, { addToRecent: false })
        } else {
          const cr = stateRef.current.currentRef
          if (cr) showVerseRef.current({ ...cr, verse: cr.verse + 1 }, { addToRecent: false })
        }
      }

      if (val.fullscreen?.ts > PAGE_LOAD_TIME && val.fullscreen.ts > (seen.fullscreenTs || 0)) {
        seen.fullscreenTs = val.fullscreen.ts
        stateRef.current.toggleFullscreen?.()
      }
    })
    return unsub
  }, [])

  // Listen for remote CCC paragraph selections — display in verse stage
  useEffect(() => {
    const unsub = onValue(dbRef(db, 'remote/cccParagraph'), async snap => {
      const val = snap.val()
      if (!val?.paragraph || !val?.ts || val.ts < PAGE_LOAD_TIME) return
      let ccc = stateRef.current.cccData
      if (!ccc) {
        try {
          const snap2 = await get(dbRef(db, 'ccc'))
          ccc = snap2.val()
          if (ccc) setCccData(ccc)
        } catch { return }
      }
      const text = ccc?.[String(val.paragraph)]
      if (text) {
        const label = `CCC #${val.paragraph}`
        setVerseRefLabel(label)
        setVerseText(text)
        setCurrentRef(null)
        saveRecent({ ccc: val.paragraph }, label)
      }
    })
    return unsub
  }, [])

  // Show initial verse once English data loads
  const initialVerseShown = useRef(false)
  useEffect(() => {
    if (bibleEN && !initialVerseShown.current) {
      initialVerseShown.current = true
      showVerseRef.current({ book: 'Genesis', chapter: 1, verse: 1 })
    }
  }, [bibleEN])

  function saveRecent(refObj, label) {
    setRecentVerses(prev => {
      const filtered = prev.filter(r => r.key !== label)
      const next = [{ key: label, ref: refObj }, ...filtered].slice(0, 10)
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      return next
    })
  }

  const showVerse = useCallback(async (parsed, { addToRecent = true } = {}) => {
    if (!parsed) return
    const { displayMode: dm, bibleEN: en, bibleML: ml } = stateRef.current
    const store = dm === 'ML' ? ml : en
    const { text, resolvedBook } = lookupVerse(store, parsed.book, parsed.chapter, parsed.verse)

    if (text) {
      const label = `${resolvedBook} ${parsed.chapter}:${parsed.verse}`
      setVerseRefLabel(label)
      setVerseText(text)
      // Keep original English book name in currentRef so navigation + API fallback always use English
      setCurrentRef(parsed)
      setStatus(label)
      if (addToRecent) saveRecent(parsed, label)
      return
    }

    // Only fall back to remote API when using English mode with an English book name
    // (avoid sending Malayalam script to bible-api.com)
    if (dm === 'ML') {
      setStatus(`Verse not found: ${parsed.book} ${parsed.chapter}:${parsed.verse}`)
      return
    }

    // Fallback to public Bible API (English only)
    try {
      const apiStr = `${parsed.book} ${parsed.chapter}:${parsed.verse}`
      setStatus('Fetching from API…')
      const resp = await fetch(`https://bible-api.com/${encodeURIComponent(apiStr)}`)
      if (!resp.ok) throw new Error('API error ' + resp.status)
      const apiData = await resp.json()
      const label = apiData.reference + (apiData.translation_id ? ` — ${apiData.translation_id}` : '')
      setVerseRefLabel(label)
      setVerseText(apiData.text.trim())
      setCurrentRef(parsed)
      setStatus('Loaded from API')
      if (addToRecent) saveRecent(parsed, apiData.reference)
    } catch (e) {
      setStatus('Error: ' + (e.message || e))
    }
  }, [])

  // Stable ref so effects always have latest showVerse
  const showVerseRef = useRef(showVerse)
  showVerseRef.current = showVerse

  // Save verse edit to Firebase (debounced)
  const saveEditTimerRef = useRef(null)
  function handleVerseEdit(newText) {
    setVerseText(newText)
    const { currentRef: cr, displayMode: dm, bibleEN: en, bibleML: ml } = stateRef.current
    if (!cr) return
    const store = dm === 'ML' ? ml : en
    const fbPath = dm === 'ML' ? 'malayalam' : 'english'
    if (!store) return
    const { resolvedBook } = lookupVerse(store, cr.book, cr.chapter, cr.verse)
    const firebaseKey = store.nameToFirebaseKey?.[resolvedBook]
    if (!firebaseKey) return
    clearTimeout(saveEditTimerRef.current)
    saveEditTimerRef.current = setTimeout(async () => {
      try {
        await set(dbRef(db, `${fbPath}/${firebaseKey}/chapters/ch${cr.chapter}/${cr.verse}`), newText)
        if (store.data?.[resolvedBook]?.[String(cr.chapter)]) {
          store.data[resolvedBook][String(cr.chapter)][String(cr.verse)] = newText
        }
        setStatus('Saved ✓')
        setTimeout(() => setStatus('Ready'), 2000)
      } catch {
        setStatus('Save failed')
      }
    }, 1200)
  }

  // AI semantic search
  const searchVersesCallable = useMemo(() => httpsCallable(functions, 'searchVerses'), [])

  async function handleAiSearch(query) {
    const { bibleEN: en, bibleML: ml } = stateRef.current
    if (!en) { setStatus('Bible data not ready yet — try again in a moment'); return }

    const wantsCCC = /\bccc\b/i.test(query)

    // Lazy-load CCC data the first time a CCC query is made
    if (wantsCCC && !stateRef.current.cccData) {
      try {
        const snap = await get(dbRef(db, 'ccc'))
        const val = snap.val()
        if (val) setCccData(val)
      } catch { /* ignore — CCC text just won't show */ }
    }

    setAiLoading(true)
    setAiResults(null)
    try {
      const bookNames = Object.keys(en.data)
      const result = await searchVersesCallable({ query, bookNames, includeCCC: wantsCCC })
      const { cccData: ccc } = stateRef.current
      const results = (result.data?.refs || []).map(r => {
        if (r.type === 'ccc') {
          const text = ccc?.[String(r.paragraph)] || ''
          if (!text) return null
          return {
            type: 'ccc',
            ref: `CCC #${r.paragraph}`,
            text,
            textML: '',
            reason: r.reason,
            parsed: null,
          }
        }
        // Bible verse
        const { text } = lookupVerse(en, r.book, r.chapter, r.verse)
        if (!text) return null
        const { text: textML } = ml ? lookupVerse(ml, r.book, r.chapter, r.verse) : { text: '' }
        return {
          type: 'bible',
          ref: `${r.book} ${r.chapter}:${r.verse}`,
          text,
          textML: textML || '',
          reason: r.reason,
          parsed: { book: r.book, chapter: Number(r.chapter), verse: Number(r.verse) },
        }
      }).filter(Boolean)
      setAiResults(results.length > 0 ? results : [])
    } catch (e) {
      const msg = e?.message || String(e)
      setAiResults([{ ref: 'Search Error', text: msg, reason: 'Please try again.', parsed: null }])
    } finally {
      setAiLoading(false)
    }
  }

  // Relay remote search queries: remote writes searchQuery, main app runs search and writes back results
  useEffect(() => {
    const unsub = onValue(dbRef(db, 'remote/searchQuery'), async snap => {
      const val = snap.val()
      if (!val?.q || !val?.ts || val.ts < PAGE_LOAD_TIME) return
      const { bibleEN: en } = stateRef.current
      if (!en) return
      try {
        const candidates = tfidfSearch(en, val.q, 40).map(c => ({ ref: c.ref, text: c.text }))
        if (candidates.length === 0) {
          await set(dbRef(db, 'remote/searchResults'), { ts: val.ts, results: [] })
          return
        }
        const { data } = await searchVersesCallable({ query: val.q, candidates })
        await set(dbRef(db, 'remote/searchResults'), { ts: val.ts, results: data.results || [] })
      } catch {
        await set(dbRef(db, 'remote/searchResults'), { ts: val.ts, results: [] })
      }
    })
    return unsub
  }, [searchVersesCallable])

  // Navigation — never adds to recent (only explicit searches do)
  function prevVerse() {
    const cr = stateRef.current.currentRef
    if (cr?.verse > 1) showVerseRef.current({ ...cr, verse: cr.verse - 1 }, { addToRecent: false })
  }
  function nextVerse() {
    const cr = stateRef.current.currentRef
    if (cr) showVerseRef.current({ ...cr, verse: cr.verse + 1 }, { addToRecent: false })
  }

  // Font size
  function increaseFontSize() { setFontSize(s => Math.min(160, s + Math.max(6, Math.round(s * 0.12)))) }
  function decreaseFontSize() { setFontSize(s => Math.max(12, s - Math.max(4, Math.round(s * 0.12)))) }

  // Fullscreen
  const toggleFullscreenRef = useRef(null)
  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await verseStageRef.current?.requestFullscreen?.()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen?.()
        setIsFullscreen(false)
      }
    } catch { /* fullscreen not available */ }
  }
  toggleFullscreenRef.current = toggleFullscreen

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Speech recognition
  const { isListening, transcript, toggle: toggleSpeech, supported: speechSupported } =
    useSpeechRecognition({
      onResult: text => {
        const parsed = parseReference(text, bookAliases)
        if (parsed) showVerseRef.current(parsed)
        else setStatus('Could not parse: ' + text)
      },
      onError: err => setStatus('Speech error: ' + err),
    })

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(ev) {
      const active = document.activeElement
      const typing = active && (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.isContentEditable
      )
      if (typing) return
      switch (ev.key) {
        case 'ArrowLeft':  ev.preventDefault(); prevVerse(); break  // prevVerse already skips recent
        case 'ArrowRight': ev.preventDefault(); nextVerse(); break  // nextVerse already skips recent
        case 'f': case 'F': ev.preventDefault(); toggleFullscreen(); break
        case 'm': case 'M': ev.preventDefault(); toggleSpeech(); break
        case 'e': case 'E':
          ev.preventDefault()
          setDisplayMode(m => m === 'EN' ? 'ML' : 'EN')
          break
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [toggleSpeech])

  // bibleMeta for search (computed from English data — always search in English)
  const bibleMeta = useMemo(() => {
    const meta = { maxChapter: new Map(), maxVerse: new Map() }
    const d = bibleEN?.data
    if (!d) return meta
    for (const book of Object.keys(d)) {
      for (const ch of Object.keys(d[book])) {
        const c = +ch
        meta.maxChapter.set(book, Math.max(meta.maxChapter.get(book) || 0, c))
        for (const v of Object.keys(d[book][ch])) {
          const key = `${book}|${c}`
          meta.maxVerse.set(key, Math.max(meta.maxVerse.get(key) || 0, +v))
        }
      }
    }
    return meta
  }, [bibleEN])

  // Re-render current verse when mode changes
  useEffect(() => {
    const cr = stateRef.current.currentRef
    if (cr) showVerseRef.current(cr)
  }, [displayMode])

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark
        ? 'bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100'
        : 'bg-slate-50 text-slate-900'
    }`}>
      <div className="max-w-5xl mx-auto px-4 pt-4 pb-10">
        <Header
          isDark={isDark}
          isListening={isListening}
          speechSupported={speechSupported}
          onToggleSpeech={toggleSpeech}
          onPrev={prevVerse}
          onNext={nextVerse}
          displayMode={displayMode}
          onSetMode={mode => setDisplayMode(mode)}
          onDecreaseFontSize={decreaseFontSize}
          onIncreaseFontSize={increaseFontSize}
          onToggleTheme={onToggleTheme}
          onToggleFullscreen={toggleFullscreen}
          bookAliases={bookAliases}
          bibleMeta={bibleMeta}
          onSelectVerse={parsed => showVerseRef.current(parsed)}
          onAiSearch={handleAiSearch}
          aiLoading={aiLoading}
          onSignOut={onSignOut}
        />

        {/* AI search results panel */}
        {aiResults !== null && (
          <div className={`mt-2 rounded-2xl border overflow-hidden ${
            isDark ? 'bg-slate-900/80 border-white/[0.08]' : 'bg-white border-slate-200'
          }`}>
            <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
              isDark ? 'border-white/[0.06]' : 'border-slate-100'
            }`}>
              <span className={`text-xs font-semibold flex items-center gap-1.5 ${
                isDark ? 'text-purple-400' : 'text-purple-600'
              }`}>
                <SparkleIcon /> AI Search Results
              </span>
              <button
                onClick={() => setAiResults(null)}
                className={`text-xs px-2 py-0.5 rounded-lg transition-colors ${
                  isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
              >
                ✕ Close
              </button>
            </div>
            {aiResults.length === 0 ? (
              <p className={`px-4 py-4 text-sm text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                No matching verses found.
              </p>
            ) : (
              aiResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => { if (r.type === 'bible' && r.parsed) { showVerseRef.current(r.parsed); setAiResults(null) } }}
                  className={`w-full text-left px-3 py-2 flex flex-col gap-0 transition-colors border-b last:border-b-0 ${
                    isDark
                      ? 'border-white/[0.04] hover:bg-white/[0.04]'
                      : 'border-slate-100 hover:bg-slate-50'
                  } ${r.parsed === null && r.type === 'ccc' ? 'cursor-default' : ''}`}
                >
                  <span className={`text-xs font-semibold ${
                    r.type === 'ccc'
                      ? isDark ? 'text-sky-400' : 'text-sky-600'
                      : isDark ? 'text-amber-300' : 'text-amber-600'
                  }`}>
                    {r.ref}
                  </span>
                  <span className={`text-[11px] leading-snug line-clamp-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {r.text}
                  </span>
                  {r.textML && (
                    <span className={`text-[11px] leading-snug line-clamp-1 font-[Noto_Serif_Malayalam,serif] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {r.textML}
                    </span>
                  )}
                  {r.reason && (
                    <span className={`text-[10px] italic ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                      {r.reason}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}

        {/* Transcript badge */}
        {transcript && (
          <p className={`mt-2 text-xs px-3 py-1.5 rounded-lg font-mono leading-relaxed whitespace-pre-wrap ${
            isDark ? 'text-slate-400 bg-white/[0.03]' : 'text-slate-500 bg-black/[0.03]'
          }`}>
            {transcript}
          </p>
        )}

        <VerseStage
          ref={verseStageRef}
          isDark={isDark}
          verseRef={verseRefLabel}
          verseText={verseText}
          displayMode={displayMode}
          fontSize={fontSize}
          isRecording={isListening}
          isFullscreen={isFullscreen}
          onVerseEdit={handleVerseEdit}
          onToggleFullscreen={toggleFullscreen}
        />

        <RecentVerses
          isDark={isDark}
          verses={recentVerses}
          onSelect={async ref => {
            if (ref?.ccc) {
              let ccc = stateRef.current.cccData
              if (!ccc) {
                try {
                  const snap = await get(dbRef(db, 'ccc'))
                  ccc = snap.val()
                  if (ccc) setCccData(ccc)
                } catch { return }
              }
              const text = ccc?.[String(ref.ccc)]
              if (text) { setVerseRefLabel(`CCC #${ref.ccc}`); setVerseText(text); setCurrentRef(null) }
            } else {
              showVerseRef.current(ref)
            }
          }}
        />

        {/* Status line */}
        <p className={`mt-4 text-center text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          {status}
        </p>
      </div>

      {/* Version badge */}
      <span className={`fixed bottom-3 left-3 text-[10px] px-2 py-0.5 rounded opacity-30 ${
        isDark ? 'text-slate-400' : 'text-slate-500'
      }`}>
        v1.0.0
      </span>
    </div>
  )
}

function SparkleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z"/>
    </svg>
  )
}
