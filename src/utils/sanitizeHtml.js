// Text slides are stored as HTML from the remote's rich-text editor (bold, italic, underline,
// alignment). Session data is written by each signed-in user, and the owner can join any user's
// session, so the HTML is rebuilt from an allow-list before it is rendered: other tags, every
// attribute except a few style properties, and event handlers are dropped.
// Keep in sync with remote/src/sanitizeHtml.js.
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'P', 'SPAN'])
const ALLOWED_STYLES = ['text-align', 'font-weight', 'font-style', 'text-decoration-line']

function cleanNode(node, doc) {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent)
  if (node.nodeType !== Node.ELEMENT_NODE) return null
  const children = [...node.childNodes].map(c => cleanNode(c, doc)).filter(Boolean)
  if (!ALLOWED_TAGS.has(node.tagName)) {
    // Unknown wrapper (e.g. <font>): keep its text, drop the tag; script/style content is dropped
    if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return null
    const frag = doc.createDocumentFragment()
    children.forEach(c => frag.appendChild(c))
    return frag
  }
  const el = doc.createElement(node.tagName)
  for (const prop of ALLOWED_STYLES) {
    const value = node.style?.getPropertyValue(prop)
    if (value && /^[a-z -]+$/i.test(value)) el.style.setProperty(prop, value)
  }
  children.forEach(c => el.appendChild(c))
  return el
}

export function sanitizeHtml(html) {
  if (!html) return ''
  // DOMParser builds an inert document: nothing in it runs or loads while it is walked
  const parsed = new DOMParser().parseFromString(String(html), 'text/html')
  const out = document.createElement('div')
  ;[...parsed.body.childNodes].forEach(n => {
    const clean = cleanNode(n, document)
    if (clean) out.appendChild(clean)
  })
  return out.innerHTML
}
