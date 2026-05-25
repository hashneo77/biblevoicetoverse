import { forwardRef, useRef, useEffect } from 'react'

export const VerseStage = forwardRef(function VerseStage(
  {
    verseRef,
    verseText,
    displayMode,
    fontSize,
    isRecording,
    isFullscreen,
    onVerseEdit,
    onToggleFullscreen,
    isDark,
  },
  forwardedRef,
) {
  const bodyRef = useRef(null)

  // Sync text into contenteditable without resetting cursor
  useEffect(() => {
    const el = bodyRef.current
    if (!el || el === document.activeElement) return
    if (el.innerText !== verseText) el.innerText = verseText
  }, [verseText])

  const isMalayalam = displayMode === 'ML'

  const stageBase = `
    relative flex items-start justify-center
    mt-6 rounded-2xl border px-8 py-10 text-center
    transition-colors duration-300
    ${isDark
      ? 'bg-white/[0.02] border-white/[0.06]'
      : 'bg-slate-50/80 border-slate-200/80'
    }
    ${isFullscreen ? 'verse-stage-fullscreen' : ''}
  `

  return (
    <div ref={forwardedRef} className={stageBase}>
      {/* Recording pill */}
      {isRecording && (
        <div className="absolute top-4 right-16 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-xs font-semibold rec-pulse select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          REC
        </div>
      )}

      {/* Fullscreen toggle */}
      <button
        onClick={onToggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
        className={`
          absolute top-4 right-4 p-2 rounded-lg text-base leading-none transition-all duration-150
          ${isDark
            ? 'text-slate-500 hover:text-amber-300 hover:bg-white/5'
            : 'text-slate-400 hover:text-amber-600 hover:bg-black/5'
          }
        `}
      >
        {isFullscreen ? '⤡' : '⤢'}
      </button>

      {/* Content */}
      <div className="w-full">
        {/* Reference label */}
        <div
          className={`font-verse font-semibold mb-5 tracking-wide ${
            isDark ? 'text-amber-300' : 'text-amber-600'
          }`}
          style={{ fontSize: Math.max(18, fontSize * 0.52) + 'px' }}
        >
          {verseRef}
        </div>

        {/* Verse body — contenteditable */}
        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onInput={e => onVerseEdit(e.currentTarget.innerText)}
          className={`
            leading-relaxed outline-none cursor-text rounded px-1
            ${isMalayalam ? 'font-malayalam' : 'font-verse'}
            ${isDark ? 'text-slate-100' : 'text-slate-800'}
          `}
          style={{ fontSize: fontSize + 'px', lineHeight: 1.55 }}
        />
      </div>
    </div>
  )
})
