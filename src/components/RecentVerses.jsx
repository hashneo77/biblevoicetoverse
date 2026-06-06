import { useState } from 'react'

export function RecentVerses({ verses, onSelect, onClear, isDark }) {
  const [copied, setCopied] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)

  if (!verses.length) return null

  const todayLabel = new Date().toDateString()
  const todays = verses.filter(item => item.ts && new Date(item.ts).toDateString() === todayLabel)

  const copyToday = async () => {
    const text = todays.map(item => item.key).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable */ }
  }

  const handleClearClick = () => {
    if (!confirmingClear) {
      setConfirmingClear(true)
      setTimeout(() => setConfirmingClear(false), 3000)
      return
    }
    setConfirmingClear(false)
    onClear?.()
  }

  return (
    <div className="mt-5 px-1">
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className={`text-[10px] font-semibold tracking-widest uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Recent
        </p>
        <div className="flex items-center gap-1.5">
          {todays.length > 0 && (
            <button
              onClick={copyToday}
              title="Copy today's session verse references to clipboard"
              className={`text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-all duration-150 ${
                copied
                  ? isDark
                    ? 'bg-emerald-900/25 text-emerald-300 border-emerald-700/40'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : isDark
                  ? 'text-slate-400 border-white/10 hover:text-amber-300 hover:border-white/20 hover:bg-white/5'
                  : 'text-slate-500 border-slate-200 hover:text-amber-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {copied ? '✓ Copied' : `Copy today’s session (${todays.length})`}
            </button>
          )}
          <button
            onClick={handleClearClick}
            title={confirmingClear ? 'Click again to confirm' : 'Clear recent verses and start fresh'}
            className={`text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-all duration-150 ${
              confirmingClear
                ? isDark
                  ? 'bg-red-900/30 text-red-300 border-red-700/40'
                  : 'bg-red-50 text-red-700 border-red-200'
                : isDark
                ? 'text-slate-400 border-white/10 hover:text-red-300 hover:border-white/20 hover:bg-white/5'
                : 'text-slate-500 border-slate-200 hover:text-red-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {confirmingClear ? 'Confirm clear?' : 'Clear'}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {verses.map(item => {
          const isCcc = !!item.ref?.ccc
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.ref)}
              className={`
                text-xs px-3 py-1.5 rounded-full font-medium border transition-all duration-150
                ${isCcc
                  ? isDark
                    ? 'bg-sky-900/20 text-sky-300 border-sky-700/30 hover:bg-sky-800/35 hover:border-sky-600/40'
                    : 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100 hover:border-sky-300'
                  : isDark
                  ? 'bg-amber-900/20 text-amber-300 border-amber-700/30 hover:bg-amber-800/35 hover:border-amber-600/40'
                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-300'
                }
              `}
            >
              {item.key}
            </button>
          )
        })}
      </div>
    </div>
  )
}
