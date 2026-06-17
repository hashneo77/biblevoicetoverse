import { useState, useRef, useEffect, useMemo } from 'react'
import { getSearchSuggestions, getCCCSuggestions } from '../utils/parseReference'

export function SearchBox({ bookAliases, bibleMeta, onSelect, onAiSearch, aiLoading, isDark, songs, onSelectSong, onSongAiSearch, songAiLoading }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [aiMode, setAiMode] = useState(false)
  const [songMode, setSongMode] = useState(false)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const books = useMemo(() => {
    const aliases = bookAliases || {}
    return Object.keys(aliases).length > 0 ? [...new Set(Object.values(aliases))] : []
  }, [bookAliases])

  const isCCCQuery = useMemo(() => query.trim().toLowerCase().startsWith('ccc'), [query])

  const bibleSuggestions = useMemo(() => {
    if (aiMode || songMode || !query) return []
    if (isCCCQuery) return getCCCSuggestions(query)
    return getSearchSuggestions(query, books, bibleMeta)
  }, [query, books, bibleMeta, aiMode, songMode, isCCCQuery])

  // Instant title-only match (no transliteration needed — titles are already romanized)
  const songTitleSuggestions = useMemo(() => {
    if (!songMode || !query || !songs?.length) return []
    const q = query.toLowerCase()
    return songs.filter(s => s.title.toLowerCase().includes(q)).slice(0, 12)
  }, [query, songs, songMode])

  const suggestions = songMode ? songTitleSuggestions : bibleSuggestions

  useEffect(() => {
    setOpen(!aiMode && suggestions.length > 0 && query.length > 0)
    setActiveIdx(0)
  }, [suggestions, query, aiMode])

  const handleSelect = (s) => {
    if (songMode) {
      onSelectSong?.(s.filename)
    } else if (s.ccc) {
      onSelect({ ccc: s.ccc })
    } else if (s.parsed) {
      onSelect(s.parsed)
    }
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  const handleKeyDown = (e) => {
    if (aiMode) {
      if (e.key === 'Enter' && query.trim()) {
        e.preventDefault()
        onAiSearch?.(query.trim())
        setQuery('')
      }
      return
    }
    if (songMode) {
      if (e.key === 'Enter' && query.trim()) {
        e.preventDefault()
        onSongAiSearch?.(query.trim())
        setOpen(false)
      }
      return
    }
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions[activeIdx]) handleSelect(suggestions[activeIdx])
    } else if (e.key === 'Tab') {
      if (!songMode && suggestions[activeIdx]) { e.preventDefault(); setQuery(suggestions[activeIdx].ref + ' ') }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const toggleAiMode = () => {
    setAiMode(m => !m); setSongMode(false); setQuery(''); setOpen(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const toggleSongMode = () => {
    setSongMode(m => !m); setAiMode(false); setQuery(''); setOpen(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const ringColor = aiMode
    ? isDark ? 'border-purple-500/70 ring-purple-500/20' : 'border-purple-400 ring-purple-400/30'
    : songMode
    ? isDark ? 'border-emerald-500/70 ring-emerald-500/20' : 'border-emerald-400 ring-emerald-400/30'
    : isDark ? 'focus-within:border-amber-400/60 focus-within:ring-amber-400/20' : 'focus-within:border-amber-400 focus-within:ring-amber-400/30'

  const placeholder = aiMode
    ? 'Search by meaning…'
    : songMode
    ? 'Song title… or type lyrics → Enter for AI'
    : isCCCQuery ? 'CCC #15…' : 'John 3:16 or CCC 15…'

  return (
    <div className="relative w-full">
      <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all duration-150 focus-within:ring-1 w-full ${
        isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-300'
      } ${ringColor}`}>
        <SearchIcon isDark={isDark} />

        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onFocus={() => { if (!aiMode && !songMode && suggestions.length > 0) setOpen(true) }}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className={`flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400 ${
            isDark ? 'text-slate-100' : 'text-slate-900'
          }`}
        />

        {(aiLoading || (songMode && songAiLoading)) && (
          <span className={`w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0 ${
            songMode && songAiLoading
              ? isDark ? 'border-emerald-400' : 'border-emerald-500'
              : isDark ? 'border-purple-400' : 'border-purple-500'
          }`} />
        )}

        {/* Song toggle */}
        {songs?.length > 0 && (
          <button
            onMouseDown={e => { e.preventDefault(); toggleSongMode() }}
            title={songMode ? 'Switch to verse search' : 'Search songs'}
            style={songMode ? { boxShadow: '0 0 8px 2px rgba(16,185,129,0.45), 0 0 2px 1px rgba(16,185,129,0.7)' } : {}}
            className={`flex-shrink-0 text-[13px] px-1.5 py-0.5 rounded-md border transition-all duration-200 ${
              songMode
                ? isDark
                  ? 'text-emerald-300 bg-emerald-500/20 border-emerald-400/70 hover:bg-emerald-500/30'
                  : 'text-emerald-700 bg-emerald-100 border-emerald-400 hover:bg-emerald-200'
                : isDark
                ? 'text-slate-500 border-slate-600 hover:text-emerald-400 hover:border-emerald-500/60 hover:bg-emerald-500/10'
                : 'text-slate-400 border-slate-300 hover:text-emerald-500 hover:border-emerald-400 hover:bg-emerald-50'
            }`}
          >
            ♪
          </button>
        )}

        {/* AI toggle */}
        <button
          onMouseDown={e => { e.preventDefault(); toggleAiMode() }}
          title={aiMode ? 'Switch to reference search' : 'Switch to AI semantic search'}
          style={aiMode ? { boxShadow: '0 0 8px 2px rgba(168,85,247,0.55), 0 0 2px 1px rgba(168,85,247,0.8)' } : {}}
          className={`flex-shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-md border transition-all duration-200 ${
            aiMode
              ? isDark
                ? 'text-purple-300 bg-purple-500/20 border-purple-400/70 hover:bg-purple-500/30'
                : 'text-purple-700 bg-purple-100 border-purple-400 hover:bg-purple-200'
              : isDark
              ? 'text-slate-500 border-slate-600 hover:text-purple-400 hover:border-purple-500/60 hover:bg-purple-500/10'
              : 'text-slate-400 border-slate-300 hover:text-purple-500 hover:border-purple-400 hover:bg-purple-50'
          }`}
        >
          AI
        </button>
      </div>

      {/* Autocomplete dropdown */}
      {open && (
        <div
          ref={listRef}
          className={`absolute top-full mt-1.5 left-0 right-0 z-50 rounded-xl border shadow-2xl overflow-hidden max-h-72 overflow-y-auto suggestions-scroll ${
            isDark ? 'bg-slate-900 border-slate-700/60 shadow-black/60' : 'bg-white border-slate-200 shadow-slate-200/80'
          }`}
        >
          {songMode
            ? songTitleSuggestions.map((s, i) => (
                <button
                  key={s.filename}
                  onMouseDown={() => handleSelect(s)}
                  className={`w-full text-left px-4 py-2.5 flex flex-col gap-0.5 transition-colors border-b last:border-b-0 ${
                    i === activeIdx
                      ? isDark ? 'bg-emerald-500/15 border-emerald-500/10' : 'bg-emerald-50 border-emerald-100'
                      : isDark ? 'border-white/[0.04] hover:bg-slate-800' : 'border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <span className={`text-sm font-medium ${
                    i === activeIdx ? isDark ? 'text-emerald-300' : 'text-emerald-700' : isDark ? 'text-slate-200' : 'text-slate-700'
                  }`}>{s.title}</span>
                  {s.voices?.length > 0 && (
                    <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {s.voices.length} slides · {s.voices.slice(0, 6).join(' ')}{s.voices.length > 6 ? '…' : ''}
                    </span>
                  )}
                </button>
              ))
            : suggestions.slice(0, 15).map((s, i) => (
                <button
                  key={s.ref}
                  onMouseDown={() => handleSelect(s)}
                  className={`w-full text-left px-4 py-2.5 flex items-baseline gap-2 transition-colors ${
                    i === activeIdx
                      ? isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
                      : isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className={`font-medium text-sm ${s.ccc ? isDark ? 'text-sky-300' : 'text-sky-600' : ''}`}>{s.ref}</span>
                  <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{s.preview}</span>
                </button>
              ))
          }
        </div>
      )}
    </div>
  )
}

function SearchIcon({ isDark }) {
  return (
    <svg className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
    </svg>
  )
}
