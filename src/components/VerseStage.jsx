import { forwardRef, useRef, useEffect } from 'react'
import { EventFrame } from './EventFrame'

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
    massRole,   // Holy Mass slide: speaker label, e.g. 'കാർമി.' / 'C.'
    massNote,   // Holy Mass slide: pink heading / rubric shown above the words
    isMassMode,
    theme,        // colour theme from themes.js: bg, text, ref, role, glow
    eventFrame,   // { enabled, title, subtitle, verse, verseRef, footer } — event branding frame
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
    <div ref={forwardedRef} className={stageBase} style={{ position: 'relative', ...(theme ? { background: theme.bg } : {}) }}>
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
      {eventFrame?.enabled && <EventFrame frame={eventFrame} isDark={isDark} />}
      {/* All visible content above the bg image (inset from the event frame when it's on) */}
      <div data-event-frame-on={eventFrame?.enabled ? '' : undefined} style={{ position: 'relative', zIndex: 1, width: '100%',
        ...(eventFrame?.enabled ? { padding: 'clamp(48px, 7vw, 130px) clamp(12px, 2.5vw, 48px) clamp(34px, 4.5vw, 80px)' } : {}) }}>

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
          style={{
            fontSize: fontSize + 'px',
            lineHeight: 1.55,
            width: '100%',
            textShadow: isDark
              ? '0 0 10px rgba(255,255,255,0.15), 0 0 24px rgba(251,191,36,0.12), 0 2px 4px rgba(0,0,0,0.9)'
              : '0 0 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.12)',
            ...(theme ? { color: theme.text, textShadow: theme.glow } : {}),
          }}
          dangerouslySetInnerHTML={{ __html: mediaHtml }}
        />
      ) : (
      <div className="w-full">
        {/* Reference label (not shown for Holy Mass slides) */}
        {!isMassMode && <div
          className={`font-verse font-extrabold ${isMassMode ? '' : 'underline underline-offset-4'} mb-4 sm:mb-5 tracking-wide ${
            isDark ? 'text-amber-300' : 'text-blue-800'
          }`}
          style={{
            fontSize: isMassMode
              ? `min(${Math.max(16, fontSize * 0.55)}px, 5vw)`
              : `min(${Math.max(20, fontSize * 1.15)}px, 10vw)`,
            overflowWrap: 'anywhere',
            textShadow: isDark
              ? '0 0 8px rgba(251,191,36,0.4), 0 0 20px rgba(251,191,36,0.15), 0 1px 3px rgba(0,0,0,0.9)'
              : '0 0 6px rgba(37,99,235,0.25), 0 0 14px rgba(37,99,235,0.1), 0 1px 2px rgba(0,0,0,0.15)',
            ...(theme ? { color: theme.ref, textShadow: theme.refGlow } : {}),
          }}
        >
          {verseRef}
        </div>}

        {/* Holy Mass: who speaks, and the pink rubric/heading before the words */}
        {isMassMode && (massRole || massNote) && (
          <div className="mb-3 sm:mb-4">
            {massRole && (
              <div
                className={`font-extrabold ${displayMode === 'ML' ? 'font-malayalam' : 'font-verse'} ${isDark ? 'text-amber-300' : 'text-amber-700'}`}
                style={{ fontSize: `min(${Math.max(18, fontSize * 0.8)}px, 7vw)`, ...(theme ? { color: theme.role } : {}) }}
              >
                {massRole}
              </div>
            )}
            {massNote && (
              <div
                className={`italic whitespace-pre-line ${displayMode === 'ML' ? 'font-malayalam' : 'font-verse'} ${isDark ? 'text-pink-400' : 'text-pink-600'}`}
                style={{ fontSize: `min(${Math.max(14, fontSize * 0.5)}px, 4.5vw)`, lineHeight: 1.4 }}
              >
                {massNote}
              </div>
            )}
          </div>
        )}

        {/* Verse body — contenteditable (read-only for Holy Mass text) */}
        <div
          ref={bodyRef}
          data-verse-body
          contentEditable={!isMassMode}
          suppressContentEditableWarning
          spellCheck={false}
          onInput={e => onVerseEdit(e.currentTarget.innerText)}
          className={`
            leading-relaxed outline-none cursor-text rounded px-1 font-bold
            ${isMalayalam ? 'font-malayalam' : 'font-verse'}
            ${isDark ? 'text-slate-100' : 'text-slate-800'}
          `}
          style={{
            fontSize: `min(${fontSize}px, 9vw)`,
            lineHeight: 1.55,
            textShadow: isDark
              ? '0 0 10px rgba(255,255,255,0.15), 0 0 24px rgba(251,191,36,0.12), 0 2px 4px rgba(0,0,0,0.9)'
              : '0 0 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.12)',
            ...(theme ? { color: theme.text, textShadow: theme.glow } : {}),
          }}
        />
      </div>
      )}

      </div>{/* end z-index wrapper */}
    </div>
  )
})
