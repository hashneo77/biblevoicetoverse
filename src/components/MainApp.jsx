import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ref as dbRef, get, set, push, onValue } from 'firebase/database'
import { httpsCallable } from 'firebase/functions'
import { ref as storageRef, uploadString, getBytes } from 'firebase/storage'
import { db, functions, storage } from '../firebase'
import { getCachedBible, putCachedBible } from '../bibleCache'
import { parseReference } from '../utils/parseReference'
import { tfidfSearch } from '../utils/tfidf'
import { parseLyrics, serializeLyrics } from '../utils/parseLyrics'
import { Header } from './Header'
import { nextThemeId } from '../themes'
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

// Use the device cache when it matches bibleVersion/<lang>; download otherwise.
// versions === undefined means the version check itself failed (offline), so any cache will do.
async function loadBible(lang, versions) {
  const version = versions?.[lang] ?? null
  const cached = await getCachedBible(lang)
  if (cached && (versions === undefined || (version !== null && cached.version === version))) return cached.store
  const fresh = await fetchBibleFromFirebase(lang)
  if (fresh) { putCachedBible(lang, version, fresh); return fresh }
  return cached?.store ?? null
}

// Largest font size (down to 40% of the chosen size) at which the text fits between the top of the
// text area and the bottom of the window — so a whole Holy Mass slide is always visible.
function fitFontSize(text, body, baseSize) {
  if (!text || !body) return baseSize
  const top = Math.max(0, body.getBoundingClientRect().top)
  const framed = !!document.querySelector('[data-event-frame-on]')  // event frame: keep clear of its bottom band
  const avail = Math.max(120, window.innerHeight - top - 32 - (framed ? window.innerHeight * 0.08 : 0))
  const cs = getComputedStyle(body)
  const meas = document.createElement('div')
  meas.className = body.className
  Object.assign(meas.style, {
    position: 'absolute', visibility: 'hidden', left: '-10000px', top: '0',
    width: `${body.clientWidth}px`, lineHeight: '1.55',
    fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, padding: cs.padding, whiteSpace: 'pre-wrap',
  })
  meas.innerText = text
  document.body.appendChild(meas)
  const vwCap = window.innerWidth * 0.09  // matches the stage's min(size, 9vw)
  const fits = size => { meas.style.fontSize = `${Math.min(size, vwCap)}px`; return meas.scrollHeight <= avail }
  let size = baseSize
  if (!fits(size)) {
    let lo = baseSize * 0.4, hi = baseSize
    for (let k = 0; k < 12; k++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid }
    size = Math.floor(lo)
  }
  meas.remove()
  return size
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

export function MainApp({ isDark, theme, onToggleTheme, onSetTheme, sessionPrefix = 'remote', userEmail, onSignOut, sessions, onSwitchSession }) {
  const P = sessionPrefix
  const RECENT_ITEMS_PATH = `${P}/recentItems`

  const [displayMode, setDisplayMode] = useState('ML')
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
  // { kind: 'holyMass', path, key } | { kind: 'slides', deckKey, key } for the image on screen, so ◀ ▶ can step through it
  const mediaSeqRef = useRef(null)
  // Running Holy Mass plan ({ path, items: [{key, part, slide}] }): ◀ ▶ step only through its slides
  const activeMassPlanRef = useRef(null)
  useEffect(() => {
    let plans = {}, activeId = null
    const update = () => { activeMassPlanRef.current = (activeId && plans[activeId]) || null }
    const off1 = onValue(dbRef(db, `${P}/massPlans`), snap => { plans = snap.val() || {}; update() })
    const off2 = onValue(dbRef(db, `${P}/massActivePlan`), snap => { activeId = snap.val(); update() })
    return () => { off1(); off2() }
  }, [])
  const [mediaUrl, setMediaUrl] = useState(null) // active media image url
  const [mediaHtml, setMediaHtml] = useState(null) // active media text html
  const [mediaLang, setMediaLang] = useState(null) // 'ML' | 'EN' font for remote-sent text (e.g. Holy Mass pages)
  // Holy Mass: the slide on screen ({ text, role, label, path, key, part, slide }). Slides are pre-split
  // in the data (same as the remote shows); the display shrinks the text to fit instead of splitting.
  const [massPart, setMassPart] = useState(null)
  const [massChunks, setMassChunks] = useState(null)
  const [massChunkIdx, setMassChunkIdx] = useState(0)
  const [viewportTick, setViewportTick] = useState(0)
  const [massFontSize, setMassFontSize] = useState(null) // font size that fits the Holy Mass slide on screen
  const [bgImageUrl, setBgImageUrl] = useState(null)
  const [bgImageOpacity, setBgImageOpacity] = useState(0.2)

  const verseStageRef = useRef(null)
  // Always-current ref pattern for stable callbacks
  const stateRef = useRef({})
  stateRef.current = {
    displayMode, bibleEN, bibleML, cccData, currentRef, isDark, isFullscreen,
    onSetTheme,
    songState, songsManifest, massChunks, massChunkIdx,
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

  // Load Bible data — Malayalam first (the display always starts in ML), English after
  useEffect(() => {
    const load = async () => {
      setStatus('Loading Bible data…')
      const versions = await get(dbRef(db, 'bibleVersion')).then(s => s.val() || {}, () => undefined)
      const ml = await loadBible('malayalam', versions)
      if (ml) { setBibleML(ml); setStatus('Ready') }
      const en = await loadBible('english', versions)
      if (en) setBibleEN(en)
      if (!ml) setStatus(en ? 'Ready' : 'Could not load Bible data')
    }
    load()
  }, [])

  // Always start in Malayalam: reset the session's language, and ignore the stale
  // saved value until that write lands so a leftover 'EN' can't flip the display.
  const langResetDone = useRef(false)
  useEffect(() => {
    set(dbRef(db, `${P}/settings/language`), 'ML')
      .catch(() => {})
      .finally(() => { langResetDone.current = true })
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
        .filter((item, idx, arr) => arr.findIndex(i => i.key === item.key) === idx)
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

      if (langResetDone.current && (val.language === 'EN' || val.language === 'ML') && val.language !== dm) setDisplayMode(val.language)

      if (val.theme) setTheme?.(val.theme)   // theme id from the remote's picker

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
          } else if (mediaSeqRef.current) {
            stepMediaRef.current('prev')
          } else if (cr?.verse > 1) {
            showVerseRef.current({ ...cr, verse: cr.verse - 1 }, { addToRecent: false, rangeNav: true })
          }
        } else {
          const { songState: ss, currentRef: cr } = stateRef.current
          if (ss) {
            if (ss.slideIdx < ss.slides.length - 1) showSongSlideRef.current(ss.filename, ss.slideIdx + 1)
          } else if (mediaSeqRef.current) {
            stepMediaRef.current('next')
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
      mediaSeqRef.current = val.seq || null
      setSongState(null)
      setCurrentRef(null)
      setVerseRefLabel(val.label || '')
      setMediaLang(val.lang || null)
      if (val.type === 'text' && val.seq?.kind === 'holyMass') {
        setMediaUrl(null)
        setMediaHtml(null)
        setMassPart({
          text: val.text || '', role: val.role || null, note: val.note || null, label: val.label || '', ts: val.ts,
          path: val.seq.path, key: val.seq.key, part: val.seq.part ?? 0, slide: val.seq.slide ?? 0,
        })
        return
      }
      setMassPart(null)
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

  // Event frame (branding border) from the remote
  const [eventFrame, setEventFrame] = useState(null)
  useEffect(() => onValue(dbRef(db, `${P}/eventFrame`), snap => setEventFrame(snap.val())), [])

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

  // Show initial verse as soon as the on-screen language's data loads
  const initialVerseShown = useRef(false)
  const activeBible = displayMode === 'EN' ? bibleEN : bibleML
  useEffect(() => {
    if (activeBible && !initialVerseShown.current) {
      initialVerseShown.current = true
      showVerseRef.current({ book: 'Genesis', chapter: 1, verse: 1 }, { addToRecent: false })
    }
  }, [activeBible])

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
    mediaSeqRef.current = null
    setMediaLang(null)
    setMassPart(null)
    setSongState(null)
    setMediaUrl(null)
    setMediaHtml(null)
    const { displayMode: dm, bibleEN: en, bibleML: ml } = stateRef.current
    const store = dm === 'EN' ? en : ml
    const altStore = dm === 'EN' ? ml : en
    let { text, resolvedBook } = lookupVerse(store, parsed.book, parsed.chapter, parsed.verse)
    if (!text && altStore) {
      const alt = lookupVerse(altStore, parsed.book, parsed.chapter, parsed.verse)
      if (alt.text) {
        const fbKey = altStore.nameToFirebaseKey?.[alt.resolvedBook]
        const primaryBook = fbKey && store?.nameToFirebaseKey
          ? Object.keys(store.nameToFirebaseKey).find(k => store.nameToFirebaseKey[k] === fbKey)
          : null
        if (primaryBook) {
          const primary = lookupVerse(store, primaryBook, parsed.chapter, parsed.verse)
          if (primary.text) { text = primary.text; resolvedBook = primary.resolvedBook }
          else { text = alt.text; resolvedBook = alt.resolvedBook }
        } else {
          text = alt.text; resolvedBook = alt.resolvedBook
        }
      }
    }

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

    if (dm !== 'EN') {
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
    mediaSeqRef.current = null
    setMediaLang(null)
    setMassPart(null)
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
    mediaSeqRef.current = null
    setMediaLang(null)
    setMassPart(null)
    // EN mode shows songs in Manglish (<song>.manglish.txt, same slide layout), falling back to Malayalam
    const candidates = stateRef.current.displayMode === 'EN'
      ? [[`lyrics-text/${filename}.manglish.txt`, 'EN'], [`lyrics-text/${filename}.txt`, 'ML']]
      : [[`lyrics-text/${filename}.txt`, 'ML']]
    let parsed, path, lang
    for (const [p, l] of candidates) {
      try {
        const bytes = await getBytes(storageRef(storage, p))
        parsed = parseLyrics(new TextDecoder('utf-8').decode(bytes))
        path = p; lang = l
        break
      } catch { /* try next */ }
    }
    if (!parsed) {
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
    setSongState({ filename, title, slides, slideIdx: idx, path, lang })
    setSongHasEdits(false)
    setStatus(`${title} · ${slide.voice} · ${idx + 1}/${slides.length}`)
    set(dbRef(db, `${P}/liveSlide`), { type: 'song', filename, slideIdx: idx, ts: Date.now() }).catch(() => {})
  }, [])

  const stepMedia = async (dir) => {
    const seq = mediaSeqRef.current
    if (!seq) return
    let list = []  // [{ key, url, name }] in order
    try {
      if (seq.kind === 'holyMass') {
        const val = (await get(dbRef(db, seq.path))).val() || {}  // shared Holy Mass list, not per session
        list = Object.entries(val)
          .sort(([, a], [, b]) => (a.ts || 0) - (b.ts || 0))
          // one entry per speaker part; a page without text stays a single image entry
          .flatMap(([key, d]) => {
            const label = `${seq.title ? `${seq.title} · ` : ''}${d.label ? `Page ${d.label}` : 'Unnumbered'}`
            const parts = (d.parts || []).filter(pt => pt.text)  // rubric-only parts aren't shown
            const slides = parts.flatMap((pt, i) => (pt.slides?.length ? pt.slides : [pt.text])
              .map((text, j) => ({ key, part: i, slide: j, url: d.url, name: label, text, role: pt.role || null })))
            return slides.length ? slides : [{ key, part: 0, slide: 0, url: d.url, name: label, text: '' }]
          })
      } else if (seq.kind === 'slides') {
        const deck = (await get(dbRef(db, `${P}/slideDecks/${seq.deckKey}`))).val()
        list = (deck?.slides || []).map((sl, i) => ({ key: String(i), url: sl.url, name: `${deck.name} · ${i + 1}` }))
      }
    } catch { return }
    const idxOf = (key, part, slide) => list.findIndex(i => i.key === key && (i.part ?? 0) === (part ?? 0) && (i.slide ?? 0) === (slide ?? 0))
    const cur = idxOf(seq.key, seq.part, seq.slide)
    let next = cur + (dir === 'next' ? 1 : -1)
    const plan = activeMassPlanRef.current
    if (seq.kind === 'holyMass' && plan?.path === seq.path && plan.items?.length) {
      // plan order; from a slide outside the plan, go to the nearest plan slide in that direction
      const planIdx = plan.items.map(it => idxOf(it.key, it.part, it.slide)).filter(i => i >= 0)
      const pos = planIdx.indexOf(cur)
      next = pos >= 0
        ? planIdx[pos + (dir === 'next' ? 1 : -1)]
        : (dir === 'next' ? planIdx.find(i => i > cur) : [...planIdx].reverse().find(i => i < cur))
      if (next === undefined) return
    }
    const item = list[next]
    if (!item || next < 0) return
    const nextSeq = { ...seq, key: item.key, part: item.part ?? 0, slide: item.slide ?? 0 }
    await set(dbRef(db, `${P}/currentMedia`), item.text
      ? { type: 'text', text: item.text, role: item.role, label: item.name, lang: seq.lang || null, ts: Date.now(), seq: nextSeq }
      : { type: 'image', url: item.url, name: item.name, ts: Date.now(), seq: nextSeq },
    ).catch(() => {})
  }
  // Holy Mass: step through this part's screens first, then on to the next/previous part
  const stepMass = (dir) => {
    const { massChunks: chunks, massChunkIdx: idx } = stateRef.current
    if (chunks && dir === 'next' && idx < chunks.length - 1) { setMassChunkIdx(idx + 1); return }
    if (chunks && dir === 'prev' && idx > 0) { setMassChunkIdx(idx - 1); return }
    stepMedia(dir)
  }
  const stepMediaRef = useRef(stepMass)
  stepMediaRef.current = stepMass

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
    const store = dm === 'EN' ? en : ml
    const fbPath = dm === 'EN' ? 'english' : 'malayalam'
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
        // Bump the version so other devices re-download; keep this device's cache current
        const version = Date.now()
        await set(dbRef(db, `bibleVersion/${fbPath}`), version)
        putCachedBible(fbPath, version, store)
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
      const fileRef = storageRef(storage, ss.path)
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
  const parseVoiceRefCallable = useMemo(() => httpsCallable(functions, 'parseVoiceRef'), [])

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
        const { text: textML, resolvedBook: mlBook } = ml ? lookupVerse(ml, r.book, r.chapter, r.verse) : { text: '', resolvedBook: '' }
        const ref = mlBook && mlBook !== r.book
          ? `${r.book} ${r.chapter}:${r.verse} / ${mlBook} ${r.chapter}:${r.verse}`
          : `${r.book} ${r.chapter}:${r.verse}`
        return {
          type: 'bible',
          ref,
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
    if (mediaSeqRef.current) { stepMass('prev'); return }
    if (cr?.verse > 1) showVerseRef.current({ ...cr, verse: cr.verse - 1 }, { addToRecent: false, rangeNav: true })
  }
  const nextVerse = () => {
    const { songState: ss, currentRef: cr } = stateRef.current
    if (ss) {
      if (ss.slideIdx < ss.slides.length - 1) showSongSlideRef.current(ss.filename, ss.slideIdx + 1)
      return
    }
    if (mediaSeqRef.current) { stepMass('next'); return }
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

  // Voice search runs on the owner's remote: it writes `${P}/voice` = { listening, final: { text, ts } },
  // and the display turns the spoken words into a verse (reference parser, then AI)
  const handleVoiceText = async text => {
    const parsed = parseReference(text, bookAliases)
    if (parsed) { showVerseRef.current(parsed); return }
    setStatus('Parsing voice with AI…')
    try {
      const { bibleEN: en } = stateRef.current
      const bookNames = en ? Object.keys(en.data) : []
      const result = await parseVoiceRefCallable({ transcript: text, bookNames })
      if (result.data?.ref) showVerseRef.current(result.data.ref)
      else setStatus('Could not parse: ' + text)
    } catch {
      setStatus('Could not parse: ' + text)
    }
  }
  const handleVoiceTextRef = useRef(handleVoiceText)
  handleVoiceTextRef.current = handleVoiceText
  const [voice, setVoice] = useState(null)
  const voiceTsRef = useRef(PAGE_LOAD_TIME)
  useEffect(() => onValue(dbRef(db, `${P}/voice`), snap => {
    const v = snap.val()
    setVoice(v)
    if (v?.final?.text && v.final.ts > voiceTsRef.current) {
      voiceTsRef.current = v.final.ts
      handleVoiceTextRef.current(v.final.text)
    }
  }), [])
  const isListening = !!voice?.listening
  const transcript = isListening && voice?.final?.text ? `Heard: ${voice.final.text}` : ''

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
        case 'e': case 'E':
          ev.preventDefault()
          setDisplayMode(m => m === 'EN' ? 'ML' : 'EN')
          break
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

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

  // Refit the Holy Mass slide when the window resizes
  useEffect(() => {
    const onResize = () => setViewportTick(t => t + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Holy Mass slides are pre-split in the data (the remote shows the same slides), so the
  // display never splits further: it shrinks the text if a slide doesn't fit the screen.
  useEffect(() => {
    if (!massPart) { setMassChunks(null); setMassFontSize(null); return }
    setMassChunks([massPart.text])
    setMassChunkIdx(0)
    setVerseText(massPart.text)
    setVerseRefLabel(massPart.label)
  }, [massPart])
  useEffect(() => {
    if (!massPart) return
    const body = verseStageRef.current?.querySelector('[data-verse-body]')
    setMassFontSize(fitFontSize(massPart.text, body, fontSize))
  }, [massPart, fontSize, isFullscreen, viewportTick, mediaLang])

  // Re-render current verse (or song slide, e.g. Malayalam ↔ Manglish) when mode changes
  useEffect(() => {
    const { currentRef: cr, songState: ss } = stateRef.current
    if (ss) showSongSlideRef.current(ss.filename, ss.slideIdx)
    else if (cr) showVerseRef.current(cr)
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
          onPrev={prevVerse}
          onNext={nextVerse}
          displayMode={displayMode}
          onSetMode={setDisplayMode}
          onDecreaseFontSize={decreaseFontSize}
          onIncreaseFontSize={increaseFontSize}
          onToggleTheme={() => { const id = nextThemeId(theme?.id); onSetTheme?.(id); set(dbRef(db, `${P}/settings/theme`), id).catch(() => {}) }}
          themeLabel={theme?.label}
          onToggleFullscreen={toggleFullscreen}
          userEmail={userEmail}
          onSignOut={onSignOut}
          sessions={sessions}
          currentSession={sessionPrefix}
          onSwitchSession={onSwitchSession}
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
          displayMode={songState ? songState.lang : mediaLang || displayMode}
          fontSize={massPart && massFontSize ? massFontSize : fontSize}
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
          eventFrame={eventFrame}
          theme={theme}
          isMassMode={!!massPart}
          massRole={massPart?.role}
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
