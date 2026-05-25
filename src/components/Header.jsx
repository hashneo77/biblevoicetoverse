import { SearchBox } from './SearchBox'

export function Header({
  isDark,
  isListening,
  speechSupported,
  onToggleSpeech,
  onPrev,
  onNext,
  displayMode,
  onSetMode,
  onDecreaseFontSize,
  onIncreaseFontSize,
  onToggleTheme,
  onToggleFullscreen,
  bookAliases,
  bibleMeta,
  onSelectVerse,
  onAiSearch,
  aiLoading,
  onSignOut,
}) {
  const btnBase = `
    inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium
    transition-all duration-150 select-none
  `
  const ghostBtn = `${btnBase} ${
    isDark
      ? 'text-slate-300 hover:text-amber-300 hover:bg-white/[0.06] border border-transparent hover:border-white/10'
      : 'text-slate-600 hover:text-amber-600 hover:bg-black/[0.05] border border-transparent hover:border-black/10'
  }`
  const primaryBtn = `${btnBase} font-semibold ${
    isDark
      ? 'bg-white/[0.07] border border-white/10 text-amber-300 hover:bg-white/[0.12]'
      : 'bg-black/[0.05] border border-black/10 text-amber-600 hover:bg-black/[0.09]'
  }`
  const recBtn = `${btnBase} font-semibold border ${
    isListening
      ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/30'
      : isDark
      ? 'bg-white/[0.07] border-white/10 text-amber-300 hover:bg-amber-400/10 hover:border-amber-400/20'
      : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
  }`

  return (
    <header className={`sticky top-0 z-40 px-3 py-2.5 rounded-2xl border mb-2 backdrop-blur-md flex flex-wrap items-center gap-2 ${
      isDark
        ? 'bg-slate-900/85 border-white/[0.07]'
        : 'bg-white/90 border-slate-200/80 shadow-sm'
    }`}>

      {/* Mic / Start-Stop */}
      <button onClick={onToggleSpeech} disabled={!speechSupported} className={recBtn} title={isListening ? 'Stop (M)' : 'Start voice (M)'}>
        <MicIcon active={isListening} />
        <span className="ml-1.5 hidden sm:inline">{isListening ? 'Stop' : 'Start'}</span>
      </button>

      {/* Prev / Next */}
      <button onClick={onPrev} className={ghostBtn} title="Previous verse (←)">◀</button>
      <button onClick={onNext} className={ghostBtn} title="Next verse (→)">▶</button>

      {/* Language mode selector */}
      <div className={`flex rounded-xl border overflow-hidden ${isDark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-slate-100/60'}`}>
        {['EN', 'ML'].map(mode => (
          <button
            key={mode}
            onClick={() => onSetMode(mode)}
            className={`px-3 py-1.5 text-xs font-bold transition-colors duration-150 ${
              displayMode === mode
                ? isDark
                  ? 'bg-white/12 text-amber-300'
                  : 'bg-white text-amber-600 shadow-sm'
                : isDark
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Font size */}
      <button onClick={onDecreaseFontSize} className={ghostBtn} title="Decrease font (A-)">A<sup>−</sup></button>
      <button onClick={onIncreaseFontSize} className={primaryBtn} title="Increase font (A+)">A<sup>+</sup></button>

      {/* Fullscreen */}
      <button onClick={onToggleFullscreen} className={ghostBtn} title="Fullscreen (F)">⤢</button>

      {/* Theme toggle */}
      <button onClick={onToggleTheme} className={ghostBtn} title="Toggle theme">
        {isDark ? '☀️' : '🌙'}
      </button>

      {/* Search — pushed right on wider screens */}
      <div className="flex-1 flex justify-end min-w-0">
        <SearchBox
          bookAliases={bookAliases}
          bibleMeta={bibleMeta}
          onSelect={onSelectVerse}
          onAiSearch={onAiSearch}
          aiLoading={aiLoading}
          isDark={isDark}
        />
      </div>

      {/* Sign out */}
      <button
        onClick={onSignOut}
        className={`text-xs px-3 py-1.5 rounded-lg border transition-all duration-150 ${
          isDark
            ? 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20 hover:bg-white/5'
            : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        Sign out
      </button>
    </header>
  )
}

function MicIcon({ active }) {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path strokeLinecap="round" d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="17" x2="12" y2="21" strokeLinecap="round" />
      <line x1="8" y1="21" x2="16" y2="21" strokeLinecap="round" />
    </svg>
  )
}
