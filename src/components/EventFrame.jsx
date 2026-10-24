// Event frame: a border plus movable text and logo items with an event's branding, drawn over
// the verse stage so people watching the screen can see it belongs to the event.
// Edited by the owner in the remote (Settings → Event frame), stored at `${P}/eventFrame`:
//   { enabled, border, items: { id: { type: 'text'|'image', text, url, x, y, size, font, color, style } } }
// x / y are the item's centre as % of the stage; size is in % of the stage width (cqw), so the
// layout is identical on the projector and in the remote's preview.
// NOTE: remote/src/EventFrame.jsx is a copy of this file — keep the two in sync.

export const FRAME_FONTS = {
  script: { label: 'Script', css: "'Kaushan Script', cursive", weight: 400 },
  bold: { label: 'Bold', css: "Inter, system-ui, sans-serif", weight: 800 },
  caps: { label: 'Small caps', css: "Inter, system-ui, sans-serif", weight: 600, caps: true },
  normal: { label: 'Normal', css: "Inter, system-ui, sans-serif", weight: 500 },
  malayalam: { label: 'Malayalam', css: "'Noto Serif Malayalam', serif", weight: 600 },
}

// The Encounter layout, also used to turn the earlier text-only settings into items
export function defaultFrameItems(legacy = {}) {
  const t = (k, d) => (legacy[k] !== undefined ? legacy[k] : d)
  const items = {
    title: { type: 'text', text: t('title', 'Encounter'), x: 15, y: 9, size: 3.6, font: 'script', color: '#e0245e' },
    subtitle: { type: 'text', text: t('subtitle', 'Youth & Young Couples Convention'), x: 15, y: 16, size: 1.0, font: 'caps', color: '' },
    verse: { type: 'text', text: t('verse', 'അങ്ങയുടെ സന്നിധിയിൽ ആനന്ദത്തിന്റെ പൂർണതയുണ്ട്'), x: 76, y: 8, size: 1.1, font: 'malayalam', color: '' },
    verseRef: { type: 'text', text: t('verseRef', 'സങ്കീർത്തനങ്ങൾ 16:11'), x: 76, y: 13, size: 0.9, font: 'malayalam', color: '#d4a017' },
    footer: { type: 'text', text: t('footer', 'Divine Retreat Centre UK  ·  Hesed  ·  27–29 October 2026  ·  10 am – 4 pm'), x: 50, y: 95, size: 1.1, font: 'bold', color: '#ffffff', style: 'ribbon' },
  }
  Object.keys(items).forEach(k => { if (!items[k].text) delete items[k] })
  return items
}

export const frameItems = (frame) => frame?.items || defaultFrameItems(frame || {})

export function EventFrame({ frame, isDark, selectedId, onItemPointerDown }) {
  const items = frameItems(frame)
  const auto = isDark ? '#fdf6e3' : '#1e2a78'
  const editing = !!onItemPointerDown
  return (
    <div aria-hidden={!editing} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, containerType: 'size', overflow: 'hidden' }}>
      {frame?.border !== false && (
        <>
          <div style={{
            position: 'absolute', inset: '0.9cqw', border: '0.15cqw solid rgba(212,160,23,0.75)', borderRadius: '1.2cqw',
            boxShadow: 'inset 0 0 3cqw rgba(224,36,94,0.18), 0 0 1.2cqw rgba(212,160,23,0.25)',
          }} />
          {['tl', 'tr', 'bl', 'br'].map(c => (
            <div key={c} style={{
              position: 'absolute', width: '3cqw', height: '3cqw',
              [c[0] === 't' ? 'top' : 'bottom']: '0.5cqw', [c[1] === 'l' ? 'left' : 'right']: '0.5cqw',
              borderColor: '#e0245e', borderStyle: 'solid', borderWidth: 0, borderRadius: '0.4cqw',
              [`border${c[0] === 't' ? 'Top' : 'Bottom'}Width`]: '0.3cqw',
              [`border${c[1] === 'l' ? 'Left' : 'Right'}Width`]: '0.3cqw',
            }} />
          ))}
        </>
      )}
      {Object.entries(items).map(([id, it]) => {
        const base = {
          position: 'absolute', left: `${it.x}%`, top: `${it.y}%`, transform: 'translate(-50%, -50%)',
          pointerEvents: editing ? 'auto' : 'none', cursor: editing ? 'move' : 'default', touchAction: 'none',
          outline: editing && selectedId === id ? '2px dashed #38bdf8' : 'none', outlineOffset: 4, userSelect: 'none',
        }
        const down = editing ? (e) => onItemPointerDown(id, e) : undefined
        if (it.type === 'image') {
          return it.url
            ? <img key={id} src={it.url} alt="" draggable={false} onPointerDown={down} style={{ ...base, width: `${it.size}cqw`, height: 'auto' }} />
            : null
        }
        const f = FRAME_FONTS[it.font] || FRAME_FONTS.normal
        const ribbon = it.style === 'ribbon'
        return (
          <div key={id} onPointerDown={down} style={{
            ...base,
            fontFamily: f.css, fontWeight: f.weight, fontSize: `${it.size}cqw`, lineHeight: 1.2,
            color: it.color || auto, whiteSpace: 'pre', textAlign: 'center',
            ...(f.caps ? { textTransform: 'uppercase', letterSpacing: '0.12em' } : {}),
            ...(it.font === 'script' ? { textShadow: isDark ? '0 0.15cqw 0.5cqw rgba(0,0,0,0.8)' : '0 0.1cqw 0.2cqw rgba(0,0,0,0.15)' } : {}),
            ...(ribbon ? {
              padding: '0.5cqw 2cqw', borderRadius: '99cqw', letterSpacing: '0.04em',
              background: 'linear-gradient(90deg, #e0245e, #9b1d4f 45%, #1e2a78)',
              boxShadow: '0 -0.15cqw 1cqw rgba(0,0,0,0.35)',
            } : {}),
          }}>{it.text}</div>
        )
      })}
    </div>
  )
}
