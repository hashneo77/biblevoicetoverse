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

// A user with no frame yet starts empty
export const frameItems = (frame) => frame?.items || {}

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
