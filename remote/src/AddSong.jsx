// "Add song": lyrics from pasted text, a PDF, photos or a web page → Malayalam + Manglish files
// (same slides) → the operator reviews and edits → saved to Storage and listed for song search.
// The reading/structuring runs in the prepareSong Cloud Function, saving in saveSong.
import { useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { parseBody, slidesToBody, validateSong, imagesToPayload, pdfToPayload } from './songFile';

const SOURCES = [
  { id: 'text', label: 'Paste' },
  { id: 'pdf', label: 'PDF' },
  { id: 'image', label: 'Photo' },
  { id: 'url', label: 'Web address' },
];

const prepareSong = httpsCallable(functions, 'prepareSong', { timeout: 180000 });
const saveSong = httpsCallable(functions, 'saveSong', { timeout: 60000 });

export function AddSong({ onSaved, onCancel }) {
  const [source, setSource] = useState('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState([]);
  const [pdfAsImages, setPdfAsImages] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null);   // { title, artist, english, mlBody, enBody, notes, malayalamAuto }
  const [checkedML, setCheckedML] = useState(false);

  const canRead = !busy && (source === 'text' ? text.trim() : source === 'url' ? url.trim() : files.length > 0);

  async function read() {
    setError('');
    try {
      let payload;
      if (source === 'text') payload = { text };
      else if (source === 'url') payload = { url: url.trim() };
      else if (source === 'image') { setBusy('Preparing photos…'); payload = { images: await imagesToPayload(files) }; }
      else {
        setBusy('Reading the PDF…');
        const p = await pdfToPayload(files[0], { forceImages: pdfAsImages });
        payload = p.text ? { text: p.text } : { images: p.images };
      }
      setBusy(payload.images ? 'Reading the lyrics from the images… (up to a minute)' : 'Reading the lyrics…');
      const { data } = await prepareSong(payload);
      setDraft({
        title: data.title, artist: data.artist, english: data.english,
        mlBody: slidesToBody(data.ml), enBody: data.english ? '' : slidesToBody(data.en),
        notes: data.notes || [], malayalamAuto: !!data.malayalamAuto,
      });
      setCheckedML(false);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy('');
    }
  }

  const ml = useMemo(() => parseBody(draft?.mlBody), [draft?.mlBody]);
  const en = useMemo(() => parseBody(draft?.enBody), [draft?.enBody]);
  const problems = useMemo(() => (draft ? validateSong({ title: draft.title, english: draft.english, ml, en }) : []), [draft, ml, en]);
  const needsCheck = draft?.malayalamAuto && !checkedML;

  async function save() {
    setError('');
    setBusy('Saving…');
    try {
      const { data } = await saveSong({
        title: draft.title, artist: draft.artist, english: draft.english,
        mlBody: draft.mlBody, enBody: draft.english ? '' : draft.enBody,
      });
      onSaved?.(data.entry);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy('');
    }
  }

  const set = (patch) => setDraft(d => ({ ...d, ...patch }));

  if (!draft) {
    return (
      <div className="search-view add-song">
        <div className="add-song-tabs">
          {SOURCES.map(s => (
            <button key={s.id} className={`add-song-tab${source === s.id ? ' add-song-tab-on' : ''}`}
              onClick={() => { setSource(s.id); setFiles([]); setError(''); }}>{s.label}</button>
          ))}
        </div>

        {source === 'text' && (
          <textarea className="add-song-textarea" rows={12} value={text} onChange={e => setText(e.target.value)}
            placeholder={'Paste the lyrics here — Malayalam, Manglish, or both.\nSinger labels like M / F / All are kept.'} />
        )}
        {source === 'url' && (
          <input className="search-input" type="url" value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://madely.us/lyrics/…  or any lyrics page" />
        )}
        {source === 'pdf' && (
          <>
            <input type="file" accept="application/pdf" onChange={e => setFiles([...e.target.files])} />
            <label className="add-song-check">
              <input type="checkbox" checked={pdfAsImages} onChange={e => setPdfAsImages(e.target.checked)} />
              Read the pages as images (for scanned PDFs or old Malayalam fonts — used automatically when the text can't be read)
            </label>
          </>
        )}
        {source === 'image' && (
          <input type="file" accept="image/*" multiple onChange={e => setFiles([...e.target.files])} />
        )}

        <div className="mass-plan-actions">
          <button className="mass-plan-btn mass-plan-btn-primary" disabled={!canRead} onClick={read}>Read lyrics</button>
          <button className="mass-plan-btn" onClick={onCancel} disabled={!!busy}>Cancel</button>
        </div>
        {busy && <p className="search-status">{busy}</p>}
        {error && <p className="add-song-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="search-view add-song">
      <p className="section-heading">Review the song</p>
      {draft.notes.map((n, i) => <p key={i} className="access-hint" style={{ margin: 0 }}>{n}</p>)}

      <label className="add-song-label">Title
        <input className="search-input" value={draft.title} onChange={e => set({ title: e.target.value })} />
      </label>
      <label className="add-song-label">Artist (optional)
        <input className="search-input" value={draft.artist} onChange={e => set({ artist: e.target.value })} />
      </label>
      <label className="add-song-check">
        <input type="checkbox" checked={draft.english} onChange={e => set({ english: e.target.checked })} />
        English song (no Manglish file)
      </label>

      <p className="access-hint" style={{ margin: 0 }}>
        A line with just <b>M</b>, <b>F</b> or <b>A</b> starts a new slide (male, female, all).
        {!draft.english && ' The Manglish must have the same slides, voices and number of lines as the Malayalam.'}
      </p>

      <div className={`add-song-columns${draft.english ? ' add-song-single' : ''}`}>
        <label className="add-song-label">{draft.english ? 'Lyrics' : 'Malayalam'} · {ml.length} slides
          <textarea className="add-song-textarea add-song-ml" rows={18} value={draft.mlBody} onChange={e => set({ mlBody: e.target.value })} />
        </label>
        {!draft.english && (
          <label className="add-song-label">Manglish · {en.length} slides
            <textarea className="add-song-textarea" rows={18} value={draft.enBody} onChange={e => set({ enBody: e.target.value })} />
          </label>
        )}
      </div>

      {draft.malayalamAuto && (
        <label className="add-song-check add-song-warn">
          <input type="checkbox" checked={checkedML} onChange={e => setCheckedML(e.target.checked)} />
          The Malayalam was written by AI from the Manglish. I have checked every line.
        </label>
      )}

      {problems.length > 0 && (
        <ul className="add-song-problems">{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
      )}

      <div className="mass-plan-actions">
        <button className="mass-plan-btn mass-plan-btn-primary" disabled={!!busy || problems.length > 0 || needsCheck} onClick={save}>Save song</button>
        <button className="mass-plan-btn" disabled={!!busy} onClick={() => { setDraft(null); setError(''); }}>Start over</button>
        <button className="mass-plan-btn" disabled={!!busy} onClick={onCancel}>Cancel</button>
      </div>
      {busy && <p className="search-status">{busy}</p>}
      {error && <p className="add-song-error">{error}</p>}
    </div>
  );
}
