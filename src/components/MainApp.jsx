import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ref as dbRef, get, set, push, onValue } from 'firebase/database'
import { httpsCallable } from 'firebase/functions'
import { ref as storageRef, uploadString, getBytes } from 'firebase/storage'
import { db, functions, storage } from '../firebase'
import { parseReference } from '../utils/parseReference'
import { tfidfSearch } from '../utils/tfidf'
import { parseLyrics, serializeLyrics } from '../utils/parseLyrics'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { Header } from './Header'
import { VerseStage } from './VerseStage'
import { RecentVerses } from './RecentVerses'

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

export function MainApp({ isDark, onToggleTheme, onSetTheme, sessionPrefix = 'remote' }) {
  const P = sessionPrefix
  const RECENT_ITEMS_PATH = `${P}/recentItems`

  const [displayMode, setDisplayMode] = useState('EN')
  const [bibleEN, setBibleEN] = useState(null)
  const [bibleML, setBibleML] = useState(null)
  const [bookAliases, setBookAliases] = useState({})
  const [currentRef, setCurrentRef] = useState(null)
  const [verseText, setVerseText] = useState('')
  const [verseRefLabel, setVerseRefLabel] = useState('Jesus Loves You')
  const [fontSize, setFontSize] = useState(44)
  const [isFullscreen, setIsFullscreen] = useState(false)
  // When the remote requests fullscreen we can't call requestFullscreen() directly
  // (no user gesture on the presentation screen). Instead we show a prompt overlay;
  // the person at the screen taps it — that tap IS a user gesture — and native
  // fullscreen fires correctly.
  const [remoteFullscreenPrompt, setRemoteFullscreenPrompt] = useState(false)
  const [status, setStatus] = useState('Loading…')
  const [cccData, setCccData] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResults, setAiResults] = useState(null) // null=hidden, array=visible
  const [songAiLoading, setSongAiLoading] = useState(false)
  const [recentVerses, setRecentVerses] = useState([])
  const [songsManifest, setSongsManifest] = useState(null)
  const [songState, setSongState] = useState(null) // null = Bible/CCC mode; { filename, title, slides, slideIdx }
  const songCacheRef = useRef({})
  const [mediaUrl, setMediaUrl] = useState(null) // active media image url
  const [mediaHtml, setMediaHtml] = useState(null) // active media text html
  const [bgImageUrl, setBgImageUrl] = useState(null)
  const [bgImageOpacity, setBgImageOpacity] = useState(0.2)

  const verseStageRef = useRef(null)
  // Always-current ref pattern for stable callbacks
  const stateRef = useRef({})
  stateRef.current = {
    displayMode, bibleEN, bibleML, cccData, currentRef, isDark, isFullscreen,
    onSetTheme,
    songState, songsManifest,
    toggleFullscreen: () => toggleFullscreenRef.current?.(),
  }

  // Load book aliases
  useEffect(() => {
    fetch('/book_aliases.json')
      .then(r => r.ok ? r.json() : {})
      .then(setBookAliases)
      .catch(() => {})
  }, [])

  // Load songs manifest
  useEffect(() => {
    fetch('/songs-manifest.json', { cache: 'no-cache' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSongsManifest(data) })
      .catch(() => {})
  }, [])

  // Load Bible data from Firebase
  useEffect(() => {
    const load = async () => {
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

  // Sync shared recent list from Firebase (written by both webapp and remote)
  useEffect(() => {
    return onValue(dbRef(db, RECENT_ITEMS_PATH), snap => {
      const val = snap.val() || {}
      const list = Object.entries(val)
        .filter(([, data]) => data.type !== 'song')
        .map(([fbKey, data]) => ({
          key: data.key,
          ref: data.type === 'ccc'
            ? { ccc: data.paragraph }
            : { book: data.book, chapter: data.chapter, verse: data.verse, ...(data.endVerse ? { endVerse: data.endVerse } : {}) },
          ts: data.ts,
          fbKey,
        }))
        .sort((a, b) => (b.ts || 0) - (a.ts || 0))
        .slice(0, 100)
      setRecentVerses(list)
    })
  }, [])

  // Listen for remote verse selections
  useEffect(() => {
    return onValue(dbRef(db, `${P}/currentVerse`), snap => {
      const val = snap.val()
      if (!val?.book || !val?.timestamp || val.timestamp < PAGE_LOAD_TIME) return
      showVerseRef.current({ book: val.book, chapter: val.chapter, verse: val.verse })
    })
  }, [])

  // Listen for remote settings (language, theme, font size, nav, fullscreen)
  useEffect(() => {
    const seen = { fontSizeTs: 0, navTs: 0, fullscreenTs: 0 }
    return onValue(dbRef(db, `${P}/settings`), snap => {
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
          const { songState: ss, currentRef: cr } = stateRef.current
          if (ss) {
            if (ss.slideIdx > 0) showSongSlideRef.current(ss.filename, ss.slideIdx - 1)
          } else if (cr?.verse > 1) {
            showVerseRef.current({ ...cr, verse: cr.verse - 1 }, { addToRecent: false, rangeNav: true })
          }
        } else {
          const { songState: ss, currentRef: cr } = stateRef.current
          if (ss) {
            if (ss.slideIdx < ss.slides.length - 1) showSongSlideRef.current(ss.filename, ss.slideIdx + 1)
          } else if (cr) {
            showVerseRef.current({ ...cr, verse: cr.verse + 1 }, { addToRecent: false, rangeNav: true })
          }
        }
      }

      if (val.fullscreen?.ts > PAGE_LOAD_TIME && val.fullscreen.ts > seen.fullscreenTs) {
        seen.fullscreenTs = val.fullscreen.ts
        if (stateRef.current.isFullscreen || document.fullscreenElement) {
          // Already fullscreen — exit directly (exit doesn't need a user gesture)
          stateRef.current.toggleFullscreen?.()
        } else {
          // Not fullscreen — show prompt so the person at the screen can tap it.
          // That tap becomes the required user gesture for requestFullscreen().
          setRemoteFullscreenPrompt(true)
        }
      }
    })
  }, [])

  // Listen for remote CCC paragraph selections
  useEffect(() => {
    return onValue(dbRef(db, `${P}/cccParagraph`), async snap => {
      const val = snap.val()
      if (!val?.paragraph || !val?.ts || val.ts < PAGE_LOAD_TIME) return
      await handleSelectCCCRef.current(val.paragraph)
    })
  }, [])

  // Listen for remote song slide selections
  useEffect(() => {
    return onValue(dbRef(db, `${P}/currentSong`), snap => {
      const val = snap.val()
      if (!val?.filename || !val?.ts || val.ts < PAGE_LOAD_TIME) return
      showSongSlideRef.current(val.filename, val.slideIdx ?? 0)
    })
  }, [])

  // Listen for remote media
  useEffect(() => {
    return onValue(dbRef(db, `${P}/currentMedia`), snap => {
      const val = snap.val()
      if (!val?.ts || val.ts < PAGE_LOAD_TIME) return
      setSongState(null)
      setCurrentRef(null)
      setVerseRefLabel('')
      if (val.type === 'clear') {
        setMediaUrl(null)
        setMediaHtml(null)
        setVerseText('')
        setVerseRefLabel('')
      } else if (val.type === 'image' && val.url) {
        setMediaUrl(val.url)
        setMediaHtml(null)
        setVerseText('')
      } else if (val.type === 'text') {
        setMediaUrl(null)
        if (val.html) {
          setMediaHtml(val.html)
          setVerseText('')
        } else if (val.text) {
          setMediaHtml(null)
          setVerseText(val.text)
        }
      }
    })
  }, [])

  // Listen for background image changes
  useEffect(() => {
    return onValue(dbRef(db, `${P}/bgImage`), snap => {
      const val = snap.val()
      if (!val?.url) { setBgImageUrl(null); return; }
      setBgImageUrl(val.url)
      setBgImageOpacity(val.opacity ?? 0.2)
    })
  }, [])

  // Relay remote song search queries (main app has the manifest, remote does not need it)
  useEffect(() => {
    return onValue(dbRef(db, `${P}/songSearchQuery`), async snap => {
      const val = snap.val()
      if (!val?.q || !val?.ts || val.ts < PAGE_LOAD_TIME) return
      const { songsManifest: songs } = stateRef.current
      if (!songs) return
      const q = val.q.toLowerCase()
      const results = songs
        .filter(s => s.title.toLowerCase().includes(q) || s.text.toLowerCase().includes(q))
        .slice(0, 15)
        .map(({ filename, title, voices }) => ({ filename, title, voices }))
      await set(dbRef(db, `${P}/songSearchResults`), { ts: val.ts, results })
    })
  }, [])

  // Show initial verse once English data loads
  const initialVerseShown = useRef(false)
  useEffect(() => {
    if (bibleEN && !initialVerseShown.current) {
      initialVerseShown.current = true
      showVerseRef.current({ book: 'Genesis', chapter: 1, verse: 1 }, { addToRecent: false })
    }
  }, [bibleEN])

  const saveRecent = (refObj, label, text = '') => {
    const data = refObj?.ccc
      ? { key: label, type: 'ccc', paragraph: refObj.ccc, text, ts: Date.now() }
      : { key: label, type: 'bible', book: refObj.book, chapter: refObj.chapter, verse: refObj.verse, text, ts: Date.now() }
    const pushRef = push(dbRef(db, RECENT_ITEMS_PATH), data)
    return pushRef.key
  }

  const clearRecent = () => {
    set(dbRef(db, RECENT_ITEMS_PATH), null)
  }

  // Build copy-to-clipboard text for a set of recent entries, including both
  // English and Malayalam verse text (so a copied passage is bilingual).
  const buildRecentCopyText = (items) => {
    const { bibleML: ml } = stateRef.current
    return items.map(item => {
      if (item.ref?.ccc) return item.key
      const { book, chapter, verse, endVerse } = item.ref || {}
      if (!book || !chapter || !verse) return item.key
      let mlRef = ''
      if (ml) {
        const { resolvedBook: mlBook } = lookupVerse(ml, book, chapter, verse)
        if (mlBook) mlRef = endVerse ? `${mlBook} ${chapter}:${verse}-${endVerse}` : `${mlBook} ${chapter}:${verse}`
      }
      return mlRef ? `${item.key} / ${mlRef}` : item.key
    }).join('\n')
  }

  // Tracks a contiguous run of verses visited via prev/next so they collapse
  // into a single "Book Ch:start-end" entry instead of one per verse.
  const navRangeRef = useRef(null)

  const updateNavRange = (book, chapter, verse) => {
    const range = navRangeRef.current
    let start = verse
    let end = verse
    let fbKey = null

    if (range && range.book === book && range.chapter === chapter) {
      if (verse === range.end + 1) {
        start = range.start; end = verse; fbKey = range.fbKey
      } else if (verse === range.start - 1) {
        start = verse; end = range.end; fbKey = range.fbKey
      } else if (verse >= range.start && verse <= range.end) {
        return
      }
    }

    const label = start === end ? `${book} ${chapter}:${start}` : `${book} ${chapter}:${start}-${end}`
    const data = {
      key: label, type: 'bible', book, chapter, verse: start, ts: Date.now(),
      ...(start !== end ? { endVerse: end } : {}),
    }

    if (fbKey) {
      set(dbRef(db, `${RECENT_ITEMS_PATH}/${fbKey}`), data)
      navRangeRef.current = { book, chapter, start, end, key: label, fbKey }
    } else {
      const pushRef = push(dbRef(db, RECENT_ITEMS_PATH), data)
      navRangeRef.current = { book, chapter, start, end, key: label, fbKey: pushRef.key }
    }
  }

  const showVerse = useCallback(async (parsed, { addToRecent = true, rangeNav = false } = {}) => {
    if (!parsed) return
    setSongState(null)
    setMediaUrl(null)
    setMediaHtml(null)
    const { displayMode: dm, bibleEN: en, bibleML: ml } = stateRef.current
    const store = dm === 'ML' ? ml : en
    const { text, resolvedBook } = lookupVerse(store, parsed.book, parsed.chapter, parsed.verse)

    if (text) {
      const label = `${resolvedBook} ${parsed.chapter}:${parsed.verse}`
      setVerseRefLabel(label)
      setVerseText(text)
      setCurrentRef(parsed)
      setStatus(label)
      set(dbRef(db, `${P}/liveSlide`), { type: 'verse', book: parsed.book, chapter: parsed.chapter, verse: parsed.verse, ts: Date.now() }).catch(() => {})
      if (addToRecent) {
        const fbKey = saveRecent(parsed, label, text)
        navRangeRef.current = { book: resolvedBook, chapter: parsed.chapter, start: parsed.verse, end: parsed.verse, key: label, fbKey }
      } else if (rangeNav) {
        updateNavRange(resolvedBook, parsed.chapter, parsed.verse)
      }
      return
    }

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
      set(dbRef(db, `${P}/liveSlide`), { type: 'verse', book: parsed.book, chapter: parsed.chapter, verse: parsed.verse, ts: Date.now() }).catch(() => {})
      if (addToRecent) {
        const fbKey = saveRecent(parsed, apiData.reference, apiData.text.trim())
        navRangeRef.current = { book: parsed.book, chapter: parsed.chapter, start: parsed.verse, end: parsed.verse, key: apiData.reference, fbKey }
      }
    } catch (e) {
      setStatus('Error: ' + (e.message || e))
    }
  }, [])

  const showVerseRef = useRef(showVerse)
  showVerseRef.current = showVerse

  // Load and display a CCC paragraph
  const handleSelectCCC = useCallback(async (paragraphNum) => {
    setSongState(null)
    let ccc = stateRef.current.cccData
    if (!ccc) {
      try {
        const snap = await get(dbRef(db, 'ccc'))
        ccc = snap.val()
        if (ccc) setCccData(ccc)
      } catch {
        setStatus('Could not load catechism data')
        return
      }
    }
    const text = ccc?.[String(paragraphNum)]
    if (text) {
      const label = `CCC #${paragraphNum}`
      setVerseRefLabel(label)
      setVerseText(text)
      setCurrentRef(null)
      saveRecent({ ccc: paragraphNum }, label, text)
      setStatus(label)
    } else {
      setStatus(`CCC #${paragraphNum} not found`)
    }
  }, [])

  const handleSelectCCCRef = useRef(handleSelectCCC)
  handleSelectCCCRef.current = handleSelectCCC

  // Load and display a song slide
  const showSongSlide = useCallback(async (filename, slideIdx) => {
    let parsed
    try {
      const fileRef = storageRef(storage, `lyrics-text/${filename}.txt`)
      const bytes = await getBytes(fileRef)
      parsed = parseLyrics(new TextDecoder('utf-8').decode(bytes))
    } catch {
      setStatus('Could not load song: ' + filename)
      return
    }
    const { title, slides } = parsed
    if (!slides.length) { setStatus('No slides in song'); return }
    const idx = Math.max(0, Math.min(slideIdx, slides.length - 1))
    const slide = slides[idx]
    setMediaUrl(null)
    setMediaHtml(null)
    setVerseRefLabel('')
    setVerseText(slide.text)
    setCurrentRef(null)
    setSongState({ filename, title, slides, slideIdx: idx })
    setSongHasEdits(false)
    setStatus(`${title} · ${slide.voice} · ${idx + 1}/${slides.length}`)
    set(dbRef(db, `${P}/liveSlide`), { type: 'song', filename, slideIdx: idx, ts: Date.now() }).catch(() => {})
  }, [])

  const showSongSlideRef = useRef(showSongSlide)
  showSongSlideRef.current = showSongSlide

  // Unified verse/CCC select handler (used by search + recent)
  const handleSelectVerse = useCallback((parsed) => {
    if (parsed?.ccc) handleSelectCCCRef.current(parsed.ccc)
    else showVerseRef.current(parsed)
  }, [])

  // Save verse edit to Firebase (debounced)
  const saveEditTimerRef = useRef(null)
  const handleVerseEdit = (newText) => {
    setVerseText(newText)
    // In song mode, keep slides in sync so Save captures the edit
    const { songState: ss } = stateRef.current
    if (ss) {
      setSongHasEdits(true)
      setSongState(prev => {
        if (!prev) return prev
        const slides = prev.slides.map((s, i) => i === prev.slideIdx ? { ...s, text: newText } : s)
        return { ...prev, slides }
      })
      return
    }
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

  // Save edited song back to Firebase Storage
  const [songSaving, setSongSaving] = useState(false)
  const [songHasEdits, setSongHasEdits] = useState(false)
  const saveSong = async () => {
    const ss = stateRef.current.songState
    if (!ss) return
    setSongSaving(true)
    try {
      const content = serializeLyrics(ss.title, ss.slides)
      const fileRef = storageRef(storage, `lyrics-text/${ss.filename}.txt`)
      await uploadString(fileRef, content, 'raw', { contentType: 'text/plain; charset=utf-8' })
      setSongHasEdits(false)
      setStatus('Song saved ✓')
      setTimeout(() => setStatus('Ready'), 2000)
    } catch (e) {
      setStatus('Save failed: ' + e.message)
    } finally {
      setSongSaving(false)
    }
  }

  // AI semantic search
  const searchVersesCallable = useMemo(() => httpsCallable(functions, 'searchVerses'), [])
  const searchSongsCallable = useMemo(() => httpsCallable(functions, 'searchSongs'), [])

  const handleAiSearch = async (query) => {
    const { bibleEN: en, bibleML: ml } = stateRef.current
    if (!en) { setStatus('Bible data not ready yet — try again in a moment'); return }

    const wantsCCC = /\bccc\b/i.test(query)

    if (wantsCCC && !stateRef.current.cccData) {
      try {
        const snap = await get(dbRef(db, 'ccc'))
        const val = snap.val()
        if (val) setCccData(val)
      } catch { /* ignore */ }
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
            paragraph: r.paragraph,   // kept for click handler
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
      setAiResults([{ ref: 'Search Error', text: msg, reason: 'Please try again.', parsed: null, type: 'error' }])
    } finally {
      setAiLoading(false)
    }
  }

  // AI song search: sends all titles to Gemini, which identifies matching filenames
  const handleSongAiSearch = useCallback(async (query) => {
    const { songsManifest: songs } = stateRef.current
    if (!songs) { setStatus('Songs not loaded yet'); return }
    setSongAiLoading(true)
    try {
      const titleList = songs.map(s => ({ filename: s.filename, title: s.title }))
      const result = await searchSongsCallable({ query, songs: titleList })
      const filenames = result.data?.filenames || []
      const matched = filenames
        .map(fn => songs.find(s => s.filename === fn))
        .filter(Boolean)
      if (matched.length === 0) {
        setStatus(`No songs found for "${query}"`)
      } else {
        setStatus(`Found ${matched.length} song(s) for "${query}"`)
        setAiResults(matched.map(s => ({
          type: 'song',
          ref: s.title,
          text: s.text?.slice(0, 100) || '',
          filename: s.filename,
          reason: `${s.voices?.length || 0} slides`,
          parsed: null,
        })))
      }
    } catch (e) {
      setStatus('Song AI search failed: ' + (e?.message || e))
    } finally {
      setSongAiLoading(false)
    }
  }, [searchSongsCallable])

  // Relay remote search queries
  useEffect(() => {
    return onValue(dbRef(db, `${P}/searchQuery`), async snap => {
      const val = snap.val()
      if (!val?.q || !val?.ts || val.ts < PAGE_LOAD_TIME) return
      const { bibleEN: en } = stateRef.current
      if (!en) return
      try {
        const candidates = tfidfSearch(en, val.q, 40).map(c => ({ ref: c.ref, text: c.text }))
        if (candidates.length === 0) {
          await set(dbRef(db, `${P}/searchResults`), { ts: val.ts, results: [] })
          return
        }
        const { data } = await searchVersesCallable({ query: val.q, candidates })
        await set(dbRef(db, `${P}/searchResults`), { ts: val.ts, results: data.results || [] })
      } catch {
        await set(dbRef(db, `${P}/searchResults`), { ts: val.ts, results: [] })
      }
    })
  }, [searchVersesCallable])

  // Navigation
  const prevVerse = () => {
    const { songState: ss, currentRef: cr } = stateRef.current
    if (ss) {
      if (ss.slideIdx > 0) showSongSlideRef.current(ss.filename, ss.slideIdx - 1)
      return
    }
    if (cr?.verse > 1) showVerseRef.current({ ...cr, verse: cr.verse - 1 }, { addToRecent: false, rangeNav: true })
  }
  const nextVerse = () => {
    const { songState: ss, currentRef: cr } = stateRef.current
    if (ss) {
      if (ss.slideIdx < ss.slides.length - 1) showSongSlideRef.current(ss.filename, ss.slideIdx + 1)
      return
    }
    if (cr) showVerseRef.current({ ...cr, verse: cr.verse + 1 }, { addToRecent: false, rangeNav: true })
  }

  // Font size
  const increaseFontSize = () => setFontSize(s => Math.min(160, s + Math.max(6, Math.round(s * 0.12))))
  const decreaseFontSize = () => setFontSize(s => Math.max(12, s - Math.max(4, Math.round(s * 0.12))))

  // Fullscreen — tries native API first; falls back to CSS fixed overlay.
  // CSS fallback is essential for:
  //   • iOS Safari (no native Fullscreen API)
  //   • Remote-control triggers (no user-gesture, so native API is denied)
  const toggleFullscreenRef = useRef(null)
  const toggleFullscreen = async () => {
    const inNativeFs = !!document.fullscreenElement
    const { isFullscreen: inCssFs } = stateRef.current

    // Exit paths
    if (inNativeFs) {
      try { await document.exitFullscreen() } catch { /* ignore */ }
      return
    }
    if (inCssFs) {
      setIsFullscreen(false)
      return
    }

    // Enter — try native, fall back to CSS
    try {
      const el = verseStageRef.current
      if (!el || !document.fullscreenEnabled) throw new Error('no native fullscreen')
      await el.requestFullscreen()
      // fullscreenchange event will set isFullscreen=true
    } catch {
      // No user gesture, not supported (iOS), or other error → CSS fullscreen
      setIsFullscreen(true)
    }
  }
  toggleFullscreenRef.current = toggleFullscreen

  // Auto-dismiss the prompt after 5 s and fall back to CSS overlay so
  // something happens even if nobody is seated at the presentation screen.
  useEffect(() => {
    if (!remoteFullscreenPrompt) return
    const t = setTimeout(() => {
      setRemoteFullscreenPrompt(false)
      setIsFullscreen(true)   // CSS overlay fallback
    }, 5000)
    return () => clearTimeout(t)
  }, [remoteFullscreenPrompt])

  // Called when the user taps the fullscreen prompt — this IS a user gesture,
  // so requestFullscreen() will be granted by the browser.
  const handleFullscreenPromptTap = async () => {
    setRemoteFullscreenPrompt(false)
    await toggleFullscreen()
  }

  // Sync state when native fullscreen changes (e.g. user presses Escape)
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setIsFullscreen(false)
      else setIsFullscreen(true)
    }
    document.addEventListener('fullscreenchange', handler)
    document.addEventListener('webkitfullscreenchange', handler)
    return () => {
      document.removeEventListener('fullscreenchange', handler)
      document.removeEventListener('webkitfullscreenchange', handler)
    }
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
    const onKey = (ev) => {
      const active = document.activeElement
      const typing = active && (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.isContentEditable
      )
      if (typing) return
      switch (ev.key) {
        case 'ArrowLeft':  ev.preventDefault(); prevVerse(); break
        case 'ArrowRight': ev.preventDefault(); nextVerse(); break
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

  // bibleMeta for search
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
      <div className="max-w-5xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-8">
        <Header
          isDark={isDark}
          isListening={isListening}
          speechSupported={speechSupported}
          onToggleSpeech={toggleSpeech}
          onPrev={prevVerse}
          onNext={nextVerse}
          displayMode={displayMode}
          onSetMode={mode => { setDisplayMode(mode); setSongState(null) }}
          onDecreaseFontSize={decreaseFontSize}
          onIncreaseFontSize={increaseFontSize}
          onToggleTheme={onToggleTheme}
          onToggleFullscreen={toggleFullscreen}
          bookAliases={bookAliases}
          bibleMeta={bibleMeta}
          onSelectVerse={handleSelectVerse}
          onAiSearch={handleAiSearch}
          aiLoading={aiLoading}
          songs={songsManifest}
          onSelectSong={filename => showSongSlideRef.current(filename, 0)}
          onSongAiSearch={handleSongAiSearch}
          songAiLoading={songAiLoading}
        />

        {/* AI search results panel */}
        {aiResults !== null && (
          <div className={`mt-2 rounded-2xl border overflow-hidden ${
            isDark ? 'bg-slate-900/80 border-white/[0.08]' : 'bg-white border-slate-200'
          }`}>
            {/* Panel header */}
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
                className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                  isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
              >
                ✕ Close
              </button>
            </div>

            {aiResults.length === 0 ? (
              <p className={`px-4 py-5 text-sm text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                No matching verses found.
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto suggestions-scroll">
                {aiResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (r.type === 'song' && r.filename) {
                        showSongSlideRef.current(r.filename, 0)
                        setAiResults(null)
                      } else if (r.type === 'bible' && r.parsed) {
                        showVerseRef.current(r.parsed)
                        setAiResults(null)
                      } else if (r.type === 'ccc' && r.paragraph) {
                        setVerseRefLabel(r.ref)
                        setVerseText(r.text)
                        setCurrentRef(null)
                        saveRecent({ ccc: r.paragraph }, r.ref, r.text || '')
                        setStatus(r.ref)
                        setAiResults(null)
                      }
                    }}
                    className={`w-full text-left px-4 py-3 flex flex-col gap-0.5 transition-colors border-b last:border-b-0 ${
                      isDark
                        ? 'border-white/[0.04] hover:bg-white/[0.04] active:bg-white/[0.07]'
                        : 'border-slate-100 hover:bg-slate-50 active:bg-slate-100'
                    } ${r.type === 'error' ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    <span className={`text-xs font-semibold ${
                      r.type === 'ccc'
                        ? isDark ? 'text-sky-400' : 'text-sky-600'
                        : r.type === 'error'
                        ? isDark ? 'text-red-400' : 'text-red-600'
                        : isDark ? 'text-amber-300' : 'text-amber-600'
                    }`}>
                      {r.ref}
                      {(r.type === 'bible' || r.type === 'ccc') && (
                        <span className={`ml-1.5 text-[9px] font-normal opacity-50`}>tap to project</span>
                      )}
                    </span>
                    <span className={`text-[11px] leading-snug line-clamp-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {r.text}
                    </span>
                    {r.textML && (
                      <span className={`text-[11px] leading-snug line-clamp-1 font-[Noto_Serif_Malayalam,serif] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {r.textML}
                      </span>
                    )}
                    {r.reason && (
                      <span className={`text-[10px] italic mt-0.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                        {r.reason}
                      </span>
                    )}
                  </button>
                ))}
              </div>
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
          displayMode={songState ? 'ML' : displayMode}
          fontSize={fontSize}
          isRecording={isListening}
          isFullscreen={isFullscreen}
          onVerseEdit={handleVerseEdit}
          onToggleFullscreen={toggleFullscreen}
          isSongMode={!!songState}
          onSaveSong={saveSong}
          songSaving={songSaving}
          songHasEdits={songHasEdits}
          mediaUrl={mediaUrl}
          mediaHtml={mediaHtml}
          bgImageUrl={bgImageUrl}
          bgImageOpacity={bgImageOpacity}
        />

        <RecentVerses
          isDark={isDark}
          verses={recentVerses}
          onClear={clearRecent}
          buildCopyText={buildRecentCopyText}
          onSelect={async ref => {
            if (ref?.ccc) {
              await handleSelectCCCRef.current(ref.ccc)
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

      {/* Remote fullscreen prompt — shown when remote requests fullscreen.
          The user on the presentation screen must tap this; their tap is the
          user gesture the browser requires before allowing requestFullscreen(). */}
      {remoteFullscreenPrompt && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Tap to enter fullscreen"
          onClick={handleFullscreenPromptTap}
          onKeyDown={e => e.key === 'Enter' && handleFullscreenPromptTap()}
          className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer"
        >
          <div className="bg-slate-900 border border-white/10 rounded-3xl px-10 py-8 text-center shadow-2xl select-none max-w-xs mx-4">
            <div className="text-6xl mb-4 text-amber-300">⤢</div>
            <p className="text-white text-xl font-semibold mb-1">Tap to go fullscreen</p>
            <p className="text-slate-400 text-sm">Remote control requested fullscreen</p>
            <div className="mt-4 h-1 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-amber-400/60 animate-[shrink_5s_linear_forwards]" />
            </div>
          </div>
        </div>
      )}
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
