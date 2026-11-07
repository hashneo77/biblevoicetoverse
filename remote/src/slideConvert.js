// Turn an uploaded PDF, PowerPoint (.pptx) or set of images into slide images.
// Libraries are loaded on demand so they don't weigh down the remote's first load.

const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;
const JPEG_QUALITY = 0.9;

export const SLIDE_ACCEPT = '.pdf,.pptx,image/png,image/jpeg,image/webp,image/gif';

export function slideFileKind(files) {
  const names = files.map(f => f.name.toLowerCase());
  if (files.length === 1 && names[0].endsWith('.pdf')) return 'pdf';
  if (files.length === 1 && names[0].endsWith('.pptx')) return 'pptx';
  if (files.every(f => /^image\/(png|jpeg|webp|gif)$/.test(f.type))) return 'images';
  return null;
}

const canvasToJpeg = canvas => new Promise((resolve, reject) =>
  canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not encode slide'))), 'image/jpeg', JPEG_QUALITY));

// Every slide is delivered as 16:9 (1920x1080). Slides already 16:9 are left alone; anything else
// (portrait pages, A4, 4:3) is fitted whole onto a white 16:9 page, centred, nothing cropped.
async function fitTo169(slide) {
  let bmp;
  try { bmp = await createImageBitmap(slide.blob); } catch { return slide; }
  const ratio = bmp.width / bmp.height;
  if (Math.abs(ratio / (16 / 9) - 1) < 0.02) { bmp.close?.(); return slide; }
  const canvas = document.createElement('canvas');
  canvas.width = SLIDE_WIDTH;
  canvas.height = SLIDE_HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
  const scale = Math.min(SLIDE_WIDTH / bmp.width, SLIDE_HEIGHT / bmp.height);
  const w = bmp.width * scale, h = bmp.height * scale;
  ctx.drawImage(bmp, (SLIDE_WIDTH - w) / 2, (SLIDE_HEIGHT - h) / 2, w, h);
  bmp.close?.();
  return { blob: await canvasToJpeg(canvas), ext: 'jpg' };
}

// Returns [{ blob, ext }] in slide order, all 16:9.
export async function convertToSlides(files, onProgress) {
  const raw = await convertRaw(files, onProgress);
  const out = [];
  for (const s of raw) out.push(await fitTo169(s));
  return out;
}

async function convertRaw(files, onProgress) {
  const kind = slideFileKind(files);
  if (kind === 'pdf') return pdfToSlides(files[0], onProgress);
  if (kind === 'pptx') return pptxToSlides(files[0], onProgress);
  if (kind === 'images') {
    return [...files]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .map(f => ({ blob: f, ext: f.type === 'image/jpeg' ? 'jpg' : f.type.split('/')[1] }));
  }
  throw new Error('Choose one PDF, one .pptx, or one or more images');
}

async function pdfToSlides(file, onProgress) {
  const pdfjs = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await loadingTask.promise;
  const out = [];
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      onProgress?.(`Converting page ${n} of ${pdf.numPages}…`);
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: SLIDE_WIDTH / page.getViewport({ scale: 1 }).width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      out.push({ blob: await canvasToJpeg(canvas), ext: 'jpg' });
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();  // pdf.js 6: destroy() lives on the loading task
  }
  return out;
}

async function pptxToSlides(file, onProgress) {
  const [{ init }, { toJpeg }] = await Promise.all([import('pptx-preview'), import('html-to-image')]);
  // Render off-screen at full HD, then capture each slide element
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-100000px;top:0;width:${SLIDE_WIDTH}px;height:${SLIDE_HEIGHT}px;overflow:visible;`;
  document.body.appendChild(host);
  try {
    onProgress?.('Reading presentation…');
    const previewer = init(host, { width: SLIDE_WIDTH, height: SLIDE_HEIGHT, mode: 'list' });
    await previewer.preview(await file.arrayBuffer());
    await Promise.all([...host.querySelectorAll('img')].map(img =>
      img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
    const slides = [...host.querySelectorAll('.pptx-preview-slide-wrapper')];
    if (!slides.length) throw new Error('No slides found in presentation');
    const out = [];
    for (let k = 0; k < slides.length; k++) {
      onProgress?.(`Converting slide ${k + 1} of ${slides.length}…`);
      const el = slides[k];
      const dataUrl = await toJpeg(el, {
        quality: JPEG_QUALITY, pixelRatio: 1, backgroundColor: '#ffffff',
        width: el.offsetWidth, height: el.offsetHeight,
      });
      out.push({ blob: await (await fetch(dataUrl)).blob(), ext: 'jpg' });
    }
    previewer.destroy?.();
    return out;
  } finally {
    host.remove();
  }
}
