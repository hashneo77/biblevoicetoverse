export function parseLyrics(content) {
  const lines = content.split(/\r?\n/)
  const title = lines[0]?.trim() || ''
  const slides = []
  let current = null

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (trimmed === 'M' || trimmed === 'F' || trimmed === 'A') {
      if (current) {
        const text = current.text.trimEnd()
        if (text) slides.push({ voice: current.voice, text })
      }
      current = { voice: trimmed, text: '' }
    } else if (current) {
      current.text += line + '\n'
    }
  }
  if (current) {
    const text = current.text.trimEnd()
    if (text) slides.push({ voice: current.voice, text })
  }

  return { title, slides }
}

export function serializeLyrics(title, slides) {
  let content = `${title}\n==================\n`
  for (const slide of slides) {
    content += `\n${slide.voice}\n${slide.text}\n`
  }
  return content
}
