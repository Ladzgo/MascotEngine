import React, {useEffect, useRef, useState} from 'react';
import {api, type ClipsData} from './api';
import {Alert, Check, Play} from './icons';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Long video in, 9:16 clips out (npm run clip, free and local). */
export function Clipper() {
  const [d, setD] = useState<ClipsData | null>(null), [err, setErr] = useState<string | null>(null);
  const [path, setPath] = useState(''), [upload, setUpload] = useState(''), [min, setMin] = useState(20), [max, setMax] = useState(60), [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const load = () => api.clips().then(x => { setD(x); setErr(null); }).catch(e => setErr((e as Error).message));
  useEffect(() => { void load(); }, []);
  const running = d?.job.status === 'running';
  useEffect(() => { if (!running) return; const t = setInterval(() => void load(), 3000); return () => clearInterval(t); }, [running]);

  const onFile = async (f?: File) => {
    if (!f) return;
    setBusy(true); setErr(null);
    try { const {name} = await api.uploadClipSource(f); setUpload(name); setPath(''); await load(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const start = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api.startClip({path: upload ? undefined : path, upload: upload || undefined, min, max, count}); await load(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="page">
      <div className="page-head"><div><h1 className="display" tabIndex={-1}>Clipper</h1><p className="muted">Cut a long video into vertical clips that start and end on whole sentences. Free, runs on this computer.</p></div></div>
      {err && <div className="alert" role="alert"><Alert size={18} /><span>{err}</span></div>}
      <form className="panel today-card" onSubmit={start} aria-label="New clip run">
        <h2 className="display">New run</h2>
        <label className="field"><span>Video on this computer (path)</span><input value={path} onChange={e => { setPath(e.target.value); setUpload(''); }} placeholder="/Users/you/Movies/interview.mp4" disabled={running} /></label>
        <div className="row">
          <input ref={file} type="file" accept="video/*" hidden onChange={e => void onFile(e.target.files?.[0])} />
          <button type="button" className="btn" onClick={() => file.current?.click()} disabled={busy || running}>Upload a video</button>
          {d && d.sources.length > 0 && <label className="field grow"><span>Or an earlier upload</span>
            <select value={upload} onChange={e => { setUpload(e.target.value); if (e.target.value) setPath(''); }} disabled={running}><option value="">None</option>{d.sources.map(s => <option key={s}>{s}</option>)}</select></label>}
        </div>
        <div className="row">
          <label className="field"><span>Shortest (s)</span><input type="number" min={5} max={120} value={min} onChange={e => setMin(+e.target.value)} /></label>
          <label className="field"><span>Longest (s)</span><input type="number" min={10} max={180} value={max} onChange={e => setMax(+e.target.value)} /></label>
          <label className="field"><span>Clips</span><input type="number" min={1} max={10} value={count} onChange={e => setCount(+e.target.value)} /></label>
        </div>
        <div className="row"><button className="btn primary" type="submit" disabled={busy || running || !(path.trim() || upload)}><Play size={15} />{running ? 'Working… (a few minutes)' : 'Find clips'}</button></div>
        {d?.job.status === 'error' && <p className="err-text" role="alert">{d.job.error}</p>}
        {d?.job.status === 'done' && <p className="ok-text" role="status"><Check size={14} /> Done: {d.job.name}</p>}
      </form>
      {d && !d.items.length && <p className="muted">No clips yet. Add a video above and press Find clips.</p>}
      {d?.items.map(it => (
        <section key={it.name} className="panel today-card" aria-label={it.name}>
          <h2 className="display">{it.name}</h2>
          <ul className="mini" style={{display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))'}}>
            {it.clips.map(c => (
              <li key={c.id}>
                {c.video ? <video controls preload="metadata" style={{width: '100%', aspectRatio: '9 / 16', background: '#000'}} src={`/api/clips/${it.name}/${c.video}`} aria-label={`${c.id} preview`} /> : <p className="small muted">Not rendered.</p>}
                <b>{c.id}</b> <span className="small muted num">{mmss(c.start)}-{mmss(c.end)} · score {c.score.toFixed(1)}</span>
                <p className="small">{c.text.length > 140 ? `${c.text.slice(0, 140)}…` : c.text}</p>
              </li>))}
          </ul>
        </section>))}
    </div>
  );
}
