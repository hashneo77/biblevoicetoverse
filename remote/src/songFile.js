// Song text as edited on the "Add song" review screen: a marker line (M, F or A) starts a slide,
// the lines under it are that slide's lines. The same checks run again in the saveSong function
// (functions/songs.js validateSong) — keep the two in sync.

export const ML_RE = /[ഀ-ൿ]/;

export function parseBody(text) {
  const slides = [];
  let cur = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const t = raw.trim();
    if (t === 'M' || t === 'F' || t === 'A') { cur = { voice: t, lines: [] }; slides.push(cur); }
    else if (t && cur) cur.lines.push(t);
  }
  return slides.filter(s => s.lines.length);
}

export const slidesToBody = (slides) => (slides || []).map(s => `${s.voice}\n${s.lines.join('\n')}`).join('\n\n');

// List of problems; empty when the song can be saved
export function validateSong({ title, english, ml, en }) {
  const errs = [];
  if (!String(title || '').trim()) errs.push('The title is empty.');
  if (!ml.length) errs.push('There are no slides.');
  if (english) return errs;
  ml.forEach((s, i) => { if (!s.lines.some(l => ML_RE.test(l))) errs.push(`Malayalam slide ${i + 1} has no Malayalam text.`); });
  if (en.some(s => s.lines.some(l => ML_RE.test(l)))) errs.push('The Manglish text contains Malayalam letters.');
  if (ml.length !== en.length) errs.push(`Slide count differs: Malayalam ${ml.length}, Manglish ${en.length}.`);
  else ml.forEach((s, i) => {
    if (s.voice !== en[i].voice) errs.push(`Slide ${i + 1}: voice ${s.voice} in Malayalam but ${en[i].voice} in Manglish.`);
    if (s.lines.length !== en[i].lines.length) errs.push(`Slide ${i + 1}: ${s.lines.length} lines in Malayalam but ${en[i].lines.length} in Manglish.`);
  });
  return errs;
}

// ── Reading the operator's files in the browser ───────────────────────────────────────────

// An image file or canvas → { mimeType, data (base64) }, scaled to at most 1600 px on the long side
async function toJpeg(source, maxSide = 1600) {
  const bmp = source instanceof HTMLCanvasElement ? source : await createImageBitmap(source);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return { mimeType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.85).split(',')[1] };
}

export const imagesToPayload = (files) => Promise.all([...files].slice(0, 8).map(f => toJpeg(f)));

// Legacy Malayalam fonts (ML-TT, Karthika…) extract as Latin letters mixed with symbols
// ("Bm{Xn hN´p"); a scanned PDF has no text at all. Either way the pages must be read as images.
function looksGarbled(text) {
  const letters = text.replace(/\s/g, '');
  if (letters.length < 20) return true;
  const ml = (text.match(/[ഀ-ൿ]/g) || []).length;
  if (ml / letters.length > 0.3) return false;
  const words = text.split(/\s+/).filter(w => w.length > 1);
  const odd = words.filter(w => /[{}[\]\\|`~^@#$%&*<>=+_´¨¯]|[a-z][A-Z]/.test(w)).length;
  return odd / Math.max(words.length, 1) > 0.2;
}

// A PDF → { text } from its text layer, or { images } (first 6 pages) when that text is unusable
export async function pdfToPayload(file, { forceImages = false } = {}) {
  const pdfjs = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  try {
    if (!forceImages) {
      let text = '';
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        text += content.items.map(it => it.str + (it.hasEOL ? '\n' : '')).join('') + '\n\n';
        page.cleanup();
      }
      if (!looksGarbled(text)) return { text: text.trim() };
    }
    const images = [];
    for (let n = 1; n <= Math.min(pdf.numPages, 6); n++) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: 1600 / Math.max(page.getViewport({ scale: 1 }).width, page.getViewport({ scale: 1 }).height) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      images.push(await toJpeg(canvas));
      page.cleanup();
    }
    return { images, readAsImages: true };
  } finally {
    await task.destroy();
  }
}
