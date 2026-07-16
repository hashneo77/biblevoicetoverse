# Bible Voice to Verse — Complete Project Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Technology Stack](#technology-stack)
4. [Repository Structure](#repository-structure)
5. [Application Components](#application-components)
   - [Main Web App (Presentation Screen)](#main-web-app-presentation-screen)
   - [Remote Control App](#remote-control-app)
   - [Cloud Functions (Backend)](#cloud-functions-backend)
6. [Firebase Infrastructure](#firebase-infrastructure)
7. [Data Model](#data-model)
8. [Feature Breakdown](#feature-breakdown)
   - [Bible Verse Display](#bible-verse-display)
   - [Bilingual Support (English & Malayalam)](#bilingual-support-english--malayalam)
   - [Voice Recognition](#voice-recognition)
   - [AI-Powered Search](#ai-powered-search)
   - [Song/Lyrics System](#songllyrics-system)
   - [Catechism of the Catholic Church (CCC)](#catechism-of-the-catholic-church-ccc)
   - [Media Projection](#media-projection)
   - [Holy Mass Section](#holy-mass-section)
   - [Remote Control System](#remote-control-system)
   - [Multi-Session Support](#multi-session-support)
   - [Fullscreen Presentation Mode](#fullscreen-presentation-mode)
   - [Recent Verses Tracking](#recent-verses-tracking)
   - [Theme System](#theme-system)
   - [Background Image Overlay](#background-image-overlay)
   - [Progressive Web App (PWA)](#progressive-web-app-pwa)
9. [Utility Modules](#utility-modules)
10. [Scripts & Data Pipeline](#scripts--data-pipeline)
11. [Build & Deployment](#build--deployment)
12. [Real-Time Communication Flow](#real-time-communication-flow)
13. [Authentication & Sessions](#authentication--sessions)
14. [Keyboard Shortcuts](#keyboard-shortcuts)
15. [Font & Typography System](#font--typography-system)
16. [Security Considerations](#security-considerations)

---

## Project Overview

**Bible Voice to Verse** is a full-featured, bilingual (English and Malayalam) Bible presentation system designed for use in Catholic church services, prayer meetings, and Bible study sessions. It consists of two tightly coupled web applications:

1. **Main App** — a presentation-grade display that shows Bible verses, CCC paragraphs, song lyrics, and media on a projector or large screen.
2. **Remote App** — a mobile-first control panel that lets a speaker or operator browse, search, and project content from their phone in real time.

The two apps communicate through **Firebase Realtime Database**, enabling instant, sub-second synchronization without any direct network connection between devices. An operator on their phone taps a verse number, and it appears on the projection screen immediately.

The system also features **AI-powered semantic search** (via Google Gemini), **voice-to-verse recognition** (via the Web Speech API + AI fallback), a **song lyrics projection system** with 7,687 Malayalam Christian songs, the full **Catechism of the Catholic Church** (2,865 paragraphs), and a **media/image projection** system.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Firebase Cloud                       │
│                                                     │
│  ┌──────────────┐  ┌────────────┐  ┌─────────────┐ │
│  │  Realtime DB  │  │  Storage   │  │  Functions  │ │
│  │              │  │            │  │  (Gemini AI) │ │
│  │ english/     │  │ lyrics-    │  │             │ │
│  │ malayalam/   │  │   text/    │  │ searchVerses│ │
│  │ ccc/         │  │ media/     │  │ searchSongs │ │
│  │ remote/      │  │ holy-mass/ │  │ parseVoiceRef│ │
│  │ session2/    │  │            │  │             │ │
│  │ config/      │  │            │  │             │ │
│  └──────┬───────┘  └──────┬─────┘  └──────┬──────┘ │
│         │                 │               │         │
└─────────┼─────────────────┼───────────────┼─────────┘
          │                 │               │
    ┌─────┴─────┐     ┌────┴────┐    ┌─────┴─────┐
    │ Real-time │     │  File   │    │  HTTPS    │
    │ listeners │     │ storage │    │ callable  │
    └─────┬─────┘     └────┬────┘    └─────┬─────┘
          │                │               │
  ┌───────┴────────────────┴───────────────┴──────┐
  │                                                │
  │   ┌──────────────────┐  ┌───────────────────┐  │
  │   │   Main Web App   │  │  Remote Control   │  │
  │   │  (Projector)     │  │  App (Phone)      │  │
  │   │                  │  │                   │  │
  │   │  React + Vite    │  │  React + Vite     │  │
  │   │  Tailwind CSS    │  │  Custom CSS       │  │
  │   │  Port: /         │  │  Port: /remote/   │  │
  │   └──────────────────┘  └───────────────────┘  │
  │                                                │
  │          Firebase Hosting (dist/)              │
  └────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Version / Notes |
|-------|-----------|-----------------|
| **Frontend Framework** | React | 19.x (main app), 19.2.x (remote) |
| **Build Tool** | Vite | 6.x (main), 8.x (remote) |
| **Styling** | Tailwind CSS (main app), Custom CSS (remote app) | Tailwind 3.4.x |
| **Backend / BaaS** | Firebase | Realtime Database, Cloud Functions v2, Storage, Hosting |
| **AI / LLM** | Google Gemini (via `@google/generative-ai`) | gemini-2.5-flash model |
| **Speech Recognition** | Web Speech API | Browser-native, with AI fallback |
| **Runtime** | Node.js 20 | Cloud Functions runtime |
| **Fonts** | Google Fonts | Inter, Lora, Noto Serif Malayalam |
| **PWA** | Service Worker + Web App Manifest | Offline caching |

---

## Repository Structure

```
biblevoicetoverse/
├── index.html                  # Main app HTML entry point
├── package.json                # Main app dependencies
├── vite.config.js              # Main app Vite config
├── tailwind.config.js          # Tailwind CSS configuration
├── postcss.config.js           # PostCSS config (Tailwind)
├── firebase.json               # Firebase project configuration
├── .firebaserc                 # Firebase project alias
├── database.rules.json         # Realtime Database security rules
├── storage.rules               # Cloud Storage security rules
├── cors.json                   # CORS configuration for Storage
│
├── src/                        # ─── MAIN WEB APP SOURCE ───
│   ├── main.jsx                # React entry point
│   ├── App.jsx                 # Root component (auth, theme, routing)
│   ├── firebase.js             # Firebase SDK initialization
│   ├── index.css               # Global styles + Tailwind directives
│   │
│   ├── components/
│   │   ├── MainApp.jsx         # Core application logic (~1045 lines)
│   │   ├── Header.jsx          # Sticky toolbar (controls + search)
│   │   ├── SearchBox.jsx       # Autocomplete search with AI mode
│   │   ├── VerseStage.jsx      # Verse/lyrics/media display area
│   │   ├── RecentVerses.jsx    # Recent verses pill list
│   │   └── LoginPage.jsx       # PIN-based authentication
│   │
│   ├── hooks/
│   │   └── useSpeechRecognition.js  # Web Speech API hook
│   │
│   └── utils/
│       ├── parseReference.js   # Bible reference parser + autocomplete
│       ├── tfidf.js            # Client-side TF-IDF search engine
│       ├── parseLyrics.js      # Song lyrics file parser/serializer
│       └── transliterate.js    # Malayalam → Roman transliteration
│
├── remote/                     # ─── REMOTE CONTROL APP ───
│   ├── index.html              # Remote app HTML entry
│   ├── package.json            # Separate dependency set
│   ├── vite.config.js          # Builds to dist/remote/
│   └── src/
│       ├── main.jsx            # React entry
│       ├── App.jsx             # Full remote app (~1646 lines)
│       ├── App.css             # Custom CSS (no Tailwind)
│       └── firebase.js         # Firebase init (shared config)
│
├── functions/                  # ─── CLOUD FUNCTIONS ───
│   ├── index.js                # 3 Gemini-powered callable functions
│   ├── package.json            # Node 20 runtime
│   └── models.json             # Gemini model catalog reference
│
├── public/                     # ─── STATIC ASSETS ───
│   ├── book_aliases.json       # Voice/text → canonical book name map
│   ├── songs-manifest.json     # Pre-built song index (~7,687 songs)
│   ├── manifest.webmanifest    # PWA manifest
│   ├── sw.js                   # Service worker
│   ├── logo.png                # App logo
│   ├── icons/                  # PWA icons (192px, 512px)
│   ├── holymass/               # Holy Mass page images (544 PNGs)
│   ├── lyrics-text/            # Song lyric files (7,687 .txt files)
│   └── songs/                  # Additional song assets
│
├── scripts/                    # ─── DATA SCRIPTS ───
│   ├── generate-songs-manifest.js  # Build songs-manifest.json
│   ├── create-english-songs.mjs    # Create English song files
│   ├── upload-lyrics-to-storage.mjs # Upload lyrics to Firebase Storage
│   ├── upload-holymass.mjs         # Upload Holy Mass images
│   ├── uploadCCC.cjs               # Upload CCC data
│   ├── upload-maccabees*.mjs       # Upload Maccabees books
│   └── maccabees.json              # Maccabees source data
│
├── english_bible.json          # English Bible source (JSON)
├── English_Catholic_XML.xml    # English Catholic Bible (XML source)
├── malayalam_bible.json        # Malayalam Bible source (JSON)
├── malayalam_bible.xml         # Malayalam Bible (XML source)
└── xml_to_firebase_json.py     # Python converter: XML → Firebase JSON
```

---

## Application Components

### Main Web App (Presentation Screen)

The main app is designed to run on a projector-connected computer or a large display. It is a single-page React application.

#### Component Hierarchy

```
App.jsx
├── LoginPage          (PIN entry → session auth)
└── MainApp            (core application)
    ├── Header         (sticky toolbar)
    │   └── SearchBox  (reference/AI/song search)
    ├── AI Results Panel (inline, collapsible)
    ├── Transcript Badge (voice recognition feedback)
    ├── VerseStage     (main content display area)
    ├── RecentVerses   (pill-style recent history)
    └── Status Line    (bottom status text)
```

#### `App.jsx` — Root Component
- Manages PIN-based authentication with 10-hour session expiry
- Stores auth state and session prefix in `localStorage`
- Manages dark/light theme at the `<html>` level via class toggling
- Routes between `LoginPage` and `MainApp`

#### `MainApp.jsx` — Application Core (~1,045 lines)
This is the heart of the application, managing:

- **Bible data loading** — Fetches English and Malayalam Bibles from Firebase RTDB on mount, normalizing the nested `bookKey/chapters/chN/verse` structure into a flat lookup-friendly format
- **Verse display** — The `showVerse()` function resolves a `{book, chapter, verse}` reference against the active language store, with cross-language fallback
- **Real-time Firebase listeners** — 9 separate `onValue` listeners for:
  - `currentVerse` — verse selections from remote
  - `settings` — language, theme, font size, navigation, fullscreen commands
  - `cccParagraph` — CCC paragraph selections from remote
  - `currentSong` — song slide selections from remote
  - `currentMedia` — media (image/text) from remote
  - `bgImage` — background image overlay settings
  - `songSearchQuery` / `songSearchResults` — song search relay
  - `searchQuery` / `searchResults` — verse search relay
  - `recentItems` — shared recent history
  - `liveSlide` — current active slide tracking
- **Song system** — Loads lyrics from Firebase Storage, parses into slides, supports slide-by-slide navigation and inline editing with save-back
- **AI search orchestration** — Calls `searchVerses` and `searchSongs` Cloud Functions
- **Voice recognition integration** — Pipes speech transcripts through local parser first, then AI fallback
- **Navigation** — Previous/next verse or slide with keyboard and remote support
- **Verse editing** — Content-editable verse text with debounced save-back to Firebase
- **Range collapsing** — Sequential verse navigation collapses into ranges in recent history (e.g., "John 3:16-20" instead of five separate entries)

#### `Header.jsx` — Toolbar
Sticky header with all controls in a responsive flex layout:
- Microphone toggle (voice recognition)
- Previous/Next navigation arrows
- Language mode selector (EN/ML toggle)
- Font size controls (A- / A+)
- Fullscreen toggle
- Theme toggle (sun/moon)
- SearchBox (right-aligned on desktop, full-width row on mobile)

#### `SearchBox.jsx` — Multi-Mode Search
Three distinct search modes, toggled via small buttons:

1. **Reference mode** (default) — Type "John 3:16" or "CCC 15" and get instant autocomplete suggestions from the loaded Bible data. Supports progressive narrowing: book → chapter → verse.
2. **AI mode** (purple glow) — Type a semantic query like "forgiveness" or "hope after loss" and press Enter. Calls the `searchVerses` Cloud Function which uses Gemini to find relevant verses.
3. **Song mode** (green glow) — Type a song title for instant filtering, or type Manglish lyrics and press Enter for AI-powered lyric search via `searchSongs`.

#### `VerseStage.jsx` — Display Area
A large, centered content display with:
- **Reference label** — Bold, underlined, glow-effect heading (e.g., "John 3:16")
- **Verse body** — `contentEditable` div for inline editing with auto-save
- **Media display** — Full image display or rich HTML text overlay
- **Background image** — Optional background with configurable opacity
- **Fullscreen support** — CSS-based fullscreen (works on iOS Safari) with native Fullscreen API where available
- **Song mode** — When in song mode, shows lyrics text and a Save button for edits
- Uses `forwardRef` for fullscreen targeting

#### `RecentVerses.jsx` — History List
- Pill-style buttons showing recently visited verses and CCC paragraphs
- Differentiated styling: amber for Bible verses, sky-blue for CCC entries
- "Copy today's session" — copies all today's references to clipboard in bilingual format (e.g., "Genesis 3:8 / ഉല്പത്തി 3:8")
- Clear button with double-click confirmation
- Synced via Firebase (shared between main app and remote)

#### `LoginPage.jsx` — PIN Authentication
- 6-digit PIN entry with individual digit inputs
- Auto-advance on digit entry, backspace navigation
- Paste support for full PIN
- PIN verified against `config/sessions` in Firebase (with hardcoded fallback)
- Each PIN maps to a Firebase path prefix (session namespace)
- Shake animation on wrong PIN
- Dark theme with amber accents and app logo

---

### Remote Control App

The remote app (`/remote/`) is a separate React SPA optimized for mobile phone use. It's a self-contained application with its own `package.json` and Vite config that builds into `dist/remote/`.

#### Home Grid
The home screen presents a card grid with navigation tiles:
- **Old Testament** / **New Testament** — Bible book browser
- **CCC** — Catechism paragraph browser (range → paragraph picker)
- **Recent** — Recently sent items with re-send capability
- **AI Search** — Semantic verse search (calls Cloud Function directly)
- **Songs** — Song browser with title search + AI lyrics search
- **Media** — Image and rich-text slide library
- **Holy Mass** — Liturgical image sequence viewer
- **Settings** — Background image configuration

#### Bible Navigation Flow
```
Testament (OT/NT) → Book List → Chapter Grid → Verse Grid → Tap to Send
```
Each step fetches data lazily from Firebase REST API (`restFetch` with shallow queries for efficiency).

#### Floating Settings Bar
A persistent bottom bar with controls that affect the presentation screen:
- Previous / Next navigation (verses or Holy Mass images)
- "Locate" button — jumps to the currently projected slide
- Fullscreen toggle (sends command to main app)
- Language toggle (EN/ML)
- Font size controls (A- / A+)
- Theme toggle (dark/light)

#### Songs View
- Instant title filtering from the manifest
- AI-powered Manglish lyrics search via `searchSongs` Cloud Function
- Song slide picker with voice badge indicators (M/F/A for Male/Female/All)
- Active slide highlighting (green glow on currently projected slide)
- Duplicate slide detection (×2 badge, ↩ repeat indicator)

#### Media View
- Image upload to Firebase Storage
- Rich-text slide editor with formatting toolbar (Bold, Italic, Underline, Alignment)
- Library grid showing uploaded media
- Send to screen / Delete / Set as Background controls
- Clear screen button

#### Holy Mass View
- Image upload and ordered display
- Sequential navigation (prev/next through page images)
- Active page highlighting with auto-scroll
- Delete individual pages

#### Active Slide Tracking
The remote listens to `liveSlide` in Firebase to know what's currently on screen:
- Green highlight on the active verse number in the verse grid
- Green highlight on the active song slide
- "Locate" button snaps the remote's view to match the current slide

---

### Cloud Functions (Backend)

Three Firebase Cloud Functions (v2, Node.js 20) powered by **Google Gemini 2.5 Flash**:

#### `searchVerses`
- **Purpose**: AI-powered semantic Bible verse search
- **Input**: `{ query, bookNames, includeCCC? }`
- **Model**: Gemini 2.5 Flash (thinking budget: 0, temperature: 0.1)
- **Behavior**: Prompted as a "Catholic Bible scholar" with knowledge of all 73 books including deuterocanonical books. Returns up to 5-7 results as a JSON array with book, chapter, verse, and reason. Optionally includes CCC paragraph results.
- **Config**: `minInstances: 1` for warm starts

#### `searchSongs`
- **Purpose**: AI-powered Malayalam song search by title or Manglish lyrics
- **Input**: `{ query, songs }` (songs = array of `{filename, title}`)
- **Model**: Gemini 2.5 Flash (thinking budget: 0, temperature: 0)
- **Behavior**: Receives the full song catalog and user query. Understands English, Manglish, and thematic queries. Returns up to 5 matching filenames.

#### `parseVoiceRef`
- **Purpose**: AI fallback parser for voice-recognized text that couldn't be parsed locally
- **Input**: `{ transcript, bookNames }`
- **Model**: Gemini 2.5 Flash (thinking budget: 0, temperature: 0)
- **Behavior**: Extracts Bible book, chapter, and verse from speech transcripts in English, Malayalam, or Manglish. Maps Malayalam book names to English equivalents.

All functions use the `GEMINI_API_KEY` secret managed through Firebase.

---

## Firebase Infrastructure

### Project ID: `biblevoicetoverse`

### Realtime Database Structure

```
root/
├── english/              # English Catholic Bible (73 books)
│   ├── b1/
│   │   ├── name: "Genesis"
│   │   ├── shortName: "Gen"
│   │   └── chapters/
│   │       ├── ch1/
│   │       │   ├── 1: "In the beginning..."
│   │       │   ├── 2: "..."
│   │       │   └── ...
│   │       └── ch2/ ...
│   ├── b2/ ...
│   └── b73/
│
├── malayalam/            # Malayalam Catholic Bible
│   └── (same structure as english/)
│
├── ccc/                  # Catechism of the Catholic Church
│   ├── 1: "paragraph text..."
│   ├── 2: "..."
│   └── 2865: "..."
│
├── config/
│   └── sessions          # PIN → session prefix mapping
│       ├── "123456": "remote"
│       └── "654321": "session2"
│
├── remote/               # Session 1 namespace
│   ├── currentVerse      # { book, chapter, verse, timestamp }
│   ├── settings          # { language, theme, fontSizeCmd, nav, fullscreen }
│   ├── cccParagraph      # { paragraph, ts }
│   ├── currentSong       # { filename, slideIdx, ts }
│   ├── currentMedia      # { type, url/html/text, ts }
│   ├── bgImage           # { url, name, opacity, ts }
│   ├── liveSlide         # { type, [verse/song data], ts }
│   ├── recentItems/      # Push-key list of recent projections
│   ├── mediaLibrary/     # Push-key list of uploaded media items
│   ├── holyMassLibrary/  # Push-key list of Holy Mass images
│   ├── searchQuery       # { q, ts } — relay from remote
│   ├── searchResults     # { ts, results[] } — relay response
│   ├── songSearchQuery   # { q, ts }
│   └── songSearchResults # { ts, results[] }
│
├── session2/             # Session 2 namespace (same structure)
│   └── ...
│
└── $session/             # Wildcard rule for dynamic sessions
    └── ...
```

### Cloud Storage Structure

```
gs://biblevoicetoverse.firebasestorage.app/
├── lyrics-text/          # Song lyric .txt files
│   ├── 10000-reasons-bless-the-lord.txt
│   ├── aa-aa-ennu-kannum-yeshu-rajane.txt
│   └── ... (7,687 files)
├── media/                # User-uploaded media images
│   └── {timestamp}-{random}.{ext}
└── holy-mass/            # Holy Mass page images
    └── {timestamp}-{random}.{ext}
```

### Hosting

- Main app: served from `dist/` at root `/`
- Remote app: served from `dist/remote/` at `/remote/`
- Rewrite rules route `/remote` and `/remote/**` to `/remote/index.html`

---

## Data Model

### Bible Verse Reference
```javascript
{ book: "Genesis", chapter: 1, verse: 1 }
```

### CCC Reference
```javascript
{ ccc: 15 }  // Paragraph number
```

### Song Lyric File Format
```
Song Title Here
==================

M
Male voice lyrics line 1
Male voice lyrics line 2

F
Female voice lyrics line 1

A
All voices lyrics line 1
All voices lyrics line 2
```

Voice markers: `M` (Male), `F` (Female), `A` (All)

### Songs Manifest Entry
```javascript
{
  filename: "10000-reasons-bless-the-lord",
  title: "10000 Reasons Bless The Lord",
  voices: ["M", "F", "A", "M", ...],
  text: "first 300 chars of lyrics...",
  r: "romanized normalized text for search"
}
```

### Recent Verse Entry (Firebase)
```javascript
{
  key: "Genesis 3:8-12",       // Display label
  type: "bible",               // "bible" | "ccc" | "song"
  book: "Genesis",
  chapter: 3,
  verse: 8,
  endVerse: 12,                // Optional: range end
  text: "verse text...",
  ts: 1719100000000            // Timestamp
}
```

### Book Aliases Map
The `book_aliases.json` file maps hundreds of variations to canonical book names:
- Spoken forms: "one samuel" → "1 Samuel"
- Ordinal forms: "first kings" → "1 Kings"  
- Voice recognition errors: "relations" → "Galatians", "Indians" → "Corinthians"
- Short forms: "psalm" → "Psalms"
- Manglish forms and common misspellings

---

## Feature Breakdown

### Bible Verse Display

The main display pipeline:

1. **Input** — A `{book, chapter, verse}` reference from search, voice, remote, or recent list
2. **Resolution** — `lookupVerse()` tries:
   - Exact match in the active language store
   - Case-insensitive match
   - Prefix match
   - Cross-language fallback (if ML verse not found, try EN key mapping and vice versa)
3. **Display** — Verse text shown in `VerseStage` with appropriate font (Lora for English, Noto Serif Malayalam for Malayalam)
4. **Fallback** — If not found locally and in English mode, fetches from `bible-api.com` public API
5. **Editing** — Text is `contentEditable`; edits save back to Firebase RTDB after 1.2s debounce
6. **Live sync** — Writes to `liveSlide` so the remote knows what's on screen

### Bilingual Support (English & Malayalam)

- Full **73-book Catholic Bible** in both languages stored in Firebase RTDB
- Language toggle (EN/ML) in both main app and remote
- Malayalam text uses the **Noto Serif Malayalam** Google Font
- Book name mapping: a static `BOOK_NAME_ML` object in the remote maps all 73 English book names to their Malayalam equivalents
- Cross-language verse resolution: if a verse isn't found in the active language, the system looks it up in the alternate language using Firebase key mapping
- Bilingual clipboard copy: "Copy today's session" produces lines like `Genesis 3:8 / ഉല്പത്തി 3:8`
- Malayalam → Roman **transliteration** (`transliterate.js`) for Manglish search support

### Voice Recognition

The `useSpeechRecognition` hook wraps the Web Speech API:

1. **Browser support check** — `SpeechRecognition` or `webkitSpeechRecognition`
2. **Language switching** — Uses `ml-IN` locale when in Malayalam mode, `en-US` for English
3. **Continuous mode** — `continuous: true` with interim results shown in a transcript badge
4. **Processing pipeline**:
   - Final transcript → `parseReference()` (local, instant)
   - If local parse fails → `parseVoiceRef` Cloud Function (AI-powered)
5. **Transcript display** — Shows interim and final results in a monospace badge below the header

The local parser (`parseReference.js`):
- Normalizes spoken text: strips "chapter", "verse", collapses whitespace
- Matches against `book_aliases.json` with multi-word lookahead (up to 3 tokens)
- Converts word numbers ("three" → 3) for spoken references
- Supports colon notation (3:16) and space-separated (3 16)

### AI-Powered Search

Two-tier search architecture:

**Client-side TF-IDF** (`tfidf.js`):
- Pre-filters the English Bible with keyword matching
- Tokenizes and removes 100+ stopwords (including biblical terms like "thee", "thou", "hath")
- Scores by exact match (2 pts), partial match (0.5 pts), and multi-term bonus
- Returns top 40 candidates for the Cloud Function to re-rank

**Gemini AI Search** (`searchVerses` Cloud Function):
- Receives either a raw query or pre-filtered candidates
- Prompted as a "Catholic Bible scholar" aware of all 73 books
- Actively considers deuterocanonical books (Tobit, Judith, Wisdom, Sirach, Baruch, 1-2 Maccabees)
- Returns structured JSON with verse references and reasoning
- Optional CCC paragraph results when query mentions "ccc"

**Song AI Search** (`searchSongs`):
- Receives the full song catalog (titles + filenames)
- Understands Manglish (romanized Malayalam) queries
- Matches by title, lyric content, or thematic description

### Song/Lyrics System

A comprehensive church song projection system:

- **7,687 Malayalam Christian songs** stored as `.txt` files in Firebase Storage
- **Songs manifest** (`songs-manifest.json`) — Pre-built index with titles, voice markers, preview text, and romanized search text
- **Manifest generation** — `scripts/generate-songs-manifest.js` reads all `.txt` files, parses them, romanizes Malayalam text, and builds the JSON index
- **Lyrics format** — Title line, separator, then voice-labeled sections (M/F/A)
- **Slide-by-slide projection** — Each voice section is a "slide"; the remote shows a list of slides with voice badges
- **Inline editing** — Lyrics can be edited in the `VerseStage` and saved back to Firebase Storage
- **Search modes**:
  - Instant title filtering (client-side)
  - AI-powered Manglish lyrics search (Cloud Function)
  - Song search relay from remote to main app

### Catechism of the Catholic Church (CCC)

- All **2,865 paragraphs** of the CCC stored in Firebase RTDB under `/ccc/`
- **Navigation** in the remote: range picker (1-100, 101-200, ...) → individual paragraph numbers
- **Search integration**: SearchBox supports "CCC 15" or "CCC #15" syntax with autocomplete
- **AI search**: When query contains "ccc", the `searchVerses` function includes CCC paragraph results
- Displayed with sky-blue accent styling to distinguish from Bible verses

### Media Projection

The remote's Media section provides a general-purpose slide system:

- **Image upload** — Files uploaded to Firebase Storage `/media/`, metadata stored in RTDB `mediaLibrary`
- **Rich text slides** — WYSIWYG editor with `contentEditable` and formatting toolbar (Bold, Italic, Underline, Left/Center/Right alignment)
- **Send to screen** — Writes to `currentMedia` in RTDB; the main app renders either an `<img>` or formatted HTML
- **Clear screen** — Sends a `{ type: 'clear' }` event
- **Edit/Delete** — Text slides can be re-edited; images can be deleted (removes from both Storage and RTDB)

### Holy Mass Section

A dedicated view for liturgical services:

- **Image-based** — Upload page images (e.g., missal pages, hymn sheets)
- **Sequential navigation** — Previous/Next buttons step through pages in order
- **Active page tracking** — Green highlight on the current page, auto-scroll
- **544 pre-loaded Holy Mass pages** (PNG images in `public/holymass/`)
- Stored in Firebase Storage under `/holy-mass/`

### Remote Control System

The remote communicates with the main app entirely through Firebase RTDB:

| Remote Action | Firebase Path | Main App Response |
|---------------|--------------|-------------------|
| Select verse | `{P}/currentVerse` | Display verse |
| Select CCC paragraph | `{P}/cccParagraph` | Display CCC text |
| Select song slide | `{P}/currentSong` | Display lyrics slide |
| Send media | `{P}/currentMedia` | Display image/text |
| Change language | `{P}/settings/language` | Switch display language |
| Change theme | `{P}/settings/theme` | Toggle dark/light |
| Font size +/- | `{P}/settings/fontSizeCmd` | Adjust font size |
| Navigate prev/next | `{P}/settings/nav` | Move to adjacent verse/slide |
| Toggle fullscreen | `{P}/settings/fullscreen` | Enter/exit fullscreen |
| Set background | `{P}/bgImage` | Apply/remove background image |

All commands include timestamps to prevent stale replays (commands older than page load time are ignored).

### Multi-Session Support

The system supports multiple independent presentation sessions:

- **PIN-based session selection** — Different PINs map to different Firebase path prefixes
  - PIN `123456` → `remote/` namespace
  - PIN `654321` → `session2/` namespace
- **Session isolation** — Each session has its own verse selections, settings, media library, and recent history
- **Dynamic sessions** — The RTDB rules include a `$session` wildcard that permits any prefix
- **10-hour session expiry** — Both apps auto-expire sessions after 10 hours

### Fullscreen Presentation Mode

Two fullscreen implementations for maximum compatibility:

1. **Native Fullscreen API** — Used when available and triggered by user gesture
2. **CSS fullscreen fallback** — Fixed-position overlay covering the viewport; essential for:
   - iOS Safari (no native Fullscreen API)
   - Remote-triggered fullscreen (no local user gesture)

**Remote fullscreen flow**:
1. Remote sends fullscreen command via Firebase
2. Main app can't call `requestFullscreen()` (no user gesture)
3. Shows a tap-to-fullscreen prompt overlay
4. User at the screen taps → gesture triggers native fullscreen
5. Auto-dismiss after 5 seconds → falls back to CSS overlay

### Recent Verses Tracking

- Shared between main app and remote via `{P}/recentItems` in Firebase
- Displayed as pill-shaped buttons with amber (Bible) or sky-blue (CCC) styling
- **Range collapsing** — Sequential verse navigation (e.g., pressing Next 5 times) collapses into a single range entry like "John 3:16-20" instead of 5 separate entries
- **Copy today's session** — Copies all today's verse references to clipboard in bilingual format
- **Clear** — Double-click confirmation before clearing
- Songs are filtered out of the main app's recent list (song entries have `type: 'song'`)

### Theme System

- **Dark mode** (default): Slate/navy gradient background, amber accents, white text
- **Light mode**: White/slate background, amber/blue accents, dark text
- Theme state managed at the `<html>` element level via Tailwind's `dark` class
- Persisted in `localStorage` as `bv_theme`
- Controllable from the remote app

### Background Image Overlay

- Any image from the media library can be set as a background
- Rendered as an absolutely positioned `<img>` behind verse content
- **Opacity slider** (5%–80%) controllable from the remote's Settings view
- Stored in Firebase (`{P}/bgImage`) with URL, name, and opacity

### Progressive Web App (PWA)

- **Web App Manifest** (`manifest.webmanifest`) — standalone display mode, custom icons
- **Service Worker** (`sw.js`):
  - Pre-caches essential static assets
  - Network-first strategy for HTML pages
  - Cache-first strategy for static assets (CSS, JS, images)
  - Offline fallback page
- **Apple-specific** — `apple-mobile-web-app-capable` meta tag, touch icon

---

## Utility Modules

### `parseReference.js`
- `normalizeSpoken(s)` — Strips "chapter" and "verse" keywords, collapses whitespace
- `wordsToNumber(w)` — Converts "one" through "twelve" to numbers
- `parseReference(text, bookAliases)` — Multi-token matching against aliases, extracts chapter:verse
- `getSearchSuggestions(query, books, bibleMeta)` — Progressive autocomplete (book → chapter → verse)
- `getCCCSuggestions(query)` — CCC paragraph autocomplete for "ccc15" style queries

### `tfidf.js`
- `tokenize(text)` — Lowercases, strips non-alphanumeric, removes 100+ stopwords
- `tfidfSearch(bibleEN, query, topN)` — Searches the entire English Bible in-memory with term frequency scoring

### `parseLyrics.js`
- `parseLyrics(content)` — Parses a song file into `{ title, slides: [{voice, text}] }`
- `serializeLyrics(title, slides)` — Reconstructs the file format for saving edits

### `transliterate.js`
- `romanize(text)` — Full Malayalam-to-Roman transliteration supporting consonants, vowels, matras, virama, chillu letters, and special characters
- `normalizeSearch(s)` — Collapses doubled letters for fuzzy matching ("sneham" matches "sneeham")

---

## Scripts & Data Pipeline

### `generate-songs-manifest.js`
Reads all `.txt` files from `public/lyrics-text/`, parses each song, romanizes Malayalam text, and writes `public/songs-manifest.json`. Run via `npm run songs:manifest`.

### `xml_to_firebase_json.py`
Python script that converts XML Bible files into the Firebase-compatible JSON structure used by the RTDB.

### Upload Scripts
- `upload-lyrics-to-storage.mjs` — Bulk uploads lyric `.txt` files to Firebase Storage
- `upload-holymass.mjs` — Uploads Holy Mass page images
- `uploadCCC.cjs` — Uploads Catechism paragraphs to RTDB
- `upload-maccabees*.mjs` / `upload-1mac-all.mjs` / `upload-2mac-*.mjs` — Upload deuterocanonical books (1 & 2 Maccabees)
- `create-english-songs.mjs` — Creates English song lyric files

---

## Build & Deployment

### Development
```bash
npm run dev              # Start main app dev server (Vite)
cd remote && npm run dev # Start remote app dev server
```

### Production Build
```bash
npm run build   # Builds main app to dist/ AND remote app to dist/remote/
```

The `build` script chains: `vite build && cd remote && npm run build`

### Firebase Deploy
```bash
firebase deploy                    # Deploy everything
firebase deploy --only hosting     # Just the web apps
firebase deploy --only functions   # Just the Cloud Functions
firebase deploy --only database    # Just the RTDB rules
firebase deploy --only storage     # Just the Storage rules
```

### Manifest Regeneration
```bash
npm run songs:manifest   # Rebuild songs-manifest.json from lyrics-text/
```

---

## Real-Time Communication Flow

### Verse Selection (Remote → Main)

```
1. User taps verse 16 on remote (John 3:16)
2. Remote writes to Firebase:
   set(ref(db, 'remote/currentVerse'), {
     book: 'John', chapter: 3, verse: 16,
     timestamp: Date.now()
   })
3. Main app's onValue listener fires
4. Timestamp check: val.timestamp > PAGE_LOAD_TIME (prevents stale replays)
5. showVerse({ book: 'John', chapter: 3, verse: 16 })
6. Verse resolved from in-memory Bible store
7. Display updated in VerseStage
8. liveSlide written back for remote's active tracking
9. Recent item pushed to recentItems
```

### Settings Command (Remote → Main)

```
1. User taps font-size-up on remote
2. Remote writes: set(ref(db, 'remote/settings/fontSizeCmd'), { delta: 1, ts: Date.now() })
3. Main app's settings listener fires
4. Timestamp dedup check (ts > last seen ts)
5. Font size increased by ~12% (proportional scaling)
```

### AI Search (Either App → Cloud Function → Either App)

```
1. User types "forgiveness" in search box
2. App calls httpsCallable(functions, 'searchVerses')({ query: 'forgiveness', bookNames: [...] })
3. Cloud Function constructs Gemini prompt with Catholic scholar persona
4. Gemini returns JSON array of {book, chapter, verse, reason}
5. Function returns results to caller
6. App resolves verse text from local store and displays results panel
7. User taps a result → verse displayed on screen
```

---

## Authentication & Sessions

The app uses a lightweight PIN-based auth system (no Firebase Auth):

1. User enters a 6-digit PIN on the login page
2. PIN is checked against `config/sessions` in Firebase RTDB
3. If valid, the corresponding session prefix is stored in `localStorage`:
   - `bv_auth` / `bv_remote_session` — auth flag
   - `bv_auth_ts` / `bv_remote_session_ts` — login timestamp
   - `bv_session_prefix` / `bv_remote_session` — session namespace
4. Sessions expire after **10 hours** (automatic timeout + periodic check)
5. Each session namespace is isolated — different PINs control different presentation screens

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` Arrow Left | Previous verse / slide |
| `→` Arrow Right | Next verse / slide |
| `F` | Toggle fullscreen |
| `M` | Toggle microphone (voice recognition) |
| `E` | Toggle language (EN ↔ ML) |

Shortcuts are disabled when focus is in an input, textarea, or contenteditable element.

---

## Font & Typography System

Three font families loaded from Google Fonts:

| Font | Usage | Tailwind Class |
|------|-------|---------------|
| **Inter** (300–700) | UI text, labels, buttons | `font-sans` (default) |
| **Lora** (400–600, italic) | English verse display | `font-verse` |
| **Noto Serif Malayalam** (400–600) | Malayalam verse display | `font-malayalam` |

Font size is dynamic and controllable:
- Default: 44px
- Range: 12px – 160px
- Scaling: ~12% per step (proportional, not fixed increment)
- Responsive: `min(Xpx, 9vw)` ensures text fits on small screens

---

## Security Considerations

### Current State
- **No Firebase Auth** — PIN-based system with client-readable session config
- **Open RTDB rules** — Read/write access on most paths (suitable for private/trusted environments)
- **Open Storage rules** — All paths allow public read/write
- **API key exposed in client** — Firebase API key in source (standard for Firebase web apps; security enforced by rules, not key secrecy)
- **Gemini API key** — Stored as a Firebase secret, never exposed to clients

### Design Intent
This is a **church-internal tool** designed for trusted environments where convenience and zero-friction operation during services outweigh enterprise security requirements. The PIN system prevents casual unauthorized access while keeping the UX simple enough for non-technical church volunteers to operate.
