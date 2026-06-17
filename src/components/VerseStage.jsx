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
    isSongMode,
    onSaveSong,
    songSaving,
    songHasEdits,
    mediaUrl,
    mediaHtml,
    bgImageUrl,
    bgImageOpacity,
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

  // In fullscreen: solid background so it covers the page behind it (important for CSS fallback on mobile)
  const bg = isFullscreen
    ? isDark ? 'bg-slate-950' : 'bg-white'
    : isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50/80 border-slate-200/80'

  const stageBase = [
    'relative flex items-start justify-center',
    'mt-4 sm:mt-6 rounded-2xl border',
    'px-4 py-6 sm:px-8 sm:py-10',
    'text-center transition-colors duration-300',
    bg,
    isFullscreen ? 'verse-stage-fullscreen' : '',
  ].join(' ')

  return (
    <div ref={forwardedRef} className={stageBase} style={{ position: 'relative' }}>
      {/* Background image overlay */}
      {bgImageUrl && (
        <img
          src={bgImageUrl}
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: bgImageOpacity ?? 0.2,
            pointerEvents: 'none',
            borderRadius: 'inherit',
            zIndex: 0,
          }}
        />
      )}
      {/* All visible content above the bg image */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>

      {/* Recording pill */}
      {isRecording && (
        <div className="absolute top-3 right-14 sm:top-4 sm:right-16 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-xs font-semibold rec-pulse select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          REC
        </div>
      )}

      {/* Song save button — only shown after an edit */}
      {isSongMode && songHasEdits && (
        <button
          onClick={onSaveSong}
          disabled={songSaving}
          title="Save lyrics to Firebase Storage"
          className={`
            absolute top-3 left-3 sm:top-4 sm:left-4 px-2.5 py-1 rounded-lg text-xs font-semibold
            transition-all duration-150
            ${songSaving
              ? isDark ? 'bg-amber-600/40 text-amber-300 cursor-wait' : 'bg-amber-100 text-amber-600 cursor-wait'
              : isDark ? 'bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            }
          `}
        >
          {songSaving ? 'Saving…' : 'Save'}
        </button>
      )}

      {/* Fullscreen toggle */}
      <button
        onClick={onToggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
        className={`
          absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-lg text-base leading-none
          transition-all duration-150
          ${isDark
            ? 'text-slate-500 hover:text-amber-300 hover:bg-white/5'
            : 'text-slate-400 hover:text-amber-600 hover:bg-black/5'
          }
        `}
      >
        {isFullscreen ? '⤡' : '⤢'}
      </button>

      {/* Content */}
      {mediaUrl ? (
        <img
          src={mediaUrl}
          alt="Media slide"
          style={{ maxWidth: '100%', maxHeight: isFullscreen ? '100vh' : '70vh', objectFit: 'contain', display: 'block', margin: '0 auto' }}
        />
      ) : mediaHtml ? (
        <div
          className={`leading-relaxed font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
          style={{ fontSize: fontSize + 'px', lineHeight: 1.55, width: '100%' }}
          dangerouslySetInnerHTML={{ __html: mediaHtml }}
        />
      ) : (
      <div className="w-full">
        {/* Reference label */}
        <div
          className={`font-verse font-extrabold underline underline-offset-4 mb-4 sm:mb-5 tracking-wide ${
            isDark ? 'text-amber-300' : 'text-blue-800'
          }`}
          style={{ fontSize: Math.max(20, fontSize * 1.15) + 'px' }}
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
            leading-relaxed outline-none cursor-text rounded px-1 font-bold
            ${isMalayalam ? 'font-malayalam' : 'font-verse'}
            ${isDark ? 'text-slate-100' : 'text-slate-800'}
          `}
          style={{ fontSize: fontSize + 'px', lineHeight: 1.55 }}
        />
      </div>
      )}

      </div>{/* end z-index wrapper */}
    </div>
  )
})
