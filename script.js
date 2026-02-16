/* ========= Globals & Helpers ========= */
let BOOK_ALIASES = {};
(async function loadBookAliases() {
    try {
        const res = await fetch('./book_aliases.json');
        if (res.ok) BOOK_ALIASES = await res.json();
        // console.log("✅ Loaded aliases:", BOOK_ALIASES);
    } catch (e) { console.warn("Could not load book_aliases.json", e); }
})();

function normalizeSpoken(s) { return s.trim().replace(/\bchapter\b/gi, ' ').replace(/\bverse\b/gi, ' ').replace(/\s+/g, ' ').toLowerCase(); }
function wordsToNumber(w) {
    const m = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11, 'twelve': 12 };
    if (!isNaN(Number(w))) return Number(w);
    return m[w] || null;
}

function doubleMetaphone(value) {
    if (!value) return ["", ""]; value = value.toLowerCase().trim();
    value = value.replace(/[^a-z]/g, ""); if (!value) return ["", ""];
    const length = value.length;
    let primary = ""; let secondary = ""; let index = 0;
    function add(p, s) { primary += p; secondary += (s !== undefined ? s : p); }
    while (index < length) {
        const char = value[index];
        if (/[aeiouy]/.test(char)) { if (index === 0) add("A"); index++; continue; }
        if (char === "b") { add("P"); index += (value[index + 1] === "b") ? 2 : 1; continue; }
        if (char === "c") {
            if (value.substr(index, 2) === "ch") { add("X"); index += 2; continue; }
            add("K"); index += (value[index + 1] === "c") ? 2 : 1; continue;
        }
        if (char === "d") { if (value.substr(index, 2) === "dg") { add("J"); index += 2; } else { add("T"); index++; } continue; }
        if (char === "g") { if (value[index + 1] === "h") { add("K"); index += 2; continue; } add("K"); index++; continue; }
        if (char === "h") { if (/[aeiou]/.test(value[index + 1])) { add("H"); index++; } index++; continue; }
        if (char === "k") { add("K"); index += (value[index + 1] === "k") ? 2 : 1; continue; }
        if (char === "p") { add("P"); index += (value[index + 1] === "p") ? 2 : 1; continue; }
        if (char === "q") { add("K"); index++; continue; }
        if (char === "s") { if (value.substr(index, 2) === "sh") { add("X"); index += 2; continue; } add("S"); index++; continue; }
        if (char === "t") { if (value.substr(index, 2) === "th") { add("0", "T"); index += 2; continue; } add("T"); index++; continue; }
        if (char === "v") { add("F"); index++; continue; }
        if (char === "w" || char === "y") { if (/[aeiou]/.test(value[index + 1])) add("A"); index++; continue; }
        if (char === "x") { add("KS"); index++; continue; }
        if (char === "z") { add("S"); index++; continue; }
        add(char.toUpperCase()); index++;
    }
    return [primary, secondary];
}

/* Parse spoken reference using BOOK_ALIASES */
function parseReference(text) {
    const s = normalizeSpoken(text);
    const tokens = s.split(/\s+/).filter(Boolean);

    for (let len = Math.min(3, tokens.length); len >= 1; len--) {
        const candidate = tokens.slice(0, len).join(' ');
        if (BOOK_ALIASES[candidate]) {
            const book = BOOK_ALIASES[candidate];
            let rest = tokens.slice(len).join(' ');
            const fillerPattern = /\b(chapter|chap|verse|v|was|that|the|number|num|of|and|please|read)\b/gi;
            rest = rest.replace(fillerPattern, ' ').replace(/[.,;!?]/g, ' ').trim();
            rest = rest.replace(/\s+/g, ' ');

            const colon = rest.match(/(\d+):(\d+)/);
            if (colon) {
                return { book, chapter: +colon[1], verse: +colon[2] };
            }
            if (!rest) return null;
            const nums = rest.split(/\s+/).filter(Boolean);
            if (nums.length >= 2) {
                const c = (Number(nums[0]) || wordsToNumber(nums[0]));
                const v = (Number(nums[1]) || wordsToNumber(nums[1]));
                if (Number.isFinite(c) && Number.isFinite(v) && c > 0 && v > 0) {
                    return { book, chapter: c, verse: v };
                }
            }
            if (nums.length === 1) {
                const c = (Number(nums[0]) || wordsToNumber(nums[0]));
                if (Number.isFinite(c) && c > 0) return { book, chapter: c, verse: 1 };
            }
            return null;
        }
    }
    return null;
}

/* ========= DOM refs ========= */
const startStopBtn = document.getElementById('startStopBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const transcriptEl = document.getElementById('transcript');
const verseRefEl = document.getElementById('verseRef');
const verseBodyEl = document.getElementById('verseBody');
const logEl = document.getElementById('log');
const bigPlus = document.getElementById('bigPlus');
const bigMinus = document.getElementById('bigMinus');
const themeBtn = document.getElementById('themeBtn');
const langBtn = document.getElementById('langBtn');
const verseStage = document.getElementById('verseStage');
const verseMaxBtn = document.getElementById('verseMaxBtn');
const verseRecBtn = document.getElementById('verseRecBtn');

/* ========= App state ========= */
let currentRef = null;

/* Responsive + user-controlled font logic */
let baseFontSize = 44; // fallback
let userAdjustedFont = false;
let deferredPrompt;

function log(msg) { logEl.innerText = msg; }

/* Read computed font-size (px) for verseBody */
function readComputedVerseFontSize() {
    try {
        const s = window.getComputedStyle(verseBodyEl);
        const fs = parseFloat(s && s.fontSize);
        if (Number.isFinite(fs)) return Math.round(fs);
    } catch (e) { /* ignore */ }
    return baseFontSize;
}

/* Initialize baseFontSize from CSS responsive value */
baseFontSize = readComputedVerseFontSize();
verseBodyEl.style.fontSize = baseFontSize + 'px';

/* ========= App data ========= */
let englishXML = null;
let malayalamXML = null;
let bibleData = null;
let bibleBookNames = null;
let bibleEnglishToKeyMap = null;
let currentLanguage = 'EN';

function assignParsedToLang(parsedObj, lang) {
    if (!parsedObj) return;
    if (lang === 'EN') {
        englishXML = {
            data: parsedObj.bibleDataLocal,
            bookNames: parsedObj.bookNamesSet,
            englishToKeyMap: parsedObj.englishToKeyMap || null
        };
    } else if (lang === 'ML') {
        malayalamXML = {
            data: parsedObj.bibleDataLocal,
            bookNames: parsedObj.bookNamesSet,
            englishToKeyMap: parsedObj.englishToKeyMap || null
        };
    }
}

/* ========= Firebase Auth & RTDB ========= */
const fbAuth = firebase.auth();
const fbDb = firebase.database();
const signInBtn = document.getElementById('signInBtn');

function updateSignInUI(user) {
    if (user) {
        signInBtn.textContent = user.displayName ? user.displayName.split(' ')[0] : 'Sign Out';
        signInBtn.title = `Signed in as ${user.email} — click to sign out`;
    } else {
        signInBtn.textContent = 'Sign In';
        signInBtn.title = 'Sign in with Google';
    }
}

signInBtn.addEventListener('click', async () => {
    if (fbAuth.currentUser) {
        await fbAuth.signOut();
        log('Signed out.');
    } else {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await fbAuth.signInWithPopup(provider);
        } catch (e) {
            console.warn('Sign-in error:', e);
            log('Sign-in failed: ' + (e.message || e));
        }
    }
});

/* Listen for auth state changes — load data once signed in */
fbAuth.onAuthStateChanged(async (user) => {
    updateSignInUI(user);
    if (user) {
        log('Signed in. Loading Bible data...');
        await preloadBothXml();
    } else {
        englishXML = null;
        malayalamXML = null;
        bibleData = null;
        bibleBookNames = null;
        bibleEnglishToKeyMap = null;
        verseRefEl.innerText = 'Please sign in';
        verseBodyEl.innerText = '';
        log('Please sign in to access Bible data.');
    }
});

/* Fetch Bible from Firebase RTDB using SDK (authenticated) */
async function fetchBibleFromFirebase(path) {
    try {
        const snapshot = await fbDb.ref(path).once('value');
        const fbData = snapshot.val();
        if (!fbData) throw new Error('Firebase returned empty data for ' + path);

        const bibleDataLocal = {};
        const englishToKeyMap = {};

        for (const bookKey of Object.keys(fbData)) {
            const book = fbData[bookKey];
            if (!book) continue;
            const xmlKey = book.name || bookKey;
            const shortName = book.shortName || '';

            bibleDataLocal[xmlKey] = {};
            if (shortName) englishToKeyMap[shortName.toLowerCase()] = xmlKey;

            if (book.chapters) {
                for (const chKey of Object.keys(book.chapters)) {
                    const verses = book.chapters[chKey];
                    if (!verses || typeof verses !== 'object') continue;
                    const ch = chKey.replace(/^ch/, '');
                    bibleDataLocal[xmlKey][ch] = {};
                    for (const v of Object.keys(verses)) {
                        if (verses[v] == null) continue;
                        bibleDataLocal[xmlKey][ch][v] = verses[v];
                    }
                }
            }
        }

        const bookNamesSet = Object.keys(bibleDataLocal);
        return { bibleDataLocal, bookNamesSet, englishToKeyMap };
    } catch (e) {
        console.warn(`Firebase fetch failed for ${path}:`, e.message || e);
        return null;
    }
}

/* ========= Helpers ========= */
function isTypingInInput() {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || active.isContentEditable;
}

/* Resolve spoken (English canonical) book name to the current XML's key */
function resolveBookName(spokenBook) {
    if (!bibleData) return spokenBook;
    if (bibleData[spokenBook]) return spokenBook;
    const lower = spokenBook.toLowerCase();
    for (const k of Object.keys(bibleData)) if (k.toLowerCase() === lower) return k;
    if (bibleEnglishToKeyMap) {
        const mapped = bibleEnglishToKeyMap[lower];
        if (mapped && bibleData[mapped]) return mapped;
    }
    const stripped = lower.replace(/[\s\.]/g, '');
    for (const k of Object.keys(bibleData)) if (k.toLowerCase().replace(/[\s\.]/g, '') === stripped) return k;
    for (const k of Object.keys(bibleData)) if (k.toLowerCase().startsWith(lower)) return k;
    return spokenBook;
}

/* ========= Display verse (uses bibleData if available, otherwise remote API) ========= */
async function showVerse(parsed) {
    try {
        if (!parsed) { log("No reference to show."); return; }
        const resolvedBook = bibleData ? resolveBookName(parsed.book) : parsed.book;
        if (bibleData && bibleData[resolvedBook] && bibleData[resolvedBook][String(parsed.chapter)] && bibleData[resolvedBook][String(parsed.chapter)][String(parsed.verse)]) {
            const text = bibleData[resolvedBook][String(parsed.chapter)][String(parsed.verse)];
            verseRefEl.innerText = `${resolvedBook} ${parsed.chapter}:${parsed.verse}`;
            verseBodyEl.innerText = text;
            verseBodyEl.style.fontSize = baseFontSize + 'px';
            currentRef = parsed;
            log(resolvedBook + ' ' + parsed.chapter + ':' + parsed.verse);
            return;
        }
        if (bibleData) {
            if (bibleData[resolvedBook] && bibleData[resolvedBook][String(parsed.chapter)]) {
                log(`Verse ${parsed.verse} not found in ${resolvedBook} ${parsed.chapter}.`);
            } else {
                log(`Chapter ${parsed.chapter} not found in ${resolvedBook}.`);
            }
        }
        const ref = `${parsed.book} ${parsed.chapter}:${parsed.verse}`;
        log('Trying remote API for: ' + ref);
        const resp = await fetch(`https://bible-api.com/${encodeURIComponent(ref)}`);
        if (!resp.ok) throw new Error('Remote API status ' + resp.status);
        const data = await resp.json();
        verseRefEl.innerText = data.reference + (data.translation_id ? ` — ${data.translation_id}` : '');
        verseBodyEl.innerText = data.text.trim();
        verseBodyEl.style.fontSize = baseFontSize + 'px';
        currentRef = parsed;
        log('Loaded from remote API.');
    } catch (e) { log('Error: ' + (e && e.message ? e.message : e)); }
}

/* ========= Navigation and A+/A- handlers (updated to preserve user choice) ========= */
prevBtn.addEventListener('click', () => { if (currentRef && currentRef.verse > 1) showVerse({ ...currentRef, verse: currentRef.verse - 1 }); });
nextBtn.addEventListener('click', () => { if (currentRef) showVerse({ ...currentRef, verse: currentRef.verse + 1 }); });

bigPlus.addEventListener('click', () => { userAdjustedFont = true; baseFontSize = Math.min(160, baseFontSize + Math.max(6, Math.round(baseFontSize * 0.12))); verseBodyEl.style.fontSize = baseFontSize + 'px'; });
bigMinus.addEventListener('click', () => { userAdjustedFont = true; baseFontSize = Math.max(12, baseFontSize - Math.max(4, Math.round(baseFontSize * 0.12))); verseBodyEl.style.fontSize = baseFontSize + 'px'; });

/* Theme toggle */
themeBtn.addEventListener('click', () => { const body = document.body; body.dataset.theme = (body.dataset.theme === "dark" ? "light" : "dark"); });

/* Fullscreen helpers */
function isDocumentInFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement); }
async function requestFullscreen(element) { if (element.requestFullscreen) return element.requestFullscreen(); if (element.webkitRequestFullscreen) return element.webkitRequestFullscreen(); if (element.msRequestFullscreen) return element.msRequestFullscreen(); return Promise.reject(new Error('Fullscreen API not supported')); }
async function exitFullscreen() { if (document.exitFullscreen) return document.exitFullscreen(); if (document.webkitExitFullscreen) return document.webkitExitFullscreen(); if (document.msExitFullscreen) return document.msExitFullscreen(); return Promise.reject(new Error('Exit Fullscreen API not supported')); }
function updateMaxButtonUI(isFull) { verseMaxBtn.setAttribute('aria-pressed', String(!!isFull)); verseMaxBtn.title = isFull ? 'Exit fullscreen (Esc or F)' : 'Maximize (F)'; verseMaxBtn.innerText = isFull ? '⤡' : '⤢'; if (isFull) verseStage.classList.add('fullscreen'); else verseStage.classList.remove('fullscreen'); }

async function toggleFullscreen() {
    try {
        const inFs = isDocumentInFullscreen();
        if (!inFs) { await requestFullscreen(verseStage); updateMaxButtonUI(true); }
        else { await exitFullscreen(); updateMaxButtonUI(false); }
    } catch (err) {
        console.warn('Fullscreen toggle failed', err);
        log('Fullscreen not available: ' + (err && err.message ? err.message : err));
    }
}
verseMaxBtn.addEventListener('click', (ev) => { ev.stopPropagation(); toggleFullscreen(); });
document.addEventListener('fullscreenchange', () => { updateMaxButtonUI(isDocumentInFullscreen()); refreshFontSizeFromCssIfAllowed(); });
document.addEventListener('webkitfullscreenchange', () => { updateMaxButtonUI(isDocumentInFullscreen()); refreshFontSizeFromCssIfAllowed(); });
document.addEventListener('msfullscreenchange', () => { updateMaxButtonUI(isDocumentInFullscreen()); refreshFontSizeFromCssIfAllowed(); });

document.addEventListener('keydown', (ev) => {
    if (isTypingInInput()) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable) return;
    if (ev.key && ev.key.toLowerCase() === 'f') { ev.preventDefault(); toggleFullscreen(); }
});

/* ========= SEARCH FEATURE ========= */
const searchInput = document.getElementById('searchInput');
const searchSuggestions = document.getElementById('searchSuggestions');
let searchIndex = [];

// Build searchable index from loaded XML
function buildSearchIndex() {
    searchIndex = [];
    if (!bibleData) return;
    for (const book of Object.keys(bibleData)) {
        for (const ch of Object.keys(bibleData[book])) {
            for (const v of Object.keys(bibleData[book][ch])) {
                const text = bibleData[book][ch][v];
                if (text) {
                    searchIndex.push({
                        book, chapter: ch, verse: v,
                        text, combinedLower: (book + " " + ch + ":" + v + " " + text).toLowerCase()
                    });
                }
            }
        }
    }
    console.log("🔎 Search index built, verses:", searchIndex.length);
}

// Run search and update suggestions
// Optional: build quick metadata from your searchIndex once (book -> maxChapter, and (book,chapter) -> maxVerse)
const __bibleMeta = (() => {
    const meta = { maxChapter: new Map(), maxVerse: new Map() };
    if (!Array.isArray(searchIndex)) return meta;
    for (const e of searchIndex) {
        const b = e.book;
        const c = +e.chapter, v = +e.verse;
        meta.maxChapter.set(b, Math.max(meta.maxChapter.get(b) || 0, c));
        const key = `${b}|${c}`;
        meta.maxVerse.set(key, Math.max(meta.maxVerse.get(key) || 0, v));
    }
    return meta;
})();

function updateSuggestions(query) {
    if (!query) { searchSuggestions.style.display = "none"; return; }

    const q = query.trim();
    const qLower = q.toLowerCase();
    const results = [];

    // FIXED: Always use English book names for search (from BOOK_ALIASES or englishXML)
    // so users can type in English regardless of current display language
    let books = [];
    if (Object.keys(BOOK_ALIASES).length > 0) {
        // Get unique canonical book names from BOOK_ALIASES values
        books = [...new Set(Object.values(BOOK_ALIASES))];
    } else if (englishXML && englishXML.bookNames) {
        books = Array.from(englishXML.bookNames);
    } else {
        // Fallback to current language book names
        books = bibleBookNames ? Array.from(bibleBookNames) : [];
    }

    // 1) BOOK PREFIX MODE (no book resolved yet): show books starting with the typed prefix
    //    We stay in this mode as long as the *entire query* is still a prefix of at least one book.
    const bookPrefixMatches = books.filter(b => b.toLowerCase().startsWith(qLower));
    if (bookPrefixMatches.length > 0) {
        // Only suggest books (no verse text yet)
        for (const book of bookPrefixMatches.slice(0, 15)) {
            results.push({
                ref: book,
                preview: "(book)",
                parsed: { book, chapter: 1, verse: 1 }
            });
        }
        return renderSuggestions(results);
    }

    // 2) BOOK RESOLVED MODE: detect if query begins with a full/unique book name
    //    Example: "Zechariah 9:8", "Zechariah 9", "Zechariah"
    //    Find the longest book that matches the start of the query (case-insensitive).
    let resolvedBook = null;
    let remainder = "";
    for (const book of books) {
        const bl = book.toLowerCase();
        if (qLower.startsWith(bl)) {
            // ensure either exact end or a whitespace boundary after the book name
            const nextChar = qLower.charAt(bl.length);
            if (!nextChar || /\s/.test(nextChar)) {
                if (!resolvedBook || bl.length > resolvedBook.toLowerCase().length) {
                    resolvedBook = book;
                    remainder = q.slice(book.length).trim(); // keep original casing for numbers/colons
                }
            }
        }
    }

    if (!resolvedBook) {
        // Nothing matches as a prefix and no book resolved — hide suggestions.
        searchSuggestions.style.display = "none";
        return;
    }

    // If only the book is present (no numbers yet), suggest the book and a few chapter starters
    const maxCh = __bibleMeta.maxChapter.get(resolvedBook) || 150; // fallback generous upper bound
    if (!remainder) {
        // Suggest the book itself + first few chapters
        results.push({
            ref: resolvedBook,
            preview: "(book)",
            parsed: { book: resolvedBook, chapter: 1, verse: 1 }
        });
        for (let c = 1; c <= Math.min(5, maxCh); c++) {
            results.push({
                ref: `${resolvedBook} ${c}`,
                preview: "(chapter)",
                parsed: { book: resolvedBook, chapter: c, verse: 1 }
            });
        }
        return renderSuggestions(results);
    }

    // 3) CHAPTER / VERSE MODE for the resolved book
    // Accept patterns: "<chapter>", "<chapter>:", "<chapter>:<verse>"
    // Gracefully handle partials like "9:", "9:8", "09:008"
    const chapVerse = remainder.replace(/\s+/g, "");
    const m = chapVerse.match(/^(\d{1,3})(?::(\d{1,3}))?$/); // simple ranges are enough for Bible refs
    if (!m) {
        // If the remainder isn't a chapter/verse shape, stop suggesting.
        searchSuggestions.style.display = "none";
        return;
    }

    const chapter = Math.min(parseInt(m[1], 10), maxCh || 150);
    const verseKey = `${resolvedBook}|${chapter}`;
    const maxV = __bibleMeta.maxVerse.get(verseKey) || 176; // generous fallback (Ps 119)
    const hasColon = chapVerse.includes(":");
    const verse = m[2] ? Math.min(parseInt(m[2], 10), maxV) : null;

    if (!hasColon) {
        // User typed only chapter → suggest that chapter + a few verse starters
        results.push({
            ref: `${resolvedBook} ${chapter}`,
            preview: "(chapter)",
            parsed: { book: resolvedBook, chapter, verse: 1 }
        });
        for (let v = 1; v <= Math.min(5, maxV); v++) {
            results.push({
                ref: `${resolvedBook} ${chapter}:${v}`,
                preview: "(verse)",
                parsed: { book: resolvedBook, chapter, verse: v }
            });
        }
        return renderSuggestions(results);
    }

    // User typed chapter: (maybe verse)
    if (verse == null) {
        // Show first few verses in that chapter
        for (let v = 1; v <= Math.min(10, maxV); v++) {
            results.push({
                ref: `${resolvedBook} ${chapter}:${v}`,
                preview: "(verse)",
                parsed: { book: resolvedBook, chapter, verse: v }
            });
        }
        return renderSuggestions(results);
    }

    // Full chapter:verse present → prioritize the exact match, then nearby verses
    results.push({
        ref: `${resolvedBook} ${chapter}:${verse}`,
        preview: "(reference)",
        parsed: { book: resolvedBook, chapter, verse }
    });
    // Add a couple neighbors for convenience
    if (verse > 1) {
        results.push({
            ref: `${resolvedBook} ${chapter}:${verse - 1}`,
            preview: "(nearby)",
            parsed: { book: resolvedBook, chapter, verse: verse - 1 }
        });
    }
    if (verse < maxV) {
        results.push({
            ref: `${resolvedBook} ${chapter}:${verse + 1}`,
            preview: "(nearby)",
            parsed: { book: resolvedBook, chapter, verse: verse + 1 }
        });
    }

    renderSuggestions(results);

    // --- helper that renders & wires clicks ---
    function renderSuggestions(items) {
        if (!items.length) { searchSuggestions.style.display = "none"; return; }
        searchSuggestions.innerHTML = items.slice(0, 15).map(r =>
            `<div class="suggestion" data-book="${r.parsed.book}" data-chapter="${r.parsed.chapter}" data-verse="${r.parsed.verse}">
         <strong>${r.ref}</strong><small>${r.preview}</small>
       </div>`
        ).join("");
        searchSuggestions.style.display = "block";

        searchSuggestions.querySelectorAll('.suggestion').forEach(el => {
            el.addEventListener('click', () => {
                const b = el.dataset.book, c = +el.dataset.chapter, v = +el.dataset.verse;
                showVerse({ book: b, chapter: c, verse: v });
                searchSuggestions.style.display = "none";
                searchInput.value = "";
            });
        });
    }
}

searchInput.addEventListener("keydown", e => {
    if (e.key === "Tab") {
        const first = searchSuggestions.querySelector(".suggestion");
        if (first) {
            e.preventDefault(); // stop Tab from changing focus

            const book = first.dataset.book;
            const chapter = +first.dataset.chapter;
            const verse = +first.dataset.verse;

            let suggestionText;

            // ✅ If it's a "book only" suggestion (chapter = 1, verse = 1 but preview was "(book)")
            if ((chapter === 1 && verse === 1) && first.querySelector("small")?.innerText.includes("(book)")) {
                suggestionText = book;   // only paste book name
            } else if (chapter && !verse) {
                suggestionText = `${book} ${chapter}`;   // book + chapter only
            } else if (chapter && verse) {
                suggestionText = `${book} ${chapter}:${verse}`;  // full reference
            } else {
                suggestionText = book;   // fallback
            }

            // Paste into the input
            searchInput.value = suggestionText;

            // Trigger fresh suggestions for the completed text
            updateSuggestions(suggestionText);
        }
    }
});



searchInput.addEventListener('input', e => updateSuggestions(e.target.value.trim()));

searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const first = searchSuggestions.querySelector('.suggestion');
        if (first) first.click();
    } else if (e.key === 'Escape') {
        searchSuggestions.style.display = "none";
    }
});

function refreshSearchIndex() { buildSearchIndex(); }

/* ========= Recording visual state ========= */
function setRecordingState(isRecording) {
    if (!startStopBtn) return;

    if (isRecording) {
        startStopBtn.classList.add('recording');
        startStopBtn.setAttribute('aria-pressed', 'true');
        startStopBtn.textContent = 'Stop';
        startStopBtn.title = 'Recording — click to stop';

        if (verseRecBtn) {
            verseRecBtn.classList.add('rec');
            verseRecBtn.setAttribute('aria-hidden', 'false');
            verseRecBtn.removeAttribute('hidden');
            verseRecBtn.style.display = 'inline-flex';
            verseRecBtn.title = 'Recording';
        }
    } else {
        startStopBtn.classList.remove('recording');
        startStopBtn.setAttribute('aria-pressed', 'false');
        startStopBtn.textContent = 'Start';
        startStopBtn.title = 'Not recording — click to start';

        if (verseRecBtn) {
            verseRecBtn.classList.remove('rec');
            verseRecBtn.setAttribute('aria-hidden', 'true');
            verseRecBtn.setAttribute('hidden', '');
            verseRecBtn.style.display = 'none';
            verseRecBtn.title = '';
        }
    }
}

/* ========= SpeechRecognition wiring (same behavior, but UI via setRecordingState) ========= */
if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
    log('SpeechRecognition not available.');
    if (startStopBtn) startStopBtn.disabled = true;
} else {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SpeechRecognition();
    recog.lang = 'en-US';
    recog.interimResults = true;
    recog.continuous = true;
    recog.maxAlternatives = 1;
    let listening = false;

    startStopBtn.addEventListener('click', () => {
        try {
            if (!listening) {
                recog.start();
                listening = true;
                log('Listening…');
                setRecordingState(true);
            } else {
                recog.stop();
            }
        } catch (err) { console.error(err); }
    });

    recog.onresult = async (ev) => {
        let interim = '', final = '';
        for (let i = ev.resultIndex; i < ev.results.length; ++i) {
            const r = ev.results[i];
            if (r.isFinal) final += r[0].transcript + ' ';
            else interim += r[0].transcript + ' ';
        }
        transcriptEl.innerText = (interim ? ('Interim: ' + interim + '\n') : '') + (final ? ('Final: ' + final) : '');
        const stable = final.trim();
        if (stable) {
            const parsed = parseReference(stable);
            if (parsed) { await showVerse(parsed); }
            else { log('Input to Parse:' + stable + ':Could not parse reference from final transcript.'); }
        }
    };

    recog.onend = () => {
        listening = false;
        setRecordingState(false);
        log('Recognition ended.');
    };
    recog.onerror = (e) => {
        listening = false;
        setRecordingState(false);
        log('SpeechRecognition error: ' + (e && e.error ? e.error : JSON.stringify(e)));
        console.warn('SpeechRecognition error', e);
    };
}

/* Keyboard nav */
document.addEventListener('keydown', (ev) => {
    if (isTypingInInput()) return;
    if (ev.key === "ArrowLeft" && currentRef && currentRef.verse > 1) showVerse({ ...currentRef, verse: currentRef.verse - 1 });
    if (ev.key === "ArrowRight" && currentRef) showVerse({ ...currentRef, verse: currentRef.verse + 1 });
});

(function () {
    let lastToggle = 0; const DEBOUNCE_MS = 400;
    function tryToggleFromEvent(ev) {
        const now = Date.now(); if (now - lastToggle < DEBOUNCE_MS) return; lastToggle = now;
        const btn = document.getElementById('startStopBtn'); if (!btn || btn.disabled) return; btn.click();
    }
    document.addEventListener('keydown', (ev) => {
        try {
            if (isTypingInInput()) return;
            if (ev.key === 'm') { ev.preventDefault?.(); tryToggleFromEvent(ev); return; }
            if (ev.metaKey && (ev.code === 'Space' || ev.key.toLowerCase() === 'm')) { ev.preventDefault?.(); tryToggleFromEvent(ev); return; }
            if (ev.ctrlKey && ev.altKey && ev.key.toLowerCase() === 'm') { ev.preventDefault?.(); tryToggleFromEvent(ev); return; }
        } catch (err) { console.warn('Meta key toggle error', err); }
    }, { passive: false });
})();

/* Toggle language on "E" keypress (ignore when typing in inputs/textareas/contenteditable) */
document.addEventListener('keydown', (ev) => {
    if (isTypingInInput()) return;
    const active = document.activeElement;
    const tag = active && active.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (active && active.isContentEditable)) return;
    try {
        if (ev.key && ev.key.toLowerCase() === 'e') {
            ev.preventDefault();
            if (langBtn) langBtn.click();
        }
    } catch (err) {
        console.warn('Language toggle key handler error', err);
    }
});

/* ========= Preload English & Malayalam from Firebase ========= */
async function preloadBothXml() {
    log('Loading Bible data from Firebase...');
    const [enParsed, mlParsed] = await Promise.all([
        fetchBibleFromFirebase('english'),
        fetchBibleFromFirebase('malayalam')
    ]);
    if (enParsed) {
        assignParsedToLang(enParsed, 'EN');
        console.log('✅ English loaded from Firebase — books:', Object.keys(englishXML.data).length);
    }
    else
        console.log('⚠️ English not available from Firebase.');
    if (mlParsed) {
        assignParsedToLang(mlParsed, 'ML');
        console.log('✅ Malayalam loaded from Firebase — books:', Object.keys(malayalamXML.data).length);
    }
    else
        console.log('⚠️ Malayalam not available from Firebase.');

    if (englishXML && englishXML.data) {
        currentLanguage = 'EN';
        bibleData = englishXML.data;
        bibleBookNames = englishXML.bookNames;
        bibleEnglishToKeyMap = englishXML.englishToKeyMap;
        refreshSearchIndex();
        langBtn && (langBtn.innerText = 'EN / ML');
        log('Defaulting to English XML.');
    } else if (malayalamXML && malayalamXML.data) {
        currentLanguage = 'ML';
        bibleData = malayalamXML.data;
        bibleBookNames = malayalamXML.bookNames;
        bibleEnglishToKeyMap = malayalamXML.englishToKeyMap;
        refreshSearchIndex();
        langBtn && (langBtn.innerText = 'ML / EN');
        log('Defaulting to Malayalam XML.');
    } else {
        log('Could not load Bible data from Firebase.');
    }

    if (currentRef) showVerse(currentRef);
    else if (currentLanguage === 'EN') showVerse({ book: "Genesis", chapter: 1, verse: 1 });
    else if (currentLanguage === 'ML') {
        if (bibleEnglishToKeyMap && bibleEnglishToKeyMap['genesis']) {
            const xmlKey = bibleEnglishToKeyMap['genesis'];
            if (bibleData && bibleData[xmlKey] && bibleData[xmlKey]['1'] && bibleData[xmlKey]['1']['1']) {
                verseRefEl.innerText = `${xmlKey} 1:1`;
                verseBodyEl.innerText = bibleData[xmlKey]['1']['1'];
                verseBodyEl.style.fontSize = baseFontSize + 'px';
            }
        }
    }
}


window.addEventListener('beforeinstallprompt', (e) => {
  // Stop Chrome from showing its mini-infobar
  e.preventDefault();
  deferredPrompt = e;
  // Reveal your install button
  const btn = document.getElementById('installBtn');
  if (btn) btn.hidden = false;
});

document.getElementById('installBtn')?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();                // Show the browser install prompt
  const { outcome } = await deferredPrompt.userChoice;
  // You can track 'accepted' or 'dismissed' here
  deferredPrompt = null;                  // Must be used once
  document.getElementById('installBtn').hidden = true;
});

// Optional: detect if already installed (hide the button)
window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
  if (e.matches) document.getElementById('installBtn').hidden = true;
});


/* Language toggle */
langBtn.addEventListener('click', async () => {
    if (currentLanguage === 'EN') document.body.setAttribute("data-language", "ML");
    else document.body.setAttribute("data-language", "EN");

    if (currentLanguage === 'EN') {
        if (malayalamXML && malayalamXML.data) {
            currentLanguage = 'ML';
            bibleData = malayalamXML.data;
            bibleBookNames = malayalamXML.bookNames;
            bibleEnglishToKeyMap = malayalamXML.englishToKeyMap;
            refreshSearchIndex();
            langBtn.innerText = 'ML / EN';
            log('Language switched to Malayalam.');
            if (currentRef) showVerse(currentRef);
        } else {
            log('Loading Malayalam from Firebase...');
            const mlParsed = await fetchBibleFromFirebase('malayalam');
            if (mlParsed) {
                assignParsedToLang(mlParsed, 'ML');
                currentLanguage = 'ML';
                bibleData = malayalamXML.data;
                bibleBookNames = malayalamXML.bookNames;
                bibleEnglishToKeyMap = malayalamXML.englishToKeyMap;
                refreshSearchIndex();
                langBtn.innerText = 'ML / EN';
                log('Malayalam loaded from Firebase.');
                if (currentRef) showVerse(currentRef);
            } else {
                log('Could not load Malayalam from Firebase.');
                document.body.setAttribute("data-language", "EN");
            }
        }
    } else {
        if (englishXML && englishXML.data) {
            currentLanguage = 'EN';
            bibleData = englishXML.data;
            bibleBookNames = englishXML.bookNames;
            bibleEnglishToKeyMap = englishXML.englishToKeyMap;
            refreshSearchIndex();
            langBtn.innerText = 'EN / ML';
            log('Language switched to English (in-memory).');
            if (currentRef) showVerse(currentRef);
        } else {
            log('Loading English from Firebase...');
            const enParsed = await fetchBibleFromFirebase('english');
            if (enParsed) {
                assignParsedToLang(enParsed, 'EN');
                currentLanguage = 'EN';
                bibleData = englishXML.data;
                bibleBookNames = englishXML.bookNames;
                bibleEnglishToKeyMap = englishXML.englishToKeyMap;
                refreshSearchIndex();
                langBtn.innerText = 'EN / ML';
                log('English loaded from Firebase.');
                if (currentRef) showVerse(currentRef);
            } else {
                log('Could not load English from Firebase.');
                document.body.setAttribute("data-language", "ML");
            }
        }
    }
});

// Register the service worker for PWA features
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        // Optional: listen for updates
        if (reg.waiting) {
          // A new SW is waiting to activate
          console.log('Update ready. It will take over on next reload.');
        }
        reg.addEventListener('updatefound', () => {
          console.log('Downloading a new version …');
        });
      })
      .catch(err => console.error('SW registration failed:', err));
  });
}


/* ========= Responsive font: update from CSS unless user adjusted ========= */
function refreshFontSizeFromCssIfAllowed() {
    if (userAdjustedFont) return;
    const fs = readComputedVerseFontSize();
    baseFontSize = fs;
    verseBodyEl.style.fontSize = baseFontSize + 'px';
}

let _resizeTimer = null;
window.addEventListener('resize', () => {
    if (_resizeTimer) clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => { refreshFontSizeFromCssIfAllowed(); }, 120);
});

/* Debounced init to let fonts load before measurement */
window.addEventListener('load', () => {
    setTimeout(() => {
        refreshFontSizeFromCssIfAllowed();
    }, 120);
});

/* ========= Init handled by fbAuth.onAuthStateChanged ========= */
