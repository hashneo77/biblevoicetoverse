export function RecentVerses({ verses, onSelect, isDark }) {
  if (!verses.length) return null

  return (
    <div className="mt-5 px-1">
      <p className={`text-[10px] font-semibold tracking-widest uppercase mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        Recent
      </p>
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
