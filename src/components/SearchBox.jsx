import { useState, useRef, useEffect, useMemo } from 'react'
import { getSearchSuggestions, getCCCSuggestions } from '../utils/parseReference'

export function SearchBox({ bookAliases, bibleMeta, onSelect, onAiSearch, aiLoading, isDark }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [aiMode, setAiMode] = useState(false)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const books = useMemo(() => {
    const aliases = bookAliases || {}
    return Object.keys(aliases).length > 0 ? [...new Set(Object.values(aliases))] : []
  }, [bookAliases])

  const isCCCQuery = useMemo(() => query.trim().toLowerCase().startsWith('ccc'), [query])

  const suggestions = useMemo(() => {
    if (aiMode || !query) return []
    if (isCCCQuery) return getCCCSuggestions(query)
    return getSearchSuggestions(query, books, bibleMeta)
  }, [query, books, bibleMeta, aiMode, isCCCQuery])

  useEffect(() => {
    setOpen(!aiMode && suggestions.length > 0 && query.length > 0)
    setActiveIdx(0)
  }, [suggestions, query, aiMode])

  const handleSelect = (s) => {
    if (s.ccc) {
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
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions[activeIdx]) handleSelect(suggestions[activeIdx])
    } else if (e.key === 'Tab') {
      if (suggestions[activeIdx]) { e.preventDefault(); setQuery(suggestions[activeIdx].ref + ' ') }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const toggleAiMode = () => {
    setAiMode(m => !m)
    setQuery('')
    setOpen(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const ringColor = aiMode
    ? isDark ? 'border-purple-500/70 ring-purple-500/20' : 'border-purple-400 ring-purple-400/30'
    : isDark ? 'focus-within:border-amber-400/60 focus-within:ring-amber-400/20' : 'focus-within:border-amber-400 focus-within:ring-amber-400/30'

  return (
    <div className="relative w-full">
      <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all duration-150 focus-within:ring-1 w-full ${
        isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-300'
      } ${ringColor}`}>
        {/* Search icon */}
        <SearchIcon isDark={isDark} />

        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onFocus={() => { if (!aiMode && suggestions.length > 0) setOpen(true) }}
          placeholder={aiMode ? 'Search by meaning…' : isCCCQuery ? 'CCC #15…' : 'John 3:16 or CCC 15…'}
          autoComplete="off"
          spellCheck={false}
          className={`flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400 ${
            isDark ? 'text-slate-100' : 'text-slate-900'
          }`}
        />

        {/* AI loading spinner */}
        {aiLoading && (
          <span className={`w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0 ${
            isDark ? 'border-purple-400' : 'border-purple-500'
          }`} />
        )}

        {/* AI toggle button */}
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
          {suggestions.slice(0, 15).map((s, i) => (
            <button
              key={s.ref}
              onMouseDown={() => handleSelect(s)}
              className={`w-full text-left px-4 py-2.5 flex items-baseline gap-2 transition-colors ${
                i === activeIdx
                  ? isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
                  : isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className={`font-medium text-sm ${
                s.ccc
                  ? isDark ? 'text-sky-300' : 'text-sky-600'
                  : ''
              }`}>{s.ref}</span>
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{s.preview}</span>
            </button>
          ))}
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
